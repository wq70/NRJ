<script setup lang="ts">
/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { importWatchTogetherFiles } from '../services/watchTogetherImport'
import { importWatchTogetherUrl, materializeWatchTogetherResult, searchWatchTogether, type WatchTogetherSourceStatus } from '../services/watchTogetherSearch'
import { estimateWatchTogetherStorage, requestWatchTogetherPersistence } from '../services/watchTogetherRepository'
import { useWatchTogether } from '../composables/useWatchTogether'
import type { WatchTogetherItem, WatchTogetherKind, WatchTogetherSearchResult } from '../types/watchTogether'
import './WatchTogether.css'

const emit = defineEmits<{ close: [] }>()
const store = useWatchTogether()
type View = 'home' | 'library' | 'search' | 'settings' | 'player'
const view = ref<View>('home')
const activeKind = ref<WatchTogetherKind>('novel')
const activeItem = ref<WatchTogetherItem | null>(null)
const activeChapterId = ref('')
const mediaUrl = ref('')
const pageUrls = ref<string[]>([])
const importInput = ref<HTMLInputElement | null>(null)
const importing = ref(false)
const searchText = ref('')
const searching = ref(false)
const searchResults = ref<WatchTogetherSearchResult[]>([])
const sourceStatuses = ref<WatchTogetherSourceStatus[]>([])
const notice = ref('')
const showUrlModal = ref(false)
const urlDraft = reactive({ title: '', url: '' })
const showDeleteModal = ref(false)
const pendingDelete = ref<WatchTogetherItem | null>(null)
const showCompanion = ref(false)
const selectedCharacterId = ref('')
const chatDraft = ref('')
const novelScroll = ref<HTMLElement | null>(null)
const videoElement = ref<HTMLVideoElement | null>(null)
const audioElement = ref<HTMLAudioElement | null>(null)
const storageInfo = reactive({ usage: 0, quota: 0, persisted: false })
let noticeTimer: ReturnType<typeof setTimeout> | undefined
let progressTimer: ReturnType<typeof setTimeout> | undefined
let hlsInstance: { destroy: () => void } | null = null

const kindMeta: Record<WatchTogetherKind, { name: string; short: string; icon: string; description: string; accept: string }> = {
  novel: { name: '一起看小说', short: '小说', icon: '文', description: '章节阅读、批注与防剧透陪伴', accept: '.txt,.md,.markdown,.html,.htm,.json,.fb2,.epub,.docx,.pdf,.mobi,.azw,.azw3,.zip,.rar,.7z,.tar,.gz,.tgz,.bz2,.xz' },
  video: { name: '一起看影片', short: '影片', icon: '映', description: '本地影片、网络流与时间点聊天', accept: 'video/*,.mkv,.avi,.flv,.wmv,.ts,.m2ts,.mpeg,.mpg,.zip,.rar,.7z' },
  comic: { name: '一起看漫画', short: '漫画', icon: '漫', description: '连续阅读、翻页与分镜讨论', accept: 'image/*,.cbz,.cbr,.cb7,.cbt,.zip,.rar,.7z,.tar,.pdf,.epub' },
  audio: { name: '一起听', short: '听剧', icon: '声', description: '广播剧、有声剧与章节音频', accept: 'audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.aiff,.ape,.wma,.amr,.ac3,.zip,.rar,.7z,.m3u,.m3u8' }
}

const libraryItems = computed(() => store.state.items.filter(item => item.kind === activeKind.value))
const currentChapter = computed(() => activeItem.value?.chapters.find(chapter => chapter.id === activeChapterId.value) || activeItem.value?.chapters[0] || null)
const activeProgress = computed(() => activeItem.value ? store.progressFor(activeItem.value.id) : undefined)
const characters = computed(() => store.characters())
const sessionMessages = computed(() => store.activeSession.value?.messages || [])
const visibleText = computed(() => currentChapter.value?.text || '')
const canUseModule = computed(() => store.state.settings.enabled && store.state.settings.modules[activeKind.value])

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

const notify = (message: string) => {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2600)
}

