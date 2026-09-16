/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import QRCode from 'qrcode'

export type MomentPaymentOverride = 'inherit' | 'enabled' | 'disabled'

export interface MomentPaymentSettings {
  enabled: boolean
  smsNotification: boolean
  inAppNotification: boolean
}

export interface MomentReceiptCode {
  id: string
  accountId: string
  ownerName: string
  paymentHandle: string
  amountCents?: number
  remark: string
  createdAt: number
  active: boolean
}

export interface MomentReceiptDraft {
  code: MomentReceiptCode
  posterDataUrl: string
}

const SETTINGS_PREFIX = 'clingy_moment_payment_settings_v1_'
const CODES_PREFIX = 'clingy_moment_receipt_codes_v1_'
const SHARE_PREFIX = 'clingy_moment_receipt_share_v1_'

const key = (prefix: string, accountId: string) => `${prefix}${accountId || 'guest'}`

export const defaultMomentPaymentSettings = (): MomentPaymentSettings => ({
  enabled: false,
  smsNotification: true,
  inAppNotification: true
})

export const loadMomentPaymentSettings = (accountId: string): MomentPaymentSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(key(SETTINGS_PREFIX, accountId)) || '{}')
    return { ...defaultMomentPaymentSettings(), ...(saved || {}) }
  } catch {
    return defaultMomentPaymentSettings()
  }
}

export const saveMomentPaymentSettings = (accountId: string, settings: MomentPaymentSettings) => {
  localStorage.setItem(key(SETTINGS_PREFIX, accountId), JSON.stringify(settings))
  window.dispatchEvent(new CustomEvent('clingy:moment-payment-settings-updated', { detail: { accountId } }))
}

export const getCharacterMomentPaymentOverride = (chat: any): MomentPaymentOverride => {
  const value = chat?.momentPaymentOverride
  return value === 'enabled' || value === 'disabled' ? value : 'inherit'
}

export const isMomentPaymentEnabledForCharacter = (accountId: string, chat: any) => {
  const override = getCharacterMomentPaymentOverride(chat)
  if (override === 'enabled') return true
  if (override === 'disabled') return false
  return loadMomentPaymentSettings(accountId).enabled
}

export const loadMomentReceiptCodes = (accountId: string): MomentReceiptCode[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key(CODES_PREFIX, accountId)) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const createMomentReceiptCode = (input: Omit<MomentReceiptCode, 'id' | 'createdAt' | 'active'>) => {
  const code: MomentReceiptCode = {
    ...input,
    id: `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    active: true
  }
  const current = loadMomentReceiptCodes(input.accountId)
  localStorage.setItem(key(CODES_PREFIX, input.accountId), JSON.stringify([code, ...current].slice(0, 20)))
  return code
}

export const getActiveMomentReceiptCode = (accountId: string) => loadMomentReceiptCodes(accountId).find(item => item.active)

export const receiptPayload = (code: MomentReceiptCode) => JSON.stringify({
  type: 'nianrenji-moment-receipt',
  version: 1,
  receiptId: code.id,
  paymentHandle: code.paymentHandle,
  amountCents: code.amountCents || 0,
  remark: code.remark
})

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
  ctx.fill()
}

export const createMomentReceiptPoster = async (code: MomentReceiptCode) => {
  const qr = await QRCode.toDataURL(receiptPayload(code), { width: 640, margin: 3, errorCorrectionLevel: 'H', color: { dark: '#111111', light: '#ffffff' } })
  const canvas = document.createElement('canvas')
  canvas.width = 900
  canvas.height = 1160
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法生成收款码图片')
  ctx.fillStyle = '#f3f4f6'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, 55, 55, 790, 1050, 36)
  ctx.fillStyle = '#171717'
  ctx.textAlign = 'center'
  ctx.font = '600 42px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  ctx.fillText(code.ownerName || '我', 450, 145)
  ctx.fillStyle = '#777777'
  ctx.font = '28px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  ctx.fillText('扫一扫，向我转账', 450, 195)
  const image = new Image()
  image.src = qr
  await image.decode()
  ctx.drawImage(image, 150, 245, 600, 600)
  if (code.amountCents) {
    ctx.fillStyle = '#171717'
    ctx.font = '600 52px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    ctx.fillText(`¥ ${(code.amountCents / 100).toFixed(2)}`, 450, 925)
  }
  if (code.remark) {
    ctx.fillStyle = '#777777'
    ctx.font = '28px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
    const text = code.remark.length > 24 ? `${code.remark.slice(0, 24)}…` : code.remark
    ctx.fillText(text, 450, code.amountCents ? 980 : 925)
  }
  ctx.fillStyle = '#aaaaaa'
  ctx.font = '22px -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif'
  ctx.fillText('虚拟钱包收款码', 450, 1040)
  return canvas.toDataURL('image/png')
}

export const saveReceiptPoster = async (dataUrl: string, filename = '我的收款码.png') => {
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const savePendingReceiptShare = (accountId: string, draft: MomentReceiptDraft) => {
  localStorage.setItem(key(SHARE_PREFIX, accountId), JSON.stringify(draft))
}

export const consumePendingReceiptShare = (accountId: string): MomentReceiptDraft | null => {
  const storageKey = key(SHARE_PREFIX, accountId)
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    localStorage.removeItem(storageKey)
    return JSON.parse(raw)
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
}
