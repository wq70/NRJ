/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import localforage from 'localforage'
import type { FateSettings, FateSnapshot } from '../types/fate'
import { clearFateChatBridge, syncFateChatBridge } from './fateChatBridge'

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'fate' })
const SNAPSHOT_KEY = 'snapshot_v1'

export const createDefaultFateSettings = (): FateSettings => ({
  allowReversed: true,
  gentleLanguage: true,
  saveHistory: true,
  chatIntegrationEnabled: false,
  includeReadingsInChatPrompt: false,
  includeCharacterNameInAi: false,
  includeCharacterPersona: false,
  confirmBeforeAi: true,
  reducedRitual: false
})

export const createDefaultFateSnapshot = (): FateSnapshot => ({
  version: 1,
  profiles: [],
  readings: [],
  settings: createDefaultFateSettings(),
  favoriteMethodIds: ['tarot', 'iching', 'bazi', 'daily-almanac'],
  updatedAt: Date.now()
})

export const normalizeFateSnapshot = (raw?: Partial<FateSnapshot> | null): FateSnapshot => {
  const base = createDefaultFateSnapshot()
  if (!raw || Number(raw.version) !== 1) return base
  return {
    ...base,
    ...raw,
    version: 1,
    profiles: Array.isArray(raw.profiles) ? raw.profiles.slice(0, 50) : [],
    readings: Array.isArray(raw.readings) ? raw.readings.slice(-2000).map(reading => ({ ...reading, chatInfluence: reading.chatInfluence === true })) : [],
    settings: { ...base.settings, ...(raw.settings || {}) },
    favoriteMethodIds: Array.isArray(raw.favoriteMethodIds) ? [...new Set(raw.favoriteMethodIds.filter(Boolean))].slice(0, 20) : base.favoriteMethodIds,
    updatedAt: Number(raw.updatedAt || Date.now())
  }
}

export const loadFateSnapshot = async () => {
  const snapshot = normalizeFateSnapshot(await store.getItem<FateSnapshot>(SNAPSHOT_KEY))
  syncFateChatBridge(snapshot)
  return snapshot
}

export const saveFateSnapshot = async (snapshot: FateSnapshot) => {
  snapshot.updatedAt = Date.now()
  await store.setItem(SNAPSHOT_KEY, JSON.parse(JSON.stringify(snapshot)))
  syncFateChatBridge(snapshot)
}

export const clearFateSnapshot = async () => {
  await store.removeItem(SNAPSHOT_KEY)
  clearFateChatBridge()
}