const refreshStorage = async () => Object.assign(storageInfo, await estimateWatchTogetherStorage())

const toggleMaster = async (event: Event) => {
  await store.updateSettings({ enabled: (event.target as HTMLInputElement).checked })
  notify(store.state.settings.enabled ? '共赏空间已启用；各板块仍需单独开启' : '共赏空间已关闭，不会调用模型或在线来源')
}

const toggleModule = async (kind: WatchTogetherKind, event: Event) => {
  await store.updateSettings({ modules: { ...store.state.settings.modules, [kind]: (event.target as HTMLInputElement).checked } })
}

const openKind = (kind: WatchTogetherKind) => {
  activeKind.value = kind
  if (!store.state.settings.enabled || !store.state.settings.modules[kind]) {
    view.value = 'settings'
    notify('请先开启共赏总开关和这个板块')
    return
  }
  view.value = 'library'
}

const openCollectionView = (target: 'library' | 'search') => {
  const enabledKinds = (Object.keys(kindMeta) as WatchTogetherKind[]).filter(kind => store.state.settings.modules[kind])
  if (!store.state.settings.enabled || !enabledKinds.length) {
    view.value = 'settings'
    notify('请先开启共赏总开关和至少一个内容板块')
    return
  }
  if (!store.state.settings.modules[activeKind.value]) activeKind.value = enabledKinds[0]!
  view.value = target
}

const triggerImport = () => {
  if (!canUseModule.value) return notify('请先在设置中开启这个板块')
  if (!store.state.settings.localImport) return notify('请先开启“允许本地导入”')
  importInput.value?.click()
}

const onImport = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = [...(input.files || [])]
  input.value = ''
  if (!files.length || importing.value) return
  importing.value = true
  try {
    const result = await importWatchTogetherFiles(files, activeKind.value)
    const added = await store.addItems(result.items)
    notify(result.errors.length ? `已加入 ${added} 项；${result.errors[0]}` : `已加入 ${added} 项内容`)
    await refreshStorage()
  } finally {
    importing.value = false
  }
}

const submitUrl = async () => {
  try {
    const items = await importWatchTogetherUrl(activeKind.value, urlDraft.url, urlDraft.title)
    await store.addItems(items)
    showUrlModal.value = false
    urlDraft.title = ''
    urlDraft.url = ''
    notify('网络地址已加入内容库')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '地址无效')
  }
}

const runSearch = async () => {
  if (!canUseModule.value) return notify('请先开启这个板块')
  if (!store.state.settings.onlineSearch) return notify('请先开启“允许在线搜索”')
  if (!searchText.value.trim() || searching.value) return
  searching.value = true
  searchResults.value = []
  sourceStatuses.value = []
  try {
    const result = await searchWatchTogether(activeKind.value, searchText.value)
    searchResults.value = result.results
    sourceStatuses.value = result.statuses
    if (!result.results.length) notify('没有找到经过验证可直接使用的结果')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '搜索失败')
  } finally {
    searching.value = false
  }
}

const addSearchResult = async (result: WatchTogetherSearchResult) => {
  if (importing.value) return
  importing.value = true
  try {
    const items = await materializeWatchTogetherResult(result)
    const added = await store.addItems(items)
    notify(added ? '已加入内容库，可以直接打开' : '内容库中已经有这一项')
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '来源暂时无法读取')
  } finally {
    importing.value = false
  }
}

const setupHls = async (url: string, element: HTMLMediaElement | null = videoElement.value) => {
  hlsInstance?.destroy()
  hlsInstance = null
  if (!element || !/\.m3u8(?:$|\?)/i.test(url)) return
  if (element.canPlayType('application/vnd.apple.mpegurl')) {
    element.src = url
    return
  }
  try {
    const { default: Hls } = await import('hls.js')
    if (!Hls.isSupported()) return
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
    hls.loadSource(url)
    hls.attachMedia(element)
    hlsInstance = hls
  } catch {
    notify('当前浏览器无法播放这个 HLS 地址')
  }
}

