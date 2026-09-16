<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import QRCode from 'qrcode'
import { globalSettings } from '../store/global'
import type { DeliveryItem, DeliverySettings } from '../types/delivery'
import {
  createDelivery,
  createDeliveryQrPayload,
  deleteDelivery,
  deliveryKindLabel,
  downloadDeliveryFile,
  exportDeliveryPackage,
  formatDeliverySize,
  getDeliveryFiles,
  importDeliveryPackage,
  importDeliveryQrPayload,
  listDeliveries,
  loadDeliverySettings,
  saveDeliverySettings,
  shareDelivery,
  updateDelivery,
  validateDeliveryFiles
} from '../services/deliveryService'
import { availableDeliveryDestinations, importDeliveryToDestination, type DeliveryDestination } from '../services/deliveryAdapters'
import { consumePendingSystemShares } from '../services/deliveryShareTarget'
import { listDeliveryChatTargets, sendDeliveryToChat, type DeliveryChatTarget } from '../services/deliveryChatBridge'

const emit = defineEmits<{ close: [] }>()
type View = 'home' | 'compose' | 'receive' | 'history' | 'detail' | 'settings'

const view = ref<View>('home')
const previousView = ref<View>('home')
const items = ref<DeliveryItem[]>([])
const selected = ref<DeliveryItem | null>(null)
const selectedFiles = ref<File[]>([])
const draftFiles = ref<File[]>([])
const draft = reactive({ title: '', note: '', text: '', url: '', expires: 'none' })
const settings = ref<DeliverySettings>(loadDeliverySettings())
const activeHistoryFilter = ref<'all' | 'received' | 'sent' | 'saved'>('all')
const toast = ref('')
const busy = ref(false)
const qrDataUrl = ref('')
const qrPayload = ref('')
const receiveCode = ref('')
const confirmDelete = ref(false)
const pendingImport = ref<{ destination: DeliveryDestination; label: string } | null>(null)
const showChatTargets = ref(false)
const chatTargets = ref<DeliveryChatTarget[]>([])
const chatTargetId = ref<string | number | null>(null)
const chatReadThisTime = ref(false)
const chatRememberThisTime = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const packageInput = ref<HTMLInputElement | null>(null)
const qrImageInput = ref<HTMLInputElement | null>(null)
const scanVideo = ref<HTMLVideoElement | null>(null)
const scanning = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
let scanFrame = 0
let scanStream: MediaStream | null = null
let receivingTimer: ReturnType<typeof setInterval> | undefined
const clockNow = ref(Date.now())

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

const refresh = async () => { items.value = await listDeliveries() }
const totalSize = (item: DeliveryItem) => item.files.reduce((sum, file) => sum + file.size, 0)
const filteredItems = computed(() => activeHistoryFilter.value === 'all' ? items.value : items.value.filter(item => item.direction === activeHistoryFilter.value))
const recentItems = computed(() => items.value.slice(0, 3))
const selectedDestinations = computed(() => selected.value ? availableDeliveryDestinations(selected.value) : [])
const receivingActive = computed(() => settings.value.receivingEnabled && (!settings.value.receivingUntil || settings.value.receivingUntil > clockNow.value))
const canCreate = computed(() => Boolean(draft.text.trim() || draft.url.trim() || draftFiles.value.length))
const composerSize = computed(() => draftFiles.value.reduce((sum, file) => sum + file.size, 0))

const formatTime = (time: number) => {
  const date = new Date(time)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const openView = (target: View) => { stopScan(); previousView.value = view.value; view.value = target }
const goBack = () => {
  stopScan()
  if (view.value === 'home') { emit('close'); return }
  if (view.value === 'detail') view.value = previousView.value === 'detail' ? 'history' : previousView.value
  else view.value = 'home'
}

const resetDraft = () => {
  Object.assign(draft, { title: '', note: '', text: '', url: '', expires: 'none' })
  draftFiles.value = []
}

const openCompose = () => { resetDraft(); openView('compose') }
const chooseFiles = () => fileInput.value?.click()
const onFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  const added = [...(input.files || [])]
  input.value = ''
  if (!added.length) return
  try { validateDeliveryFiles([...draftFiles.value, ...added]); draftFiles.value.push(...added) }
  catch (error) { notify(error instanceof Error ? error.message : '无法添加这些文件') }
}

