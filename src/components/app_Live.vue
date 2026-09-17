<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { mockChats, myProfile } from '../composables/chatState/state'
import { useLiveStudio } from '../composables/useLiveStudio'
import { useVoicePlayer } from '../composables/useVoicePlayer'
import { requestCamera, requestMicrophone, stopMediaStream } from '../services/browserMedia'
import { liveModeLabel, makeLiveEvent } from '../services/liveRuntime'
import { sendCapabilityMessage } from '../services/api'
import type { LiveRoomMode, LiveRoomVisibility, LiveScene, LiveSession } from '../types/live'
import './app_Live.css'

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'open-app', appId: 'voice_access' | 'image_access' | 'video_hall' | 'music' | 'chat' | 'forum' | 'couple_space' | 'wallet'): void
}>()

type LiveView = 'home' | 'studio' | 'room' | 'records' | 'settings'
const live = useLiveStudio()
const voice = useVoicePlayer()
const view = ref<LiveView>('home')
const title = ref('今晚随便聊聊')
const description = ref('')
const mode = ref<LiveRoomMode>('character')
const visibility = ref<LiveRoomVisibility>('private')
const characterId = ref('')
const messageText = ref('')
const hostInstruction = ref('')
const notice = ref('')
const noticeKind = ref<'ok' | 'error'>('ok')
const endConfirm = ref(false)
const joinedJitsi = ref(false)
const cameraStream = ref<MediaStream | null>(null)
const microphoneStream = ref<MediaStream | null>(null)
const previewVideo = ref<HTMLVideoElement | null>(null)
const recording = ref<MediaRecorder | null>(null)
const recordingStartedAt = ref(0)
const recordingChunks: BlobPart[] = []
let recordingSavePromise: Promise<void> | null = null
const elapsedSeconds = ref(0)
const sceneUrls = ref<Record<string, string>>({})
const playbackUrls = ref<Record<string, string>>({})
const newLinkName = ref('')
const newLinkUrl = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
let elapsedTimer: ReturnType<typeof setInterval> | null = null
let noticeTimer: ReturnType<typeof setTimeout> | null = null
let wakeLock: any = null

const characters = computed(() => mockChats.value.filter(item => !item.isGroup && item.contactState !== 'deleted'))
const activeSession = computed(() => live.activeSession.value)
const activeChannel = computed(() => live.activeChannel.value)
const selectedCharacter = computed(() => characters.value.find(item => String(item.id) === String(activeSession.value?.characterId || characterId.value)) || null)
const activeScene = computed(() => activeChannel.value?.scenes.find(item => item.id === activeChannel.value?.activeSceneId) || activeChannel.value?.scenes[0] || null)
const visibleEvents = computed(() => activeSession.value?.events.slice(-80) || [])
const endedSessions = computed(() => live.snapshot.sessions.filter(item => item.status === 'ended'))
const durationLabel = computed(() => `${String(Math.floor(elapsedSeconds.value / 60)).padStart(2, '0')}:${String(elapsedSeconds.value % 60).padStart(2, '0')}`)
const canUseLocalMedia = computed(() => window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia))
const stageStyle = computed(() => ({
  backgroundColor: activeScene.value?.color || '#302a34',
  backgroundImage: activeScene.value?.mediaMimeType?.startsWith('video/') ? 'none' : activeScene.value?.imageAssetId && sceneUrls.value[activeScene.value.imageAssetId] ? `linear-gradient(rgba(25,20,28,.15),rgba(25,20,28,.4)),url(${sceneUrls.value[activeScene.value.imageAssetId]})` : 'none'
}))
const activeSceneMediaUrl = computed(() => activeScene.value?.mediaAssetId ? sceneUrls.value[activeScene.value.mediaAssetId] || '' : '')
const jitsiUrl = computed(() => {
  if (!activeSession.value?.jitsiRoomName) return ''
  const domain = live.snapshot.settings.jitsiDomain.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9.-]/g, '') || 'meet.jit.si'
  return `https://${domain}/${encodeURIComponent(activeSession.value.jitsiRoomName)}#config.prejoinPageEnabled=true&config.disableDeepLinking=true&userInfo.displayName=${encodeURIComponent(myProfile.value.name || '访客')}`
})

const showNotice = (text: string, kind: 'ok' | 'error' = 'ok') => {
  notice.value = text
  noticeKind.value = kind
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2600)
}

const enableLive = () => {
  live.snapshot.settings.enabled = true
  showNotice('直播 APP 已开启，所有具体能力仍保持关闭')
}

const disableLive = () => {
  if (activeSession.value) return showNotice('请先结束正在进行的直播', 'error')
  live.snapshot.settings.enabled = false
}

