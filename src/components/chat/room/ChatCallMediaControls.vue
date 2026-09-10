/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { chatSettings } from '../../../store'
import { mediaErrorMessage, recordStream, requestCamera, requestMicrophone, stopMediaStream } from '../../../services/browserMedia'
import { transcribeAudio } from '../../../services/speechRecognition'

const props = defineProps<{ mode: 'voice' | 'video'; active: boolean; visionBusy?: boolean; disabled?: boolean }>()
const emit = defineEmits<{
  (e: 'transcript', text: string): void
  (e: 'vision-frame', payload: { dataUrl: string; manual: boolean }): void
  (e: 'notice', text: string): void
}>()

const micState = ref<'idle' | 'recording' | 'ready' | 'transcribing'>('idle')
const micError = ref('')
const cameraError = ref('')
const cameraOn = ref(false)
const visionOn = ref(false)
const facingMode = ref<'user' | 'environment'>('user')
const videoRef = ref<HTMLVideoElement | null>(null)
const pendingAudio = ref<Blob | null>(null)
const recordSeconds = ref(0)
let microphoneStream: MediaStream | null = null
let cameraStream: MediaStream | null = null
let recorder: MediaRecorder | null = null
let recordingResult: Promise<Blob> | null = null
let recordStartedAt = 0
let recordTimer: ReturnType<typeof setInterval> | null = null
let visionTimer: ReturnType<typeof setInterval> | null = null
let lastSignature: Uint8Array | null = null

const micAvailable = computed(() => chatSettings.enableRealMedia && (
  props.mode === 'voice' ? chatSettings.enableRealVoiceCall : chatSettings.enableRealVideoCall
))
const cameraAvailable = computed(() => props.mode === 'video' && chatSettings.enableRealMedia && chatSettings.enableRealVideoCall)
const visionAvailable = computed(() => cameraAvailable.value && chatSettings.enableRealVideoVision)

const clearRecordTimer = () => { if (recordTimer) clearInterval(recordTimer); recordTimer = null }
const stopMicrophone = () => {
  clearRecordTimer()
  if (recorder?.state === 'recording') recorder.stop()
  recorder = null
  recordingResult = null
  stopMediaStream(microphoneStream)
  microphoneStream = null
  if (micState.value === 'recording') micState.value = 'idle'
}

const startMicrophone = async () => {
  if (!micAvailable.value || !props.active || props.disabled) return
  micError.value = ''
  pendingAudio.value = null
  try {
    microphoneStream = await requestMicrophone()
    microphoneStream.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (micState.value === 'recording') void finishMicrophone()
    }, { once: true })
    const session = recordStream(microphoneStream)
    recorder = session.recorder
    recordingResult = session.result
    recordStartedAt = Date.now()
    recordSeconds.value = 0
    micState.value = 'recording'
    recordTimer = setInterval(() => {
      recordSeconds.value = Math.max(1, Math.round((Date.now() - recordStartedAt) / 1000))
      if (recordSeconds.value >= 120) void finishMicrophone()
    }, 250)
  } catch (error) {
    micError.value = mediaErrorMessage(error, 'microphone')
    stopMicrophone()
  }
}

const finishMicrophone = async () => {
  if (!recorder || recorder.state !== 'recording' || !recordingResult) return
  clearRecordTimer()
  recordSeconds.value = Math.max(1, Math.round((Date.now() - recordStartedAt) / 1000))
  const result = recordingResult
  recorder.stop()
  stopMediaStream(microphoneStream)
  microphoneStream = null
  recorder = null
  recordingResult = null
  try {
    pendingAudio.value = await result
    if (!pendingAudio.value.size) throw new Error('没有录到声音，请重试')
    micState.value = 'ready'
    if (chatSettings.realMediaAutoTranscribeCall) await recognizePendingAudio()
  } catch (error) {
    micState.value = 'idle'
    micError.value = error instanceof Error ? error.message : '录音失败'
  }
}

const recognizePendingAudio = async () => {
  if (!pendingAudio.value) return
  micState.value = 'transcribing'
  micError.value = ''
  try {
    const text = await transcribeAudio(pendingAudio.value, {
      url: chatSettings.speechRecognitionUrl,
      key: chatSettings.speechRecognitionKey,
      model: chatSettings.speechRecognitionModel,
      language: chatSettings.speechRecognitionLanguage
    })
    pendingAudio.value = null
    micState.value = 'idle'
    emit('transcript', text)
  } catch (error) {
    micState.value = 'ready'
    micError.value = error instanceof Error ? error.message : '语音转文字失败'
  }
}

