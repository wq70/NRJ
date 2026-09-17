/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { computed, reactive, ref, watch } from 'vue'
import { sendCapabilityMessage } from '../services/api'
import { cleanLiveHostReply, createLiveSnapshot, makeLiveChannel, makeLiveEvent, normalizeLiveSnapshot, pruneLiveSessions, randomJitsiRoomName, buildLiveHostMessages } from '../services/liveRuntime'
import { deleteLiveAsset, getLiveAsset, loadLiveSnapshot, saveLiveAsset, saveLiveSnapshot } from '../services/liveRepository'
import type { LiveChannel, LiveEvent, LiveRecording, LiveRoomMode, LiveRoomVisibility, LiveSession, LiveSnapshot } from '../types/live'

const snapshot = reactive<LiveSnapshot>(createLiveSnapshot())
const ready = ref(false)
const busy = ref(false)
const error = ref('')
let loading: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

const ensureLoaded = () => {
  if (loading) return loading
  loading = loadLiveSnapshot().then(value => {
    Object.assign(snapshot, pruneLiveSessions(normalizeLiveSnapshot(value)))
    ready.value = true
  }).catch(reason => {
    error.value = reason instanceof Error ? reason.message : '直播数据加载失败'
    ready.value = true
  })
  return loading
}

watch(snapshot, () => {
  if (!ready.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveLiveSnapshot(JSON.parse(JSON.stringify(snapshot))) }, 120)
}, { deep: true })

export function useLiveStudio() {
  void ensureLoaded()
  const activeSession = computed(() => snapshot.sessions.find(item => item.id === snapshot.activeSessionId) || null)
  const activeChannel = computed(() => activeSession.value ? snapshot.channels.find(item => item.id === activeSession.value?.channelId) || null : null)

  const createChannel = (input: { title: string; mode: LiveRoomMode; visibility: LiveRoomVisibility; characterId: string; description: string }) => {
    const channel = makeLiveChannel(input)
    snapshot.channels.unshift(channel)
    return channel
  }

  const startSession = (channel: LiveChannel) => {
    const existing = snapshot.sessions.find(item => item.status === 'live')
    if (existing) { snapshot.activeSessionId = existing.id; return existing }
    const session: LiveSession = {
      id: `live_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      channelId: channel.id,
      title: channel.title,
      mode: channel.mode,
      visibility: channel.visibility,
      characterId: channel.characterId,
      status: 'live',
      startedAt: Date.now(),
      events: [],
      recordings: [],
      jitsiRoomName: channel.mode === 'jitsi' ? randomJitsiRoomName() : undefined
    }
    session.events.push(makeLiveEvent(session.id, 'system', '直播系统', '直播已开始', { aiReadable: false }))
    snapshot.sessions.unshift(session)
    snapshot.activeSessionId = session.id
    return session
  }

  const appendEvent = (event: LiveEvent) => {
    const session = snapshot.sessions.find(item => item.id === event.sessionId)
    if (!session || session.status !== 'live') return false
    session.events.push(event)
    if (session.events.length > 500) session.events.splice(0, session.events.length - 500)
    return true
  }

  const addMessage = (actorName: string, content: string, virtual = false) => {
    const session = activeSession.value
    if (!session || !content.trim()) return null
    const event = makeLiveEvent(session.id, virtual ? 'viewer' : 'message', actorName, content, { virtual, actorId: virtual ? `virtual_${actorName}` : 'local_user' })
    appendEvent(event)
    return event
  }

  const generateHostReply = async (character: any, instruction = '') => {
    const session = activeSession.value
    if (!session || !snapshot.settings.switches.aiHost) throw new Error('请先开启 AI 主播')
    busy.value = true
    error.value = ''
    try {
      const contextEvents = session.events.slice(-snapshot.settings.maxContextEvents)
      const result = await sendCapabilityMessage('live-host', buildLiveHostMessages({
        title: session.title,
        characterName: character?.realName || character?.name || '主播',
        persona: character?.persona || '',
        mode: session.mode,
        events: contextEvents,
        instruction
      }), { diagnosticContext: { source: 'live-host', sessionId: session.id } as any })
      const content = cleanLiveHostReply(typeof result === 'string' ? result : result.content || '')
      if (!content) throw new Error('AI 主播没有返回可播放的内容')
      const event = makeLiveEvent(session.id, 'host', character?.realName || character?.name || '主播', content, { actorId: String(character?.characterEntityId || character?.id || 'host') })
      appendEvent(event)
      return event
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : 'AI 主播生成失败'
      throw reason
    } finally { busy.value = false }
  }

  const endSession = (summary = '') => {
    const session = activeSession.value
    if (!session) return
    session.status = 'ended'
    session.endedAt = Date.now()
    if (summary.trim()) session.summary = summary.trim().slice(0, 3000)
    session.events.push(makeLiveEvent(session.id, 'system', '直播系统', '直播已结束', { aiReadable: false }))
    snapshot.activeSessionId = ''
  }

  const resumeSession = (id: string) => {
    const session = snapshot.sessions.find(item => item.id === id && item.status === 'live')
    if (session) snapshot.activeSessionId = session.id
  }

  const deleteSession = async (id: string) => {
    const session = snapshot.sessions.find(item => item.id === id)
    if (!session || session.status === 'live') return false
    await Promise.all(session.recordings.map(item => deleteLiveAsset(item.assetId)))
    snapshot.sessions = snapshot.sessions.filter(item => item.id !== id)
    return true
  }

  const addRecording = (recording: LiveRecording) => {
    const session = snapshot.sessions.find(item => item.id === recording.sessionId)
    if (session) session.recordings.push(recording)
  }

  const addSceneImage = async (channelId: string, sceneId: string, file: File) => {
    if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
    if (file.size > 15 * 1024 * 1024) throw new Error('场景图片不能超过 15MB')
    const channel = snapshot.channels.find(item => item.id === channelId)
    const scene = channel?.scenes.find(item => item.id === sceneId)
    if (!scene) throw new Error('没有找到场景')
    if (scene.imageAssetId) await deleteLiveAsset(scene.imageAssetId)
    scene.imageAssetId = await saveLiveAsset(file)
    channel!.updatedAt = Date.now()
    return scene.imageAssetId
  }

  const addSceneMedia = async (channelId: string, sceneId: string, file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('请选择图片或视频文件')
    const limit = file.type.startsWith('video/') ? 250 * 1024 * 1024 : 15 * 1024 * 1024
    if (file.size > limit) throw new Error(file.type.startsWith('video/') ? '本机视频不能超过 250MB' : '场景图片不能超过 15MB')
    const channel = snapshot.channels.find(item => item.id === channelId)
    const scene = channel?.scenes.find(item => item.id === sceneId)
    if (!scene) throw new Error('没有找到场景')
    if (scene.mediaAssetId) await deleteLiveAsset(scene.mediaAssetId)
    if (scene.imageAssetId) await deleteLiveAsset(scene.imageAssetId)
    scene.mediaAssetId = await saveLiveAsset(file)
    scene.mediaMimeType = file.type
    scene.imageAssetId = file.type.startsWith('image/') ? scene.mediaAssetId : undefined
    channel!.updatedAt = Date.now()
    return scene.mediaAssetId
  }

  return {
    snapshot, ready, busy, error, activeSession, activeChannel,
    ensureLoaded, createChannel, startSession, appendEvent, addMessage, generateHostReply, endSession, resumeSession, deleteSession,
    addRecording, addSceneImage, addSceneMedia, saveLiveAsset, getLiveAsset
  }
}
