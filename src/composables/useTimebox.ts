/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, readonly, ref } from 'vue'
import { mockChats } from './chatState/state'
import { useChatAuth } from './useChatAuth'
import { sendCapabilityMessage } from '../services/api'
import { clearTimeboxSnapshot, createDefaultTimeboxSnapshot, loadTimeboxSnapshot, replaceTimeboxSnapshot, saveTimeboxSnapshot } from '../services/timeboxRepository'
import { clampTimeboxMinutes, isSessionDue, localDateKey, sessionElapsedMs, sessionRemainingMs } from '../services/timeboxEngine'
import type { TimeboxMode, TimeboxOutcome, TimeboxSession, TimeboxSettings, TimeboxSnapshot, TimeboxTask } from '../types/timebox'

const state = reactive<TimeboxSnapshot>(createDefaultTimeboxSnapshot())
const ready = ref(false)
const busy = ref(false)
const error = ref('')
const now = ref(Date.now())
let initializing: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let tickTimer: ReturnType<typeof setInterval> | undefined
let wakeLock: any = null
let completionHandledFor = ''

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveTimeboxSnapshot(state) }, 120)
}

const activeSession = computed(() => state.sessions.find(item => item.id === state.activeSessionId) || null)
const activeTask = computed(() => activeSession.value?.taskId ? state.tasks.find(item => item.id === activeSession.value?.taskId) || null : null)
const remainingMs = computed(() => activeSession.value ? sessionRemainingMs(activeSession.value, now.value) : 0)
const elapsedMs = computed(() => activeSession.value ? sessionElapsedMs(activeSession.value, now.value) : 0)
const todayKey = computed(() => localDateKey(now.value))
const todayTasks = computed(() => state.tasks
  .filter(item => item.status !== 'cancelled' && (item.scheduledStart ? localDateKey(item.scheduledStart) === todayKey.value : item.status === 'inbox'))
  .sort((a, b) => (a.scheduledStart || Number.MAX_SAFE_INTEGER) - (b.scheduledStart || Number.MAX_SAFE_INTEGER)))
const completedSessions = computed(() => state.sessions.filter(item => item.status === 'completed'))
const todayCompletedSessions = computed(() => completedSessions.value.filter(item => item.finishedAt && localDateKey(item.finishedAt) === todayKey.value))
const todayFocusMs = computed(() => todayCompletedSessions.value.reduce((sum, item) => sum + item.actualFocusMs, 0))
const todayCompletedTasks = computed(() => state.tasks.filter(item => item.completedAt && localDateKey(item.completedAt) === todayKey.value).length)

const characters = computed(() => mockChats.value.filter(item => item.id !== 1 && item.chatType !== 'group'))

const persistChat = (chat: any) => {
  const { currentChatUserId } = useChatAuth()
  const key = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const raw = localStorage.getItem(key)
  if (!raw) return
  try {
    const contacts = JSON.parse(raw)
    const index = contacts.findIndex((item: any) => String(item.id) === String(chat.id))
    if (index < 0) return
    contacts[index].messages = chat.messages || []
    contacts[index].memoryBook = chat.memoryBook || []
    contacts[index].preview = chat.preview || ''
    contacts[index].time = chat.time || ''
    localStorage.setItem(key, JSON.stringify(contacts))
  } catch { /* 保留聊天原数据，写回失败不影响计时。 */ }
}

const writeCompanionToChat = (chat: any, text: string, session: TimeboxSession) => {
  if (!state.settings.companionWriteToChat) return
  const timestamp = Date.now()
  if (!Array.isArray(chat.messages)) chat.messages = []
  chat.messages.push({ id: timestamp, type: 'left', content: text, source: 'timebox', timeboxSessionId: session.id })
  chat.preview = text
  chat.time = new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  persistChat(chat)
}

