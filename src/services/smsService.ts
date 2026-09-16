/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type SmsMessageDirection = 'receive' | 'send'
export type SmsMessageStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'delivered' | 'failed' | 'blocked'
export type SmsThreadCategory = 'personal' | 'transaction' | 'service' | 'otp' | 'stranger' | 'promotion' | 'blocked'
export type SmsNarrativeKind = 'wrong_number' | 'daily' | 'comedy' | 'mystery' | 'prank'

export interface SmsMessageRecord {
  id: string
  type: SmsMessageDirection
  createdAt: number
  text: string
  relatedId?: string
  status?: SmsMessageStatus
  scheduledAt?: number
  deliveredAt?: number
  readAt?: number
  actualActor?: 'user' | 'character' | 'contact' | 'service' | 'system'
  source?: string
  generated?: boolean
}

export interface SmsNarrativeState {
  kind: SmsNarrativeKind
  scenarioId: string
  stage: number
  plannerName?: string
  executorName?: string
  revealed: boolean
  ended: boolean
  nextAvailableAt: number
}

export interface SmsThreadRecord {
  id: string
  name: string
  avatarType: 'icon' | 'text'
  avatarIcon?: 'bell' | 'bank' | 'user'
  avatarText?: string
  number?: string
  unread: boolean
  messages: SmsMessageRecord[]
  category?: SmsThreadCategory
  participantType?: 'system' | 'service' | 'character' | 'contact' | 'stranger' | 'manual'
  linkedCharacterId?: string
  pinned?: boolean
  archived?: boolean
  blocked?: boolean
  muted?: boolean
  allowReply?: boolean
  draft?: string
  customName?: string
  narrative?: SmsNarrativeState
  createdAt?: number
  updatedAt?: number
}

export interface SmsContactRecord {
  id: string
  name: string
  number: string
  avatarText: string
  participantType: 'character' | 'manual'
  linkedCharacterId?: string
  persona?: string
  timelineId?: string
}

export interface SmsSettings {
  enabled: boolean
  allowInterruptions: boolean
  protectActiveChat: boolean
  allowImportantDuringChat: boolean
  quietHoursEnabled: boolean
  quietHoursStart: string
  quietHoursEnd: string
  allowCharacterReplies: boolean
  allowCharacterProactive: boolean
  allowCharacterUnknownNumber: boolean
  allowSmsAffectChat: boolean
  allowUserPhoneAffectChat: boolean
  allowCharacterPhoneAffectChat: boolean
  allowStrangerAffectChat: boolean
  allowPrankAffectChat: boolean
  allowFinanceAffectChat: boolean
  strangerEnabled: boolean
  strangerAutoReceive: boolean
  strangerDailyLimit: number
  strangerDailyCount: number
  strangerDailyDate: string
  strangerKinds: Record<'daily' | 'wrongNumber' | 'comedy' | 'mystery', boolean>
  prankEnabled: boolean
  prankAllowFriends: boolean
  prankAllowUserInitiated: boolean
  prankAllowPhoneEscalation: boolean
  prankRevealAtEnd: boolean
  prankMaxTurns: number
  sourceToggles: Record<'wallet' | 'calls' | 'calendar' | 'forum' | 'moments' | 'system' | 'music' | 'books', boolean>
}

const STORAGE_PREFIX = 'clingy_sms_threads_v1_'
const SETTINGS_PREFIX = 'clingy_sms_settings_v2_'
const IDENTITY_PREFIX = 'clingy_sms_identity_v1_'
export const smsUpdatedEventName = 'clingy-sms-updated'
export const smsSettingsUpdatedEventName = 'clingy-sms-settings-updated'

