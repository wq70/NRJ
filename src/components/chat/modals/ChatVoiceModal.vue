/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount } from 'vue'
import { chatSettings } from '../../../store'
import { mediaErrorMessage, recordStream, requestMicrophone, stopMediaStream } from '../../../services/browserMedia'
import { transcribeAudio } from '../../../services/speechRecognition'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'send', data: { text: string, seconds: number, audioBlob?: Blob, mimeType?: string, isRealVoice?: boolean, transcriptStatus?: string }): void
}>()

const text = ref('')
const mode = ref<'simulated' | 'recorded'>('simulated')
const recordingState = ref<'idle' | 'recording' | 'ready' | 'transcribing' | 'error'>('idle')
const recordedSeconds = ref(0)
const recordError = ref('')
const recordedBlob = ref<Blob | null>(null)
const isPreviewing = ref(false)
let stream: MediaStream | null = null
let recorder: MediaRecorder | null = null
let resultPromise: Promise<Blob> | null = null
let recordStartedAt = 0
let recordTimer: ReturnType<typeof setInterval> | null = null
let previewAudio: HTMLAudioElement | null = null
let previewUrl = ''

const seconds = computed(() => {
  if (mode.value === 'recorded') return recordedSeconds.value
  const len = text.value.trim().length
  if (len === 0) return 0
  return Math.min(60, Math.max(1, Math.ceil(len / 4)))
})

watch(() => props.visible, (val) => {
  if (val) {
    text.value = ''
    mode.value = 'simulated'
    resetRecording()
  } else {
    stopActiveRecording()
    stopPreview()
  }
})

const clearRecordTimer = () => {
  if (recordTimer) clearInterval(recordTimer)
  recordTimer = null
}

const stopPreview = () => {
  previewAudio?.pause()
  previewAudio = null
  isPreviewing.value = false
  if (previewUrl) URL.revokeObjectURL(previewUrl)
  previewUrl = ''
}

const stopActiveRecording = () => {
  clearRecordTimer()
  if (recorder?.state === 'recording') recorder.stop()
  recorder = null
  stopMediaStream(stream)
  stream = null
}

function resetRecording() {
  stopActiveRecording()
  stopPreview()
  recordedBlob.value = null
  recordedSeconds.value = 0
  recordError.value = ''
  recordingState.value = 'idle'
}

const startRecording = async () => {
  resetRecording()
  try {
    stream = await requestMicrophone()
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      if (recordingState.value === 'recording') void stopRecording()
    }, { once: true })
    const session = recordStream(stream)
    recorder = session.recorder
    resultPromise = session.result
    recordStartedAt = Date.now()
    recordingState.value = 'recording'
    recordTimer = setInterval(() => {
      recordedSeconds.value = Math.max(1, Math.round((Date.now() - recordStartedAt) / 1000))
      if (recordedSeconds.value >= 120) void stopRecording()
    }, 250)
  } catch (error) {
    recordError.value = mediaErrorMessage(error, 'microphone')
    recordingState.value = 'error'
    stopMediaStream(stream)
    stream = null
  }
}

const stopRecording = async () => {
  if (!recorder || recorder.state !== 'recording' || !resultPromise) return
  clearRecordTimer()
  recordedSeconds.value = Math.max(1, Math.round((Date.now() - recordStartedAt) / 1000))
  recorder.stop()
  stopMediaStream(stream)
  stream = null
  try {
    recordedBlob.value = await resultPromise
    if (!recordedBlob.value.size) throw new Error('没有录到声音，请重试')
    recordingState.value = 'ready'
  } catch (error) {
    recordError.value = error instanceof Error ? error.message : '录音失败'
    recordingState.value = 'error'
  } finally {
    recorder = null
    resultPromise = null
  }
}

const togglePreview = async () => {
  if (isPreviewing.value) return stopPreview()
  if (!recordedBlob.value) return
  stopPreview()
  previewUrl = URL.createObjectURL(recordedBlob.value)
  previewAudio = new Audio(previewUrl)
  previewAudio.onended = stopPreview
  previewAudio.onerror = stopPreview
  await previewAudio.play()
  isPreviewing.value = true
}

