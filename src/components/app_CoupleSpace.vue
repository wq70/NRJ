<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { mockChats, myProfile } from '../composables/chatState/state'
import { sendCapabilityMessage } from '../services/api'
import {
  coupleMediaStore, coupleModuleCatalog, createCoupleEntry, createCoupleSpace, deleteCoupleSpace, ensureModuleStats,
  loadCoupleSpaces, persistCoupleSpaces, removeCoupleEntry, respondToCoupleInvite, rewardModuleActivity,
  syncAllCoupleLongTermMemories, syncCoupleEntryLongTermMemory, updateCoupleEntry, updateCoupleSpace, useCoupleSpace
} from '../services/coupleSpace'
import type { CoupleEntry, CoupleModuleDefinition, CoupleSpace } from '../types/coupleSpace'
import './CoupleSpace.css'

defineEmits<{ close: [] }>()

type Page = 'home' | 'modules' | 'records' | 'settings'
const { state, activeSpace, setActiveSpace } = useCoupleSpace()
const page = ref<Page>('home')
const group = ref<CoupleModuleDefinition['group'] | 'all'>('all')
const search = ref('')
const showCreate = ref(false)
const showSpaces = ref(false)
const showLifecycle = ref(false)
const activeModule = ref<CoupleModuleDefinition | null>(null)
const activeEntry = ref<CoupleEntry | null>(null)
const toast = ref('')
const busy = ref(false)
const mediaUrls = ref<Record<string, string>>({})
let toastTimer = 0

const createDraft = reactive({
  chatId: '', userNickname: myProfile.value.name || '我', characterNickname: '', title: '我们的空间', declaration: '',
  anniversary: new Date().toISOString().slice(0, 10), direction: 'user' as 'user' | 'character'
})
const entryDraft = reactive({ title: '', content: '', secondary: '', revealAt: '', list: '', options: '', memoryPermission: 'space-only' as CoupleEntry['memoryPermission'] })
const repairDraft = reactive({ fact: '', feeling: '', need: '', boundary: '' })
const selectedGamePrompt = ref('')
const partnerDraft = ref('')
const lifecycleNote = ref('')
const pendingDelete = ref<CoupleEntry | null>(null)
const pendingDeleteSpace = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
let lastPoint = { x: 0, y: 0 }

const contacts = computed(() => mockChats.value.filter(chat => chat.id !== 1 && chat.contactState !== 'deleted'))
const selectedContact = computed(() => contacts.value.find(chat => String(chat.id) === String(createDraft.chatId)) || null)
const activeEntries = computed(() => activeSpace.value?.entries || [])
const activeDays = computed(() => {
  const date = activeSpace.value?.anniversary ? new Date(`${activeSpace.value.anniversary}T00:00:00`).getTime() : activeSpace.value?.createdAt || Date.now()
  return Math.max(1, Math.floor((Date.now() - date) / 86400000) + 1)
})
const enabledModules = computed(() => coupleModuleCatalog.filter(item => activeSpace.value?.enabledModules[item.id] !== false))
const filteredModules = computed(() => {
  const query = search.value.trim().toLowerCase()
  return enabledModules.value.filter(item => (group.value === 'all' || item.group === group.value) && (!query || `${item.name}${item.description}`.toLowerCase().includes(query)))
})
const recentEntries = computed(() => activeEntries.value.slice().sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6))
const currentModuleEntries = computed(() => activeModule.value ? activeEntries.value.filter(item => item.moduleId === activeModule.value?.id).sort((a, b) => b.updatedAt - a.updatedAt) : [])
const currentStats = computed(() => activeModule.value && activeSpace.value && ['room', 'pet', 'plant', 'collection'].includes(activeModule.value.kind)
  ? ensureModuleStats(activeSpace.value, activeModule.value.id, activeModule.value.kind === 'pet' ? '团团' : activeModule.value.kind === 'plant' ? '同心芽' : activeModule.value.kind === 'room' ? '我们的小屋' : '共同收藏') : null)
const spaceStatusText = computed(() => ({ pending: '等待回应', active: '相伴中', paused: '已暂停', ended: '已封存' })[activeSpace.value?.status || 'pending'])
const moduleGroups = [
  { id: 'all', name: '全部' }, { id: 'exchange', name: '交换屋' }, { id: 'create', name: '共创间' },
  { id: 'play', name: '游乐场' }, { id: 'life', name: '生活舱' }, { id: 'nurture', name: '养成屋' }, { id: 'repair', name: '修复室' }
] as const
const gamePrompts = [
  '如果突然多出一个完全自由的下午，会选择宅家、散步、吃东西还是去陌生地方？',
  '从春雨、夏夜、秋风、冬雪里选一个最像你们的画面。',
  '说出三段回忆，其中一段是假的，让对方猜出来。',
  '各自选一种颜色、一首歌和一道食物来形容今天。',
  '如果共同小屋只能留下三件东西，会留下什么？'
]

const notify = (message: string) => {
  toast.value = message; window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => { toast.value = '' }, 2400)
}
const formatDate = (value: number) => new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
const moduleFor = (id: string) => coupleModuleCatalog.find(item => item.id === id)
const statusLabel = (entry: CoupleEntry) => ({ draft: '草稿', waiting: '等待回应', revealed: '已揭晓', completed: '已完成', sealed: '未开启', archived: '已收好' })[entry.status]
const back = () => {
  if (activeEntry.value) { activeEntry.value = null; return }
  if (activeModule.value) { activeModule.value = null; resetEntryDraft(); return }
  page.value = 'home'
}
const resetEntryDraft = () => {
  Object.assign(entryDraft, { title: '', content: '', secondary: '', revealAt: '', list: '', options: '', memoryPermission: 'space-only' })
  Object.assign(repairDraft, { fact: '', feeling: '', need: '', boundary: '' }); partnerDraft.value = ''; selectedGamePrompt.value = ''
}
const openModule = (module: CoupleModuleDefinition) => {
  activeModule.value = module; activeEntry.value = null; resetEntryDraft(); entryDraft.title = module.name
  if (['game', 'boardgame', 'memory', 'future'].includes(module.kind)) selectedGamePrompt.value = gamePrompts[Math.floor(Math.random() * gamePrompts.length)]
  if (['drawing'].includes(module.kind)) nextTick(prepareCanvas)
}

