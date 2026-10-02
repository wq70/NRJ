<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { findPlugin, getPluginData, setPluginData } from '../../services/pluginRepository'
import { assertPluginMethod, buildPluginDocument, PLUGIN_CHANNEL, pluginChatMessages } from '../../services/pluginRuntime'
import { prepareWebFile, downloadWebFile, releasePreparedWebFile, shareWebFile, preferredWebFileAction, webDownloadSubmittedMessage, type PreparedWebFile } from '../../services/webFileSave'
import type { PluginChatContext } from '../../types/plugins'

const props = defineProps<{ pluginId: string; chat?: PluginChatContext }>()
const emit = defineEmits<{ close: []; 'insert-text': [text: string]; manage: [] }>()
const plugin = computed(() => findPlugin(props.pluginId))
const frame = ref<HTMLIFrameElement | null>(null)
const documentSource = ref('')
const error = ref('')
const ready = ref(false)
const notice = ref('')
const session = ref('')
const download = ref<{ name: string; text: string; type: string; resolve: (result: unknown) => void; reject: (error: Error) => void } | null>(null)
let readyTimer: ReturnType<typeof setTimeout> | undefined
let downloadTimer: ReturnType<typeof setTimeout> | undefined
let requestCount = 0
let requestWindow = 0
let activeRequests = 0
const executing = new Set<string>()

const launch = () => {
  if (readyTimer) clearTimeout(readyTimer)
  if (downloadTimer) clearTimeout(downloadTimer)
  download.value?.reject(new Error('插件已重新加载')); download.value = null
  session.value = Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join(''); ready.value = false; error.value = ''; notice.value = ''; documentSource.value = ''
  if (!plugin.value?.enabled) { error.value = '插件已停用或卸载，可返回插件管理。'; return }
  try {
    const style = getComputedStyle(document.documentElement)
    documentSource.value = buildPluginDocument(plugin.value, session.value, { background: style.getPropertyValue('--sys-bg-primary').trim() || '#fff', text: style.getPropertyValue('--text-primary').trim() || '#333', font: style.fontFamily || 'sans-serif' })
    readyTimer = setTimeout(() => { if (!ready.value) error.value = '插件加载超时，请重试或检查插件入口文件。' }, 15000)
  } catch (failure) { error.value = failure instanceof Error ? failure.message : '插件加载失败' }
}
watch(() => [plugin.value?.updatedAt, plugin.value?.enabled, plugin.value?.grants.join(','), props.pluginId, props.chat?.id], launch, { immediate: true, flush: 'post' })
const execute = async (method: string, params: Record<string, unknown>) => {
  assertPluginMethod(plugin.value, method, Boolean(props.chat))
  if (method === 'ready') { ready.value = true; if (readyTimer) clearTimeout(readyTimer); return true }
  if (method.startsWith('storage.')) {
    if (typeof params.key !== 'string' || !params.key || params.key.length > 120) throw new Error('存储键无效')
    if (method === 'storage.get') return getPluginData(props.pluginId, params.key)
    return setPluginData(props.pluginId, params.key, method === 'storage.remove' ? undefined : params.value)
  }
  if (method === 'chat.getMessages') return pluginChatMessages(props.chat!, Number(params.offset), Number(params.limit))
  if (method === 'chat.insertText') {
    if (typeof params.text !== 'string' || !params.text.trim() || params.text.length > 20000) throw new Error('添加的文字不能为空，且不能超过 20000 字符')
    emit('insert-text', params.text); notice.value = '已添加到聊天输入框，关闭插件后可查看并发送。'; return true
  }
  if (method === 'files.download') {
    if (download.value) throw new Error('请先处理当前文件导出')
    if (typeof params.name !== 'string' || !params.name.trim() || params.name.length > 120 || /[/\\\x00-\x1f]/.test(params.name)) throw new Error('文件名无效')
    if (typeof params.text !== 'string' || new TextEncoder().encode(params.text).byteLength > 2 * 1024 * 1024) throw new Error('文件内容必须为文字且不能超过 2 MB')
    if (!['text/plain', 'application/json', 'text/csv', 'text/markdown'].includes(String(params.type))) throw new Error('不支持的导出文件类型')
    return new Promise((resolve, reject) => {
      download.value = { name: params.name as string, text: params.text as string, type: params.type as string, resolve, reject }
      downloadTimer = setTimeout(() => { if (download.value?.reject === reject) { reject(new Error('导出确认已超时，请重新操作')); download.value = null; notice.value = '导出确认已超时，可重新导出。' } }, 55000)
    })
  }
}
const onMessage = async (event: MessageEvent) => {
  const data = event.data
  if (event.source !== frame.value?.contentWindow || event.origin !== 'null' || !data || data.channel !== PLUGIN_CHANNEL || data.session !== session.value) return
  if (data.runtimeError) { error.value = String(data.runtimeError).slice(0, 300); return }
  const requestKey = `${session.value}:${data.id}`
  if (!Number.isSafeInteger(data.id) || data.id < 1 || executing.has(requestKey) || typeof data.method !== 'string' || !data.params || typeof data.params !== 'object' || Array.isArray(data.params)) return
  const target = frame.value!.contentWindow!, currentSession = session.value
  const reply = (result?: unknown, failure?: string) => { if (currentSession === session.value) target.postMessage({ channel: PLUGIN_CHANNEL, session: currentSession, id: data.id, result, error: failure }, '*') }
  try {
    if (JSON.stringify(data.params).length > 3 * 1024 * 1024) throw new Error('插件请求过大')
    if (Date.now() - requestWindow > 1000) { requestWindow = Date.now(); requestCount = 0 }
    if (++requestCount > 40 || activeRequests >= 8) throw new Error('请求过于频繁，请稍后重试')
  } catch (failure) { reply(undefined, failure instanceof Error ? failure.message : '插件请求无效'); return }
  activeRequests++; executing.add(requestKey)
  try { reply(await execute(data.method, data.params)) }
  catch (failure) { reply(undefined, failure instanceof Error ? failure.message : '插件请求失败') }
  finally { activeRequests--; executing.delete(requestKey) }
}
window.addEventListener('message', onMessage)
const cancelDownload = () => { if (downloadTimer) clearTimeout(downloadTimer); download.value?.reject(new Error('已取消导出')); download.value = null }
const saveDownload = async () => {
  const pending = download.value
  if (!pending) return
  if (downloadTimer) clearTimeout(downloadTimer)
  download.value = null
  let prepared: PreparedWebFile | null = null
  try {
    prepared = prepareWebFile(pending.text, pending.name, pending.type)
    assertPluginMethod(plugin.value, 'files.download', Boolean(props.chat))
    if (preferredWebFileAction(prepared.file) === 'share') {
      const result = await shareWebFile(prepared.file, pending.name)
      if (result === 'cancelled') { pending.reject(new Error('已取消导出')); return }
      notice.value = '文件已分享或保存。'
    } else { downloadWebFile(prepared); notice.value = webDownloadSubmittedMessage() }
    pending.resolve(true)
  } catch (failure) { pending.reject(failure instanceof Error ? failure : new Error('文件导出失败')) }
  finally { releasePreparedWebFile(prepared) }
}
onBeforeUnmount(() => { if (readyTimer) clearTimeout(readyTimer); cancelDownload(); window.removeEventListener('message', onMessage) })
</script>

