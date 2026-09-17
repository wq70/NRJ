/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { defaultWatchTogetherSettings } from '../src/types/watchTogether'
import { buildWatchTogetherChatContext, createDefaultWatchTogetherState, normalizeWatchTogetherState } from '../src/services/watchTogetherRepository'
import { createWatchTogetherUrlItem } from '../src/services/watchTogetherSearch'

class MemoryStorage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(key: string) { return this.data.get(key) ?? null }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  removeItem(key: string) { this.data.delete(key) }
  setItem(key: string, value: string) { this.data.set(key, String(value)) }
}

Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true })

const defaults = defaultWatchTogetherSettings()
assert.equal(defaults.enabled, false, '共赏总开关必须默认关闭')
assert.deepEqual(defaults.modules, { novel: false, video: false, comic: false, audio: false }, '四个板块必须全部默认关闭')
assert.equal(defaults.onlineSearch, false, '在线搜索不得默认请求公共来源')
assert.equal(defaults.companionEnabled, false, '角色陪伴不得默认占用注意力')
assert.equal(defaults.chatReadsMemory, false, '普通聊天不得默认读取共赏记忆')

const normalized = normalizeWatchTogetherState({ version: 1, settings: { enabled: true, modules: { novel: true } } as any })
assert.equal(normalized.settings.enabled, true, '已有总开关设置应被保留')
assert.equal(normalized.settings.modules.novel, true, '已有板块设置应被保留')
assert.equal(normalized.settings.modules.video, false, '缺失的板块设置必须安全补齐为关闭')
assert.deepEqual(createDefaultWatchTogetherState().items, [], '新账号不能出现虚构内容')

const bridgeKey = 'clingy_watch_together_bridge_v1_account_test'
localStorage.setItem(bridgeKey, JSON.stringify({
  enabled: true,
  chatReadsMemory: true,
  memories: [
    { characterId: 'char_a', summary: '一起看完了雨夜章节。' },
    { characterId: 'char_b', summary: '这是另一个角色的私人记忆。' }
  ]
}))
const context = buildWatchTogetherChatContext({ id: 'chat_a', characterEntityId: 'char_a' }, 'account_test')
assert.match(context, /雨夜章节/, '只应读取当前角色被授权的共赏记忆')
assert.doesNotMatch(context, /另一个角色/, '不得泄露其他角色的共赏记忆')
localStorage.setItem(bridgeKey, JSON.stringify({ enabled: false, chatReadsMemory: true, memories: [{ characterId: 'char_a', summary: '不应出现' }] }))
assert.equal(buildWatchTogetherChatContext({ characterEntityId: 'char_a' }, 'account_test'), '', '总开关关闭时提示词必须完全隔离')

const youtube = createWatchTogetherUrlItem('video', 'https://www.youtube.com/watch?v=abcdefghijk', '测试影片')
assert.equal(youtube.access, 'embed', 'YouTube 链接应使用官方嵌入播放')
assert.match(youtube.mediaUrl, /youtube\.com\/embed\/abcdefghijk/, '嵌入地址应保留正确视频 ID')
const hls = createWatchTogetherUrlItem('video', 'https://media.example.com/movie/master.m3u8')
assert.equal(hls.access, 'direct', 'HLS 地址应直接交给播放器')
assert.equal(hls.mimeType, 'application/vnd.apple.mpegurl', 'HLS 应携带正确媒体类型')

console.log('watch together tests passed')
