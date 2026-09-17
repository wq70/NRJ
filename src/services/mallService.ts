/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type {
  MallCartItem,
  MallCartOwner,
  MallChatPermissions,
  MallEvent,
  MallExternalPlatform,
  MallOrder,
  MallProduct,
  MallSettings,
  MallSnapshot
} from '../types/mall'
import { chargeWalletForMallOrder, refundWalletMallOrder } from './walletService'

const STORAGE_PREFIX = 'clingy_mall_snapshot_v1_'
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const cents = (value: number | undefined) => Math.max(0, Math.round(Number(value) || 0))

export const defaultMallChatPermissions = (): MallChatPermissions => ({
  enabled: false,
  allowProductShare: false,
  includeRecentEvents: false,
  allowMemory: false
})

export const defaultMallSettings = (): MallSettings => ({
  chat: defaultMallChatPermissions(),
  characterPermissions: {},
  showBrowsingHistory: true,
  confirmExternalJump: true,
  contextEventLimit: 3
})

const seed = (id: string, title: string, subtitle: string, description: string, category: string, emoji: string, priceCents: number, storeName: string, tags: string[], originalPriceCents?: number): MallProduct => ({
  id, source: 'story', title, subtitle, description, category, emoji, priceCents, originalPriceCents,
  stock: 99, storeName, tags, createdAt: 1
})

export const builtInMallProducts = (): MallProduct[] => [
  seed('story_flower', '晚风花束', '把今天没说完的话一起送到', '十二枝当季花材，附一张可自定义的小卡片。适合作为普通日子里的惊喜。', '礼物', '💐', 6800, '花与晚风', ['送礼', '纪念日'], 8800),
  seed('story_cake', '双人小蛋糕', '两个人刚刚好的六寸甜点', '可选择奶油、水果或巧克力口味，订单完成后会生成一起吃蛋糕的关系事件。', '吃喝', '🎂', 5200, '小满甜室', ['甜点', '一起吃']),
  seed('story_headphones', '云朵耳机', '把同一首歌听得更近一点', '轻量头戴式耳机，柔软耳罩和安静外观，适合一起听歌。', '数码', '🎧', 32900, '白噪音商店', ['音乐', '陪伴'], 39900),
  seed('story_ring', '星轨对戒', '内圈可以刻两句不一样的话', '一对简洁银色戒指，可分别写下只让对方知道的刻字。', '饰品', '💍', 26800, '星轨工房', ['情侣', '定制']),
  seed('story_sweater', '同色系毛衣', '不是完全一样，也能看出是一对', '两件不同剪裁的柔软毛衣，可选择雾灰、燕麦和深蓝。', '穿搭', '🧶', 39800, '慢慢衣橱', ['情侣装', '秋冬']),
  seed('story_camera', '口袋拍立得', '把偶然发生的瞬间留下来', '轻巧的即时成像相机，附十张相纸。适合旅行和纪念日。', '数码', '📷', 58900, '光影杂货', ['记录', '旅行']),
  seed('story_blanket', '双人午睡毯', '沙发上刚好能盖住两个人', '柔软、可机洗，边角有一个很小的心形织标。', '居家', '🛋️', 12900, '慢屋', ['居家', '共同空间']),
  seed('story_perfume', '雨后木香', '安静、清透，靠近才闻得到', '木质与青草气息的中性香水，留香轻柔，不会太有侵略感。', '香氛', '🫧', 23900, '无声气味', ['香水', '礼物']),
  seed('story_movie', '双人电影夜', '选一部片，留一晚时间', '剧情体验券，可记录观影选择并与共赏空间联动。', '体验', '🎞️', 4600, '夜场放映厅', ['约会', '共赏']),
  seed('story_breakfast', '明早早餐券', '替对方认真准备一顿早餐', '可选择中式、西式或随机搭配，用后生成一条早餐约定。', '吃喝', '🥐', 2800, '早安厨房', ['早餐', '照顾']),
  seed('story_hotpot', '双人小火锅', '一半清汤，一半照顾彼此的口味', '适合一起慢慢吃的一锅，包含荤素拼盘和两份饮料。', '吃喝', '🍲', 10800, '今晚热气', ['正餐', '双人']),
  seed('story_noodles', '深夜热汤面', '晚一点也要认真吃饭', '一碗热汤面、一份小菜，适合加班、熬夜或需要安慰的晚上。', '吃喝', '🍜', 3200, '巷口面馆', ['夜宵', '暖胃']),
  seed('story_milktea', '两杯不同甜度', '不用迁就，也可以一起喝', '两杯自选饮品，可分别选择甜度、温度和加料。', '吃喝', '🧋', 3600, '半糖茶铺', ['饮料', '下午茶']),
  seed('story_congee', '照顾粥套餐', '胃口不好的时候也有人惦记', '清粥、蒸蛋和两份清淡小菜，适合生病或疲惫的剧情场景。', '吃喝', '🥣', 4200, '慢火粥店', ['清淡', '照顾']),
  seed('story_bento', '今日便当', '忙碌日子里的一顿准时午饭', '主食、两荤一素和水果，可选择清淡或正常口味。', '吃喝', '🍱', 4600, '十二点便当', ['午餐', '工作日']),
  seed('story_bbq', '夜风烧烤拼盘', '边吃边聊到很晚', '双人烤串、蔬菜和无酒精饮料组合，适合轻松的夜晚。', '吃喝', '🍢', 7600, '夜风摊', ['夜宵', '聊天']),
  seed('story_letter', '定时来信', '现在写下，在选定的日子打开', '一封可以设置开启日期的信，适合生日、纪念日或普通未来。', '关系', '💌', 1200, '时间邮局', ['信件', '纪念']),
  seed('story_room_light', '月相小夜灯', '让共同房间多一盏温柔的灯', '暖色桌面灯，可作为情侣空间的共同陈设记录。', '居家', '🌙', 9900, '慢屋', ['房间', '氛围'])
]