const openItem = async (item: WatchTogetherItem) => {
  activeItem.value = item
  const progress = store.progressFor(item.id)
  activeChapterId.value = progress?.chapterId || item.chapters[0]?.id || ''
  view.value = 'player'
  mediaUrl.value = ''
  pageUrls.value = []
  try {
    if (item.kind === 'video' || item.kind === 'audio' || (item.kind === 'comic' && item.mediaUrl)) mediaUrl.value = await store.resolveItemMediaUrl(item)
    if (item.kind === 'comic' && activeChapterId.value && !item.mediaUrl) pageUrls.value = await store.resolveChapterPageUrls(item, activeChapterId.value)
    await nextTick()
    if (item.kind === 'video' && item.access === 'direct') await setupHls(mediaUrl.value, videoElement.value)
    if (item.kind === 'audio' && item.access === 'direct') await setupHls(mediaUrl.value, audioElement.value)
    const element = item.kind === 'video' ? videoElement.value : item.kind === 'audio' ? audioElement.value : null
    if (element && progress?.position) element.currentTime = progress.position
    if (item.kind === 'novel' || item.kind === 'comic') novelScroll.value?.scrollTo({ top: progress?.position || 0 })
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '内容无法打开')
  }
}

const closePlayer = async () => {
  await saveCurrentProgress()
  await store.endSession(activeItem.value || undefined)
  hlsInstance?.destroy()
  hlsInstance = null
  mediaUrl.value = ''
  pageUrls.value = []
  activeItem.value = null
  showCompanion.value = false
  view.value = 'library'
}

const saveCurrentProgress = async () => {
  const item = activeItem.value
  const chapter = currentChapter.value
  if (!item || !chapter) return
  if (item.kind === 'video' || item.kind === 'audio') {
    const element = item.kind === 'video' ? videoElement.value : audioElement.value
    if (!element) return
    await store.saveProgress({ itemId: item.id, chapterId: chapter.id, position: element.currentTime || 0, percent: element.duration ? element.currentTime / element.duration * 100 : 0 })
  } else {
    const element = novelScroll.value
    if (!element) return
    const max = Math.max(1, element.scrollHeight - element.clientHeight)
    await store.saveProgress({ itemId: item.id, chapterId: chapter.id, position: element.scrollTop, percent: element.scrollTop / max * 100 })
  }
}

const queueProgress = () => {
  if (progressTimer) clearTimeout(progressTimer)
  progressTimer = setTimeout(() => { void saveCurrentProgress() }, 600)
}

const openChapter = async (chapterId: string) => {
  await saveCurrentProgress()
  activeChapterId.value = chapterId
  pageUrls.value = []
  if (activeItem.value?.kind === 'comic' && !activeItem.value.mediaUrl) pageUrls.value = await store.resolveChapterPageUrls(activeItem.value, chapterId)
  novelScroll.value?.scrollTo({ top: 0 })
}

const beginCompanion = async () => {
  const item = activeItem.value
  if (!item) return
  if (!store.state.settings.companionEnabled) return notify('请先在设置中开启角色陪伴')
  if (!selectedCharacterId.value) return notify('请选择一个角色')
  try {
    await store.startSession(item, selectedCharacterId.value)
  } catch (cause) {
    notify(cause instanceof Error ? cause.message : '无法开始陪伴')
  }
}

const currentAnchor = () => {
  const item = activeItem.value
  if (!item) return 0
  if (item.kind === 'video') return videoElement.value?.currentTime || 0
  if (item.kind === 'audio') return audioElement.value?.currentTime || 0
  const element = novelScroll.value
  return element ? element.scrollTop / Math.max(1, element.scrollHeight - element.clientHeight) * 100 : activeProgress.value?.percent || 0
}

const sendChat = async () => {
  const item = activeItem.value
  const text = chatDraft.value.trim()
  if (!item || !text || store.busy.value) return
  store.addSessionMessage('user', text, currentAnchor())
  chatDraft.value = ''
  if (!store.state.settings.characterCanSpeak) return notify('消息已记录；角色说话权限当前关闭')
  try {
    await store.requestCompanionReply({ item, anchor: currentAnchor(), visibleText: visibleText.value, event: `用户说：${text}` })
  } catch {}
}

