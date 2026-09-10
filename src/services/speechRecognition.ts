/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */

export interface SpeechRecognitionConfig {
  url: string
  key: string
  model: string
  language?: string
}

const endpointFor = (raw: string) => {
  const value = raw.trim().replace(/\/+$/, '')
  if (!value) return ''
  if (/\/audio\/transcriptions$/i.test(value)) return value
  if (/\/v1$/i.test(value)) return `${value}/audio/transcriptions`
  return `${value}/v1/audio/transcriptions`
}

const extensionFor = (mime: string) => {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'm4a'
}

export const isSpeechRecognitionReady = (config: SpeechRecognitionConfig) => Boolean(
  endpointFor(config.url) && config.key.trim() && config.model.trim()
)

export const transcribeAudio = async (blob: Blob, config: SpeechRecognitionConfig, signal?: AbortSignal) => {
  const endpoint = endpointFor(config.url)
  if (!endpoint || !config.key.trim() || !config.model.trim()) throw new Error('请先在真实音视频设置中配置语音识别接口')
  const form = new FormData()
  form.append('file', blob, `recording.${extensionFor(blob.type)}`)
  form.append('model', config.model.trim())
  if (config.language?.trim()) form.append('language', config.language.trim())
  form.append('response_format', 'json')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key.trim()}` },
    body: form,
    signal
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error?.message || payload?.message || `语音识别请求失败 (${response.status})`)
  const text = String(payload?.text || payload?.data?.text || payload?.result?.text || '').trim()
  if (!text) throw new Error('语音识别没有返回文字')
  return text
}
