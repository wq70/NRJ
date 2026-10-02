<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { PluginListenerHandle } from '@capacitor/core'
import { useMall } from '../../composables/useMall'
import { commerceBrowser, commercePlatforms, commercePlatformForUrl, hasCommerceBrowser, loadCommerceSession, normalizeCommercePage, redactCommerceText, safeCommerceUrl, saveCommerceSession } from '../../services/commerce'
import { commerceCaptureScript, commerceClickScript } from '../../services/commercePageScript'
import { askCommerceCompanion } from '../../services/commerceCompanion'
import type { CommercePage, CommercePlatform, CommerceTarget } from '../../types/commerce'
import WebCommerceWorkspace from './WebCommerceWorkspace.vue'

const props = defineProps<{ initialUrl?: string; characterId?: string }>()
const emit = defineEmits<{ close: [] }>()
const mall = useMall()
mall.ensureLoaded()
const account = mall.accountId.value
const initialPlatform = commercePlatformForUrl(props.initialUrl || '')?.id || 'meituan'
const platformId = ref<CommercePlatform>(initialPlatform)
const selectedCharacterId = ref(props.characterId || '')
const platform = computed(() => commercePlatforms.find(p => p.id === platformId.value)!)
const character = computed(() => mall.characters.value.find(c => String(c.characterEntityId || c.id) === selectedCharacterId.value))
const session = ref(loadCommerceSession(account, selectedCharacterId.value, platformId.value))
const supported = hasCommerceBrowser()
const viewport = ref<HTMLElement>()
const transcript = ref<HTMLElement>()
const page = ref<CommercePage | null>(null)
const currentUrl = ref(props.initialUrl || session.value.url || platform.value.home)
const title = ref('真实平台共逛')
const host = computed(() => { try { return new URL(currentUrl.value).hostname } catch { return '' } })
const input = ref('')
const urlInput = ref('')
const notice = ref('')
const loading = ref(false)
const busy = ref(false)
const working = ref(false)
const collapsed = ref(false)
const panel = ref<'' | 'settings' | 'records' | 'link'>('')
const suggestion = ref<{ target: CommerceTarget; token: string }>()
let listener: PluginListenerHandle | undefined
let resize: ResizeObserver | undefined
let abort: AbortController | undefined
let disposed = false
let generation = 0
let frame = 0
let opened = false
const report = (error: unknown) => { notice.value = error instanceof Error ? error.message : String(error) }
const persist = () => { try { saveCommerceSession(account, session.value) } catch { notice.value = '本机存储空间不足，本次对话暂未保存。' } }
const bounds = () => {
  const r = viewport.value?.getBoundingClientRect()
  return { x: r?.x || 0, y: r?.y || 0, width: r?.width || 1, height: r?.height || 1, viewportWidth: document.documentElement.clientWidth }
}
const layout = () => {
  cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => { if (supported && opened && !disposed) void commerceBrowser.layout({ bounds: bounds(), hidden: !!panel.value || document.hidden }).catch(report) })
}
const cancel = () => { generation++; abort?.abort(); abort = undefined; busy.value = false; suggestion.value = undefined }
const openPlatform = async (initial = false) => {
  if (!supported) return
  working.value = true
  try {
    await nextTick()
    await commerceBrowser.open({ platform: platformId.value, url: initial ? currentUrl.value : session.value.url || platform.value.home, bounds: bounds() })
    if (disposed) { await commerceBrowser.close(); return }
    opened = true; layout()
  } catch (error) { report(error) }
  finally { working.value = false }
}
const switchPlatform = async (id: CommercePlatform) => {
  if (working.value || id === platformId.value) return
  cancel(); persist(); platformId.value = id; session.value = loadCommerceSession(account, selectedCharacterId.value, id)
  page.value = null; notice.value = ''; title.value = '真实平台共逛'; currentUrl.value = session.value.url || platform.value.home
  await openPlatform()
}
const switchCharacter = () => {
  cancel(); persist(); session.value = loadCommerceSession(account, selectedCharacterId.value, platformId.value)
  page.value = null; notice.value = ''
}
const capture = async () => {
  if (!supported || !opened) throw new Error('请在安装后的 Android / iOS 应用中使用内置共逛。')
  const epoch = generation
  const value = await commerceBrowser.evaluate({ script: commerceCaptureScript })
  if (epoch !== generation || disposed) throw new Error('本次读取已取消。')
  const next = normalizeCommercePage(value.value)
  page.value = next; suggestion.value = undefined
  title.value = next.title || platform.value.name
  if (next.sensitive) notice.value = '登录、验证或结算区域由你直接操作，角色暂停读取。'
  else if (!next.text) notice.value = '当前可见区域没有可读取内容，请滚动到商品后再让角色看看。'
  return next
}
const send = async (preset?: string) => {
  const text = (preset || input.value).trim()
  if (!text || busy.value || working.value) return
  if (!character.value) { notice.value = '请先在上方选择陪你一起逛的角色。'; return }
  if (!supported) { notice.value = '当前网页没有原生浏览容器，无法把平台页面交给角色。请在安装后的应用中打开。'; return }
  input.value = ''; notice.value = ''; busy.value = true
  const run = ++generation
  abort = new AbortController()
  try {
    const observed = await capture()
    if (run !== generation || disposed) return
    session.value.messages.push({ role: 'user', content: redactCommerceText(text) }); persist()
    const result = await askCommerceCompanion({ name: character.value.name, persona: String(character.value.persona || ''), preferences: session.value.preferences, page: observed, messages: session.value.messages, signal: abort.signal })
    if (run !== generation || disposed) return
    session.value.messages.push({ role: 'assistant', content: result.reply }); persist()
    if (result.target) suggestion.value = { target: result.target, token: observed.token }
    await nextTick(); transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: 'smooth' })
  } catch (error) { if (run === generation && !disposed) report(error) }
  finally { if (run === generation) { busy.value = false; abort = undefined } }
}
const execute = async () => {
  const action = suggestion.value
  if (!action || working.value || busy.value) return
  suggestion.value = undefined; working.value = true; notice.value = ''
  try {
    const response = await commerceBrowser.evaluate({ script: commerceClickScript(action.token, action.target.id) })
    const result = JSON.parse(response.value)
    if (!result.ok) throw new Error(result.reason || '页面变化，请重新读取。')
    // A dispatched click is not evidence of a successful cart mutation or a purchase.
    notice.value = `已点击「${action.target.label}」，请以平台页面结果为准。`
    page.value = null
  } catch (error) { report(error) }
  finally { working.value = false }
}
const saveObservation = async () => {
  if (working.value || busy.value) return
  working.value = true
  try {
    const observed = await capture()
    if (observed.sensitive || !observed.text) throw new Error('请打开商品或订单详情的可读区域后记录。')
    session.value.records.push({ id: crypto.randomUUID(), platform: platformId.value, characterId: selectedCharacterId.value, title: observed.title, url: observed.url, text: observed.text, capturedAt: observed.capturedAt, source: 'page-observation' })
    persist(); notice.value = '已保存当前可见页面摘要；它不是平台接口核验结果。'
  } catch (error) { report(error) }
  finally { working.value = false }
}
const navigate = async (url: string) => {
  const target = commercePlatformForUrl(url)
  if (!target) { notice.value = '请粘贴美团、京东、淘宝或拼多多的 HTTPS 页面链接。'; return }
  if (!supported) { notice.value = '请在安装后的应用中打开内置平台。'; return }
  if (target.id !== platformId.value) await switchPlatform(target.id)
  cancel(); panel.value = ''; page.value = null
  try { await commerceBrowser.navigate({ url }); currentUrl.value = url } catch (error) { report(error) }
}
const goBack = async () => { try { if (!(await commerceBrowser.back()).canGoBack) notice.value = '已到平台最前一页，右上角可结束共逛。' } catch (error) { report(error) } }
const reload = async () => { cancel(); page.value = null; try { await commerceBrowser.reload() } catch (error) { report(error) } }
const external = () => { window.open(currentUrl.value, '_blank', 'noopener,noreferrer') }
const finish = async () => { cancel(); persist(); if (opened) { await commerceBrowser.close().catch(report); opened = false }; emit('close') }
watch(panel, layout)
watch(collapsed, () => { void nextTick(layout) })
watch(mall.accountId, () => { if (supported) void finish() })
onMounted(async () => {
  if (!supported) return
  listener = await commerceBrowser.addListener('browserEvent', event => {
    if (disposed) return
    if (event.closed) { opened = false; void finish(); return }
    loading.value = !!event.loading
    if (event.error) notice.value = event.error
    if (event.title) title.value = event.title
    if (event.url) {
      if (currentUrl.value !== event.url || event.loading) { page.value = null; suggestion.value = undefined }
      currentUrl.value = event.url
      if (!event.loading && commercePlatformForUrl(event.url)?.id === platformId.value) { session.value.url = safeCommerceUrl(event.url); persist() }
    }
  })
  if (disposed) { await listener.remove(); return }
  resize = new ResizeObserver(layout)
  if (viewport.value) resize.observe(viewport.value)
  window.addEventListener('resize', layout)
  window.visualViewport?.addEventListener('resize', layout)
  window.visualViewport?.addEventListener('scroll', layout)
  document.addEventListener('visibilitychange', layout)
  await openPlatform(true)
})
onBeforeUnmount(() => {
  if (!supported) return
  disposed = true; cancel(); persist(); resize?.disconnect(); cancelAnimationFrame(frame)
  window.removeEventListener('resize', layout); window.visualViewport?.removeEventListener('resize', layout); window.visualViewport?.removeEventListener('scroll', layout)
  document.removeEventListener('visibilitychange', layout); void listener?.remove()
  if (opened) void commerceBrowser.close().catch(() => {})
})
</script>

