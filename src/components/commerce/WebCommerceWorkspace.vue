<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useMall } from '../../composables/useMall'
import { commercePlatforms, commercePlatformForUrl, loadCommerceSession, redactCommerceText, safeCommerceUrl, saveCommerceSession } from '../../services/commerce'
import { CommerceGateway, CommerceGatewayError, commercePointer, loadCommerceEndpoint, saveCommerceEndpoint } from '../../services/commerceGateway'
import { askWebCommerceCompanion } from '../../services/commerceCompanion'
import type { CommercePlatform, CommerceTarget } from '../../types/commerce'
import type { CommerceCandidate, CommercePermission, CommerceRealOrder, CommerceServiceUser, CommerceWebPage, CommerceWebSession } from '../../types/commerceWeb'
import { chatSettings } from '../../store'
import { isSpeechRecognitionReady, transcribeAudio } from '../../services/speechRecognition'
import { mediaErrorMessage, recordStream, requestMicrophone, stopMediaStream } from '../../services/browserMedia'
import { downloadWebFile, prepareWebFile, releasePreparedWebFile } from '../../services/webFileSave'

const props = defineProps<{ initialUrl?: string; characterId?: string }>()
const emit = defineEmits<{ close: [] }>()
const mall = useMall()
mall.ensureLoaded()
const account = mall.accountId.value
const selectedCharacterId = ref(props.characterId || '')
const platformId = ref<CommercePlatform>(commercePlatformForUrl(props.initialUrl || '')?.id || 'meituan')
const platform = computed(() => commercePlatforms.find(p => p.id === platformId.value)!)
const character = computed(() => mall.characters.value.find(c => String(c.characterEntityId || c.id) === selectedCharacterId.value))
const history = ref(loadCommerceSession(account, selectedCharacterId.value, platformId.value))
const remote = ref<CommerceWebSession | null>(null)
const user = ref<CommerceServiceUser | null>(null)
const endpoint = ref(loadCommerceEndpoint(account))
let gateway = new CommerceGateway(endpoint.value)
const endpointDraft = ref(endpoint.value)
const username = ref(''), password = ref('')
const remember = ref(false)
const permission = ref<CommercePermission>('observe')
const page = ref<CommerceWebPage | null>(null)
const candidates = ref<CommerceCandidate[]>([]), orders = ref<CommerceRealOrder[]>([])
const currentUrl = ref(props.initialUrl || history.value.url || platform.value.home)
const title = ref('真实平台共逛')
const host = computed(() => { try { return new URL(currentUrl.value).hostname } catch { return '' } })
const input = ref(''), urlInput = ref(''), platformInput = ref(''), privateInput = ref(false)
const notice = ref(''), working = ref(false), busy = ref(false), connecting = ref(false)
const collapsed = ref(false), keyboard = ref(false), frameBusy = ref(false)
const imageUrl = ref(''), frameId = ref(''), frameReady = ref(false)
const platformDialog = ref<{ type: string; message: string } | null>(null), dialogInput = ref('')
const panel = ref<'' | 'connect' | 'settings' | 'records' | 'link' | 'list' | 'orders'>('')
const suggestion = ref<{ target: CommerceTarget; token: string; generation: number }>()
const transcript = ref<HTMLElement>(), screen = ref<HTMLImageElement>()
const listFilter = ref<'all' | 'wish'>('all')
const recording = ref(false), transcribing = ref(false)
let voiceStream: MediaStream | null = null, voiceRecorder: MediaRecorder | null = null
let voiceResult: Promise<Blob> | null = null, voiceTimer: ReturnType<typeof setTimeout> | undefined
let voiceAbort: AbortController | undefined
const selectedForCompare = ref<string[]>([])
const roleCandidates = computed(() => candidates.value.filter(c => c.characterId === (selectedCharacterId.value || 'solo')))
const visibleCandidates = computed(() => roleCandidates.value.filter(c => listFilter.value === 'all' || c.wished))
const comparison = computed(() => roleCandidates.value.filter(c => selectedForCompare.value.includes(c.id)).slice(0, 4))
const knownTotal = computed(() => roleCandidates.value.reduce((sum, c) => sum + (c.priceCents || 0) * c.quantity, 0))
const unknownPrices = computed(() => roleCandidates.value.filter(c => c.priceCents == null).length)
const money = (cents?: number) => cents == null ? '价格未识别' : `¥${(cents / 100).toFixed(2)}`
const platformName = (id: string) => commercePlatforms.find(p => p.id === id)?.name || id
const sourceName = (source: string) => source === 'official-api' ? '平台接口确认' : '平台页面读取'
let disposed = false, generation = 0, pollTimer: ReturnType<typeof setTimeout> | undefined
let pollAbort: AbortController | undefined, chatAbort: AbortController | undefined
let objectUrl = '', pollFailures = 0
let pointer: { x: number; y: number; frame: string; at: number } | undefined
const ownerKey = `clingy_commerce_service_owner_${encodeURIComponent(account)}`

