/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type WatchTogetherKind = 'novel' | 'video' | 'comic' | 'audio'
export type WatchTogetherOrigin = 'local' | 'url' | 'online'
export type WatchTogetherAccess = 'direct' | 'embed' | 'external'

export interface WatchTogetherChapter {
  id: string
  title: string
  order: number
  text?: string
  blobKeys?: string[]
  pageUrls?: string[]
  duration?: number
}

export interface WatchTogetherItem {
  id: string
  kind: WatchTogetherKind
  title: string
  subtitle: string
  creator: string
  description: string
  cover: string
  origin: WatchTogetherOrigin
  sourceId: string
  sourceName: string
  sourceUrl: string
  access: WatchTogetherAccess
  mediaUrl: string
  mimeType: string
  fileName: string
  size: number
  chapters: WatchTogetherChapter[]
  tags: string[]
  addedAt: number
  updatedAt: number
}

export interface WatchTogetherProgress {
  itemId: string
  chapterId: string
  position: number
  percent: number
  updatedAt: number
}

export interface WatchTogetherMessage {
  id: string
  sender: 'user' | 'character' | 'system'
  content: string
  anchor: number
  createdAt: number
}

export interface WatchTogetherMemory {
  id: string
  characterId: string
  itemId: string
  kind: WatchTogetherKind
  title: string
  summary: string
  createdAt: number
}

export interface WatchTogetherSession {
  id: string
  itemId: string
  characterId: string
  characterName: string
  startedAt: number
  endedAt?: number
  messages: WatchTogetherMessage[]
}

export interface WatchTogetherSettings {
  enabled: boolean
  modules: Record<WatchTogetherKind, boolean>
  onlineSearch: boolean
  localImport: boolean
  saveProgress: boolean
  offlineCache: boolean
  companionEnabled: boolean
  characterCanSpeak: boolean
  eventDrivenReplies: boolean
  shareText: boolean
  shareSubtitles: boolean
  shareVisuals: boolean
  allowPlaybackControl: boolean
  saveRecords: boolean
  generateSummary: boolean
  writeMemory: boolean
  chatReadsMemory: boolean
  sessionReadsChat: boolean
}

export interface WatchTogetherState {
  version: 1
  initialized: boolean
  settings: WatchTogetherSettings
  items: WatchTogetherItem[]
  progress: WatchTogetherProgress[]
  memories: WatchTogetherMemory[]
  sessions: WatchTogetherSession[]
  updatedAt: number
}

export interface WatchTogetherSearchResult {
  id: string
  kind: WatchTogetherKind
  title: string
  subtitle: string
  creator: string
  description: string
  cover: string
  sourceId: string
  sourceName: string
  sourceUrl: string
  mediaUrl: string
  mimeType: string
  access: WatchTogetherAccess
  playable: boolean
  availability: string
  pageUrls?: string[]
}

export const defaultWatchTogetherSettings = (): WatchTogetherSettings => ({
  enabled: false,
  modules: { novel: false, video: false, comic: false, audio: false },
  onlineSearch: false,
  localImport: false,
  saveProgress: false,
  offlineCache: false,
  companionEnabled: false,
  characterCanSpeak: false,
  eventDrivenReplies: false,
  shareText: false,
  shareSubtitles: false,
  shareVisuals: false,
  allowPlaybackControl: false,
  saveRecords: false,
  generateSummary: false,
  writeMemory: false,
  chatReadsMemory: false,
  sessionReadsChat: false
})