const chooseTemplate = (nextMode: LiveRoomMode) => {
  mode.value = nextMode
  if (nextMode === 'voice') title.value = '深夜语音电台'
  else if (nextMode === 'story') title.value = '一起走进今天的故事'
  else if (nextMode === 'premiere') title.value = '视频首映陪看'
  else if (nextMode === 'camera') title.value = '我的实时直播'
  else if (nextMode === 'jitsi') title.value = '一起连麦聊天'
  else title.value = '今晚随便聊聊'
  view.value = 'studio'
}

const createAndStart = () => {
  if (!title.value.trim()) return showNotice('请填写直播标题', 'error')
  if (mode.value !== 'camera' && mode.value !== 'jitsi' && !characterId.value) return showNotice('请选择主播角色', 'error')
  if (mode.value === 'jitsi' && !live.snapshot.settings.switches.jitsi) return showNotice('请先在设置中开启公共连麦', 'error')
  const channel = live.createChannel({ title: title.value.trim(), mode: mode.value, visibility: visibility.value, characterId: characterId.value, description: description.value.trim() })
  live.startSession(channel)
  joinedJitsi.value = false
  view.value = 'room'
  void prepareRoom()
}

const enterActiveRoom = () => {
  if (!activeSession.value) return
  view.value = 'room'
  void prepareRoom()
}

const prepareRoom = async () => {
  await nextTick()
  startElapsedTimer()
  await loadSceneImages()
  if ('wakeLock' in navigator) {
    try { wakeLock = await (navigator as any).wakeLock.request('screen') } catch { /* 页面不可见或浏览器不支持时保持正常使用 */ }
  }
}

const startElapsedTimer = () => {
  if (elapsedTimer) clearInterval(elapsedTimer)
  const update = () => { elapsedSeconds.value = activeSession.value ? Math.max(0, Math.floor((Date.now() - activeSession.value.startedAt) / 1000)) : 0 }
  update()
  elapsedTimer = setInterval(update, 1000)
}

const loadSceneImages = async () => {
  Object.values(sceneUrls.value).forEach(url => URL.revokeObjectURL(url))
  sceneUrls.value = {}
  for (const scene of activeChannel.value?.scenes || []) {
    const assetId = scene.mediaAssetId || scene.imageAssetId
    if (!assetId) continue
    const blob = await live.getLiveAsset(assetId)
    if (blob) sceneUrls.value[assetId] = URL.createObjectURL(blob)
  }
}

const selectScene = (scene: LiveScene) => {
  if (!activeChannel.value || !activeSession.value) return
  activeChannel.value.activeSceneId = scene.id
  live.appendEvent(makeLiveEvent(activeSession.value.id, 'scene', '直播系统', `场景切换为「${scene.name}」`, { aiReadable: false }))
}

const uploadSceneImage = () => fileInput.value?.click()
const handleSceneFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file || !activeChannel.value || !activeScene.value) return
  try {
    await live.addSceneMedia(activeChannel.value.id, activeScene.value.id, file)
    await loadSceneImages()
    showNotice(file.type.startsWith('video/') ? '舞台视频已保存到本机' : '场景图片已保存到本机')
  } catch (reason) { showNotice(reason instanceof Error ? reason.message : '舞台素材保存失败', 'error') }
  ;(event.target as HTMLInputElement).value = ''
}

const postMessage = async () => {
  const text = messageText.value.trim()
  if (!text || !activeSession.value) return
  live.addMessage(myProfile.value.name || '我', text)
  messageText.value = ''
  if (live.snapshot.settings.switches.aiHost && live.snapshot.settings.switches.aiAutoReply) await askHost('回应刚刚的观众发言。')
}

const askHost = async (instruction = '') => {
  try {
    const event = await live.generateHostReply(selectedCharacter.value, instruction || hostInstruction.value.trim())
    hostInstruction.value = ''
    if (live.snapshot.settings.switches.tts) {
      try { await voice.playVoice(Date.now(), event.content, selectedCharacter.value || {}) }
      catch (reason) { showNotice(reason instanceof Error ? reason.message : '语音播放失败，已保留文字', 'error') }
    }
  } catch (reason) { showNotice(reason instanceof Error ? reason.message : 'AI 主播生成失败', 'error') }
}