const writeCompanionMemory = (chat: any, session: TimeboxSession) => {
  if (!state.settings.companionWriteMemory || session.outcome !== 'completed') return
  const timestamp = Date.now()
  if (!Array.isArray(chat.memoryBook)) chat.memoryBook = []
  chat.memoryBook.push({
    id: timestamp,
    date: new Date(timestamp).toLocaleDateString('zh-CN'),
    content: `用户完成了时间盒“${session.taskTitle}”，计划 ${session.plannedMinutes} 分钟，实际专注 ${Math.max(1, Math.round(session.actualFocusMs / 60000))} 分钟。`,
    messageCount: 0,
    evidenceMessageIds: [],
    memoryLevel: 1,
    memoryMode: 'long_text',
    version: 3,
    source: 'timebox',
    createdAt: timestamp,
    updatedAt: timestamp,
    enabled: true
  })
  persistChat(chat)
}

const localCompanionText = (phase: 'start' | 'manual' | 'finish', session: TimeboxSession, characterName: string) => {
  if (phase === 'start') return state.settings.companionStrictMode
    ? `${characterName}已经记下目标：${session.taskTitle}。这段时间先只做这一件事。`
    : `${characterName}会在这里陪你。先把“${session.taskTitle}”往前推进一点。`
  if (phase === 'manual') return state.settings.companionRomanceMode
    ? `${characterName}还在你身边。别急，按自己的节奏继续，我等你做完。`
    : `${characterName}在。回到当前这一步就好。`
  if (session.outcome === 'completed') return state.settings.companionRomanceMode
    ? `${characterName}看见你认真做完了“${session.taskTitle}”。辛苦了，过来休息一下。`
    : `${characterName}看见了，你完成了“${session.taskTitle}”。现在可以安心喘口气。`
  if (session.outcome === 'partial') return `${characterName}知道你已经推进了一部分。把剩下的下一步留清楚，这段时间就没有白费。`
  return `${characterName}没有催你。先确认卡住的地方，再决定继续还是重新安排。`
}

const aiCallsToday = () => state.sessions
  .flatMap(item => item.companionMessages)
  .filter(item => item.source === 'ai' && localDateKey(item.createdAt) === localDateKey(Date.now())).length

const requestCompanion = async (phase: 'start' | 'manual' | 'finish', session: TimeboxSession) => {
  if (!state.settings.companionEnabled) return ''
  if (phase === 'start' && !state.settings.companionStartMessage) return ''
  if (phase === 'manual' && !state.settings.companionManualCall) return ''
  if (phase === 'finish' && !state.settings.companionFinishMessage) return ''
  const characterId = session.companionCharacterId || state.settings.companionCharacterId
  const chat = characters.value.find(item => String(item.characterEntityId || item.id) === String(characterId))
  if (!chat) return ''
  let text = ''
  let source: 'local' | 'ai' = 'local'
  if (state.settings.companionAi && aiCallsToday() < Math.max(0, state.settings.dailyAiMessageLimit)) {
    busy.value = true
    error.value = ''
    try {
      const stats = state.settings.companionReadStats
        ? `计划${session.plannedMinutes}分钟，当前实际专注${Math.round(sessionElapsedMs(session) / 60000)}分钟，中断${session.interruptionCount}次。`
        : '用户没有授权读取详细专注统计。'
      const note = state.settings.companionReadTaskNote && activeTask.value?.note ? `任务补充：${activeTask.value.note}` : '用户没有授权读取任务说明。'
      const response = await sendCapabilityMessage('chat', [
        { role: 'system', content: `你是${chat.name}。人设：${chat.persona || '按照既有性格和关系自然回应'}。你正在陪用户进行一次时间盒。只输出一到两句自然、具体、不过度热情的话。不要说教，不要虚构用户没有完成的事情，不要要求用户回复。${state.settings.companionStrictMode ? '语气可以明确坚定，但不能羞辱。' : ''}${state.settings.companionRomanceMode ? '若既有关系允许，可以自然亲密，但不要擅自升级关系。' : ''}` },
        { role: 'user', content: `节点：${phase === 'start' ? '刚开始' : phase === 'manual' ? '用户主动呼叫' : '本次结束'}。任务：${session.taskTitle}。${stats}${note}${phase === 'finish' ? `结果：${session.outcome || '未填写'}。` : ''}` }
      ], { diagnosticContext: { chatId: `timebox:${session.id}`, characterIds: [String(chat.characterEntityId || chat.id)], characterName: chat.name } })
      text = String(response.content || '').trim()
      source = 'ai'
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '角色回应失败'
      text = localCompanionText(phase, session, chat.name)
    } finally {
      busy.value = false
    }
  } else {
    text = localCompanionText(phase, session, chat.name)
  }
  if (!text) return ''
  session.companionMessages.push({ id: uid('companion'), phase, text, createdAt: Date.now(), source })
  session.updatedAt = Date.now()
  writeCompanionToChat(chat, text, session)
  if (phase === 'finish') writeCompanionMemory(chat, session)
  scheduleSave()
  return text
}