const removeDraftFile = (index: number) => { draftFiles.value.splice(index, 1) }
const expiresAt = () => draft.expires === '10m' ? Date.now() + 600_000 : draft.expires === '1h' ? Date.now() + 3_600_000 : draft.expires === '1d' ? Date.now() + 86_400_000 : undefined

const saveDraft = async (action: 'save' | 'share') => {
  if (!canCreate.value || busy.value) return
  busy.value = true
  try {
    const item = await createDelivery({ title: draft.title, note: draft.note, text: draft.text, url: draft.url, files: draftFiles.value, direction: 'saved', expiresAt: expiresAt() })
    await refresh()
    resetDraft()
    if (action === 'share') {
      const result = await shareDelivery(item)
      await refresh()
      notify(result === 'shared' ? '已交给系统分享' : result === 'downloaded' ? '当前环境不支持文件分享，已下载投递包' : '已取消分享')
    } else notify('已保存到投递箱')
    selected.value = await listDeliveries().then(list => list.find(entry => entry.id === item.id) || item)
    previousView.value = 'home'
    view.value = 'detail'
  } catch (error) { notify(error instanceof Error ? error.message : '投递创建失败') }
  finally { busy.value = false }
}

const openItem = async (item: DeliveryItem, from: View = view.value) => {
  selected.value = item
  selectedFiles.value = await getDeliveryFiles(item)
  previousView.value = from
  qrDataUrl.value = ''
  qrPayload.value = ''
  view.value = 'detail'
  if (!item.openedAt) { selected.value = await updateDelivery(item, { openedAt: Date.now() }); await refresh() }
}

const shareSelected = async () => {
  if (!selected.value || busy.value) return
  busy.value = true
  try {
    const result = await shareDelivery(selected.value)
    await refresh()
    notify(result === 'shared' ? '已交给系统分享' : result === 'downloaded' ? '已下载投递包，可从其他设备导入' : '已取消分享')
  } catch (error) { notify(error instanceof Error ? error.message : '分享失败') }
  finally { busy.value = false }
}

const downloadPackage = async () => {
  if (!selected.value) return
  busy.value = true
  try { downloadDeliveryFile(await exportDeliveryPackage(selected.value)); notify('投递包已提交下载') }
  catch (error) { notify(error instanceof Error ? error.message : '导出失败') }
  finally { busy.value = false }
}

