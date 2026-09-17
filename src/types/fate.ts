/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type FateView = 'today' | 'ask' | 'explore' | 'journal' | 'profile'
export type FateCategory = 'daily' | 'cards' | 'eastern' | 'astrology' | 'folk' | 'choice'
export type FateMethodKind = 'draw' | 'hexagram' | 'calendar' | 'bazi' | 'ziwei' | 'numerology' | 'zodiac' | 'choice'
export type FateTargetKind = 'self' | 'character' | 'relationship' | 'general'
export type FateGender = '男' | '女'

export interface FateMethod {
  id: string
  name: string
  shortName: string
  category: FateCategory
  kind: FateMethodKind
  glyph: string
  accent: string
  description: string
  questionHint: string
  tags: string[]
  drawCount?: number
}

export interface FateProfile {
  id: string
  name: string
  birthday: string
  birthTime: string
  gender: FateGender
  birthplace: string
  timezone: string
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface FateDrawItem {
  id: string
  name: string
  glyph: string
  position: string
  reversed?: boolean
  keywords: string[]
  meaning: string
  detail?: string
}

export interface FateReading {
  id: string
  methodId: string
  methodName: string
  methodKind: FateMethodKind
  question: string
  targetKind: FateTargetKind
  targetId?: string
  targetName?: string
  profileId?: string
  profileName?: string
  createdAt: number
  seed: string
  summary: string
  guidance: string
  caution: string
  items: FateDrawItem[]
  facts: Record<string, string | number | string[]>
  aiInterpretation?: string
  note?: string
  reflection?: 'matched' | 'partial' | 'different'
  favorite: boolean
  chatInfluence: boolean
  engineVersion: number
}

export interface FateSettings {
  allowReversed: boolean
  gentleLanguage: boolean
  saveHistory: boolean
  chatIntegrationEnabled: boolean
  includeReadingsInChatPrompt: boolean
  includeCharacterNameInAi: boolean
  includeCharacterPersona: boolean
  confirmBeforeAi: boolean
  reducedRitual: boolean
}

export interface FateSnapshot {
  version: 1
  profiles: FateProfile[]
  readings: FateReading[]
  settings: FateSettings
  favoriteMethodIds: string[]
  updatedAt: number
}

export interface CreateFateReadingInput {
  method: FateMethod
  question: string
  targetKind: FateTargetKind
  targetId?: string
  targetName?: string
  profile?: FateProfile | null
  allowReversed: boolean
  seed?: string
}
