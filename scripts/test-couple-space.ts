/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'

class MemoryStorage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
}

const storage = new MemoryStorage()
;(globalThis as any).localStorage = storage
;(globalThis as any).window = new EventTarget()
if (typeof (globalThis as any).CustomEvent === 'undefined') {
  ;(globalThis as any).CustomEvent = class<T> extends Event {
    detail: T
    constructor(type: string, init?: { detail?: T }) { super(type); this.detail = init?.detail as T }
  }
}

storage.setItem('clingy_chat_auth_state', 'user-a')
const couple = await import('../src/services/coupleSpace')

assert.equal(couple.coupleModuleCatalog.length, 30, '情侣空间应保留30个独立原生模块')
assert.equal(new Set(couple.coupleModuleCatalog.map(item => item.id)).size, 30, '模块ID必须唯一')
assert.deepEqual(new Set(couple.coupleModuleCatalog.map(item => item.group)), new Set(['exchange', 'create', 'play', 'life', 'nurture', 'repair']), '六个功能区域必须完整')
assert.equal(couple.buildCoupleChatContext({ id: 'role-a' }), '', '未授权时普通聊天上下文必须为零')

couple.loadCoupleSpaces(true)
const chat = { id: 'role-a', name: '测试角色', realName: '测试角色', persona: '有独立判断，不机械迎合' }
const space = couple.createCoupleSpace({ chat, userNickname: '我', characterNickname: 'TA', title: '我们的空间', declaration: '认真相处', anniversary: '2026-01-01' })
assert.equal(space.status, 'pending')
assert.equal(space.bridge.chatKnowsRelationship, false)
assert.equal(space.bridge.chatReadsMemories, false)
assert.equal(space.autonomy.allowCharacterInvites, false)
assert.equal(space.privacy.adultTopics, false)
assert.equal(Object.values(space.enabledModules).filter(Boolean).length, 30)

couple.respondToCoupleInvite(space, true, '接受')
assert.equal(couple.buildCoupleChatContext(chat), '', '接受邀请不应自动开放聊天桥接')
space.bridge.chatKnowsRelationship = true
space.bridge.tokenBudget = 100
couple.persistCoupleSpaces()
assert.match(couple.buildCoupleChatContext(chat), /已建立独立情侣空间/)

const privateEntry = couple.createCoupleEntry(space, { moduleId: 'exchange-diary', title: '私密日记', content: '不应进入聊天', memoryPermission: 'private' })
space.bridge.chatReadsMemories = true
couple.persistCoupleSpaces()
assert.doesNotMatch(couple.buildCoupleChatContext(chat), /不应进入聊天/)
couple.updateCoupleEntry(space, privateEntry, { memoryPermission: 'chat-allowed', status: 'completed' })
assert.match(couple.buildCoupleChatContext(chat), /不应进入聊天/)

const checklist = couple.createCoupleEntry(space, { moduleId: 'hundred-things', title: '共同清单', content: '一起做事', checklist: [{ id: 'one', text: '完成一件小事', userDone: false, partnerDone: false }] })
assert.equal(checklist.checklist?.length, 1)
const stats = couple.rewardModuleActivity(space, 'shared-pet', '团团', 108)
assert.equal(stats.level, 2)
assert.equal(stats.progress, 8)
couple.updateCoupleSpace(space, { status: 'ended', endedAt: Date.now() })
assert.equal(couple.buildCoupleChatContext(chat), '', '空间结束后聊天桥接必须立即失效')
await couple.deleteCoupleSpace(space)
assert.equal(couple.useCoupleSpace().state.value.spaces.length, 0, '永久删除应移除空间数据')

console.log('couple-space: 30 modules, consent defaults, persistence, entries, nurture and chat isolation passed')