const virtualSamples = [
  ['小满', '这个话题很适合今晚的气氛'], ['路过的云', '主播可以再讲讲刚才提到的那件事吗？'], ['晚风', '听着很放松，先安静待一会儿'], ['山茶', '刚进来，晚上好呀'], ['青柠', '这个选择我会投赞成'], ['一盏灯', '背景很舒服，像真的电台一样']
]
const addVirtualAudience = () => {
  if (!activeSession.value || !live.snapshot.settings.switches.virtualAudience) return showNotice('请先开启虚拟观众', 'error')
  const count = Math.min(live.snapshot.settings.maxVirtualMessages, virtualSamples.length)
  const offset = activeSession.value.events.filter(item => item.virtual).length % virtualSamples.length
  for (let index = 0; index < count; index++) {
    const [name, content] = virtualSamples[(offset + index) % virtualSamples.length]
    live.addMessage(name, content, true)
  }
}

const startCameraPreview = async () => {
  if (!canUseLocalMedia.value) return showNotice('当前环境不支持安全的摄像头访问，请使用 HTTPS', 'error')
  if (!live.snapshot.settings.switches.camera) return showNotice('请先在设置中开启摄像头', 'error')
  try {
    stopMediaStream(cameraStream.value)
    cameraStream.value = await requestCamera('user')
    await nextTick()
    if (previewVideo.value) { previewVideo.value.srcObject = cameraStream.value; await previewVideo.value.play() }
  } catch (reason) { showNotice(reason instanceof Error ? reason.message : '摄像头启动失败', 'error') }
}

const startMicrophone = async () => {
  if (!canUseLocalMedia.value) return showNotice('当前环境不支持安全的麦克风访问，请使用 HTTPS', 'error')
  if (!live.snapshot.settings.switches.microphone) return showNotice('请先在设置中开启麦克风', 'error')
  try { microphoneStream.value = await requestMicrophone(); showNotice('麦克风已开启') }
  catch (reason) { showNotice(reason instanceof Error ? reason.message : '麦克风启动失败', 'error') }
}

const stopLocalMedia = () => {
  if (recording.value?.state === 'recording') recording.value.stop()
  stopMediaStream(cameraStream.value)
  stopMediaStream(microphoneStream.value)
  cameraStream.value = null
  microphoneStream.value = null
  if (previewVideo.value) previewVideo.value.srcObject = null
}

const chooseRecordingMime = () => {
  const candidates = cameraStream.value ? ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'] : ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm']
  return candidates.find(item => typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(item)) || ''
}

const startRecording = () => {
  if (!live.snapshot.settings.switches.recording) return showNotice('请先在设置中开启本地录制', 'error')
  if (!cameraStream.value && !microphoneStream.value) return showNotice('请先开启摄像头或麦克风', 'error')
  if (typeof MediaRecorder === 'undefined') return showNotice('当前浏览器不支持本地录制', 'error')
  const tracks = [...(cameraStream.value?.getVideoTracks() || []), ...(microphoneStream.value?.getAudioTracks() || [])]
  const stream = new MediaStream(tracks)
  const mimeType = chooseRecordingMime()
  recordingChunks.length = 0
  recording.value = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
  recording.value.ondataavailable = event => { if (event.data.size) recordingChunks.push(event.data) }
  recording.value.onerror = () => showNotice('本地录制失败', 'error')
  recording.value.onstop = () => { recordingSavePromise = saveRecording() }
  recordingStartedAt.value = Date.now()
  recording.value.start(1000)
  if (activeSession.value) live.appendEvent(makeLiveEvent(activeSession.value.id, 'recording', '直播系统', '本地录制已开始', { aiReadable: false }))
}

const saveRecording = async () => {
  if (!activeSession.value || !recordingChunks.length) {
    recording.value = null
    recordingChunks.length = 0
    return
  }
  const mimeType = recording.value?.mimeType || (cameraStream.value ? 'video/webm' : 'audio/webm')
  const blob = new Blob(recordingChunks, { type: mimeType })
  const assetId = await live.saveLiveAsset(blob)
  live.addRecording({ id: `recording_${Date.now()}`, sessionId: activeSession.value.id, assetId, mimeType, size: blob.size, createdAt: Date.now(), durationSeconds: Math.max(1, Math.round((Date.now() - recordingStartedAt.value) / 1000)) })
  live.appendEvent(makeLiveEvent(activeSession.value.id, 'recording', '直播系统', '本地录制已保存', { aiReadable: false }))
  recording.value = null
  recordingChunks.length = 0
  showNotice('录制已保存到本机')
}

const stopRecording = () => {
  if (recording.value?.state === 'recording') recording.value.stop()
}

const stopRecordingAndWait = async () => {
  const current = recording.value
  if (!current || current.state !== 'recording') return
  const stopped = new Promise<void>(resolve => current.addEventListener('stop', () => resolve(), { once: true }))
  current.stop()
  await stopped
  if (recordingSavePromise) await recordingSavePromise
}

