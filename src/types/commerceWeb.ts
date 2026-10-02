import type { CommercePage, CommercePlatform } from './commerce'

export type CommercePermission = 'observe' | 'select' | 'cart'
export interface CommerceProduct {
  id: string; platform: CommercePlatform; url: string; title: string; imageUrl?: string
  priceCents?: number; specification: string; stock?: string; storeName: string
  source: 'page-observation' | 'official-api'; observedAt: number; priceKind: 'display' | 'checkout'; quantity: number
}
export interface CommerceCandidate extends CommerceProduct {
  productId: string; characterId: string; note: string; wished: boolean; createdAt: number
}
export interface CommerceRealOrder {
  id: string; platform: CommercePlatform; orderNumber: string; source: 'page-observation' | 'official-api'
  status: string; paymentStatus: 'unknown' | 'unpaid' | 'paid' | 'refunded'; url: string; observedAt: number
}
export interface CommerceWebPage extends CommercePage { product?: CommerceProduct }
export interface CommerceWebSession {
  id: string; platform: CommercePlatform; url: string; permission: CommercePermission; remember: boolean
  notice: string; width: number; height: number; connection: 'browser'; orderVerification: 'page-observation'
  dialog?: { type: string; message: string }
}
export interface CommerceServiceUser { id: string; name: string }
export interface CommerceActionResult { ok: boolean; message: string; verified?: boolean }