const parseModelJson = (text: string) => {
  const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim(); const start = clean.indexOf('{'); const end = clean.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(clean.slice(start, end + 1)) } catch { return null }
}

const askCharacter = async (system: string, user: string) => {
  const space = activeSpace.value; const chat = contacts.value.find(item => String(item.id) === String(space?.chatId))
  if (!space || !chat) throw new Error('关联角色已不存在')
  return sendCapabilityMessage('chat', [
    { role: 'system', content: `你是${space.characterName}。${space.characterPersona || chat.persona || ''}\n${system}\n必须保持人物自主性，可以拒绝、保留意见或提出修改，不得机械迎合。只输出要求的合法 JSON。` },
    { role: 'user', content: user }
  ], { diagnosticContext: { chatId: String(chat.id), characterIds: [String(chat.characterEntityId || chat.id)], characterName: space.characterName } })
}

const submitCreate = async () => {
  const chat = selectedContact.value
  if (!chat) return notify('请先选择一位角色')
  if (state.value.spaces.some(item => item.status !== 'ended' && String(item.chatId) === String(chat.id))) return notify('与这位角色已经有未结束的空间')
  busy.value = true
  try {
    if (createDraft.direction === 'character') {
      const result = await sendCapabilityMessage('chat', [
        { role: 'system', content: `你是${chat.realName || chat.name}。${chat.persona || ''}\n用户允许你自主判断是否想邀请用户建立情侣空间。不要迎合，只返回 {"invite":true或false,"message":"自然表达"}。` },
        { role: 'user', content: `用户名：${createDraft.userNickname || '用户'}。你是否真心想发出情侣空间邀请？` }
      ], { diagnosticContext: { chatId: String(chat.id), characterIds: [String(chat.characterEntityId || chat.id)], characterName: chat.realName || chat.name } })
      const decision = parseModelJson(result.content)
      if (decision?.invite !== true) return notify(String(decision?.message || 'TA现在没有发出邀请'))
      const space = createCoupleSpace({ chat, ...createDraft })
      space.invites[0].direction = 'character_to_user'; space.invites[0].message = String(decision.message || '想邀请你一起建立情侣空间。'); persistCoupleSpaces()
    } else createCoupleSpace({ chat, ...createDraft })
    showCreate.value = false; page.value = 'home'; notify(createDraft.direction === 'character' ? '收到了一份情侣空间邀请' : '邀请已经准备好，等待TA回应')
  } catch (error) { notify(error instanceof Error ? error.message : '邀请没有成功发出') }
  finally { busy.value = false }
}

const letCharacterRespondInvite = async () => {
  const space = activeSpace.value; if (!space) return
  busy.value = true
  try {
    const result = await askCharacter('用户邀请你建立情侣空间。你可以接受或拒绝。返回 {"accept":true或false,"message":"你的自然回应"}。', `邀请内容：${space.invites[0]?.message || space.declaration || '想和你建立情侣空间'}`)
    const decision = parseModelJson(result.content); const accepted = decision?.accept === true
    respondToCoupleInvite(space, accepted, String(decision?.message || (accepted ? '好，我们一起认真经营这个空间。' : '我现在还没有准备好。')))
    notify(accepted ? 'TA接受了邀请' : 'TA暂时没有接受邀请')
  } catch (error) { notify(error instanceof Error ? error.message : '暂时没有收到回应') }
  finally { busy.value = false }
}

const acceptCharacterInvite = () => {
  if (!activeSpace.value) return; respondToCoupleInvite(activeSpace.value, true, '你接受了邀请'); notify('情侣空间已经开启')
}

const createEntry = async () => {
  const space = activeSpace.value; const module = activeModule.value
  if (!space || !module) return
  if (['repair', 'apology'].includes(module.kind) && ![repairDraft.fact, repairDraft.feeling, repairDraft.need, repairDraft.boundary].some(value => value.trim())) return notify('请先写下至少一项真实内容')
  const content = ['repair', 'apology'].includes(module.kind)
    ? `发生的事：${repairDraft.fact}\n我的感受：${repairDraft.feeling}\n我的需要：${repairDraft.need}\n边界或补救：${repairDraft.boundary}`
    : entryDraft.content.trim() || selectedGamePrompt.value.trim()
  if (!content && !['room', 'pet', 'plant', 'collection', 'drawing'].includes(module.kind)) return notify('请先填写内容')
  const checklist = ['checklist', 'plan', 'recipe', 'travel'].includes(module.kind)
    ? (entryDraft.list || content).split('\n').map(text => text.trim()).filter(Boolean).map(text => ({ id: `${Date.now()}_${Math.random()}`, text, userDone: false, partnerDone: false })) : undefined
  const options = entryDraft.options.split('\n').map(text => text.trim()).filter(Boolean)
  const revealAt = entryDraft.revealAt ? new Date(entryDraft.revealAt).getTime() : undefined
  let mediaKey: string | undefined
  if (module.kind === 'drawing' && canvasRef.value) {
    mediaKey = `couple-drawing-${Date.now()}`; await coupleMediaStore.setItem(mediaKey, canvasRef.value.toDataURL('image/png'))
  }
  const entry = createCoupleEntry(space, {
    moduleId: module.id, title: entryDraft.title || module.name, content: content || `${module.name}共同记录`, secondaryContent: entryDraft.secondary,
    status: module.kind === 'capsule' ? 'sealed' : 'waiting', revealAt, memoryPermission: entryDraft.memoryPermission,
    checklist, options: options.length ? options : undefined, mediaKey, meta: module.kind === 'mood' ? { responseMode: entryDraft.secondary || '倾听' } : undefined
  })
  syncCoupleEntryLongTermMemory(space, entry)
  if (mediaKey) mediaUrls.value[mediaKey] = await coupleMediaStore.getItem<string>(mediaKey) || ''
  rewardModuleActivity(space, module.id, module.name, 10); resetEntryDraft(); entryDraft.title = module.name; notify(module.kind === 'capsule' ? '胶囊已经封存' : '已经放进情侣空间')
  activeEntry.value = entry
}