const buildSummary = async (session: LiveSession) => {
  if (!live.snapshot.settings.switches.summary || !session.events.some(item => item.type === 'host' || item.type === 'message')) return ''
  try {
    const text = session.events.filter(item => item.aiReadable).slice(-80).map(item => `${item.actorName}：${item.content}`).join('\n')
    const result = await sendCapabilityMessage('summary', [{ role: 'user', content: `请把下面这场直播整理成100到250字的客观摘要，只保留实际发生的话题、决定和重要互动，不要虚构观众或结果。\n\n${text}` }])
    return String(typeof result === 'string' ? result : result.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 3000)
  } catch { return '' }
}

const finishLive = async () => {
  const session = activeSession.value
  if (!session) return
  busyEnd.value = true
  try {
    try { await stopRecordingAndWait() }
    catch (reason) { showNotice(reason instanceof Error ? reason.message : '录制保存失败，直播记录仍会保留', 'error') }
    const summary = await buildSummary(session)
    if (summary && live.snapshot.settings.switches.chatBridge && live.snapshot.settings.switches.writeSummaryToChat && selectedCharacter.value) {
      selectedCharacter.value.messages ||= []
      selectedCharacter.value.messages.push({ id: Date.now(), type: 'system', content: `【直播回顾】${summary}`, timestamp: Date.now(), isLiveSummary: true })
    }
    stopLocalMedia()
    await wakeLock?.release?.().catch(() => undefined)
    wakeLock = null
    live.endSession(summary)
    endConfirm.value = false
    view.value = 'records'
  } finally {
    busyEnd.value = false
  }
}
const busyEnd = ref(false)

type LiveBridgeApp = 'voice_access' | 'image_access' | 'video_hall' | 'music' | 'chat' | 'forum' | 'couple_space' | 'wallet'
const openBridge = (appId: LiveBridgeApp) => emit('open-app', appId)

