import { Capacitor, registerPlugin } from '@capacitor/core'
import type { PluginListenerHandle } from '@capacitor/core'
import type { CommercePage, CommercePlatform, CommerceSession } from '../types/commerce'

export const commercePlatforms: Array<{ id: CommercePlatform; name: string; home: string; domains: string[] }> = [
  { id: 'meituan', name: '美团', home: 'https://h5.waimai.meituan.com/', domains: ['meituan.com', 'dianping.com', 'sankuai.com'] },
  { id: 'jd', name: '京东', home: 'https://m.jd.com/', domains: ['jd.com', 'jd.hk', '360buy.com', '3.cn'] },
  { id: 'taobao', name: '淘宝', home: 'https://m.taobao.com/', domains: ['taobao.com', 'tmall.com', 'alipay.com', 'tb.cn'] },
  { id: 'pdd', name: '拼多多', home: 'https://mobile.yangkeduo.com/', domains: ['yangkeduo.com', 'pinduoduo.com'] }
]
export const commercePlatformForUrl = (value: string) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return undefined
    return commercePlatforms.find(p => p.domains.some(d => url.hostname === d || url.hostname.endsWith(`.${d}`)))
  } catch { return undefined }
}
export const redactCommerceText = (value: string) => value
  .replace(/\b1[3-9]\d{9}\b/g, '[手机号]')
  .replace(/\b\d{15,19}\b/g, '[号码]')
  .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[邮箱]')
  .replace(/(?:收货地址|配送地址|收货人|联系人|详细地址|订单号)[：:\s]*[^\n]*/g, '[个人信息已隐藏]')
  .slice(0, 12000)
export const safeCommerceUrl = (value: string) => {
  try {
    const u = new URL(value)
    const safe = new URL(`${u.origin}${u.pathname}`)
    for (const key of ['id', 'itemId', 'sku', 'skuId', 'goods_id', 'goodsId', 'shop_id', 'shopId', 'poi_id']) {
      const item = u.searchParams.get(key)
      if (item && /^[\w-]{1,80}$/.test(item)) safe.searchParams.set(key, item)
    }
    return safe.href
  } catch { return '' }
}
const keyFor = (account: string, character: string, platform: CommercePlatform) =>
  `clingy_commerce_${encodeURIComponent(account)}_${encodeURIComponent(character || 'solo')}_${platform}`
export function loadCommerceSession(account: string, characterId: string, platform: CommercePlatform): CommerceSession {
  const empty: CommerceSession = { platform, characterId, url: '', messages: [], preferences: '', records: [] }
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(account, characterId, platform)) || 'null')
    if (!value || value.platform !== platform || value.characterId !== characterId) return empty
    return { ...empty, url: commercePlatformForUrl(value.url)?.id === platform ? value.url : '',
      preferences: String(value.preferences || '').slice(0, 1000),
      messages: Array.isArray(value.messages) ? value.messages.filter((m: any) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string').slice(-40) : [],
      records: Array.isArray(value.records) ? value.records.filter((r: any) => r?.source === 'page-observation' && r.platform === platform && r.characterId === characterId).slice(-30) : [] }
  } catch { return empty }
}
export function saveCommerceSession(account: string, session: CommerceSession) {
  // Session storage contains no browser credentials and no raw URL query tokens.
  localStorage.setItem(keyFor(account, session.characterId, session.platform), JSON.stringify({ ...session,
    url: /login|passport|signin|cashier|payment|checkout|\/pay(?:\/|\?|$)/i.test(session.url) ? '' : safeCommerceUrl(session.url),
    preferences: redactCommerceText(session.preferences), messages: session.messages.slice(-40).map(m => ({ ...m, content: redactCommerceText(m.content) })), records: session.records.slice(-30) }))
}
export interface CommerceBounds { x: number; y: number; width: number; height: number; viewportWidth: number }
interface CommerceBrowserPlugin {
  open(options: { url: string; platform: string; bounds: CommerceBounds }): Promise<void>
  layout(options: { bounds: CommerceBounds; hidden?: boolean }): Promise<void>
  navigate(options: { url: string }): Promise<void>
  back(): Promise<{ canGoBack: boolean }>
  reload(): Promise<void>
  close(): Promise<void>
  evaluate(options: { script: string }): Promise<{ value: string }>
  addListener(event: 'browserEvent', listener: (event: { url?: string; title?: string; error?: string; loading?: boolean; closed?: boolean }) => void): Promise<PluginListenerHandle>
}
export const commerceBrowser = registerPlugin<CommerceBrowserPlugin>('CommerceBrowser')
export const hasCommerceBrowser = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('CommerceBrowser')
export function normalizeCommercePage(value: unknown): CommercePage {
  const raw = typeof value === 'string' ? JSON.parse(value) : value
  if (!raw || !commercePlatformForUrl(raw.url)) throw new Error('当前页面无法读取，请返回平台商品页。')
  return { url: safeCommerceUrl(raw.url), title: redactCommerceText(String(raw.title || '')), text: raw.sensitive ? '' : redactCommerceText(String(raw.text || '')),
    sensitive: !!raw.sensitive, capturedAt: Date.now(), token: String(raw.token || ''),
    targets: raw.sensitive || !Array.isArray(raw.targets) ? [] : raw.targets.slice(0, 70).filter((t: any) => typeof t.id === 'string' && typeof t.label === 'string').map((t: any) => ({ id: t.id, label: redactCommerceText(t.label).slice(0, 100) })) }
}
