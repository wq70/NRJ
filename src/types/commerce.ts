export type CommercePlatform = 'meituan' | 'jd' | 'taobao' | 'pdd'
export interface CommerceTarget { id: string; label: string }
export interface CommercePage {
  url: string; title: string; text: string; token: string; capturedAt: number
  sensitive: boolean; targets: CommerceTarget[]
}
export interface CommerceMessage { role: 'user' | 'assistant'; content: string }
export interface CommerceRecord {
  id: string; platform: CommercePlatform; characterId: string; title: string
  url: string; text: string; capturedAt: number; source: 'page-observation'
}
export interface CommerceSession {
  platform: CommercePlatform; characterId: string; url: string
  messages: CommerceMessage[]; preferences: string; records: CommerceRecord[]
}