<template>
  <WebCommerceWorkspace v-if="!supported" :initial-url="props.initialUrl" :character-id="props.characterId" @close="emit('close')" />
  <section v-else class="commerce-workspace" aria-label="真实平台共逛">
    <header class="commerce-heading"><div><b>{{ character ? `和${character.name}一起逛` : '真实平台共逛' }}</b><small>{{ host }} · {{ title }}</small></div><button @click="finish">结束</button></header>
    <nav class="commerce-platforms" aria-label="选择平台"><button v-for="p in commercePlatforms" :key="p.id" :class="{active:platformId===p.id}" :disabled="working" @click="switchPlatform(p.id)">{{ p.name }}</button></nav>
    <div class="commerce-characters"><button :disabled="working" :class="{active:!selectedCharacterId}" @click="selectedCharacterId='';switchCharacter()">自己逛</button><button v-for="c in mall.characters.value" :key="c.id" :disabled="working" :class="{active:selectedCharacterId===String(c.characterEntityId||c.id)}" @click="selectedCharacterId=String(c.characterEntityId||c.id);switchCharacter()">{{ c.name }}</button></div>
    <nav class="commerce-tools"><button :disabled="!supported||working" @click="goBack">返回</button><button :disabled="!supported||working" @click="reload">刷新</button><button :disabled="working" @click="navigate(platform.home)">首页</button><button @click="panel='link'">链接</button><button @click="panel='records'">记录</button><button @click="panel='settings'">偏好</button></nav>
    <div class="commerce-status" aria-live="polite"><span>{{ loading ? '平台加载中…' : notice || (supported ? '在平台内登录、搜索和选购；付款后可返回继续聊。' : '此网页环境没有内置平台浏览能力') }}</span><button v-if="notice" aria-label="收起提示" @click="notice=''">×</button></div>
    <div ref="viewport" class="commerce-viewport">
      <div v-if="!supported" class="commerce-unavailable"><b>内置共逛需要安装应用</b><p>当前浏览器无法直接承载这些平台的登录和购物页面。请在包含共逛组件的 Android / iOS 安装包中打开。</p><p>原有外部浏览入口仍可使用，但不会与角色共享页面。</p><button @click="external">在外部打开{{ platform.name }}</button></div>
      <div v-else class="commerce-placeholder">{{ working ? '正在打开平台…' : '平台页面区域' }}</div>
    </div>
    <section class="commerce-companion" :class="{collapsed}">
      <header><b>{{ character?.name || '陪逛聊天' }}</b><button :disabled="!supported||working||busy" @click="saveObservation">记下这页</button><button @click="collapsed=!collapsed">{{ collapsed?'展开':'收起' }}</button></header>
      <template v-if="!collapsed">
        <div ref="transcript" class="commerce-messages" aria-live="polite"><p v-if="!session.messages.length" class="commerce-hint">在平台里选一家店或商品，再告诉我你想怎么选。</p><p v-for="(m,i) in session.messages" :key="i" :class="m.role"><small>{{ m.role==='user'?'你':character?.name||'角色' }}</small>{{ m.content }}</p><p v-if="busy" class="commerce-hint">正在结合当前页面回复…</p></div>
        <button v-if="suggestion" class="commerce-suggestion" :disabled="working" @click="execute">一起点这里：{{ suggestion.target.label }}</button>
        <div class="commerce-quick"><button :disabled="busy||working||!supported" @click="send('看看当前页面，你觉得选哪个好？')">看看这页</button><button :disabled="busy||working||!supported" @click="send('结合预算和口味，帮我比较当前看到的选择。')">帮我比较</button><span v-if="page">{{ page.sensitive?'私密区域暂停读取':'已读取当前可见区域' }}</span></div>
        <form class="commerce-input" @submit.prevent="send()"><input v-model="input" maxlength="1000" :disabled="!supported" placeholder="口味、预算，或想一起聊的话…" aria-label="陪逛消息"/><button v-if="busy" type="button" @click="cancel">停止</button><button v-else :disabled="!input.trim()||working||!supported">发送</button></form>
      </template>
    </section>
    <div v-if="panel" class="commerce-overlay" @click.self="panel=''">
      <section class="commerce-sheet"><header><b>{{ panel==='settings'?'这次一起怎么选':panel==='records'?'共逛记录':'打开平台链接' }}</b><button @click="panel=''">关闭</button></header>
        <template v-if="panel==='settings'"><label>口味、忌口、预算或购物偏好<textarea v-model="session.preferences" maxlength="1000" placeholder="例如：不吃香菜，晚饭预算40元以内" @change="persist" /></label><p>按当前账号、角色和平台分别保存。登录和付款信息不会发送给角色。</p><button @click="persist();panel=''">保存</button><button @click="external">在外部打开当前页</button></template>
        <template v-else-if="panel==='link'"><label>平台 HTTPS 链接<input v-model="urlInput" type="url" placeholder="粘贴商品、店铺或订单链接"/></label><button :disabled="!urlInput.trim()" @click="navigate(urlInput.trim())">在共逛中打开</button><p>也可以直接在平台页面内搜索。平台登录和验证会在原页面显示。</p></template>
        <template v-else><p v-if="!session.records.length">打开商品或订单详情，点击“记下这页”即可保存当前可见摘要。</p><article v-for="record in [...session.records].reverse()" :key="record.id"><b>{{ record.title }}</b><small>{{ new Date(record.capturedAt).toLocaleString() }} · 页面观察记录</small><p>{{ record.text }}</p><button @click="navigate(record.url)">查看原页</button></article></template>
      </section>
    </div>
  </section>
