/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import localforage from 'localforage'
import type { LiveSnapshot } from '../types/live'

const stateStore = localforage.createInstance({ name: 'nrt-live', storeName: 'liveState' })
const assetStore = localforage.createInstance({ name: 'nrt-live', storeName: 'liveAssets' })
const STATE_KEY = 'snapshot'

export const loadLiveSnapshot = () => stateStore.getItem<LiveSnapshot>(STATE_KEY)
export const saveLiveSnapshot = (snapshot: LiveSnapshot) => stateStore.setItem(STATE_KEY, snapshot)

export const saveLiveAsset = async (blob: Blob, preferredId?: string) => {
  const id = preferredId || `live_asset_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  await assetStore.setItem(id, blob)
  return id
}

export const getLiveAsset = (id: string) => assetStore.getItem<Blob>(id)

export const deleteLiveAsset = async (id: string) => {
  if (id) await assetStore.removeItem(id)
}

