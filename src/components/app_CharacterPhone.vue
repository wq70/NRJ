<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useChatState } from '../composables/useChatState'
import { useChatAuth } from '../composables/useChatAuth'
import { globalSettings } from '../store/global'
import { addCharacterPhoneEvent, loadCharacterPhone, saveCharacterPhone } from '../services/characterPhoneRepository'
import { appendPhoneConversationMessage, createManualPhoneDevice, ensurePhoneConversation, generateCharacterPhone, generateContactPhoneReply, makeBuiltInApp, refreshCharacterPhoneApp } from '../services/characterPhone'
import { markPhoneEntrySeen, phoneEntrySeen, phoneResourceUrl, preservePhoneManualEntries } from '../services/characterPhonePresentation'
import { persistActiveTimeline } from '../services/chatTimeline'
import { saveGroupChat } from '../services/groupChat'
import { listMomentsByAuthor } from '../services/momentRepository'
import type { CharacterPhoneApp, CharacterPhoneAppEntry, CharacterPhoneAppKind, CharacterPhoneDevice, CharacterPhoneRecord } from '../types/characterPhone'
import PhoneIcon from './character-phone/PhoneIcon.vue'
import PhoneContent from './character-phone/PhoneContent.vue'
import PhoneSettings from './character-phone/PhoneSettings.vue'