export const mallExternalPlatforms: MallExternalPlatform[] = [
  { id: 'taobao', name: '淘宝', shortName: '淘', homeUrl: 'https://www.taobao.com/', searchUrl: keyword => `https://s.taobao.com/search?q=${encodeURIComponent(keyword)}`, domains: ['taobao.com', 'tmall.com'], accent: '#ff6a32' },
  { id: 'jd', name: '京东', shortName: '京', homeUrl: 'https://www.jd.com/', searchUrl: keyword => `https://search.jd.com/Search?keyword=${encodeURIComponent(keyword)}`, domains: ['jd.com', '3.cn'], accent: '#d84242' },
  { id: 'pdd', name: '拼多多', shortName: '拼', homeUrl: 'https://www.yangkeduo.com/', searchUrl: keyword => `https://mobile.yangkeduo.com/search_result.html?search_key=${encodeURIComponent(keyword)}`, domains: ['yangkeduo.com', 'pinduoduo.com'], accent: '#d94a4a' },
  { id: 'meituan', name: '美团', shortName: '团', homeUrl: 'https://www.meituan.com/', searchUrl: keyword => `https://www.meituan.com/s/${encodeURIComponent(keyword)}/`, domains: ['meituan.com', 'dianping.com'], accent: '#d2a918' }
]

export const detectMallPlatform = (url: string) => {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return mallExternalPlatforms.find(platform => platform.domains.some(domain => host === domain || host.endsWith(`.${domain}`))) || null
  } catch { return null }
}

export const normalizeExternalUrl = (value: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) throw new Error('请输入商品链接')
  let parsed: URL
  try { parsed = new URL(trimmed) } catch { throw new Error('链接格式不正确') }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('只支持 http 或 https 链接')
  return parsed.toString()
}

const normalizeOptionalImageUrl = (value?: string) => {
  const trimmed = String(value || '').trim()
  if (!trimmed) return undefined
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined
  } catch { return undefined }
}

export const mallStorageKey = (accountId: string) => `${STORAGE_PREFIX}${accountId || 'guest'}`

export const createMallSnapshot = (accountId: string): MallSnapshot => ({
  schemaVersion: 1,
  accountId: accountId || 'guest',
  products: builtInMallProducts(),
  cart: [], wishlist: [], orders: [], events: [], recentlyViewedProductIds: [],
  settings: defaultMallSettings(), updatedAt: Date.now()
})

const normalizePermissions = (raw: any): MallChatPermissions => ({ ...defaultMallChatPermissions(), ...(raw || {}) })

