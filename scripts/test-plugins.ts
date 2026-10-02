import assert from 'node:assert/strict'
import vm from 'node:vm'
import localforage from 'localforage'
import JSZip from 'jszip'
import { readFileSync } from 'node:fs'
import { createPluginExample } from '../src/services/pluginExamples'
import { exportPluginPackage, readPluginPackage, validatePluginManifest, validatePluginPackage, PLUGIN_LIMITS } from '../src/services/pluginPackage'
import { assertPluginMethod, createPluginSdkSource, pluginChatMessages } from '../src/services/pluginRuntime'
import type { InstalledPlugin } from '../src/types/plugins'

// 模拟本机存储，验证真实仓库逻辑；不接触用户数据。
const stores = new Map<string, Map<string, unknown>>()
let failWrite = false
localforage.createInstance = ((options: { storeName: string }) => {
  const data = new Map<string, unknown>(); stores.set(options.storeName, data)
  return {
    iterate: async (callback: (value: unknown, key: string) => void) => { for (const [key, value] of data) callback(structuredClone(value), key) },
    getItem: async (key: string) => data.has(key) ? structuredClone(data.get(key)) : null,
    setItem: async (key: string, value: unknown) => { if (failWrite) throw new Error('模拟存储写入失败'); data.set(key, structuredClone(value)); return value },
    removeItem: async (key: string) => { data.delete(key) }
  }
}) as typeof localforage.createInstance
const repo = await import('../src/services/pluginRepository')
const notes = createPluginExample('notes'), chat = createPluginExample('chat')
assert.deepEqual(JSON.parse(JSON.stringify(validatePluginPackage(notes).manifest)), notes.manifest)
const roundtrip = await readPluginPackage(await (await exportPluginPackage(chat)).arrayBuffer())
assert.deepEqual(JSON.parse(JSON.stringify(roundtrip.manifest)), chat.manifest)
assert.equal(roundtrip.files['index.html'].base64, chat.files['index.html'].base64)
assert.throws(() => validatePluginManifest({ ...chat.manifest, permissions: ['api.key'] }), /权限/)
assert.throws(() => validatePluginManifest({ ...chat.manifest, extensions: [{ target: 'music', label: '工具' }] }), /尚未开放/)
assert.throws(() => validatePluginManifest({ ...notes.manifest, entry: '../index.html' }), /入口/)
assert.throws(() => validatePluginPackage({ ...notes, files: {} }), /不存在/)
const badPath = new JSZip(); badPath.file('../index.html', 'bad'); badPath.file('manifest.json', JSON.stringify(notes.manifest))
await assert.rejects(() => badPath.generateAsync({ type: 'arraybuffer' }).then(readPluginPackage), /路径/)
const bomb = new JSZip(); bomb.file('index.html', 'x'.repeat(PLUGIN_LIMITS.file + 1)); bomb.file('manifest.json', JSON.stringify(notes.manifest))
await assert.rejects(() => bomb.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }).then(readPluginPackage), /大小/)

