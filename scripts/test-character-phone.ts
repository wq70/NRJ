import assert from 'node:assert/strict'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, String(value)) },
  removeItem: (key: string) => { memory.delete(key) },
  clear: () => memory.clear(),
  key: (index: number) => [...memory.keys()][index] ?? null,
  get length() { return memory.size }
} })

const { createManualPhoneDevice, parsePhoneReadRequests } = await import('../src/services/characterPhone')
const { defaultCharacterPhoneSettings } = await import('../src/services/characterPhoneRepository')

const device = createManualPhoneDevice()
assert.equal(device.lockType, 'none', '手建设备不得强制存在密码')
assert.ok(device.apps.some(app => app.id === 'chat'), '手建设备必须可进入聊天 APP')
assert.ok(device.apps.some(app => app.id === 'settings'), '手建设备必须可进入设置 APP')
assert.ok(device.apps.every(app => app.refreshMode === 'manual'), 'APP 默认不得在未授权时自动调用 API')

const parsed = parsePhoneReadRequests('先看看<read_phone app_id="chat" target="unread"/>再决定')
assert.equal(parsed.cleaned, '先看看再决定')
assert.deepEqual(parsed.requests, [{ appId: 'chat', target: 'unread' }])

const settings = defaultCharacterPhoneSettings()
assert.equal(settings.allowUseDuringChat, false, '手机不得默认影响单聊')
assert.equal(settings.allowBackgroundUse, false, '手机不得默认参与后台活动')
assert.equal(settings.bridgeToChat, false, '手机事件桥接必须由用户显式开启')
assert.equal(settings.allowDeepReadFollowup, false, '额外读取调用必须由用户显式开启')
assert.ok(settings.contextTokenBudget > 0 && settings.contextTokenBudget <= 1000, '默认上下文预算应保持克制')

const { markPhoneEntrySeen, phoneEntrySeen, phoneResourceUrl, preservePhoneManualEntries, phoneEntryMatches, phoneEntryDate, localPhoneDate } = await import('../src/services/characterPhonePresentation')
const unreadEntry = { id: 'original', title: '旅行照片', content: '下雨的城市', createdAt: 1000, read: false, meta: { generated: true } }
markPhoneEntrySeen(unreadEntry)
assert.equal(phoneEntrySeen(unreadEntry), true)
assert.equal(unreadEntry.read, false, '用户浏览不得替角色标记已读')
assert.equal(phoneEntryMatches(unreadEntry, '下雨'), true)
assert.equal(phoneResourceUrl('javascript:alert(1)'), '', '关联资源不得执行脚本')
assert.equal(phoneResourceUrl('data:text/html,test', true), '')
assert.equal(phoneResourceUrl('data:image/svg+xml,<svg/>', true), '')
assert.equal(phoneResourceUrl('https://example.com/photo.png', true), 'https://example.com/photo.png')
assert.equal(localPhoneDate(phoneEntryDate({ ...unreadEntry, meta: { startAt: '2026-10-02T09:30' } })), '2026-10-02')
const oldDevice = createManualPhoneDevice('旧设备')
oldDevice.apps.find(a => a.id === 'notes')!.entries = [
  { ...unreadEntry, id: 'generated' },
  { ...unreadEntry, id: 'manual', meta: { generated: false } },
  { id: 'legacy', title: '旧格式记录', createdAt: 2000 }
]
oldDevice.apps.push({ ...oldDevice.apps[0]!, id: 'custom-app', builtIn: false, entries: [] })
const freshDevice = createManualPhoneDevice('生成设备')
const preserved = preservePhoneManualEntries(oldDevice, freshDevice)
assert.deepEqual(preserved.apps.find(a => a.id === 'notes')!.entries.map(e => e.id), ['manual', 'legacy'], '保留手动及来源不明的旧记录')
assert.ok(preserved.apps.some(a => a.id === 'custom-app'), '保留独立自定义应用')
assert.equal(freshDevice.apps.find(a => a.id === 'notes')!.entries.length, 0, '应用预览不得污染原结果')
assert.equal(oldDevice.apps.find(a => a.id === 'notes')!.entries.length, 3, '原设备不能被预览修改')

console.log('character phone checks passed')