const emit = defineEmits<{ close: [] }>()
const { mockChats } = useChatState()
const { currentChatUserId, currentAccount } = useChatAuth()
const roleKey = ref(''), record = ref<CharacterPhoneRecord | null>(null), deviceKey = ref(''), appKey = ref(''), targetKey = ref('')
const password = ref(''), notice = ref(''), error = ref(''), busy = ref(false), loading = ref(false), now = ref(Date.now())
const folder = ref(''), viewportHeight = ref(window.visualViewport?.height || window.innerHeight)
const rolePicker = ref(false), roleSearch = ref(''), search = ref(''), desktopPage = ref(0), notifications = ref(false)
const roleMoments = ref<any[]>([]), momentLoading = ref(false), selectedContact = ref<any>(null)
const content = ref<InstanceType<typeof PhoneContent> | null>(null), messageList = ref<HTMLElement | null>(null)
const nested = ref(false), showCredential = ref(false), discardExit = ref(false)
const drafts = ref<Record<string, string>>({}), viewed = ref<Record<string, number>>({})
const generated = ref<CharacterPhoneRecord | null>(null), generationOpen = ref(false), generationMode = ref('append'), replacementId = ref(''), keepManual = ref(true)
const deviceToDelete = ref<CharacterPhoneDevice | null>(null), shareEntries = ref<CharacterPhoneAppEntry[] | null>(null), shareIds = ref<string[]>([])
const undo = ref<null | (() => Promise<void>)>(null)
let loadSerial = 0, timer: ReturnType<typeof setInterval> | undefined, noticeTimer: ReturnType<typeof setTimeout> | undefined
const pendingSend = shallowRef<null | { key: string; text: string; persist: () => Promise<void> }>(null)
const roles = computed(() => mockChats.value.filter((c: any) => c.id !== 1 && c.chatType !== 'group' && !c.isCreate))
const role = computed<any>(() => roles.value.find((c: any) => String(c.characterEntityId || c.id) === roleKey.value) || null)
const device = computed(() => record.value?.devices.find(d => d.id === deviceKey.value) || null)
const app = computed(() => device.value?.apps.find(a => a.id === appKey.value) || null)
const groups = computed(() => mockChats.value.filter((c: any) => c.chatType === 'group' && (c.memberIds || []).map(String).includes(roleKey.value)))
const contacts = computed<any[]>(() => role.value?.socialCircle || [])
const targets = computed(() => role.value ? [
  { id: `user:${role.value.id}`, kind: 'user', title: currentAccount.value?.name || '我', avatar: currentAccount.value?.avatarUrl },
  ...groups.value.map((g: any) => ({ id: `group:${g.id}`, kind: 'group', title: g.name, avatar: g.avatar })),
  ...contacts.value.map((c: any) => ({ id: `contact:${c.entityId || c.id}`, kind: 'contact', title: c.name, avatar: c.avatar || c.avatarUrl }))
] : [])
const target = computed(() => targets.value.find(t => t.id === targetKey.value))
const locked = computed(() => !!device.value && device.value.foregroundAppId === '__locked__')
const lockWait = computed(() => Math.max(0, Math.ceil(((device.value?.lockedUntil || 0) - now.value) / 1000)))
const timeLabel = computed(() => new Date(now.value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
const dateLabel = computed(() => new Date(now.value).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }))
const draftKey = computed(() => `${currentChatUserId.value || 'guest'}:${roleKey.value}:${record.value?.timelineId}:${targetKey.value}`)
const draft = computed({ get: () => drafts.value[draftKey.value] || '', set: value => { drafts.value[draftKey.value] = value; storeView() } })
const visibleApps = computed(() => (device.value?.apps || []).filter(a => !a.hidden && a.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())))
const desktopItems = computed(() => {
  const items: Array<{ id: string; app?: CharacterPhoneApp; folder?: string }> = []
  for (const a of visibleApps.value) {
    const name = a.folder?.trim()
    if (!search.value && name) { if (!items.some(i => i.folder === name)) items.push({ id: `folder:${name}`, folder: name }) }
    else items.push({ id: a.id, app: a })
  }
  return items
})
const pagedApps = computed(() => search.value ? desktopItems.value : desktopItems.value.slice(desktopPage.value * 12, desktopPage.value * 12 + 12))
const folderApps = computed(() => visibleApps.value.filter(a => a.folder?.trim() === folder.value))
const dailyNote = computed(() => device.value?.apps.find(a => a.kind === 'notes' && !a.hidden)?.entries.at(-1))
const dockApps = computed(() => (device.value?.apps || []).filter(a => (a.dock ?? ['chat', 'calls', 'photos', 'browser'].includes(a.kind)) && !a.hidden).slice(0, 4))
const pageCount = computed(() => Math.max(1, Math.ceil(desktopItems.value.length / 12)))
const wallpaper = computed(() => {
  const url = phoneResourceUrl(device.value?.wallpaper, true)
  return url ? { backgroundImage: `linear-gradient(180deg,rgba(16,20,30,.15),rgba(16,20,30,.36)),url(${JSON.stringify(url)})` } : {}
})
const allNotifications = computed(() => (device.value?.apps || []).flatMap(a => a.entries.filter(e => !phoneEntrySeen(e)).map(e => ({ app: a, entry: e }))).slice(-30).reverse())
const appBadge = (a: CharacterPhoneApp) => a.entries.length ? a.entries.filter(e => !phoneEntrySeen(e)).length : a.badge
const historyFor = (t: { id: string; kind: string; title: string }) => {
  if (!role.value) return []
  if (t.kind === 'user') return (role.value.messages || []).filter((m: any) => ['left', 'right'].includes(m.type)).map((m: any) => ({ ...m, mine: m.type === 'left', who: m.type === 'left' ? role.value.name : t.title }))
  if (t.kind === 'group') return (groups.value.find((g: any) => `group:${g.id}` === t.id)?.messages || []).filter((m: any) => ['left', 'right'].includes(m.type)).map((m: any) => ({ ...m, mine: String(m.senderId) === roleKey.value, who: m.senderNameSnapshot || m.senderName || '群成员' }))
  return (record.value?.conversations.find(c => c.id === t.id.replace('contact:', ''))?.messages || []).map(m => ({ ...m, mine: m.senderId === roleKey.value, who: m.senderName }))
}
const messages = computed<any[]>(() => target.value ? historyFor(target.value).slice(-80) : [])
const conversations = computed(() => targets.value.map(t => {
  const history = historyFor(t), last = history.at(-1), stamp = Number(last?.createdAt || last?.timestamp || 0)
  return { ...t, preview: messageText(last), stamp, unseen: !!stamp && stamp > (viewed.value[`${record.value?.accountId}:${roleKey.value}:${record.value?.timelineId}:${t.id}`] || 0) }
}).filter(t => `${t.title} ${t.preview}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())).sort((a, b) => b.stamp - a.stamp))
const filteredContacts = computed(() => contacts.value.filter(c => `${c.name} ${c.relation}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())))
const messageText = (m: any) => !m ? '暂无消息' : m.content || (m.imageUrl || m.image ? '[图片]' : m.audioUrl || m.voice ? '[语音]' : m.file ? '[文件]' : m.transfer ? '[转账]' : '[消息]')
const messageImage = (m: any) => phoneResourceUrl(m.imageUrl || (typeof m.image === 'string' ? m.image : ''), true)
const messageTime = (m: any) => { const stamp = Number(m?.createdAt || m?.timestamp || 0); return stamp ? new Date(stamp).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '' }
const flash = (text: string) => { notice.value = text; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { notice.value = '' }, 4500) }
const fail = (e: unknown) => { error.value = e instanceof Error ? e.message : '操作未完成，请重试'; }
const run = async (job: () => Promise<void>) => { if (busy.value) return; busy.value = true; error.value = ''; try { await job() } catch (e) { fail(e) } finally { busy.value = false } }
const preferenceKey = () => `clingy_phone_view_${currentChatUserId.value || 'guest'}`
const storeView = () => { try { localStorage.setItem(preferenceKey(), JSON.stringify({ role: roleKey.value, device: deviceKey.value, drafts: drafts.value, viewed: viewed.value })) } catch { flash('界面偏好未保存；请检查本地存储空间') } }
const save = async () => { if (!record.value) return; try { await saveCharacterPhone(record.value) } catch (e) { fail(e); throw e } }
const saveSettings = () => run(async () => {
  if (!record.value || !device.value) return
  const settings = record.value.settings
  if (!Number.isFinite(settings.contextTokenBudget) || settings.contextTokenBudget < 100 || settings.contextTokenBudget > 3000) throw new Error('上下文预算请填写 100–3000')
  if (!Number.isInteger(settings.maxActionsPerRun) || settings.maxActionsPerRun < 1 || !Number.isInteger(settings.dailyBackgroundLimit) || settings.dailyBackgroundLimit < 0) throw new Error('操作次数请填写有效的非负整数，每次操作上限至少为 1')
  if (device.value.apps.some(a => a.refreshMode === 'auto' && (!Number.isFinite(a.refreshIntervalMinutes) || a.refreshIntervalMinutes < 15))) throw new Error('自动刷新间隔至少为 15 分钟')
  await save(); flash('已保存')
})
const timelineId = () => String(role.value?.timelineState?.activeTimelineId || role.value?.activeTimelineId || 'main')
const load = async () => {
  const serial = ++loadSerial
  folder.value = ''; undo.value = null; record.value = null; deviceKey.value = ''; appKey.value = ''; targetKey.value = ''; search.value = ''; selectedContact.value = null; notifications.value = false; generated.value = null; generationOpen.value = false; error.value = ''
  if (!role.value) return
  loading.value = true
  try {
    const loaded = await loadCharacterPhone(currentChatUserId.value || 'guest', roleKey.value, role.value.id, timelineId())
    if (serial !== loadSerial) return
    record.value = loaded
    let savedDevice = ''
    try { const prefs = JSON.parse(localStorage.getItem(preferenceKey()) || '{}'); if (prefs.role === roleKey.value) savedDevice = prefs.device } catch { /* Ignore invalid presentation preferences. */ }
    const initial = loaded.devices.find(d => d.id === savedDevice) || (loaded.devices.length === 1 ? loaded.devices[0] : null)
    if (initial) openDevice(initial)
  } catch (e) { if (serial === loadSerial) fail(e) } finally { if (serial === loadSerial) loading.value = false }
}
watch([roleKey, currentChatUserId, () => timelineId()], () => void load())
// Contacts can finish loading after the phone opens; do not strand the user on an empty screen.
watch(() => roles.value.map((r: any) => String(r.characterEntityId || r.id)).join('|'), () => {
  if (roles.value.length && !role.value) roleKey.value = String(roles.value[0].characterEntityId || roles.value[0].id)
})
watch(search, () => { desktopPage.value = 0 })
watch(() => messages.value.length, () => { void nextTick(() => messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })) })
const openDevice = (d: CharacterPhoneDevice) => { deviceKey.value = d.id; appKey.value = ''; targetKey.value = ''; search.value = ''; desktopPage.value = 0; d.foregroundAppId = d.lockType === 'none' ? '' : '__locked__'; password.value = ''; storeView() }
const home = async () => { if (busy.value) return; if (content.value?.dirty()) { content.value.back(); return }; appKey.value = ''; nested.value = false; targetKey.value = ''; selectedContact.value = null; notifications.value = false; search.value = ''; if (device.value) { device.value.foregroundAppId = ''; await run(save) } }
const back = () => {
  if (busy.value) return
  if (generationOpen.value) { generationOpen.value = false; return }
  if (deviceToDelete.value) { deviceToDelete.value = null; return }
  if (discardExit.value) { discardExit.value = false; return }
  if (folder.value) { folder.value = ''; return }
  if (shareEntries.value) { shareEntries.value = null; return }
  if (rolePicker.value) { rolePicker.value = false; return }
  if (notifications.value) { notifications.value = false; return }
  if (content.value?.back()) return
  if (selectedContact.value) { selectedContact.value = null; return }
  if (targetKey.value) { targetKey.value = ''; return }
  if (app.value) { void home(); return }
  deviceKey.value = ''; search.value = ''
}
const close = () => { if (busy.value) return; if (pendingSend.value) { flash('消息尚未保存完成，请先点击重试保存消息'); return }; if (content.value?.dirty()) { discardExit.value = true; return }; emit('close') }
const unlock = () => run(async () => {
  if (!device.value || lockWait.value) return
  if (device.value.lockType === 'none' || password.value === device.value.lockCredential) { device.value.failedAttempts = 0; device.value.foregroundAppId = ''; await save(); password.value = ''; return }
  device.value.failedAttempts++
  if (device.value.failedAttempts >= 5) { device.value.failedAttempts = 0; device.value.lockedUntil = Date.now() + 30000 }
  await save(); flash('凭据不正确，请重新输入'); password.value = ''
})
const lockDevice = () => { if (!device.value) return; appKey.value = ''; device.value.foregroundAppId = '__locked__'; password.value = ''; void run(save) }
const openApp = async (a: CharacterPhoneApp) => {
  if (busy.value || locked.value) return
  folder.value = ''; nested.value = false; appKey.value = a.id; targetKey.value = ''; selectedContact.value = null; search.value = ''; notifications.value = false
  if (device.value) { device.value.foregroundAppId = a.id; device.value.lastUsedAt = Date.now(); void run(save) }
  if (a.kind === 'moments') { const key = roleKey.value; momentLoading.value = true; roleMoments.value = []; try { const result = await listMomentsByAuthor(key); if (key === roleKey.value) roleMoments.value = result } catch (e) { fail(e) } finally { momentLoading.value = false } }
}
const openSettings = () => { const settings = device.value?.apps.find(a => a.kind === 'settings'); if (settings) void openApp(settings) }
const openConversation = (id: string) => { targetKey.value = id; const t = targets.value.find(t => t.id === id); const last = t ? historyFor(t).at(-1) : null; viewed.value[`${record.value?.accountId}:${roleKey.value}:${record.value?.timelineId}:${id}`] = Number(last?.createdAt || last?.timestamp || Date.now()); storeView(); void nextTick(() => messageList.value?.scrollTo(0, messageList.value.scrollHeight)) }
const contactChat = (person: any) => { const chat = device.value?.apps.find(a => a.kind === 'chat'); if (!chat) return; void openApp(chat).then(() => openConversation(`contact:${person.entityId || person.id}`)) }
const addDevice = () => run(async () => { if (!record.value) return; const d = createManualPhoneDevice(`设备 ${record.value.devices.length + 1}`); record.value.devices.push(d); record.value.generated = true; record.value.generationSource = 'manual'; await save(); openDevice(d); flash('设备已添加，可在设置中编辑') })
const generate = () => run(async () => { if (!role.value) return; const result = await generateCharacterPhone(role.value, currentChatUserId.value || 'guest', { previewOnly: true }); generated.value = result; generationOpen.value = true; replacementId.value = record.value?.devices[0]?.id || ''; generationMode.value = record.value?.devices.length ? 'append' : 'replace-all' })
const applyGeneration = () => run(async () => {
  if (!record.value || !generated.value) return
  const previous = JSON.parse(JSON.stringify(record.value)) as CharacterPhoneRecord
  const incoming = JSON.parse(JSON.stringify(generated.value.devices)) as CharacterPhoneDevice[]
  incoming.forEach((d, i) => { d.id = `device_${Date.now()}_${i}_${Math.random().toString(36).slice(2,7)}` })
  if (generationMode.value === 'replace-one') {
    const index = record.value.devices.findIndex(d => d.id === replacementId.value)
    if (index < 0 || incoming.length !== 1) throw new Error('替换指定设备时，请选择一台设备，并使用只包含一台设备的生成结果。')
    const old = record.value.devices[index]!, next = incoming[0]!
    record.value.devices.splice(index, 1, keepManual.value ? preservePhoneManualEntries(old, next) : next)
  } else if (generationMode.value === 'append') record.value.devices.push(...incoming)
  else {
    if (keepManual.value && record.value.devices.length) throw new Error('保留手动内容时，请使用新增设备或替换指定设备。')
    record.value.devices = incoming
  }
  record.value.generated = true; record.value.generationSource = 'ai'
  addCharacterPhoneEvent(record.value, { type: 'phone_created', title: '设备档案已建立', detail: `应用了 ${incoming.length} 台设备`, deviceId: incoming[0]?.id || '', actualActor: 'system', characterKnowledge: 'character_known', importance: 2, unresolved: false, bridgeEligible: false })
  try { await save() } catch(e) { record.value = previous; throw e }; generationOpen.value = false; generated.value = null; deviceKey.value = ''; flash(incoming.length ? '设备档案已应用' : '该角色当前没有设备')
})
const removeDevice = () => run(async () => { if (!record.value || !deviceToDelete.value) return; const d = deviceToDelete.value, current = record.value, index = current.devices.indexOf(d); if (index < 0) return; current.devices.splice(index,1); try { await save() } catch(e) { current.devices.splice(index,0,d); throw e }; deviceToDelete.value = null; undo.value = async () => { current.devices.splice(index,0,d); await saveCharacterPhone(current) }; flash('设备已移除，可撤销') })
const addApp = (name: string, kind: CharacterPhoneAppKind) => run(async () => { if (!device.value) return; device.value.apps.push({ ...makeBuiltInApp('notes'), id: `custom_${Date.now()}`, name, icon: name.charAt(0), color: '#7767d8', builtIn: false, kind, entries: [] }); await save(); flash('应用已添加到桌面') })
const uploadWallpaper = (file: File) => run(async () => {
  if (!device.value) return
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 8*1024*1024) throw new Error('请选择 8 MB 以内的 PNG、JPEG、WebP 或 GIF 图片')
  const d = device.value
  d.wallpaper = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file) })
  await save(); flash('壁纸已更新')
})
const editedEvent = (title: string) => { if (!record.value || !device.value || !app.value) return; addCharacterPhoneEvent(record.value, { type: 'user_edited_app', title: `用户修改了${app.value.name}`, detail: title, deviceId: device.value.id, appId: app.value.id, actualActor: 'user', characterKnowledge: 'character_unknown', importance: 2, unresolved: true, bridgeEligible: record.value.settings.userOperationsDiscoverable }) }
const writeEntry = (entry: CharacterPhoneAppEntry) => run(async () => { if (!app.value) return; const a = app.value, r = record.value!, oldEntries = [...a.entries], oldEvents = [...r.events]; const index = a.entries.findIndex(e => e.id === entry.id); if (index < 0) a.entries.push(entry); else a.entries.splice(index,1,entry); editedEvent(entry.title); try { await save() } catch(e) { a.entries = oldEntries; r.events = oldEvents; throw e }; content.value?.saved(); flash('已保存；角色目前不知道这次操作') })
const removeEntry = (entry: CharacterPhoneAppEntry) => run(async () => { if (!app.value || !record.value) return; const a = app.value, r = record.value, index = a.entries.indexOf(entry); if (index < 0) return; const oldEvents = [...r.events]; a.entries.splice(index,1); editedEvent(`删除：${entry.title}`); try { await save() } catch(e) { a.entries.splice(index,0,entry); r.events = oldEvents; throw e }; undo.value = async () => { a.entries.splice(index,0,entry); await saveCharacterPhone(r) }; flash('记录已删除，可撤销') })
const seen = (entry: CharacterPhoneAppEntry) => { markPhoneEntrySeen(entry); void run(save) }
const refresh = (mode: 'incremental' | 'replace-generated') => run(async () => { if (!record.value || !device.value || !app.value || !role.value) return; await refreshCharacterPhoneApp(record.value, device.value, app.value, role.value, mode); flash(mode === 'incremental' ? '新内容已补充' : '生成内容已重建') })
const persistDirect = async (owner: any, accountId: string | null) => { const key = accountId ? `clingy_custom_contacts_${accountId}` : 'clingy_custom_contacts'; const list = JSON.parse(localStorage.getItem(key) || '[]'); const index = list.findIndex((c: any) => String(c.id) === String(owner.id)); if (index < 0) throw new Error('关联角色未找到，消息尚未完成保存'); list[index].messages = owner.messages; list[index].preview = owner.preview; list[index].time = owner.time; localStorage.setItem(key, JSON.stringify(list)); await persistActiveTimeline(owner, accountId) }
const send = () => run(async () => {
  if (!pendingSend.value && (!target.value || !record.value || !device.value || !role.value)) return
  const text = draft.value.trim(); if (!text && !pendingSend.value) return
  if (!pendingSend.value) {
    if (!target.value || !record.value || !device.value || !role.value) return
    const r = record.value, owner = role.value, t = target.value, account = currentChatUserId.value, key = draftKey.value, stamp = Date.now()
    const group: any = t.kind === 'group' ? groups.value.find((g: any) => `group:${g.id}` === t.id) : null
    if (t.kind === 'group' && !group) throw new Error('该群聊已不可用')
    if (t.kind === 'user') { owner.messages ||= []; owner.messages.push({ id: stamp, timestamp: stamp, type: 'left', content: text, actualActor: 'user', phoneAuthorship: 'user_as_character', excludeFromGeneralMemory: true }); owner.preview = text; owner.time = timeLabel.value }
    if (group) { group.messages ||= []; group.messages.push({ id: stamp, timestamp: stamp, type: 'left', content: text, senderId: roleKey.value, senderNameSnapshot: owner.name, actualActor: 'user', phoneAuthorship: 'user_as_character', excludeFromGeneralMemory: true }) }
    const id = t.kind === 'contact' ? t.id.replace('contact:','') : t.id
    const c = ensurePhoneConversation(r, { id, title: t.title, kind: t.kind as 'user' | 'group' | 'contact', participantIds: t.kind === 'contact' ? [roleKey.value,id] : [roleKey.value] })
    appendPhoneConversationMessage(r,c,{content:text,senderId:roleKey.value,senderName:owner.name,actualActor:'user',authorizedByCharacter:false,characterKnowledge:'character_unknown',source:t.kind==='group'?'group_chat':t.kind==='user'?'single_chat':'phone'})
    addCharacterPhoneEvent(r,{type:'user_sent_as_character',title:'出现了一条以角色身份发出的消息',detail:`发给${t.title}：${text}`,deviceId:device.value.id,appId:'chat',actualActor:'user',characterKnowledge:'character_unknown',importance:4,unresolved:true,bridgeEligible:r.settings.userOperationsDiscoverable,meta:{conversationId:t.id}})
    pendingSend.value = { key, text, persist: async () => { if (t.kind==='user') await persistDirect(owner,account); else if (group) { saveGroupChat(account,group); await persistActiveTimeline(group,account) }; await saveCharacterPhone(r) } }
  }
  await pendingSend.value.persist()
  if (drafts.value[pendingSend.value.key]?.trim() === pendingSend.value.text) drafts.value[pendingSend.value.key] = ''
  pendingSend.value = null; storeView(); flash('已真实发出；角色之后查看手机时可能发现')
})
const contactReply = () => run(async () => { if (!target.value || target.value.kind !== 'contact' || !record.value) return; const id = target.value.id.replace('contact:',''); const person = contacts.value.find(c => String(c.entityId || c.id)===id); if (!person) return; const c=ensurePhoneConversation(record.value,{id,title:person.name,kind:'contact',participantIds:[roleKey.value,id]}); const result = await generateContactPhoneReply(record.value,c,person,role.value); flash(result.length ? '联系人已回应' : '对方暂时没有回复') })
const chooseShare = (entries: CharacterPhoneAppEntry[]) => { shareEntries.value = entries; shareIds.value = entries.slice(-5).map(e=>e.id) }
const share = () => run(async () => { if (!role.value || !app.value || !shareEntries.value) return; const summary=shareEntries.value.filter(e=>shareIds.value.includes(e.id)).map(e=>`${e.title}${e.content?`：${e.content}`:''}`).join('\n'); if (!summary) throw new Error('请选择至少一条内容'); const owner=role.value; owner.messages ||= []; const msg={id:Date.now(),timestamp:Date.now(),type:'right',content:`[分享自${owner.name}的手机 · ${app.value.name}]\n${summary}`,phoneShare:true}; owner.messages.push(msg); try { await persistDirect(owner,currentChatUserId.value) } catch(e) { owner.messages.splice(owner.messages.indexOf(msg),1); throw e }; shareEntries.value=null; flash('已分享到与角色的单聊') })
const openNotification = async (a: CharacterPhoneApp, entry: CharacterPhoneAppEntry) => { markPhoneEntrySeen(entry); await openApp(a) }
const resizeViewport = () => { viewportHeight.value = window.visualViewport?.height || window.innerHeight }
const handleKey = (event: KeyboardEvent) => { if (event.key==='Escape') { event.preventDefault(); back() } }
onMounted(() => {
  try { const prefs=JSON.parse(localStorage.getItem(preferenceKey())||'{}'); drafts.value=prefs.drafts||{}; viewed.value=prefs.viewed||{}; roleKey.value=roles.value.some((r:any)=>String(r.characterEntityId||r.id)===prefs.role)?prefs.role:String(roles.value[0]?.characterEntityId||roles.value[0]?.id||'') } catch { roleKey.value=String(roles.value[0]?.characterEntityId||roles.value[0]?.id||'') }
  timer=setInterval(()=>{now.value=Date.now()},1000); window.addEventListener('keydown',handleKey); window.visualViewport?.addEventListener('resize',resizeViewport)
})
onBeforeUnmount(()=>{ ++loadSerial; clearInterval(timer); clearTimeout(noticeTimer); window.removeEventListener('keydown',handleKey); window.visualViewport?.removeEventListener('resize',resizeViewport) })
</script>

