/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type DeliveryKind = 'text' | 'link' | 'image' | 'video' | 'audio' | 'book' | 'bubble' | 'worldbook' | 'archive' | 'file' | 'mixed'
export type DeliveryDirection = 'draft' | 'sent' | 'received' | 'saved'

export interface DeliveryFileMeta {
  id: string
  name: string
  mimeType: string
  size: number
  lastModified: number
  checksum?: string
}

export interface DeliveryItem {
  id: string
  schemaVersion: 1
  title: string
  note: string
  text: string
  url: string
  kind: DeliveryKind
  direction: DeliveryDirection
  source: 'local' | 'system-share' | 'package' | 'qr' | 'clipboard'
  files: DeliveryFileMeta[]
  createdAt: number
  updatedAt: number
  expiresAt?: number
  openedAt?: number
}

export interface DeliverySettings {
  receivingEnabled: boolean
  receivingUntil: number | null
  requireConfirmation: boolean
  chatIntegration: {
    enabled: boolean
    allowCharacterRead: boolean
    allowMemory: boolean
  }
}

export interface DeliveryDraftInput {
  title?: string
  note?: string
  text?: string
  url?: string
  files?: File[]
  direction?: DeliveryDirection
  source?: DeliveryItem['source']
  expiresAt?: number
}
