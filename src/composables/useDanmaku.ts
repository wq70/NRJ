/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import { useChatAuth } from './useChatAuth'
import { sendCapabilityMessage } from '../services/api'
import { loadDanmakuSnapshot, saveDanmakuSnapshot } from '../services/danmakuRepository'
import { buildDanmakuMessages, danmakuHash, danmakuScope, eventHash, localDanmakuReply, normalizeDanmakuSettings, parseDanmakuReply, pruneDanmakuSnapshot, selectDanmakuCast, validDanmakuComments } from '../services/danmakuRuntime'
import { createDanmakuSnapshot } from '../types/danmaku'
import type { DanmakuComment, DanmakuSettings, DanmakuSnapshot, DanmakuSource } from '../types/danmaku'

const accounts = new Map<string, { state: DanmakuSnapshot; ready: Ref<boolean>; load: Promise<void>; saving: Promise<unknown>; error: Ref<string> }>()
const requests = new Map<string, AbortController>()
const requestTimers = new Map<AbortController, ReturnType<typeof setTimeout>>()
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const accountState = (id: string) => {
  let entry = accounts.get(id)
  if (!entry) {
    const state = reactive(createDanmakuSnapshot())
    const ready = ref(false); const error = ref('')
    const created = { state, ready, error, load: Promise.resolve(), saving: Promise.resolve() as Promise<unknown> }
    created.load = loadDanmakuSnapshot(id).then(data => { Object.assign(state, data); ready.value = true }).catch(() => { error.value = '观众数据读取失败，已保留现有数据；请稍后重新进入'; ready.value = false })
    entry = created; accounts.set(id, entry)
  }
  return entry
}
export function useDanmaku(source: Ref<DanmakuSource>) {
  const accountId = computed(() => useChatAuth().currentChatUserId.value || 'guest')
  const store = computed(() => accountState(accountId.value))
  const state = computed(() => store.value.state)
  const ready = computed(() => store.value.ready.value)
  const scope = computed(() => danmakuScope(source.value))
  const session = computed(() => state.value.sessions[scope.value])
  const settings = computed(() => normalizeDanmakuSettings({ ...state.value.defaults, ...state.value.scenes[source.value.scene], ...session.value?.settings }))
  const valid = computed(() => validDanmakuComments(source.value, session.value?.comments || []))
  const comments = computed(() => valid.value.filter(c => !state.value.viewers.find(v => v.id === c.viewerId)?.blocked && !settings.value.blockedKinds.includes(c.kind)))
  const busy = ref(false); const error = ref(''); const notice = ref('')
  const pageActive = ref(typeof document === 'undefined' || document.visibilityState !== 'hidden')
  let owned: AbortController | null = null
  let sequence = 0
  let turns = 0
  let previous = ''
  let autoTimer: ReturnType<typeof setTimeout> | null = null
  const playback = ref(0)
  const save = async () => {
    if (!ready.value) return
    const id = accountId.value; const entry = store.value; const data = clone(pruneDanmakuSnapshot(entry.state))
    entry.saving = entry.saving.catch(() => undefined).then(() => saveDanmakuSnapshot(id, data))
    try { await entry.saving } catch { error.value = '观众记录保存失败，当前内容仍可查看；请检查本机存储空间' }
  }
  const ensureSession = () => {
    if (!state.value.sessions[scope.value]) state.value.sessions[scope.value] = { scene: source.value.scene, title: source.value.title, settings: {}, comments: [], requests: 0, lastRequestAt: 0, updatedAt: Date.now() }
    // Return the stored reactive proxy, not the raw object used on assignment.
    return state.value.sessions[scope.value]!
  }
  const cancel = () => {
    sequence++
    if (owned) {
      owned.abort(); const timer = requestTimers.get(owned); if (timer) clearTimeout(timer); requestTimers.delete(owned)
      for (const [key, controller] of requests) if (controller === owned) requests.delete(key)
    }
    owned = null; busy.value = false
    if (autoTimer) clearTimeout(autoTimer)
    autoTimer = null
  }
  const update = (patch: Partial<DanmakuSettings>, target: 'session' | 'scene' | 'global' = 'session') => {
    if (!ready.value) return
    if (target === 'global') state.value.defaults = normalizeDanmakuSettings({ ...state.value.defaults, ...patch })
    else if (target === 'scene') state.value.scenes[source.value.scene] = { ...state.value.scenes[source.value.scene], ...patch }
    else ensureSession().settings = { ...session.value?.settings, ...patch }
    if (patch.enabled === false || patch.generation === 'manual') cancel()
    void save()
  }
  const resetOverride = () => { if (session.value) session.value.settings = {}; cancel(); void save() }
  const retryLoad = async () => {
    const entry = store.value; const id = accountId.value
    entry.error.value = ''; cancel()
    try { await entry.saving.catch(() => undefined); const loaded = await loadDanmakuSnapshot(id); Object.assign(entry.state, loaded); entry.ready.value = true }
    catch { entry.error.value = '观众数据无法读取，请检查浏览器存储权限'; entry.ready.value = false }
  }
  const generate = async (rewrite = false, automatic = false) => {
    error.value = ''; notice.value = ''
    if (!ready.value) { error.value = store.value.error.value || '正在读取观众设置'; return }
    const src = clone(source.value); const cfg = clone(settings.value)
    const event = src.events.find(e => e.id === src.triggerId)
    if (!cfg.enabled) { error.value = '请先开启当前场景的观众模式'; return }
    if (!src.ready || src.busy || !event || !pageActive.value) { if (!automatic) error.value = '等待一段完整的公开内容后再生成'; return }
    const target = ensureSession(); const id = accountId.value; const key = `${id}:${scope.value}`
    if (requests.has(key) || busy.value) { if (!automatic) notice.value = '本场正在生成评论，请等待完成'; return }
    const allEligible = state.value.viewers.filter(v => !v.blocked && (!cfg.viewerIds.length || cfg.viewerIds.includes(v.id)))
    const cast = selectDanmakuCast(state.value.viewers, cfg)
    if (!cast.length) { error.value = '请选至少一位未屏蔽的观众'; return }
    const remembered = cfg.remember ? valid.value.filter(c => c.eventId !== event.id).slice(-8) : []
    const cacheKey = danmakuHash(JSON.stringify([src.events.slice(0, src.events.findIndex(e => e.id === src.triggerId) + 1).slice(-30).map(eventHash), cfg.style, cfg.instruction, cfg.maxLength, cfg.count, cfg.maxInputChars, cfg.generation, cfg.randomCast, cfg.blockedKinds, allEligible, remembered.map(c => c.text)]))
    const cachedBatch = target.batches?.find(batch => batch.eventId === event.id && batch.eventHash === eventHash(event) && batch.cacheKey === cacheKey)
    if (!rewrite && cachedBatch) { playback.value++; notice.value = '已读取本场缓存，没有发起模型请求'; return }
    const local = cfg.generation === 'local'
    if (!local && target.requests >= cfg.maxRequests) { error.value = '本场弹幕调用已到上限；可改用本地短句或在设置中调整限额'; return }
    const wait = cfg.cooldownSeconds * 1000 - (Date.now() - target.lastRequestAt)
    if (!local && wait > 0) {
      if (automatic) { notice.value = `调用间隔中，约 ${Math.ceil(wait / 1000)} 秒后评论最新内容`; autoTimer = setTimeout(() => { void generate(false, true) }, wait + 20); return }
      error.value = `请等待 ${Math.ceil(wait / 1000)} 秒再生成`; return
    }
    const controller = new AbortController(); owned = controller; requests.set(key, controller); busy.value = true
    const token = ++sequence
    if (!local) { target.requests++; target.lastRequestAt = Date.now(); await save() }
    const timer = setTimeout(() => controller.abort(), 45000); requestTimers.set(controller, timer)
    try {
      if (controller.signal.aborted) return
      const previousComments = remembered
      const response = local ? localDanmakuReply(cast, cfg) : await sendCapabilityMessage('danmaku-generation', buildDanmakuMessages(src, cfg, cast, previousComments), { signal: controller.signal, purpose: 'prompt-generation', payloadReady: true })
      if (controller.signal.aborted || token !== sequence || accountId.value !== id || scope.value !== danmakuScope(src) || source.value.triggerId !== src.triggerId || eventHash(source.value.events.find(e => e.id === src.triggerId) || { id: '', actor: '', text: '', kind: 'scene' }) !== eventHash(event) || !source.value.ready || !settings.value.enabled) return
      const raw = typeof response === 'string' ? response : response.content || ''
      const generated = parseDanmakuReply(raw, src, cfg, cast, local ? valid.value.filter(c => c.eventId === event.id) : valid.value, local ? 'local' : 'ai').map(c => ({ ...c, cacheKey }))
      if (rewrite) target.comments = target.comments.filter(c => c.eventId !== event.id || c.favorite || c.pinned || c.origin === 'user')
      target.comments.push(...generated); target.updatedAt = Date.now(); playback.value++
      target.batches = [...(target.batches || []).filter(batch => batch.eventId !== event.id || batch.cacheKey !== cacheKey), { cacheKey, eventId: event.id, eventHash: eventHash(event), createdAt: Date.now() }].slice(-500)
      notice.value = generated.length ? `生成了 ${generated.length} 条${local ? '本地气氛短句' : '虚拟观众评论'}` : '观众暂时没有新的评论'
      await save()
    } catch (reason) {
      if (token === sequence) error.value = controller.signal.aborted ? '弹幕请求已取消或超时，可手动重试' : reason instanceof Error ? reason.message : '弹幕生成失败'
    } finally {
      clearTimeout(timer); requestTimers.delete(controller)
      if (requests.get(key) === controller) requests.delete(key)
      if (token === sequence) { owned = null; busy.value = false }
    }
  }
  const editComment = (comment: DanmakuComment, patch: Partial<DanmakuComment>) => { Object.assign(comment, patch); void save() }
  const addUserComment = (text: string) => {
    const event = source.value.events.find(e => e.id === source.value.triggerId)
    if (!ready.value || !event || !text.trim() || !settings.value.enabled) return false
    ensureSession().comments.push({ id: crypto.randomUUID(), batchId: crypto.randomUUID(), eventId: event.id, eventHash: eventHash(event), viewerId: 'local-user', viewerName: '我', color: '#888888', text: text.trim().slice(0, settings.value.maxLength), kind: 'reaction', replyToId: null, createdAt: Date.now(), favorite: false, pinned: false, shared: false, origin: 'user', excerpt: `${event.actor}：${event.text}`.slice(0, 1500) }); playback.value++; void save(); return true
  }
  const clearSession = (all = false) => { cancel(); if (session.value) { session.value.comments = all ? [] : session.value.comments.filter(c => c.favorite || c.pinned); session.value.batches = [] }; void save() }
  const settledFingerprint = computed(() => source.value.busy ? '' : source.value.autoToken !== undefined ? source.value.autoToken : `${source.value.triggerId}:${danmakuHash(JSON.stringify(source.value.events.find(e => e.id === source.value.triggerId)))}`)
  watch([scope, accountId], () => { cancel(); previous = ''; turns = 0; error.value = ''; notice.value = '' }, { flush: 'sync' })
  watch(() => source.value.ready, active => { if (!active) cancel() })
  watch([scope, accountId, settledFingerprint], ([currentScope, currentAccount, next], old) => {
    if (!old || old[0] !== currentScope || old[1] !== currentAccount) { previous = next; return }
    if (!next) { if (old[2]) cancel(); return }
    if (previous === next) return
    previous = next; cancel(); turns++
    if (ready.value && source.value.ready && settings.value.enabled && settings.value.generation !== 'manual' && turns % settings.value.everyTurns === 0) void generate(false, true)
  }, { immediate: true })
  watch(() => JSON.stringify([settings.value.enabled, settings.value.generation, settings.value.style, settings.value.instruction, settings.value.viewerIds, settings.value.blockedKinds, settings.value.count, settings.value.maxLength, settings.value.maxInputChars, settings.value.remember, settings.value.randomCast, state.value.viewers]), () => cancel(), { flush: 'sync' })
  const onVisibility = () => { pageActive.value = document.visibilityState !== 'hidden'; if (!pageActive.value) cancel() }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  onBeforeUnmount(() => { cancel(); if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility) })
  const loadError = computed(() => store.value.error.value)
  const stopRequest = () => { cancel(); notice.value = '已取消当前弹幕请求；自动生成开关保持原设置' }
  return { state, ready, settings, comments, session, busy, error, notice, loadError, playback, update, resetOverride, retryLoad, save, generate, cancel, stopRequest, editComment, addUserComment, clearSession }
}
