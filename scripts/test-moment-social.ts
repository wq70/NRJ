import assert from 'node:assert/strict'
import {
  defaultMomentPaymentSettings,
  getCharacterMomentPaymentOverride,
  isMomentPaymentEnabledForCharacter,
  loadMomentPaymentSettings,
  saveMomentPaymentSettings
} from '../src/services/momentPayments'
import { appendWalletSms, loadSmsThreads, markSmsThreadRead } from '../src/services/smsService'

const memory = new Map<string, string>()
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, String(value)),
    removeItem: (key: string) => memory.delete(key),
    clear: () => memory.clear()
  },
  window: { dispatchEvent: () => true },
  CustomEvent: class CustomEvent {
    type: string
    detail: unknown
    constructor(type: string, init?: { detail?: unknown }) { this.type = type; this.detail = init?.detail }
  }
})

const accountId = 'moment-test-user'
assert.equal(loadMomentPaymentSettings(accountId).enabled, false, '朋友圈收款互动默认不得擅自改变既有钱包余额')
saveMomentPaymentSettings(accountId, { ...defaultMomentPaymentSettings(), enabled: true })
assert.equal(isMomentPaymentEnabledForCharacter(accountId, {}), true, '未独立设置的角色应跟随全局默认')
assert.equal(getCharacterMomentPaymentOverride({ momentPaymentOverride: 'enabled' }), 'enabled')
assert.equal(isMomentPaymentEnabledForCharacter(accountId, { momentPaymentOverride: 'disabled' }), false, '角色独立关闭应覆盖全局开启')
saveMomentPaymentSettings(accountId, { ...defaultMomentPaymentSettings(), enabled: false })
assert.equal(isMomentPaymentEnabledForCharacter(accountId, { momentPaymentOverride: 'enabled' }), true, '角色独立开启应覆盖全局关闭')

assert.equal(loadSmsThreads(accountId)[0].id, 'system', '首次打开短信应保留系统欢迎会话')
assert.equal(appendWalletSms(accountId, { text: '到账测试', relatedId: 'payment-1' }), true)
assert.equal(appendWalletSms(accountId, { text: '重复到账测试', relatedId: 'payment-1' }), false, '同一交易不得重复写入短信')
let walletThread = loadSmsThreads(accountId).find(thread => thread.id === 'wallet-service')
assert.equal(walletThread?.messages.length, 1)
assert.equal(walletThread?.unread, true)
markSmsThreadRead(accountId, 'wallet-service')
walletThread = loadSmsThreads(accountId).find(thread => thread.id === 'wallet-service')
assert.equal(walletThread?.unread, false, '打开钱包短信会话后应清除未读状态')

console.log('moment social service tests passed')