const report = (error: unknown) => {
  notice.value = error instanceof Error ? error.message : String(error)
  if (error instanceof CommerceGatewayError && error.status === 401) {
    user.value = null; remote.value = null; stopPolling(); panel.value = 'connect'
  }
}
const persist = () => {
  try { saveCommerceSession(account, history.value) } catch { notice.value = '本机存储空间不足，对话暂未保存。' }
}
const invalidate = () => { generation++; page.value = null; suggestion.value = undefined; chatAbort?.abort(); busy.value = false }
const stopPolling = () => { clearTimeout(pollTimer); pollAbort?.abort(); pollAbort = undefined; frameReady.value = false }
const clearImage = () => { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = ''; imageUrl.value = ''; frameId.value = ''; frameReady.value = false }
const poll = async () => {
  clearTimeout(pollTimer)
  const active = remote.value
  if (disposed || !active || panel.value || document.hidden) return
  if (frameBusy.value || working.value || pointer) { pollTimer = setTimeout(() => void poll(), 300); return }
  frameBusy.value = true
  const client = gateway
  const controller = new AbortController(); pollAbort = controller
  try {
    const info = await client.info(active.id)
    if (disposed || remote.value?.id !== active.id || controller.signal.aborted) return
    platformDialog.value = info.dialog || null
    if (platformDialog.value) return
    currentUrl.value = info.url
    const frame = await client.frame(active.id, controller.signal)
    if (disposed || remote.value?.id !== active.id || controller.signal.aborted || working.value) return
    const next = URL.createObjectURL(frame.blob)
    const previous = objectUrl
    objectUrl = next; imageUrl.value = next; frameId.value = frame.frameId; frameReady.value = false
    if (previous) URL.revokeObjectURL(previous)
    if (frame.notice) notice.value = frame.notice
    pollFailures = 0
  } catch (error) {
    if (!controller.signal.aborted && !disposed) { pollFailures++; report(error) }
  } finally {
    frameBusy.value = false
    if (pollAbort === controller) pollAbort = undefined
    if (!disposed && remote.value?.id === active.id && !panel.value && !document.hidden && !platformDialog.value) pollTimer = setTimeout(() => void poll(), Math.min(1500 * 2 ** pollFailures, 15000))
  }
}
const refreshRecords = async () => {
  const [list, purchases] = await Promise.all([gateway.candidates(), gateway.orders()])
  if (disposed) return
  candidates.value = list.items; orders.value = purchases.items
}
const closeRemote = async (forget = false) => {
  const active = remote.value
  remote.value = null; platformDialog.value = null; stopPolling(); clearImage(); invalidate()
  if (active) await gateway.close(active.id, forget)
}
const openPlatform = async (url = currentUrl.value) => {
  if (!user.value) { panel.value = 'connect'; return }
  if (working.value) return
  working.value = true; stopPolling(); invalidate()
  const client = gateway
  try {
    if (remote.value) await closeRemote()
    const next = await client.open(platformId.value, url, remember.value)
    if (disposed) { await client.close(next.id); return }
    remote.value = next; permission.value = next.permission; currentUrl.value = next.url
    notice.value = next.notice || '在平台页面登录和选购。提交订单、付款和验证由你完成。'
    panel.value = ''
    await refreshRecords()
  } catch (error) { report(error) }
  finally { working.value = false; if (!disposed) void poll() }
}
const connect = async () => {
  if (connecting.value || working.value) return
  connecting.value = true; notice.value = ''
  const secret = password.value; password.value = ''
  try {
    if (remote.value) await closeRemote()
    const base = saveCommerceEndpoint(account, endpointDraft.value)
    endpoint.value = base; gateway = new CommerceGateway(base)
    const connected = await gateway.login(username.value.trim(), secret)
    if (disposed) { await gateway.logout(); return }
    user.value = connected; localStorage.setItem(ownerKey, connected.id)
    await openPlatform()
  } catch (error) { report(error) }
  finally { connecting.value = false }
}
const reconnect = async () => {
  if (connecting.value || working.value) return
  connecting.value = true
  try {
    const connected = await gateway.restore()
    if (localStorage.getItem(ownerKey) !== connected.id) { panel.value = 'connect'; notice.value = '请为当前粘人精账号连接共逛服务。'; return }
    user.value = connected
    await openPlatform()
  } catch (error) { report(error); panel.value = 'connect' }
  finally { connecting.value = false }
}
const switchPlatform = async (id: CommercePlatform) => {
  if (working.value || connecting.value || id === platformId.value) return
  persist(); invalidate(); working.value = true
  try { await closeRemote() } catch (error) { report(error) } finally { working.value = false }
  platformId.value = id; history.value = loadCommerceSession(account, selectedCharacterId.value, id)
  currentUrl.value = history.value.url || platform.value.home; title.value = '真实平台共逛'; selectedForCompare.value = []
  await openPlatform()
}
const selectCharacter = async (id: string) => {
  if (working.value || connecting.value || id === selectedCharacterId.value) return
  persist(); invalidate(); selectedCharacterId.value = id
  history.value = loadCommerceSession(account, id, platformId.value); selectedForCompare.value = []
  // Character changes never open another platform browser or buy another quantity.
  if (remote.value) await updatePermission('observe')
}
const action = async (body: Record<string, unknown>, useFrame = false) => {
  if (!remote.value || working.value || (useFrame && !frameReady.value)) return
  const id = remote.value.id, selectedFrame = frameId.value
  working.value = true; stopPolling(); invalidate(); platformInput.value = body.type === 'text' ? '' : platformInput.value
  try {
    const result = await gateway.action(id, { actor: 'user', ...body, ...(useFrame ? { frameId: selectedFrame } : {}) })
    if (disposed || remote.value?.id !== id) return
    notice.value = result.message
    const info = await gateway.info(id)
    currentUrl.value = info.url
    if (!/login|passport|signin|cashier|payment|checkout|\/pay(?:\/|\?|$)/i.test(info.url)) { history.value.url = safeCommerceUrl(info.url); persist() }
  } catch (error) { report(error) }
  finally { working.value = false; if (!disposed) void poll() }
}
const updatePermission = async (value: CommercePermission) => {
  await action({ type: 'permission', permission: value })
  if (remote.value) { const info = await gateway.info(remote.value.id).catch(() => null); if (info) permission.value = info.permission }
}
const navigate = async (url: string) => {
  const target = commercePlatformForUrl(url)
  if (!target) { notice.value = '请粘贴美团、京东、淘宝或拼多多的 HTTPS 链接。'; return }
  if (!user.value) { currentUrl.value = url; platformId.value = target.id; panel.value = 'connect'; return }
  if (working.value) return
  panel.value = ''
  if (target.id !== platformId.value) {
    persist(); working.value = true
    try { await closeRemote() } catch (error) { report(error) } finally { working.value = false }
    platformId.value = target.id; history.value = loadCommerceSession(account, selectedCharacterId.value, target.id)
    currentUrl.value = url; await openPlatform(url)
  } else if (!remote.value) { currentUrl.value = url; await openPlatform(url) }
  else await action({ type: 'navigate', url })
}
const capture = async () => {
  if (!remote.value) throw new Error('请先连接共逛服务并打开平台')
  const active = remote.value.id, run = generation
  const next = await gateway.capture(active, chatAbort?.signal)
  if (disposed || remote.value?.id !== active || generation !== run) throw new Error('本次读取已取消')
  page.value = next; suggestion.value = undefined; title.value = next.title || platform.value.name; currentUrl.value = next.url
  if (next.sensitive) notice.value = '当前是私密区域，角色不会读取；请在平台页面自行完成。'
  else if (!next.text) notice.value = '当前区域没有识别到商品内容，可滚动后重读或直接操作平台。'
  return next
}
const send = async (preset?: string) => {
  const text = (preset || input.value).trim()
  if (!text || busy.value || working.value) return
  if (!character.value) { notice.value = '请先选择陪你一起逛的角色。'; return }
  if (!remote.value) { panel.value = 'connect'; notice.value = '请先连接服务，让角色看到真实平台商品。'; return }
  input.value = ''; busy.value = true; notice.value = ''; const run = ++generation
  chatAbort = new AbortController()
  try {
    const observed = await capture()
    history.value.messages.push({ role: 'user', content: redactCommerceText(text) }); persist()
    const result = await askWebCommerceCompanion({ name: character.value.name, persona: String(character.value.persona || ''), preferences: history.value.preferences, page: observed, messages: history.value.messages, candidates: roleCandidates.value, permission: permission.value, signal: chatAbort.signal })
    if (disposed || generation !== run) return
    history.value.messages.push({ role: 'assistant', content: result.reply }); persist()
    if (result.target) suggestion.value = { target: result.target, token: observed.token, generation: run }
    await nextTick(); transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: 'smooth' })
  } catch (error) { if (!disposed && generation === run) report(error) }
  finally { if (generation === run) { busy.value = false; chatAbort = undefined } }
}
const execute = async () => {
  const proposed = suggestion.value
  if (!proposed || proposed.generation !== generation || working.value || busy.value || !remote.value) return
  suggestion.value = undefined; working.value = true; stopPolling()
  try {
    const result = await gateway.action(remote.value.id, { actor: 'role', type: 'suggestion', token: proposed.token, targetId: proposed.target.id })
    notice.value = result.message; page.value = null
    // Dispatch is recorded as an attempt, never as a successful cart change.
    history.value.messages.push({ role: 'user', content: `执行建议：${proposed.target.label}。${result.message}` }); persist()
  } catch (error) { report(error) }
  finally { working.value = false; if (!disposed) void poll() }
}
const saveObservation = async () => {
  if (working.value || busy.value) return
  working.value = true
  try {
    const observed = await capture()
    if (observed.sensitive || !observed.text) throw new Error('请打开可读取的商品区域后记录')
    history.value.records.push({ id: crypto.randomUUID(), platform: platformId.value, characterId: selectedCharacterId.value, title: observed.title, url: observed.url, text: observed.text, capturedAt: observed.capturedAt, source: 'page-observation' })
    persist(); notice.value = '已保存页面摘要，未把它当作平台确认订单。'
  } catch (error) { report(error) } finally { working.value = false }
}
const saveCandidate = async () => {
  if (working.value || busy.value || !remote.value) return
  working.value = true
  try {
    const observed = await capture()
    if (!observed.product) throw new Error('当前页面没有明确识别到单件商品。请打开商品详情；外卖菜单可先用页面摘要共同讨论。')
    await gateway.saveCandidate(remote.value.id, observed.product.id, selectedCharacterId.value || 'solo', '')
    await refreshRecords(); notice.value = '已加入共同候选清单；平台购物车请在页面中加购并核对。'
  } catch (error) { report(error) } finally { working.value = false }
}
const changeCandidate = async (item: CommerceCandidate, changes: Partial<Pick<CommerceCandidate, 'quantity' | 'wished' | 'note'>>) => {
  if (working.value) return
  working.value = true
  try { await gateway.updateCandidate(item.id, changes); await refreshRecords(); notice.value = '共同清单已更新，平台购物车数量未自动更改。' }
  catch (error) { report(error) } finally { working.value = false }
}
const removeCandidate = async (item: CommerceCandidate) => {
  if (working.value) return
  working.value = true
  try { await gateway.removeCandidate(item.id); selectedForCompare.value = selectedForCompare.value.filter(id => id !== item.id); await refreshRecords() }
  catch (error) { report(error) } finally { working.value = false }
}
const toggleCompare = (id: string) => {
  if (selectedForCompare.value.includes(id)) selectedForCompare.value = selectedForCompare.value.filter(x => x !== id)
  else if (selectedForCompare.value.length < 4) selectedForCompare.value.push(id)
  else notice.value = '一次可比较四件商品。'
}
const shareCandidate = (item: CommerceCandidate) => {
  if (!character.value) { notice.value = '请先选择角色。'; return }
  const permissions = mall.chatPermissions(selectedCharacterId.value)
  if (!permissions.allowProductShare || !permissions.includeRecentEvents) { notice.value = '商城聊天分享权限未开启，请在原商城设置中配置该角色。'; return }
  mall.addEvent({ type: 'product_shared', title: `和${character.value.name}一起看了真实商品`, detail: redactCommerceText(`${item.title}；${item.specification || '规格待确认'}；页面展示${money(item.priceCents)}。仍在考虑，未确认购买。`), characterId: selectedCharacterId.value, chatEligible: true, memoryEligible: permissions.allowMemory })
  notice.value = '已按原商城权限分享给角色聊天，未添加购买声明。'
}
const recordOrder = async () => {
  if (working.value || busy.value || !remote.value) return
  working.value = true; invalidate()
  try { await gateway.recordOrder(remote.value.id); await refreshRecords(); notice.value = '已保存平台订单页面记录，付款状态未经接口核验。'; panel.value = 'orders' }
  catch (error) { report(error) } finally { working.value = false }
}
const exportRecords = async () => {
  if (!user.value || working.value) return
  working.value = true
  try {
    const data = await gateway.exportRecords(), prepared = prepareWebFile(JSON.stringify(data, null, 2), '共逛记录.json', 'application/json')
    downloadWebFile(prepared); releasePreparedWebFile(prepared)
    notice.value = '已导出共同清单和订单记录，不包含平台登录凭据。'
  } catch (error) { report(error) } finally { working.value = false }
}
const external = () => { window.open(currentUrl.value, '_blank', 'noopener,noreferrer') }
const point = (event: PointerEvent) => {
  const rect = screen.value?.getBoundingClientRect()
  if (!rect || !remote.value) return null
  return commercePointer(rect, event.clientX, event.clientY)
}
const pointerDown = (event: PointerEvent) => {
  const p = point(event)
  if (!p || working.value || !frameReady.value) return
  pointer = { ...p, frame: frameId.value, at: Date.now() }
  screen.value?.setPointerCapture(event.pointerId)
}
const pointerUp = async (event: PointerEvent) => {
  const p = point(event), start = pointer; pointer = undefined
  if (!p || !start || working.value || Date.now() - start.at > 9000) return
  const dy = start.y - p.y
  frameId.value = start.frame
  if (Math.abs(dy) > 14) await action({ type: 'scroll', delta: Math.max(-900, Math.min(900, dy)) }, true)
  else await action({ type: 'click', x: p.x, y: p.y }, true)
}
const scrollPage = (delta: number) => action({ type: 'scroll', delta }, true)
const insertText = () => { const text = platformInput.value; if (text) void action({ type: 'text', text }, true) }
const stopVoice = () => {
  clearTimeout(voiceTimer); voiceTimer = undefined
  if (voiceRecorder?.state === 'recording') voiceRecorder.stop()
  stopMediaStream(voiceStream); voiceStream = null; voiceRecorder = null; recording.value = false
}
const toggleVoice = async () => {
  if (transcribing.value || working.value || busy.value) return
  if (recording.value) {
    const result = voiceResult; stopVoice(); voiceResult = null
    if (!result) return
    transcribing.value = true; voiceAbort = new AbortController()
    try {
      const blob = await result
      const text = await transcribeAudio(blob, { url: chatSettings.speechRecognitionUrl, key: chatSettings.speechRecognitionKey, model: chatSettings.speechRecognitionModel, language: chatSettings.speechRecognitionLanguage }, voiceAbort.signal)
      if (!disposed && !voiceAbort.signal.aborted) { input.value = text.slice(0, 1000); notice.value = '语音已转成文字，请核对后发送；不会直接执行购买。' }
    } catch (error) { if (!disposed) report(error) }
    finally { transcribing.value = false; voiceAbort = undefined }
    return
  }
  if (!chatSettings.enableRealMedia || !chatSettings.enableRealVoiceMessage || !isSpeechRecognitionReady({ url: chatSettings.speechRecognitionUrl, key: chatSettings.speechRecognitionKey, model: chatSettings.speechRecognitionModel })) {
    notice.value = '请先在原聊天的真实音视频设置中启用真实语音并配置语音识别。'; return
  }
  try {
    voiceStream = await requestMicrophone()
    if (disposed) { stopVoice(); return }
    const captured = recordStream(voiceStream)
    voiceRecorder = captured.recorder; voiceResult = captured.result; recording.value = true
    voiceTimer = setTimeout(() => void toggleVoice(), 60000)
    notice.value = '正在录制你的选购想法，点击停止转文字。请勿录入平台密码或验证码。'
  } catch (error) { stopVoice(); notice.value = mediaErrorMessage(error, 'microphone') }
}
const answerDialog = async (accept: boolean) => {
  if (!remote.value || !platformDialog.value) return
  const text = dialogInput.value; dialogInput.value = ''; platformDialog.value = null
  // Dialog resolution must not wait behind the click that opened that dialog.
  try { const result = await gateway.action(remote.value.id, { actor: 'user', type: 'dialog', accept, text }); notice.value = result.message }
  catch (error) { report(error) } finally { void poll() }
}
const visibility = () => { if (document.hidden) stopPolling(); else void poll() }
const disconnect = async (forget = false) => {
  if (working.value) return
  working.value = true
  try {
    await closeRemote(forget); await gateway.logout(); user.value = null; candidates.value = []; orders.value = []
    panel.value = 'connect'; notice.value = forget ? '已断开并清除服务保存的当前平台登录状态。' : '共逛服务已退出。'
  } catch (error) { report(error) } finally { working.value = false }
}
const finish = async () => {
  if (connecting.value) return
  persist(); invalidate(); stopPolling()
  try { await closeRemote() } catch (error) { report(error) }
  emit('close')
}
watch(panel, value => { if (value) stopPolling(); else void poll() })
watch(mall.accountId, () => {
  stopVoice(); voiceAbort?.abort(); stopPolling(); invalidate()
  void closeRemote().catch(() => {}).then(() => gateway.logout().catch(() => {})).finally(() => emit('close'))
})
onMounted(async () => {
  document.addEventListener('visibilitychange', visibility)
  if (localStorage.getItem(ownerKey)) await reconnect()
  else panel.value = 'connect'
})
onBeforeUnmount(() => {
  disposed = true; invalidate(); stopPolling(); clearImage(); persist(); stopVoice(); voiceAbort?.abort(); password.value = ''; platformInput.value = ''
  document.removeEventListener('visibilitychange', visibility)
  const active = remote.value; remote.value = null
  if (active) void gateway.close(active.id).catch(() => {})
})
</script>

