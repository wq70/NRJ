/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'

const voiceStore = localforage.createInstance({ name: 'nrt-app', storeName: 'realVoiceMessages' })
let recordedAudio: HTMLAudioElement | null = null
let recordedAudioUrl = ''

export type BrowserMediaSupport = {
  secureContext: boolean
  mediaDevices: boolean
  mediaRecorder: boolean
  camera: boolean
  microphone: boolean
}

export const getBrowserMediaSupport = (): BrowserMediaSupport => {
  const available = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
  return {
    secureContext: typeof window !== 'undefined' && window.isSecureContext,
    mediaDevices: available,
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    camera: available,
    microphone: available
  }
}

const supports = (mime: string) => typeof MediaRecorder !== 'undefined' && (
  typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(mime)
)

export const chooseAudioRecordingMimeType = () => {
  const candidates = [
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm;codecs=opus',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/webm'
  ]
  return candidates.find(supports) || ''
}

export const requestMicrophone = () => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持麦克风录音')
  return navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    },
    video: false
  })
}

export const requestCamera = (facingMode: 'user' | 'environment' = 'user') => {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器不支持摄像头')
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1280, max: 1920 },
      height: { ideal: 720, max: 1080 }
    }
  })
}

export const stopMediaStream = (stream?: MediaStream | null) => {
  stream?.getTracks().forEach(track => track.stop())
}

export const recordStream = (stream: MediaStream) => {
  if (typeof MediaRecorder === 'undefined') throw new Error('当前浏览器不支持录音')
  const mimeType = chooseAudioRecordingMimeType()
  const chunks: BlobPart[] = []
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 96000 }) : new MediaRecorder(stream)
  const result = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data) }
    recorder.onerror = event => reject((event as any).error || new Error('录音失败'))
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }))
  })
  recorder.start(500)
  return { recorder, result }
}

export const saveRecordedVoice = async (blob: Blob, preferredId?: string) => {
  const id = preferredId || `voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  await voiceStore.setItem(id, blob)
  return id
}

export const getRecordedVoice = (id: string) => voiceStore.getItem<Blob>(id)

export const deleteRecordedVoice = async (id?: string) => {
  if (id) await voiceStore.removeItem(id)
}

export const stopRecordedVoicePlayback = () => {
  if (recordedAudio) recordedAudio.pause()
  recordedAudio = null
  if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl)
  recordedAudioUrl = ''
}

export const playRecordedVoice = async (id: string) => {
  const blob = await getRecordedVoice(id)
  if (!blob) throw new Error('这段真实语音已不在本机存储中')
  stopRecordedVoicePlayback()
  recordedAudioUrl = URL.createObjectURL(blob)
  recordedAudio = new Audio(recordedAudioUrl)
  recordedAudio.onended = stopRecordedVoicePlayback
  recordedAudio.onerror = stopRecordedVoicePlayback
  await recordedAudio.play()
}

export const mediaErrorMessage = (error: unknown, kind: 'camera' | 'microphone') => {
  const name = error instanceof DOMException ? error.name : ''
  const label = kind === 'camera' ? '摄像头' : '麦克风'
  if (name === 'NotAllowedError' || name === 'SecurityError') return `${label}权限未开启，请在浏览器的网站设置中允许访问`
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return `没有找到可用的${label}`
  if (name === 'NotReadableError' || name === 'TrackStartError') return `${label}正被其他页面或应用占用`
  if (name === 'OverconstrainedError') return `当前设备无法满足${label}参数，请重试`
  if (name === 'AbortError') return `${label}启动被系统中断，请重试`
  return error instanceof Error && error.message ? error.message : `${label}无法启动`
}