const storageKey = (accountId: string) => `${STORAGE_PREFIX}${accountId || 'guest'}`
const settingsKey = (accountId: string) => `${SETTINGS_PREFIX}${accountId || 'guest'}`
const identityKey = (accountId: string) => `${IDENTITY_PREFIX}${accountId || 'guest'}`
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const today = () => new Date().toLocaleDateString('en-CA')
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback
}
const safeText = (value: unknown, max = 1000) => String(value || '').trim().slice(0, max)
const isQuietTime = (settings: SmsSettings, stamp = new Date()) => {
  if (!settings.quietHoursEnabled) return false
  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null
  }
  const start = toMinutes(settings.quietHoursStart); const end = toMinutes(settings.quietHoursEnd)
  if (start === null || end === null || start === end) return false
  const current = stamp.getHours() * 60 + stamp.getMinutes()
  return start < end ? current >= start && current < end : current >= start || current < end
}
const requestSmsNotification = (settings: SmsSettings, thread: SmsThreadRecord, message: SmsMessageRecord) => {
  const isInboxOnlyNarrative = message.source === 'prank' || message.source === 'narrative-stop' || String(message.source || '').startsWith('stranger:')
  if (typeof window === 'undefined' || !settings.allowInterruptions || isQuietTime(settings) || thread.muted || thread.blocked || message.type !== 'receive' || isInboxOnlyNarrative) return
  window.dispatchEvent(new CustomEvent('clingy-sms-notification-request', { detail: {
    name: thread.customName || thread.name, avatarText: thread.avatarText || thread.name.slice(0, 1) || '短', content: message.text,
    deliveryId: `sms:${thread.id}:${message.id}`, protectActiveChat: settings.protectActiveChat,
    important: thread.category === 'otp' || thread.category === 'transaction', allowImportantDuringChat: settings.allowImportantDuringChat
  } }))
}

export const defaultSmsSettings = (): SmsSettings => ({
  enabled: true,
  allowInterruptions: false,
  protectActiveChat: true,
  allowImportantDuringChat: false,
  quietHoursEnabled: true,
  quietHoursStart: '22:30',
  quietHoursEnd: '08:00',
  allowCharacterReplies: true,
  allowCharacterProactive: false,
  allowCharacterUnknownNumber: false,
  allowSmsAffectChat: false,
  allowUserPhoneAffectChat: false,
  allowCharacterPhoneAffectChat: false,
  allowStrangerAffectChat: false,
  allowPrankAffectChat: false,
  allowFinanceAffectChat: false,
  strangerEnabled: false,
  strangerAutoReceive: false,
  strangerDailyLimit: 2,
  strangerDailyCount: 0,
  strangerDailyDate: today(),
  strangerKinds: { daily: true, wrongNumber: true, comedy: true, mystery: false },
  prankEnabled: false,
  prankAllowFriends: false,
  prankAllowUserInitiated: false,
  prankAllowPhoneEscalation: false,
  prankRevealAtEnd: true,
  prankMaxTurns: 6,
  sourceToggles: { wallet: true, calls: false, calendar: false, forum: false, moments: true, system: true, music: false, books: false }
})

const normalizeSettings = (raw: any): SmsSettings => {
  const base = defaultSmsSettings()
  const merged = { ...base, ...(raw && typeof raw === 'object' ? raw : {}) }
  return {
    ...merged,
    strangerDailyLimit: clamp(merged.strangerDailyLimit, 1, 20, 2),
    strangerDailyCount: Math.max(0, Number(merged.strangerDailyCount) || 0),
    prankMaxTurns: clamp(merged.prankMaxTurns, 2, 20, 6),
    strangerKinds: { ...base.strangerKinds, ...(raw?.strangerKinds || {}) },
    sourceToggles: { ...base.sourceToggles, ...(raw?.sourceToggles || {}) }
  }
}

export const loadSmsSettings = (accountId: string): SmsSettings => {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(settingsKey(accountId)) || 'null')) }
  catch { return defaultSmsSettings() }
}

export const saveSmsSettings = (accountId: string, settings: SmsSettings) => {
  const normalized = normalizeSettings(settings)
  localStorage.setItem(settingsKey(accountId), JSON.stringify(normalized))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(smsSettingsUpdatedEventName, { detail: { accountId } }))
  return normalized
}

