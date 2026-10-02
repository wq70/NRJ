import { computed, reactive } from 'vue'
import localforage from 'localforage'
import { validatePluginPackage, pluginFileUrl } from './pluginPackage'
import { pluginAppId, type InstalledPlugin, type PluginPackage, type PluginPermission } from '../types/plugins'

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'plugins' })
const dataStore = localforage.createInstance({ name: 'nrt-app', storeName: 'pluginData' })
const state = reactive<{ plugins: InstalledPlugin[]; loaded: boolean; error: string }>({ plugins: [], loaded: false, error: '' })
let loading: Promise<void> | null = null
let mutations: Promise<unknown> = Promise.resolve()
const serialize = <T>(work: () => Promise<T>) => {
  const result = mutations.then(work)
  mutations = result.catch(() => undefined)
  return result
}
const plainPackage = (pkg: PluginPackage): PluginPackage => JSON.parse(JSON.stringify({ manifest: pkg.manifest, files: pkg.files }))
export const installedPlugins = computed(() => state.plugins)
export const pluginLoadState = state
export const requestPluginManager = () => window.dispatchEvent(new CustomEvent('nrj-open-plugin-manager'))
export const findPlugin = (id: string) => state.plugins.find(plugin => plugin.manifest.id === id)
export const pluginIcon = (pkg: PluginPackage) => pkg.manifest.icon && pkg.files[pkg.manifest.icon] ? pluginFileUrl(pkg.files[pkg.manifest.icon]) : null
export const enabledChatPlugins = computed(() => state.plugins.filter(plugin => plugin.enabled && plugin.manifest.extensions.some(extension => extension.target === 'chat')))
export const pluginDesktopApps = computed(() => state.plugins.filter(plugin => plugin.manifest.app).map(plugin => ({
  id: pluginAppId(plugin.manifest.id), name: plugin.manifest.name, color: '#ffffff', available: plugin.enabled, allowCustomFont: false,
  icon: '<span class="text-icon">插</span>', customImage: pluginIcon(plugin)
})))
export const loadPlugins = async () => {
  if (state.loaded) return
  if (loading) return loading
  loading = (async () => {
    const records: InstalledPlugin[] = []
    let invalid = 0
    await store.iterate((raw: InstalledPlugin, key) => {
      try {
        const pkg = validatePluginPackage(raw)
        if (pkg.manifest.id !== key) throw new Error('插件 ID 不一致')
        let previous: PluginPackage | undefined
        if (raw.previous) { previous = validatePluginPackage(raw.previous); if (previous.manifest.id !== key) previous = undefined }
        records.push({ ...pkg, enabled: raw.enabled === true, grants: Array.isArray(raw.grants) ? raw.grants.filter(permission => pkg.manifest.permissions.includes(permission)) : [], installedAt: Number(raw.installedAt) || Date.now(), updatedAt: Number(raw.updatedAt) || Date.now(), previous })
      } catch { invalid++ }
    })
    state.plugins.splice(0, state.plugins.length, ...records)
    state.error = invalid ? `${invalid} 个插件记录损坏，已跳过；可重新导入。` : ''
    state.loaded = true
  })().catch(error => { state.error = `插件读取失败：${error instanceof Error ? error.message : '本机存储不可用'}`; throw error }).finally(() => { loading = null })
  return loading
}
export const installPlugin = (input: PluginPackage, grants: PluginPermission[]) => serialize(async () => {
  await loadPlugins()
  const pkg = validatePluginPackage(input)
  const old = findPlugin(pkg.manifest.id)
  const record: InstalledPlugin = { ...plainPackage(pkg), enabled: old?.enabled ?? true, grants: [...new Set(grants.filter(permission => pkg.manifest.permissions.includes(permission)))], installedAt: old?.installedAt || Date.now(), updatedAt: Date.now(), previous: old ? plainPackage(old) : undefined }
  await store.setItem(pkg.manifest.id, record)
  const index = state.plugins.findIndex(plugin => plugin.manifest.id === pkg.manifest.id)
  if (index < 0) state.plugins.push(record)
  else state.plugins.splice(index, 1, record)
  return record
})
export const configurePlugin = (id: string, enabled: boolean, grants: PluginPermission[]) => serialize(async () => {
  const old = findPlugin(id)
  if (!old) throw new Error('插件已卸载')
  const record: InstalledPlugin = { ...JSON.parse(JSON.stringify(old)), enabled, grants: [...new Set(grants.filter(permission => old.manifest.permissions.includes(permission)))] }
  await store.setItem(id, record)
  state.plugins.splice(state.plugins.indexOf(old), 1, record)
})
export const rollbackPlugin = (id: string) => serialize(async () => {
  const old = findPlugin(id)
  if (!old?.previous) throw new Error('没有可回退的版本')
  const pkg = validatePluginPackage(old.previous)
  const record: InstalledPlugin = { ...plainPackage(pkg), enabled: old.enabled, grants: old.grants.filter(permission => pkg.manifest.permissions.includes(permission)), installedAt: old.installedAt, updatedAt: Date.now(), previous: plainPackage(old) }
  await store.setItem(id, record)
  state.plugins.splice(state.plugins.indexOf(old), 1, record)
})
// 数据按插件 ID 单独保存；卸载保留数据，重新安装可继续使用。
export const uninstallPlugin = (id: string) => serialize(async () => {
  await store.removeItem(id)
  const index = state.plugins.findIndex(plugin => plugin.manifest.id === id)
  if (index >= 0) state.plugins.splice(index, 1)
})
export const getPluginData = async (id: string, key: string) => {
  const data = await dataStore.getItem<Record<string, unknown>>(id)
  return data && Object.hasOwn(data, key) ? data[key] : null
}
export const setPluginData = (id: string, key: string, value: unknown) => serialize(async () => {
  if (!findPlugin(id)?.enabled) throw new Error('插件已停用或卸载')
  if (!key || key.length > 120 || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('存储键无效')
  const data = { ...await dataStore.getItem<Record<string, unknown>>(id) }
  if (value === undefined) delete data[key]
  else data[key] = value
  const json = JSON.stringify(data)
  if (new TextEncoder().encode(json).byteLength > 1024 * 1024) throw new Error('单个插件数据不能超过 1 MB')
  await dataStore.setItem(id, JSON.parse(json))
})
export const clearPluginData = (id: string) => serialize(() => dataStore.removeItem(id))
