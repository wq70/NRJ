import JSZip from 'jszip'
import { PLUGIN_PERMISSIONS, type PluginManifest, type PluginPackage } from '../types/plugins'

export const PLUGIN_LIMITS = { archive: 10 * 1024 * 1024, expanded: 12 * 1024 * 1024, file: 2 * 1024 * 1024, count: 128 }
const mimeTypes: Record<string, string> = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', json: 'application/json', txt: 'text/plain',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  woff: 'font/woff', woff2: 'font/woff2', mp3: 'audio/mpeg', wav: 'audio/wav'
}
export const validPluginPath = (path: string) => /^[a-zA-Z0-9_./-]+$/.test(path) && !path.startsWith('/') && !path.split('/').some(part => !part || part === '.' || part === '..')
const textField = (value: unknown, name: string, max: number) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`插件${name}无效`)
  return value.trim()
}
export const validatePluginManifest = (value: unknown): PluginManifest => {
  if (!value || typeof value !== 'object') throw new Error('缺少插件说明 manifest.json')
  const raw = value as Record<string, unknown>
  if (raw.format !== 'nrj-plugin' || raw.apiVersion !== 1) throw new Error('插件格式或接口版本不支持，请使用 nrj-plugin / apiVersion 1')
  const id = textField(raw.id, 'ID', 80)
  if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/.test(id)) throw new Error('插件 ID 只能使用小写字母、数字、点和连字符，且以字母开头')
  const entry = textField(raw.entry, '入口', 160)
  if (!validPluginPath(entry) || !entry.endsWith('.html')) throw new Error('插件入口必须是包内 HTML 文件')
  if (typeof raw.app !== 'boolean') throw new Error('插件 app 字段必须为 true 或 false')
  if (!Array.isArray(raw.extensions) || raw.extensions.length > 1) throw new Error('extensions 必须为数组，当前支持一个聊天扩展入口')
  const extensions = raw.extensions.map(item => {
    if (!item || item.target !== 'chat') throw new Error('当前支持 chat 扩展；其他 APP 尚未开放接口')
    return { target: 'chat' as const, label: textField(item.label, '扩展名称', 24) }
  })
  if (!raw.app && !extensions.length) throw new Error('插件至少需要一个独立 APP 或聊天扩展入口')
  if (!Array.isArray(raw.permissions) || raw.permissions.some(item => !PLUGIN_PERMISSIONS.includes(item))) throw new Error('插件声明了不支持的权限')
  const icon = raw.icon === undefined ? undefined : textField(raw.icon, '图标路径', 160)
  if (icon && (!validPluginPath(icon) || !/\.(png|jpe?g|gif|webp)$/.test(icon))) throw new Error('图标请使用包内 PNG、JPG、GIF 或 WebP 图片')
  return {
    format: 'nrj-plugin', apiVersion: 1, id, name: textField(raw.name, '名称', 40), version: textField(raw.version, '版本', 32),
    description: typeof raw.description === 'string' ? raw.description.slice(0, 400) : '', entry, icon, app: raw.app,
    extensions, permissions: [...new Set(raw.permissions)]
  }
}
export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 16384) binary += String.fromCharCode(...bytes.subarray(offset, offset + 16384))
  return btoa(binary)
}
export const decodePluginText = (base64: string) => new TextDecoder().decode(Uint8Array.from(atob(base64), c => c.charCodeAt(0)))
export const pluginFileUrl = (file: { mime: string; base64: string }) => `data:${file.mime};base64,${file.base64}`

export const validatePluginPackage = (value: unknown): PluginPackage => {
  const raw = value as Partial<PluginPackage> | null
  const manifest = validatePluginManifest(raw?.manifest)
  if (!raw?.files || typeof raw.files !== 'object' || Array.isArray(raw.files)) throw new Error('插件缺少文件')
  const files: PluginPackage['files'] = Object.create(null)
  let size = 0
  const entries = Object.entries(raw.files)
  if (entries.length > PLUGIN_LIMITS.count) throw new Error('插件文件过多')
  for (const [path, file] of entries) {
    const mime = mimeTypes[path.split('.').pop() || '']
    if (!validPluginPath(path) || !mime || !file || file.mime !== mime || typeof file.base64 !== 'string' || file.base64.length > PLUGIN_LIMITS.file * 1.34) throw new Error(`不支持的插件文件：${path}`)
    let length: number
    try { length = atob(file.base64).length } catch { throw new Error(`插件文件损坏：${path}`) }
    size += length
    if (length > PLUGIN_LIMITS.file || size > PLUGIN_LIMITS.expanded) throw new Error('插件解压后的大小超过限制')
    files[path] = { mime, base64: file.base64 }
  }
  if (!files[manifest.entry] || (manifest.icon && !files[manifest.icon])) throw new Error('插件入口或图标文件不存在')
  return { manifest, files }
}

export const readPluginPackage = async (input: Blob | ArrayBuffer): Promise<PluginPackage> => {
  const size = input instanceof ArrayBuffer ? input.byteLength : input.size
  if (size > PLUGIN_LIMITS.archive) throw new Error('插件包不能超过 10 MB')
  const zip = await JSZip.loadAsync(input instanceof ArrayBuffer ? input : await input.arrayBuffer())
  const entries = Object.values(zip.files).filter(file => !file.dir)
  if (entries.length > PLUGIN_LIMITS.count) throw new Error('插件文件不能超过 128 个')
  const files: PluginPackage['files'] = Object.create(null)
  let expanded = 0
  for (const file of entries) {
    const original = (file as typeof file & { unsafeOriginalName?: string }).unsafeOriginalName || file.name
    if (!validPluginPath(original) || original !== file.name) throw new Error('插件包含不合法的文件路径')
    const declaredSize = (file as typeof file & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0
    if (declaredSize > PLUGIN_LIMITS.file || expanded + declaredSize > PLUGIN_LIMITS.expanded) throw new Error('插件解压后的大小超过限制')
    const mime = mimeTypes[file.name.split('.').pop() || '']
    if (!mime) throw new Error(`不支持的插件文件：${file.name}`)
    const bytes = await file.async('uint8array')
    expanded += bytes.byteLength
    if (bytes.byteLength > PLUGIN_LIMITS.file || expanded > PLUGIN_LIMITS.expanded) throw new Error('插件解压后的大小超过限制')
    files[file.name] = { mime, base64: bytesToBase64(bytes) }
  }
  if (!files['manifest.json']) throw new Error('请将 manifest.json 放在 ZIP 根目录')
  let manifest: unknown
  try { manifest = JSON.parse(decodePluginText(files['manifest.json'].base64)) } catch { throw new Error('manifest.json 不是有效的 JSON') }
  return validatePluginPackage({ manifest, files })
}
export const exportPluginPackage = async (pkg: PluginPackage) => {
  const zip = new JSZip()
  for (const [path, file] of Object.entries(pkg.files)) if (path !== 'manifest.json') zip.file(path, file.base64, { base64: true })
  zip.file('manifest.json', JSON.stringify(pkg.manifest, null, 2))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
