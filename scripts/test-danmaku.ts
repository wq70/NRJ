/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { computed, createRenderer, nextTick, ref } from 'vue'
import { createDanmakuSnapshot, defaultDanmakuSettings, defaultDanmakuViewers } from '../src/types/danmaku'
import type { DanmakuSource, DanmakuSnapshot } from '../src/types/danmaku'
import { buildDanmakuMessages, danmakuScope, eventHash, localDanmakuReply, normalizeDanmakuSettings, normalizeDanmakuSnapshot, parseDanmakuReply, pruneDanmakuSnapshot, selectDanmakuCast, validDanmakuComments } from '../src/services/danmakuRuntime'
import { chatDanmakuSource, gameDanmakuSource, storyDanmakuSource, watchDanmakuSource } from '../src/services/danmakuSources'
import { markDanmakuChatComplete } from '../src/services/danmakuSignals'

const defaults = defaultDanmakuSettings()
const viewers = defaultDanmakuViewers()
const source: DanmakuSource = { scene: 'game', sessionId: 'test', branchId: 'main', title: '本场', events: [{ id: 'e1', actor: '甲', text: '我选A', kind: 'speech', options: ['A', 'B'] }], triggerId: 'e1', ready: true, busy: false }
assert.equal(defaults.enabled, false)
assert.equal(defaults.generation, 'manual')
assert.equal(normalizeDanmakuSettings({ count: 999, maxLength: -1, cooldownSeconds: NaN }).count, 8)
assert.equal(normalizeDanmakuSettings({ maxLength: -1 }).maxLength, 8)
assert.equal(normalizeDanmakuSettings({ cooldownSeconds: NaN }).cooldownSeconds, 20)
assert.equal(normalizeDanmakuSnapshot(null).defaults.enabled, false)
const malicious = JSON.stringify({ comments: [{ viewerId: 'unknown', text: '不应通过' }, { viewerId: viewers[0]!.id, text: '<b>看看这个</b>', kind: 'vote', choice: '隐藏C' }, { viewerId: viewers[0]!.id, text: '<b>看看这个</b>', kind: 'reaction', replyToId: 'unknown' }, { viewerId: viewers[1]!.id, text: '看看这个', kind: 'reaction' }] })
const parsed = parseDanmakuReply(malicious, source, defaults, viewers, [])
assert.equal(parsed.length, 1, 'Unknown viewers, duplicate comments and invalid voting choices must be rejected')
assert.equal(parsed[0]!.text, '看看这个')
assert.equal(parsed[0]!.replyToId, null)
assert.throws(() => parseDanmakuReply('{bad', source, defaults, viewers, []))
assert.equal(validDanmakuComments(source, parsed).length, 1)
assert.equal(validDanmakuComments({ ...source, events: [{ ...source.events[0]!, text: '重写答案' }] }, parsed).length, 0)
assert.notEqual(danmakuScope(source), danmakuScope({ ...source, branchId: 'fork' }))
const chat = { id: 7, name: '角色', innerThoughts: [{ content: 'SECRET_THOUGHT' }], messages: [{ id: 1, type: 'right', content: '公开提问' }, { id: 2, type: 'left', turnId: 't1', content: '公开回复' }, { id: 3, type: 'system', isHidden: true, content: 'SECRET_HIDDEN' }, { id: 4, type: 'left', isRecalled: true, content: 'SECRET_RECALLED' }, { id: 5, type: 'right', isUndelivered: true, content: 'SECRET_UNDELIVERED' }] }
const chatSource = chatDanmakuSource(chat, '我', false, false)
assert.equal(chatSource.autoToken, '')
markDanmakuChatComplete(chat, 't1')
assert.notEqual(chatDanmakuSource(chat, '我', false, false).autoToken, '')
chat.messages[1]!.content = '编辑后未确认的回复'
assert.equal(chatDanmakuSource(chat, '我', false, false).autoToken, '')
const chatPayload = JSON.stringify(buildDanmakuMessages(chatSource, defaults, viewers, []))
assert.equal(chatPayload.includes('SECRET_'), false, 'Hidden thoughts, recalled and undelivered messages must not enter the model request')
const game: any = { id: 'game', status: 'playing', round: 2, completedTurns: 1, participants: [], currentCard: { prompt: '下一题' }, messages: [{ id: 'answer', senderName: '甲', kind: 'speech', content: '原题回答', danmakuPublicPrompt: '原题', danmakuPublicOptions: ['A', 'B'] }], undercover: { undercoverIds: ['SECRET_ROLE'], commonWord: 'SECRET_WORD' }, twentyOne: { deck: ['SECRET_DECK'] } }
const gameSource = gameDanmakuSource(game, false, true)
const gamePayload = JSON.stringify(buildDanmakuMessages(gameSource, defaults, viewers, []))
assert.equal(gamePayload.includes('SECRET_'), false)
assert.equal(gamePayload.includes('下一题'), false, 'A completed answer must retain its original prompt, not the next card')
assert.equal(gamePayload.includes('原题'), true)
const project: any = { id: 'story', title: '故事', nodes: [{ id: 'a', speaker: '旁白', text: '开场' }, { id: 'b', speaker: '甲', text: '公开分支' }, { id: 'hidden', text: 'SECRET_ENDING' }] }
const run: any = { startedAt: 100, currentNodeId: 'a', history: [], variables: { secret: 'SECRET_VARIABLE' } }
const opening = storyDanmakuSource(project, run, true)
const openingComment = parseDanmakuReply(JSON.stringify({ comments: [{ viewerId: viewers[0]!.id, text: '开场不错' }] }), opening, defaults, viewers, [])
run.history.push({ nodeId: 'a', visitedAt: 200, choiceText: '走左边' }); run.currentNodeId = 'b'
const branch = storyDanmakuSource(project, run, true)
assert.equal(validDanmakuComments(branch, openingComment).length, 1, 'Earlier comments should survive forward progression')
assert.equal(JSON.stringify(buildDanmakuMessages(branch, defaults, viewers, [])).includes('SECRET_'), false)
run.history = []; run.currentNodeId = 'a'
assert.equal(validDanmakuComments(storyDanmakuSource(project, run, true), openingComment).length, 1, 'Rollback should restore the opening comment without regenerating')
const watchSource = watchDanmakuSource({ id: 'book', title: '书' }, { id: 'chapter', text: 'SECRET_FULL_CHAPTER' }, [], false, true, false, undefined, '可见正文')
assert.equal(watchSource.events.length, 0)
const allowedWatch = watchDanmakuSource({ id: 'book', title: '书' }, { id: 'chapter', text: 'SECRET_FULL_CHAPTER' }, [], true, true, false, undefined, '可见正文')
assert.equal(JSON.stringify(allowedWatch).includes('SECRET_FULL_CHAPTER'), false)
const constrained = normalizeDanmakuSettings({ maxInputChars: 500 })
const largeSource = { ...source, events: [{ ...source.events[0]!, text: '字'.repeat(2000) }] }
assert.equal(JSON.parse(buildDanmakuMessages(largeSource, constrained, viewers, [])[1]!.content).currentEvent.text.length, 500)
let seed = 1234
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
const seen = new Set<string>(); const phrases = new Set<string>()
for (let index = 0; index < 100; index++) {
  const cast = selectDanmakuCast(viewers, { ...defaults, randomCast: true }, random)
  assert.equal(new Set(cast.map(v => v.id)).size, cast.length)
  cast.forEach(v => seen.add(v.id))
  JSON.parse(localDanmakuReply(viewers, defaults, random)).comments.forEach((c: any) => phrases.add(c.text))
}
assert.equal(seen.size, viewers.length, 'Continuous use should not exclude the less active viewers')
assert.equal(phrases.size, 10, 'Local comments should rotate instead of remaining fixed')
const retained = createDanmakuSnapshot()
retained.sessions.one = { scene: 'chat', title: '旧会话', settings: { retentionDays: 1 }, comments: [{ ...parsed[0]!, createdAt: 1 }, { ...parsed[0]!, id: 'favorite', createdAt: 1, favorite: true }], requests: 0, lastRequestAt: 0, updatedAt: 1 }
assert.equal(pruneDanmakuSnapshot(retained).sessions.one!.comments.length, 1)