const makeQr = async () => {
  if (!selected.value) return
  try {
    qrPayload.value = createDeliveryQrPayload(selected.value)
    qrDataUrl.value = await QRCode.toDataURL(qrPayload.value, { width: 280, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#29272c', light: '#ffffff' } })
  } catch (error) { notify(error instanceof Error ? error.message : '二维码生成失败') }
}

const copyValue = async (value: string, success: string) => {
  try { await navigator.clipboard.writeText(value); notify(success) } catch { notify('无法自动复制，请长按文字复制') }
}

const copySelectedContent = () => selected.value && copyValue(selected.value.url || selected.value.text, selected.value.url ? '链接已复制' : '文字已复制')

const removeSelected = async () => {
  if (!selected.value) return
  await deleteDelivery(selected.value)
  confirmDelete.value = false
  selected.value = null
  selectedFiles.value = []
  await refresh()
  view.value = previousView.value === 'home' ? 'home' : 'history'
  notify('投递已从本机删除')
}

const onPackageFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  try { const item = await importDeliveryPackage(file); await refresh(); notify('投递包已接收'); await openItem(item, 'receive') }
  catch (error) { notify(error instanceof Error ? error.message : '投递包导入失败') }
  finally { busy.value = false }
}

const consumeCode = async (value = receiveCode.value) => {
  if (!value.trim() || busy.value) return
  busy.value = true
  try { const item = await importDeliveryQrPayload(value); receiveCode.value = ''; await refresh(); notify('投递口令已接收'); await openItem(item, 'receive') }
  catch (error) { notify(error instanceof Error ? error.message : '投递口令无法识别') }
  finally { busy.value = false }
}

const onQrImage = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const Detector = (window as any).BarcodeDetector
    if (!Detector) throw new Error('当前浏览器不能直接识别二维码图片，请粘贴投递口令')
    const bitmap = await createImageBitmap(file)
    const values = await new Detector({ formats: ['qr_code'] }).detect(bitmap)
    bitmap.close()
    if (!values[0]?.rawValue) throw new Error('图片中没有识别到二维码')
    await consumeCode(values[0].rawValue)
  } catch (error) { notify(error instanceof Error ? error.message : '二维码识别失败') }
}

const scanLoop = async () => {
  if (!scanning.value || !scanVideo.value) return
  try {
    const Detector = (window as any).BarcodeDetector
    const values = await new Detector({ formats: ['qr_code'] }).detect(scanVideo.value)
    if (values[0]?.rawValue) { const value = values[0].rawValue; stopScan(); await consumeCode(value); return }
  } catch { /* 视频帧尚未准备好时继续。 */ }
  scanFrame = requestAnimationFrame(scanLoop)
}

const startScan = async () => {
  const Detector = (window as any).BarcodeDetector
  if (!Detector || !navigator.mediaDevices?.getUserMedia) { notify('当前浏览器不支持实时扫码，请从相册识别或粘贴口令'); return }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
    scanning.value = true
    await nextTick()
    if (scanVideo.value) { scanVideo.value.srcObject = scanStream; await scanVideo.value.play(); scanFrame = requestAnimationFrame(scanLoop) }
  } catch { notify('没有取得相机权限，请从相册识别或粘贴口令') }
}

function stopScan() {
  scanning.value = false
  if (scanFrame) cancelAnimationFrame(scanFrame)
  scanFrame = 0
  scanStream?.getTracks().forEach(track => track.stop())
  scanStream = null
  if (scanVideo.value) scanVideo.value.srcObject = null
}

const enableReceiving = (minutes: number | null) => {
  settings.value.receivingEnabled = true
  settings.value.receivingUntil = minutes ? Date.now() + minutes * 60_000 : null
  settings.value = saveDeliverySettings(settings.value)
  notify(minutes ? `已开启 ${minutes} 分钟接收` : '已持续开启接收')
}

const disableReceiving = () => {
  settings.value.receivingEnabled = false
  settings.value.receivingUntil = null
  settings.value = saveDeliverySettings(settings.value)
  notify('接收已关闭')
}

const saveSettingsNow = () => { settings.value = saveDeliverySettings(settings.value); notify('设置已保存') }

const destinationLabel = (value: DeliveryDestination) => ({ book_store: '书城', bubble_dressup: '气泡工坊', world_book: '世界书' })[value]
const destinationDescription = (value: DeliveryDestination) => ({ book_store: '解析支持的书籍并加入本地书库', bubble_dressup: '校验方案后作为新方案导入', world_book: '校验 JSON 后另存为新世界书' })[value]

const runDestinationImport = async (destination: DeliveryDestination) => {
  if (!selected.value || busy.value) return
  busy.value = true
  try { notify(await importDeliveryToDestination(selected.value, destination)); pendingImport.value = null }
  catch (error) { notify(error instanceof Error ? error.message : '导入失败') }
  finally { busy.value = false }
}
const requestDestinationImport = (destination: DeliveryDestination) => {
  if (!settings.value.requireConfirmation) { void runDestinationImport(destination); return }
  pendingImport.value = { destination, label: destinationLabel(destination) }
}
const confirmDestinationImport = async () => {
  if (!selected.value || !pendingImport.value || busy.value) return
  await runDestinationImport(pendingImport.value.destination)
}