<template>
  <section class="web-commerce" aria-label="网页版真实平台共逛">
    <header class="heading"><div><b>{{ character ? `和${character.name}一起逛` : '真实平台共逛' }}</b><small>{{ host }} · {{ title }}</small></div><button :disabled="connecting" @click="finish">结束</button></header>
    <nav class="platforms" aria-label="选择平台"><button v-for="p in commercePlatforms" :key="p.id" :class="{ active: platformId === p.id }" :disabled="working || connecting" @click="switchPlatform(p.id)">{{ p.name }}</button></nav>
    <nav class="characters" aria-label="选择陪逛角色"><button :class="{ active: !selectedCharacterId }" :disabled="working || connecting" @click="selectCharacter('')">自己逛</button><button v-for="c in mall.characters.value" :key="c.id" :class="{ active: selectedCharacterId === String(c.characterEntityId || c.id) }" :disabled="working || connecting" @click="selectCharacter(String(c.characterEntityId || c.id))">{{ c.name }}</button></nav>
    <nav class="tools"><button :disabled="!remote || working" @click="action({ type: 'back' })">返回</button><button :disabled="!remote || working" @click="action({ type: 'reload' })">刷新</button><button :disabled="working" @click="navigate(platform.home)">首页</button><button @click="panel = 'link'">链接</button><button @click="panel = 'list'">清单</button><button @click="panel = 'orders'">订单</button><button @click="panel = 'settings'">偏好</button></nav>
    <div class="status" aria-live="polite"><span>{{ connecting ? '正在连接共逛服务…' : working ? '正在处理，请等待平台反馈…' : notice || (remote ? '在真实平台选购，付款和验证由你完成。' : '连接共逛服务后即可在网页中一起选购。') }}</span><button v-if="notice" aria-label="收起提示" @click="notice = ''">×</button></div>
    <div class="browser-area">
      <div v-if="!remote" class="empty"><b>在网页里一起逛真实平台</b><p>连接独立共逛服务后，可登录平台、浏览商品并和角色一起选择。</p><button :disabled="connecting || working" @click="panel = 'connect'">{{ user ? '打开平台' : '连接共逛服务' }}</button><button class="secondary" @click="external">在外部打开{{ platform.name }}</button><p>外部页面不会与角色共享；平台购物流程是否支持纯网页，以实际页面为准。</p></div>
      <div v-else class="screen-wrap">
        <img v-if="imageUrl" ref="screen" class="platform-screen" :src="imageUrl" :alt="`${platform.name}真实平台页面，点击操作；滑动翻页`" draggable="false" @load="frameReady = true" @pointerdown="pointerDown" @pointerup="pointerUp" @pointercancel="pointer = undefined" @wheel.prevent="scrollPage(Math.max(-800, Math.min(800, $event.deltaY)))" />
        <div v-else class="empty"><p>正在获取平台画面…</p><button :disabled="frameBusy" @click="poll">重新读取画面</button></div>
        <span v-if="working" class="screen-busy">等待平台反馈</span>
      </div>
    </div>
    <div v-if="remote" class="browser-controls"><button :disabled="working || !frameReady" aria-label="平台页面向上滚动" @click="scrollPage(-400)">上翻</button><button :disabled="working || !frameReady" aria-label="平台页面向下滚动" @click="scrollPage(400)">下翻</button><button @click="keyboard = !keyboard">输入</button><button :disabled="working" @click="action({ type: 'takeover' })">我来操作</button><button :disabled="working || busy" @click="saveCandidate">加入清单</button></div>
    <form v-if="keyboard && remote" class="platform-input" @submit.prevent="insertText"><input v-model="platformInput" :type="privateInput ? 'password' : 'text'" maxlength="1000" autocomplete="off" :disabled="working" placeholder="先点平台输入框，再在此输入" aria-label="输入到真实平台"/><button type="button" @click="privateInput = !privateInput">{{ privateInput ? '隐藏' : '普通' }}</button><button :disabled="working || !platformInput || !frameReady">输入</button><button type="button" :disabled="working || !frameReady" aria-label="平台按下回车" @click="action({ type: 'key', key: 'Enter' }, true)">↵</button><button type="button" :disabled="working || !frameReady" aria-label="平台全选输入内容" @click="action({ type: 'key', key: 'Control+A' }, true)">全选</button><button type="button" :disabled="working || !frameReady" aria-label="平台删除一个字符" @click="action({ type: 'key', key: 'Backspace' }, true)">⌫</button></form>
    <section class="companion" :class="{ collapsed }">
      <header><b>{{ character?.name || '陪逛聊天' }}</b><button :disabled="working || !remote" @click="panel = 'connect'">{{ user?.name || '连接' }}</button><button :disabled="!remote || working || busy" @click="saveObservation">记下这页</button><button @click="collapsed = !collapsed">{{ collapsed ? '展开' : '收起' }}</button></header>
      <template v-if="!collapsed">
        <div ref="transcript" class="messages" aria-live="polite"><p v-if="!history.messages.length" class="hint">打开商品，再告诉我你的用途、口味和预算。</p><p v-for="(m, i) in history.messages" :key="i" :class="m.role"><small>{{ m.role === 'user' ? '你' : character?.name || '角色' }}</small>{{ m.content }}</p><p v-if="busy" class="hint">正在结合当前页面与共同清单回复…</p></div>
        <button v-if="suggestion" class="suggestion" :disabled="working" @click="execute">一起点这里：{{ suggestion.target.label }}</button>
        <div class="quick"><button :disabled="busy || working || !remote" @click="send('看看当前页面，你觉得选哪个好？')">看看这页</button><button :disabled="busy || working || !remote" @click="send('结合预算和偏好，比较当前商品和共同清单。')">帮我比较</button><button :disabled="busy || working || !remote || transcribing" @click="toggleVoice">{{ recording ? '停止录音' : transcribing ? '转写中' : '语音' }}</button><button @click="panel = 'records'">记录</button><span v-if="page">{{ page.sensitive ? '私密区域暂停读取' : '已读当前页' }}</span></div>
        <form class="chat-input" @submit.prevent="send()"><input v-model="input" maxlength="1000" :disabled="!remote" placeholder="用途、口味、预算，或想一起聊的话…" aria-label="陪逛消息"/><button v-if="busy" type="button" @click="invalidate">停止</button><button v-else :disabled="!input.trim() || working || !remote">发送</button></form>
      </template>
    </section>
    <div v-if="panel" class="overlay" @click.self="panel = ''">
      <section class="sheet" :aria-label="panel === 'connect' ? '连接共逛服务' : '共逛设置与记录'">
        <header><b>{{ { connect: '连接共逛服务', settings: '这次一起怎么选', records: '共逛记录', link: '打开平台链接', list: '共同清单', orders: '真实订单记录' }[panel] }}</b><button :disabled="connecting" @click="panel = ''">关闭</button></header>
        <p v-if="notice" class="sheet-notice" aria-live="polite">{{ notice }}</p>
        <template v-if="panel === 'connect'">
          <p>服务连接账号用于隔离你的共逛数据；平台账号仍在真实平台页面登录。口令不会发送给角色或存入备份。</p>
          <form @submit.prevent="connect"><label>服务地址<input v-model="endpointDraft" type="text" autocomplete="off" placeholder="https://你的共逛服务/commerce-api" :disabled="connecting"/></label><label>服务用户名<input v-model="username" autocomplete="username" maxlength="80" :disabled="connecting"/></label><label>服务连接口令<input v-model="password" type="password" autocomplete="current-password" maxlength="256" :disabled="connecting"/></label><label class="check"><input v-model="remember" type="checkbox"/><span>在独立服务中保留平台登录</span></label><p>启用后平台登录状态加密保存；不保证永久有效。远程浏览器服务会处理平台输入，应使用你信任的部署。</p><button :disabled="connecting || working || !username.trim() || !password">{{ connecting ? '正在连接…' : '连接并打开平台' }}</button></form>
          <div class="sheet-actions"><button v-if="user" :disabled="working || connecting" @click="openPlatform()">返回当前平台</button><button v-if="user" :disabled="working || connecting" @click="disconnect()">退出服务</button><button v-if="user && remote" :disabled="working || connecting" @click="disconnect(true)">清除当前平台登录</button><button @click="external">外部打开</button></div>
          <p>服务未部署时请先完成后台配置。网页不会伪造登录、购物车或订单。</p>
        </template>
        <template v-else-if="panel === 'settings'">
          <label>用途、口味、忌口、预算或购物偏好<textarea v-model="history.preferences" maxlength="1000" placeholder="例如：通勤鞋，预算500元以内；不吃香菜" @change="persist"/></label>
          <p>偏好与对话按账号、角色、平台分别保存。切换角色不切换平台账号。</p>
          <div class="permission-options" aria-label="角色操作权限"><button v-for="option in [{ id: 'observe', label: '陪我看' }, { id: 'select', label: '帮我挑' }, { id: 'cart', label: '整理购物车' }]" :key="option.id" :class="{ active: permission === option.id }" :disabled="!remote || working" @click="updatePermission(option.id as CommercePermission)">{{ option.label }}</button></div>
          <p>建议由你点击执行；提交订单、付款、登录、验证、取消及退款始终由你在平台完成。</p>
          <div class="sheet-actions"><button @click="persist(); panel = ''">保存</button><button @click="panel = 'connect'">连接设置</button><button @click="external">在外部打开当前页</button></div>
        </template>
        <template v-else-if="panel === 'link'"><form @submit.prevent="navigate(urlInput.trim())"><label>平台 HTTPS 链接<input v-model="urlInput" type="url" placeholder="商品、店铺或订单链接"/></label><button :disabled="!urlInput.trim() || working">在共逛中打开</button></form><p>也可直接操作平台搜索；外部页面与独立共逛浏览器的登录状态不同。</p></template>
        <template v-else-if="panel === 'records'"><p v-if="!history.records.length">点击“记下这页”保存可见商品摘要。订单请使用“订单”里的读取入口。</p><article v-for="record in [...history.records].reverse()" :key="record.id"><b>{{ record.title }}</b><small>{{ new Date(record.capturedAt).toLocaleString() }} · 页面观察记录</small><p>{{ record.text }}</p><button :disabled="working" @click="navigate(record.url)">查看原页</button></article></template>
        <template v-else-if="panel === 'list'">
          <div class="sheet-actions"><button :class="{ active: listFilter === 'all' }" @click="listFilter = 'all'">候选</button><button :class="{ active: listFilter === 'wish' }" @click="listFilter = 'wish'">愿望单</button><button :disabled="!user || working" @click="exportRecords">导出记录</button></div>
          <p>当前角色清单 · 已知金额 {{ money(knownTotal) }}<span v-if="unknownPrices">，{{ unknownPrices }}件价格未知</span>。仅为候选估算，不含未确认优惠和运费；各平台分别结算。</p>
          <p v-if="!user">先连接共逛服务，清单会按服务账号保存。</p><p v-else-if="!visibleCandidates.length">打开商品详情并点“加入清单”。清单不会自动改变平台购物车。</p>
          <div v-if="comparison.length" class="compare-grid"><article v-for="item in comparison" :key="item.id"><b>{{ item.title }}</b><small>{{ platformName(item.platform) }} · {{ money(item.priceCents) }}</small><p>{{ item.specification || '规格未识别' }}</p><p>{{ item.stock || '库存未识别' }}</p><p>{{ item.storeName || '店铺未识别' }}</p><small>{{ new Date(item.observedAt).toLocaleString() }}</small></article></div>
          <article v-for="item in visibleCandidates" :key="item.id" class="candidate"><b>{{ item.title }}</b><small>{{ platformName(item.platform) }} · {{ sourceName(item.source) }} · {{ money(item.priceCents) }}</small><p>{{ item.specification || '规格待确认' }} · {{ new Date(item.observedAt).toLocaleString() }}</p><div class="candidate-quantity"><button :disabled="working || item.quantity <= 1" aria-label="减少候选数量" @click="changeCandidate(item, { quantity: item.quantity - 1 })">−</button><span>{{ item.quantity }}</span><button :disabled="working || item.quantity >= 99" aria-label="增加候选数量" @click="changeCandidate(item, { quantity: item.quantity + 1 })">＋</button><small>候选数量</small></div><label>选择理由<input :value="item.note" maxlength="500" placeholder="用途或排除原因" @change="changeCandidate(item, { note: ($event.target as HTMLInputElement).value })"/></label><div class="sheet-actions"><button :disabled="working" @click="navigate(item.url)">查看／加购</button><button :disabled="working" @click="changeCandidate(item, { wished: !item.wished })">{{ item.wished ? '移出愿望' : '加入愿望' }}</button><button :class="{ active: selectedForCompare.includes(item.id) }" @click="toggleCompare(item.id)">比较</button><button :disabled="working" @click="shareCandidate(item)">分享给TA</button><button :disabled="working" @click="removeCandidate(item)">移出清单</button></div></article>
        </template>
        <template v-else-if="panel === 'orders'">
          <p>在平台完成下单和付款后，打开单笔订单详情再读取。页面记录不会自动变成“接口确认已付款”。</p><div class="sheet-actions"><button :disabled="!remote || working || busy" @click="recordOrder">读取当前订单</button><button :disabled="!user || working" @click="exportRecords">导出记录</button><button @click="external">外部查看</button></div><p v-if="!orders.length">暂无可识别的真实订单记录。原商城的剧情订单和手动购买记录仍在原入口。</p><article v-for="order in orders" :key="order.id"><b>{{ platformName(order.platform) }} · {{ order.orderNumber }}</b><small>{{ sourceName(order.source) }} · {{ new Date(order.observedAt).toLocaleString() }}</small><p>{{ order.status }} · {{ order.paymentStatus === 'unknown' ? '付款状态未核验' : order.paymentStatus === 'paid' ? '已付款' : order.paymentStatus === 'refunded' ? '已退款' : '待付款' }}</p><button :disabled="working" @click="navigate(order.url)">到平台核对</button></article>
        </template>
      </section>
    </div>
    <div v-if="platformDialog" class="overlay dialog-overlay"><section class="sheet" role="dialog" aria-modal="true" aria-label="平台提示"><header><b>平台提示</b></header><p>{{ platformDialog.message }}</p><input v-if="platformDialog.type === 'prompt'" v-model="dialogInput" type="password" autocomplete="off" aria-label="平台提示输入"/><p>此提示来自真实平台。确认购买、付款或协议前请核对内容。</p><div class="sheet-actions"><button @click="answerDialog(false)">取消</button><button @click="answerDialog(true)">{{ platformDialog.type === 'alert' ? '知道了' : '确认' }}</button></div></section></div>
  </section>
