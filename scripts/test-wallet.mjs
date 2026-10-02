import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.has(key) ? memory.get(key) : null,
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: key => memory.delete(key),
  clear: () => memory.clear()
}
globalThis.window = new EventTarget()
globalThis.CustomEvent = class CustomEvent extends Event {
  constructor(type, init) { super(type); this.detail = init?.detail }
}

const source = await readFile('src/services/walletService.ts', 'utf8')
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
}).outputText
const wallet = await import(`data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`)

const state = wallet.createWalletState('user-1', '用户')
memory.set('clingy_wallet_state_v1_legacy-user', JSON.stringify({
  owners: {
    'user:legacy-user': { cashCents: 3200, heldCents: 0 },
    'character:old-role': { cashCents: 999999, heldCents: 0 }
  },
  channels: [{ id: 'old-wallet-message' }]
}))
const migrated = wallet.loadWalletState('legacy-user', '旧用户')
assert.equal(migrated.cashCents, 3200, '旧用户余额应迁移')
assert.equal('owners' in migrated, false, '迁移时必须丢弃所有角色账户')
assert.equal('channels' in migrated, false, '迁移时必须丢弃钱包私信数据')

wallet.setWalletBalance(state, 100000, '测试初始余额')
wallet.saveWalletState(state)

const outgoing = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 2500,
  kind: 'transfer', remark: '测试转账'
})
let stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '用户发出转账时应扣除可用余额')
assert.equal(stored.heldCents, 2500, '用户发出转账时应冻结资金')
assert.equal('owners' in stored, false, '钱包不能创建角色账户映射')

assert.equal(wallet.resolveWalletPayment('user-1', outgoing.id, 'claimed').ok, true)
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '对方领取不应再次扣款')
assert.equal(stored.heldCents, 0, '对方领取后应释放冻结资金')
assert.equal(wallet.resolveWalletPayment('user-1', outgoing.id, 'claimed').reason, 'already_resolved')

const refund = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 1500,
  kind: 'red_packet', remark: '退款测试'
})
wallet.resolveWalletPayment('user-1', refund.id, 'expired')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '红包过期后应退回用户余额')
assert.equal(stored.heldCents, 0)

const incoming = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'character', amountCents: 8800,
  kind: 'red_packet', remark: '收到红包'
})
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 97500, '收到但未领取时不应入账')
wallet.resolveWalletPayment('user-1', incoming.id, 'claimed')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, 106300, '领取角色发来的红包时只增加用户余额')
assert.equal('owners' in stored, false, '领取后仍不能出现角色钱包')

stored.bankCards.push({ id: 'debit-1', name: '测试储蓄卡', type: 'debit', lastFour: '1234', enabled: true, createdAt: Date.now(), balanceCents: 5000 })
stored.credit = { ...stored.credit, enabled: true, limitCents: 10000, usedCents: 0, transactions: [] }
wallet.saveWalletState(stored)
const bankPayment = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 1200,
  kind: 'transfer', remark: '银行卡付款', fundingSource: 'bank_card', fundingSourceId: 'debit-1'
})
stored = wallet.loadWalletState('user-1')
assert.equal(stored.bankCards[0].balanceCents, 3800, '银行卡付款必须从所选银行卡扣款')
assert.equal(stored.cashCents, 106300, '银行卡付款不得误扣钱包余额')
wallet.resolveWalletPayment('user-1', bankPayment.id, 'rejected')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.bankCards[0].balanceCents, 5000, '银行卡付款退回时必须原路退卡')

const creditPayment = wallet.createWalletPayment({
  accountId: 'user-1', senderType: 'user', amountCents: 1800,
  kind: 'red_packet', remark: '花呗付款', fundingSource: 'credit'
})
stored = wallet.loadWalletState('user-1')
assert.equal(stored.credit.usedCents, 1800, '花呗付款必须形成待还金额')
assert.equal(stored.credit.transactions[0].relatedId, creditPayment.id, '花呗明细必须关联原付款')
wallet.resolveWalletPayment('user-1', creditPayment.id, 'expired')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.credit.usedCents, 0, '花呗付款过期后必须撤销待还金额')
assert.equal(stored.credit.transactions[0].repaidCents, 1800, '退款后的花呗明细必须标记已结清')

const quote = stored.quotes[0]
const order = wallet.placeWalletOrder(stored, {
  code: quote.code, side: 'buy', orderType: 'market', quantity: 10, fundingSource: 'balance'
})
assert.equal(order.status, 'filled')
assert.equal(stored.positions[0].quantity, 10)