const releaseWakeLock = async () => {
  try { await wakeLock?.release?.() } catch { /* 已释放时无需处理。 */ }
  wakeLock = null
}

const requestWakeLock = async () => {
  if (!state.settings.keepScreenAwake || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return false
  try { wakeLock = await (navigator as any).wakeLock.request('screen'); return true } catch { return false }
}

const playCompletionFeedback = () => {
  if (state.settings.vibration && 'vibrate' in navigator) navigator.vibrate([120, 80, 120])
  if (state.settings.completionSound) {
    try {
      const context = new AudioContext()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = 660
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.7)
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.72)
      oscillator.addEventListener('ended', () => void context.close(), { once: true })
    } catch { /* 不支持音频时保持安静。 */ }
  }
  if (state.settings.browserNotifications && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
    try { new Notification('时间盒结束', { body: activeSession.value?.taskTitle || '本次专注时间已到' }) } catch { /* 部分 iOS 环境只支持 Service Worker 通知。 */ }
  }
}

const reconcile = () => {
  now.value = Date.now()
  const session = activeSession.value
  if (!session || !isSessionDue(session, now.value) || completionHandledFor === session.id) return
  completionHandledFor = session.id
  session.status = 'awaiting_review'
  session.finishedAt = session.endAt
  session.actualFocusMs = sessionElapsedMs(session, session.endAt || now.value)
  session.updatedAt = now.value
  if (session.taskId) {
    const task = state.tasks.find(item => item.id === session.taskId)
    if (task && task.status !== 'completed') { task.status = 'doing'; task.updatedAt = now.value }
  }
  playCompletionFeedback()
  void releaseWakeLock()
  scheduleSave()
}

const initialize = async () => {
  if (ready.value) return
  if (initializing) return initializing
  initializing = (async () => {
    Object.assign(state, await loadTimeboxSnapshot())
    const session = activeSession.value
    if (session && !['running', 'paused', 'awaiting_review'].includes(session.status)) state.activeSessionId = null
    reconcile()
    ready.value = true
  })().finally(() => { initializing = null })
  return initializing
}

const startRuntime = () => {
  if (!tickTimer) tickTimer = setInterval(reconcile, 500)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('pagehide', flush)
}

const stopRuntime = () => {
  if (tickTimer) clearInterval(tickTimer)
  tickTimer = undefined
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('pagehide', flush)
  void releaseWakeLock()
  flush()
}

function handleVisibilityChange() {
  const session = activeSession.value
  if (document.visibilityState === 'visible') {
    reconcile()
    if (session?.status === 'running') void requestWakeLock()
  } else if (state.settings.leaveDetection && state.settings.recordInterruptions && session?.status === 'running') {
    session.interruptionCount += 1
    session.interruptionReasons.push('离开时间盒页面')
    session.updatedAt = Date.now()
    scheduleSave()
  }
}

function flush() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = undefined
  void saveTimeboxSnapshot(state)
}

const createTask = (input: Partial<TimeboxTask> & Pick<TimeboxTask, 'title'>) => {
  const timestamp = Date.now()
  const estimateMinutes = clampTimeboxMinutes(Number(input.estimateMinutes || state.settings.defaultFocusMinutes))
  const task: TimeboxTask = {
    id: uid('task'), title: input.title.trim() || '未命名任务', note: input.note?.trim() || '', project: input.project?.trim() || '', tags: input.tags || [],
    status: input.scheduledStart ? 'planned' : 'inbox', priority: input.priority || 0, energy: input.energy || 'medium', estimateMinutes,
    scheduledStart: input.scheduledStart || null, scheduledEnd: input.scheduledStart ? Number(input.scheduledStart) + estimateMinutes * 60000 : null,
    deadline: input.deadline || null, definitionOfDone: input.definitionOfDone?.trim() || '', checklist: input.checklist || [], allowSplit: input.allowSplit !== false,
    companionOverride: input.companionOverride ?? null, createdAt: timestamp, updatedAt: timestamp, completedAt: null
  }
  state.tasks.unshift(task); scheduleSave(); return task
}

