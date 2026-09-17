/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type MallProductSource = 'story' | 'external' | 'custom'
export type MallPerspective = 'user' | 'together' | 'character'
export type MallCartOwner = 'user' | 'together' | `character:${string}`
export type MallOrderStatus = 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type MallExternalPurchaseStatus = 'saved' | 'considering' | 'purchased' | 'abandoned'

export interface MallProduct {
  id: string
  source: MallProductSource
  title: string
  subtitle: string
  description: string
  category: string
  emoji: string
  imageUrl?: string
  priceCents: number
  originalPriceCents?: number
  stock: number
  storeName: string
  tags: string[]
  platform?: string
  externalUrl?: string
  createdAt: number
  userCreated?: boolean
}

export interface MallCartItem {
  id: string
  productId: string
  owner: MallCartOwner
  quantity: number
  addedAt: number
}

export interface MallWishlistItem {
  id: string
  productId: string
  owner: MallCartOwner
  createdAt: number
}

export interface MallOrderItem {
  productId: string
  title: string
  emoji: string
  quantity: number
  unitPriceCents: number
}

export interface MallOrder {
  id: string
  source: 'story' | 'external'
  owner: MallCartOwner
  characterId?: string
  characterName?: string
  items: MallOrderItem[]
  totalCents: number
  status: MallOrderStatus | 'unverified'
  externalPurchaseStatus?: MallExternalPurchaseStatus
  platform?: string
  externalUrl?: string
  createdAt: number
  updatedAt: number
}

export interface MallChatPermissions {
  enabled: boolean
  allowProductShare: boolean
  includeRecentEvents: boolean
  allowMemory: boolean
}

export interface MallSettings {
  chat: MallChatPermissions
  characterPermissions: Record<string, MallChatPermissions>
  showBrowsingHistory: boolean
  confirmExternalJump: boolean
  contextEventLimit: number
}

export interface MallEvent {
  id: string
  type: 'product_shared' | 'story_order' | 'external_marked' | 'gift' | 'wishlist'
  title: string
  detail: string
  characterId?: string
  productId?: string
  orderId?: string
  chatEligible: boolean
  memoryEligible: boolean
  createdAt: number
}

export interface MallSnapshot {
  schemaVersion: 1
  accountId: string
  products: MallProduct[]
  cart: MallCartItem[]
  wishlist: MallWishlistItem[]
  orders: MallOrder[]
  events: MallEvent[]
  recentlyViewedProductIds: string[]
  settings: MallSettings
  updatedAt: number
}

export interface MallExternalPlatform {
  id: string
  name: string
  shortName: string
  homeUrl: string
  searchUrl: (keyword: string) => string
  domains: string[]
  accent: string
}