const stableDigits = (seed: string) => {
  let hash = 2166136261
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const digits = String(Math.abs(hash >>> 0)).padStart(10, '0').slice(0, 8)
  return `170${digits}`
}

export const ensureSmsIdentity = (accountId: string) => {
  const key = identityKey(accountId)
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const number = stableDigits(`user:${accountId || 'guest'}`)
  localStorage.setItem(key, number)
  return number
}

export const getCharacterSmsNumber = (accountId: string, characterId: string) => stableDigits(`character:${accountId}:${characterId}`)

const defaultThreads = (): SmsThreadRecord[] => ([{
  id: 'system', name: '系统通知', avatarType: 'icon', avatarIcon: 'bell', avatarText: '', number: '1069 0099 00', unread: true,
  category: 'service', participantType: 'system', allowReply: false, pinned: false, archived: false, blocked: false, muted: false,
  createdAt: Date.now(), updatedAt: Date.now(),
  messages: [{ id: 'welcome', type: 'receive', createdAt: Date.now(), status: 'delivered', actualActor: 'system', source: 'system', text: '【系统通知】欢迎使用短信服务，您的初始设置已完成。' }]
}])

const normalizeMessage = (message: any): SmsMessageRecord => ({
  ...message, id: String(message?.id || uid('sms')), text: safeText(message?.text, 5000), createdAt: Number(message?.createdAt) || Date.now(),
  type: message?.type === 'send' ? 'send' : 'receive', status: message?.status || (message?.type === 'send' ? 'sent' : 'delivered')
})

const normalizeThread = (thread: any): SmsThreadRecord => {
  const messages = Array.isArray(thread?.messages) ? thread.messages.map(normalizeMessage) : []
  const last = messages[messages.length - 1]
  return {
    ...thread, id: String(thread?.id || uid('thread')), name: safeText(thread?.name || thread?.number || '未知号码', 80),
    avatarType: thread?.avatarType === 'icon' ? 'icon' : 'text', avatarText: safeText(thread?.avatarText || thread?.name?.slice(0, 1) || '?', 2),
    number: safeText(thread?.number, 32), unread: Boolean(thread?.unread), messages,
    category: thread?.blocked ? 'blocked' : (thread?.category || 'personal'), participantType: thread?.participantType || 'manual',
    pinned: Boolean(thread?.pinned), archived: Boolean(thread?.archived), blocked: Boolean(thread?.blocked), muted: Boolean(thread?.muted),
    allowReply: thread?.allowReply !== false, draft: safeText(thread?.draft, 5000),
    createdAt: Number(thread?.createdAt) || Number(messages[0]?.createdAt) || Date.now(), updatedAt: Number(thread?.updatedAt) || Number(last?.createdAt) || Date.now()
  }
}

const sortThreads = (threads: SmsThreadRecord[]) => [...threads].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.updatedAt || 0) - Number(a.updatedAt || 0))

export const loadSmsThreads = (accountId: string): SmsThreadRecord[] => {
  try {
    const raw = localStorage.getItem(storageKey(accountId))
    if (!raw) return defaultThreads()
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return defaultThreads()
    return sortThreads(parsed.map(normalizeThread))
  } catch { return defaultThreads() }
}

export const saveSmsThreads = (accountId: string, threads: SmsThreadRecord[]) => {
  const normalized = sortThreads(threads.map(normalizeThread))
  localStorage.setItem(storageKey(accountId), JSON.stringify(normalized))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(smsUpdatedEventName, { detail: { accountId } }))
  return normalized
}

export const markSmsThreadRead = (accountId: string, threadId: string, read = true) => {
  const threads = loadSmsThreads(accountId)
  const thread = threads.find(item => item.id === threadId)
  if (!thread || thread.unread === !read) return false
  thread.unread = !read
  if (read) thread.messages.forEach(message => { if (message.type === 'receive' && !message.readAt) message.readAt = Date.now() })
  saveSmsThreads(accountId, threads)
  return true
}

export const findSmsThread = (accountId: string, threadId: string) => loadSmsThreads(accountId).find(item => item.id === threadId) || null

