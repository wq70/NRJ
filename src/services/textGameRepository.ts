/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import localforage from 'localforage'
import type { TextGameAsset, TextGameProject, TextGameSave, TextGameSnapshot } from '../types/textGame'
import { syncTextGameChatContext } from './textGameChatContext'

const dataStore = localforage.createInstance({ name: 'nrt-app', storeName: 'textGame' })
const assetStore = localforage.createInstance({ name: 'nrt-app', storeName: 'textGameAssets' })
const SNAPSHOT_KEY = 'snapshot_v1'

const emptySnapshot = (): TextGameSnapshot => ({ version: 1, projects: [], saves: [], lastProjectId: '', updatedAt: Date.now() })
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const normalizeProject = (raw: TextGameProject): TextGameProject => ({
  ...raw,
  schemaVersion: 1,
  tags: Array.isArray(raw.tags) ? raw.tags : [],
  nodes: Array.isArray(raw.nodes) ? raw.nodes : [],
  variables: Array.isArray(raw.variables) ? raw.variables : [],
  characters: Array.isArray(raw.characters) ? raw.characters : [],
  worldReferences: Array.isArray(raw.worldReferences) ? raw.worldReferences : [],
  settings: Object.assign(
    { textSpeed: 28, autoDelay: 1400, allowRollback: true, showVariableChanges: true, autoSave: true, reduceMotion: false },
    raw.settings || {},
    {
      chatIntegration: Object.assign(
        { enabled: false, includeProjectSummary: false, includeCurrentScene: false, includeVisibleVariables: false, includeUnlockedEndings: false, includeCharacterProfile: false },
        raw.settings?.chatIntegration || {}
      )
    }
  )
})

export const loadTextGameSnapshot = async (): Promise<TextGameSnapshot> => {
  const raw = await dataStore.getItem<TextGameSnapshot>(SNAPSHOT_KEY)
  if (!raw || raw.version !== 1) return emptySnapshot()
  const snapshot = { ...emptySnapshot(), ...raw, projects: (raw.projects || []).map(normalizeProject), saves: Array.isArray(raw.saves) ? raw.saves : [] }
  syncTextGameChatContext(snapshot)
  return snapshot
}

export const saveTextGameSnapshot = async (snapshot: TextGameSnapshot) => {
  snapshot.updatedAt = Date.now()
  await dataStore.setItem(SNAPSHOT_KEY, clone(snapshot))
  syncTextGameChatContext(snapshot)
}

export const putTextGameAsset = async (asset: TextGameAsset, blob: Blob) => {
  await assetStore.setItem(`blob:${asset.id}`, blob)
  await assetStore.setItem(`meta:${asset.id}`, clone(asset))
}

export const getTextGameAssetBlob = (assetId: string) => assetStore.getItem<Blob>(`blob:${assetId}`)

export const listTextGameAssets = async (projectId: string) => {
  const result: TextGameAsset[] = []
  await assetStore.iterate((value: unknown, key: string) => {
    if (key.startsWith('meta:') && value && (value as TextGameAsset).projectId === projectId) result.push(value as TextGameAsset)
  })
  return result.sort((a, b) => b.createdAt - a.createdAt)
}

export const removeTextGameAsset = async (assetId: string) => {
  await Promise.all([assetStore.removeItem(`blob:${assetId}`), assetStore.removeItem(`meta:${assetId}`)])
}

export const removeTextGameProjectAssets = async (projectId: string) => {
  const assets = await listTextGameAssets(projectId)
  await Promise.all(assets.map(asset => removeTextGameAsset(asset.id)))
}

export const replaceTextGameProject = (projects: TextGameProject[], project: TextGameProject) => {
  const index = projects.findIndex(item => item.id === project.id)
  if (index >= 0) projects[index] = clone(project)
  else projects.unshift(clone(project))
}

export const replaceTextGameSave = (saves: TextGameSave[], save: TextGameSave) => {
  const index = saves.findIndex(item => item.id === save.id)
  if (index >= 0) saves[index] = clone(save)
  else saves.unshift(clone(save))
}