const openChatShare = () => {
  chatTargets.value = listDeliveryChatTargets()
  chatTargetId.value = chatTargets.value[0]?.id ?? null
  chatReadThisTime.value = false
  chatRememberThisTime.value = false
  showChatTargets.value = true
}

const confirmChatShare = () => {
  if (!selected.value || chatTargetId.value === null) return
  try {
    sendDeliveryToChat(selected.value, chatTargetId.value, { allowCharacterRead: chatReadThisTime.value, allowMemory: chatReadThisTime.value && chatRememberThisTime.value })
    showChatTargets.value = false
    notify(chatReadThisTime.value ? '已发到聊天，并按本次授权提供内容' : '已发到聊天；角色无法读取投递内容')
  } catch (error) { notify(error instanceof Error ? error.message : '发送到聊天失败') }
}

onMounted(async () => {
  receivingTimer = setInterval(() => {
    clockNow.value = Date.now()
    if (settings.value.receivingEnabled && settings.value.receivingUntil && settings.value.receivingUntil <= clockNow.value) {
      stopScan()
      settings.value.receivingEnabled = false
      settings.value.receivingUntil = null
      settings.value = saveDeliverySettings(settings.value)
    }
  }, 15_000)
  await refresh()
  const systemShares = await consumePendingSystemShares()
  if (systemShares.imported.length) {
    await refresh()
    notify(`已接收 ${systemShares.imported.length} 份系统分享`)
    await openItem(systemShares.imported[0]!, 'home')
  }
  if (systemShares.failed) notify(`${systemShares.failed} 份系统分享未能导入，请检查文件大小或格式`)
  const currentUrl = new URL(window.location.href)
  if (currentUrl.searchParams.get('delivery-error') === '1') {
    currentUrl.searchParams.delete('delivery-error')
    window.history.replaceState({}, '', currentUrl.toString())
    notify('系统分享未能保存，请重试')
  }
})
onBeforeUnmount(() => { stopScan(); if (toastTimer) clearTimeout(toastTimer); if (receivingTimer) clearInterval(receivingTimer) })
</script>