export const createSmsThread = (accountId: string, input: Partial<SmsThreadRecord> & { name: string; number: string }) => {
  const threads = loadSmsThreads(accountId)
  const normalizedNumber = input.number.replace(/\s+/g, '')
  const existing = threads.find(item => item.number?.replace(/\s+/g, '') === normalizedNumber || item.id === input.id)
  if (existing) return existing
  const thread = normalizeThread({
    id: input.id || `number:${normalizedNumber}`, name: input.name || input.number, number: input.number,
    avatarType: input.avatarType || 'text', avatarText: input.avatarText || input.name.slice(0, 1), unread: false, messages: [],
    category: input.category || 'personal', participantType: input.participantType || 'manual', linkedCharacterId: input.linkedCharacterId,
    allowReply: input.allowReply !== false, narrative: input.narrative
  })
  saveSmsThreads(accountId, [thread, ...threads])
  return thread
}

export const appendSmsMessage = (accountId: string, threadId: string, input: Omit<SmsMessageRecord, 'id' | 'createdAt'> & Partial<Pick<SmsMessageRecord, 'id' | 'createdAt'>>) => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled) return null
  const threads = loadSmsThreads(accountId)
  const thread = threads.find(item => item.id === threadId)
  if (!thread) return null
  if (input.relatedId && thread.messages.some(message => message.relatedId === input.relatedId)) return null
  const message = normalizeMessage({ ...input, id: input.id || uid('sms'), createdAt: input.createdAt || Date.now() })
  thread.messages.push(message)
  thread.updatedAt = Math.max(Number(thread.updatedAt || 0), message.scheduledAt || message.createdAt)
  if (message.type === 'receive') thread.unread = true
  saveSmsThreads(accountId, threads)
  requestSmsNotification(settings, thread, message)
  return message
}

export const sendSmsMessage = (accountId: string, threadId: string, text: string, options: { scheduledAt?: number; source?: string; actualActor?: SmsMessageRecord['actualActor'] } = {}) => {
  const content = safeText(text, 5000)
  if (!content) return null
  const future = Number(options.scheduledAt || 0) > Date.now() + 1000
  return appendSmsMessage(accountId, threadId, {
    type: 'send', text: content, status: future ? 'scheduled' : 'sent', scheduledAt: future ? options.scheduledAt : undefined,
    deliveredAt: future ? undefined : Date.now(), source: options.source || 'user', actualActor: options.actualActor || 'user'
  })
}

export const receiveSmsMessage = (accountId: string, threadId: string, text: string, options: { relatedId?: string; source?: string; actualActor?: SmsMessageRecord['actualActor']; generated?: boolean } = {}) => appendSmsMessage(accountId, threadId, {
  type: 'receive', text: safeText(text, 5000), status: 'delivered', deliveredAt: Date.now(), relatedId: options.relatedId,
  source: options.source || 'unknown', actualActor: options.actualActor || 'contact', generated: options.generated
})

export const saveSmsDraft = (accountId: string, threadId: string, draft: string) => {
  const threads = loadSmsThreads(accountId); const thread = threads.find(item => item.id === threadId)
  if (!thread) return
  thread.draft = safeText(draft, 5000); saveSmsThreads(accountId, threads)
}

export const updateSmsThread = (accountId: string, threadId: string, patch: Partial<Pick<SmsThreadRecord, 'pinned' | 'archived' | 'blocked' | 'muted' | 'customName' | 'name' | 'category'>>) => {
  const threads = loadSmsThreads(accountId); const thread = threads.find(item => item.id === threadId)
  if (!thread) return null
  Object.assign(thread, patch)
  if (patch.blocked === true) { thread.category = 'blocked'; thread.unread = false }
  if (patch.blocked === false && thread.category === 'blocked') thread.category = thread.participantType === 'stranger' ? 'stranger' : 'personal'
  saveSmsThreads(accountId, threads); return thread
}

export const deleteSmsThread = (accountId: string, threadId: string) => {
  const threads = loadSmsThreads(accountId); const next = threads.filter(item => item.id !== threadId)
  if (next.length === threads.length) return false
  saveSmsThreads(accountId, next); return true
}

