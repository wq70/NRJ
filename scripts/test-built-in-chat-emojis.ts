import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import catalogue from '../src/constants/builtInChatEmojis.json'
import { builtInChatEmojis, builtInEmojiPromptCatalogue, builtInEmojiVisionData, findBuiltInChatEmoji, isBuiltInEmojiResponse, roleEmojiName } from '../src/services/builtInChatEmojis'
import { findRoleEmojiByResponse, selectRoleAvailableEmojis, selectUserSendableEmojis } from '../src/services/chatEmojiScope'

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, String(value)),
  removeItem: (key: string) => storage.delete(key),
  key: (index: number) => [...storage.keys()][index] ?? null,
  get length() { return storage.size }
}, configurable: true })

assert.equal(catalogue.packs.length, 15)
assert.ok(catalogue.packs.every(pack => pack.items.length > 0), '不能出现有分类却没有资源的空表情包')
assert.equal(new Set(builtInChatEmojis.map(item => item.id)).size, builtInChatEmojis.length)
for (const pack of catalogue.packs) {
  for (const item of pack.items) {
    assert.ok(item.name.trim(), '每个表情必须有名称')
    assert.ok(item.file.startsWith(`${pack.id}/`) && !item.file.includes('..'))
    const bytes = await readFile(resolve('public/chat-emojis', item.file))
    assert.ok(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || bytes.subarray(0, 3).toString() === 'GIF'
      || (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'), `${item.id} 必须是真实图片`)
    assert.equal(findBuiltInChatEmoji(item.id)?.previewUrl, `/chat-emojis/${item.file}`)
  }
}

const legacy = [
  { id: 'user', name: '自用', category: 'user' as const },
  { id: 'global', name: '通用', category: 'global' as const },
  { id: 'role-a', name: '专属', category: 'role' as const, ownerCharacterId: 'a' },
  { id: 'role-b', name: '专属', category: 'role' as const, ownerCharacterId: 'b' },
  { id: 'group', name: '群用', category: 'group' as const, groupId: 'g' }
]
assert.deepEqual(selectUserSendableEmojis(legacy, 'g').map(item => item.id), ['user', 'group'])
assert.deepEqual(selectRoleAvailableEmojis(legacy, 'a', { groupId: 'g' }).map(item => item.id), ['global', 'role-a', 'group'])
const sample = builtInChatEmojis[0]!
assert.equal(findRoleEmojiByResponse(legacy, 'a', { id: sample.id }), undefined, '默认关闭角色内置表情权限')
assert.equal(findRoleEmojiByResponse(legacy, 'a', { id: sample.id }, { includeBuiltIn: true })?.id, sample.id)
assert.equal(findRoleEmojiByResponse(legacy, 'a', { name: roleEmojiName(sample) }, { includeBuiltIn: true })?.id, sample.id)
assert.equal(findRoleEmojiByResponse(legacy, 'a', { id: 'role-b' }, { includeBuiltIn: true }), undefined, '新开关不能扩大专属表情权限')
assert.deepEqual(selectRoleAvailableEmojis(legacy, 'a', { groupId: 'g', includePrivateRoleLibrary: false, includeBuiltIn: true }).slice(0, 2).map(item => item.id), ['global', 'group'])
const promptCatalogue = builtInEmojiPromptCatalogue()
const reference = promptCatalogue.split('、')[0]!.split('=').at(-1)!
assert.equal(findRoleEmojiByResponse(legacy, 'a', { id: reference }, { includeBuiltIn: true })?.id, sample.id)
assert.equal(findRoleEmojiByResponse(legacy, 'a', { id: reference }), undefined)
assert.ok(isBuiltInEmojiResponse(sample.id, ''))
assert.ok(isBuiltInEmojiResponse(reference, ''))
assert.ok(isBuiltInEmojiResponse('', sample.protocolName))
assert.equal(isBuiltInEmojiResponse('global', '通用'), false, '后台权限检查不能改变旧表情的处理')
const qqSmile = builtInChatEmojis.find(item => item.packId === 'qq' && item.name === sample.name)
if (qqSmile) assert.equal(findRoleEmojiByResponse([], 'a', { name: roleEmojiName(qqSmile) }, { includeBuiltIn: true })?.id, qqSmile.id, '同名的平台表情应能区分')

const { builtInEmojiRecentIds, recordBuiltInEmojiUsage, BUILT_IN_EMOJI_RECENT_KEY } = await import('../src/composables/useBuiltInEmojiRecent')
for (const emoji of builtInChatEmojis.slice(0, 30)) recordBuiltInEmojiUsage(emoji.id)
recordBuiltInEmojiUsage(sample.id)
recordBuiltInEmojiUsage('user')
assert.equal(builtInEmojiRecentIds.value.length, 24)
assert.equal(builtInEmojiRecentIds.value[0], sample.id)
assert.equal(new Set(builtInEmojiRecentIds.value).size, 24)
assert.deepEqual(JSON.parse(storage.get(BUILT_IN_EMOJI_RECENT_KEY)!), builtInEmojiRecentIds.value)

let imageFetches = 0
Object.defineProperty(globalThis, 'fetch', { configurable: true, value: async (url: string) => {
  assert.equal(url, sample.previewUrl)
  imageFetches++
  return { ok: true, blob: async () => new Blob(['image']) }
} })
Object.defineProperty(globalThis, 'FileReader', { configurable: true, value: class {
  result = 'data:image/webp;base64,aW1hZ2U='
  onload: (() => void) | undefined
  readAsDataURL() { this.onload?.() }
} })
Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
  src = ''; naturalWidth = 128; naturalHeight = 128
  async decode() {}
} })
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  createElement: () => ({ getContext: () => ({ drawImage() {} }), toDataURL: () => 'data:image/png;base64,c3RhdGlj' })
} })
assert.deepEqual(await Promise.all([builtInEmojiVisionData(sample.id), builtInEmojiVisionData(sample.id)]), ['data:image/png;base64,c3RhdGlj', 'data:image/png;base64,c3RhdGlj'])
assert.equal(imageFetches, 1, '只读取选中的表情并复用并发转换')
assert.equal(await builtInEmojiVisionData('missing'), '')

const { buildGroupChatMessages, createGroupChat } = await import('../src/services/groupChat')
const members = [{ id: 'a', name: '甲', allowBuiltInEmojis: true }, { id: 'b', name: '乙', allowBuiltInEmojis: true }, { id: 'c', name: '丙' }]
const group = createGroupChat({ name: '表情测试', memberIds: ['a', 'b', 'c'] }, { name: '用户' })
group.memberSettings.b = { allowBuiltInEmojis: false }
let payload = await buildGroupChatMessages(group, members, { name: '用户' })
const system = String(payload[0].content)
assert.equal(system.split('【共享内置表情目录】').length - 1, 1, '群聊不能为每位成员重复添加整套内置目录')
assert.match(system, /仅授权成员 ID：a。/)
assert.ok(system.includes(`${sample.protocolName}=${reference}`))
group.memberSettings.a = { allowBuiltInEmojis: false }
payload = await buildGroupChatMessages(group, members, { name: '用户' })
assert.ok(!String(payload[0].content).includes('【共享内置表情目录】'), '关闭后不能将目录继续提供给角色')
console.log(`Built-in emoji checks passed: ${builtInChatEmojis.length} images, scopes, recent history, vision conversion and group authorization.`)