const mediaPause = () => {
  queueProgress()
  const item = activeItem.value
  if (!item || !store.activeSession.value || !store.state.settings.eventDrivenReplies) return
  void store.requestCompanionReply({ item, anchor: currentAnchor(), visibleText: visibleText.value, event: '用户暂停了播放', automatic: true }).catch(() => undefined)
}

const promptDelete = (item: WatchTogetherItem) => {
  pendingDelete.value = item
  showDeleteModal.value = true
}

const confirmDelete = async () => {
  const item = pendingDelete.value
  if (!item) return
  await store.removeItem(item.id)
  showDeleteModal.value = false
  pendingDelete.value = null
  notify('内容和对应本地文件已删除')
  await refreshStorage()
}

const persistStorage = async () => {
  storageInfo.persisted = await requestWatchTogetherPersistence()
  notify(storageInfo.persisted ? '浏览器已允许持久化存储' : '浏览器暂未授予持久化存储')
}

const goBack = () => {
  if (view.value === 'player') { void closePlayer(); return }
  if (view.value !== 'home') { view.value = 'home'; return }
  emit('close')
}

watch(activeKind, () => {
  searchResults.value = []
  sourceStatuses.value = []
})

onMounted(async () => {
  await store.load()
  await refreshStorage()
})

onUnmounted(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
  if (progressTimer) clearTimeout(progressTimer)
  hlsInstance?.destroy()
  store.disposeObjectUrls()
})
</script>