</template>

<style scoped>
.commerce-workspace{position:absolute;inset:0;z-index:45;display:flex;flex-direction:column;min-width:0;overflow:hidden;background:#f5f2ec;color:#292722;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.commerce-workspace *{box-sizing:border-box}.commerce-workspace button,.commerce-workspace input,.commerce-workspace textarea{font:inherit;color:inherit}.commerce-workspace button{border:1px solid #dad4cb;border-radius:13px;background:transparent;padding:5px 9px;font-size:10px;cursor:pointer;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.commerce-workspace button:disabled{opacity:.45;cursor:default}.commerce-heading{display:flex;align-items:center;gap:8px;flex:none;padding:calc(8px + env(safe-area-inset-top,0px)) 12px 7px}.commerce-heading>div{flex:1;min-width:0}.commerce-heading b,.commerce-heading small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.commerce-heading b{font:600 15px Georgia,"Songti SC",serif}.commerce-heading small{margin-top:3px;color:#928b82;font-size:9px}.commerce-heading>button{flex-shrink:0}.commerce-platforms{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;padding:0 12px 6px;flex:none}.commerce-platforms button.active,.commerce-characters button.active{background:#37332f;border-color:#37332f;color:#fff}.commerce-characters{display:flex;gap:5px;overflow-x:auto;flex:none;padding:0 12px 6px;scrollbar-width:none}.commerce-characters button{max-width:100px;flex-shrink:0;font-size:9px;padding:4px 8px}.commerce-tools{display:flex;gap:4px;padding:0 12px 5px;flex:none}.commerce-tools button{flex:1;min-width:0;border:0;background:#ebe6df;padding:5px 3px;font-size:9px}.commerce-status{display:flex;gap:4px;align-items:center;padding:0 12px 5px;flex:none;font-size:9px;color:#82786e;line-height:1.4}.commerce-status span{min-width:0;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.commerce-status button{border:0;padding:0 4px;flex:none}.commerce-viewport{flex:1;min-height:70px;position:relative;overflow:hidden;background:#fff}.commerce-placeholder{padding:20px;text-align:center;color:#a29a90;font-size:10px}.commerce-unavailable{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:16px;overflow:auto;text-align:center}.commerce-unavailable b{font-size:12px}.commerce-unavailable p{max-width:320px;font-size:10px;color:#8b8176;line-height:1.65;margin:7px 0}.commerce-unavailable button{margin-top:8px}.commerce-companion{flex:none;max-height:43%;display:flex;flex-direction:column;padding:7px 10px calc(8px + env(safe-area-inset-bottom,0px));border-top:1px solid #ded6cb;background:#f5f2ec;min-height:0}.commerce-companion>header{display:flex;align-items:center;gap:5px;flex:none}.commerce-companion>header b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:600 12px Georgia,"Songti SC",serif}.commerce-companion>header button{font-size:9px;padding:3px 7px;flex:none}.commerce-messages{overflow:auto;min-height:28px;max-height:130px;flex:1;padding:3px 0}.commerce-messages p{font-size:11px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;border-radius:9px;padding:6px 8px;background:#fff;margin:5px 0;max-width:94%}.commerce-messages p.user{margin-left:auto;background:#e8ded1}.commerce-messages small{display:block;color:#9c9081;font-size:8px}.commerce-messages .commerce-hint{background:transparent;color:#92887c;font-size:10px;padding:5px 0}.commerce-suggestion{text-align:left;background:#e8ded1!important;flex:none;margin:3px 0}.commerce-quick{display:flex;align-items:center;gap:4px;margin:4px 0;flex:none;min-width:0}.commerce-quick button{font-size:9px;padding:3px 7px;flex-shrink:0}.commerce-quick span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1978b;font-size:8px}.commerce-input{display:flex;gap:6px;flex:none}.commerce-input input{flex:1;min-width:0;border:0;border-radius:9px;background:#eae5dd;padding:8px;font-size:10px;outline:none}.commerce-input button{flex:none;background:#37332f;color:#fff;border-color:#37332f}.commerce-overlay{position:absolute;inset:0;z-index:3;display:flex;align-items:flex-end;background:rgba(23,21,19,.38)}.commerce-sheet{width:100%;max-height:80%;overflow:auto;border-radius:16px 16px 0 0;background:#f8f6f2;padding:15px 13px calc(15px + env(safe-area-inset-bottom,0px))}.commerce-sheet>header{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:12px}.commerce-sheet>header b{font:600 15px Georgia,"Songti SC",serif}.commerce-sheet label{display:block;font-size:10px;color:#80766b}.commerce-sheet input,.commerce-sheet textarea{display:block;width:100%;min-width:0;margin:7px 0;border:1px solid #ddd5ca;border-radius:9px;padding:9px;background:#fff;font-size:11px;outline:none}.commerce-sheet textarea{min-height:95px;resize:vertical}.commerce-sheet p{font-size:10px;line-height:1.6;color:#857a6e;overflow-wrap:anywhere;white-space:pre-wrap}.commerce-sheet>button{margin-right:6px}.commerce-sheet article{padding:10px 0;border-bottom:1px solid #e3dbd0}.commerce-sheet article>b{font-size:11px}.commerce-sheet article>small{display:block;font-size:8px;color:#9c9081;margin:4px 0}.commerce-sheet article>p{max-height:150px;overflow:auto}.dark-theme .commerce-workspace,.dark-theme .commerce-companion{background:#191817;color:#eeeae4}.dark-theme .commerce-sheet{background:#252321}.dark-theme .commerce-input input,.dark-theme .commerce-tools button,.dark-theme .commerce-messages p,.dark-theme .commerce-sheet input,.dark-theme .commerce-sheet textarea{background:#302d29;color:#eeeae4}.dark-theme .commerce-messages p.user,.dark-theme .commerce-suggestion{background:#494038!important}@media(max-width:340px){.commerce-heading{padding-left:9px;padding-right:9px}.commerce-platforms,.commerce-tools{padding-left:9px;padding-right:9px}.commerce-quick span{display:none}.commerce-companion{padding-left:8px;padding-right:8px}.commerce-messages{max-height:100px}}@media(max-height:540px){.commerce-messages{max-height:60px}.commerce-characters{padding-bottom:3px}.commerce-companion{max-height:46%}}
</style>
