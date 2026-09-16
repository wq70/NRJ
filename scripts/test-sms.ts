import assert from 'node:assert/strict'
import {
  buildSmsChatContext, clearSmsThread, createSmsThread, defaultSmsSettings, deleteSmsThread, ensureCharacterSmsThread, ensureSmsIdentity,
  findSmsThread, loadSmsSettings, loadSmsThreads, markSmsThreadRead, processScheduledSms, receiveRandomStrangerSms,
  receiveSmsMessage, saveSmsSettings, sendSmsMessage, startPrankSms, stopNarrativeSms, updateSmsThread
} from '../src/services/smsService'

const memory = new Map<string, string>()
const dispatched: Array<{ type: string; detail: any }> = []
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, String(value)),
    removeItem: (key: string) => memory.delete(key),
    clear: () => memory.clear()
  },
  window: { dispatchEvent: (event: { type: string; detail: any }) => { dispatched.push(event); return true } },
  CustomEvent: class CustomEvent {
    type: string
    detail: unknown
    constructor(type: string, init?: { detail?: unknown }) { this.type = type; this.detail = init?.detail }
  }
})

const accountId = 'sms-test-user'
const defaults = defaultSmsSettings()
assert.equal(defaults.allowInterruptions, false, '短信默认不得主动打扰')
assert.equal(defaults.protectActiveChat, true, '正常聊天默认受保护')
assert.equal(defaults.allowSmsAffectChat, false, '短信默认不得影响普通聊天')
assert.equal(defaults.strangerEnabled, false, '陌生短信必须由用户主动开启')
assert.equal(defaults.prankEnabled, false, '整蛊短信必须由用户主动开启')

assert.equal(loadSmsThreads(accountId)[0].id, 'system', '旧系统欢迎入口必须保留')
const identity = ensureSmsIdentity(accountId)
assert.match(identity, /^170\d{8}$/, '用户应获得稳定虚拟号码')
assert.equal(ensureSmsIdentity(accountId), identity, '虚拟号码不得因重复加载改变')

const roleThread = ensureCharacterSmsThread(accountId, { id: 'role-1', linkedCharacterId: 'role-1', name: '测试角色', number: '17000000001', avatarText: '测', participantType: 'character' })
assert.equal(roleThread.participantType, 'character')
assert.ok(sendSmsMessage(accountId, roleThread.id, '你好'))
assert.equal(findSmsThread(accountId, roleThread.id)?.messages.at(-1)?.text, '你好')
assert.equal(buildSmsChatContext(accountId, 'role-1', '测试角色'), '', '总开关关闭时不得向普通聊天注入短信')
receiveSmsMessage(accountId, roleThread.id, '默认只进收件箱', { source: 'character-reply' })
assert.equal(dispatched.some(event => event.type === 'clingy-sms-notification-request'), false, '默认不得弹出短信打扰')

const scheduled = sendSmsMessage(accountId, roleThread.id, '一会儿见', { scheduledAt: Date.now() + 5000 })
assert.equal(scheduled?.status, 'scheduled')
processScheduledSms(accountId, Date.now() + 6000)
assert.equal(findSmsThread(accountId, roleThread.id)?.messages.at(-1)?.status, 'sent')

updateSmsThread(accountId, roleThread.id, { pinned: true, muted: true })
assert.equal(findSmsThread(accountId, roleThread.id)?.pinned, true)
assert.equal(findSmsThread(accountId, roleThread.id)?.muted, true)
markSmsThreadRead(accountId, roleThread.id, false)
assert.equal(findSmsThread(accountId, roleThread.id)?.unread, true)
markSmsThreadRead(accountId, roleThread.id)
assert.equal(findSmsThread(accountId, roleThread.id)?.unread, false)

assert.equal(receiveRandomStrangerSms(accountId).ok, false, '未开启时不得生成陌生短信')
const enabled = loadSmsSettings(accountId)
enabled.strangerEnabled = true
enabled.strangerDailyLimit = 2
enabled.prankEnabled = true
enabled.prankAllowFriends = true
enabled.allowSmsAffectChat = true
enabled.allowUserPhoneAffectChat = true
enabled.allowInterruptions = true
enabled.quietHoursEnabled = false
saveSmsSettings(accountId, enabled)
assert.match(buildSmsChatContext(accountId, 'role-1', '测试角色'), /用户：你好/, '仅在用户明确开启后桥接对应角色短信')
receiveSmsMessage(accountId, roleThread.id, '静音期间不通知', { source: 'character-reply' })
assert.equal(dispatched.some(event => event.type === 'clingy-sms-notification-request'), false, '会话静音必须压制通知')
updateSmsThread(accountId, roleThread.id, { muted: false })
receiveSmsMessage(accountId, roleThread.id, '允许后的通知', { source: 'character-reply' })
assert.equal(dispatched.some(event => event.type === 'clingy-sms-notification-request'), true, '显式开启后应发出站内通知请求')
assert.equal(receiveRandomStrangerSms(accountId).ok, true)
const prank = startPrankSms(accountId, '测试角色')
assert.equal(prank.ok, true)
if (prank.ok) {
  assert.equal(prank.thread.narrative?.plannerName, '测试角色')
  assert.equal(stopNarrativeSms(accountId, prank.thread.id), true)
  assert.equal(findSmsThread(accountId, prank.thread.id)?.narrative?.ended, true)
}

const manual = createSmsThread(accountId, { name: '临时号码', number: '17112345678' })
assert.equal(clearSmsThread(accountId, manual.id), true)
assert.equal(deleteSmsThread(accountId, manual.id), true)
assert.equal(findSmsThread(accountId, manual.id), null)

const reloaded = loadSmsSettings(accountId)
assert.equal(reloaded.protectActiveChat, true, '开启玩法与通知不得连带关闭聊天保护')
assert.equal(reloaded.allowCharacterPhoneAffectChat, false, '开启用户短信互通不得连带开启角色短信互通')

console.log('sms service tests passed')
