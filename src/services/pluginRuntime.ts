import type { InstalledPlugin, PluginChatContext, PluginPackage, PluginPermission } from '../types/plugins'
import { bytesToBase64, decodePluginText, pluginFileUrl } from './pluginPackage'

export const PLUGIN_CHANNEL = 'nrj-plugin-v1'
export const pluginMethodPermission: Record<string, PluginPermission | undefined> = {
  'storage.get': undefined, 'storage.set': undefined, 'storage.remove': undefined,
  'chat.getMessages': 'chat.read', 'chat.insertText': 'chat.draft', 'files.download': 'files.download', 'ready': undefined
}
export const assertPluginMethod = (plugin: InstalledPlugin | undefined, method: string, inChat: boolean) => {
  if (!plugin?.enabled) throw new Error('插件已停用或卸载，请返回插件管理')
  if (!Object.hasOwn(pluginMethodPermission, method)) throw new Error('不支持的插件接口')
  const permission = pluginMethodPermission[method]
  if (permission && !plugin.grants.includes(permission)) throw new Error('该权限尚未开启，请到插件管理中设置')
  if (method.startsWith('chat.') && (!inChat || !plugin.manifest.extensions.length)) throw new Error('请从当前聊天的插件入口使用此功能')
}
export const pluginChatMessages = (chat: PluginChatContext, offset = 0, limit = 200) => {
  const start = Math.max(0, Math.floor(Number(offset) || 0))
  const count = Math.max(1, Math.min(200, Math.floor(Number(limit) || 200)))
  const messages = chat.messages || []
  return {
    chatId: String(chat.id ?? ''), name: String(chat.name || ''), total: messages.length, offset: start, hasMore: start + count < messages.length,
    messages: messages.slice(start, start + count).map(message => ({
      id: String(message.id ?? ''), sender: String(message.sender || message.role || (message.type === 'right' ? 'user' : message.type === 'left' ? 'character' : 'system')), type: String(message.messageType || (['left', 'right'].includes(message.type || '') ? 'text' : message.type) || 'text'),
      text: ['text', 'left', 'right', undefined].includes(message.messageType || message.type) ? String(message.content || message.text || '').slice(0, 20000) : `[${message.messageType || message.type || '消息'}]`, time: String(message.time ?? message.timestamp ?? '')
    }))
  }
}

const resolveAsset = (pkg: PluginPackage, path: string, from: string) => {
  const url = new URL(path, `https://plugin.invalid/${from}`)
  if (url.origin !== 'https://plugin.invalid' || url.search || url.hash) throw new Error(`请使用包内资源：${path}`)
  const name = decodeURIComponent(url.pathname.slice(1))
  const file = pkg.files[name]
  if (!file) throw new Error(`插件缺少资源：${name}`)
  return { name, file }
}
const rewriteCss = (pkg: PluginPackage, css: string, from: string) => {
  if (/@import\b/i.test(css)) throw new Error('请合并 CSS，插件不支持 @import')
  return css.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi, (_match, _quote, path: string) => {
    if (path.startsWith('data:') || path.startsWith('#')) return `url("${path}")`
    return `url("${pluginFileUrl(resolveAsset(pkg, path, from).file)}")`
  })
}
export const createPluginSdkSource = (session: string) => `
(() => {
  const session = ${JSON.stringify(session)}, channel = ${JSON.stringify(PLUGIN_CHANNEL)};
  let sequence = 0;
  const pending = new Map();
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('请求超时，请重试或返回插件管理')); }, 60000);
    pending.set(id, { resolve, reject, timer });
    try { parent.postMessage({ channel, session, id, method, params }, '*'); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
  });
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.channel !== channel || event.data?.session !== session) return;
    const item = pending.get(event.data.id);
    if (!item) return;
    pending.delete(event.data.id); clearTimeout(item.timer);
    event.data.error ? item.reject(new Error(event.data.error)) : item.resolve(event.data.result);
  });
  window.nrj = Object.freeze({
    storage: Object.freeze({ get: key => call('storage.get', { key }), set: (key, value) => call('storage.set', { key, value }), remove: key => call('storage.remove', { key }) }),
    chat: Object.freeze({ getMessages: (options = {}) => call('chat.getMessages', options), insertText: text => call('chat.insertText', { text }) }),
    files: Object.freeze({ download: (name, text, type = 'text/plain') => call('files.download', { name, text, type }) })
  });
  addEventListener('DOMContentLoaded', () => call('ready').catch(() => {}), { once: true });
  const showError = message => parent.postMessage({ channel, session, runtimeError: String(message).slice(0, 300) }, '*');
  addEventListener('error', event => showError(event.message || '插件脚本加载失败'));
  addEventListener('unhandledrejection', event => showError(event.reason?.message || event.reason || '插件执行失败'));
})();`