const normalizeSnapshot = (raw: any, accountId: string): MallSnapshot => {
  const base = createMallSnapshot(accountId)
  if (!raw || typeof raw !== 'object') return base
  const custom = Array.isArray(raw.products) ? raw.products.filter((item: any) => item?.source !== 'story') : []
  const builtIns = builtInMallProducts()
  const settings = { ...defaultMallSettings(), ...(raw.settings || {}) }
  settings.chat = normalizePermissions(raw.settings?.chat)
  settings.characterPermissions = Object.fromEntries(Object.entries(raw.settings?.characterPermissions || {}).map(([id, permissions]) => [id, normalizePermissions(permissions)]))
  settings.contextEventLimit = Math.max(1, Math.min(8, Number(settings.contextEventLimit || 3)))
  return {
    ...base, ...raw, schemaVersion: 1, accountId: accountId || 'guest',
    products: [...builtIns, ...custom],
    cart: Array.isArray(raw.cart) ? raw.cart : [], wishlist: Array.isArray(raw.wishlist) ? raw.wishlist : [],
    orders: Array.isArray(raw.orders) ? raw.orders : [], events: Array.isArray(raw.events) ? raw.events : [],
    recentlyViewedProductIds: Array.isArray(raw.recentlyViewedProductIds) ? raw.recentlyViewedProductIds.slice(0, 30) : [],
    settings, updatedAt: Number(raw.updatedAt || Date.now())
  }
}

export const loadMallSnapshot = (accountId: string) => {
  try { return normalizeSnapshot(JSON.parse(localStorage.getItem(mallStorageKey(accountId)) || 'null'), accountId) }
  catch { return createMallSnapshot(accountId) }
}

export const saveMallSnapshot = (snapshot: MallSnapshot) => {
  snapshot.updatedAt = Date.now()
  localStorage.setItem(mallStorageKey(snapshot.accountId), JSON.stringify(snapshot))
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('clingy-mall-updated', { detail: { accountId: snapshot.accountId } }))
  return snapshot
}

export const addMallProduct = (snapshot: MallSnapshot, input: Partial<MallProduct> & Pick<MallProduct, 'title'>) => {
  const externalUrl = input.source === 'external' ? normalizeExternalUrl(input.externalUrl || '') : undefined
  const platform = externalUrl ? detectMallPlatform(externalUrl) : null
  const product: MallProduct = {
    id: uid('product'), source: input.source === 'external' ? 'external' : 'custom', title: input.title.trim(),
    subtitle: String(input.subtitle || (platform ? `${platform.name}商品` : '用户创建的剧情商品')).trim(),
    description: String(input.description || '').trim(), category: input.category || (input.source === 'external' ? '真实商品' : '自定义'),
    emoji: input.emoji || (input.source === 'external' ? '🔗' : '🎁'), imageUrl: normalizeOptionalImageUrl(input.imageUrl),
    priceCents: cents(input.priceCents), originalPriceCents: input.originalPriceCents ? cents(input.originalPriceCents) : undefined,
    stock: input.source === 'external' ? 0 : Math.max(0, Math.round(input.stock ?? 99)), storeName: input.storeName || platform?.name || '我的商店',
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 8) : [], platform: input.platform || platform?.name,
    externalUrl, createdAt: Date.now(), userCreated: true
  }
  if (!product.title) throw new Error('请填写商品名称')
  snapshot.products.unshift(product); saveMallSnapshot(snapshot); return product
}

export const removeMallProduct = (snapshot: MallSnapshot, productId: string) => {
  const product = snapshot.products.find(item => item.id === productId)
  if (!product?.userCreated) return false
  snapshot.products = snapshot.products.filter(item => item.id !== productId)
  snapshot.cart = snapshot.cart.filter(item => item.productId !== productId)
  snapshot.wishlist = snapshot.wishlist.filter(item => item.productId !== productId)
  saveMallSnapshot(snapshot); return true
}

export const viewMallProduct = (snapshot: MallSnapshot, productId: string) => {
  snapshot.recentlyViewedProductIds = [productId, ...snapshot.recentlyViewedProductIds.filter(id => id !== productId)].slice(0, 30)
  saveMallSnapshot(snapshot)
}