const recognizeRecording = async () => {
  if (!recordedBlob.value) return
  recordingState.value = 'transcribing'
  recordError.value = ''
  try {
    text.value = await transcribeAudio(recordedBlob.value, {
      url: chatSettings.speechRecognitionUrl,
      key: chatSettings.speechRecognitionKey,
      model: chatSettings.speechRecognitionModel,
      language: chatSettings.speechRecognitionLanguage
    })
    recordingState.value = 'ready'
  } catch (error) {
    recordError.value = error instanceof Error ? error.message : '语音转文字失败'
    recordingState.value = 'ready'
  }
}

const handleSend = async () => {
  if (mode.value === 'simulated') {
    if (!text.value.trim()) return
    emit('send', { text: text.value.trim(), seconds: seconds.value })
    return
  }
  if (!recordedBlob.value || recordingState.value === 'recording' || recordingState.value === 'transcribing') return
  if (chatSettings.realMediaAutoTranscribeMessage && !text.value.trim()) await recognizeRecording()
  emit('send', {
    text: text.value.trim(),
    seconds: recordedSeconds.value,
    audioBlob: recordedBlob.value,
    mimeType: recordedBlob.value.type,
    isRealVoice: true,
    transcriptStatus: text.value.trim() ? 'completed' : 'none'
  })
}

onBeforeUnmount(() => { stopActiveRecording(); stopPreview() })
</script>

<template>
  <transition name="folder-fade">
    <div v-if="visible" class="folder-modal-overlay" @click="emit('close')" @touchmove.prevent>
      <div class="voice-modal-card" @click.stop>
        <div class="vm-header">
          <h3>发送语音</h3>
        </div>
        <div class="vm-body">
          <div v-if="chatSettings.enableRealMedia && chatSettings.enableRealVoiceMessage" class="voice-mode-tabs" role="tablist">
            <button type="button" :class="{ active: mode === 'simulated' }" @click="mode = 'simulated'; resetRecording()">文字模拟</button>
            <button type="button" :class="{ active: mode === 'recorded' }" @click="mode = 'recorded'; text = ''">真实录音</button>
          </div>
          <template v-if="mode === 'simulated'">
          <textarea
            v-model="text" 
            placeholder="输入你想说的内容，将自动换算成语音发送" 
            class="vm-textarea"
            maxlength="200"
          ></textarea>
          <div class="vm-seconds-hint">预计语音时长: {{ seconds }} 秒</div>
          </template>
          <template v-else>
            <div class="record-stage" :class="recordingState">
              <div class="record-orb"><span v-for="n in 5" :key="n" :style="{ animationDelay: `${n * 80}ms` }"></span></div>
              <b>{{ recordingState === 'recording' ? '正在录音' : recordingState === 'transcribing' ? '正在转文字' : recordedBlob ? '录音完成' : '点击开始录音' }}</b>
              <small>{{ recordedSeconds }} 秒{{ recordingState === 'recording' ? ' · 最长 120 秒' : '' }}</small>
              <button v-if="recordingState !== 'recording' && !recordedBlob" type="button" class="record-main-btn" @click="startRecording">开始录音</button>
              <button v-else-if="recordingState === 'recording'" type="button" class="record-main-btn stop" @click="stopRecording">停止录音</button>
              <div v-else class="record-actions">
                <button type="button" @click="togglePreview">{{ isPreviewing ? '停止试听' : '试听' }}</button>
                <button type="button" @click="resetRecording">重录</button>
                <button type="button" :disabled="recordingState === 'transcribing'" @click="recognizeRecording">转文字</button>
              </div>
            </div>
            <textarea v-if="recordedBlob" v-model="text" class="vm-textarea transcript" maxlength="500" placeholder="转写文字会供 AI 理解；也可以手动填写或修正"></textarea>
            <p v-if="recordError" class="record-error">{{ recordError }}</p>
          </template>
        </div>
        <div class="vm-footer">
          <button class="vm-btn cancel" @click="emit('close')">取消</button>
          <button class="vm-btn send" :disabled="mode === 'simulated' ? !text.trim() : !recordedBlob || recordingState === 'recording' || recordingState === 'transcribing'" @click="handleSend">发送</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.folder-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.45);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.voice-modal-card {
  width: 280px;
  background: var(--sys-bg-primary, #fff);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.15);
}
.is-dark .voice-modal-card {
  background: var(--sys-bg-primary, #2c2c2c);
}

.vm-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, rgba(0,0,0,0.05));
}
.vm-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--text-primary, #333);
  text-align: center;
}
.is-dark .vm-header h3 {
  color: #eee;
}