// 仅在带 allow-scripts 的独立沙箱中加载。主程序只通过经过校验的接口提供能力。
export const buildPluginDocument = (pkg: PluginPackage, session: string, theme: { background: string; text: string; font: string }) => {
  const doc = new DOMParser().parseFromString(decodePluginText(pkg.files[pkg.manifest.entry].base64), 'text/html')
  doc.querySelectorAll('base, meta, iframe, frame, object, embed').forEach(element => element.remove())
  doc.querySelectorAll('[srcset]').forEach(element => element.removeAttribute('srcset'))
  for (const element of doc.querySelectorAll('link')) {
    if (element.rel !== 'stylesheet') { element.remove(); continue }
    const { name, file } = resolveAsset(pkg, element.getAttribute('href') || '', pkg.manifest.entry)
    if (file.mime !== 'text/css') throw new Error('样式资源必须为 CSS 文件')
    const style = doc.createElement('style')
    style.textContent = rewriteCss(pkg, decodePluginText(file.base64), name)
    element.replaceWith(style)
  }
  for (const style of doc.querySelectorAll('style')) style.textContent = rewriteCss(pkg, style.textContent || '', pkg.manifest.entry)
  for (const element of doc.querySelectorAll('[style]')) element.setAttribute('style', rewriteCss(pkg, element.getAttribute('style') || '', pkg.manifest.entry))
  for (const element of doc.querySelectorAll('[src], [poster]')) {
    for (const attr of ['src', 'poster']) {
      const path = element.getAttribute(attr)
      if (!path || path.startsWith('data:')) continue
      const { file } = resolveAsset(pkg, path, pkg.manifest.entry)
      if (element.tagName === 'SCRIPT' && file.mime !== 'text/javascript') throw new Error('脚本资源必须为 JS 文件')
      element.setAttribute(attr, pluginFileUrl(file))
    }
  }
  const policy = doc.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline'; img-src data:; media-src data:; font-src data:; connect-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"
  const viewport = doc.createElement('meta')
  viewport.name = 'viewport'; viewport.content = 'width=device-width,initial-scale=1'
  const themeStyle = doc.createElement('style')
  themeStyle.textContent = `:root{--nrj-background:${theme.background};--nrj-text:${theme.text}}body{margin:0;padding:16px;box-sizing:border-box;background:var(--nrj-background);color:var(--nrj-text);font-family:${theme.font};font-size:13px}*,*::before,*::after{box-sizing:border-box}button,input,textarea,select{font:inherit;color:inherit}button{border:1px solid currentColor;border-radius:10px;padding:8px 12px;background:transparent}input,textarea,select{max-width:100%;border:1px solid currentColor;border-radius:10px;padding:9px;background:transparent}img{max-width:100%}`
  const sdk = doc.createElement('script')
  sdk.src = `data:text/javascript;base64,${bytesToBase64(new TextEncoder().encode(createPluginSdkSource(session)))}`
  doc.head.prepend(policy, viewport, themeStyle, sdk)
  return `<!doctype html>${doc.documentElement.outerHTML}`
}
