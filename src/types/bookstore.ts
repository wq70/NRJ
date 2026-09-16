/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type BookStoreWorkKind = 'original' | 'fandom'
export type BookStoreWorkStatus = 'draft' | 'serializing' | 'completed' | 'paused'
export type BookStoreRating = 'general' | 'teen' | 'mature' | 'explicit' | 'unrated'
export type BookStoreChapterStatus = 'draft' | 'published'
export type BookStoreJobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type BookStoreJobKind = 'outline' | 'chapter' | 'review' | 'comments'
export type BookStoreImportFormat = 'txt' | 'markdown' | 'json' | 'html' | 'docx' | 'epub' | 'pdf' | 'fb2' | 'mobi' | 'azw3' | 'cbz' | 'archive' | 'web'
export type BookStoreReadStatus = 'unread' | 'reading' | 'finished'
export type BookStoreAnnotationKind = 'bookmark' | 'highlight' | 'note'

export interface BookStoreChapter {
  id: string
  title: string
  content: string
  summary: string
  status: BookStoreChapterStatus
  order: number
  wordCount: number
  createdAt: number
  updatedAt: number
  publishedAt?: number
  images?: string[]
  sourceUrl?: string
}

export interface BookStoreLibraryBook {
  id: string
  title: string
  author: string
  summary: string
  cover: string
  coverColor: string
  category: string
  tags: string[]
  language: string
  format: BookStoreImportFormat
  origin: 'local' | 'url' | 'online'
  sourceName: string
  sourceId?: string
  sourceUrl?: string
  fileName?: string
  size: number
  chapters: BookStoreChapter[]
  addedAt: number
  updatedAt: number
}

export interface BookStoreReadingState {
  bookId: string
  chapterId?: string
  progressOffset: number
  progressPercent: number
  status: BookStoreReadStatus
  addedAt: number
  updatedAt: number
  lastReadAt?: number
}

export interface BookStoreAnnotation {
  id: string
  targetKind: 'work' | 'library'
  targetId: string
  chapterId: string
  kind: BookStoreAnnotationKind
  start: number
  end: number
  quote: string
  prefix: string
  suffix: string
  color: 'yellow' | 'green' | 'blue' | 'pink'
  note: string
  createdAt: number
  updatedAt: number
}

export interface BookStoreWork {
  id: string
  title: string
  authorId: string
  authorName: string
  kind: BookStoreWorkKind
  status: BookStoreWorkStatus
  summary: string
  outline: string
  cover: string
  coverColor: string
  category: string
  tags: string[]
  fandom?: string
  characters: string[]
  relationships: string[]
  warnings: string[]
  rating: BookStoreRating
  aiDisclosure: 'none' | 'assisted' | 'generated'
  permission: { translation: boolean; podfic: boolean; illustration: boolean; continuation: boolean }
  chapters: BookStoreChapter[]
  views: number
  effectiveReads: number
  shelfCount: number
  followerGain: number
  commentCount: number
  score: number
  featured: boolean
  signed: boolean
  createdAt: number
  updatedAt: number
}

export interface BookStoreAuthor {
  id: string
  name: string
  bio: string
  avatarText: string
  followers: number
  reputation: number
  level: number
  signed: boolean
  badges: string[]
  createdAt: number
}

export interface BookStoreShelfEntry {
  workId: string
  progressChapterId?: string
  progressOffset: number
  addedAt: number
  updatedAt: number
  lastReadAt?: number
}

export interface BookStoreReview {
  id: string
  workId: string
  authorName: string
  content: string
  rating: number
  likes: number
  createdAt: number
  source: 'user' | 'simulation' | 'ai'
}

export interface BookStoreUsageRecord {
  id: string
  jobId?: string
  workId?: string
  kind: BookStoreJobKind
  estimatedInputTokens: number
  estimatedOutputTokens: number
  actualTokens?: number
  status: 'estimated' | 'success' | 'failed'
  createdAt: number
}

export interface BookStoreGenerationJob {
  id: string
  kind: BookStoreJobKind
  workId: string
  chapterId?: string
  status: BookStoreJobStatus
  progress: number
  prompt: string
  targetLength: number
  completedChunks: number
  totalChunks: number
  error?: string
  createdAt: number
  updatedAt: number
}

export interface BookStoreSettings {
  dailyTokenBudget: number
  perTaskTokenBudget: number
  allowFallback: boolean
  retryLimit: number
  autoReview: boolean
  readerTheme: 'paper' | 'white' | 'green' | 'dark'
  fontSize: number
  lineHeight: number
  pageMode: 'scroll' | 'page'
  fontFamily: 'serif' | 'sans' | 'system'
  textAlign: 'justify' | 'left'
  paragraphIndent: boolean
  paragraphSpacing: number
  contentWidth: number
  autoMarkRead: boolean
  keepScreenAwake: boolean
  ttsRate: number
  ttsPitch: number
}

export interface BookStoreSnapshot {
  version: 2
  initialized: boolean
  currentAuthorId: string
  authors: BookStoreAuthor[]
  works: BookStoreWork[]
  shelf: BookStoreShelfEntry[]
  followedAuthorIds: string[]
  reviews: BookStoreReview[]
  jobs: BookStoreGenerationJob[]
  usage: BookStoreUsageRecord[]
  settings: BookStoreSettings
  library: BookStoreLibraryBook[]
  readingStates: BookStoreReadingState[]
  annotations: BookStoreAnnotation[]
  lastSimulatedAt: number
  updatedAt: number
}
