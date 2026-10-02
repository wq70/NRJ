import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

export const platforms = {
  meituan: { name: '美团', home: 'https://h5.waimai.meituan.com/', domains: ['meituan.com', 'dianping.com', 'sankuai.com'] },
  jd: { name: '京东', home: 'https://www.jd.com/', domains: ['jd.com', 'jd.hk', '360buy.com', '3.cn', 'jdpay.com'] },
  taobao: { name: '淘宝', home: 'https://www.taobao.com/', domains: ['taobao.com', 'tmall.com', 'alipay.com', 'tb.cn'] },
  pdd: { name: '拼多多', home: 'https://mobile.yangkeduo.com/', domains: ['yangkeduo.com', 'pinduoduo.com'] }
}
export const checkoutPattern = /支付|付款|提交订单|立即购买|立即抢购|确认购买|确认下单|拼单|开团|免密|购买并|取消订单|退款|删除|登录|验证|授权|退出|注销|同意|绑定|解绑|密码|地址|电话|联系|发送|确认|确定/
export class CommerceError extends Error {
  constructor(message, status = 400, code = 'invalid_request') { super(message); this.status = status; this.code = code }
}
export function requirePlatform(value) {
  if (!Object.hasOwn(platforms, value)) throw new CommerceError('不支持的平台')
  return platforms[value]
}
export function platformUrl(value, platform) {
  const rule = requirePlatform(platform)
  let url
  try { url = new URL(value) } catch { throw new CommerceError('请输入完整的 HTTPS 平台链接') }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !rule.domains.some(d => url.hostname === d || url.hostname.endsWith(`.${d}`))) throw new CommerceError('链接不属于当前平台的受支持域名')
  return url.href
}
export function publicAddress(value) {
  const ip = value.toLowerCase().replace(/^::ffff:/, '')
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)))
  }
  return isIP(ip) === 6 && !/^(::|fc|fd|fe[89ab]|ff|2001:db8)/.test(ip)
}
export const redact = value => String(value || '')
  .replace(/\b1[3-9]\d{9}\b/g, '[手机号]')
  .replace(/\b\d{15,30}\b/g, '[号码]')
  .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[邮箱]')
  .replace(/(?:收货地址|配送地址|收货人|联系人|详细地址|订单号|订单编号|验证码|access_token|refresh_token|sessionkey|cookie)[：:=\s]*[^\n]*/gi, '[个人信息已隐藏]')
  .slice(0, 12000)
