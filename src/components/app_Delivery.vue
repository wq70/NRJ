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
import DeliveryComposeModal from './delivery/modals/DeliveryComposeModal.vue'

const emit = defineEmits<{ close: [] }>()
type View = 'home' | 'receive' | 'history' | 'detail' | 'settings'

const view = ref<View>('home')
const previousView = ref<View>('home')
const items = ref<DeliveryItem[]>([])
const selected = ref<DeliveryItem | null>(null)
const selectedFiles = ref<File[]>([])
const showComposeModal = ref(false)
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

const openCompose = () => { showComposeModal.value = true }

const onComposeSuccess = async (item: DeliveryItem, message: string) => {
  showComposeModal.value = false
  await refresh()
  notify(message)
  const found = await listDeliveries().then(list => list.find(entry => entry.id === item.id) || item)
  selected.value = found
  selectedFiles.value = await getDeliveryFiles(found)
  previousView.value = 'home'
  view.value = 'detail'
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
    qrDataUrl.value = await QRCode.toDataURL(qrPayload.value, { width: 280, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1d1d1f', light: '#ffffff' } })
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
    <!-- 顶栏：Apple 纯正返回手感与控制中心偏好设置图标 -->
    <header class="delivery-header">
      <button class="nav-btn" type="button" :aria-label="view === 'home' ? '关闭' : '返回'" @click="goBack">
        <!-- 永远告别粗糙叉号，统一为 Apple 优雅圆角返回手感 -->
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M15.5 19L8.5 12L15.5 5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="header-copy">
        <h1>{{ view==='home'?'隔空投递':view==='receive'?'接收投递':view==='history'?'投递箱':view==='settings'?'偏好设置':selected?.title||'投递详情' }}</h1>
        <p>{{ view==='home'?'内容中转与设备接力':view==='receive'?'扫码、口令或投递包':view==='history'?'全部保存在当前设备':view==='settings'?'默认不开放接收、不连接聊天':'确认内容后再处理' }}</p>
      </div>
      <div class="header-end">
        <button v-if="view==='home'" class="nav-btn" type="button" aria-label="设置" @click="openView('settings')">
          <!-- Apple 官方 SF Symbol: slider.horizontal.3 控制中心高定偏好滑块 -->
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M4 6h16M4 12h16M4 18h16" stroke-width="2" stroke-linecap="round"/>
            <circle cx="8" cy="6" r="2.5" fill="var(--bg-pure)" stroke-width="2"/>
            <circle cx="16" cy="12" r="2.5" fill="var(--bg-pure)" stroke-width="2"/>
            <circle cx="10" cy="18" r="2.5" fill="var(--bg-pure)" stroke-width="2"/>
          </svg>
        </button>
      </div>
    </header>

    <!-- 主页：纯白 iOS 隔空投送风格重塑 -->
    <main v-if="view==='home'" class="scroll-view home-view">
      <!-- 1. 核心接力雷达态 -->
      <section class="radar-hub" @click="receivingActive?disableReceiving():enableReceiving(10)">
        <div class="pulse-ring-container">
          <div v-if="receivingActive" class="pulse-wave"></div>
          <div v-if="receivingActive" class="pulse-wave delay"></div>
          <div class="pulse-emitter" :class="{ off: !receivingActive }">
            <!-- Apple 官方 AirDrop 原生三层同心圆弧波纹 -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0" fill="currentColor"/>
              <path d="M7.76 16.24a6 6 0 0 1 0-8.48" stroke-width="2" stroke-linecap="round"/>
              <path d="M16.24 7.76a6 6 0 0 1 0 8.48" stroke-width="2" stroke-linecap="round"/>
              <path d="M4.93 19.07a10 10 0 0 1 0-14.14" stroke-width="2" stroke-linecap="round"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </div>
        </div>
        <h2>{{ receivingActive ? '正在接收投递' : '接收已静默保护' }}</h2>
        <p>{{ receivingActive ? (settings.receivingUntil ? `将在 ${formatTime(settings.receivingUntil)} 自动关闭 · 点击关闭` : '持续接收中 · 点击关闭') : '不会被外部设备发现，点击即开启 10 分钟接收' }}</p>
        <div class="radar-status-pill" :class="{ off: !receivingActive }">
          <div v-if="receivingActive" class="status-dot"></div>
          <span>{{ receivingActive ? (settings.receivingUntil ? `倒计时到 ${formatTime(settings.receivingUntil)}` : '持续开启中') : '轻触快速开启' }}</span>
        </div>
      </section>

      <!-- 2. 双生核心流：发起投递 & 扫码接收 -->
      <section class="action-duo">
        <div class="duo-card primary-send" @click="openCompose">
          <div class="duo-icon-box">
            <!-- Apple SF Symbol: square.and.arrow.up 向上分享托盘 -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 3v11M12 3l4 4M12 3L8 7" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 11v7a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-7" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="duo-text">
            <strong>发起投递</strong>
            <span>文字 · 链接 · 文件</span>
          </div>
        </div>

        <div class="duo-card primary-receive" @click="openView('receive')">
          <div class="duo-icon-box">
            <!-- Apple SF Symbol: qrcode.viewfinder 原生扫码寻像仪 -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
              <rect x="8.5" y="8.5" width="3" height="3" rx="0.5" fill="currentColor"/>
              <rect x="13.5" y="8.5" width="3" height="3" rx="0.5" fill="currentColor"/>
              <rect x="8.5" y="13.5" width="3" height="3" rx="0.5" fill="currentColor"/>
              <circle cx="15" cy="15" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="duo-text">
            <strong>扫码与接收</strong>
            <span>口令 · 镜头 · 相册</span>
          </div>
        </div>
      </section>

      <!-- 3. 便捷工具行：打开投递包 & 投递箱列表 -->
      <section class="util-row-group">
        <div class="util-row-item" @click="packageInput?.click()">
          <div class="util-left">
            <div class="util-icon">
              <!-- Apple SF Symbol: shippingbox -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 8l9-4.5 9 4.5v9.5a2 2 0 0 1-1 1.73l-8 4.27-8-4.27a2 2 0 0 1-1-1.73z" stroke-width="1.9" stroke-linejoin="round"/>
                <path d="M12 3.5v18.5M3 8l9 4.5 9-4.5" stroke-width="1.9" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="util-label">打开投递包 (.nrjdrop)</span>
          </div>
          <div class="util-meta">
            <span>导入文件</span>
            <svg class="chevron-svg" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>

        <div class="util-row-item" @click="openView('history')">
          <div class="util-left">
            <div class="util-icon">
              <!-- Apple SF Symbol: tray.2 档案抽屉托盘 -->
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M4 14h3.5a2 2 0 0 1 1.8 1.12l.4.76a2 2 0 0 0 1.8 1.12h1a2 2 0 0 0 1.8-1.12l.4-.76A2 2 0 0 1 17.5 14H20" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M4 10l1.6-4.8A2 2 0 0 1 7.5 4h9a2 2 0 0 1 1.9 1.2L20 10v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <span class="util-label">全部投递箱</span>
          </div>
          <div class="util-meta">
            <span>{{ items.length }} 份内容</span>
            <svg class="chevron-svg" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>
      </section>

      <!-- 4. 最近投递记录 -->
      <div class="section-title-wrap">
        <span class="section-title">最近投递</span>
        <button v-if="items.length > 3" class="section-more-link" type="button" @click="openView('history')">管理全部</button>
      </div>

      <section class="recent-list">
        <div v-if="!recentItems.length" class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 14h3.5a2 2 0 0 1 1.8 1.12l.4.76a2 2 0 0 0 1.8 1.12h1a2 2 0 0 0 1.8-1.12l.4-.76A2 2 0 0 1 17.5 14H20" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M4 10l1.6-4.8A2 2 0 0 1 7.5 4h9a2 2 0 0 1 1.9 1.2L20 10v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <strong>投递箱暂无内容</strong>
          <p>可保存一段文字、分享文件，或从另一台设备导入投递包。</p>
        </div>

        <div v-for="item in recentItems" v-else :key="item.id" class="delivery-item-card" @click="openItem(item,'home')">
          <div class="type-badge" :class="item.kind">
            {{ item.kind==='link'?'链':item.kind==='text'?'文':item.kind==='image'?'图':item.kind==='book'?'书':item.kind==='bubble'?'泡':'件' }}
          </div>
          <div class="item-body">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-desc">
              <span>{{ deliveryKindLabel(item.kind) }}</span>
              <template v-if="item.files.length">
                <span>·</span>
                <span>{{ item.files.length }} 个文件 · {{ formatDeliverySize(totalSize(item)) }}</span>
              </template>
            </div>
          </div>
          <span class="item-time">{{ formatTime(item.updatedAt) }}</span>
        </div>
      </section>

      <!-- 5. 底部隐私保护声明 -->
      <div class="privacy-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>本地优先：所有投递内容仅保存在当前设备沙盒中，未经授权绝不上云、不自动进入聊天。</span>
      </div>
    </main>

    <!-- 接收投递页 -->
    <main v-else-if="view==='receive'" class="scroll-view receive-view">
      <section v-if="!receivingActive" class="receive-gate">
        <div class="gate-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 12m-2.2 0a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0" fill="currentColor"/>
            <path d="M7.76 16.24a6 6 0 0 1 0-8.48" stroke-width="2" stroke-linecap="round"/>
            <path d="M16.24 7.76a6 6 0 0 1 0 8.48" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2>接收目前处于静默保护</h2>
        <p>开启后方可使用相机扫码、相册识别或口令接收。投递不会自动进入聊天，也不会在后台扫描陌生设备。</p>
        <button type="button" @click="enableReceiving(10)">开启 10 分钟接收</button>
      </section>
      <template v-else>
        <section class="receive-hero">
          <div class="scan-box" :class="{ scanning }">
            <video v-show="scanning" ref="scanVideo" muted playsinline></video>
            <template v-if="!scanning">
              <div class="scan-icon-mock">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" stroke-width="2.2" stroke-linecap="round"/>
                </svg>
              </div>
              <b>扫描投递二维码</b>
              <p>轻点下方按钮申请相机权限</p>
            </template>
            <i v-if="scanning"></i>
          </div>
          <button v-if="!scanning" class="primary-wide" type="button" @click="startScan">打开相机扫码</button>
          <button v-else class="secondary-wide" type="button" @click="stopScan">停止扫码</button>
        </section>
        <section class="util-row-group" style="margin-bottom: 14px;">
          <div class="util-row-item" @click="qrImageInput?.click()">
            <div class="util-left">
              <div class="util-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke-width="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
                  <polyline points="21 15 16 10 5 21" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
              <span class="util-label">从相册识别</span>
            </div>
            <div class="util-meta">
              <span>选择二维码</span>
              <svg class="chevron-svg" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
          <div class="util-row-item" @click="packageInput?.click()">
            <div class="util-left">
              <div class="util-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 8l9-4.5 9 4.5v9.5a2 2 0 0 1-1 1.73l-8 4.27-8-4.27a2 2 0 0 1-1-1.73z" stroke-width="1.9" stroke-linejoin="round"/>
                  <path d="M12 3.5v18.5M3 8l9 4.5 9-4.5" stroke-width="1.9" stroke-linejoin="round"/>
                </svg>
              </div>
              <span class="util-label">导入投递包</span>
            </div>
            <div class="util-meta">
              <span>适合大文件</span>
              <svg class="chevron-svg" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
        </section>
        <section class="code-card">
          <label>粘贴投递口令</label>
          <textarea v-model="receiveCode" rows="4" placeholder="以 nrjdelivery: 开头；普通 https 链接亦可直接识别"></textarea>
          <button type="button" :disabled="!receiveCode.trim()||busy" @click="consumeCode()">{{ busy?'正在识别…':'接收这份投递' }}</button>
        </section>
        <p class="receive-tip">二维码适合轻量文字、链接。包含文件的大型内容推荐使用投递包或系统分享接力。</p>
      </template>
    </main>

    <!-- 投递箱列表页 -->
    <main v-else-if="view==='history'" class="history-view">
      <div class="filter-row">
        <button v-for="filter in [{id:'all',name:'全部'},{id:'received',name:'收到'},{id:'sent',name:'发出'},{id:'saved',name:'保存'}]" :key="filter.id" type="button" :class="{active:activeHistoryFilter===filter.id}" @click="activeHistoryFilter=filter.id as any">{{ filter.name }}</button>
      </div>
      <div class="history-list">
        <div v-if="!filteredItems.length" class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 14h3.5a2 2 0 0 1 1.8 1.12l.4.76a2 2 0 0 0 1.8 1.12h1a2 2 0 0 0 1.8-1.12l.4-.76A2 2 0 0 1 17.5 14H20" stroke-width="1.8" stroke-linecap="round"/>
              <path d="M4 10l1.6-4.8A2 2 0 0 1 7.5 4h9a2 2 0 0 1 1.9 1.2L20 10v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <strong>暂无该类投递</strong>
          <p>新的收发记录会整齐呈现在这里。</p>
        </div>
        <div v-for="item in filteredItems" v-else :key="item.id" class="delivery-item-card" @click="openItem(item,'history')">
          <div class="type-badge" :class="item.kind">
            {{ item.kind==='link'?'链':item.kind==='text'?'文':item.kind==='image'?'图':item.kind==='book'?'书':item.kind==='bubble'?'泡':'件' }}
          </div>
          <div class="item-body">
            <div class="item-title">{{ item.title }}</div>
            <div class="item-desc">
              <span>{{ deliveryKindLabel(item.kind) }}</span>
              <span>·</span>
              <span>{{ item.direction==='received'?'收到':item.direction==='sent'?'发出':'本机' }}</span>
              <template v-if="item.expiresAt">
                <span>·</span>
                <span :class="{expired:item.expiresAt<=Date.now()}">{{ item.expiresAt>Date.now()?'限时':'已过期' }}</span>
              </template>
            </div>
          </div>
          <span class="item-time">{{ formatTime(item.updatedAt) }}</span>
        </div>
      </div>
    </main>

    <!-- 详情页 -->
    <main v-else-if="view==='detail'&&selected" class="scroll-view detail-view">
      <section class="parcel-card">
        <div class="parcel-icon">
          {{ selected.kind==='link'?'链':selected.kind==='text'?'文':selected.kind==='image'?'图':selected.kind==='book'?'书':selected.kind==='bubble'?'泡':'投' }}
        </div>
        <h2>{{ selected.title }}</h2>
        <p>{{ deliveryKindLabel(selected.kind) }} · {{ selected.files.length?`${selected.files.length} 个文件，${formatDeliverySize(totalSize(selected))}`:'无附件' }}</p>
        <div class="meta-line">
          <span>{{ selected.direction==='received'?'已接收':selected.direction==='sent'?'已发出':'本机留存' }}</span>
          <span>{{ new Date(selected.createdAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) }}</span>
          <span v-if="selected.expiresAt" :class="{expired:selected.expiresAt<=Date.now()}">{{ selected.expiresAt>Date.now()?'限时有效':'已过期' }}</span>
        </div>
      </section>

      <section v-if="selected.note" class="content-card"><label>附言</label><p>{{ selected.note }}</p></section>
      <section v-if="selected.text" class="content-card"><label>正文内容</label><p class="preserve">{{ selected.text }}</p><button type="button" @click="copySelectedContent">复制文字</button></section>
      <section v-if="selected.url" class="content-card"><label>链接网址</label><a :href="selected.url" target="_blank" rel="noopener noreferrer">{{ selected.url }}</a><button type="button" @click="copySelectedContent">复制链接</button></section>
      <section v-if="selectedFiles.length" class="content-card">
        <label>附件文件</label>
        <div class="file-list">
          <div v-for="(file,index) in selectedFiles" :key="`${file.name}-${index}`">
            <span><b>{{ file.name }}</b><small>{{ file.type||'未知类型' }} · {{ formatDeliverySize(file.size) }}</small></span>
            <button type="button" @click="downloadDeliveryFile(file)">保存</button>
          </div>
        </div>
      </section>
      <section v-if="selectedDestinations.length" class="destination-card">
        <div class="section-heading">
          <div><h2>交给其他应用</h2><p>导入前将执行安全校验，现有内容不会被覆盖</p></div>
        </div>
        <button v-for="destination in selectedDestinations" :key="destination" type="button" @click="requestDestinationImport(destination)">
          <span><b>{{ destinationLabel(destination) }}</b><small>{{ destinationDescription(destination) }}</small></span>
          <em>导入</em>
        </button>
      </section>
      <section class="detail-actions">
        <button type="button" :disabled="busy" @click="shareSelected">系统分享</button>
        <button type="button" :disabled="busy" @click="downloadPackage">导出投递包</button>
        <button v-if="!selected.files.length" type="button" @click="makeQr">生成二维码</button>
        <button v-if="settings.chatIntegration.enabled" type="button" @click="openChatShare">发到聊天</button>
        <button class="danger-text" type="button" @click="confirmDelete=true">删除投递</button>
      </section>
      <section v-if="qrDataUrl" class="qr-card">
        <img :src="qrDataUrl" alt="投递二维码">
        <p>对方打开“隔空投递 → 扫码接收”即可直接录入</p>
        <button type="button" @click="copyValue(qrPayload,'投递口令已复制')">复制口令</button>
      </section>
    </main>

    <!-- 设置页 -->
    <main v-else class="scroll-view settings-view">
      <section class="settings-group">
        <h2>接收与时效</h2>
        <label class="setting-row">
          <span><b>开放设备接收</b><small>控制相机、相册与口令接收入口</small></span>
          <input :checked="receivingActive" type="checkbox" @change="receivingActive?disableReceiving():enableReceiving(null)">
          <i></i>
        </label>
        <div class="quick-duration">
          <button type="button" @click="enableReceiving(10)">10 分钟</button>
          <button type="button" @click="enableReceiving(60)">1 小时</button>
          <button type="button" @click="enableReceiving(null)">持续开启</button>
        </div>
        <label class="setting-row">
          <span><b>导入应用前二次确认</b><small>关闭后点击书城、世界书或气泡工坊会直接加入</small></span>
          <input v-model="settings.requireConfirmation" type="checkbox" @change="saveSettingsNow">
          <i></i>
        </label>
      </section>
      <section class="settings-group">
        <h2>聊天与角色桥接</h2>
        <label class="setting-row">
          <span><b>允许投递连接聊天</b><small>默认关闭；关闭时详情页不显示聊天入口</small></span>
          <input v-model="settings.chatIntegration.enabled" type="checkbox" @change="saveSettingsNow">
          <i></i>
        </label>
        <template v-if="settings.chatIntegration.enabled">
          <label class="setting-row nested">
            <span><b>允许单次正文授权</b><small>发送时仍需每份投递显式勾选</small></span>
            <input v-model="settings.chatIntegration.allowCharacterRead" type="checkbox" @change="saveSettingsNow">
            <i></i>
          </label>
          <label class="setting-row nested">
            <span><b>允许单次记忆授权</b><small>发送时需与正文授权一同勾选</small></span>
            <input v-model="settings.chatIntegration.allowMemory" :disabled="!settings.chatIntegration.allowCharacterRead" type="checkbox" @change="saveSettingsNow">
            <i></i>
          </label>
        </template>
        <p class="group-note">绝不增加常驻提示词。仅在你主动选择联系人并逐一授权后，内容才流入该聊天会话。</p>
      </section>
      <section class="info-card">
        <b>传输安全边界</b>
        <p>纯本地优先，通过系统原生分享、加密投递包和二维码流转，绝不后台广播嗅探，文件全链路受控。</p>
      </section>
    </main>

    <!-- 居中弹窗：新建投递 -->
    <DeliveryComposeModal
      v-if="showComposeModal"
      @close="showComposeModal = false"
      @success="onComposeSuccess"
      @notify="notify"
    />

    <!-- 隐藏原语与弹层 -->
    <input ref="packageInput" type="file" accept=".nrjdrop,application/vnd.nianrenji.delivery+zip" hidden @change="onPackageFile">
    <input ref="qrImageInput" type="file" accept="image/*" hidden @change="onQrImage">

    <div v-if="confirmDelete" class="modal-layer" @click.self="confirmDelete=false">
      <section class="confirm-card">
        <h2>删除这份投递？</h2>
        <p>投递记录和本机保存的附件都会删除，已经分享出去的副本不受影响。</p>
        <div>
          <button type="button" @click="confirmDelete=false">取消</button>
          <button class="danger" type="button" @click="removeSelected">删除</button>
        </div>
      </section>
    </div>

    <div v-if="pendingImport" class="modal-layer" @click.self="pendingImport=null">
      <section class="confirm-card">
        <h2>导入到{{ pendingImport.label }}？</h2>
        <p>内容会经过格式校验并作为新内容加入，不会覆盖已有数据。</p>
        <div>
          <button type="button" @click="pendingImport=null">取消</button>
          <button class="confirm" type="button" :disabled="busy" @click="confirmDestinationImport">{{ busy?'正在导入…':'确认导入' }}</button>
        </div>
      </section>
    </div>

    <div v-if="showChatTargets" class="modal-layer" @click.self="showChatTargets=false">
      <section class="chat-share-card">
        <header>
          <h2>发到聊天</h2>
          <p>投递卡会写入你选择的会话；角色读取仍由本次授权决定。</p>
        </header>
        <div v-if="chatTargets.length" class="chat-target-list">
          <label v-for="target in chatTargets" :key="target.id">
            <input v-model="chatTargetId" type="radio" :value="target.id">
            <span class="target-avatar" :style="target.avatarUrl?{backgroundImage:`url(${target.avatarUrl})`}:{}">{{ target.avatarUrl?'':target.avatarText }}</span>
            <b>{{ target.name }}</b>
            <i></i>
          </label>
        </div>
        <p v-else class="no-target">还没有可用的角色联系人，请先在聊天中建立联系。</p>
        <div v-if="chatTargets.length" class="chat-permissions">
          <label :class="{disabled:!settings.chatIntegration.allowCharacterRead}">
            <input v-model="chatReadThisTime" :disabled="!settings.chatIntegration.allowCharacterRead" type="checkbox">
            <span><b>允许 TA 读取这份投递</b><small>仅作用于当前此份投递</small></span>
            <i></i>
          </label>
          <label :class="{disabled:!chatReadThisTime||!settings.chatIntegration.allowMemory}">
            <input v-model="chatRememberThisTime" :disabled="!chatReadThisTime||!settings.chatIntegration.allowMemory" type="checkbox">
            <span><b>允许写入长期记忆</b><small>未勾选时仅用于临时对话流</small></span>
            <i></i>
          </label>
        </div>
        <footer>
          <button type="button" @click="showChatTargets=false">取消</button>
          <button class="confirm" type="button" :disabled="chatTargetId===null" @click="confirmChatShare">发送</button>
        </footer>
      </section>
    </div>

    <Transition name="toast">
      <div v-if="toast" class="delivery-toast" role="status">{{ toast }}</div>
    </Transition>
  </div>
</template>

<style scoped src="./app_Delivery.css"></style>