const updateTask = (taskId: string, patch: Partial<TimeboxTask>) => {
  const task = state.tasks.find(item => item.id === taskId)
  if (!task) return false
  Object.assign(task, patch, { id: task.id, createdAt: task.createdAt, updatedAt: Date.now() })
  if (patch.estimateMinutes && task.scheduledStart) task.scheduledEnd = task.scheduledStart + clampTimeboxMinutes(patch.estimateMinutes) * 60000
  scheduleSave(); return true
}

const deleteTask = (taskId: string) => {
  if (activeSession.value?.taskId === taskId) return false
  const index = state.tasks.findIndex(item => item.id === taskId)
  if (index < 0) return false
  state.tasks.splice(index, 1); scheduleSave(); return true
}

const startSession = async (taskId: string | null, options: { title?: string; mode?: TimeboxMode; minutes?: number } = {}) => {
  if (activeSession.value && ['running', 'paused', 'awaiting_review'].includes(activeSession.value.status)) throw new Error('请先处理当前时间盒')
  const task = taskId ? state.tasks.find(item => item.id === taskId) : null
  const timestamp = Date.now()
  const mode = options.mode || state.settings.defaultMode
  const minutes = clampTimeboxMinutes(options.minutes || task?.estimateMinutes || state.settings.defaultFocusMinutes)
  const openEnded = mode === 'stopwatch' || mode === 'flowtime'
  const session: TimeboxSession = {
    id: uid('session'), taskId: task?.id || null, taskTitle: task?.title || options.title?.trim() || '临时专注', mode, status: 'running', plannedMinutes: minutes,
    startedAt: timestamp, endAt: openEnded ? null : timestamp + minutes * 60000, pausedAt: null, remainingMsAtPause: null, totalPausedMs: 0,
    finishedAt: null, actualFocusMs: 0, outcome: null, reviewNote: '', interruptionCount: 0, interruptionReasons: [],
    companionCharacterId: state.settings.companionCharacterId, companionMessages: [], createdAt: timestamp, updatedAt: timestamp
  }
  state.sessions.push(session); state.activeSessionId = session.id; completionHandledFor = ''
  if (task) { task.status = 'doing'; task.updatedAt = timestamp }
  scheduleSave()
  if (state.settings.fullscreenOnStart && document.fullscreenEnabled) { try { await document.documentElement.requestFullscreen() } catch { /* 用户可继续计时。 */ } }
  void requestWakeLock()
  void requestCompanion('start', session)
  return session
}

const pauseSession = () => {
  const session = activeSession.value
  if (!session || session.status !== 'running') return false
  const timestamp = Date.now()
  session.pausedAt = timestamp
  session.remainingMsAtPause = session.endAt === null ? null : Math.max(0, session.endAt - timestamp)
  session.status = 'paused'; session.updatedAt = timestamp
  void releaseWakeLock(); scheduleSave(); return true
}

const resumeSession = () => {
  const session = activeSession.value
  if (!session || session.status !== 'paused' || !session.pausedAt) return false
  const timestamp = Date.now()
  session.totalPausedMs += timestamp - session.pausedAt
  if (session.remainingMsAtPause !== null) session.endAt = timestamp + session.remainingMsAtPause
  session.pausedAt = null; session.remainingMsAtPause = null; session.status = 'running'; session.updatedAt = timestamp
  completionHandledFor = ''; void requestWakeLock(); scheduleSave(); return true
}

const extendSession = (minutes: number) => {
  const session = activeSession.value
  if (!session || !['running', 'paused'].includes(session.status)) return false
  const extra = clampTimeboxMinutes(minutes, 5) * 60000
  if (session.status === 'paused' && session.remainingMsAtPause !== null) session.remainingMsAtPause += extra
  else if (session.endAt !== null) session.endAt += extra
  session.plannedMinutes += Math.round(extra / 60000); session.updatedAt = Date.now(); scheduleSave(); return true
}