<template>
  <section class="plugin-runner" role="dialog" aria-modal="true" :aria-label="plugin?.manifest.name || '插件'">
    <header class="plugin-runner-header">
      <button type="button" @click="emit('close')">返回</button>
      <div><strong>{{ plugin?.manifest.name || '插件不可用' }}</strong><small>{{ chat ? '聊天扩展' : '插件 APP' }}</small></div>
      <button type="button" @click="launch">重载</button>
    </header>
    <div v-if="error" class="plugin-runner-status" role="alert"><p>{{ error }}</p><button type="button" @click="launch">重试</button><button type="button" @click="emit('manage')">插件管理</button></div>
    <p v-else-if="!ready" class="plugin-loading" role="status">正在加载插件…</p>
    <p v-if="notice" class="plugin-loading" role="status">{{ notice }}</p>
    <iframe v-if="documentSource" :key="session" ref="frame" :srcdoc="documentSource" sandbox="allow-scripts" referrerpolicy="no-referrer" :title="plugin?.manifest.name" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'" />
    <div v-if="download" class="plugin-dialog-layer" role="alertdialog" aria-modal="true" aria-label="导出插件文件">
      <section class="plugin-dialog"><h3>导出文件</h3><p>{{ plugin?.manifest.name }} 请求保存“{{ download.name }}”。</p><div class="plugin-actions"><button type="button" @click="cancelDownload">取消</button><button type="button" class="primary" @click="saveDownload">保存文件</button></div></section>
    </div>
  </section>
</template>

<style scoped>
.plugin-runner{position:fixed;inset:0;z-index:3200;display:flex;flex-direction:column;min-width:0;min-height:0;background:var(--sys-bg-primary);color:var(--text-primary);padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}
.plugin-runner-header{display:grid;grid-template-columns:48px minmax(0,1fr) 48px;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border-color)}
.plugin-runner-header div{text-align:center;min-width:0}.plugin-runner-header strong{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:600}.plugin-runner-header small{display:block;font-size:10px;color:var(--text-secondary);margin-top:3px}
button{font:inherit;font-size:12px;color:inherit;border:1px solid var(--border-color);border-radius:10px;padding:8px;background:var(--card-bg-solid)}
iframe{width:100%;flex:1;min-height:0;border:0;background:var(--sys-bg-primary)}.plugin-loading{margin:0;padding:8px 14px;font-size:11px;color:var(--text-secondary);line-height:1.5;overflow-wrap:anywhere}
.plugin-runner-status{padding:12px 14px;font-size:12px;overflow-wrap:anywhere}.plugin-runner-status button+button{margin-left:8px}.plugin-dialog-layer{position:absolute;inset:0;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;padding:20px}.plugin-dialog{width:100%;max-width:340px;border:1px solid var(--border-color);background:var(--sys-bg-primary);border-radius:18px;padding:18px;overflow-wrap:anywhere}.plugin-dialog h3{font-size:15px;margin:0 0 10px}.plugin-dialog p{font-size:12px;line-height:1.6}.plugin-actions{display:flex;gap:8px;justify-content:flex-end}.primary{background:var(--text-primary);color:var(--sys-bg-primary)}
</style>