<template>
  <div class="watch-app">
    <header v-if="view !== 'player'" class="watch-header">
      <button type="button" class="watch-back" aria-label="返回" @click="goBack">‹</button>
      <div><small>SHARED MOMENTS</small><h1>共赏空间</h1></div>
      <button type="button" class="watch-settings-link" aria-label="设置" @click="view='settings'">设置</button>
    </header>

    <main v-if="!store.ready.value" class="watch-loading"><span></span><p>正在整理共赏空间…</p></main>

    <main v-else-if="view === 'home'" class="watch-scroll watch-home">
      <section v-if="!store.state.settings.enabled" class="watch-welcome">
        <div class="welcome-mark">赏</div>
        <h2>把喜欢的内容留给两个人</h2>
        <p>所有能力默认关闭。开启总开关后，仍需逐项允许板块、在线来源和角色陪伴。</p>
        <label class="watch-master-switch"><span><b>启用共赏空间</b><small>不会自动开启任何子功能</small></span><input type="checkbox" :checked="store.state.settings.enabled" @change="toggleMaster"><i></i></label>
      </section>

      <template v-else>
        <section class="watch-continue">
          <div><small>继续上次</small><strong>{{ store.state.progress.length ? store.state.items.find(item=>item.id===store.state.progress.slice().sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.itemId)?.title || '共赏记录' : '还没有共赏进度' }}</strong><span>{{ store.state.progress.length ? '从保存的位置继续' : '选择下面的内容板块开始' }}</span></div>
          <button v-if="store.state.progress.length && store.state.items.find(item=>item.id===store.state.progress.slice().sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.itemId)" type="button" @click="openItem(store.state.items.find(item=>item.id===store.state.progress.slice().sort((a,b)=>b.updatedAt-a.updatedAt)[0]?.itemId)!)">继续</button>
        </section>

        <section class="watch-kind-grid">
          <button v-for="(meta, kind) in kindMeta" :key="kind" type="button" class="watch-kind-card" @click="openKind(kind)">
            <i>{{ meta.icon }}</i><span><strong>{{ meta.name }}</strong><small>{{ meta.description }}</small><em>{{ store.state.settings.modules[kind] ? `${store.state.items.filter(item=>item.kind===kind).length} 项内容` : '未开启' }}</em></span><b>›</b>
          </button>
        </section>

        <section class="watch-privacy-note"><b>注意力保护已生效</b><p>只有进入共赏会话并明确开启角色权限时，内容才会进入对应会话。普通聊天默认不知道这里发生了什么。</p></section>
        <section class="watch-other"><span><i>＋</i><b>其他共赏</b></span><small>展览、照片、课程与更多形式等待开放</small></section>
      </template>
    </main>

    <main v-else-if="view === 'library'" class="watch-scroll watch-library">
      <div class="watch-section-tabs"><button v-for="(meta, kind) in kindMeta" :key="kind" type="button" :class="{active:activeKind===kind}" :disabled="!store.state.settings.modules[kind]" @click="activeKind=kind">{{ meta.short }}</button></div>
      <section class="watch-library-actions">
        <button type="button" @click="triggerImport"><i>⇧</i><span><b>{{ importing ? '正在导入…' : '导入文件' }}</b><small>支持文件与压缩包</small></span></button>
        <button type="button" @click="showUrlModal=true"><i>⌁</i><span><b>添加地址</b><small>媒体、全文或播放流</small></span></button>
        <button type="button" @click="view='search'"><i>⌕</i><span><b>在线搜索</b><small>只显示可直接使用结果</small></span></button>
      </section>
      <input ref="importInput" class="watch-hidden-input" type="file" multiple :accept="kindMeta[activeKind].accept" @change="onImport">
      <div class="watch-library-title"><strong>{{ kindMeta[activeKind].name }}</strong><small>{{ libraryItems.length }} 项</small></div>
      <section v-if="libraryItems.length" class="watch-item-list">
        <article v-for="item in libraryItems" :key="item.id">
          <button type="button" class="watch-item-main" @click="openItem(item)">
            <i class="watch-cover" :style="item.cover?{backgroundImage:`url(${item.cover})`}:undefined">{{ item.cover ? '' : kindMeta[item.kind].icon }}</i>
            <span><strong>{{ item.title }}</strong><small>{{ item.creator || item.sourceName }} · {{ item.origin==='local'?'本地':item.origin==='online'?'在线来源':'网络地址' }}</small><em>{{ store.progressFor(item.id)?.percent.toFixed(0) || 0 }}% · {{ item.chapters.length }} {{ item.kind==='audio'?'轨':item.kind==='video'?'段':'章' }}</em></span><b>›</b>
          </button>
          <button type="button" class="watch-item-more" aria-label="删除" @click="promptDelete(item)">⋯</button>
        </article>
      </section>
      <section v-else class="watch-empty"><i>{{ kindMeta[activeKind].icon }}</i><strong>这里还没有内容</strong><p>可以导入本地文件、压缩包、网络地址，或从公开来源搜索。</p></section>
    </main>

    <main v-else-if="view === 'search'" class="watch-scroll watch-search">
      <div class="watch-section-tabs"><button v-for="(meta, kind) in kindMeta" :key="kind" type="button" :class="{active:activeKind===kind}" :disabled="!store.state.settings.modules[kind]" @click="activeKind=kind">{{ meta.short }}</button></div>
      <form class="watch-search-form" @submit.prevent="runSearch"><input v-model="searchText" :placeholder="`搜索${kindMeta[activeKind].short}名称或作者`"><button type="submit" :disabled="searching">{{ searching ? '搜索中' : '搜索' }}</button></form>
      <p class="watch-search-rule">默认隐藏只有封面和资料、没有真实内容地址的结果。</p>
      <div v-if="sourceStatuses.length" class="watch-source-status"><span v-for="source in sourceStatuses" :key="source.id" :class="{failed:!source.ok}">{{ source.name }} · {{ source.ok ? `${source.count} 条` : '不可用' }}</span></div>
      <section v-if="searchResults.length" class="watch-search-results">
        <article v-for="result in searchResults" :key="result.id">
          <i class="watch-cover" :style="result.cover?{backgroundImage:`url(${result.cover})`}:undefined">{{ result.cover?'':kindMeta[result.kind].icon }}</i>
          <div><strong>{{ result.title }}</strong><small>{{ result.creator || result.sourceName }}</small><p>{{ result.description || result.availability }}</p><em>可直接使用 · {{ result.sourceName }}</em></div>
          <button type="button" :disabled="importing" @click="addSearchResult(result)">加入</button>
        </article>
      </section>
      <section v-else-if="!searching" class="watch-empty compact"><strong>{{ searchText ? '没有可用结果' : '从多个公开来源中搜索' }}</strong><p>{{ searchText ? '可以换一个关键词，或使用本地文件和网络地址。' : '搜索只会在你主动提交后开始。' }}</p></section>
    </main>

    <main v-else-if="view === 'settings'" class="watch-scroll watch-settings">
      <section><h2>总开关</h2><label class="watch-setting-row"><span><b>启用共赏空间</b><small>关闭后不搜索、不调用模型、不读取记忆</small></span><input type="checkbox" :checked="store.state.settings.enabled" @change="toggleMaster"><i></i></label></section>
      <section><h2>内容板块</h2><label v-for="(meta, kind) in kindMeta" :key="kind" class="watch-setting-row"><span><b>{{ meta.name }}</b><small>{{ meta.description }}</small></span><input type="checkbox" :checked="store.state.settings.modules[kind]" :disabled="!store.state.settings.enabled" @change="toggleModule(kind,$event)"><i></i></label></section>
      <section><h2>内容与网络</h2>
        <label class="watch-setting-row"><span><b>允许本地导入</b><small>文件只保存在本机浏览器存储</small></span><input type="checkbox" :checked="store.state.settings.localImport" :disabled="!store.state.settings.enabled" @change="store.updateSettings({localImport:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>允许在线搜索</b><small>仅在主动搜索时访问公开来源</small></span><input type="checkbox" :checked="store.state.settings.onlineSearch" :disabled="!store.state.settings.enabled" @change="store.updateSettings({onlineSearch:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>保存阅读与播放进度</b><small>关闭后退出内容不会记录位置</small></span><input type="checkbox" :checked="store.state.settings.saveProgress" :disabled="!store.state.settings.enabled" @change="store.updateSettings({saveProgress:($event.target as HTMLInputElement).checked})"><i></i></label>
      </section>
      <section><h2>角色陪伴</h2>
        <label class="watch-setting-row"><span><b>启用角色陪伴</b><small>仍需在内容页手动选择角色</small></span><input type="checkbox" :checked="store.state.settings.companionEnabled" :disabled="!store.state.settings.enabled" @change="store.updateSettings({companionEnabled:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>允许角色说话</b><small>关闭时消息只保留在本场记录</small></span><input type="checkbox" :checked="store.state.settings.characterCanSpeak" :disabled="!store.state.settings.companionEnabled" @change="store.updateSettings({characterCanSpeak:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>允许事件触发回应</b><small>暂停等事件最多低频触发，不会连续调用</small></span><input type="checkbox" :checked="store.state.settings.eventDrivenReplies" :disabled="!store.state.settings.characterCanSpeak" @change="store.updateSettings({eventDrivenReplies:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>分享当前正文或字幕</b><small>只发送当前可见范围，并限制长度</small></span><input type="checkbox" :checked="store.state.settings.shareText" :disabled="!store.state.settings.companionEnabled" @change="store.updateSettings({shareText:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>共赏读取普通聊天</b><small>只读取当前角色最近少量消息</small></span><input type="checkbox" :checked="store.state.settings.sessionReadsChat" :disabled="!store.state.settings.companionEnabled" @change="store.updateSettings({sessionReadsChat:($event.target as HTMLInputElement).checked})"><i></i></label>
      </section>
      <section><h2>记录与普通聊天</h2>
        <label class="watch-setting-row"><span><b>保存共赏会话</b><small>在本机保留本场聊天记录</small></span><input type="checkbox" :checked="store.state.settings.saveRecords" :disabled="!store.state.settings.enabled" @change="store.updateSettings({saveRecords:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>写入共赏记忆</b><small>结束会话时生成一段本地关系记录</small></span><input type="checkbox" :checked="store.state.settings.writeMemory" :disabled="!store.state.settings.companionEnabled" @change="store.updateSettings({writeMemory:($event.target as HTMLInputElement).checked})"><i></i></label>
        <label class="watch-setting-row"><span><b>普通聊天读取共赏记忆</b><small>只有总开关和本项同时开启才进入提示词</small></span><input type="checkbox" :checked="store.state.settings.chatReadsMemory" :disabled="!store.state.settings.writeMemory" @change="store.updateSettings({chatReadsMemory:($event.target as HTMLInputElement).checked})"><i></i></label>
      </section>
      <section><h2>本机存储</h2><div class="watch-storage"><span><b>{{ formatBytes(storageInfo.usage) }}</b><small>已使用 / 可用配额 {{ formatBytes(storageInfo.quota) }}</small></span><button v-if="!storageInfo.persisted" type="button" @click="persistStorage">请求持久化</button><em v-else>已持久化</em></div></section>
    </main>

    <main v-else-if="view === 'player' && activeItem" class="watch-player">
      <header class="watch-player-head"><button type="button" aria-label="返回内容库" @click="closePlayer">‹</button><span><strong>{{ activeItem.title }}</strong><small>{{ currentChapter?.title || activeItem.sourceName }}</small></span><button type="button" :class="{active:showCompanion}" @click="showCompanion=!showCompanion">陪伴</button></header>
      <div v-if="activeItem.kind==='novel'" ref="novelScroll" class="watch-reader" @scroll.passive="queueProgress"><article><h1>{{ currentChapter?.title }}</h1><p v-for="(paragraph,index) in (currentChapter?.text||'').split(/\n{2,}/)" :key="index">{{ paragraph }}</p><div class="watch-chapter-end">— 本章完 —</div></article></div>
      <div v-else-if="activeItem.kind==='comic'" ref="novelScroll" class="watch-comic" @scroll.passive="queueProgress"><iframe v-if="activeItem.mediaUrl && mediaUrl" :src="mediaUrl" title="漫画 PDF"></iframe><template v-else><img v-for="(url,index) in pageUrls" :key="url" :src="url" :alt="`第 ${index+1} 页`" loading="lazy"><div v-if="!pageUrls.length" class="watch-player-empty">当前章节没有可显示的图片</div></template></div>
      <div v-else-if="activeItem.kind==='video'" class="watch-video-stage"><iframe v-if="activeItem.access==='embed'" :src="activeItem.mediaUrl" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen title="影片播放器"></iframe><a v-else-if="activeItem.access==='external'" :href="activeItem.sourceUrl||activeItem.mediaUrl" target="_blank" rel="noreferrer">前往来源页面观看</a><video v-else ref="videoElement" :src="/\.m3u8(?:$|\?)/i.test(mediaUrl)?undefined:mediaUrl" controls playsinline preload="metadata" @timeupdate="queueProgress" @pause="mediaPause" @error="notify('当前浏览器无法解码这个影片格式或来源拒绝播放')"></video></div>
      <div v-else class="watch-audio-stage"><div class="watch-audio-cover" :style="activeItem.cover?{backgroundImage:`url(${activeItem.cover})`}:undefined">{{ activeItem.cover?'':'声' }}</div><h2>{{ activeItem.title }}</h2><p>{{ activeItem.creator || activeItem.sourceName }}</p><audio ref="audioElement" :src="/\.m3u8(?:$|\?)/i.test(mediaUrl)?undefined:mediaUrl" controls preload="metadata" @timeupdate="queueProgress" @pause="mediaPause" @error="notify('当前浏览器无法解码这个音频格式或来源拒绝播放')"></audio></div>
      <nav v-if="activeItem.chapters.length>1" class="watch-chapters"><button v-for="chapter in activeItem.chapters" :key="chapter.id" type="button" :class="{active:chapter.id===activeChapterId}" @click="openChapter(chapter.id)">{{ chapter.title }}</button></nav>
      <a v-if="activeItem.sourceId==='mangadex'" class="watch-source-credit" :href="activeItem.sourceUrl" target="_blank" rel="noreferrer">来源 MangaDex<span v-if="activeItem.creator"> · {{ activeItem.creator }}</span></a>
      <aside v-if="showCompanion" class="watch-companion">
        <header><span><b>共赏陪伴</b><small v-if="store.activeSession.value">{{ store.activeSession.value.characterName }}正在这里</small><small v-else>不会自动选择或邀请角色</small></span><button type="button" @click="showCompanion=false">完成</button></header>
        <div v-if="!store.state.settings.companionEnabled" class="watch-companion-disabled"><p>角色陪伴当前关闭，不会占用聊天注意力。</p><button type="button" @click="view='settings';showCompanion=false">前往设置</button></div>
        <div v-else-if="!store.activeSession.value" class="watch-character-picker"><label><span>选择聊天角色</span><select v-model="selectedCharacterId"><option value="">请选择</option><option v-for="character in characters" :key="character.entityId" :value="character.entityId">{{ character.name }}</option></select></label><p v-if="!characters.length">聊天中还没有可以邀请的正式角色。</p><button type="button" :disabled="!selectedCharacterId" @click="beginCompanion">开始一起共赏</button></div>
        <template v-else><div class="watch-chat-log"><div v-for="message in sessionMessages" :key="message.id" :class="['watch-chat-message',message.sender]"><small>{{ message.sender==='user'?'我':message.sender==='character'?store.activeSession.value?.characterName:'共赏空间' }}</small><p>{{ message.content }}</p></div></div><form class="watch-chat-form" @submit.prevent="sendChat"><input v-model="chatDraft" maxlength="1000" placeholder="聊聊现在看到的内容"><button type="submit" :disabled="!chatDraft.trim()||store.busy.value">{{ store.busy.value?'等待':'发送' }}</button></form><p v-if="store.error.value" class="watch-chat-error">{{ store.error.value }}</p></template>
      </aside>
    </main>

    <nav v-if="store.ready.value && view !== 'player'" class="watch-tabbar"><button type="button" :class="{active:view==='home'}" @click="view='home'"><i>⌂</i><span>共赏</span></button><button type="button" :class="{active:view==='library'}" @click="openCollectionView('library')"><i>▥</i><span>内容库</span></button><button type="button" :class="{active:view==='search'}" @click="openCollectionView('search')"><i>⌕</i><span>搜索</span></button><button type="button" :class="{active:view==='settings'}" @click="view='settings'"><i>○</i><span>设置</span></button></nav>

    <transition name="watch-toast"><div v-if="notice" class="watch-notice">{{ notice }}</div></transition>

    <div v-if="showUrlModal" class="watch-modal" @click.self="showUrlModal=false"><section><header><button type="button" @click="showUrlModal=false">取消</button><b>添加网络地址</b><button type="button" :disabled="!urlDraft.url.trim()" @click="submitUrl">加入</button></header><label><span>名称（可选）</span><input v-model="urlDraft.title" maxlength="120" placeholder="未填写时使用文件名"></label><label><span>HTTP 或 HTTPS 地址</span><textarea v-model="urlDraft.url" rows="4" placeholder="https://…"></textarea></label><p>来源需要允许移动浏览器直接访问。带登录、DRM 或防盗链的地址可能无法播放。</p></section></div>
    <div v-if="showDeleteModal" class="watch-modal watch-confirm" @click.self="showDeleteModal=false"><section><div class="watch-confirm-icon">删</div><h3>移除《{{ pendingDelete?.title }}》？</h3><p>本地媒体文件、进度和对应缓存会一起删除，无法恢复。</p><div><button type="button" @click="showDeleteModal=false">取消</button><button type="button" class="danger" @click="confirmDelete">确认删除</button></div></section></div>
  </div>
</template>

<style scoped>
.watch-source-credit{position:absolute;right:9px;bottom:calc(9px + env(safe-area-inset-bottom));z-index:5;max-width:calc(100% - 18px);overflow:hidden;padding:5px 8px;border-radius:9px;background:rgba(27,25,24,.82);color:#ddd5cf;font-size:7px;text-decoration:none;text-overflow:ellipsis;white-space:nowrap}
.watch-section-tabs button:disabled{opacity:.32;cursor:default}
</style>