const addInterruption = (reason: string) => {
  const session = activeSession.value
  if (!session || !state.settings.recordInterruptions) return false
  session.interruptionCount += 1
  if (reason.trim()) session.interruptionReasons.push(reason.trim().slice(0, 100))
  session.updatedAt = Date.now(); scheduleSave(); return true
}

const endNowForReview = () => {
  const session = activeSession.value
  if (!session || !['running', 'paused'].includes(session.status)) return false
  const timestamp = Date.now()
  session.finishedAt = timestamp
  session.actualFocusMs = sessionElapsedMs(session, timestamp)
  session.status = 'awaiting_review'
  session.updatedAt = timestamp
  void releaseWakeLock(); scheduleSave(); return true
}

const finishSession = async (outcome: TimeboxOutcome, reviewNote = '') => {
  const session = activeSession.value
  if (!session) return false
  const timestamp = Date.now()
  session.status = outcome === 'cancelled' ? 'cancelled' : 'completed'
  session.finishedAt ||= timestamp
  session.actualFocusMs = sessionElapsedMs(session, session.finishedAt)
  session.outcome = outcome; session.reviewNote = reviewNote.trim(); session.updatedAt = timestamp
  const task = session.taskId ? state.tasks.find(item => item.id === session.taskId) : null
  if (task) {
    if (outcome === 'completed') { task.status = 'completed'; task.completedAt = timestamp }
    else if (outcome === 'cancelled') task.status = task.scheduledStart ? 'planned' : 'inbox'
    else task.status = 'doing'
    task.updatedAt = timestamp
  }
  await requestCompanion('finish', session)
  state.activeSessionId = null
  if (!state.settings.recordHistory) state.sessions = state.sessions.filter(item => item.id !== session.id)
  void releaseWakeLock(); scheduleSave(); return true
}

const callCompanion = async () => activeSession.value ? requestCompanion('manual', activeSession.value) : ''

const updateSettings = async (patch: Partial<TimeboxSettings>) => {
  Object.assign(state.settings, patch)
  state.settings.defaultFocusMinutes = clampTimeboxMinutes(state.settings.defaultFocusMinutes)
  state.settings.shortBreakMinutes = clampTimeboxMinutes(state.settings.shortBreakMinutes, 5)
  state.settings.longBreakMinutes = clampTimeboxMinutes(state.settings.longBreakMinutes, 15)
  state.settings.pomodoroRounds = Math.max(1, Math.min(12, Math.round(Number(state.settings.pomodoroRounds || 4))))
  state.settings.dailyAiMessageLimit = Math.max(0, Math.min(20, Math.round(Number(state.settings.dailyAiMessageLimit || 0))))
  if (!state.settings.keepScreenAwake) await releaseWakeLock()
  else if (activeSession.value?.status === 'running') void requestWakeLock()
  scheduleSave()
}

const requestNotificationPermission = async () => {
  if (typeof Notification === 'undefined') return 'unsupported' as const
  try {
    const result = await Notification.requestPermission()
    await updateSettings({ browserNotifications: result === 'granted' })
    return result
  } catch { return 'unsupported' as const }
}

const exportData = () => clone(state)

const importData = async (snapshot: TimeboxSnapshot) => {
  if (activeSession.value) throw new Error('请先结束当前时间盒再导入')
  const normalized = await replaceTimeboxSnapshot(snapshot)
  Object.assign(state, normalized); return true
}

const resetAll = async () => {
  await releaseWakeLock(); await clearTimeboxSnapshot(); Object.assign(state, createDefaultTimeboxSnapshot()); completionHandledFor = ''
}

export const useTimebox = () => ({
  state, ready: readonly(ready), busy: readonly(busy), error: readonly(error), now: readonly(now), activeSession, activeTask, remainingMs, elapsedMs,
  todayTasks, completedSessions, todayCompletedSessions, todayFocusMs, todayCompletedTasks, characters,
  initialize, startRuntime, stopRuntime, reconcile, createTask, updateTask, deleteTask, startSession, pauseSession, resumeSession, extendSession,
  addInterruption, endNowForReview, finishSession, callCompanion, updateSettings, requestNotificationPermission, exportData, importData, resetAll, flush
})