const addExternalLink = () => {
  const name = newLinkName.value.trim()
  const url = newLinkUrl.value.trim()
  if (!name || !/^https:\/\//i.test(url)) return showNotice('请填写名称和 HTTPS 链接', 'error')
  live.snapshot.settings.externalLinks.push({ id: `external_${Date.now()}`, name: name.slice(0, 30), url: url.slice(0, 1000) })
  newLinkName.value = ''
  newLinkUrl.value = ''
}

const openExternalLink = (url: string) => {
  if (!/^https:\/\//i.test(url)) return showNotice('只允许打开 HTTPS 链接', 'error')
  window.open(url, '_blank', 'noopener,noreferrer')
}

const playRecording = async (sessionId: string, recordingId: string) => {
  const item = live.snapshot.sessions.find(session => session.id === sessionId)?.recordings.find(entry => entry.id === recordingId)
  if (!item) return
  if (!playbackUrls.value[item.id]) {
    const blob = await live.getLiveAsset(item.assetId)
    if (!blob) return showNotice('本地录制文件已不存在', 'error')
    playbackUrls.value[item.id] = URL.createObjectURL(blob)
  }
}

const deleteSession = async (id: string) => {
  if (await live.deleteSession(id)) showNotice('直播记录已删除')
}

const closeApp = () => {
  if (activeSession.value && view.value === 'room') { view.value = 'home'; return }
  emit('close')
}

watch(() => live.ready.value, ready => {
  if (ready && !characterId.value && characters.value.length) characterId.value = String(characters.value[0].id)
}, { immediate: true })

watch(activeSession, session => {
  if (!session && view.value === 'room') view.value = 'home'
})

onMounted(() => {
  if (!characterId.value && characters.value.length) characterId.value = String(characters.value[0].id)
  if (activeSession.value) startElapsedTimer()
})

onBeforeUnmount(() => {
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (noticeTimer) clearTimeout(noticeTimer)
  stopLocalMedia()
  voice.stopVoice()
  void wakeLock?.release?.().catch(() => undefined)
  Object.values(sceneUrls.value).forEach(url => URL.revokeObjectURL(url))
  Object.values(playbackUrls.value).forEach(url => URL.revokeObjectURL(url))
})
</script>

<template>
  <div class="live-app">
    <header class="live-topbar">
      <button class="live-icon-button" type="button" aria-label="返回" @click="closeApp">‹</button>
      <div class="live-title-wrap">
        <b>{{ view === 'room' ? activeSession?.title : '直播' }}</b>
        <small>{{ view === 'room' ? `${durationLabel} · ${activeSession ? liveModeLabel(activeSession.mode) : ''}` : 'LIVE STUDIO' }}</small>
      </div>
      <button v-if="view === 'room' && activeSession" class="live-end-button" type="button" @click="endConfirm=true">结束</button>
      <span v-else class="live-top-spacer"></span>
    </header>

    <div v-if="!live.ready.value" class="live-loading">正在读取本地直播数据…</div>

    <template v-else-if="!live.snapshot.settings.enabled">
      <main class="live-disabled">
        <div class="live-orbit"><span>LIVE</span></div>
        <p class="live-eyebrow">LOCAL · PRIVATE · OPTIONAL</p>
        <h1>让角色拥有自己的实时舞台</h1>
        <p>开启后仍不会自动使用摄像头、麦克风、AI、语音、虚拟观众或其他 APP。每项能力需要你单独打开。</p>
        <button class="live-primary-button" type="button" @click="enableLive">开启直播 APP</button>
        <button class="live-text-button" type="button" @click="emit('close')">暂不开启</button>
      </main>
    </template>

    <template v-else>
      <main v-if="view === 'home'" class="live-scroll live-home">
        <button v-if="activeSession" class="live-now-card" type="button" @click="enterActiveRoom">
          <span class="live-dot"></span>
          <span class="live-now-copy"><b>{{ activeSession.title }}</b><small>直播仍在进行 · 点击返回</small></span>
          <span>›</span>
        </button>

        <section class="live-hero">
          <p>NRJ LIVE / 直播工作室</p>
          <h1>此刻，<br>正在发生。</h1>
          <span>本地 AI 舞台与可选公共连麦</span>
        </section>

        <section class="live-section">
          <div class="live-section-head"><b>创建直播</b><small>所有能力默认关闭</small></div>
          <div class="live-mode-grid">
            <button v-for="item in [
              ['character','角色直播','AI 主播与本地互动'],['voice','语音电台','声音、字幕与夜聊'],['story','图片故事','场景图与互动叙事'],
              ['premiere','视频首映','本地视频陪看'],['camera','真人直播','摄像头与 AI 副播'],['jitsi','公共连麦','使用 Jitsi 公共服务']
            ]" :key="item[0]" type="button" @click="chooseTemplate(item[0] as LiveRoomMode)">
              <span>{{ liveModeLabel(item[0] as LiveRoomMode).slice(0,1) }}</span><b>{{ item[1] }}</b><small>{{ item[2] }}</small>
            </button>
          </div>
        </section>

        <section v-if="live.snapshot.settings.externalLinks.length" class="live-section">
          <div class="live-section-head"><b>外部直播平台</b><small>在新窗口打开</small></div>
          <div class="live-link-list">
            <button v-for="link in live.snapshot.settings.externalLinks" :key="link.id" type="button" @click="openExternalLink(link.url)"><span>{{ link.name.slice(0,1) }}</span><b>{{ link.name }}</b><small>↗</small></button>
          </div>
        </section>
      </main>

      <main v-else-if="view === 'studio'" class="live-scroll live-studio">
        <section class="live-form-card">
          <p class="live-eyebrow">开播设置</p>
          <label><span>直播标题</span><input v-model="title" maxlength="60" placeholder="这一场直播叫什么？"></label>
          <label><span>简介</span><textarea v-model="description" maxlength="240" rows="3" placeholder="可选，简单写下准备聊什么"></textarea></label>
          <label><span>直播形式</span><select v-model="mode"><option value="character">角色直播</option><option value="voice">语音电台</option><option value="story">图片故事</option><option value="premiere">视频首映</option><option value="camera">真人直播</option><option value="jitsi">公共连麦</option></select></label>
          <label v-if="mode !== 'camera' && mode !== 'jitsi'"><span>主播角色</span><select v-model="characterId"><option value="" disabled>请选择角色</option><option v-for="character in characters" :key="character.id" :value="String(character.id)">{{ character.realName || character.name }}</option></select></label>
          <div class="live-choice-row"><span>可见范围</span><div><button v-for="item in [['private','仅自己'],['invite','邀请可见'],['public','公开标记']]" :key="item[0]" type="button" :class="{active:visibility===item[0]}" @click="visibility=item[0] as LiveRoomVisibility">{{ item[1] }}</button></div></div>
        </section>
        <section class="live-note-card">
          <b>{{ mode === 'jitsi' ? '公共连麦说明' : '本地直播说明' }}</b>
          <p v-if="mode === 'jitsi'">音视频将通过你设置的 Jitsi 公共服务传输。房间使用随机名称，但公共服务不等同于私有后端或永久存储。</p>
          <p v-else>直播事件、场景和记录只保存在本机。不会自动进入聊天，也不会自动上传摄像头或麦克风。</p>
        </section>
        <button class="live-primary-button" type="button" @click="createAndStart">进入直播间</button>
      </main>

      <main v-else-if="view === 'room' && activeSession" class="live-room">
        <section class="live-stage" :style="stageStyle">
          <iframe v-if="activeSession.mode === 'jitsi' && joinedJitsi" class="live-jitsi" :src="jitsiUrl" allow="camera; microphone; display-capture; fullscreen; autoplay" title="Jitsi 公共连麦房"></iframe>
          <template v-else>
            <video v-if="activeScene?.mediaMimeType?.startsWith('video/') && activeSceneMediaUrl && !cameraStream" class="live-stage-video" :src="activeSceneMediaUrl" controls playsinline></video>
            <video v-show="cameraStream" ref="previewVideo" class="live-camera-preview" playsinline muted></video>
            <div v-if="!cameraStream && !(activeScene?.mediaMimeType?.startsWith('video/') && activeSceneMediaUrl)" class="live-host-portrait">
              <img v-if="selectedCharacter?.avatarUrl" :src="selectedCharacter.avatarUrl" alt="">
              <span v-else>{{ (selectedCharacter?.realName || selectedCharacter?.name || '播').slice(0,1) }}</span>
              <b>{{ selectedCharacter?.realName || selectedCharacter?.name || myProfile.name || '主播' }}</b>
              <small>{{ activeSession.visibility === 'private' ? '仅本机可见' : activeSession.visibility === 'invite' ? '邀请可见' : '公开标记' }}</small>
            </div>
            <div class="live-stage-badges"><span><i></i> LIVE</span><span>AI 内容</span><span v-if="recording?.state==='recording'" class="recording">录制中</span></div>
            <button v-if="activeSession.mode === 'jitsi' && !joinedJitsi" class="live-join-jitsi" type="button" @click="joinedJitsi=true">进入公共连麦房</button>
          </template>
        </section>

        <div class="live-scene-strip">
          <button v-for="scene in activeChannel?.scenes" :key="scene.id" type="button" :class="{active:scene.id===activeChannel?.activeSceneId}" @click="selectScene(scene)"><i :style="{background:scene.color}"></i>{{ scene.name }}</button>
          <button type="button" @click="uploadSceneImage">＋图片/视频</button>
          <input ref="fileInput" type="file" accept="image/*,video/*" hidden @change="handleSceneFile">
        </div>

        <section class="live-events" aria-live="polite">
          <div v-if="!visibleEvents.length" class="live-empty-events">直播已经开始，等待第一条互动</div>
          <div v-for="event in visibleEvents" :key="event.id" class="live-event" :class="[`type-${event.type}`,{virtual:event.virtual}]">
            <span>{{ event.actorName }}<em v-if="event.virtual">虚拟</em></span><p>{{ event.content }}</p>
          </div>
        </section>

        <section class="live-control-panel">
          <div class="live-quick-actions">
            <button v-if="live.snapshot.settings.switches.aiHost" type="button" :disabled="live.busy.value" @click="askHost()">{{ live.busy.value ? '组织发言…' : '主播发言' }}</button>
            <button v-if="live.snapshot.settings.switches.virtualAudience" type="button" @click="addVirtualAudience">虚拟互动</button>
            <button v-if="live.snapshot.settings.switches.camera" type="button" @click="cameraStream ? stopLocalMedia() : startCameraPreview()">{{ cameraStream ? '关闭镜头' : '开启镜头' }}</button>
            <button v-if="live.snapshot.settings.switches.microphone && !microphoneStream" type="button" @click="startMicrophone">开启麦克风</button>
            <button v-if="live.snapshot.settings.switches.recording && (cameraStream || microphoneStream)" type="button" @click="recording?.state==='recording' ? stopRecording() : startRecording()">{{ recording?.state==='recording' ? '停止录制' : '本地录制' }}</button>
          </div>
          <div v-if="live.snapshot.settings.switches.aiHost" class="live-host-instruction"><input v-model="hostInstruction" maxlength="180" placeholder="给主播一个本轮主持方向（可选）"><button type="button" :disabled="live.busy.value" @click="askHost()">发送</button></div>
          <div class="live-message-box"><input v-model="messageText" maxlength="500" placeholder="在直播间说点什么…" @keyup.enter="postMessage"><button type="button" :disabled="!messageText.trim()" @click="postMessage">发送</button></div>
        </section>

        <div v-if="['imageBridge','videoBridge','voiceBridge','musicBridge','chatBridge','forumBridge','coupleBridge','walletBridge'].some(key=>live.snapshot.settings.switches[key as keyof typeof live.snapshot.settings.switches])" class="live-bridge-bar">
          <button v-if="live.snapshot.settings.switches.imageBridge" type="button" @click="openBridge('image_access')">图像</button>
          <button v-if="live.snapshot.settings.switches.videoBridge" type="button" @click="openBridge('video_hall')">视频</button>
          <button v-if="live.snapshot.settings.switches.voiceBridge" type="button" @click="openBridge('voice_access')">语音</button>
          <button v-if="live.snapshot.settings.switches.musicBridge" type="button" @click="openBridge('music')">音乐</button>
          <button v-if="live.snapshot.settings.switches.chatBridge" type="button" @click="openBridge('chat')">聊天</button>
          <button v-if="live.snapshot.settings.switches.forumBridge" type="button" @click="openBridge('forum')">论坛</button>
          <button v-if="live.snapshot.settings.switches.coupleBridge" type="button" @click="openBridge('couple_space')">情侣</button>
          <button v-if="live.snapshot.settings.switches.walletBridge" type="button" @click="openBridge('wallet')">钱包</button>
        </div>
      </main>

      <main v-else-if="view === 'records'" class="live-scroll live-records">
        <section class="live-record-intro"><p class="live-eyebrow">本地记录</p><h1>回看发生过的片刻</h1><span>记录只保存在当前浏览器，可随时删除。</span></section>
        <div v-if="!endedSessions.length" class="live-empty-card">还没有结束的直播记录</div>
        <article v-for="session in endedSessions" :key="session.id" class="live-record-card">
          <div><span>{{ liveModeLabel(session.mode) }}</span><time>{{ new Date(session.startedAt).toLocaleString() }}</time></div>
          <h2>{{ session.title }}</h2>
          <p v-if="session.summary">{{ session.summary }}</p>
          <small>{{ session.events.length }} 条事件 · {{ session.recordings.length }} 份本地录制</small>
          <div v-for="item in session.recordings" :key="item.id" class="live-recording-row">
            <button type="button" @click="playRecording(session.id,item.id)">读取录制</button><span>{{ Math.ceil(item.size/1024/1024) }} MB · {{ item.durationSeconds }} 秒</span>
            <video v-if="playbackUrls[item.id] && item.mimeType.startsWith('video')" :src="playbackUrls[item.id]" controls playsinline></video>
            <audio v-else-if="playbackUrls[item.id]" :src="playbackUrls[item.id]" controls></audio>
          </div>
          <button class="live-danger-text" type="button" @click="deleteSession(session.id)">删除记录</button>
        </article>
      </main>

      <main v-else-if="view === 'settings'" class="live-scroll live-settings">
        <section class="live-settings-head"><p class="live-eyebrow">能力与隐私</p><h1>每一项都由你决定</h1><span>关闭的能力不会加载、请求权限或进入 AI 上下文。</span></section>
        <section class="live-setting-group">
          <h2>主播与生成</h2>
          <label><span><b>AI 主播</b><small>允许直播间单独调用模型主持</small></span><input v-model="live.snapshot.settings.switches.aiHost" type="checkbox"><i></i></label>
          <label :class="{disabled:!live.snapshot.settings.switches.aiHost}"><span><b>自动回应</b><small>用户发言后自动触发主播回复</small></span><input v-model="live.snapshot.settings.switches.aiAutoReply" type="checkbox" :disabled="!live.snapshot.settings.switches.aiHost"><i></i></label>
          <label><span><b>语音播报</b><small>使用角色已配置的 TTS 声线</small></span><input v-model="live.snapshot.settings.switches.tts" type="checkbox"><i></i></label>
          <label><span><b>虚拟观众</b><small>明确标识为虚拟，不冒充真人在线</small></span><input v-model="live.snapshot.settings.switches.virtualAudience" type="checkbox"><i></i></label>
          <label><span><b>结束后生成摘要</b><small>只在结束直播时调用总结节点</small></span><input v-model="live.snapshot.settings.switches.summary" type="checkbox"><i></i></label>
        </section>
        <section class="live-setting-group">
          <h2>本机媒体</h2>
          <label><span><b>摄像头</b><small>仍需在直播间点击后授权</small></span><input v-model="live.snapshot.settings.switches.camera" type="checkbox"><i></i></label>
          <label><span><b>麦克风</b><small>仍需在直播间点击后授权</small></span><input v-model="live.snapshot.settings.switches.microphone" type="checkbox"><i></i></label>
          <label><span><b>本地录制</b><small>录制文件保存在当前浏览器</small></span><input v-model="live.snapshot.settings.switches.recording" type="checkbox"><i></i></label>
          <label><span><b>公共连麦</b><small>通过 Jitsi 公共服务传输音视频</small></span><input v-model="live.snapshot.settings.switches.jitsi" type="checkbox"><i></i></label>
          <label class="live-inline-field"><span><b>Jitsi 域名</b><small>默认使用 meet.jit.si</small></span><input v-model.trim="live.snapshot.settings.jitsiDomain" inputmode="url" aria-label="Jitsi 域名"></label>
        </section>
        <section class="live-setting-group">
          <h2>跨应用桥接</h2>
          <label v-for="item in [
            ['imageBridge','图像接入','显示图像接入快捷入口'],['videoBridge','视频大厅','显示视频大厅快捷入口'],['voiceBridge','语音接入','显示语音配置快捷入口'],['musicBridge','音乐','显示音乐快捷入口'],
            ['chatBridge','聊天','允许直播与聊天显式交接'],['forumBridge','论坛','显示论坛快捷入口'],['coupleBridge','情侣空间','显示情侣空间快捷入口'],['walletBridge','钱包','只显示钱包入口，不启用真实礼物']
          ]" :key="item[0]"><span><b>{{ item[1] }}</b><small>{{ item[2] }}</small></span><input v-model="live.snapshot.settings.switches[item[0] as keyof typeof live.snapshot.settings.switches]" type="checkbox"><i></i></label>
          <label :class="{disabled:!live.snapshot.settings.switches.chatBridge||!live.snapshot.settings.switches.summary}"><span><b>摘要写入聊天</b><small>仅结束时向对应角色聊天写入一条回顾</small></span><input v-model="live.snapshot.settings.switches.writeSummaryToChat" type="checkbox" :disabled="!live.snapshot.settings.switches.chatBridge||!live.snapshot.settings.switches.summary"><i></i></label>
        </section>
        <section class="live-setting-group live-number-settings">
          <h2>上下文与保存</h2>
          <label><span><b>主播读取事件数</b><small>限制每次 AI 看到的直播事件</small></span><input v-model.number="live.snapshot.settings.maxContextEvents" type="number" min="4" max="40"></label>
          <label><span><b>虚拟互动条数</b><small>每次手动生成的最大条数</small></span><input v-model.number="live.snapshot.settings.maxVirtualMessages" type="number" min="1" max="8"></label>
          <label><span><b>自动清理记录</b><small>进行中的直播不会被删除</small></span><select v-model.number="live.snapshot.settings.autoDeleteDays"><option :value="0">不自动删除</option><option :value="1">1 天</option><option :value="7">7 天</option><option :value="30">30 天</option></select></label>
        </section>
        <section class="live-setting-group live-external-settings">
          <h2>外部直播链接</h2>
          <div v-for="link in live.snapshot.settings.externalLinks" :key="link.id" class="live-saved-link"><span><b>{{ link.name }}</b><small>{{ link.url }}</small></span><button type="button" @click="live.snapshot.settings.externalLinks=live.snapshot.settings.externalLinks.filter(item=>item.id!==link.id)">删除</button></div>
          <div class="live-add-link"><input v-model="newLinkName" maxlength="30" placeholder="平台名称"><input v-model="newLinkUrl" inputmode="url" placeholder="https://…"><button type="button" @click="addExternalLink">添加</button></div>
        </section>
        <button class="live-disable-button" type="button" :disabled="Boolean(activeSession)" @click="disableLive">{{ activeSession ? '直播中不可关闭 APP' : '关闭直播 APP' }}</button>
      </main>

      <nav v-if="view !== 'room' && view !== 'studio'" class="live-tabbar">
        <button type="button" :class="{active:view==='home'}" @click="view='home'"><span>⌂</span>直播</button>
        <button type="button" :class="{active:view==='records'}" @click="view='records'"><span>◫</span>记录</button>
        <button type="button" :class="{active:view==='settings'}" @click="view='settings'"><span>⚙</span>设置</button>
      </nav>
    </template>

    <Transition name="live-toast"><div v-if="notice" class="live-toast" :class="noticeKind" role="status">{{ notice }}</div></Transition>
    <div v-if="endConfirm" class="live-modal-backdrop" @click.self="endConfirm=false"><section class="live-modal"><h2>结束这场直播？</h2><p>摄像头、麦克风和录制将停止；已保存的事件会留在本机记录中。</p><div><button type="button" @click="endConfirm=false">继续直播</button><button type="button" class="danger" :disabled="busyEnd" @click="finishLive">{{ busyEnd ? '正在整理…' : '结束直播' }}</button></div></section></div>
  </div>
</template>