export const clearSmsThread = (accountId: string, threadId: string) => {
  const threads = loadSmsThreads(accountId); const thread = threads.find(item => item.id === threadId)
  if (!thread) return false
  thread.messages = []; thread.unread = false; thread.updatedAt = Date.now(); saveSmsThreads(accountId, threads); return true
}

export const processScheduledSms = (accountId: string, stamp = Date.now()) => {
  const threads = loadSmsThreads(accountId); let changed = false
  for (const thread of threads) for (const message of thread.messages) {
    if (message.status !== 'scheduled' || !message.scheduledAt || message.scheduledAt > stamp) continue
    message.status = 'sent'; message.deliveredAt = stamp; changed = true
  }
  if (changed) saveSmsThreads(accountId, threads)
  return changed
}

export const loadSmsContacts = (accountId: string): SmsContactRecord[] => {
  let contacts: any[] = []
  try { contacts = JSON.parse(localStorage.getItem(accountId && accountId !== 'guest' ? `clingy_custom_contacts_${accountId}` : 'clingy_custom_contacts') || '[]') }
  catch { contacts = [] }
  return contacts.filter(item => item?.id !== 1 && item?.chatType !== 'group').map(item => ({
    id: String(item.characterEntityId || item.id), linkedCharacterId: String(item.characterEntityId || item.id),
    name: safeText(item.remark || item.name || '联系人', 80), number: getCharacterSmsNumber(accountId, String(item.characterEntityId || item.id)),
    avatarText: safeText(item.name || '?', 1), participantType: 'character' as const, persona: safeText(item.persona, 10000),
    timelineId: String(item.timelineState?.activeTimelineId || item.activeTimelineId || 'main')
  }))
}

export const ensureCharacterSmsThread = (accountId: string, contact: SmsContactRecord) => createSmsThread(accountId, {
  id: `character:${contact.id}`, name: contact.name, number: contact.number, avatarType: 'text', avatarText: contact.avatarText,
  category: 'personal', participantType: 'character', linkedCharacterId: contact.linkedCharacterId, allowReply: true
})

const strangerScenarios = [
  { kind: 'daily', id: 'parcel', name: '陌生号码', opening: '你好，请问尾号 2176 的包裹是放门口还是放驿站？我这边地址可能少了一行。' },
  { kind: 'daily', id: 'cat', name: '陌生号码', opening: '不好意思打扰一下，你认识一只总在便利店门口等人的橘猫吗？它项圈上留的是这个号码。' },
  { kind: 'wrong_number', id: 'classmate', name: '未知联系人', opening: '明天还是老地方吗？我刚换了号码，别又认不出我。' },
  { kind: 'wrong_number', id: 'flowers', name: '花店配送', opening: '您好，您朋友订的花束备注写着“千万别提前问”，但地址没有门牌号，可以补一下吗？' },
  { kind: 'comedy', id: 'duck', name: '陌生号码', opening: '你寄养的那只鸭子今天又把水盆推翻了。方便的话请告诉我，它是不是一直都这么理直气壮？' },
  { kind: 'comedy', id: 'contest', name: '活动联络', opening: '提醒一下，您报名的“沉默三分钟挑战”今晚开始。回复任何内容都会被视为提前热身。' },
  { kind: 'mystery', id: 'old_number', name: '未知号码', opening: '如果这是你刚办的号码，请不要删除上一任机主留在周五晚上的那条提醒。有人还在等它。' },
  { kind: 'mystery', id: 'one_minute', name: '无归属号码', opening: '我每天只能在这个时间收到一分钟信号。先别问我是谁，告诉我今天是几号。' }
] as const

const allowedScenario = (settings: SmsSettings, kind: typeof strangerScenarios[number]['kind']) => kind === 'daily'
  ? settings.strangerKinds.daily : kind === 'wrong_number' ? settings.strangerKinds.wrongNumber : kind === 'comedy' ? settings.strangerKinds.comedy : settings.strangerKinds.mystery