const cancelPendingAudio = () => { pendingAudio.value = null; micState.value = 'idle'; micError.value = '' }

const openCamera = async () => {
  if (!cameraAvailable.value || !props.active || props.disabled) return
  closeCamera()
  cameraError.value = ''
  try {
    let timedOut = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const requested = requestCamera(facingMode.value).then(stream => {
      if (timedOut) {
        stopMediaStream(stream)
        throw new Error('摄像头启动超时，请重试或在 Safari 中打开')
      }
      return stream
    })
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        timedOut = true
        reject(new Error('摄像头启动超时，请重试或在 Safari 中打开'))
      }, 10000)
    })
    cameraStream = await Promise.race([requested, timeout])
    if (timeoutId) clearTimeout(timeoutId)
    cameraStream.getVideoTracks()[0]?.addEventListener('ended', () => {
      cameraOn.value = false
      visionOn.value = false
      stopVisionTimer()
      cameraError.value = '摄像头已被系统停止，请点击重新打开'
    }, { once: true })
    cameraOn.value = true
    await nextTick()
    if (videoRef.value) {
      videoRef.value.srcObject = cameraStream
      await videoRef.value.play()
    }
  } catch (error) {
    cameraError.value = mediaErrorMessage(error, 'camera')
    closeCamera()
  }
}

const closeCamera = () => {
  stopVisionTimer()
  visionOn.value = false
  cameraOn.value = false
  if (videoRef.value) videoRef.value.srcObject = null
  stopMediaStream(cameraStream)
  cameraStream = null
  lastSignature = null
}

const switchCamera = async () => {
  facingMode.value = facingMode.value === 'user' ? 'environment' : 'user'
  await openCamera()
}

const framePayload = () => {
  const video = videoRef.value
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return null
  const maxEdge = 960
  const scale = Math.min(1, maxEdge / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) return null
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const sample = document.createElement('canvas')
  sample.width = 16; sample.height = 16
  const sampleContext = sample.getContext('2d', { willReadFrequently: true })
  if (!sampleContext) return null
  sampleContext.drawImage(canvas, 0, 0, 16, 16)
  const pixels = sampleContext.getImageData(0, 0, 16, 16).data
  const signature = new Uint8Array(256)
  for (let i = 0; i < 256; i++) signature[i] = Math.round((pixels[i * 4] + pixels[i * 4 + 1] + pixels[i * 4 + 2]) / 3)
  return { dataUrl: canvas.toDataURL('image/jpeg', .72), signature }
}

const captureFrame = (manual = false) => {
  if (!cameraOn.value || !visionOn.value || props.visionBusy) return
  const frame = framePayload()
  if (!frame) return emit('notice', '摄像头画面还没有准备好')
  if (!manual && lastSignature) {
    let difference = 0
    for (let i = 0; i < frame.signature.length; i++) difference += Math.abs(frame.signature[i] - lastSignature[i])
    if (difference / frame.signature.length < 7) return
  }
  lastSignature = frame.signature
  emit('vision-frame', { dataUrl: frame.dataUrl, manual })
}

const stopVisionTimer = () => { if (visionTimer) clearInterval(visionTimer); visionTimer = null }
const syncVisionTimer = () => {
  stopVisionTimer()
  if (!visionOn.value) return
  const seconds = Math.min(60, Math.max(8, Number(chatSettings.realVideoVisionInterval) || 12))
  visionTimer = setInterval(() => captureFrame(false), seconds * 1000)
}
const toggleVision = () => {
  if (!visionAvailable.value || !cameraOn.value) return
  visionOn.value = !visionOn.value
  lastSignature = null
  syncVisionTimer()
  if (visionOn.value) window.setTimeout(() => captureFrame(false), 600)
}

const handleVisibility = () => {
  if (!document.hidden || !chatSettings.realMediaStopWhenHidden) return
  const hadMedia = cameraOn.value || micState.value === 'recording'
  stopMicrophone()
  closeCamera()
  if (hadMedia) emit('notice', '页面进入后台，已暂停麦克风和摄像头；返回后请手动恢复')
}