<template>
  <div class="phone-app" :class="{ 'dark-mode': globalSettings.darkMode, 'in-device': !!device }" :style="{height:`${viewportHeight}px`}">
    <header v-if="!device" class="phone-topbar"><button class="phone-icon-button" aria-label="退出 TA 的手机" :disabled="busy" @click="close"><PhoneIcon name="back"/></button><b>TA 的手机</b><button class="phone-role-button" :disabled="busy" @click="rolePicker=true">{{ role?.name || '选择角色' }}⌄</button></header>
    <div v-if="notice" class="phone-toast" role="status">{{ notice }}<button v-if="undo" @click="run(async()=>{await undo?.();undo=null;flash('已恢复')})">撤销</button></div>
    <div v-if="error" class="phone-error-banner" role="alert"><span>{{ error }}</span><button v-if="pendingSend" :disabled="busy" @click="send">重试保存消息</button><button v-else @click="error=''" aria-label="关闭错误提示">×</button></div>
    <div v-if="busy" class="phone-progress" role="status">正在处理，请稍候…</div>
    <main v-if="loading" class="phone-empty"><PhoneIcon name="device"/><h3>正在读取设备…</h3></main>
    <main v-else-if="!role || !record" class="phone-empty"><PhoneIcon name="device"/><h3>{{ error ? '设备暂时未能读取' : '还没有可用角色' }}</h3><p>{{ error ? '原有数据仍会保留。' : '建立聊天角色后，就可以探索 TA 的手机。' }}</p><button v-if="role" @click="load">重新读取</button></main>
    <main v-else-if="!device" class="phone-device-list phone-scroll">
      <div class="phone-heading"><span class="phone-eyebrow">PRIVATE DEVICES</span><h1>{{ role.name }} 的设备</h1><p>从一部手机，走进 TA 的日常。</p></div>
      <div v-if="!record.generated" class="phone-welcome"><div class="phone-device-art"><PhoneIcon name="device"/></div><h2>还没有建立设备档案</h2><p>根据角色的生活和习惯生成设备、应用与记录，也可以亲手建立。</p><button class="phone-primary" :disabled="busy" @click="generate">按人设生成</button><button :disabled="busy" @click="addDevice">手动添加</button></div>
      <template v-else>
        <div v-if="!record.devices.length" class="phone-empty"><PhoneIcon name="device"/><h3>TA 当前没有设备</h3><p>这是设备档案的结果；你仍然可以手动添加。</p></div>
        <div v-for="d in record.devices" :key="d.id" class="phone-device-card"><button class="phone-device-open" :disabled="busy" @click="openDevice(d)"><div class="phone-device-art"><PhoneIcon name="device"/></div><div><b>{{ d.name }}</b><span>{{ d.purpose }}</span><small>{{ d.battery }}% 电量 · {{ d.lockType==='none' ? '无锁屏' : '已设锁屏' }} · {{ d.apps.length }} 个应用</small></div><span>›</span></button><button class="phone-device-delete" :disabled="busy" @click="deviceToDelete=d">移除设备</button></div>
        <div class="phone-actions"><button class="phone-primary" :disabled="busy" @click="addDevice"><PhoneIcon name="plus"/>添加设备</button><button :disabled="busy" @click="generate">重新按人设生成设备档案</button></div>
      </template>
    </main>
    <section v-else class="phone-handset" :class="{'on-wallpaper': locked || !app}" :style="!app || locked ? wallpaper : {}">
      <div class="phone-statusbar"><button :disabled="busy" @click="back" aria-label="返回设备列表"><PhoneIcon name="back"/></button><span>{{ timeLabel }}</span><span class="phone-device-name">{{ device.name }}</span><span class="phone-status-icons">{{ device.doNotDisturb?'☾ ':'' }}{{ device.silent?'静音 ':'' }}<span class="phone-battery"><i :style="{width:`${device.battery}%`}"></i></span>{{ device.battery }}%</span><button :disabled="busy" @click="close" aria-label="退出手机"><PhoneIcon name="close"/></button></div>
      <div v-if="locked" class="phone-lock phone-scroll">
        <PhoneIcon name="lock"/><p>{{ dateLabel }}</p><strong>{{ timeLabel }}</strong><span>{{ device.name }}</span>
        <div class="phone-unlock">
          <template v-if="device.lockType==='none'"><button class="phone-unlock-button" @click="unlock">轻触进入手机 ↑</button></template>
          <template v-else>
            <p>{{ device.lockType==='biometric' ? '使用备用凭据解锁' : device.lockType==='pattern' ? '按顺序选择图案点' : '输入锁屏凭据' }}</p>
            <input v-model="password" :type="showCredential?'text':'password'" :inputmode="device.lockType==='pin'?'numeric':'text'" aria-label="锁屏凭据" autocomplete="off" :disabled="busy || lockWait>0" @keyup.enter="unlock">
            <button class="phone-text-button" @click="showCredential=!showCredential">{{ showCredential?'隐藏':'显示' }}凭据</button>
            <div v-if="device.lockType==='pin'" class="phone-keypad"><button v-for="key in ['1','2','3','4','5','6','7','8','9','清除','0','⌫']" :key="key" :disabled="busy || lockWait>0" @click="password=key==='清除'?'':key==='⌫'?password.slice(0,-1):password+key">{{ key }}</button></div>
            <div v-if="device.lockType==='pattern'" class="phone-pattern"><button v-for="key in 9" :key="key" :class="{selected:password.includes(String(key))}" :disabled="busy || lockWait>0" @click="password+=String(key)">{{ key }}</button></div>
            <button v-if="device.lockType==='pattern'" class="phone-text-button" @click="password=''">重新绘制</button>
            <button class="phone-unlock-button" :disabled="busy || lockWait>0" @click="unlock">{{ lockWait ? `${lockWait} 秒后重试` : '解锁' }}</button><small>错误 {{ device.failedAttempts }}/5 次</small>
            <small v-if="device.lockType==='biometric'">虚构设备设定，不调用真实生物识别</small>
          </template>
        </div>
      </div>
      <template v-else-if="!app">
        <div class="phone-desktop phone-scroll">
          <div class="phone-desktop-heading"><div><p>{{ dateLabel }}</p><strong>{{ timeLabel }}</strong><span>{{ role.name }} 的日常</span></div><button class="phone-icon-button" aria-label="通知中心" @click="notifications=true"><PhoneIcon name="bell"/><em v-if="allNotifications.length">{{ allNotifications.length }}</em></button></div>
          <label class="phone-search desktop-search"><PhoneIcon name="search"/><input v-model="search" placeholder="搜索应用" aria-label="搜索应用"></label>
          <button v-if="dailyNote && !search" class="phone-note-widget" @click="openApp(device.apps.find(a=>a.kind==='notes')!)"><small>备忘录</small><b>{{ dailyNote.title }}</b><span>{{ dailyNote.content || '查看记录' }}</span></button>
          <div class="phone-app-grid"><button v-for="item in pagedApps" :key="item.id" :disabled="busy" @click="item.app ? openApp(item.app) : folder=item.folder || ''" @contextmenu.prevent="openSettings"><template v-if="item.app"><span class="phone-app-icon" :style="{background:item.app.color}"><PhoneIcon :name="item.app.builtIn ? item.app.kind : item.app.kind==='gallery'?'photos':item.app.kind==='feed'?'moments':'notes'"/></span><span class="phone-app-name">{{ item.app.name }}</span><em v-if="appBadge(item.app)">{{ appBadge(item.app)>99?'99+':appBadge(item.app) }}</em></template><template v-else><span class="phone-app-icon phone-folder-icon"><i v-for="a in visibleApps.filter(a=>a.folder?.trim()===item.folder).slice(0,9)" :key="a.id" :style="{background:a.color}"></i></span><span class="phone-app-name">{{ item.folder }}</span></template></button></div>
          <p v-if="!pagedApps.length" class="phone-empty-small">没有找到应用，可在设置中管理隐藏应用。</p>
          <div v-if="pageCount>1 && !search" class="phone-page-dots"><button v-for="n in pageCount" :key="n" :class="{selected:desktopPage===n-1}" :aria-label="`桌面第 ${n} 页`" @click="desktopPage=n-1"></button></div>
          <div class="phone-desktop-tools"><button :disabled="busy" @click="openSettings">设备设置</button><button :disabled="busy" @click="lockDevice">锁屏</button><button :disabled="busy" @click="deviceKey='';rolePicker=true">切换角色</button></div>
        </div>
        <div class="phone-dock"><button v-for="a in dockApps" :key="a.id" :disabled="busy" :aria-label="a.name" @click="openApp(a)"><span class="phone-app-icon" :style="{background:a.color}"><PhoneIcon :name="a.kind"/></span><small>{{ a.name }}</small></button></div>
      </template>
      <template v-else>
        <div class="phone-app-header"><button class="phone-icon-button" aria-label="返回" :disabled="busy" @click="back"><PhoneIcon name="back"/></button><div><b>{{ target?.title || selectedContact?.name || app.name }}</b><small v-if="target">{{ target.kind==='group'?'群聊':`以 ${role.name} 的身份查看` }}</small></div><button v-if="app.kind!=='settings' && !nested" class="phone-icon-button" aria-label="设备设置" :disabled="busy" @click="openSettings"><PhoneIcon name="settings"/></button><span v-else class="phone-icon-spacer"></span></div>
        <template v-if="app.kind==='chat'">
          <template v-if="!target"><label class="phone-search phone-list-search"><PhoneIcon name="search"/><input v-model="search" placeholder="搜索会话" aria-label="搜索会话"></label><div class="phone-scroll"><button v-for="t in conversations" :key="t.id" class="phone-conversation" @click="openConversation(t.id)"><span class="phone-avatar"><img v-if="phoneResourceUrl(t.avatar,true)" :src="phoneResourceUrl(t.avatar,true)" alt=""><span v-else>{{ t.title?.slice(0,1) }}</span></span><span class="phone-conversation-copy"><b>{{ t.title }}</b><small>{{ t.preview }}</small></span><span class="phone-conversation-meta"><small>{{ t.stamp?new Date(t.stamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):'' }}</small><i v-if="t.unseen"></i></span></button><div v-if="!conversations.length" class="phone-empty"><h3>没有找到会话</h3><p>试试其他关键词。</p></div></div></template>
          <template v-else>
            <div ref="messageList" class="phone-messages phone-scroll"><div v-if="!messages.length" class="phone-empty"><h3>还没有聊天记录</h3><p>在下方输入内容，开始这段对话。</p></div><article v-for="(m,index) in messages" :key="m.id" :class="{mine:m.mine}"><time v-if="index===0 || messageTime(m)!==messageTime(messages[index-1])">{{ messageTime(m) }}</time><small>{{ m.who }}</small><div class="phone-bubble"><img v-if="messageImage(m)" :src="messageImage(m)" alt="聊天图片"><p>{{ messageText(m) }}</p></div><small v-if="m.phoneAuthorship==='user_as_character'">由你使用手机发出</small></article></div>
            <div class="phone-compose-wrap"><p class="phone-hint">以 {{ role.name }} 的身份发送，消息会写入关联会话。</p><div class="phone-compose"><textarea v-model="draft" rows="1" aria-label="消息内容" placeholder="输入消息…" :disabled="busy || !!pendingSend"></textarea><button class="phone-primary" :disabled="busy || (!draft.trim() && !pendingSend)" @click="send">{{ busy?'处理中':pendingSend?'重试':'发送' }}</button></div><button v-if="target.kind==='contact'" class="phone-text-button" :disabled="busy" @click="contactReply">生成联系人回应</button></div>
          </template>
        </template>
        <template v-else-if="app.kind==='contacts'">
          <article v-if="selectedContact" class="phone-scroll phone-detail"><span class="phone-avatar large">{{ selectedContact.name?.slice(0,1) }}</span><h2>{{ selectedContact.name }}</h2><p class="phone-muted">{{ selectedContact.relation }}</p><p class="phone-prose">{{ selectedContact.description || selectedContact.persona || '暂无介绍' }}</p><button class="phone-primary" @click="contactChat(selectedContact)">进入聊天</button></article>
          <template v-else><label class="phone-search phone-list-search"><PhoneIcon name="search"/><input v-model="search" placeholder="搜索联系人" aria-label="搜索联系人"></label><div class="phone-scroll"><button v-for="c in filteredContacts" :key="c.entityId || c.id" class="phone-conversation" @click="selectedContact=c"><span class="phone-avatar">{{ c.name?.slice(0,1) }}</span><span class="phone-conversation-copy"><b>{{ c.name }}</b><small>{{ c.relation }}</small></span><span>›</span></button><div v-if="!filteredContacts.length" class="phone-empty"><h3>暂无联系人</h3><p>这里展示角色已有的生活人脉。</p></div></div></template>
        </template>
        <div v-else-if="app.kind==='moments'" class="phone-scroll phone-moments"><div class="phone-moments-cover"><span>{{ role.name }}</span><p>生活里的片刻</p></div><p v-if="momentLoading" class="phone-empty-small">正在读取动态…</p><article v-for="m in roleMoments" :key="m.id"><span class="phone-avatar">{{ String(m.author || role.name).slice(0,1) }}</span><div><b>{{ m.author || role.name }}</b><p class="phone-prose">{{ m.content }}</p><div class="phone-moment-images"><img v-for="(url,i) in (m.images || []).filter((u:unknown)=>phoneResourceUrl(u,true))" :key="i" :src="url" alt="动态图片" loading="lazy"></div><small>{{ new Date(m.time).toLocaleString('zh-CN') }}</small></div></article><p v-if="!momentLoading && !roleMoments.length" class="phone-empty-small">角色当前没有朋友圈。</p></div>
        <PhoneSettings v-else-if="app.kind==='settings'" :record="record" :device="device" @save="saveSettings" @add="addApp" @wallpaper="uploadWallpaper" @lock="lockDevice" @devices="deviceKey='';appKey=''"/>
        <PhoneContent v-else :key="`${device.id}:${app.id}`" ref="content" :app="app" :now="now" :busy="busy" @seen="seen" @write="writeEntry" @remove="removeEntry" @share="chooseShare" @refresh="refresh" @save="saveSettings" @state="nested=$event"/>
      </template>
      <button v-if="!locked" class="phone-home-indicator" aria-label="回到手机桌面" :disabled="busy" @click="home"><span></span></button>
    </section>
    <div v-if="folder && device" class="phone-overlay" role="dialog" aria-modal="true" aria-label="桌面文件夹"><section class="phone-sheet"><div class="phone-subbar"><h3>{{ folder }}</h3><button @click="folder=''">关闭</button></div><div class="phone-app-grid"><button v-for="a in folderApps" :key="a.id" @click="openApp(a)"><span class="phone-app-icon" :style="{background:a.color}"><PhoneIcon :name="a.kind"/></span><span class="phone-app-name">{{ a.name }}</span></button></div></section></div>
    <div v-if="rolePicker" class="phone-overlay" role="dialog" aria-modal="true" aria-label="选择角色"><section class="phone-sheet"><div class="phone-subbar"><h3>选择角色</h3><button class="phone-icon-button" aria-label="关闭角色选择" @click="rolePicker=false"><PhoneIcon name="close"/></button></div><label class="phone-search"><PhoneIcon name="search"/><input v-model="roleSearch" placeholder="搜索角色" aria-label="搜索角色"></label><div class="phone-scroll"><button v-for="r in roles.filter((r:any)=>r.name?.includes(roleSearch))" :key="r.id" class="phone-conversation" @click="roleKey=String(r.characterEntityId || r.id);rolePicker=false"><span class="phone-avatar">{{ r.name?.slice(0,1) }}</span><b>{{ r.name }}</b><PhoneIcon v-if="roleKey===String(r.characterEntityId||r.id)" name="check"/></button></div></section></div>
    <div v-if="notifications && !locked" class="phone-overlay" role="dialog" aria-modal="true" aria-label="通知中心"><section class="phone-sheet"><div class="phone-subbar"><h3>通知中心</h3><button class="phone-icon-button" aria-label="关闭通知中心" @click="notifications=false"><PhoneIcon name="close"/></button></div><p class="phone-hint">仅表示你尚未浏览的内容，不改变角色是否知情。</p><div class="phone-scroll"><button v-for="n in allNotifications" :key="`${n.app.id}:${n.entry.id}`" class="phone-notification" @click="openNotification(n.app,n.entry)"> <PhoneIcon :name="n.app.kind"/><span><small>{{ n.app.name }}</small><b>{{ n.entry.title }}</b></span></button><p v-if="!allNotifications.length" class="phone-empty-small">暂时没有新通知。</p><details v-if="record"><summary>手机活动记录</summary><article v-for="e in [...record.events].reverse().slice(0,30)" :key="e.id" class="phone-event"><b>{{ e.title }}</b><p>{{ e.detail }}</p><small>{{ e.characterKnowledge==='character_unknown'?'角色尚不知情':e.characterKnowledge==='character_suspects'?'角色有所怀疑':'角色已知情' }}</small></article></details></div></section></div>
    <div v-if="generationOpen && generated" class="phone-overlay" role="dialog" aria-modal="true" aria-label="生成结果预览"><section class="phone-sheet"><h3>设备档案预览</h3><p>生成了 {{ generated.devices.length }} 台设备。应用前不会替换现有设备。</p><div class="phone-scroll"><article v-for="d in generated.devices" :key="d.id" class="phone-event"><b>{{ d.name }}</b><p>{{ d.purpose }}</p><small>{{ d.apps.map(a=>a.name).join(' · ') }}</small></article><p v-if="!generated.devices.length">根据本次人设生成，角色当前没有设备。</p></div><label v-if="record?.devices.length">应用方式<select v-model="generationMode"><option value="append">新增到现有设备</option><option v-if="generated.devices.length===1" value="replace-one">替换指定设备</option><option value="replace-all">替换全部设备</option></select></label><label v-if="generationMode==='replace-one'">替换目标<select v-model="replacementId"><option v-for="d in record?.devices" :key="d.id" :value="d.id">{{ d.name }}</option></select></label><label v-if="generationMode!=='append' && record?.devices.length">保留手动内容<input v-model="keepManual" class="phone-switch" type="checkbox"></label><p v-if="generationMode==='replace-all' && record?.devices.length" class="phone-hint">替换全部会移除现有设备内容。若要保留手动内容，请选择新增或替换指定设备。</p><div class="phone-actions"><button :disabled="busy" @click="generationOpen=false;generated=null">取消</button><button class="phone-primary" :disabled="busy || (generationMode==='replace-all' && keepManual && !!record?.devices.length)" @click="applyGeneration">应用结果</button></div></section></div>
    <div v-if="deviceToDelete" class="phone-overlay" role="dialog" aria-modal="true" aria-label="移除设备"><section class="phone-sheet"><h3>移除 {{ deviceToDelete.name }}？</h3><p>该设备及应用记录会从设备列表移除，关联单聊和群聊不受影响。</p><div class="phone-actions"><button @click="deviceToDelete=null">取消</button><button class="danger-text" :disabled="busy" @click="removeDevice">移除</button></div></section></div>
    <div v-if="shareEntries" class="phone-overlay" role="dialog" aria-modal="true" aria-label="分享内容"><section class="phone-sheet"><h3>分享到与 {{ role?.name }} 的单聊</h3><p>选择要分享的记录，发送内容为标题与正文。</p><div class="phone-scroll"><label v-for="e in shareEntries" :key="e.id"><span>{{ e.title }}</span><input v-model="shareIds" type="checkbox" :value="e.id" class="phone-switch"></label><p v-if="!shareEntries.length">没有可分享的记录。</p></div><div class="phone-actions"><button @click="shareEntries=null">取消</button><button class="phone-primary" :disabled="busy || !shareIds.length" @click="share">分享 {{ shareIds.length }} 条</button></div></section></div>
    <div v-if="discardExit" class="phone-overlay" role="dialog" aria-modal="true" aria-label="未保存修改"><section class="phone-sheet"><h3>退出前有未保存的修改</h3><div class="phone-actions"><button @click="discardExit=false">继续编辑</button><button @click="emit('close')">放弃并退出</button></div></section></div>
  </div>
</template>
<style src="./app_CharacterPhone.css"></style>
