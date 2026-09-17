/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import localforage from 'localforage'
import { defaultWatchTogetherSettings, type WatchTogetherState } from '../types/watchTogether'

const stateStore = localforage.createInstance({ name: 'nrt-app', storeName: 'watchTogether' })
const blobStore = localforage.createInstance({ name: 'nrt-app', storeName: 'watchTogetherBlobs' })
const BRIDGE_PREFIX = 'clingy_watch_together_bridge_v1_'

export const createDefaultWatchTogetherState = (): WatchTogetherState => ({
  version: 1,
  initialized: true,
  settings: defaultWatchTogetherSettings(),
  items: [],
  progress: [],
  memories: [],
  sessions: [],
  updatedAt: Date.now()
})

export const normalizeWatchTogetherState = (raw?: Partial<WatchTogetherState> | null): WatchTogetherState => {
  const base = createDefaultWatchTogetherState()
  if (!raw || Number(raw.version) !== 1) return base
  return {
    ...base,
    ...raw,
    version: 1,
    settings: {
      ...base.settings,
      ...(raw.settings || {}),
      modules: { ...base.settings.modules, ...(raw.settings?.modules || {}) }
    },
    items: Array.isArray(raw.items) ? raw.items : [],
    progress: Array.isArray(raw.progress) ? raw.progress : [],
    memories: Array.isArray(raw.memories) ? raw.memories.slice(-100) : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(-100) : []
  }
}

const stateKey = (accountId: string) => `state_${accountId || 'guest'}`

export const loadWatchTogetherState = async (accountId: string) => (
  normalizeWatchTogetherState(await stateStore.getItem<WatchTogetherState>(stateKey(accountId)))
)

export const saveWatchTogetherState = async (accountId: string, state: WatchTogetherState) => {
  state.updatedAt = Date.now()
  const serializable = JSON.parse(JSON.stringify(state)) as WatchTogetherState
  await stateStore.setItem(stateKey(accountId), serializable)
  const bridge = {
    enabled: serializable.settings.enabled,
    chatReadsMemory: serializable.settings.chatReadsMemory,
    memories: serializable.memories.slice(-20)
  }
  localStorage.setItem(`${BRIDGE_PREFIX}${accountId}`, JSON.stringify(bridge))
}

export const readWatchTogetherChatBridge = (accountId: string) => {
  try {
    const value = JSON.parse(localStorage.getItem(`${BRIDGE_PREFIX}${accountId}`) || 'null')
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export const buildWatchTogetherChatContext = (chat: any, accountId: string, english = false) => {
  if (!accountId) return ''
  const bridge = readWatchTogetherChatBridge(accountId)
  if (!bridge?.enabled || !bridge?.chatReadsMemory || !Array.isArray(bridge.memories)) return ''
  const characterId = String(chat?.characterEntityId || chat?.id || '')
  const memories = bridge.memories
    .filter((memory: any) => String(memory?.characterId || '') === characterId)
    .slice(-8)
    .map((memory: any) => String(memory?.summary || '').trim())
    .filter(Boolean)
  if (!memories.length) return ''
  return english
    ? `\n\n[Authorized shared-viewing memories]\n${memories.join('\n')}`
    : `\n\n【用户授权读取的共赏记忆】\n${memories.join('\n')}`
}

export const saveWatchTogetherBlob = async (key: string, blob: Blob) => blobStore.setItem(key, blob)
export const getWatchTogetherBlob = async (key: string) => blobStore.getItem<Blob>(key)
export const deleteWatchTogetherBlob = async (key: string) => blobStore.removeItem(key)

export const deleteWatchTogetherItemBlobs = async (state: WatchTogetherState, itemId: string) => {
  const item = state.items.find(entry => entry.id === itemId)
  const keys = new Set<string>()
  item?.chapters.forEach(chapter => chapter.blobKeys?.forEach(key => keys.add(key)))
  if (item?.mediaUrl.startsWith('blob-key:')) keys.add(item.mediaUrl.slice('blob-key:'.length))
  await Promise.all([...keys].map(key => deleteWatchTogetherBlob(key)))
}

export const estimateWatchTogetherStorage = async () => {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return { usage: 0, quota: 0, persisted: false }
  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted?.().catch(() => false) || Promise.resolve(false)
  ])
  return { usage: Number(estimate.usage || 0), quota: Number(estimate.quota || 0), persisted: Boolean(persisted) }
}

export const requestWatchTogetherPersistence = async () => {
  if (!navigator.storage?.persist) return false
  return navigator.storage.persist().catch(() => false)
}