watch(() => props.active, active => { if (!active) { stopMicrophone(); closeCamera(); cancelPendingAudio() } })
watch(micAvailable, available => { if (!available) { stopMicrophone(); cancelPendingAudio() } })
watch(cameraAvailable, available => { if (!available) closeCamera() })
watch(visionAvailable, available => { if (!available) { visionOn.value = false; stopVisionTimer() } })
watch(() => chatSettings.realVideoVisionInterval, syncVisionTimer)
document.addEventListener('visibilitychange', handleVisibility)
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', handleVisibility); stopMicrophone(); closeCamera() })
</script>

<template>
  <div v-if="active && chatSettings.enableRealMedia && (micAvailable || cameraAvailable)" class="call-media-panel">
    <div v-if="mode === 'video' && cameraOn" class="self-camera" :class="{ mirrored: facingMode === 'user' }">
      <video ref="videoRef" autoplay muted playsinline></video>
      <span>{{ visionOn ? (visionBusy ? 'AI 正在看' : 'AI 可看画面') : '仅本地预览' }}</span>
    </div>
    <div class="media-actions">
      <button v-if="micAvailable" type="button" :disabled="disabled && micState !== 'recording'" :class="{ active: micState === 'recording' }" @click="micState === 'recording' ? finishMicrophone() : startMicrophone()">
        <span class="media-icon">{{ micState === 'recording' ? '■' : '●' }}</span>{{ micState === 'recording' ? `${recordSeconds}s 停止` : '说话' }}
      </button>
      <button v-if="micState === 'ready'" type="button" class="accent" @click="recognizePendingAudio">转写并发送</button>
      <button v-if="micState === 'ready'" type="button" @click="cancelPendingAudio">取消录音</button>
      <button v-if="cameraAvailable" type="button" :disabled="disabled && !cameraOn" :class="{ active: cameraOn }" @click="cameraOn ? closeCamera() : openCamera()">{{ cameraOn ? '关闭镜头' : '打开镜头' }}</button>
      <button v-if="cameraOn" type="button" @click="switchCamera">切换镜头</button>
      <button v-if="visionAvailable && cameraOn" type="button" :class="{ accent: visionOn }" @click="toggleVision">{{ visionOn ? '停止 AI 看' : '允许 AI 看' }}</button>
      <button v-if="visionOn" type="button" :disabled="visionBusy || disabled" @click="captureFrame(true)">{{ visionBusy ? '识别中' : '现在看看' }}</button>
    </div>
    <div v-if="micState === 'transcribing'" class="media-status">正在识别你刚才说的话…</div>
    <div v-else-if="micError || cameraError" class="media-status error">{{ micError || cameraError }}</div>
  </div>
</template>

<style scoped>
.call-media-panel{position:relative;min-width:0;padding:0 0 7px}.media-actions{display:flex;max-width:100%;gap:5px;overflow-x:auto;scrollbar-width:none}.media-actions::-webkit-scrollbar{display:none}.media-actions button{height:28px;flex:0 0 auto;border:1px solid rgba(83,94,108,.11);border-radius:9px;background:rgba(255,255,255,.58);color:#65707d;padding:0 8px;font:inherit;font-size:9.5px;white-space:nowrap;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}.media-actions button.active{border-color:rgba(205,86,88,.24);background:rgba(205,86,88,.1);color:#bd5053}.media-actions button.accent{border-color:rgba(69,125,101,.24);background:rgba(69,125,101,.1);color:#3f7e63}.media-actions button:disabled{opacity:.45}.media-icon{margin-right:4px;font-size:8px}.media-status{padding:5px 2px 0;color:#708092;font-size:9px;line-height:1.35}.media-status.error{color:#b85558}.self-camera{position:fixed;right:14px;top:76px;z-index:24;width:96px;height:128px;overflow:hidden;border:1px solid rgba(255,255,255,.65);border-radius:13px;background:#1f242a;box-shadow:0 8px 24px rgba(0,0,0,.16)}.self-camera video{width:100%;height:100%;display:block;object-fit:cover}.self-camera.mirrored video{transform:scaleX(-1)}.self-camera span{position:absolute;left:5px;right:5px;bottom:5px;overflow:hidden;border-radius:5px;background:rgba(0,0,0,.38);color:#fff;padding:3px 4px;font-size:8px;text-align:center;text-overflow:ellipsis;white-space:nowrap}@media(max-width:340px){.media-actions button{padding:0 7px;font-size:9px}.self-camera{right:10px;width:82px;height:110px}}
</style>
