/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export type LiveRoomMode = 'character' | 'voice' | 'story' | 'premiere' | 'camera' | 'jitsi'
export type LiveRoomVisibility = 'private' | 'invite' | 'public'
export type LiveEventType = 'system' | 'viewer' | 'message' | 'host' | 'reaction' | 'poll' | 'scene' | 'recording'

export interface LiveFeatureSwitches {
  aiHost: boolean
  aiAutoReply: boolean
  tts: boolean
  virtualAudience: boolean
  camera: boolean
  microphone: boolean
  recording: boolean
  jitsi: boolean
  imageBridge: boolean
  videoBridge: boolean
  voiceBridge: boolean
  musicBridge: boolean
  chatBridge: boolean
  forumBridge: boolean
  coupleBridge: boolean
  walletBridge: boolean
  summary: boolean
  writeSummaryToChat: boolean
}

export interface LiveSettings {
  enabled: boolean
  switches: LiveFeatureSwitches
  jitsiDomain: string
  autoDeleteDays: 0 | 1 | 7 | 30
  maxContextEvents: number
  maxVirtualMessages: number
  externalLinks: Array<{ id: string; name: string; url: string }>
}

export interface LiveScene {
  id: string
  name: string
  color: string
  imageAssetId?: string
  mediaAssetId?: string
  mediaMimeType?: string
}

export interface LiveChannel {
  id: string
  title: string
  mode: LiveRoomMode
  visibility: LiveRoomVisibility
  characterId: string
  description: string
  createdAt: number
  updatedAt: number
  scenes: LiveScene[]
  activeSceneId: string
}

export interface LiveEvent {
  id: string
  sessionId: string
  type: LiveEventType
  actorId: string
  actorName: string
  content: string
  createdAt: number
  virtual?: boolean
  aiReadable: boolean
}

export interface LiveRecording {
  id: string
  sessionId: string
  assetId: string
  mimeType: string
  size: number
  createdAt: number
  durationSeconds: number
}

export interface LiveSession {
  id: string
  channelId: string
  title: string
  mode: LiveRoomMode
  visibility: LiveRoomVisibility
  characterId: string
  status: 'live' | 'ended'
  startedAt: number
  endedAt?: number
  summary?: string
  events: LiveEvent[]
  recordings: LiveRecording[]
  jitsiRoomName?: string
}

export interface LiveSnapshot {
  schemaVersion: 1
  settings: LiveSettings
  channels: LiveChannel[]
  sessions: LiveSession[]
  activeSessionId: string
}