stores.get('plugins')!.set('broken', { manifest: null })
await repo.loadPlugins()
assert.match(repo.pluginLoadState.error, /损坏/)
assert.equal(repo.installedPlugins.value.length, 0)
await repo.installPlugin(notes, [])
await Promise.all([repo.setPluginData(notes.manifest.id, 'a', 1), repo.setPluginData(notes.manifest.id, 'b', 2)])
assert.equal(await repo.getPluginData(notes.manifest.id, 'a'), 1)
assert.equal(await repo.getPluginData(notes.manifest.id, 'b'), 2)
assert.equal(await repo.getPluginData(chat.manifest.id, 'a'), null)
await assert.rejects(() => repo.setPluginData(notes.manifest.id, '__proto__', 'bad'), /键/)
await assert.rejects(() => repo.setPluginData(notes.manifest.id, 'large', 'x'.repeat(1024 * 1024)), /1 MB/)
const updated = { ...notes, manifest: { ...notes.manifest, version: '2.0.0' } }
const firstInstalledAt = repo.findPlugin(notes.manifest.id)!.installedAt
failWrite = true
await assert.rejects(() => repo.installPlugin(updated, []), /写入失败/)
assert.equal(repo.findPlugin(notes.manifest.id)!.manifest.version, '1.0.0', '失败的更新必须保留原插件')
failWrite = false
await repo.configurePlugin(notes.manifest.id, false, [])
await assert.rejects(() => repo.setPluginData(notes.manifest.id, 'a', 3), /停用/)
await repo.installPlugin(updated, [])
assert.equal(repo.findPlugin(notes.manifest.id)!.enabled, false)
assert.equal(repo.findPlugin(notes.manifest.id)!.installedAt, firstInstalledAt)
assert.equal(await repo.getPluginData(notes.manifest.id, 'a'), 1)
await repo.rollbackPlugin(notes.manifest.id)
assert.equal(repo.findPlugin(notes.manifest.id)!.manifest.version, '1.0.0')
await repo.uninstallPlugin(notes.manifest.id)
assert.equal(repo.pluginDesktopApps.value.length, 0)
await repo.installPlugin(notes, [])
assert.equal(await repo.getPluginData(notes.manifest.id, 'a'), 1, '保留数据后重新安装应恢复数据')
await repo.clearPluginData(notes.manifest.id)
assert.equal(await repo.getPluginData(notes.manifest.id, 'a'), null)
const chatRecord = await repo.installPlugin(chat, [])
assert.equal(repo.enabledChatPlugins.value.length, 1)
assert.throws(() => assertPluginMethod(chatRecord, 'chat.getMessages', true), /权限/)
await repo.configurePlugin(chat.manifest.id, true, ['chat.read', 'chat.draft'])
const granted = repo.findPlugin(chat.manifest.id)!
assert.doesNotThrow(() => assertPluginMethod(granted, 'chat.getMessages', true))
assert.throws(() => assertPluginMethod(granted, 'chat.getMessages', false), /聊天/)
assert.throws(() => assertPluginMethod(granted, 'storage.constructor', true), /不支持/)
assert.throws(() => assertPluginMethod({ ...granted, enabled: false } as InstalledPlugin, 'storage.get', true), /停用/)
assert.throws(() => assertPluginMethod(undefined, 'storage.get', false), /卸载/)
await repo.configurePlugin(chat.manifest.id, false, granted.grants)
assert.equal(repo.enabledChatPlugins.value.length, 0)
await repo.installPlugin({ ...chat, manifest: { ...chat.manifest, version: '2', permissions: ['files.download'] } }, granted.grants)
assert.deepEqual(repo.findPlugin(chat.manifest.id)!.grants, [], '更新只能保留仍声明的权限')

const snapshot = pluginChatMessages({ id: 1, name: '测试聊天', messages: [
  { id: 1, type: 'right', content: '你好', timestamp: 10 },
  { id: 2, type: 'left', messageType: 'image', content: 'data:image/png;secret' },
  { id: 3, type: 'left', content: '回复' }
] }, 0, 2)
assert.equal(snapshot.hasMore, true)
assert.equal(snapshot.messages[0].sender, 'user')
assert.equal(snapshot.messages[1].text, '[image]', '只读取文字，不暴露媒体资源')
assert.equal(pluginChatMessages({ messages: Array.from({ length: 300 }, () => ({ content: 'text' })) }, 0, 999).messages.length, 200)

// 在隔离 JS 环境中验证 SDK：伪造来源与错误会话不能完成请求。
const handlers = new Map<string, (event: any) => void>()
const requests: any[] = []
const parent = { postMessage: (message: unknown) => requests.push(message) }
const sandbox = { parent, window: {} as any, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler), setTimeout, clearTimeout, console }
vm.runInNewContext(createPluginSdkSource('test-session'), sandbox)
const result = sandbox.window.nrj.storage.get('key')
const request = requests[0]
handlers.get('message')!({ source: {}, data: { ...request, result: 'forged' } })
handlers.get('message')!({ source: parent, data: { ...request, session: 'wrong', result: 'forged' } })
handlers.get('message')!({ source: parent, data: { ...request, result: 'valid' } })
assert.equal(await result, 'valid')
const denied = sandbox.window.nrj.chat.insertText('draft')
const deniedAssertion = assert.rejects(denied, /拒绝/)
handlers.get('message')!({ source: parent, data: { ...requests[1], error: '拒绝' } })
await deniedAssertion