const askPartnerForEntry = async (entry: CoupleEntry) => {
  const space = activeSpace.value; const module = moduleFor(entry.moduleId); if (!space || !module) return
  busy.value = true
  try {
    const hidden = ['quiz', 'game', 'match'].includes(module.kind)
    const result = await askCharacter(
      `你正在参与情侣空间的“${module.name}”。${hidden ? '请独立作答，不得照抄用户。' : '请针对内容自然回应。'}返回 {"response":"回应内容","choice":"如果有选项则填写选择，否则留空","accept":true或false}。`,
      `活动说明：${module.description}\n用户提交：${entry.content}\n补充：${entry.secondaryContent || '无'}\n选项：${entry.options?.join('、') || '无'}`
    )
    const answer = parseModelJson(result.content); const response = String(answer?.response || '').trim()
    if (!response) throw new Error('TA没有留下有效回应')
    updateCoupleEntry(space, entry, { partnerContent: response, partnerChoice: String(answer?.choice || ''), status: hidden ? 'revealed' : 'completed' })
    rewardModuleActivity(space, module.id, module.name, 12); partnerDraft.value = response; notify(hidden ? '双方内容已经揭晓' : '收到TA的回应')
  } catch (error) { notify(error instanceof Error ? error.message : '暂时没有收到回应') }
  finally { busy.value = false }
}

const revealCapsule = (entry: CoupleEntry) => {
  if (entry.revealAt && entry.revealAt > Date.now()) return notify(`要到 ${new Date(entry.revealAt).toLocaleString('zh-CN')} 才能开启`)
  if (!activeSpace.value) return; updateCoupleEntry(activeSpace.value, entry, { status: 'revealed' }); notify('胶囊已经开启')
}

const toggleChecklist = (entry: CoupleEntry, item: NonNullable<CoupleEntry['checklist']>[number], partner = false) => {
  if (!activeSpace.value) return
  if (partner) item.partnerDone = !item.partnerDone; else item.userDone = !item.userDone
  const done = entry.checklist?.every(row => row.userDone && row.partnerDone)
  updateCoupleEntry(activeSpace.value, entry, { status: done ? 'completed' : entry.status })
}

const nurture = (action: string) => {
  const space = activeSpace.value; const module = activeModule.value; const stats = currentStats.value
  if (!space || !module || !stats) return
  const now = Date.now(); if (stats.lastActionAt && now - stats.lastActionAt < 1200) return notify('慢一点，刚刚已经照顾过了')
  stats.energy = Math.min(100, stats.energy + 6); stats.progress += 9; stats.selectedItems = [...stats.selectedItems.slice(-5), action]
  while (stats.progress >= 100) { stats.progress -= 100; stats.level += 1 }
  stats.lastActionAt = now; persistCoupleSpaces(); notify(`${action}完成，留下了一点共同成长`)
}

const renameNurture = () => {
  if (!currentStats.value || !entryDraft.title.trim()) return notify('请先填写名字')
  currentStats.value.name = entryDraft.title.trim(); persistCoupleSpaces(); notify('名字已经保存')
}

const prepareCanvas = () => {
  const canvas = canvasRef.value; if (!canvas) return
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1)); const width = canvas.clientWidth || 320; const height = 240
  canvas.width = width * ratio; canvas.height = height * ratio; const context = canvas.getContext('2d'); context?.scale(ratio, ratio)
  if (context) { context.fillStyle = '#fffaf7'; context.fillRect(0, 0, width, height); context.strokeStyle = '#ad6575'; context.lineWidth = 3; context.lineCap = 'round'; context.lineJoin = 'round' }
}
const canvasPoint = (event: PointerEvent) => { const rect = canvasRef.value!.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top } }
const startDraw = (event: PointerEvent) => { drawing.value = true; lastPoint = canvasPoint(event); canvasRef.value?.setPointerCapture(event.pointerId) }
const moveDraw = (event: PointerEvent) => { if (!drawing.value || !canvasRef.value) return; const point = canvasPoint(event); const context = canvasRef.value.getContext('2d'); context?.beginPath(); context?.moveTo(lastPoint.x, lastPoint.y); context?.lineTo(point.x, point.y); context?.stroke(); lastPoint = point }
const stopDraw = () => { drawing.value = false }
const clearCanvas = () => prepareCanvas()

