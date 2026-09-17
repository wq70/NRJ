/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { GameHallSnapshot } from '../types/gameHall'
import { createDefaultGameHallSettings, createDefaultGameHallSnapshot } from '../types/gameHall'
import { syncGameHallChatBridge } from './gameHallChatBridge'

const STORAGE_PREFIX = 'clingy_game_hall_v1_'
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

export const gameHallStorageKey = (accountId: string) => `${STORAGE_PREFIX}${accountId || 'guest'}`

export const loadGameHallSnapshot = (accountId: string): GameHallSnapshot => {
  const fallback = createDefaultGameHallSnapshot()
  try {
    const raw = JSON.parse(localStorage.getItem(gameHallStorageKey(accountId)) || 'null') as GameHallSnapshot | null
    if (!raw || raw.version !== 1) { syncGameHallChatBridge(accountId, fallback); return fallback }
    const snapshot: GameHallSnapshot = {
      ...fallback,
      ...raw,
      settings: {
        ...createDefaultGameHallSettings(),
        ...(raw.settings || {}),
        chatBridge: { ...createDefaultGameHallSettings().chatBridge, ...(raw.settings?.chatBridge || {}) }
      },
      records: Array.isArray(raw.records) ? raw.records : [],
      favoriteGameIds: Array.isArray(raw.favoriteGameIds) ? raw.favoriteGameIds : []
    }
    syncGameHallChatBridge(accountId, snapshot)
    return snapshot
  } catch { syncGameHallChatBridge(accountId, fallback); return fallback }
}

export const saveGameHallSnapshot = (accountId: string, snapshot: GameHallSnapshot) => {
  snapshot.updatedAt = Date.now()
  localStorage.setItem(gameHallStorageKey(accountId), JSON.stringify(clone(snapshot)))
  syncGameHallChatBridge(accountId, snapshot)
  window.dispatchEvent(new CustomEvent('clingy:game-hall-updated'))
}