export function safeUrl(value) {
  const url = new URL(value)
  const safe = new URL(url.origin + url.pathname)
  for (const key of ['id', 'itemId', 'sku', 'skuId', 'goods_id', 'goodsId', 'shop_id', 'shopId', 'poi_id']) {
    const v = url.searchParams.get(key)
    if (v && /^[\w-]{1,80}$/.test(v)) safe.searchParams.set(key, v)
  }
  return safe.href
}
export function passwordHash(value, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(value, salt, 64).toString('hex')}`
}
export function verifyPassword(value, hash) {
  if (typeof value !== 'string' || value.length > 256 || !/^[a-f\d]{32}:[a-f\d]{128}$/i.test(hash || '')) return false
  const [salt, expected] = hash.split(':')
  return timingSafeEqual(Buffer.from(expected, 'hex'), scryptSync(value, salt, 64))
}
export function encrypt(value, key) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
  return [iv, cipher.getAuthTag(), bytes].map(v => v.toString('base64')).join('.')
}
export function decrypt(value, key) {
  const [iv, tag, bytes] = value.split('.').map(v => Buffer.from(v, 'base64'))
  const cipher = createDecipheriv('aes-256-gcm', key, iv)
  cipher.setAuthTag(tag)
  return JSON.parse(Buffer.concat([cipher.update(bytes), cipher.final()]).toString())
}
export function moneyCents(value) {
  const text = String(value || '').trim().replace(/,/g, '')
  if (/起|至|~|～|\d\s*[-–]\s*\d|券后|满减/.test(text)) return undefined
  const match = text.match(/(?:¥|￥|价格[:：]?\s*)(\d{1,8}(?:\.\d{1,2})?)(?![\d.])/) || text.match(/^(\d{1,8}(?:\.\d{1,2})?)$/)
  return match ? Math.round(Number(match[1]) * 100) : undefined
}
export function normalizeProduct(raw, platform, observedAt = Date.now()) {
  const url = safeUrl(platformUrl(raw.url, platform))
  const id = new URL(url).searchParams.get('id') || new URL(url).searchParams.get('goods_id') || new URL(url).pathname.match(/\/(\d+)\.html/)?.[1]
  return { id: `${platform}:${id || url}`, platform, url, title: redact(raw.title).slice(0, 240), imageUrl: /^https:\/\//.test(raw.imageUrl || '') ? safeUrl(raw.imageUrl) : undefined, priceCents: moneyCents(raw.price), specification: redact(raw.specification).slice(0, 500), stock: redact(raw.stock).slice(0, 100) || undefined, storeName: redact(raw.storeName).slice(0, 100), source: 'page-observation', observedAt, priceKind: 'display', quantity: 1 }
}
export function validateAction(action, page, permission) {
  if (permission === 'observe') throw new CommerceError('当前角色只允许陪你看，请在权限中允许选购')
  const target = page?.targets?.find(t => t.id === action.targetId)
  if (!target || !action.token || action.token !== page.token || page.sensitive || checkoutPattern.test(target.label)) throw new CommerceError('页面或操作已变化，请重新读取', 409, 'stale_action')
  if (/购物车|加购|数量|移除|减少|增加/.test(target.label) && permission !== 'cart') throw new CommerceError('当前角色没有整理购物车的权限')
  return target
}

// Runs only in the isolated platform browser. No app credentials are passed into this function.
export function readPage() {
  const visible = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && s.visibility !== 'hidden' && s.display !== 'none' }
  const sensitive = /login|passport|signin|cashier|payment|\/pay(?:\/|\?|$)|address|checkout|trade\/|order\/|order_detail/i.test(location.href)
    || [...document.querySelectorAll('iframe')].some(e => visible(e) && /login|passport|signin|cashier|payment/i.test([e.src, e.title].join(' ')))
    || [...document.querySelectorAll('input')].some(e => visible(e) && /password|one-time-code|验证码|密码|身份证|银行卡/.test([e.type, e.autocomplete, e.placeholder, e.name].join(' ')))
    || [...document.querySelectorAll('h1,h2,[role=heading]')].some(e => visible(e) && /登录|验证|支付|收货地址|确认订单/.test(e.textContent || ''))
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  const nodes = new Map()
  const targets = [], texts = []
  const block = /支付|付款|提交|下单|立即购买|立即抢购|确认|确定|拼单|开团|免密|购买并|取消订单|退款|删除|登录|验证|授权|退出|注销|同意|绑定|解绑|密码|地址|电话|联系|发送/
  if (!sensitive) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n, total = 0
    while ((n = walker.nextNode()) && total < 14000) {
      const e = n.parentElement
      if (!e || e.closest('script,style,input,textarea,select,[contenteditable=true],noscript,[class*="address"],[class*="receiver"],[class*="account"],[class*="user-info"]') || !visible(e)) continue
      const text = (n.textContent || '').trim()
      if (text) { texts.push(text); total += text.length }
    }
    for (const e of document.querySelectorAll('a,button,[role=button],[onclick]')) {
      const label = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100)
      if (targets.length >= 70) break
      if (!visible(e) || !label || block.test(label) || e.disabled || e.getAttribute('aria-disabled') === 'true' || (e.type === 'submit' && e.closest('form'))) continue
      const id = String(targets.length)
      nodes.set(id, { element: e, label, href: e.getAttribute('href') })
      targets.push({ id, label })
    }
  }
  window.__nrjWebCommerce = { token, nodes, used: false, url: location.href }
  const textOf = selectors => { for (const selector of selectors) { const e = document.querySelector(selector); if (e && visible(e)) return (e.innerText || e.textContent || '').trim() } return '' }
  const title = textOf(['.sku-name', '.tb-main-title', '[class*="goods-name"]', '[class*="GoodsName"]', 'h1'])
  const image = document.querySelector('#spec-img,.tb-booth img,[class*="goods-image"] img')
  const productPage = /(?:item\.jd\.com\/\d+\.html|item\.taobao\.com\/item\.htm|detail\.tmall\.com\/item\.htm|goods(?:[_.]|\.html)|[?&]goods_id=)/i.test(location.href)
  const product = !sensitive && title && productPage ? { title, url: location.href, price: textOf(['.p-price', '.tb-rmb-num', '[class*="goods-price"]']), specification: textOf(['.summary-choose .selected', '.tb-sku .tb-selected', '[class*="skuSelected"]']), stock: textOf(['#store-prompt', '.tb-stock']), storeName: textOf(['.shop-name', '.tb-shop-name']), imageUrl: image?.src || '' } : null
  return { url: location.href, title: document.title, text: texts.join('\n'), token, sensitive, targets, product }
}
export function clickTarget({ token, id }) {
  const state = window.__nrjWebCommerce
  if (!state || state.used || state.token !== token || state.url !== location.href) return { ok: false, reason: '页面已变化，请重新读取' }
  const item = state.nodes.get(id), e = item?.element
  if (!e?.isConnected || e.disabled || e.getAttribute('aria-disabled') === 'true') return { ok: false, reason: '目标已失效' }
  const label = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 100)
  if (label !== item.label || e.getAttribute('href') !== item.href) return { ok: false, reason: '按钮已变化' }
  const r = e.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
  if (r.width <= 0 || r.height <= 0 || r.top < 0 || r.bottom > innerHeight || !hit || (hit !== e && !e.contains(hit))) return { ok: false, reason: '按钮不在可操作区域或被遮挡' }
  state.used = true
  e.click()
  return { ok: true, label }
}