const cashBeforeLimit = stored.cashCents
const limitOrder = wallet.placeWalletOrder(stored, {
  code: quote.code, side: 'buy', orderType: 'limit', quantity: 2,
  limitPriceCents: quote.priceCents - 1, fundingSource: 'balance'
})
assert.equal(limitOrder.status, 'pending')
assert.equal(stored.heldCents, (quote.priceCents - 1) * 2, '限价买单必须冻结对应资金')
wallet.cancelWalletOrder(stored, limitOrder.id)
assert.equal(stored.cashCents, cashBeforeLimit, '撤销限价买单必须全额退回冻结资金')
assert.equal(stored.heldCents, 0)

stored.marketSettings.mode = 'live'
stored.liveQuotes[0].priceCents = 10000
stored.liveQuotes[0].previousCloseCents = 9800
const liveOrder = wallet.placeWalletOrder(stored, {
  code: stored.liveQuotes[0].code, side: 'buy', orderType: 'market', quantity: 1, fundingSource: 'balance'
})
assert.equal(liveOrder.status, 'filled')
assert.equal(stored.livePositions[0].quantity, 1, '真实行情模拟持仓必须独立保存')
assert.equal(stored.positions[0].quantity, 10, '真实行情交易不得覆盖原模拟持仓')

stored.credit.usedCents = 1000
stored.credit.transactions = [{ id: 'credit-1', title: '测试', amountCents: 1000, repaidCents: 0, createdAt: Date.now() }]
wallet.repayWalletCredit(stored, 500)
assert.equal(stored.credit.usedCents, 500)

const beforeMomentReceipt = stored.cashCents
wallet.saveWalletState(stored)
const momentReceipt = wallet.creditMomentReceiptPayment({
  accountId: 'user-1', transactionId: 'momentpay-code-role', amountCents: 1888,
  actorId: 'role-1', actorName: '好友角色', momentId: 'moment-1', remark: '请你喝奶茶'
})
assert.equal(momentReceipt.created, true, '朋友圈收款码转账应即时创建到账记录')
stored = wallet.loadWalletState('user-1')
assert.equal(stored.cashCents, beforeMomentReceipt + 1888, '朋友圈收款码转账应即时增加用户余额')
assert.equal(stored.payments[0].source, 'moment_receipt', '朋友圈收款记录应保留来源')
assert.equal(stored.payments[0].sourceActorName, '好友角色', '朋友圈收款记录应保留付款角色')
const duplicateMomentReceipt = wallet.creditMomentReceiptPayment({
  accountId: 'user-1', transactionId: 'momentpay-code-role', amountCents: 1888,
  actorId: 'role-1', actorName: '好友角色', momentId: 'moment-1', remark: '重复调用'
})
assert.equal(duplicateMomentReceipt.created, false, '同一朋友圈交易 ID 不得重复到账')
assert.equal(wallet.loadWalletState('user-1').cashCents, beforeMomentReceipt + 1888, '重复到账调用不得再次增加余额')