</template>

<style scoped>
.web-commerce{position:absolute;inset:0;z-index:45;display:flex;flex-direction:column;min-width:0;overflow:hidden;background:#f5f2ec;color:#292722;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.web-commerce *{box-sizing:border-box}.web-commerce button,.web-commerce input,.web-commerce textarea{font:inherit;color:inherit}.web-commerce button{max-width:100%;border:1px solid #dad4cb;border-radius:13px;background:transparent;padding:5px 8px;font-size:10px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.web-commerce button:disabled{opacity:.45;cursor:default}.web-commerce button.active{background:#37332f;border-color:#37332f;color:#fff}.heading{display:flex;align-items:center;gap:8px;flex:none;padding:calc(8px + env(safe-area-inset-top,0px)) 12px 7px}.heading>div{flex:1;min-width:0}.heading b,.heading small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.heading b{font:600 15px Georgia,"Songti SC",serif}.heading small{margin-top:3px;color:#928b82;font-size:9px}.heading>button{flex-shrink:0}.platforms{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:0 12px 6px;flex:none}.characters{display:flex;gap:5px;overflow-x:auto;flex:none;padding:0 12px 6px;scrollbar-width:none}.characters button{max-width:100px;flex-shrink:0;font-size:9px;padding:4px 8px}.tools{display:flex;gap:4px;padding:0 12px 5px;flex:none}.tools button{flex:1;min-width:0;border:0;background:#ebe6df;padding:5px 2px;font-size:9px}.status{display:flex;gap:4px;align-items:center;padding:0 12px 5px;flex:none;font-size:9px;color:#82786e;line-height:1.4}.status>span{min-width:0;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.status button{border:0;padding:0 4px;flex:none}.browser-area{position:relative;flex:1;min-height:85px;overflow:hidden;background:#fff}.empty{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;overflow:auto;text-align:center}.empty b{font-size:12px}.empty p{max-width:320px;margin:6px 0;font-size:10px;color:#8b8176;line-height:1.6}.empty button{margin:5px 0}.empty .secondary{border:0;color:#857a6e}.screen-wrap{height:100%;display:flex;justify-content:center;position:relative;overflow:hidden}.platform-screen{display:block;width:auto;height:100%;max-width:100%;object-fit:contain;touch-action:none;user-select:none;cursor:pointer}.screen-busy{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);border-radius:9px;background:rgba(41,39,34,.85);padding:4px 8px;color:#fff;font-size:9px;pointer-events:none}.browser-controls{display:flex;gap:4px;flex:none;padding:4px 10px;background:#f5f2ec}.browser-controls button{flex:1;min-width:0;border:0;background:#ebe6df;padding:4px 2px;font-size:9px}.platform-input{display:flex;gap:3px;min-width:0;padding:0 10px 5px;flex:none}.platform-input input{flex:1;min-width:0;border:0;border-radius:8px;background:#eae5dd;padding:6px;font-size:10px;outline:none}.platform-input button{flex:none;font-size:9px;padding:3px 5px}.companion{flex:none;max-height:43%;display:flex;flex-direction:column;min-height:0;padding:7px 10px calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #ded6cb;background:#f5f2ec}.companion>header{display:flex;align-items:center;gap:4px;flex:none;min-width:0}.companion>header b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px Georgia,"Songti SC",serif}.companion>header button{max-width:74px;flex-shrink:0;font-size:9px;padding:3px 6px}.messages{overflow:auto;min-height:28px;max-height:120px;flex:1;padding:3px 0}.messages p{max-width:94%;margin:5px 0;border-radius:9px;background:#fff;padding:6px 8px;font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere}.messages p.user{margin-left:auto;background:#e8ded1}.messages small{display:block;color:#9c9081;font-size:8px}.messages .hint{background:transparent;color:#92887c;font-size:10px;padding:5px 0}.suggestion{flex:none;margin:3px 0;background:#e8ded1!important;text-align:left}.quick{display:flex;align-items:center;gap:4px;margin:4px 0;flex:none;min-width:0}.quick button{flex-shrink:0;font-size:9px;padding:3px 6px}.quick span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1978b;font-size:8px}.chat-input{display:flex;gap:6px;flex:none}.chat-input input{flex:1;min-width:0;border:0;border-radius:9px;background:#eae5dd;padding:8px;font-size:10px;outline:none}.chat-input button{flex:none;background:#37332f;color:#fff;border-color:#37332f}.overlay{position:absolute;inset:0;z-index:3;display:flex;align-items:flex-end;background:rgba(23,21,19,.38)}.sheet{width:100%;min-width:0;max-height:86%;overflow:auto;border-radius:16px 16px 0 0;background:#f8f6f2;padding:14px 12px calc(14px + env(safe-area-inset-bottom,0px))}.sheet>header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}.sheet>header b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 15px Georgia,"Songti SC",serif}.sheet>header button{flex:none}.sheet label{display:block;font-size:10px;color:#80766b}.sheet input:not([type=checkbox]),.sheet textarea{display:block;width:100%;min-width:0;margin:6px 0;border:1px solid #ddd5ca;border-radius:9px;padding:8px;background:#fff;font-size:11px;outline:none}.sheet textarea{min-height:85px;resize:vertical}.sheet p{font-size:10px;line-height:1.6;color:#857a6e;overflow-wrap:anywhere;white-space:pre-wrap}.sheet .sheet-notice{padding:7px;border-radius:8px;background:#ebe3d8;color:#675b4e}.sheet .check{display:flex;align-items:center;gap:7px;margin:9px 0}.check input{appearance:none;flex:none;width:15px;height:15px;margin:0;border:1px solid #b4a99c;border-radius:4px;background:#fff}.check input:checked{background:#37332f;border-color:#37332f}.check input:checked:after{display:block;color:#fff;text-align:center;line-height:13px;font-size:11px;content:'✓'}.sheet-actions,.permission-options{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0}.permission-options button{flex:1;min-width:0;font-size:9px}.sheet article{min-width:0;padding:10px 0;border-bottom:1px solid #e3dbd0}.sheet article>b{display:block;font-size:11px;overflow-wrap:anywhere}.sheet article>small{display:block;margin:4px 0;color:#9c9081;font-size:8px;overflow-wrap:anywhere}.sheet article>p{max-height:150px;overflow:auto}.candidate-quantity{display:flex;align-items:center;gap:8px;font-size:10px}.candidate-quantity small{font-size:8px;color:#9c9081}.candidate-quantity button{padding:2px 7px}.compare-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:8px}.compare-grid article{padding:7px;border:1px solid #e3dbd0;border-radius:9px}.compare-grid p{margin:4px 0}.dark-theme .web-commerce,.dark-theme .companion,.dark-theme .browser-controls{background:#191817;color:#eeeae4}.dark-theme .sheet{background:#252321}.dark-theme .chat-input input,.dark-theme .platform-input input,.dark-theme .tools button,.dark-theme .browser-controls button,.dark-theme .messages p,.dark-theme .sheet input:not([type=checkbox]),.dark-theme .sheet textarea{background:#302d29;color:#eeeae4}.dark-theme .messages p.user,.dark-theme .suggestion{background:#494038!important}.dark-theme .sheet .sheet-notice{background:#39332d;color:#e1d7ca}@media(max-width:340px){.heading{padding-left:9px;padding-right:9px}.platforms,.tools,.characters{padding-left:9px;padding-right:9px}.quick span{display:none}.companion{padding-left:8px;padding-right:8px}.messages{max-height:95px}.sheet{padding-left:10px;padding-right:10px}.sheet-actions button{font-size:9px;padding:4px 7px}.companion>header button{max-width:63px}}@media(max-height:540px){.messages{max-height:55px}.characters{padding-bottom:3px}.companion{max-height:46%}.browser-area{min-height:60px}}
</style>
