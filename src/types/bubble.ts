/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type BubbleView = 'home' | 'publish' | 'inbox' | 'fans' | 'profile'
export type BubblePostKind = 'text' | 'photo' | 'video' | 'voice' | 'story' | 'poll' | 'ask' | 'live'
export type BubblePostStatus = 'draft' | 'scheduled' | 'published'
export type BubbleFanArchetype = 'longtime' | 'newcomer' | 'career' | 'romance' | 'parental' | 'data' | 'quiet' | 'meme' | 'international' | 'station'

export interface BubbleCreatorProfile {
  stageName: string
  handle: string
  bio: string
  fandomName: string
  fanNickname: string
  accent: string
  avatarText: string
  subscriptionLabel: string
  openedAt: number
}

export interface BubblePost {
  id: string
  kind: BubblePostKind
  content: string
  createdAt: number
  publishAt: number
  status: BubblePostStatus
  mediaAssetId: string
  mediaName: string
  mediaMimeType: string
  pollOptions: string[]
  replyCount: number
  heartCount: number
  readCount: number
  subscriberDelta: number
}

export interface BubbleFan {
  id: string
  name: string
  avatarText: string
  archetype: BubbleFanArchetype
  locale: string
  joinedAt: number
  loyalty: number
  activity: number
  messageCount: number
  lastActiveAt: number
  note: string
  isCharacter: boolean
  characterId: string
  secretIdentity: boolean
  special: boolean
  muted: boolean
}

export interface BubbleFanReply {
  id: string
  postId: string
  fanId: string
  content: string
  createdAt: number
  read: boolean
  liked: boolean
  pinned: boolean
  hidden: boolean
  translatedContent: string
}

export interface BubbleFanLetter {
  id: string
  fanId: string
  title: string
  content: string
  createdAt: number
  read: boolean
  liked: boolean
}

export interface BubbleStudioSettings {
  allowCharacterSubscribers: boolean
  chatBridgeEnabled: boolean
  sharePublishedPostsToChat: boolean
  shareFanFeedbackToChat: boolean
  shareCharacterSubscriptionEventsToChat: boolean
  autoTranslate: boolean
  gentleModeration: boolean
  reducedMotion: boolean
  replyDensity: 'quiet' | 'balanced' | 'busy'
}

export interface BubbleStudioSnapshot {
  schemaVersion: 1
  profile: BubbleCreatorProfile
  posts: BubblePost[]
  fans: BubbleFan[]
  replies: BubbleFanReply[]
  letters: BubbleFanLetter[]
  settings: BubbleStudioSettings
  lastOpenedAt: number
  createdAt: number
  updatedAt: number
}

export interface BubblePublishInput {
  kind: BubblePostKind
  content: string
  publishAt?: number
  mediaAssetId?: string
  mediaName?: string
  mediaMimeType?: string
  pollOptions?: string[]
}

export interface BubbleCharacterCandidate {
  id: string
  name: string
  avatarText?: string
}
