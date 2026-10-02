/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
export type DanmakuScene = 'chat' | 'offline' | 'game' | 'story' | 'live' | 'watch'
export type DanmakuStyle = 'romance' | 'comedy' | 'warm' | 'detective' | 'story'
export interface DanmakuSettings {
  enabled: boolean
  generation: 'manual' | 'auto' | 'local'
  display: 'strip' | 'scroll' | 'list'
  interaction: 'watch' | 'share' | 'program'
  style: DanmakuStyle
  instruction: string
  visible: boolean
  paused: boolean
  reduceMotion: boolean
  showNames: boolean
  count: number
  maxLength: number
  maxOnScreen: number
  speed: number
  fontSize: number
  opacity: number
  color: string
  cooldownSeconds: number
  everyTurns: number
  maxRequests: number
  maxInputChars: number
  retentionDays: number
  remember: boolean
  randomCast: boolean
  viewerIds: string[]
  blockedKinds: string[]
}
export interface DanmakuViewer {
  id: string
  name: string
  persona: string
  color: string
  activity: number
  blocked: boolean
}
export interface DanmakuEvent {
  id: string
  actor: string
  text: string
  kind: 'speech' | 'action' | 'scene' | 'result'
  options?: string[]
  outcome?: string
}
export interface DanmakuSource {
  scene: DanmakuScene
  sessionId: string
  branchId: string
  title: string
  events: DanmakuEvent[]
  triggerId: string
  ready: boolean
  busy: boolean
  shareAllowed?: boolean
  autoToken?: string
}
export interface DanmakuComment {
  id: string
  batchId: string
  eventId: string
  eventHash: string
  viewerId: string
  viewerName: string
  color: string
  text: string
  kind: 'reaction' | 'question' | 'analysis' | 'prediction' | 'vote'
  replyToId: string | null
  choice?: string
  outcome?: 'correct' | 'wrong'
  createdAt: number
  favorite: boolean
  pinned: boolean
  shared: boolean
  origin: 'ai' | 'local' | 'user'
  excerpt: string
  cacheKey?: string
}
export interface DanmakuSession {
  scene: DanmakuScene
  title: string
  settings: Partial<DanmakuSettings>
  comments: DanmakuComment[]
  batches?: Array<{ cacheKey: string; eventId: string; eventHash: string; createdAt: number }>
  requests: number
  lastRequestAt: number
  updatedAt: number
}
export interface DanmakuSnapshot {
  schemaVersion: 1
  defaults: DanmakuSettings
  scenes: Partial<Record<DanmakuScene, Partial<DanmakuSettings>>>
  viewers: DanmakuViewer[]
  sessions: Record<string, DanmakuSession>
}
export const danmakuSceneNames: Record<DanmakuScene, string> = { chat: '聊天', offline: '线下见面', game: '游戏', story: '文游', live: '直播', watch: '共赏' }
export const danmakuStyleNames: Record<DanmakuStyle, string> = { romance: '磕 CP / 恋综', comedy: '搞笑综艺', warm: '温柔陪伴', detective: '推理讨论', story: '剧情陪看' }
export const defaultDanmakuSettings = (): DanmakuSettings => ({
  enabled: false, generation: 'manual', display: 'strip', interaction: 'watch', style: 'comedy', instruction: '', visible: true, paused: false,
  reduceMotion: false, showNames: true, count: 4, maxLength: 30, maxOnScreen: 2, speed: 7, fontSize: 11, opacity: 0.9, color: '',
  cooldownSeconds: 20, everyTurns: 1, maxRequests: 30, maxInputChars: 4000, retentionDays: 30, remember: false, randomCast: false, viewerIds: [], blockedKinds: []
})
export const defaultDanmakuViewers = (): DanmakuViewer[] => [
  { id: 'romantic', name: '不磕会死星人', persona: '爱磕CP，关注嘴硬与行动的反差；尊重拒绝，不强行拉郎。', color: '#ad6478', activity: 3, blocked: false },
  { id: 'comic', name: '路过一只瓜', persona: '幽默接梗，短句吐槽，避免攻击和重复流行语。', color: '#99764c', activity: 3, blocked: false },
  { id: 'analyst', name: '细节观察员', persona: '根据公开内容分析，猜测时说清不确定，允许自己猜错。', color: '#607d96', activity: 2, blocked: false },
  { id: 'gentle', name: '晚风', persona: '温柔共情，沉重话题认真回应，不强行玩梗。', color: '#668577', activity: 2, blocked: false },
  { id: 'skeptic', name: '先别急', persona: '提供不同解读，理性但不扫兴，不为反对而反对。', color: '#88739c', activity: 1, blocked: false },
  { id: 'passer', name: '小满', persona: '偶尔发简短感叹和自然提问，不假装知道没看过的事情。', color: '#878078', activity: 1, blocked: false }
]
export const createDanmakuSnapshot = (): DanmakuSnapshot => ({ schemaVersion: 1, defaults: defaultDanmakuSettings(), scenes: {}, viewers: defaultDanmakuViewers(), sessions: {} })