export const receiveRandomStrangerSms = (accountId: string) => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled || !settings.strangerEnabled) return { ok: false as const, reason: 'disabled' as const }
  if (settings.strangerDailyDate !== today()) { settings.strangerDailyDate = today(); settings.strangerDailyCount = 0 }
  if (settings.strangerDailyCount >= settings.strangerDailyLimit) return { ok: false as const, reason: 'daily_limit' as const }
  const candidates = strangerScenarios.filter(item => allowedScenario(settings, item.kind))
  if (!candidates.length) return { ok: false as const, reason: 'no_kind' as const }
  const existing = loadSmsThreads(accountId); const unused = candidates.filter(item => !existing.some(thread => thread.narrative?.scenarioId === item.id && !thread.narrative.ended))
  const pool = unused.length ? unused : candidates; const scenario = pool[(Date.now() + settings.strangerDailyCount * 7) % pool.length]
  const number = `171${String(Math.abs(Date.now() % 100000000)).padStart(8, '0')}`
  const thread = createSmsThread(accountId, {
    id: `stranger:${scenario.id}:${Date.now()}`, name: scenario.name, number, avatarType: 'text', avatarText: '?', category: 'stranger', participantType: 'stranger', allowReply: true,
    narrative: { kind: scenario.kind, scenarioId: scenario.id, stage: 0, revealed: false, ended: false, nextAvailableAt: 0 }
  })
  receiveSmsMessage(accountId, thread.id, scenario.opening, { source: `stranger:${scenario.id}`, generated: true })
  settings.strangerDailyCount++; saveSmsSettings(accountId, settings)
  return { ok: true as const, thread: findSmsThread(accountId, thread.id)! }
}

const prankOpenings = [
  () => '你好，有人让我确认一件事：你是不是无论收到多离谱的短信都会认真回复？委托人坚持不让我说名字。',
  (planner: string) => `打扰一下，我这里有一份写着你名字的“神秘物品”要交接。${planner ? '委托人说你看到这句话应该会有反应。' : '但委托人没留下真实姓名。'}`,
  () => '你好，请问你之前是不是报名了“陌生人观察计划”？如果没有，那可能有人替你报了。'
]

export const startPrankSms = (accountId: string, plannerName: string, executorName = '临时联络人') => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled || !settings.prankEnabled || !settings.prankAllowFriends) return { ok: false as const, reason: 'disabled' as const }
  const number = `172${String(Math.abs((Date.now() * 17) % 100000000)).padStart(8, '0')}`
  const thread = createSmsThread(accountId, {
    id: `prank:${Date.now()}`, name: '陌生号码', number, avatarType: 'text', avatarText: '?', category: 'stranger', participantType: 'stranger', allowReply: true,
    narrative: { kind: 'prank', scenarioId: 'friend_commission', stage: 0, plannerName: safeText(plannerName, 40), executorName: safeText(executorName, 40), revealed: false, ended: false, nextAvailableAt: 0 }
  })
  receiveSmsMessage(accountId, thread.id, prankOpenings[Date.now() % prankOpenings.length](plannerName), { source: 'prank', generated: true })
  return { ok: true as const, thread: findSmsThread(accountId, thread.id)! }
}

const strangerReplies: Record<string, string[]> = {
  parcel: ['那我再核对一下，可能是寄件人写错了号码。谢谢你回复。', '明白了，我联系寄件人确认，不会再打扰你。'],
  cat: ['它很亲人，应该不是第一次来。我先给它留点水。', '好，我再问问附近店员。谢谢你没有直接忽略。'],
  classmate: ['等等，你不是我以为的那个人？那我可能把最后两位记反了。', '抱歉，看来真发错了。希望没打扰到你。'],
  flowers: ['原来号码也填错了，我会联系下单人核对。先不要担心，费用和你无关。', '好的，我已经备注号码有误，不会继续配送。'],
  duck: ['看来我真的找错人了。那只鸭子的主人可能还完全不知道它今天做了什么。', '谢谢你。至少现在我知道它不是你的麻烦。'],
  contest: ['你回复了，所以按规则已经完成热身。开玩笑的，我大概拿到了错误的报名号码。', '放心，没有报名费，也没有真的比赛。祝你今晚安静。'],
  old_number: ['你不是上一任机主。明白了，我会停止发送。那条提醒与你无关。', '谢谢你说明情况。请把这段对话当成一次号码交接失误。'],
  one_minute: ['日期对得上。信号要断了，明天这个时间我会再试一次。', '我知道这听起来很奇怪。如果你不想继续，拉黑这个号码就好。']
}

