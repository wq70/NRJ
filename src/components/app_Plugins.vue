<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import PluginRunner from './plugins/PluginRunner.vue'
import { clearPluginData, configurePlugin, findPlugin, installPlugin, installedPlugins, loadPlugins, pluginIcon, pluginLoadState, rollbackPlugin, uninstallPlugin } from '../services/pluginRepository'
import { exportPluginPackage, readPluginPackage } from '../services/pluginPackage'
import { buildPluginDocument } from '../services/pluginRuntime'
import { createPluginExample } from '../services/pluginExamples'
import pluginGuide from '../../docs/插件开发说明.md?raw'
import { pluginPermissionLabels, type InstalledPlugin, type PluginPackage, type PluginPermission } from '../types/plugins'
import { downloadWebFile, prepareWebFile, preferredWebFileAction, releasePreparedWebFile, shareWebFile, webDownloadSubmittedMessage } from '../services/webFileSave'

const emit = defineEmits<{ close: [] }>()
const input = ref<HTMLInputElement | null>(null)
const pending = ref<PluginPackage | null>(null)
const permissionTarget = ref<InstalledPlugin | null>(null)
const grants = ref<PluginPermission[]>([])
const busy = ref(false)
const message = ref('')
const activePlugin = ref('')
const confirm = ref<{ id: string; action: 'uninstall' | 'clear' | 'rollback' } | null>(null)
const keepData = ref(true)
const query = ref('')
const displayedPlugins = computed(() => installedPlugins.value.filter(plugin => `${plugin.manifest.name} ${plugin.manifest.description}`.toLowerCase().includes(query.value.toLowerCase())))
const previousVersion = computed(() => pending.value ? findPlugin(pending.value.manifest.id)?.manifest.version : undefined)
const permissionManifest = computed(() => pending.value?.manifest || permissionTarget.value?.manifest)
const notifyFailure = (failure: unknown) => { message.value = failure instanceof Error ? failure.message : '操作失败，请重试' }
const run = async (work: () => Promise<void>) => {
  if (busy.value) return
  busy.value = true; message.value = ''
  try { await work() } catch (failure) { notifyFailure(failure) } finally { busy.value = false }
}
onMounted(() => { void run(loadPlugins) })
const chooseFile = () => { if (!busy.value) input.value?.click() }
const importFile = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]; target.value = ''
  if (!file) return
  void run(async () => {
    const pkg = await readPluginPackage(file)
    // 检查包内引用后再确认安装，失败的导入不覆盖已安装版本。
    buildPluginDocument(pkg, 'validation', { background: '#fff', text: '#333', font: 'sans-serif' })
    pending.value = pkg; permissionTarget.value = null
    grants.value = findPlugin(pkg.manifest.id)?.grants.filter(permission => pkg.manifest.permissions.includes(permission)) || []
  })
}
const toggleGrant = (permission: PluginPermission) => { grants.value = grants.value.includes(permission) ? grants.value.filter(item => item !== permission) : [...grants.value, permission] }
const closePermissions = () => { if (!busy.value) { pending.value = null; permissionTarget.value = null } }
const savePermissions = () => void run(async () => {
  if (pending.value) {
    const update = Boolean(findPlugin(pending.value.manifest.id))
    const record = await installPlugin(pending.value, grants.value)
    message.value = `${record.manifest.name}已${update ? '更新' : '安装'}${record.manifest.app ? '，可从桌面或这里打开' : '，请在聊天的＋菜单中打开'}。`
  } else if (permissionTarget.value) {
    const current = findPlugin(permissionTarget.value.manifest.id)
    if (!current) throw new Error('插件已卸载')
    await configurePlugin(current.manifest.id, current.enabled, grants.value); message.value = '权限已保存。'
  }
  pending.value = null; permissionTarget.value = null
})
const editPermissions = (plugin: InstalledPlugin) => { pending.value = null; permissionTarget.value = plugin; grants.value = [...plugin.grants] }
const toggleEnabled = (plugin: InstalledPlugin) => void run(async () => { await configurePlugin(plugin.manifest.id, !plugin.enabled, plugin.grants); message.value = plugin.enabled ? '插件已停用，数据已保留。' : '插件已启用。' })
const saveFile = async (blob: Blob, name: string, type = 'application/zip') => {
  const prepared = prepareWebFile(blob, name, type)
  try {
    if (preferredWebFileAction(prepared.file) === 'share') { message.value = await shareWebFile(prepared.file, name) === 'cancelled' ? '已取消保存。' : '文件已分享或保存。' }
    else { downloadWebFile(prepared); message.value = webDownloadSubmittedMessage() }
  } finally { releasePreparedWebFile(prepared) }
}
const exportPlugin = (plugin: PluginPackage) => void run(async () => { await saveFile(await exportPluginPackage(plugin), `${plugin.manifest.id}-${plugin.manifest.version}.zip`) })
const downloadExample = (kind: 'notes' | 'chat') => exportPlugin(createPluginExample(kind))
const downloadGuide = () => void run(() => saveFile(new Blob([pluginGuide], { type: 'text/markdown' }), '粘人精插件开发说明.md', 'text/markdown'))
const requestConfirm = (id: string, action: 'uninstall' | 'clear' | 'rollback') => { keepData.value = true; confirm.value = { id, action } }
const applyConfirm = () => void run(async () => {
  if (!confirm.value) return
  const { id, action } = confirm.value
  if (action === 'uninstall') {
    await uninstallPlugin(id)
    if (!keepData.value) await clearPluginData(id)
    message.value = keepData.value ? '插件已卸载。重新安装相同 ID 的插件可继续使用原数据。' : '插件已卸载，插件数据已清除。'
  } else if (action === 'clear') { await clearPluginData(id); message.value = '这个插件的数据已清除。' }
  else { await rollbackPlugin(id); message.value = '已恢复上一个插件版本，原数据已保留。' }
  confirm.value = null
})
</script>