{
// Payment authorization belongs to a single USER, source and operation; cancelled
// and stale confirmations must never debit funds or create a payment/order.
const secured = wallet.createWalletState('secure-user', '支付用户')
secured.cashCents = 500000
secured.bankCards = [{ id: 'secure-card', name: '测试储蓄卡', lastFour: '1234', enabled: true, createdAt: 1, balanceCents: 100000 }]
secured.credit.enabled = true; secured.credit.limitCents = 200000; secured.credit.usedCents = 5000
wallet.saveWalletState(secured)
wallet.setWalletPaymentSecurity(secured, '1234', 'pin')
assert.equal(wallet.walletPaymentMode(wallet.loadWalletState('secure-user')), 'pin')
assert.equal(wallet.isValidWalletCredential('pin', '123'), false)
assert.equal(wallet.isValidWalletCredential('gesture', '1123'), false)
assert.equal(wallet.appendWalletGesturePoint('1', 3), '123')
assert.equal(wallet.appendWalletGesturePoint('1', 9), '159')
assert.equal(wallet.appendWalletGesturePoint('123', 2), '123')
assert.throws(() => wallet.setWalletPaymentSecurity(secured, '123', 'pin'))

let response = '1234'
let heldRequest = null
let hold = false
let requests = 0
window.addEventListener(wallet.walletAuthorizationEventName, event => {
  requests++
  event.detail.accepted = true
  if (hold) heldRequest = event.detail
  else event.detail.finish(response)
})
const intent = (operation, amountCents, fundingSource = 'balance', fundingSourceId) => ({ accountId: 'secure-user', operation, title: '测试付款', amountCents, fundingSource, fundingSourceId })
const send = amount => wallet.createOutgoingWalletPayment('secure-user', amount, 'transfer', '测试')
const beforeProtected = localStorage.getItem(wallet.walletStorageKey('secure-user'))
assert.throws(() => send(1000), /验证/)
assert.throws(() => wallet.chargeWalletForMallOrder('secure-user', 'unauthorized', 1000), /验证/)
assert.throws(() => wallet.adjustWalletBalance(wallet.loadWalletState('secure-user'), -1000, '提现', 'withdraw', '', 'secure-card'), /验证/)
assert.throws(() => wallet.adjustWalletBalance(wallet.loadWalletState('secure-user'), 1000, '充值', 'deposit', '', 'secure-card'), /验证/)
assert.throws(() => wallet.repayWalletCredit(wallet.loadWalletState('secure-user'), 1000), /验证/)
assert.throws(() => wallet.placeWalletOrder(wallet.loadWalletState('secure-user'), { code: 'CLY001', side: 'buy', orderType: 'market', quantity: 1, fundingSource: 'balance' }), /验证/)
assert.equal(localStorage.getItem(wallet.walletStorageKey('secure-user')), beforeProtected)

response = null
assert.equal(await wallet.runWalletPayment(intent('send', 1000), () => send(1000)), undefined)
assert.equal(localStorage.getItem(wallet.walletStorageKey('secure-user')), beforeProtected)
response = '0000'
await assert.rejects(wallet.runWalletPayment(intent('send', 1000), () => send(1000)), /支付设置/)
assert.equal(localStorage.getItem(wallet.walletStorageKey('secure-user')), beforeProtected)
response = '1234'
await assert.rejects(wallet.runWalletPayment(intent('send', 1000), () => send(1000), () => false), /已变化/)
assert.equal(localStorage.getItem(wallet.walletStorageKey('secure-user')), beforeProtected)

hold = true
const waiting = wallet.runWalletPayment(intent('send', 1000), () => send(1000))
await assert.rejects(wallet.runWalletPayment(intent('send', 1000), () => send(1000)), /当前支付验证/)
wallet.setWalletPaymentSecurity(wallet.loadWalletState('secure-user'), '4567', 'pin')
heldRequest.finish('1234')
await assert.rejects(waiting, /支付设置/)
hold = false; response = '4567'
const requestsBeforeBatch = requests
await wallet.runWalletPayment(intent('send', 3000), () => { send(1000); return send(2000) })
assert.equal(requests, requestsBeforeBatch + 1, '批量付款只验证一次')
assert.equal(wallet.loadWalletState('secure-user').cashCents, 497000)
assert.throws(() => send(1000), /验证/, '验证不能授权下一笔付款')
await assert.rejects(wallet.runWalletPayment(intent('send', 1000), () => send(2000)), /验证/, '不得扩大已确认金额')
await assert.rejects(wallet.runWalletPayment(intent('mall', 1000), () => send(1000)), /验证/, '不得用商城授权发送转账')
await assert.rejects(wallet.runWalletPayment(intent('send', 1000), () => wallet.createOutgoingWalletPayment('secure-user', 1000, 'transfer', '', 'bank_card', 'secure-card')), /验证/, '不得更换资金来源')

await wallet.runWalletPayment(intent('deposit', 1000, 'bank_card', 'secure-card'), () => { const s = wallet.loadWalletState('secure-user'); wallet.adjustWalletBalance(s, 1000, '充值', 'deposit', '', 'secure-card'); wallet.saveWalletState(s) })
await wallet.runWalletPayment(intent('withdraw', 1000), () => { const s = wallet.loadWalletState('secure-user'); wallet.adjustWalletBalance(s, -1000, '提现', 'withdraw', '', 'secure-card'); wallet.saveWalletState(s) })
await wallet.runWalletPayment(intent('repay', 1000), () => { const s = wallet.loadWalletState('secure-user'); wallet.repayWalletCredit(s, 1000); wallet.saveWalletState(s) })
await wallet.runWalletPayment(intent('mall', 1000), () => wallet.chargeWalletForMallOrder('secure-user', 'secured-order', 1000))
const stockQuote = wallet.loadWalletState('secure-user').quotes[0]
await wallet.runWalletPayment(intent('stock', stockQuote.priceCents), () => { const s = wallet.loadWalletState('secure-user'); wallet.placeWalletOrder(s, { code: stockQuote.code, side: 'buy', orderType: 'market', quantity: 1, fundingSource: 'balance' }); wallet.saveWalletState(s) })
let limitOrder
await wallet.runWalletPayment(intent('stock', stockQuote.priceCents), () => { const s = wallet.loadWalletState('secure-user'); limitOrder = wallet.placeWalletOrder(s, { code: stockQuote.code, side: 'buy', orderType: 'limit', limitPriceCents: stockQuote.priceCents, quantity: 1, fundingSource: 'balance' }); wallet.saveWalletState(s) })
const beforeAutoFillRequests = requests
const autoFill = wallet.loadWalletState('secure-user')
wallet.processWalletPendingOrders(autoFill); wallet.saveWalletState(autoFill)
assert.equal(autoFill.orders.find(item => item.id === limitOrder.id).status, 'filled')
assert.equal(requests, beforeAutoFillRequests, '已提交委托成交不得重复验证')
wallet.refundWalletMallOrder('secure-user', 'secured-order', 1000)
assert.equal(requests, beforeAutoFillRequests, '退款不得重复验证')

let pendingMarket = wallet.loadWalletState('secure-user')
pendingMarket.marketSettings.mode = 'live'
pendingMarket.liveQuotes[0].priceCents = 20000
wallet.saveWalletState(pendingMarket)
await wallet.runWalletPayment(intent('stock', 18888), () => {
  const s = wallet.loadWalletState('secure-user')
  wallet.placeWalletOrder(s, { code: s.liveQuotes[0].code, side: 'buy', orderType: 'limit', limitPriceCents: 18888, quantity: 1, fundingSource: 'balance' })
  wallet.saveWalletState(s)
})
pendingMarket = wallet.loadWalletState('secure-user')
const requestKey = wallet.walletMarketRequestKey(pendingMarket)
const beforeConcurrentPayment = pendingMarket.cashCents
await wallet.runWalletPayment(intent('send', 1000), () => send(1000))
pendingMarket.liveQuotes[0].priceCents = 18888
pendingMarket.marketSettings.status = 'ready'
assert.equal(wallet.saveWalletMarketResult(pendingMarket, requestKey), true)
assert.equal(wallet.loadWalletState('secure-user').cashCents, beforeConcurrentPayment - 1000, '行情返回不能覆盖期间的新扣款')
assert.equal(wallet.loadWalletState('secure-user').liveQuotes[0].priceCents, 18888)
assert.equal(wallet.loadWalletState('secure-user').liveOrders[0].status, 'filled', '行情同步仍须完成已授权委托')
assert.equal(wallet.loadWalletState('secure-user').livePositions[0].quantity, 1)
const changedMarket = wallet.loadWalletState('secure-user')
changedMarket.marketSettings.mode = 'simulation'; wallet.saveWalletState(changedMarket)
assert.equal(wallet.saveWalletMarketResult(pendingMarket, requestKey), false, '行情设置变化时丢弃旧请求结果')

const staleFinance = wallet.loadWalletState('secure-user')
wallet.setWalletPaymentSecurity(wallet.loadWalletState('secure-user'), '12369', 'gesture')
wallet.saveWalletState(staleFinance)
assert.equal(wallet.loadWalletState('secure-user').paymentPassword, '12369', '后台保存不得覆盖新密码')
response = '12369'
await wallet.runWalletPayment(intent('send', 1000), () => send(1000))
assert.equal(wallet.verifyWalletCredential(wallet.loadWalletState('secure-user'), '12369'), true)
wallet.restoreWalletFinanceSnapshot('secure-user', JSON.stringify({ ...secured, cashCents: 4200, paymentPassword: '9999', paymentPasswordType: 'pin' }))
assert.equal(wallet.loadWalletState('secure-user').cashCents, 4200)
assert.equal(wallet.loadWalletState('secure-user').paymentPassword, '12369', '时间线回溯保留当前手势')
const resetState = wallet.loadWalletState('secure-user')
wallet.resetWalletFinance(resetState); wallet.saveWalletState(resetState)
assert.equal(wallet.loadWalletState('secure-user').paymentPasswordType, 'gesture')
wallet.setWalletPaymentSecurity(wallet.loadWalletState('secure-user'), undefined, 'pin')
assert.equal(wallet.walletPaymentMode(wallet.loadWalletState('secure-user')), 'off')
assert.equal(wallet.loadWalletState('user-1').paymentPassword, undefined, '其他 USER 不得受到影响')
console.log('wallet service and payment authorization tests passed')

}