export const continueNarrativeSms = (accountId: string, threadId: string) => {
  const settings = loadSmsSettings(accountId); const threads = loadSmsThreads(accountId); const thread = threads.find(item => item.id === threadId); const narrative = thread?.narrative
  if (!thread || !narrative || narrative.ended || thread.blocked) return null
  narrative.stage++; let reply = ''
  if (narrative.kind === 'prank') {
    if (narrative.stage >= settings.prankMaxTurns) {
      narrative.ended = true; narrative.revealed = settings.prankRevealAtEnd
      reply = settings.prankRevealAtEnd ? `好吧，整蛊到这里结束。是${narrative.plannerName || '你的一位朋友'}拜托我来的，没有真实订单，也不需要你提供任何信息。` : '委托要求到这里就收手。没有真实订单，也不需要你提供任何信息。之后不会再联系。'
    } else if (narrative.stage === 1) reply = '我不能直接说委托人是谁，但可以提示：对方认识你，而且正在等你的反应。'
    else if (narrative.stage === 2) reply = '你可以猜，也可以现在叫停。只要你说“不继续”，这个号码就不会再发。'
    else reply = '委托人刚刚让我别演得太过分。看来你已经离答案不远了。'
  } else {
    const replies = strangerReplies[narrative.scenarioId] || ['抱歉，看来确实是我弄错号码了。谢谢你回复。']
    reply = replies[Math.min(narrative.stage - 1, replies.length - 1)]
    if (narrative.stage >= replies.length) narrative.ended = true
  }
  thread.updatedAt = Date.now(); thread.unread = true
  thread.messages.push(normalizeMessage({ type: 'receive', text: reply, status: 'delivered', actualActor: 'contact', source: narrative.kind, generated: true }))
  saveSmsThreads(accountId, threads); return reply
}

export const stopNarrativeSms = (accountId: string, threadId: string) => {
  const threads = loadSmsThreads(accountId); const thread = threads.find(item => item.id === threadId)
  if (!thread?.narrative) return false
  thread.narrative.ended = true; thread.narrative.revealed = thread.narrative.kind === 'prank' && loadSmsSettings(accountId).prankRevealAtEnd
  thread.messages.push(normalizeMessage({ type: 'receive', text: thread.narrative.revealed
    ? `整蛊已经结束。策划者是${thread.narrative.plannerName || '你的一位朋友'}，这个号码不会继续联系。`
    : '互动已经结束，这个号码不会继续联系。', status: 'delivered', actualActor: 'system', source: 'narrative-stop', generated: true }))
  thread.updatedAt = Date.now(); thread.unread = true; saveSmsThreads(accountId, threads); return true
}

export const appendWalletSms = (accountId: string, input: { text: string; relatedId: string; createdAt?: number; source?: 'wallet' | 'moments' }) => {
  const settings = loadSmsSettings(accountId)
  const source = input.source || 'wallet'
  if (!settings.enabled || !settings.sourceToggles.wallet || (source === 'moments' && !settings.sourceToggles.moments)) return false
  const threads = loadSmsThreads(accountId); let thread = threads.find(item => item.id === 'wallet-service')
  if (!thread) {
    thread = normalizeThread({ id: 'wallet-service', name: '钱包服务', avatarType: 'icon', avatarIcon: 'bank', avatarText: '', number: '95588', unread: false, messages: [], category: 'transaction', participantType: 'service', allowReply: false })
    threads.unshift(thread)
  }
  if (thread.messages.some(message => message.relatedId === input.relatedId)) return false
  thread.messages.push(normalizeMessage({ id: uid('sms'), type: 'receive', createdAt: input.createdAt || Date.now(), text: input.text, relatedId: input.relatedId, status: 'delivered', actualActor: 'service', source }))
  const message = thread.messages.at(-1)!
  thread.unread = true; thread.updatedAt = input.createdAt || Date.now(); saveSmsThreads(accountId, threads); requestSmsNotification(settings, thread, message); return true
}