<template>
  <div class="plugins-app">
    <header class="plugins-header"><button type="button" @click="emit('close')">返回</button><div><h1>插件</h1><small>自己加入 APP 和功能</small></div><button type="button" :disabled="busy" @click="chooseFile">导入</button></header>
    <input ref="input" type="file" accept=".zip,application/zip" hidden @change="importFile" />
    <main class="plugins-content">
      <p class="plugins-intro">导入插件 ZIP 包，新增桌面 APP，或在聊天的＋菜单中加入功能。</p>
      <p v-if="message || pluginLoadState.error" class="plugins-feedback" role="status">{{ message || pluginLoadState.error }}</p>
      <p v-if="busy" class="plugins-muted" role="status">正在处理，请稍候…</p>
      <input v-if="installedPlugins.length" v-model="query" class="plugins-search" placeholder="搜索已安装插件" aria-label="搜索已安装插件" />
      <section v-if="!installedPlugins.length && !busy" class="plugins-empty"><span>插</span><h2>还没有安装插件</h2><p>点击右上角“导入”，选择自己制作或别人分享的插件包。也可以先下载下面的示例，再导入体验。</p><button type="button" @click="chooseFile">导入插件包</button></section>
      <p v-else-if="!displayedPlugins.length && !busy" class="plugins-muted">没有找到匹配的插件。</p>
      <article v-for="plugin in displayedPlugins" :key="plugin.manifest.id" class="plugin-card">
        <div class="plugin-card-heading"><div class="plugin-icon"><img v-if="pluginIcon(plugin)" :src="pluginIcon(plugin)!" alt="" /><span v-else>插</span></div><div class="plugin-card-title"><h2>{{ plugin.manifest.name }}</h2><p>v{{ plugin.manifest.version }} · {{ plugin.manifest.app ? '独立 APP' : '' }}{{ plugin.manifest.app && plugin.manifest.extensions.length ? ' / ' : '' }}{{ plugin.manifest.extensions.length ? '聊天扩展' : '' }}</p></div><button type="button" class="plugin-toggle" :aria-pressed="plugin.enabled" :disabled="busy" @click="toggleEnabled(plugin)">{{ plugin.enabled ? '已启用' : '已停用' }}</button></div>
        <p v-if="plugin.manifest.description" class="plugin-description">{{ plugin.manifest.description }}</p>
        <div class="plugin-card-actions"><button v-if="plugin.manifest.app" type="button" :disabled="busy || !plugin.enabled" @click="activePlugin = plugin.manifest.id">打开 APP</button><button type="button" :disabled="busy" @click="editPermissions(plugin)">权限</button><button type="button" :disabled="busy" @click="exportPlugin(plugin)">导出插件</button><button v-if="plugin.previous" type="button" :disabled="busy" @click="requestConfirm(plugin.manifest.id, 'rollback')">版本回退</button><button type="button" :disabled="busy" @click="requestConfirm(plugin.manifest.id, 'clear')">清除数据</button><button type="button" :disabled="busy" @click="requestConfirm(plugin.manifest.id, 'uninstall')">卸载</button></div>
        <small v-if="plugin.manifest.extensions.length" class="plugins-muted">聊天扩展请从聊天＋菜单的“插件”页打开。</small>
      </article>
      <details class="plugins-guide"><summary>示例与制作说明</summary><p>插件可以只有独立 APP、只有聊天扩展，也可以两者都有。示例需下载后点击“导入”安装。</p><div class="plugin-card-actions"><button type="button" :disabled="busy" @click="downloadExample('notes')">下载随手记 APP</button><button type="button" :disabled="busy" @click="downloadExample('chat')">下载聊天扩展示例</button><button type="button" :disabled="busy" @click="downloadGuide">下载开发说明</button></div><p>ZIP 根目录放 manifest.json，入口使用 HTML，支持包内 JS、CSS、图片和字体。</p><p>插件可用自己的存储空间。读取聊天、添加草稿、导出文件需要你单独开启权限。当前支持离线插件，外部服务和其他 APP 的扩展接口尚未开放。</p><p>导入相同 ID 可更新插件，并保留数据与已授予的有效权限。新增权限默认关闭；更新后可回退一个版本。</p></details>
    </main>
    <div v-if="permissionManifest" class="plugins-dialog-layer" role="dialog" aria-modal="true" aria-labelledby="plugin-permission-title">
      <section class="plugins-dialog"><h2 id="plugin-permission-title">{{ pending ? (previousVersion ? '更新插件' : '安装插件') : '插件权限' }}</h2><h3>{{ permissionManifest.name }}</h3><p>{{ permissionManifest.description }}</p><p v-if="pending">{{ permissionManifest.id }} · {{ previousVersion ? `v${previousVersion} → ` : '' }}v{{ permissionManifest.version }}</p><p class="plugins-muted">仅安装你信任的插件。权限可以暂不开启，之后随时调整。</p><div v-for="permission in permissionManifest.permissions" :key="permission" class="plugin-permission"><button type="button" role="checkbox" :aria-checked="grants.includes(permission)" :class="{ checked: grants.includes(permission) }" :disabled="busy" @click="toggleGrant(permission)"><span>{{ grants.includes(permission) ? '✓' : '＋' }}</span>{{ pluginPermissionLabels[permission] }}</button></div><p v-if="!permissionManifest.permissions.length" class="plugins-muted">无需额外权限，只使用自己的插件存储。</p><p v-if="pending && previousVersion" class="plugins-muted">将替换此 ID 的插件代码，保留原数据、桌面位置和启用状态。</p><p v-if="message" class="plugins-feedback" role="alert">{{ message }}</p><div class="plugin-dialog-actions"><button type="button" :disabled="busy" @click="closePermissions">取消</button><button type="button" class="primary" :disabled="busy" @click="savePermissions">{{ pending ? (previousVersion ? '确认更新' : '安装插件') : '保存权限' }}</button></div></section>
    </div>
    <div v-if="confirm" class="plugins-dialog-layer" role="alertdialog" aria-modal="true" aria-labelledby="plugin-confirm-title"><section class="plugins-dialog"><h2 id="plugin-confirm-title">{{ confirm.action === 'uninstall' ? '卸载插件' : confirm.action === 'clear' ? '清除插件数据' : '回退插件版本' }}</h2><p>{{ findPlugin(confirm.id)?.manifest.name }}</p><p>{{ confirm.action === 'clear' ? '将清除此插件保存的数据，操作后无法恢复。其他 APP 的数据不会受影响。' : confirm.action === 'rollback' ? '恢复上一次更新前的代码。数据不变，旧版本未声明的权限会关闭。' : '移除桌面图标及聊天入口。你可以重新导入插件。' }}</p><button v-if="confirm.action === 'uninstall'" type="button" class="plugin-keep-data" role="checkbox" :aria-checked="keepData" :disabled="busy" @click="keepData = !keepData">{{ keepData ? '✓' : '＋' }} 保留插件数据</button><p v-if="message" class="plugins-feedback" role="alert">{{ message }}</p><div class="plugin-dialog-actions"><button type="button" :disabled="busy" @click="confirm = null">取消</button><button type="button" class="primary" :disabled="busy" @click="applyConfirm">确认</button></div></section></div>
    <PluginRunner v-if="activePlugin" :plugin-id="activePlugin" @close="activePlugin = ''" @manage="activePlugin = ''" />
  </div>
</template>

<style scoped src="./app_Plugins.css"></style>