export const addMallCartItem = (snapshot: MallSnapshot, productId: string, owner: MallCartOwner, quantity = 1) => {
  const product = snapshot.products.find(item => item.id === productId)
  if (!product) throw new Error('商品不存在')
  const existing = snapshot.cart.find(item => item.productId === productId && item.owner === owner)
  if (existing) existing.quantity = Math.min(99, existing.quantity + Math.max(1, quantity))
  else snapshot.cart.push({ id: uid('cart'), productId, owner, quantity: Math.max(1, quantity), addedAt: Date.now() })
  saveMallSnapshot(snapshot)
}

export const setMallCartQuantity = (snapshot: MallSnapshot, itemId: string, quantity: number) => {
  const item = snapshot.cart.find(entry => entry.id === itemId); if (!item) return
  if (quantity <= 0) snapshot.cart = snapshot.cart.filter(entry => entry.id !== itemId)
  else item.quantity = Math.min(99, Math.max(1, Math.round(quantity)))
  saveMallSnapshot(snapshot)
}

export const toggleMallWishlist = (snapshot: MallSnapshot, productId: string, owner: MallCartOwner) => {
  const index = snapshot.wishlist.findIndex(item => item.productId === productId && item.owner === owner)
  if (index >= 0) snapshot.wishlist.splice(index, 1)
  else {
    snapshot.wishlist.unshift({ id: uid('wish'), productId, owner, createdAt: Date.now() })
    snapshot.events.unshift({ id: uid('event'), type: 'wishlist', title: '收藏了商品', detail: snapshot.products.find(item => item.id === productId)?.title || '商品', characterId: owner.startsWith('character:') ? owner.slice(10) : undefined, productId, chatEligible: false, memoryEligible: false, createdAt: Date.now() })
  }
  saveMallSnapshot(snapshot); return index < 0
}

export const addMallEvent = (snapshot: MallSnapshot, input: Omit<MallEvent, 'id' | 'createdAt'>) => {
  const event: MallEvent = { ...input, id: uid('event'), createdAt: Date.now() }
  snapshot.events.unshift(event); snapshot.events = snapshot.events.slice(0, 300); saveMallSnapshot(snapshot); return event
}

export const checkoutStoryCart = (snapshot: MallSnapshot, owner: MallCartOwner, character?: { id: string; name: string }, productIds?: string[]) => {
  const allowedIds = productIds?.length ? new Set(productIds) : null
  const cartItems = snapshot.cart.filter(item => item.owner === owner && (!allowedIds || allowedIds.has(item.productId)) && snapshot.products.find(product => product.id === item.productId)?.source !== 'external')
  if (!cartItems.length) throw new Error('没有可使用剧情钱包结算的商品')
  const products = cartItems.map(item => ({ cart: item, product: snapshot.products.find(product => product.id === item.productId) })).filter(item => item.product)
  const totalCents = products.reduce((sum, item) => sum + (item.product?.priceCents || 0) * item.cart.quantity, 0)
  const orderId = uid('mall_order')
  chargeWalletForMallOrder(snapshot.accountId, orderId, totalCents, products.map(item => item.product?.title).join('、'))
  const order: MallOrder = {
    id: orderId, source: 'story', owner, characterId: character?.id, characterName: character?.name,
    items: products.map(({ cart, product }) => ({ productId: product!.id, title: product!.title, emoji: product!.emoji, quantity: cart.quantity, unitPriceCents: product!.priceCents })),
    totalCents, status: 'paid', createdAt: Date.now(), updatedAt: Date.now()
  }
  snapshot.orders.unshift(order)
  const ids = new Set(cartItems.map(item => item.id)); snapshot.cart = snapshot.cart.filter(item => !ids.has(item.id))
  snapshot.events.unshift({ id: uid('event'), type: owner === 'together' ? 'gift' : 'story_order', title: owner === 'together' ? '完成了一份共同订单' : '剧情订单已付款', detail: order.items.map(item => `${item.title}×${item.quantity}`).join('、'), characterId: character?.id, orderId, chatEligible: true, memoryEligible: false, createdAt: Date.now() })
  saveMallSnapshot(snapshot); return order
}

