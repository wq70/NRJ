/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, ref, watch } from 'vue'
import { useChatAuth } from './useChatAuth'
import { mockChats } from './chatState/state'
import { sendCapabilityMessage } from '../services/api'
import { getCharacterDirectoryEntry, listCurrentChatCharacterDirectory, refreshCharacterDirectoryFromAllAccounts } from '../services/characterDirectory'
import {
  deleteWatchTogetherItemBlobs,
  getWatchTogetherBlob,
  loadWatchTogetherState,
  saveWatchTogetherState
} from '../services/watchTogetherRepository'
import { createDefaultWatchTogetherState } from '../services/watchTogetherRepository'
import type {
  WatchTogetherItem,
  WatchTogetherMessage,
  WatchTogetherProgress,
  WatchTogetherSession,
  WatchTogetherSettings,
  WatchTogetherState
} from '../types/watchTogether'

const state = reactive<WatchTogetherState>(createDefaultWatchTogetherState())
const ready = ref(false)
const busy = ref(false)
const error = ref('')
const activeSession = ref<WatchTogetherSession | null>(null)
let loadedAccountId = ''
let lastAutomaticReplyAt = 0
const objectUrls = new Map<string, string>()
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const accountId = () => useChatAuth().currentChatUserId.value || 'guest'

const replaceState = (next: WatchTogetherState) => {
  Object.assign(state, next)
  activeSession.value = null
}

const load = async () => {
  const current = accountId()
  if (ready.value && loadedAccountId === current) return
  ready.value = false
  loadedAccountId = current
  replaceState(await loadWatchTogetherState(current))
  ready.value = true
}

const persist = async () => {
  if (!ready.value) return
  await saveWatchTogetherState(accountId(), state)
}

const updateSettings = async (patch: Partial<WatchTogetherSettings>) => {
  state.settings = {
    ...state.settings,
    ...patch,
    modules: patch.modules ? { ...state.settings.modules, ...patch.modules } : state.settings.modules
  }
  await persist()
}

const addItems = async (items: WatchTogetherItem[]) => {
  const existing = new Set(state.items.map(item => `${item.kind}|${item.sourceId}|${item.sourceUrl}|${item.fileName}|${item.title}`))
  const added = items.filter(item => {
    const key = `${item.kind}|${item.sourceId}|${item.sourceUrl}|${item.fileName}|${item.title}`
    if (existing.has(key)) return false
    existing.add(key)
    return true
  })
  state.items.unshift(...added)
  await persist()
  return added.length
}

const removeItem = async (itemId: string) => {
  await deleteWatchTogetherItemBlobs(state, itemId)
  state.items = state.items.filter(item => item.id !== itemId)
  state.progress = state.progress.filter(item => item.itemId !== itemId)
  if (activeSession.value?.itemId === itemId) activeSession.value = null
  for (const [key, url] of objectUrls.entries()) {
    if (!key.includes(itemId)) continue
    URL.revokeObjectURL(url)
    objectUrls.delete(key)
  }
  await persist()
}

const resolveBlobUrl = async (key: string, cacheKey = key) => {
  const existing = objectUrls.get(cacheKey)
  if (existing) return existing
  const blob = await getWatchTogetherBlob(key)
  if (!blob) throw new Error('本地文件已经丢失，请重新导入')
  const url = URL.createObjectURL(blob)
  objectUrls.set(cacheKey, url)
  return url
}

const resolveItemMediaUrl = async (item: WatchTogetherItem) => {
  if (!item.mediaUrl.startsWith('blob-key:')) return item.mediaUrl
  return resolveBlobUrl(item.mediaUrl.slice('blob-key:'.length), `item:${item.id}`)
}

const resolveChapterPageUrls = async (item: WatchTogetherItem, chapterId: string) => {
  const chapter = item.chapters.find(entry => entry.id === chapterId)
  if (chapter?.pageUrls?.length) return chapter.pageUrls
  if (!chapter?.blobKeys?.length) return []
  return Promise.all(chapter.blobKeys.map((key, index) => resolveBlobUrl(key, `page:${item.id}:${chapterId}:${index}`)))
}

const progressFor = (itemId: string) => state.progress.find(entry => entry.itemId === itemId)

const saveProgress = async (input: Omit<WatchTogetherProgress, 'updatedAt'>) => {
  if (!state.settings.enabled || !state.settings.saveProgress) return
  const current = progressFor(input.itemId)
  const next = { ...input, position: Math.max(0, input.position), percent: Math.max(0, Math.min(100, input.percent)), updatedAt: Date.now() }
  if (current) Object.assign(current, next)
  else state.progress.push(next)
  await persist()
}

const characters = () => {
  refreshCharacterDirectoryFromAllAccounts()
  return listCurrentChatCharacterDirectory()
}

const startSession = async (item: WatchTogetherItem, characterId: string) => {
  if (!state.settings.enabled || !state.settings.companionEnabled) return null
  const character = getCharacterDirectoryEntry(characterId)
  if (!character) throw new Error('没有找到这个聊天角色')
  const session: WatchTogetherSession = {
    id: uid('watch_session'), itemId: item.id, characterId: character.entityId, characterName: character.name,
    startedAt: Date.now(), messages: [{ id: uid('watch_msg'), sender: 'system', content: `你和${character.name}开始共赏《${item.title}》。`, anchor: 0, createdAt: Date.now() }]
  }
  activeSession.value = session
  return session
}