const loadEntryMedia = async () => {
  const keys = [...new Set(activeEntries.value.map(item => item.mediaKey).filter(Boolean) as string[])]
  for (const key of keys) if (!mediaUrls.value[key]) mediaUrls.value[key] = await coupleMediaStore.getItem<string>(key) || ''
}
const openEntry = (entry: CoupleEntry) => { activeEntry.value = entry; void loadEntryMedia() }
const updateEntryMemoryPermission = (entry: CoupleEntry) => {
  if (!activeSpace.value) return
  updateCoupleEntry(activeSpace.value, entry, { memoryPermission: entry.memoryPermission })
  syncCoupleEntryLongTermMemory(activeSpace.value, entry)
}
const toggleChatKnowledge = () => {
  if (!activeSpace.value) return
  if (activeSpace.value.bridge.chatKnowsRelationship && activeSpace.value.bridge.tokenBudget === 0) activeSpace.value.bridge.tokenBudget = 100
  if (!activeSpace.value.bridge.chatKnowsRelationship) activeSpace.value.bridge.chatReadsMemories = false
  persistCoupleSpaces()
}
const toggleLongTermMemory = () => {
  if (!activeSpace.value) return
  persistCoupleSpaces(); syncAllCoupleLongTermMemories(activeSpace.value)
}
const confirmDeleteEntry = async () => {
  if (!activeSpace.value || !pendingDelete.value) return
  await removeCoupleEntry(activeSpace.value, pendingDelete.value); if (activeEntry.value?.id === pendingDelete.value.id) activeEntry.value = null; pendingDelete.value = null; notify('记录已经删除')
}
const exportSpace = () => {
  const space = activeSpace.value; if (!space) return
  const blob = new Blob([JSON.stringify({ exportedAt: Date.now(), kind: 'couple-space', space }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${space.title || '情侣空间'}-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); notify('空间数据已经导出')
}
const confirmDeleteSpace = async () => {
  const space = activeSpace.value; if (!space) return
  await deleteCoupleSpace(space); pendingDeleteSpace.value = false; showLifecycle.value = false; page.value = 'home'; notify('情侣空间及本机作品已经永久删除')
}

const applyLifecycle = (action: 'pause' | 'resume' | 'end' | 'restore') => {
  const space = activeSpace.value; if (!space) return
  if (action === 'pause') updateCoupleSpace(space, { status: 'paused', pausedAt: Date.now() })
  if (action === 'resume') updateCoupleSpace(space, { status: 'active', pausedAt: undefined })
  if (action === 'end') { updateCoupleSpace(space, { status: 'ended', endedAt: Date.now(), endingNote: lifecycleNote.value.trim() }); if (!space.bridge.rememberAfterEnding) syncAllCoupleLongTermMemories(space, true) }
  if (action === 'restore') updateCoupleSpace(space, { status: 'active', endedAt: undefined, endingNote: '' })
  showLifecycle.value = false; notify(action === 'end' ? '空间已经封存，所有作品仍然保留' : action === 'pause' ? '所有主动联动已暂停' : '空间已经恢复')
}

onMounted(() => { loadCoupleSpaces(true); void loadEntryMedia() })
</script>

<template>
  <div class="couple-app" :class="`theme-${activeSpace?.theme || 'blush'}`">
    <header class="couple-header">
      <button v-if="activeModule || activeEntry || page !== 'home'" class="couple-icon-button" type="button" aria-label="返回" @click="back">‹</button>
      <button v-else-if="activeSpace" class="couple-avatar-pair" type="button" aria-label="切换情侣空间" @click="showSpaces = true">
        <span>{{ (activeSpace.userNickname || '我').slice(0, 1) }}</span><span :style="activeSpace.characterAvatar ? { backgroundImage: `url(${activeSpace.characterAvatar})` } : undefined">{{ activeSpace.characterAvatar ? '' : activeSpace.characterName.slice(0, 1) }}</span>
      </button><span v-else></span>
      <div class="couple-header-copy"><h1>{{ activeEntry?.title || activeModule?.name || activeSpace?.title || '情侣空间' }}</h1><p>{{ activeModule?.description || (activeSpace ? `${activeSpace.userNickname} 与 ${activeSpace.characterNickname}` : '共同写下、交换与创造') }}</p></div>
      <button class="couple-icon-button close" type="button" aria-label="关闭" @click="$emit('close')">×</button>
    </header>
    <div v-if="toast" class="couple-toast" role="status">{{ toast }}</div>

    <main v-if="!activeSpace" class="couple-empty-scroll">
      <section class="couple-empty-hero"><div class="empty-orbit"><span>♡</span><i></i><b></b></div><small>PRIVATE SPACE FOR TWO</small><h2>把喜欢变成共同做过的事</h2><p>写日记、寄信、交换答案、共同创作、养成和认真沟通。聊天联动默认关闭。</p><button type="button" @click="showCreate = true">创建或接收邀请</button></section>
      <section class="couple-empty-features"><article><i>写</i><strong>交换与等待</strong><span>日记、情书、胶囊与盲答</span></article><article><i>创</i><strong>共同产出</strong><span>画作、故事、剪贴簿与旅行册</span></article><article><i>伴</i><strong>长期相处</strong><span>愿望、养成、边界与修复</span></article></section>
    </main>

    <main v-else-if="activeSpace.status === 'pending'" class="couple-pending-scroll">
      <section class="pending-envelope"><div class="envelope-mark">邀</div><small>{{ activeSpace.invites[0]?.direction === 'character_to_user' ? `${activeSpace.characterName} 发来的邀请` : '已经寄出的邀请' }}</small><h2>{{ activeSpace.title }}</h2><blockquote>{{ activeSpace.invites[0]?.message }}</blockquote><div class="pending-names"><span>{{ activeSpace.userNickname }}</span><i>♡</i><span>{{ activeSpace.characterNickname }}</span></div>
        <div v-if="activeSpace.invites[0]?.direction === 'character_to_user'" class="pending-actions"><button class="soft" type="button" @click="respondToCoupleInvite(activeSpace, false, '你拒绝了邀请')">暂不接受</button><button type="button" @click="acceptCharacterInvite">接受邀请</button></div>
        <button v-else class="single-primary" type="button" :disabled="busy" @click="letCharacterRespondInvite">{{ busy ? '等待TA认真考虑…' : '让TA回应邀请' }}</button>
      </section>
    </main>

    <template v-else>
      <main v-if="activeEntry" class="couple-content-scroll entry-detail">
        <section class="entry-paper"><div class="entry-paper-head"><span :style="{ background: moduleFor(activeEntry.moduleId)?.accent }">{{ moduleFor(activeEntry.moduleId)?.icon }}</span><div><small>{{ moduleFor(activeEntry.moduleId)?.name }} · {{ formatDate(activeEntry.createdAt) }}</small><h2>{{ activeEntry.title }}</h2></div><em>{{ statusLabel(activeEntry) }}</em></div>
          <p class="entry-main-text">{{ activeEntry.content }}</p><p v-if="activeEntry.secondaryContent" class="entry-secondary">{{ activeEntry.secondaryContent }}</p>
          <img v-if="activeEntry.mediaKey && mediaUrls[activeEntry.mediaKey]" class="entry-media" :src="mediaUrls[activeEntry.mediaKey]" alt="共同创作" />
          <ul v-if="activeEntry.checklist?.length" class="couple-checklist"><li v-for="item in activeEntry.checklist" :key="item.id"><span>{{ item.text }}</span><button :class="{ done: item.userDone }" type="button" @click="toggleChecklist(activeEntry, item)">我{{ item.userDone ? '已完成' : '来完成' }}</button><button :class="{ done: item.partnerDone }" type="button" @click="toggleChecklist(activeEntry, item, true)">TA{{ item.partnerDone ? '已确认' : '待确认' }}</button></li></ul>
          <div v-if="activeEntry.partnerContent" class="partner-response"><small>{{ activeSpace.characterNickname }}的回应</small><p>{{ activeEntry.partnerContent }}</p><em v-if="activeEntry.partnerChoice">选择：{{ activeEntry.partnerChoice }}</em></div>
          <div v-else-if="activeEntry.status === 'sealed'" class="sealed-card"><span>封</span><p>{{ activeEntry.revealAt ? `约定在 ${new Date(activeEntry.revealAt).toLocaleString('zh-CN')} 开启` : '可以由你决定何时开启' }}</p><button type="button" @click="revealCapsule(activeEntry)">尝试开启</button></div>
          <button v-else class="entry-response-button" type="button" :disabled="busy" @click="askPartnerForEntry(activeEntry)">{{ busy ? '等待TA回应…' : `请${activeSpace.characterNickname}独立回应` }}</button>
          <div class="entry-permission"><span>记忆范围</span><select v-model="activeEntry.memoryPermission" @change="updateEntryMemoryPermission(activeEntry)"><option value="private">仅我可见</option><option value="space-only">仅情侣空间</option><option value="chat-allowed">允许普通聊天读取</option><option value="long-term">允许进入长期记忆</option></select></div>
          <button class="danger-text" type="button" @click="pendingDelete = activeEntry">删除这条记录</button>
        </section>
      </main>

      <main v-else-if="activeModule" class="couple-content-scroll module-workspace">
        <section class="module-hero" :style="{ '--module-accent': activeModule.accent }"><span>{{ activeModule.icon }}</span><div><small>{{ activeModule.group === 'exchange' ? '交换与回应' : activeModule.group === 'create' ? '共同创作' : activeModule.group === 'play' ? '一起玩' : activeModule.group === 'life' ? '共同生活' : activeModule.group === 'nurture' ? '共同养成' : '认真相处' }}</small><h2>{{ activeModule.name }}</h2><p>{{ activeModule.description }}</p></div></section>

        <section v-if="currentStats" class="nurture-stage"><div class="nurture-visual" :class="activeModule.kind"><span>{{ activeModule.icon }}</span><i v-for="n in Math.min(5, currentStats.level)" :key="n">✦</i></div><small>LEVEL {{ currentStats.level }}</small><h3>{{ currentStats.name }}</h3><div class="nurture-meter"><span :style="{ width: `${currentStats.progress}%` }"></span></div><p>活力 {{ currentStats.energy }} · 最近留下 {{ currentStats.selectedItems.length }} 个共同动作</p><div class="nurture-actions"><button v-for="action in activeModule.kind === 'room' ? ['换上暖灯','挂一幅作品','整理桌面','添一件软装'] : activeModule.kind === 'pet' ? ['喂一点心意','一起玩耍','轻轻梳毛','教个新动作'] : activeModule.kind === 'plant' ? ['浇水','晒太阳','挂一片回忆叶','选择新枝'] : ['加入一枚藏品','提出交换','整理套组','写来源卡']" :key="action" type="button" @click="nurture(action)">{{ action }}</button></div><div class="rename-row"><input v-model="entryDraft.title" :placeholder="`给${activeModule.shortName}取个名字`"><button type="button" @click="renameNurture">保存名字</button></div></section>

        <section v-else class="activity-composer">
          <label><span>标题</span><input v-model="entryDraft.title" maxlength="60" :placeholder="activeModule.name"></label>
          <template v-if="activeModule.kind === 'repair' || activeModule.kind === 'apology'">
            <label><span>发生了什么</span><textarea v-model="repairDraft.fact" placeholder="只描述具体发生的事情"></textarea></label><label><span>我的感受</span><textarea v-model="repairDraft.feeling" placeholder="描述感受，不替对方下定义"></textarea></label><label><span>我的需要</span><textarea v-model="repairDraft.need" placeholder="希望被理解或被怎样对待"></textarea></label><label><span>{{ activeModule.kind === 'apology' ? '责任与补救' : '边界与可执行方案' }}</span><textarea v-model="repairDraft.boundary" placeholder="写下具体、可以做到的内容"></textarea></label>
          </template>
          <template v-else-if="activeModule.kind === 'drawing'"><label><span>画作名字</span><input v-model="entryDraft.content" placeholder="这幅画想表达什么"></label><canvas ref="canvasRef" class="shared-canvas" @pointerdown="startDraw" @pointermove="moveDraw" @pointerup="stopDraw" @pointercancel="stopDraw" @pointerleave="stopDraw"></canvas><button class="canvas-clear" type="button" @click="clearCanvas">清空画板</button></template>
          <template v-else>
            <div v-if="selectedGamePrompt" class="drawn-prompt"><small>本轮题目</small><p>{{ selectedGamePrompt }}</p><button type="button" @click="selectedGamePrompt = gamePrompts[Math.floor(Math.random() * gamePrompts.length)]">换一道</button></div>
            <label><span>{{ ['checklist','plan','recipe','travel','match'].includes(activeModule.kind) ? '主要内容' : '我的内容' }}</span><textarea v-model="entryDraft.content" :placeholder="activeModule.prompt"></textarea></label>
            <label v-if="['letter','exchange','story','scrapbook','mood','surprise','coupon','manual','future'].includes(activeModule.kind)"><span>{{ activeModule.kind === 'mood' ? '希望怎样回应' : '补充说明' }}</span><textarea v-model="entryDraft.secondary" :placeholder="activeModule.kind === 'mood' ? '例如：只倾听，不要给建议' : '可选：规则、线索、条件或想留给对方的话'"></textarea></label>
            <label v-if="['checklist','plan','recipe','travel','match'].includes(activeModule.kind)"><span>{{ activeModule.kind === 'match' ? '候选愿望（每行一个）' : '共同步骤（每行一个）' }}</span><textarea v-model="entryDraft.list" placeholder="每行填写一项"></textarea></label>
            <label v-if="['quiz','game','boardgame'].includes(activeModule.kind)"><span>选项（可选，每行一个）</span><textarea v-model="entryDraft.options" placeholder="如果不是选择题可以留空"></textarea></label>
            <label v-if="activeModule.kind === 'capsule'"><span>开启时间（可选）</span><input v-model="entryDraft.revealAt" type="datetime-local"></label>
          </template>
          <label class="memory-row"><span>这条内容允许谁记得</span><select v-model="entryDraft.memoryPermission"><option value="private">仅我可见</option><option value="space-only">仅情侣空间</option><option value="chat-allowed">允许普通聊天读取</option><option value="long-term">允许进入长期记忆</option></select></label>
          <button class="composer-submit" type="button" @click="createEntry">{{ activeModule.actionLabel }}</button>
        </section>

        <section v-if="currentModuleEntries.length" class="module-history"><div class="section-title"><div><h3>这里发生过</h3><p>每一次交换和共同完成都会留下来源</p></div></div><button v-for="entry in currentModuleEntries" :key="entry.id" type="button" @click="openEntry(entry)"><span>{{ moduleFor(entry.moduleId)?.icon }}</span><div><strong>{{ entry.title }}</strong><p>{{ entry.content }}</p></div><em>{{ statusLabel(entry) }}</em></button></section>
      </main>

      <main v-else-if="page === 'home'" class="couple-home-scroll">
        <section class="couple-home-hero"><div class="hero-status"><span>{{ spaceStatusText }}</span><button type="button" @click="showSpaces = true">切换空间</button></div><div class="hero-pair"><div class="hero-avatar">{{ activeSpace.userNickname.slice(0,1) }}</div><div class="hero-heart"><i></i><b>♡</b></div><div class="hero-avatar role" :style="activeSpace.characterAvatar ? { backgroundImage: `url(${activeSpace.characterAvatar})` } : undefined">{{ activeSpace.characterAvatar ? '' : activeSpace.characterName.slice(0,1) }}</div></div><h2>{{ activeSpace.userNickname }} <i>与</i> {{ activeSpace.characterNickname }}</h2><p>{{ activeSpace.declaration || '认真交换，也认真保留各自的边界。' }}</p><div class="hero-days"><strong>{{ activeDays }}</strong><span>共同故事的第<br>天</span></div></section>
        <section v-if="activeSpace.status !== 'active'" class="space-state-banner"><strong>{{ activeSpace.status === 'paused' ? '空间已暂停' : '空间已封存' }}</strong><p>{{ activeSpace.status === 'paused' ? '主动联动已经冻结，作品仍可浏览。' : '结束不会删除共同作品，你可以随时导出或恢复。' }}</p><button type="button" @click="applyLifecycle(activeSpace.status === 'paused' ? 'resume' : 'restore')">恢复空间</button></section>
        <div class="section-title home-title"><div><h3>今天想一起做什么</h3><p>不是展示卡片，每一项都需要双方实际参与</p></div><button type="button" @click="page = 'modules'">查看全部</button></div>
        <section class="home-module-grid"><button v-for="module in enabledModules.slice(0, 8)" :key="module.id" type="button" :style="{ '--module-accent': module.accent }" :disabled="activeSpace.status !== 'active'" @click="openModule(module)"><span>{{ module.icon }}</span><strong>{{ module.shortName }}</strong><small>{{ module.actionLabel }}</small></button></section>
        <div class="section-title"><div><h3>最近的共同痕迹</h3><p>从创作、交换和共同完成中自然产生</p></div><button type="button" @click="page = 'records'">全部记录</button></div>
        <section v-if="recentEntries.length" class="recent-list"><button v-for="entry in recentEntries" :key="entry.id" type="button" @click="openEntry(entry)"><span :style="{ background: moduleFor(entry.moduleId)?.accent }">{{ moduleFor(entry.moduleId)?.icon }}</span><div><strong>{{ entry.title }}</strong><p>{{ entry.content }}</p></div><em>{{ formatDate(entry.updatedAt) }}</em></button></section><section v-else class="empty-records"><span>第一件共同作品还在等你们</span><button type="button" @click="page = 'modules'">去交换或创作</button></section>
      </main>

      <main v-else-if="page === 'modules'" class="couple-content-scroll"><div class="module-search"><span>⌕</span><input v-model="search" placeholder="找日记、情书、共创、养成…"></div><nav class="group-tabs"><button v-for="item in moduleGroups" :key="item.id" :class="{ active: group === item.id }" type="button" @click="group = item.id">{{ item.name }}</button></nav><section class="all-module-grid"><button v-for="module in filteredModules" :key="module.id" type="button" :style="{ '--module-accent': module.accent }" :disabled="activeSpace.status !== 'active'" @click="openModule(module)"><span>{{ module.icon }}</span><div><strong>{{ module.name }}</strong><p>{{ module.description }}</p><small>{{ module.actionLabel }} →</small></div></button></section></main>

      <main v-else-if="page === 'records'" class="couple-content-scroll"><section v-if="activeEntries.length" class="record-timeline"><button v-for="entry in activeEntries" :key="entry.id" type="button" @click="openEntry(entry)"><time>{{ formatDate(entry.createdAt) }}</time><i :style="{ background: moduleFor(entry.moduleId)?.accent }">{{ moduleFor(entry.moduleId)?.icon }}</i><div><small>{{ moduleFor(entry.moduleId)?.name }} · {{ statusLabel(entry) }}</small><strong>{{ entry.title }}</strong><p>{{ entry.content }}</p></div></button></section><section v-else class="empty-page"><span>迹</span><h2>还没有共同痕迹</h2><p>完成一次交换、共创、计划或养成后，会在这里形成可追溯的记录。</p><button type="button" @click="page='modules'">选择一项开始</button></section></main>

      <main v-else class="couple-content-scroll settings-scroll">
        <section class="settings-profile"><div class="hero-avatar role" :style="activeSpace.characterAvatar ? { backgroundImage: `url(${activeSpace.characterAvatar})` } : undefined">{{ activeSpace.characterAvatar ? '' : activeSpace.characterName.slice(0,1) }}</div><div><small>{{ spaceStatusText }}</small><h2>{{ activeSpace.title }}</h2><p>{{ activeSpace.userNickname }} · {{ activeSpace.characterNickname }}</p></div></section>
        <div class="settings-heading"><h3>聊天桥接</h3><p>全部默认关闭；关闭后不会向普通聊天增加对应提示词。</p></div><section class="settings-card"><label><div><strong>让聊天知道情侣关系</strong><p>仅提供“已建立空间”的最小状态</p></div><input v-model="activeSpace.bridge.chatKnowsRelationship" type="checkbox" @change="toggleChatKnowledge"></label><label :class="{ disabled: !activeSpace.bridge.chatKnowsRelationship }"><div><strong>读取授权回忆</strong><p>只读取单条记录中明确允许的内容</p></div><input v-model="activeSpace.bridge.chatReadsMemories" type="checkbox" :disabled="!activeSpace.bridge.chatKnowsRelationship" @change="persistCoupleSpaces"></label><label><div><strong>聊天内容可手动收进空间</strong><p>不会自动复制全部聊天记录</p></div><input v-model="activeSpace.bridge.chatWritesMemories" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>聊天中提及空间活动</strong><p>允许角色自然提起已完成的活动</p></div><input v-model="activeSpace.bridge.chatCanMentionActivities" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>允许写入长期记忆</strong><p>仍需每条记录单独选择长期记忆</p></div><input v-model="activeSpace.bridge.writeLongTermMemory" type="checkbox" @change="toggleLongTermMemory"></label><label :class="{ disabled: !activeSpace.bridge.writeLongTermMemory }"><div><strong>结束后仍保留记忆</strong><p>关闭时，封存空间会移除已写入的长期记忆</p></div><input v-model="activeSpace.bridge.rememberAfterEnding" type="checkbox" :disabled="!activeSpace.bridge.writeLongTermMemory" @change="persistCoupleSpaces"></label><div class="select-setting"><div><strong>聊天上下文预算</strong><p>关闭关系读取时固定为零</p></div><select v-model.number="activeSpace.bridge.tokenBudget" :disabled="!activeSpace.bridge.chatKnowsRelationship" @change="persistCoupleSpaces"><option :value="0">0 Token</option><option :value="100">100 Token</option><option :value="300">300 Token</option><option :value="600">600 Token</option></select></div></section>
        <div class="settings-heading"><h3>角色主动行为</h3><p>每种主动行为独立授权，不从聊天主动设置继承。</p></div><section class="settings-card"><label><div><strong>主动邀请建立空间</strong><p>只能产生邀请，不能自动建立</p></div><input v-model="activeSpace.autonomy.allowCharacterInvites" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>主动发起空间活动</strong><p>不包含信件、问题和惊喜</p></div><input v-model="activeSpace.autonomy.allowCharacterInitiatedActivities" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>主动寄信</strong><p>允许角色在空间邮局留下信件</p></div><input v-model="activeSpace.autonomy.allowCharacterLetters" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>主动出题</strong><p>允许角色发起问卷和盲答</p></div><input v-model="activeSpace.autonomy.allowCharacterQuestions" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>主动准备惊喜</strong><p>必须产生真实可打开的空间作品</p></div><input v-model="activeSpace.autonomy.allowCharacterSurprises" type="checkbox" @change="persistCoupleSpaces"></label></section>
        <div class="settings-heading"><h3>隐私与内容</h3><p>敏感内容不会因为情侣关系自动开放。</p></div><section class="settings-card"><label><div><strong>敏感关系话题</strong><p>边界、冲突、金钱观等题库</p></div><input v-model="activeSpace.privacy.sensitiveTopics" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>成人内容</strong><p>与普通题库、聊天和记忆隔离</p></div><input v-model="activeSpace.privacy.adultTopics" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>健康信息</strong><p>允许在空间中保存健康相关内容</p></div><input v-model="activeSpace.privacy.healthData" type="checkbox" @change="persistCoupleSpaces"></label><label><div><strong>金钱信息</strong><p>允许记录共同预算，不连接真实钱包</p></div><input v-model="activeSpace.privacy.moneyData" type="checkbox" @change="persistCoupleSpaces"></label></section>
        <div class="settings-heading"><h3>空间外观</h3><p>只改变情侣空间，不影响桌面和其他应用。</p></div><section class="theme-picker"><button v-for="item in [{id:'blush',name:'柔粉'},{id:'cream',name:'暖纸'},{id:'sage',name:'青叶'},{id:'lavender',name:'雾紫'},{id:'night',name:'深夜'}]" :key="item.id" :class="[item.id,{active:activeSpace.theme===item.id}]" type="button" @click="updateCoupleSpace(activeSpace,{theme:item.id as CoupleSpace['theme']})"><i></i><span>{{ item.name }}</span></button></section>
        <div class="settings-heading"><h3>功能管理</h3><p>关闭只隐藏对应功能，不删除已有记录。</p></div><section class="module-toggle-grid"><label v-for="module in coupleModuleCatalog" :key="module.id"><span :style="{ background: module.accent }">{{ module.icon }}</span><strong>{{ module.shortName }}</strong><input v-model="activeSpace.enabledModules[module.id]" type="checkbox" @change="persistCoupleSpaces"></label></section>
        <button class="lifecycle-button" type="button" @click="exportSpace">导出当前空间数据</button><button class="lifecycle-button" type="button" @click="showLifecycle = true">暂停、结束或恢复情侣空间</button>
      </main>

      <nav v-if="!activeModule && !activeEntry" class="couple-tabbar"><button :class="{ active: page === 'home' }" type="button" @click="page='home'"><span>⌂</span><small>我们</small></button><button :class="{ active: page === 'modules' }" type="button" @click="page='modules'"><span>◇</span><small>一起做</small></button><button :class="{ active: page === 'records' }" type="button" @click="page='records'"><span>◴</span><small>共同痕迹</small></button><button :class="{ active: page === 'settings' }" type="button" @click="page='settings'"><span>⚙</span><small>设置</small></button></nav>
    </template>

    <div v-if="showCreate" class="couple-modal-backdrop" @click.self="showCreate=false"><section class="couple-modal create-modal"><header><div><small>建立一段独立关系空间</small><h2>创建或接收邀请</h2></div><button type="button" @click="showCreate=false">×</button></header><div class="direction-tabs"><button :class="{active:createDraft.direction==='user'}" type="button" @click="createDraft.direction='user'">我邀请角色</button><button :class="{active:createDraft.direction==='character'}" type="button" @click="createDraft.direction='character'">让角色自主邀请</button></div><label><span>选择角色</span><select v-model="createDraft.chatId" @change="createDraft.characterNickname = selectedContact?.name || ''"><option value="" disabled>请选择</option><option v-for="chat in contacts" :key="chat.id" :value="String(chat.id)">{{ chat.realName || chat.name }}</option></select></label><div class="paired-inputs"><label><span>我的称呼</span><input v-model="createDraft.userNickname"></label><label><span>TA的称呼</span><input v-model="createDraft.characterNickname"></label></div><label><span>空间名字</span><input v-model="createDraft.title" maxlength="40"></label><label><span>{{ createDraft.direction === 'user' ? '邀请与空间宣言' : '给角色判断时的关系背景' }}</span><textarea v-model="createDraft.declaration" placeholder="可以认真写，也可以先留空"></textarea></label><label><span>纪念起点</span><input v-model="createDraft.anniversary" type="date"></label><p class="create-note">创建不会自动开放聊天、长期记忆、敏感内容或角色主动行为；这些权限进入空间后逐项设置。</p><button class="modal-primary" type="button" :disabled="busy" @click="submitCreate">{{ busy ? '正在等待角色判断…' : createDraft.direction === 'user' ? '发出邀请' : '看看TA是否想邀请我' }}</button></section></div>

    <div v-if="showSpaces" class="couple-modal-backdrop" @click.self="showSpaces=false"><section class="couple-modal spaces-modal"><header><div><small>MULTIPLE PRIVATE SPACES</small><h2>我的情侣空间</h2></div><button type="button" @click="showSpaces=false">×</button></header><button v-for="space in state.spaces" :key="space.id" class="space-choice" :class="{active:space.id===activeSpace?.id}" type="button" @click="setActiveSpace(space.id);showSpaces=false;page='home'"><span :style="space.characterAvatar ? { backgroundImage: `url(${space.characterAvatar})` } : undefined">{{ space.characterAvatar ? '' : space.characterName.slice(0,1) }}</span><div><strong>{{ space.title }}</strong><p>{{ space.userNickname }} 与 {{ space.characterNickname }}</p></div><em>{{ ({pending:'等待回应',active:'相伴中',paused:'已暂停',ended:'已封存'} as any)[space.status] }}</em></button><button class="add-space" type="button" @click="showSpaces=false;showCreate=true">＋ 新建另一个独立空间</button></section></div>

    <div v-if="showLifecycle" class="couple-modal-backdrop" @click.self="showLifecycle=false"><section class="couple-modal lifecycle-modal"><header><div><small>关系状态与作品是两件事</small><h2>空间状态</h2></div><button type="button" @click="showLifecycle=false">×</button></header><p>暂停或结束都不会删除日记、信件、画作、胶囊和其他共同内容。结束后聊天桥接立即失效。</p><textarea v-model="lifecycleNote" placeholder="可选：写下一段暂停或结束说明"></textarea><button v-if="activeSpace?.status==='active'" type="button" @click="applyLifecycle('pause')">暂停全部主动联动</button><button v-if="activeSpace?.status==='paused'" type="button" @click="applyLifecycle('resume')">恢复空间</button><button v-if="activeSpace?.status!=='ended'" class="end-space" type="button" @click="applyLifecycle('end')">结束并封存空间</button><button v-else type="button" @click="applyLifecycle('restore')">重新开启空间</button><button v-if="activeSpace?.status==='ended'" class="delete-space" type="button" @click="pendingDeleteSpace=true">永久删除这个空间</button></section></div>

    <div v-if="pendingDelete" class="couple-modal-backdrop"><section class="couple-modal confirm-modal"><h2>删除这条记录？</h2><p>删除后不会再出现在共同痕迹中，关联画作也会从本机移除。</p><div><button type="button" @click="pendingDelete=null">取消</button><button class="end-space" type="button" @click="confirmDeleteEntry">删除</button></div></section></div>
    <div v-if="pendingDeleteSpace" class="couple-modal-backdrop"><section class="couple-modal confirm-modal"><h2>永久删除这个空间？</h2><p>日记、信件、画作、养成进度和关联长期记忆都会删除。此操作不能撤回，建议先导出备份。</p><div><button type="button" @click="pendingDeleteSpace=false">取消</button><button class="end-space" type="button" @click="confirmDeleteSpace">永久删除</button></div></section></div>
  </div>
</template>