export const cancelMallOrder = (snapshot: MallSnapshot, orderId: string) => {
  const order = snapshot.orders.find(item => item.id === orderId)
  if (!order || order.source !== 'story') throw new Error('订单不存在')
  if (!['paid', 'preparing'].includes(order.status)) throw new Error('当前状态不能取消')
  refundWalletMallOrder(snapshot.accountId, order.id, order.totalCents, order.items.map(item => item.title).join('、'))
  order.status = 'refunded'; order.updatedAt = Date.now(); saveMallSnapshot(snapshot); return order
}

export const advanceMallOrder = (snapshot: MallSnapshot, orderId: string) => {
  const order = snapshot.orders.find(item => item.id === orderId); if (!order || order.source !== 'story') return null
  const next: Partial<Record<MallOrder['status'], MallOrder['status']>> = { paid: 'preparing', preparing: 'shipped', shipped: 'delivered' }
  const status = next[order.status]; if (!status) return order
  order.status = status; order.updatedAt = Date.now(); saveMallSnapshot(snapshot); return order
}

export const recordExternalProduct = (snapshot: MallSnapshot, product: MallProduct, status: MallOrder['externalPurchaseStatus'], owner: MallCartOwner = 'user') => {
  let order = snapshot.orders.find(item => item.source === 'external' && item.items[0]?.productId === product.id)
  if (!order) {
    order = { id: uid('external_record'), source: 'external', owner, items: [{ productId: product.id, title: product.title, emoji: product.emoji, quantity: 1, unitPriceCents: product.priceCents }], totalCents: product.priceCents, status: 'unverified', externalPurchaseStatus: status, platform: product.platform, externalUrl: product.externalUrl, createdAt: Date.now(), updatedAt: Date.now() }
    snapshot.orders.unshift(order)
  } else { order.externalPurchaseStatus = status; order.updatedAt = Date.now() }
  snapshot.events.unshift({ id: uid('event'), type: 'external_marked', title: '更新了真实商品记录', detail: `${product.title}：${status === 'purchased' ? '用户自行确认已购买' : status === 'considering' ? '正在考虑' : status === 'abandoned' ? '决定不买' : '已保存'}`, productId: product.id, orderId: order.id, chatEligible: false, memoryEligible: false, createdAt: Date.now() })
  saveMallSnapshot(snapshot); return order
}

export const effectiveMallChatPermissions = (snapshot: MallSnapshot, characterId: string): MallChatPermissions => {
  const global = snapshot.settings.chat
  const character = normalizePermissions(snapshot.settings.characterPermissions[characterId])
  return {
    enabled: global.enabled && character.enabled,
    allowProductShare: global.enabled && global.allowProductShare && character.enabled && character.allowProductShare,
    includeRecentEvents: global.enabled && global.includeRecentEvents && character.enabled && character.includeRecentEvents,
    allowMemory: global.enabled && global.allowMemory && character.enabled && character.allowMemory
  }
}

export const buildMallChatContext = (accountId: string, characterId: string, english = false) => {
  const snapshot = loadMallSnapshot(accountId)
  const permissions = effectiveMallChatPermissions(snapshot, characterId)
  if (!permissions.enabled || !permissions.includeRecentEvents) return ''
  const events = snapshot.events.filter(event => event.chatEligible && (!event.characterId || event.characterId === characterId)).slice(0, snapshot.settings.contextEventLimit)
  if (!events.length) return ''
  const lines = events.map(event => `- ${event.title}：${event.detail}`)
  return english
    ? `\n\n[Authorized shopping context]\n${lines.join('\n')}\nThis is contextual information only. Never claim a real-platform payment, change an order, or spend wallet funds.`
    : `\n\n【已授权的商城上下文】\n${lines.join('\n')}\n这些内容仅供自然对话参考。不得自行宣称真实平台已付款、修改订单或花费钱包资金。`
}

export const cloneMallSnapshot = (snapshot: MallSnapshot) => clone(snapshot)
export const mallCartTotal = (snapshot: MallSnapshot, owner: MallCartOwner) => snapshot.cart.filter(item => item.owner === owner).reduce((sum, item) => sum + (snapshot.products.find(product => product.id === item.productId)?.priceCents || 0) * item.quantity, 0)
export const mallCartItems = (snapshot: MallSnapshot, owner: MallCartOwner): Array<MallCartItem & { product: MallProduct }> => snapshot.cart.filter(item => item.owner === owner).map(item => ({ ...item, product: snapshot.products.find(product => product.id === item.productId)! })).filter(item => item.product)