// 从真实已有布局开始，验证插件安装/卸载不改变旧 APP、小组件和隐藏状态。
const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) }, configurable: true })
Object.defineProperty(globalThis, 'window', { value: { addEventListener: () => undefined }, configurable: true })
storage.set('clingy_desktop_layout_v2', JSON.stringify({ version: 2, dock: [{ type: 'app', id: 'chat' }], hiddenAppIds: ['plugin:hidden.notes'], pages: [
  { id: 'custom', entries: [{ type: 'app', id: 'music', column: 3, row: 2 }, { type: 'app', id: 'plugin:example.notes', column: 4, row: 3 }] },
  { id: 'two', entries: [] }, { id: 'three', entries: [] }, { id: 'four', entries: [] }, { id: 'five', entries: [] }, { id: 'six', entries: [] }
] }))
const { useDesktopLayout } = await import('../src/composables/useDesktopLayout')
const { appRegistry } = await import('../src/appRegistry')
const desktop = useDesktopLayout()
desktop.initialize(appRegistry.map(app => app.id))
assert(desktop.layout.hiddenAppIds.includes('plugin:hidden.notes'))
assert.equal(desktop.layout.pages.findIndex(page => page.entries.some(entry => entry.id === 'plugins')), 5, '管理入口应加到现有最后一页')
desktop.syncPluginApps(['plugin:example.notes', 'plugin:new.notes', 'plugin:hidden.notes'], [])
const oldPlugin = desktop.layout.pages[0].entries.find(entry => entry.id === 'plugin:example.notes')!
assert.deepEqual({ column: oldPlugin.column, row: oldPlugin.row }, { column: 4, row: 3 })
assert.equal(desktop.layout.pages.flatMap(page => page.entries).filter(entry => entry.id === 'plugin:example.notes').length, 1)
assert(!desktop.layout.pages.flatMap(page => page.entries).some(entry => entry.id === 'plugin:hidden.notes'))
assert.equal(desktop.layout.pages[0].entries.find(entry => entry.id === 'music')!.column, 3)
desktop.syncPluginApps([], ['plugin:new.notes'])
assert(!desktop.layout.pages.flatMap(page => page.entries).some(entry => entry.id === 'plugin:new.notes'))
const folder = desktop.createFolder({ area: 'page', pageId: 'custom', entryId: 'plugin:example.notes' }, { area: 'page', pageId: 'custom', entryId: 'music' })
assert(folder)
desktop.syncPluginApps([], ['plugin:example.notes'])
assert.equal(desktop.layout.pages[0].entries.find(entry => entry.id === 'music')!.column, 3, '卸载文件夹内的插件必须保留剩余 APP')
const manyPlugins = Array.from({ length: 40 }, (_, index) => `plugin:test.app${index}`)
desktop.reset([...appRegistry.map(app => app.id), ...manyPlugins])
for (const id of manyPlugins) assert(desktop.layout.pages.some(page => page.entries.some(entry => entry.id === id)), '重置布局不能丢失大量插件')

const inputSource = readFileSync(new URL('../src/components/chat/room/ChatRoomInputArea.vue', import.meta.url), 'utf8')
for (const oldFeature of ['转账/红包', '发语音', '发图片', '语音通话', '视频通话', '联网搜索', '模型沟通', '一起听']) assert(inputSource.includes(oldFeature), `保留原聊天入口：${oldFeature}`)
assert(inputSource.includes('pluginPages') && inputSource.includes('@insert-text="insertPluginText"'))
const backup = readFileSync(new URL('../src/composables/useDataBackup.ts', import.meta.url), 'utf8')
assert(backup.includes("storeName: 'plugins'") && backup.includes("storeName: 'pluginData'"))
console.log('Plugin package, persistence, permissions, SDK, desktop compatibility and chat integration tests passed')
