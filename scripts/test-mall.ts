/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, String(value)),
    removeItem: (key: string) => memory.delete(key),
    clear: () => memory.clear()
  },
  window: { dispatchEvent: () => true },
  CustomEvent: class CustomEvent { type: string; detail: unknown; constructor(type: string, init?: { detail?: unknown }) { this.type = type; this.detail = init?.detail } }
})

const wallet = await import('../src/services/walletService')
const mall = await import('../src/services/mallService')

const accountId = 'mall-user'
const walletState = wallet.createWalletState(accountId, '用户')
wallet.setWalletBalance(walletState, 100_000, '商城测试余额')
wallet.saveWalletState(walletState)

const snapshot = mall.createMallSnapshot(accountId)
const flower = snapshot.products.find(item => item.id === 'story_flower')!
assert.equal(snapshot.settings.chat.enabled, false, '商城聊天总开关必须默认关闭')
assert.equal(snapshot.settings.chat.allowProductShare, false, '商品分享必须默认关闭')

mall.addMallEvent(snapshot, { type: 'product_shared', title: '测试事件', detail: flower.title, characterId: 'role-1', productId: flower.id, chatEligible: true, memoryEligible: false })
assert.equal(mall.buildMallChatContext(accountId, 'role-1'), '', '关闭开关时商城不得注入提示词')
snapshot.settings.chat = { enabled: true, allowProductShare: true, includeRecentEvents: true, allowMemory: false }
snapshot.settings.characterPermissions['role-1'] = { enabled: true, allowProductShare: true, includeRecentEvents: true, allowMemory: false }
mall.saveMallSnapshot(snapshot)
assert.match(mall.buildMallChatContext(accountId, 'role-1'), /测试事件/, '只有全局与角色授权后才可读取商城事件')

mall.addMallCartItem(snapshot, flower.id, 'user')
const beforeCheckout = wallet.loadWalletState(accountId).cashCents
const order = mall.checkoutStoryCart(snapshot, 'user')
assert.equal(wallet.loadWalletState(accountId).cashCents, beforeCheckout - flower.priceCents, '剧情订单应只扣剧情钱包')
assert.equal(snapshot.cart.length, 0, '结算后对应购物车应清空')
wallet.chargeWalletForMallOrder(accountId, order.id, flower.priceCents, '重复请求')
assert.equal(wallet.loadWalletState(accountId).cashCents, beforeCheckout - flower.priceCents, '同一订单重复扣款必须幂等')
mall.cancelMallOrder(snapshot, order.id)
assert.equal(wallet.loadWalletState(accountId).cashCents, beforeCheckout, '取消剧情订单应完整退款')
assert.throws(() => mall.cancelMallOrder(snapshot, order.id), /不能取消/, '已退款订单不得重复退款')

const external = mall.addMallProduct(snapshot, { source: 'external', title: '真实商品', externalUrl: 'https://item.jd.com/100.html', priceCents: 29900 })
mall.addMallCartItem(snapshot, external.id, 'user')
const beforeExternal = wallet.loadWalletState(accountId).cashCents
assert.throws(() => mall.checkoutStoryCart(snapshot, 'user'), /没有可使用/, '只有真实商品时不得进入剧情钱包结算')
mall.recordExternalProduct(snapshot, external, 'purchased')
assert.equal(wallet.loadWalletState(accountId).cashCents, beforeExternal, '记录真实购买不得改变剧情钱包')
assert.throws(() => mall.normalizeExternalUrl('javascript:alert(1)'), /只支持/, '外部链接必须拒绝危险协议')
assert.equal(mall.detectMallPlatform(external.externalUrl!)?.id, 'jd', '应识别受支持的真实平台域名')

console.log('mall service tests passed')