<template>
  <div class="delivery-app" :class="{ 'dark-mode': globalSettings.darkMode }">
    <header class="delivery-header">
      <button class="icon-button" type="button" :aria-label="view === 'home' ? '关闭' : '返回'" @click="goBack">
        <svg viewBox="0 0 24 24"><path v-if="view==='home'" d="m6 6 12 12M18 6 6 18"/><path v-else d="m15 5-7 7 7 7"/></svg>
      </button>
      <div class="header-copy"><h1>{{ view==='home'?'投递':view==='compose'?'新建投递':view==='receive'?'接收':view==='history'?'投递箱':view==='settings'?'投递设置':selected?.title||'投递详情' }}</h1><p>{{ view==='home'?'内容中转与设备接力':view==='compose'?'文字、链接与文件':view==='receive'?'扫码、口令或投递包':view==='history'?'全部保存在当前设备':view==='settings'?'默认不开放接收、不连接聊天':'确认内容后再处理' }}</p></div>
      <div class="header-end"><button v-if="view==='home'" class="icon-button" type="button" aria-label="设置" @click="openView('settings')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg></button></div>
    </header>

    <main v-if="view==='home'" class="scroll-view home-view">
      <section class="status-card" :class="{ active: receivingActive }"><div class="status-mark"><span></span><i></i></div><div><strong>{{ receivingActive?'正在接收':'接收已关闭' }}</strong><p>{{ receivingActive?(settings.receivingUntil?`将在 ${formatTime(settings.receivingUntil)} 自动关闭`:'仅在你打开投递时接收'):'不会被陌生设备发现，也不会自动接收内容' }}</p></div><button type="button" @click="receivingActive?disableReceiving():enableReceiving(10)">{{ receivingActive?'关闭':'开 10 分钟' }}</button></section>
      <section class="action-grid"><button type="button" @click="openCompose"><i>＋</i><span><b>发送内容</b><small>文字、链接、文件</small></span></button><button type="button" @click="openView('receive')"><i>⌁</i><span><b>接收投递</b><small>扫码、口令、文件</small></span></button><button type="button" @click="packageInput?.click()"><i>⇩</i><span><b>打开投递包</b><small>.nrjdrop 文件</small></span></button><button type="button" @click="openView('history')"><i>□</i><span><b>投递箱</b><small>{{ items.length }} 份本地内容</small></span></button></section>
      <section class="section-block"><div class="section-heading"><div><h2>最近投递</h2><p>内容只保存在当前设备</p></div><button v-if="items.length>3" type="button" @click="openView('history')">查看全部</button></div><div v-if="!recentItems.length" class="empty-state"><span>投</span><strong>投递箱还是空的</strong><p>可以保存一段文字、分享文件，或从另一台设备导入投递包。</p></div><button v-for="item in recentItems" v-else :key="item.id" class="delivery-row" type="button" @click="openItem(item,'home')"><span class="kind-icon">{{ item.kind==='link'?'链':item.kind==='text'?'文':item.kind==='image'?'图':item.kind==='book'?'书':item.kind==='bubble'?'泡':'件' }}</span><span class="row-main"><b>{{ item.title }}</b><small>{{ deliveryKindLabel(item.kind) }}<template v-if="item.files.length"> · {{ item.files.length }} 个文件 · {{ formatDeliverySize(totalSize(item)) }}</template></small></span><time>{{ formatTime(item.updatedAt) }}</time><em>›</em></button></section>
      <section class="privacy-note"><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.5 2.7 8.1 7 10 4.3-1.9 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg><div><b>本地优先</b><p>未配置远程服务。投递不会自动上传，也不会默认进入聊天、记忆或角色提示词。</p></div></section>
    </main>

    <main v-else-if="view==='compose'" class="scroll-view compose-view">
      <section class="form-card"><label><span>投递名称</span><input v-model="draft.title" maxlength="100" placeholder="可不填，将自动使用文件名"></label><label><span>文字内容</span><textarea v-model="draft.text" maxlength="100000" rows="5" placeholder="写下要接力或分享的内容"></textarea></label><label><span>网址</span><input v-model="draft.url" type="url" inputmode="url" placeholder="https://"></label><label><span>附言</span><textarea v-model="draft.note" maxlength="2000" rows="2" placeholder="接收方拆开前可看到"></textarea></label></section>
      <section class="form-card"><div class="card-title"><div><b>文件</b><small>{{ draftFiles.length?`${draftFiles.length} 个，共 ${formatDeliverySize(composerSize)}`:'单个不超过 80MB，合计不超过 200MB' }}</small></div><button type="button" @click="chooseFiles">添加</button></div><div v-if="draftFiles.length" class="file-list"><div v-for="(file,index) in draftFiles" :key="`${file.name}-${index}`"><span><b>{{ file.name }}</b><small>{{ file.type||'未知类型' }} · {{ formatDeliverySize(file.size) }}</small></span><button type="button" aria-label="移除文件" @click="removeDraftFile(index)">×</button></div></div></section>
      <section class="form-card compact-card"><label class="select-row"><span><b>有效时间</b><small>过期时间会写进投递包和口令</small></span><select v-model="draft.expires"><option value="none">不设期限</option><option value="10m">10 分钟</option><option value="1h">1 小时</option><option value="1d">24 小时</option></select></label></section>
      <div class="bottom-actions"><button type="button" :disabled="!canCreate||busy" @click="saveDraft('save')">保存到投递箱</button><button class="primary" type="button" :disabled="!canCreate||busy" @click="saveDraft('share')">{{ busy?'处理中…':'系统分享' }}</button></div>
    </main>

    <main v-else-if="view==='receive'" class="scroll-view receive-view">
      <section v-if="!receivingActive" class="receive-gate"><span>⌁</span><h2>接收目前是关闭的</h2><p>开启后才能使用相机、相册或口令接收。投递不会自动进入聊天，也不会在后台扫描设备。</p><button type="button" @click="enableReceiving(10)">开启 10 分钟</button></section>
      <template v-else>
        <section class="receive-hero"><div class="scan-box" :class="{ scanning }"><video v-show="scanning" ref="scanVideo" muted playsinline></video><template v-if="!scanning"><span>⌁</span><b>扫描投递二维码</b><p>只在点击后申请相机权限</p></template><i v-if="scanning"></i></div><button v-if="!scanning" class="primary-wide" type="button" @click="startScan">打开相机扫码</button><button v-else class="secondary-wide" type="button" @click="stopScan">停止扫码</button></section>
        <section class="receive-options"><button type="button" @click="qrImageInput?.click()"><i>▧</i><span><b>从相册识别</b><small>选择二维码截图</small></span><em>›</em></button><button type="button" @click="packageInput?.click()"><i>⇩</i><span><b>导入投递包</b><small>适合图片、视频与大文件</small></span><em>›</em></button></section>
        <section class="code-card"><label>粘贴投递口令</label><textarea v-model="receiveCode" rows="4" placeholder="以 nrjdelivery: 开头；普通 https 链接也可以直接接收"></textarea><button type="button" :disabled="!receiveCode.trim()||busy" @click="consumeCode()">{{ busy?'正在识别…':'接收这份投递' }}</button></section>
        <p class="receive-tip">二维码只适合文字、链接和连接信息。带文件的内容请使用投递包或系统分享。</p>
      </template>
    </main>

    <main v-else-if="view==='history'" class="history-view"><div class="filter-row"><button v-for="filter in [{id:'all',name:'全部'},{id:'received',name:'收到'},{id:'sent',name:'发出'},{id:'saved',name:'保存'}]" :key="filter.id" type="button" :class="{active:activeHistoryFilter===filter.id}" @click="activeHistoryFilter=filter.id as any">{{ filter.name }}</button></div><div class="history-list"><div v-if="!filteredItems.length" class="empty-state"><span>□</span><strong>没有这类投递</strong><p>新的内容会出现在这里。</p></div><button v-for="item in filteredItems" v-else :key="item.id" class="delivery-row" type="button" @click="openItem(item,'history')"><span class="kind-icon">{{ item.kind==='link'?'链':item.kind==='text'?'文':item.kind==='image'?'图':item.kind==='book'?'书':item.kind==='bubble'?'泡':'件' }}</span><span class="row-main"><b>{{ item.title }}</b><small>{{ deliveryKindLabel(item.kind) }} · {{ item.direction==='received'?'收到':item.direction==='sent'?'发出':'保存在本机' }}<template v-if="item.expiresAt"> · {{ item.expiresAt>Date.now()?'限时':'已过期' }}</template></small></span><time>{{ formatTime(item.updatedAt) }}</time><em>›</em></button></div></main>

    <main v-else-if="view==='detail'&&selected" class="scroll-view detail-view">
      <section class="parcel-card"><div class="parcel-icon">{{ selected.kind==='link'?'链':selected.kind==='text'?'文':selected.kind==='image'?'图':selected.kind==='book'?'书':selected.kind==='bubble'?'泡':'投' }}</div><h2>{{ selected.title }}</h2><p>{{ deliveryKindLabel(selected.kind) }} · {{ selected.files.length?`${selected.files.length} 个文件，${formatDeliverySize(totalSize(selected))}`:'无附件' }}</p><div class="meta-line"><span>{{ selected.direction==='received'?'已接收':selected.direction==='sent'?'已发出':'保存在本机' }}</span><span>{{ new Date(selected.createdAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) }}</span><span v-if="selected.expiresAt" :class="{expired:selected.expiresAt<=Date.now()}">{{ selected.expiresAt>Date.now()?'限时有效':'已过期' }}</span></div></section>
      <section v-if="selected.note" class="content-card"><label>附言</label><p>{{ selected.note }}</p></section><section v-if="selected.text" class="content-card"><label>文字</label><p class="preserve">{{ selected.text }}</p><button type="button" @click="copySelectedContent">复制文字</button></section><section v-if="selected.url" class="content-card"><label>链接</label><a :href="selected.url" target="_blank" rel="noopener noreferrer">{{ selected.url }}</a><button type="button" @click="copySelectedContent">复制链接</button></section>
      <section v-if="selectedFiles.length" class="content-card"><label>文件</label><div class="file-list"><div v-for="(file,index) in selectedFiles" :key="`${file.name}-${index}`"><span><b>{{ file.name }}</b><small>{{ file.type||'未知类型' }} · {{ formatDeliverySize(file.size) }}</small></span><button type="button" @click="downloadDeliveryFile(file)">保存</button></div></div></section>
      <section v-if="selectedDestinations.length" class="destination-card"><div class="section-heading"><div><h2>交给其他应用</h2><p>导入前会校验，现有内容不会被覆盖</p></div></div><button v-for="destination in selectedDestinations" :key="destination" type="button" @click="requestDestinationImport(destination)"><span><b>{{ destinationLabel(destination) }}</b><small>{{ destinationDescription(destination) }}</small></span><em>导入</em></button></section>
      <section class="detail-actions"><button type="button" :disabled="busy" @click="shareSelected">系统分享</button><button type="button" :disabled="busy" @click="downloadPackage">导出投递包</button><button v-if="!selected.files.length" type="button" @click="makeQr">生成二维码</button><button v-if="settings.chatIntegration.enabled" type="button" @click="openChatShare">发到聊天</button><button class="danger-text" type="button" @click="confirmDelete=true">删除</button></section>
      <section v-if="qrDataUrl" class="qr-card"><img :src="qrDataUrl" alt="投递二维码"><p>另一台设备打开“投递 → 接收投递”扫描</p><button type="button" @click="copyValue(qrPayload,'投递口令已复制')">复制口令</button></section>
    </main>

    <main v-else class="scroll-view settings-view">
      <section class="settings-group"><h2>接收方式</h2><label class="setting-row"><span><b>允许接收</b><small>默认关闭；控制相机、相册与口令接收入口</small></span><input :checked="receivingActive" type="checkbox" @change="receivingActive?disableReceiving():enableReceiving(null)"><i></i></label><div class="quick-duration"><button type="button" @click="enableReceiving(10)">10 分钟</button><button type="button" @click="enableReceiving(60)">1 小时</button><button type="button" @click="enableReceiving(null)">持续开启</button></div><label class="setting-row"><span><b>导入其他应用前确认</b><small>关闭后点击书城、世界书或气泡工坊会立即导入</small></span><input v-model="settings.requireConfirmation" type="checkbox" @change="saveSettingsNow"><i></i></label></section>
      <section class="settings-group"><h2>聊天与角色</h2><label class="setting-row"><span><b>允许投递连接聊天</b><small>默认关闭；关闭时详情页不会出现聊天入口</small></span><input v-model="settings.chatIntegration.enabled" type="checkbox" @change="saveSettingsNow"><i></i></label><template v-if="settings.chatIntegration.enabled"><label class="setting-row nested"><span><b>允许单次正文授权</b><small>发送时仍然默认不允许，需要每份投递再次勾选</small></span><input v-model="settings.chatIntegration.allowCharacterRead" type="checkbox" @change="saveSettingsNow"><i></i></label><label class="setting-row nested"><span><b>允许单次记忆授权</b><small>发送时仍然默认不写入，需要与正文授权一起勾选</small></span><input v-model="settings.chatIntegration.allowMemory" :disabled="!settings.chatIntegration.allowCharacterRead" type="checkbox" @change="saveSettingsNow"><i></i></label></template><p class="group-note">不会增加常驻提示词。只有你从详情页选择联系人，并对某一份投递明确授权时，内容才会进入该聊天。</p></section>
      <section class="info-card"><b>当前传输边界</b><p>网页版通过系统分享、投递包和二维码工作，不会伪装成系统 AirDrop，也不会后台扫描附近设备。文件始终由你主动选择和接收。</p></section>
    </main>

    <input ref="fileInput" type="file" multiple hidden @change="onFiles"><input ref="packageInput" type="file" accept=".nrjdrop,application/vnd.nianrenji.delivery+zip" hidden @change="onPackageFile"><input ref="qrImageInput" type="file" accept="image/*" hidden @change="onQrImage">
    <div v-if="confirmDelete" class="modal-layer" @click.self="confirmDelete=false"><section class="confirm-card"><h2>删除这份投递？</h2><p>投递记录和本机保存的附件都会删除，已经分享出去的副本不受影响。</p><div><button type="button" @click="confirmDelete=false">取消</button><button class="danger" type="button" @click="removeSelected">删除</button></div></section></div>
    <div v-if="pendingImport" class="modal-layer" @click.self="pendingImport=null"><section class="confirm-card"><h2>导入到{{ pendingImport.label }}？</h2><p>内容会经过格式校验并作为新内容加入，不会覆盖已有数据。部分复杂格式可能需要一些处理时间。</p><div><button type="button" @click="pendingImport=null">取消</button><button class="confirm" type="button" :disabled="busy" @click="confirmDestinationImport">{{ busy?'正在导入…':'确认导入' }}</button></div></section></div>
    <div v-if="showChatTargets" class="modal-layer" @click.self="showChatTargets=false"><section class="chat-share-card"><header><h2>发到聊天</h2><p>投递卡会写入你选择的聊天；角色读取仍按本次授权决定。</p></header><div v-if="chatTargets.length" class="chat-target-list"><label v-for="target in chatTargets" :key="target.id"><input v-model="chatTargetId" type="radio" :value="target.id"><span class="target-avatar" :style="target.avatarUrl?{backgroundImage:`url(${target.avatarUrl})`}:{}">{{ target.avatarUrl?'':target.avatarText }}</span><b>{{ target.name }}</b><i></i></label></div><p v-else class="no-target">还没有可用的角色联系人，请先在聊天中创建联系人。</p><div v-if="chatTargets.length" class="chat-permissions"><label :class="{disabled:!settings.chatIntegration.allowCharacterRead}"><input v-model="chatReadThisTime" :disabled="!settings.chatIntegration.allowCharacterRead" type="checkbox"><span><b>允许 TA 读取这份投递</b><small>只影响当前这一份，默认不勾选</small></span><i></i></label><label :class="{disabled:!chatReadThisTime||!settings.chatIntegration.allowMemory}"><input v-model="chatRememberThisTime" :disabled="!chatReadThisTime||!settings.chatIntegration.allowMemory" type="checkbox"><span><b>允许写入长期记忆</b><small>不勾选时只用于普通聊天上下文</small></span><i></i></label></div><footer><button type="button" @click="showChatTargets=false">取消</button><button class="confirm" type="button" :disabled="chatTargetId===null" @click="confirmChatShare">发送</button></footer></section></div>
    <Transition name="toast"><div v-if="toast" class="delivery-toast" role="status">{{ toast }}</div></Transition>
  </div>
</template>

<style scoped src="./app_Delivery.css"></style>