const addSessionMessage = (sender: WatchTogetherMessage['sender'], content: string, anchor = 0) => {
  const session = activeSession.value
  const clean = content.trim()
  if (!session || !clean) return null
  const message = { id: uid('watch_msg'), sender, content: clean, anchor, createdAt: Date.now() } satisfies WatchTogetherMessage
  session.messages.push(message)
  return message
}

const recentChatContext = (characterId: string) => {
  if (!state.settings.sessionReadsChat) return ''
  const chat = mockChats.value.find(entry => String(entry.characterEntityId || entry.id) === characterId)
  if (!chat) return ''
  return (chat.messages || []).slice(-12).map((message: any) => `${message.type === 'right' ? '用户' : chat.name}：${String(message.content || '')}`).join('\n')
}

const requestCompanionReply = async (options: { item: WatchTogetherItem; anchor: number; visibleText?: string; event?: string; automatic?: boolean }) => {
  const session = activeSession.value
  if (!session || busy.value || !state.settings.enabled || !state.settings.companionEnabled || !state.settings.characterCanSpeak) return ''
  if (options.automatic) {
    if (!state.settings.eventDrivenReplies || Date.now() - lastAutomaticReplyAt < 90_000) return ''
    lastAutomaticReplyAt = Date.now()
  }
  const character = getCharacterDirectoryEntry(session.characterId)
  if (!character) throw new Error('陪伴角色已不存在')
  const transcript = session.messages.slice(-24).map(message => `${message.sender === 'user' ? '用户' : message.sender === 'character' ? character.name : '系统'}：${message.content}`).join('\n')
  const sharedText = state.settings.shareText ? String(options.visibleText || '').slice(0, 5000) : ''
  const chatContext = recentChatContext(session.characterId)
  const knowledge = sharedText ? `你被允许看到当前内容：\n${sharedText}` : '你没有被允许看到正文、字幕或画面，只知道作品名称和当前进度；不得假装看到了具体内容。'
  busy.value = true
  error.value = ''
  try {
    const response = await sendCapabilityMessage('chat', [
      { role: 'system', content: `你是${character.name}，正在与用户共赏${options.item.kind === 'novel' ? '小说' : options.item.kind === 'video' ? '影片' : options.item.kind === 'comic' ? '漫画' : '广播剧或有声剧'}《${options.item.title}》。人设：${character.persona}\n保持自然真人感，可以简短回应，也可以选择沉默。只讨论已经提供的内容，不剧透，不声称看到未授权的画面。只输出你此刻真正会说的一到三句自然话；如果没有必要说话，输出 [SILENCE]。` },
      { role: 'user', content: `当前进度：${Math.round(options.anchor)}${options.item.kind === 'novel' || options.item.kind === 'comic' ? '%' : '秒'}\n当前事件：${options.event || '用户正在与你聊天'}\n${knowledge}\n${chatContext ? `普通聊天上下文（用户已授权）：\n${chatContext}\n` : ''}本场共赏聊天：\n${transcript || '暂无'}\n请自然决定是否回应。` }
    ], { diagnosticContext: { chatId: `watch:${session.id}`, characterIds: [session.characterId], characterName: character.name } })
    const content = response.content.trim()
    if (!content || /^\[?SILENCE\]?$/i.test(content)) return ''
    addSessionMessage('character', content, options.anchor)
    return content
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '角色回复失败'
    throw cause
  } finally {
    busy.value = false
  }
}

const endSession = async (item?: WatchTogetherItem) => {
  const session = activeSession.value
  if (!session) return
  session.endedAt = Date.now()
  const dialogue = session.messages.filter(message => message.sender !== 'system').slice(-12).map(message => message.content).join('；')
  if (state.settings.writeMemory && item) {
    state.memories.push({
      id: uid('watch_memory'), characterId: session.characterId, itemId: item.id, kind: item.kind, title: item.title,
      summary: dialogue ? `与用户共赏《${item.title}》。重要对话：${dialogue}` : `与用户一起安静共赏了《${item.title}》。`, createdAt: Date.now()
    })
    state.memories = state.memories.slice(-100)
  }
  if (state.settings.saveRecords) state.sessions.unshift(clone(session))
  state.sessions = state.sessions.slice(0, 100)
  activeSession.value = null
  await persist()
}

const disposeObjectUrls = () => {
  objectUrls.forEach(url => URL.revokeObjectURL(url))
  objectUrls.clear()
}

export function useWatchTogether() {
  const auth = useChatAuth()
  watch(auth.currentChatUserId, async () => {
    disposeObjectUrls()
    ready.value = false
    await load()
  })
  return {
    state, ready, busy, error, activeSession,
    enabledItems: computed(() => state.items.filter(item => state.settings.modules[item.kind])),
    load, persist, updateSettings, addItems, removeItem, resolveItemMediaUrl, resolveChapterPageUrls,
    progressFor, saveProgress, characters, startSession, addSessionMessage, requestCompanionReply, endSession, disposeObjectUrls
  }
}
