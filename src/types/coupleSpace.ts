/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type CoupleSpaceStatus = 'pending' | 'active' | 'paused' | 'ended'
export type CoupleInviteDirection = 'user_to_character' | 'character_to_user'
export type CoupleInviteStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'

export type CoupleModuleKind =
  | 'exchange' | 'letter' | 'capsule' | 'quiz' | 'game' | 'story' | 'drawing'
  | 'scrapbook' | 'mood' | 'jar' | 'surprise' | 'coupon' | 'match' | 'plan'
  | 'checklist' | 'recipe' | 'travel' | 'room' | 'pet' | 'plant' | 'collection'
  | 'adventure' | 'boardgame' | 'ritual' | 'repair' | 'apology' | 'manual'
  | 'future' | 'memory'

export interface CoupleModuleDefinition {
  id: string
  name: string
  shortName: string
  icon: string
  group: 'exchange' | 'create' | 'play' | 'life' | 'nurture' | 'repair'
  kind: CoupleModuleKind
  description: string
  prompt: string
  actionLabel: string
  accent: string
}

export interface CoupleBridgeSettings {
  chatKnowsRelationship: boolean
  chatReadsMemories: boolean
  chatWritesMemories: boolean
  chatCanMentionActivities: boolean
  characterCanInviteFromChat: boolean
  characterCanEndRelationship: boolean
  writeLongTermMemory: boolean
  rememberAfterEnding: boolean
  tokenBudget: 0 | 100 | 300 | 600
}

export interface CoupleAutonomySettings {
  allowCharacterInvites: boolean
  allowCharacterInitiatedActivities: boolean
  allowCharacterLetters: boolean
  allowCharacterQuestions: boolean
  allowCharacterSurprises: boolean
  quietHoursEnabled: boolean
  quietStart: number
  quietEnd: number
}

export interface CouplePrivacySettings {
  sensitiveTopics: boolean
  adultTopics: boolean
  healthData: boolean
  moneyData: boolean
  locationData: boolean
  notifications: boolean
}

export interface CoupleInvite {
  id: string
  direction: CoupleInviteDirection
  status: CoupleInviteStatus
  message: string
  createdAt: number
  respondedAt?: number
  response?: string
}

export interface CoupleEntry {
  id: string
  moduleId: string
  title: string
  content: string
  secondaryContent?: string
  partnerContent?: string
  status: 'draft' | 'waiting' | 'revealed' | 'completed' | 'sealed' | 'archived'
  createdBy: 'user' | 'character' | 'both'
  createdAt: number
  updatedAt: number
  revealAt?: number
  memoryPermission: 'private' | 'space-only' | 'chat-allowed' | 'long-term'
  tags: string[]
  checklist?: Array<{ id: string; text: string; userDone: boolean; partnerDone: boolean }>
  options?: string[]
  userChoice?: string
  partnerChoice?: string
  mediaKey?: string
  meta?: Record<string, string | number | boolean>
}

export interface CoupleModuleStats {
  level: number
  progress: number
  energy: number
  name: string
  selectedItems: string[]
  lastActionAt?: number
}

export interface CoupleContextAudit {
  id: string
  createdAt: number
  kind: 'chat-read' | 'space-write' | 'memory-write'
  summary: string
  entryIds: string[]
}

export interface CoupleSpace {
  id: string
  accountId: string
  characterId: string
  chatId: string | number
  characterName: string
  characterAvatar?: string
  characterPersona?: string
  userNickname: string
  characterNickname: string
  title: string
  declaration: string
  anniversary: string
  createdAt: number
  updatedAt: number
  status: CoupleSpaceStatus
  pausedAt?: number
  endedAt?: number
  endingNote?: string
  theme: 'blush' | 'cream' | 'night' | 'sage' | 'lavender'
  invites: CoupleInvite[]
  entries: CoupleEntry[]
  enabledModules: Record<string, boolean>
  bridge: CoupleBridgeSettings
  autonomy: CoupleAutonomySettings
  privacy: CouplePrivacySettings
  moduleStats: Record<string, CoupleModuleStats>
  audits: CoupleContextAudit[]
}

export interface CoupleSpaceState {
  version: 1
  activeSpaceId: string
  spaces: CoupleSpace[]
}