// Run the real Vue composable with only API/storage/auth replaced; no server, real account or network is touched.
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const harness: any = { accountId: ref('qa-account'), snapshots: new Map<string, DanmakuSnapshot>(), createSnapshot:createDanmakuSnapshot, calls: [], send: async (...args: any[]) => { harness.calls.push(args); return { content: JSON.stringify({ comments: [{ viewerId: viewers[0]!.id, text: `公开评论${harness.calls.length}`, kind: 'reaction' }] }) } } }
;(globalThis as any).__danmakuHarness = harness
const testDir = await mkdtemp(join(tmpdir(), 'clingy-danmaku-tests-'))
const bundlePath = join(testDir, 'composable.cjs')
const require = createRequire(import.meta.url)
const bundle = await build({ entryPoints: [resolve('src/composables/useDanmaku.ts')], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent', plugins: [{ name: 'isolated-danmaku-dependencies', setup(builder) {
  builder.onResolve({ filter: /^vue$/ }, () => ({ path: require.resolve('vue'), external: true }))
  builder.onResolve({ filter: /(?:useChatAuth|danmakuRepository|\/api)$/ }, args => ({ path: args.path, namespace: 'dm-test' }))
  builder.onLoad({ filter: /.*/, namespace: 'dm-test' }, args => ({ contents: args.path.endsWith('useChatAuth') ? 'export const useChatAuth=()=>({currentChatUserId:globalThis.__danmakuHarness.accountId})' : args.path.endsWith('danmakuRepository') ? 'export const loadDanmakuSnapshot=async id=>JSON.parse(JSON.stringify(globalThis.__danmakuHarness.snapshots.get(id)||globalThis.__danmakuHarness.createSnapshot())); export const saveDanmakuSnapshot=async(id,value)=>{globalThis.__danmakuHarness.snapshots.set(id,JSON.parse(JSON.stringify(value)))}' : 'export const sendCapabilityMessage=(...args)=>globalThis.__danmakuHarness.send(...args)', loader: 'ts' }))
} }] })
await writeFile(bundlePath, bundle.outputFiles[0]!.contents)
const { useDanmaku } = require(bundlePath)
const node = () => ({ children: [] as any[], parent: null as any })
const renderer = createRenderer<any, any>({ createElement: node, createText: node, createComment: node, insert(child, parent) { parent.children.push(child); child.parent = parent }, remove(child) { if (child.parent) child.parent.children = child.parent.children.filter((c: any) => c !== child) }, setText() {}, setElementText() {}, parentNode: child => child.parent, nextSibling: () => null, patchProp() {} })
const sourceRef = ref<DanmakuSource>(clone(source))
let dm: any
const app = renderer.createApp({ setup() { dm = useDanmaku(computed(() => sourceRef.value)); return () => null } })
app.mount(node())
const flush = async () => { await nextTick(); await new Promise(resolve => setTimeout(resolve, 0)); await nextTick() }
try {
  await flush(); assert.equal(dm.ready.value, true)
  await dm.generate(); assert.equal(harness.calls.length, 0, 'Disabled mode must never call the API')
  dm.update({ enabled: true }); await flush()
  await dm.generate(); assert.equal(harness.calls.length, 1, JSON.stringify({settings:dm.settings.value,error:dm.error.value,notice:dm.notice.value,busy:dm.busy.value,requests:dm.session.value?.requests}))
  assert.equal(harness.calls[0][0], 'danmaku-generation')
  assert.equal(harness.calls[0][2].purpose, 'prompt-generation', 'Audience requests must not use chat tool dispatch')
  assert.equal(harness.calls[0][2].payloadReady, true, 'Audience requests must not inherit chat thought prompts')
  await dm.generate(); assert.equal(harness.calls.length, 1, 'A cached batch must not consume another request')
  dm.session.value.lastRequestAt = 0
  await dm.generate(true); assert.equal(harness.calls.length, 2)
  assert.equal(dm.comments.value.length, 1, 'Rewriting replaces uncollected comments instead of mixing old and new voting batches')
  dm.update({ maxRequests: 2 }); await flush(); dm.session.value.lastRequestAt = 0
  await dm.generate(true); assert.equal(harness.calls.length, 2); assert.match(dm.error.value, /上限/)
  dm.update({ generation: 'local' }); await flush()
  const countBefore = dm.session.value.requests
  for (let index = 0; index < 14; index++) {
    sourceRef.value = { ...clone(source), events: [{ ...source.events[0]!, id: `local-${index}`, text: `公开内容${index}` }], triggerId: `local-${index}` }
    await flush(); await dm.generate()
  }
  assert.equal(harness.calls.length, 2); assert.equal(dm.session.value.requests, countBefore)
  assert.equal(dm.comments.value.some((c: any) => c.eventId === 'local-13'), true, 'Local mode must keep producing comments across many consecutive turns')
  dm.update({ generation: 'manual', maxRequests: 30 }); await flush(); dm.session.value.lastRequestAt = 0
  let release: (value: any) => void = () => undefined
  harness.send = (...args: any[]) => { harness.calls.push(args); return new Promise(resolve => { release = resolve }) }
  const pending = dm.generate(true); await flush(); assert.equal(dm.busy.value, true)
  const previousScope = danmakuScope(sourceRef.value)
  sourceRef.value = { ...sourceRef.value, branchId: 'another-branch' }; await flush()
  assert.equal(harness.calls.at(-1)[2].signal.aborted, true)
  release({ content: JSON.stringify({ comments: [{ viewerId: viewers[0]!.id, text: '过期结果' }] }) }); await pending
  assert.equal(dm.state.value.sessions[previousScope].comments.some((c: any) => c.text === '过期结果'), false)
  assert.equal(dm.comments.value.length, 0, 'Branch switching must isolate comments')
  harness.accountId.value = 'other-account'; await flush(); assert.equal(Object.keys(dm.state.value.sessions).length, 0, 'Account switching must isolate settings and records')
  harness.accountId.value = 'qa-account'; sourceRef.value = clone(source); await flush()
  dm.update({ enabled: true, generation: 'auto', everyTurns: 1 }); await flush(); dm.session.value.lastRequestAt = 0
  const beforeAuto = harness.calls.length
  harness.send = async (...args: any[]) => { harness.calls.push(args); return { content: JSON.stringify({ comments: [{ viewerId: viewers[0]!.id, text: '自动生成的评论' }] }) } }
  sourceRef.value = { ...sourceRef.value, busy: true, events: [{ id: 'e-auto', actor: '甲', text: '正在生成', kind: 'speech' }], triggerId: 'e-auto', autoToken: '' }; await flush()
  sourceRef.value = { ...sourceRef.value, busy: false }; await flush()
  assert.equal(harness.calls.length, beforeAuto, 'Partial or cancelled chat replies must not trigger automatic comments')
  sourceRef.value = { ...sourceRef.value, autoToken: 'completed-successfully' }; await flush(); await flush()
  assert.equal(harness.calls.length, beforeAuto + 1, 'The first completed chat reply must trigger automatic comments')
  dm.update({ enabled: false }); await flush()
  sourceRef.value = { ...sourceRef.value, autoToken: 'another-completion' }; await flush(); assert.equal(harness.calls.length, beforeAuto + 1)
  await dm.save(); assert.equal(harness.snapshots.get('qa-account').defaults.enabled, false)
} finally {
  app.unmount(); delete (globalThis as any).__danmakuHarness; await unlink(bundlePath); await rmdir(testDir)
}
console.log('Danmaku tests passed: public context, branches, rollback, viewer rotation, persistence, budgets, caching, cancellation, account isolation and completed-turn triggers.')