.vm-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.voice-mode-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:3px;border-radius:9px;background:var(--sys-bg-tertiary,#eceef1)}.voice-mode-tabs button{height:29px;border:0;border-radius:7px;background:transparent;color:var(--text-secondary,#666);font:inherit;font-size:11px}.voice-mode-tabs button.active{background:var(--sys-bg-secondary,#fff);color:var(--text-primary,#222);box-shadow:0 1px 4px rgba(0,0,0,.08);font-weight:600}
.record-stage{display:flex;min-height:132px;align-items:center;justify-content:center;flex-direction:column;gap:5px;border:1px solid var(--border-color,rgba(0,0,0,.08));border-radius:11px;background:var(--sys-bg-secondary,#fafafa);padding:12px}.record-stage b{font-size:12px}.record-stage small{color:var(--text-tertiary,#888);font-size:10px}.record-orb{height:28px;display:flex;align-items:center;gap:3px}.record-orb span{width:3px;height:8px;border-radius:3px;background:#658b7b}.record-stage.recording .record-orb span{animation:voiceBar .65s ease-in-out infinite alternate}.record-main-btn{height:31px;min-width:90px;margin-top:3px;border:0;border-radius:9px;background:#4f8f75;color:#fff;padding:0 13px;font:inherit;font-size:11px;font-weight:600}.record-main-btn.stop{background:#d45e60}.record-actions{display:flex;gap:5px;margin-top:4px}.record-actions button{height:28px;border:0;border-radius:8px;background:var(--sys-bg-tertiary,#eceef1);color:var(--text-secondary,#666);padding:0 9px;font:inherit;font-size:10px}.record-actions button:disabled{opacity:.45}.vm-textarea.transcript{height:62px;font-size:11px}.record-error{margin:0;color:#c24a4a;font-size:10px;line-height:1.4;text-align:center}@keyframes voiceBar{to{height:24px}}

.vm-textarea {
  width: 100%;
  height: 80px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border-color, rgba(0,0,0,0.1));
  background: var(--sys-bg-secondary, #f5f5f5);
  color: var(--text-primary, #333);
  font-size: 14px;
  resize: none;
  box-sizing: border-box;
}
.vm-textarea:focus {
  outline: none;
  border-color: #1976d2;
}
.is-dark .vm-textarea {
  background: rgba(0,0,0,0.2);
  color: #eee;
}

.vm-seconds-hint {
  font-size: 12px;
  color: var(--text-secondary, #666);
  text-align: right;
}
.is-dark .vm-seconds-hint {
  color: #999;
}

.vm-footer {
  display: flex;
  border-top: 1px solid var(--border-color, rgba(0,0,0,0.05));
}

.vm-btn {
  flex: 1;
  height: 44px;
  background: transparent;
  border: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
}
.vm-btn.cancel {
  border-right: 1px solid var(--border-color, rgba(0,0,0,0.05));
  color: var(--text-secondary, #666);
}
.is-dark .vm-btn.cancel {
  color: #999;
}
.vm-btn.send {
  color: #1976d2;
}
.vm-btn.send:disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* 动画效果借用基础的 folder-fade */
.folder-fade-enter-active, .folder-fade-leave-active {
  transition: opacity 0.3s ease;
}
.folder-fade-enter-active .voice-modal-card {
  animation: folderPopIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.1);
}
.folder-fade-leave-active .voice-modal-card {
  animation: folderPopOut 0.2s ease forwards;
}
.folder-fade-enter-from, .folder-fade-leave-to {
  opacity: 0;
}
@keyframes folderPopIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes folderPopOut {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(0.95); opacity: 0; }
}
</style>
