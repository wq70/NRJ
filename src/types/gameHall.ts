/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type GameHallView = 'home' | 'room' | 'play' | 'records' | 'settings'
export type GameHallGameId = 'truth-dare' | 'would-you-rather' | 'never-have-i-ever' | 'two-truths' | 'undercover' | 'twenty-one'
export type GameHallParticipantKind = 'user' | 'character' | 'ai-stranger'
export type GameHallSessionStatus = 'room' | 'playing' | 'finished'

export interface GameHallGameDefinition {
  id: GameHallGameId
  name: string
  shortName: string
  icon: string
  description: string
  category: '破冰' | '默契' | '推理' | '卡牌'
  minPlayers: number
  maxPlayers: number
  duration: string
  difficulty: '轻松' | '适中'
  supportsVoice: boolean
  hasPrivateInfo: boolean
  accent: string
}

export interface GameHallParticipant {
  id: string
  kind: GameHallParticipantKind
  sourceId?: string
  chatId?: string | number
  name: string
  avatarUrl: string
  avatarText: string
  persona: string
  socialId: string
  signature: string
  isFriend: boolean
  score: number
  ready: boolean
}

export interface GameHallMessage {
  id: string
  senderId: string
  senderName: string
  kind: 'speech' | 'action' | 'system'
  content: string
  createdAt: number
}

export interface GameHallCardState {
  prompt: string
  optionA?: string
  optionB?: string
  truth?: string
  challenge?: string
}

export interface UndercoverState {
  commonWord: string
  undercoverWord: string
  undercoverIds: string[]
  clues: Record<string, string>
  votes: Record<string, string>
  eliminatedIds: string[]
  round: number
  stage: 'clue' | 'vote' | 'result'
}

export interface TwentyOneCard { suit: string; rank: string; value: number }
export interface TwentyOneState {
  deck: TwentyOneCard[]
  hands: Record<string, TwentyOneCard[]>
  stoodIds: string[]
  bustedIds: string[]
  activeIndex: number
}

export interface GameHallSession {
  id: string
  accountId: string
  gameId: GameHallGameId
  status: GameHallSessionStatus
  participants: GameHallParticipant[]
  createdAt: number
  startedAt?: number
  endedAt?: number
  turnIndex: number
  round: number
  currentCard?: GameHallCardState
  messages: GameHallMessage[]
  skippedCount: number
  completedTurns: number
  summary: string
  highlights: string[]
  winners: string[]
  chatBridgeApproved: boolean
  undercover?: UndercoverState
  twentyOne?: TwentyOneState
}

export interface GameHallChatBridgeSettings {
  enabled: boolean
  gameReadsCharacterPersona: boolean
  gameReadsRecentChat: boolean
  chatReadsGameSummary: boolean
  chatReadsResults: boolean
  chatReadsHighlights: boolean
  chatReadsRoomDialogue: boolean
}

export interface GameHallSettings {
  reduceMotion: boolean
  soundEnabled: boolean
  confirmBeforeSkip: boolean
  keepRecords: boolean
  allowAiFriendConversion: boolean
  chatBridge: GameHallChatBridgeSettings
}

export interface GameHallSnapshot {
  version: 1
  settings: GameHallSettings
  activeSession: GameHallSession | null
  records: GameHallSession[]
  favoriteGameIds: GameHallGameId[]
  updatedAt: number
}

export interface GameHallRoomDraft {
  gameId: GameHallGameId
  selectedCharacterIds: string[]
  strangerCount: number
}

export const createDefaultGameHallSettings = (): GameHallSettings => ({
  reduceMotion: false,
  soundEnabled: false,
  confirmBeforeSkip: true,
  keepRecords: true,
  allowAiFriendConversion: false,
  chatBridge: {
    enabled: false,
    gameReadsCharacterPersona: false,
    gameReadsRecentChat: false,
    chatReadsGameSummary: false,
    chatReadsResults: false,
    chatReadsHighlights: false,
    chatReadsRoomDialogue: false
  }
})

export const createDefaultGameHallSnapshot = (): GameHallSnapshot => ({
  version: 1,
  settings: createDefaultGameHallSettings(),
  activeSession: null,
  records: [],
  favoriteGameIds: [],
  updatedAt: Date.now()
})