export const appendServiceSms = (accountId: string, input: { source: keyof SmsSettings['sourceToggles']; threadId: string; name: string; number: string; text: string; relatedId: string; category?: SmsThreadCategory; createdAt?: number }) => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled || !settings.sourceToggles[input.source]) return false
  let thread = findSmsThread(accountId, input.threadId)
  if (!thread) thread = createSmsThread(accountId, { id: input.threadId, name: input.name, number: input.number, avatarType: 'text', avatarText: input.name.slice(0, 1), category: input.category || 'service', participantType: 'service', allowReply: false })
  return Boolean(receiveSmsMessage(accountId, thread.id, input.text, { relatedId: input.relatedId, source: input.source, actualActor: 'service' }))
}

export const buildSmsChatContext = (accountId: string, characterId: string, characterName = '') => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled || !settings.allowSmsAffectChat) return ''
  const threads = loadSmsThreads(accountId)
  const sections: string[] = []
  const direct = threads.find(thread => thread.id === `character:${characterId}` || thread.linkedCharacterId === characterId)
  if (direct && (settings.allowUserPhoneAffectChat || settings.allowCharacterPhoneAffectChat)) {
    const messages = direct.messages.filter(message => message.status !== 'draft' && message.status !== 'scheduled' && (
      (message.type === 'send' && settings.allowUserPhoneAffectChat) ||
      (message.type === 'receive' && settings.allowCharacterPhoneAffectChat)
    )).slice(-8)
    if (messages.length) sections.push(`你与用户在短信中的近期交流：\n${messages.map(message => `${message.type === 'send' ? '用户' : characterName || direct.name}：${safeText(message.text, 500)}`).join('\n')}`)
  }
  if (settings.allowFinanceAffectChat) {
    const finance = threads.find(thread => thread.id === 'wallet-service')?.messages.filter(message => message.type === 'receive').slice(-3) || []
    if (finance.length) sections.push(`用户允许你在当前聊天中知晓的近期资金短信：\n${finance.map(message => `- ${safeText(message.text, 500)}`).join('\n')}`)
  }
  if (settings.allowStrangerAffectChat) {
    const strangers = threads.filter(thread => thread.participantType === 'stranger' && thread.narrative?.kind !== 'prank').sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 2)
    const lines = strangers.flatMap(thread => thread.messages.slice(-2).map(message => `${thread.name}：${safeText(message.text, 400)}`))
    if (lines.length) sections.push(`用户允许你知晓的陌生号码短信：\n${lines.join('\n')}`)
  }
  if (settings.allowPrankAffectChat) {
    const normalizedName = characterName.trim().toLowerCase()
    const pranks = threads.filter(thread => thread.narrative?.kind === 'prank' && (!normalizedName || thread.narrative.plannerName?.trim().toLowerCase() === normalizedName)).sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0)).slice(0, 2)
    const lines = pranks.flatMap(thread => thread.messages.slice(-3).map(message => `${message.type === 'send' ? '用户' : thread.narrative?.executorName || '临时联络人'}：${safeText(message.text, 400)}`))
    if (lines.length) sections.push(`用户允许你知晓的整蛊短信进展：\n${lines.join('\n')}`)
  }
  return sections.length ? `\n\n【用户明确开启的短信互通】\n${sections.join('\n\n')}\n只将这些短信作为已发生的事实自然理解，不要声称读取了未授权内容，也不要为了展示功能而主动提起。` : ''
}
