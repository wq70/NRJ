/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import JSZip from 'jszip'
import localforage from 'localforage'
import type { DeliveryDraftInput, DeliveryFileMeta, DeliveryItem, DeliveryKind, DeliverySettings } from '../types/delivery'

const itemStore = localforage.createInstance({ name: 'nrt-app', storeName: 'deliveryItems' })
const fileStore = localforage.createInstance({ name: 'nrt-app', storeName: 'deliveryFiles' })
const SETTINGS_KEY = 'clingy_delivery_settings_v1'
const PACKAGE_FORMAT = 'nrj-delivery'
const QR_PREFIX = 'nrjdelivery:'
const MAX_FILE_BYTES = 80 * 1024 * 1024
const MAX_PACKAGE_BYTES = 200 * 1024 * 1024
const MAX_FILE_COUNT = 100
const QR_MAX_LENGTH = 2200

export const defaultDeliverySettings = (): DeliverySettings => ({
  receivingEnabled: false,
  receivingUntil: null,
  requireConfirmation: true,
  chatIntegration: {
    enabled: false,
    allowCharacterRead: false,
    allowMemory: false
  }
})

const makeId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
const safeName = (name: string) => String(name || '未命名文件').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').replace(/^\.+/, '').slice(0, 180) || '未命名文件'
const extensionOf = (name: string) => name.split(/[?#]/)[0]!.split('.').pop()?.toLowerCase() || ''
const isSafeUrl = (value: string) => {
  if (!value) return true
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

const inferKind = (files: File[], text: string, url: string): DeliveryKind => {
  if (files.length > 1) return 'mixed'
  const file = files[0]
  if (!file) return url ? 'link' : 'text'
  const ext = extensionOf(file.name)
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  if (['epub', 'pdf', 'mobi', 'azw', 'azw3', 'fb2', 'cbz'].includes(ext)) return 'book'
  if (['nrjbubble'].includes(ext)) return 'bubble'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive'
  if (ext === 'json' && /世界书|world\s*book/i.test(`${file.name} ${text}`)) return 'worldbook'
  return 'file'
}

const arrayBufferToBase64Url = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const base64UrlToBytes = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

const checksum = async (blob: Blob) => {
  if (!globalThis.crypto?.subtle || blob.size > 20 * 1024 * 1024) return undefined
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
  return [...digest].map(value => value.toString(16).padStart(2, '0')).join('')
}

export const loadDeliverySettings = (): DeliverySettings => {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    const defaults = defaultDeliverySettings()
    const merged = { ...defaults, ...raw, chatIntegration: { ...defaults.chatIntegration, ...(raw.chatIntegration || {}) } }
    if (merged.receivingUntil && merged.receivingUntil <= Date.now()) {
      merged.receivingEnabled = false
      merged.receivingUntil = null
    }
    return merged
  } catch { return defaultDeliverySettings() }
}

export const saveDeliverySettings = (value: DeliverySettings) => {
  const normalized: DeliverySettings = {
    ...defaultDeliverySettings(),
    ...value,
    receivingUntil: value.receivingEnabled ? value.receivingUntil : null,
    chatIntegration: {
      enabled: value.chatIntegration?.enabled === true,
      allowCharacterRead: value.chatIntegration?.enabled === true && value.chatIntegration?.allowCharacterRead === true,
      allowMemory: value.chatIntegration?.enabled === true && value.chatIntegration?.allowCharacterRead === true && value.chatIntegration?.allowMemory === true
    }
  }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized))
  return normalized
}

export const validateDeliveryFiles = (files: File[]) => {
  if (files.length > MAX_FILE_COUNT) throw new Error(`一次最多选择 ${MAX_FILE_COUNT} 个文件`)
  let total = 0
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} 超过 80MB，移动端无法安全处理`)
    total += file.size
  }
  if (total > MAX_PACKAGE_BYTES) throw new Error('所选内容合计超过 200MB，移动端无法安全处理')
  return total
}

export const createDelivery = async (input: DeliveryDraftInput): Promise<DeliveryItem> => {
  const files = [...(input.files || [])]
  validateDeliveryFiles(files)
  const url = String(input.url || '').trim()
  if (!isSafeUrl(url)) throw new Error('链接只支持 HTTP 或 HTTPS 地址')
  const text = String(input.text || '').trim().slice(0, 100_000)
  if (!files.length && !text && !url) throw new Error('请至少添加文字、链接或文件')
  const now = Date.now()
  const id = makeId('delivery')
  const metas: DeliveryFileMeta[] = []
  for (const file of files) {
    const fileId = makeId('file')
    const name = safeName(file.name)
    const stored = new File([file], name, { type: file.type || 'application/octet-stream', lastModified: file.lastModified || now })
    await fileStore.setItem(`${id}:${fileId}`, stored)
    metas.push({ id: fileId, name, mimeType: stored.type, size: stored.size, lastModified: stored.lastModified, checksum: await checksum(stored) })
  }
  const item: DeliveryItem = {
    id,
    schemaVersion: 1,
    title: String(input.title || '').trim().slice(0, 100) || files[0]?.name || (url ? new URL(url).hostname : text.slice(0, 28)) || '未命名投递',
    note: String(input.note || '').trim().slice(0, 2000),
    text,
    url,
    kind: inferKind(files, text, url),
    direction: input.direction || 'saved',
    source: input.source || 'local',
    files: metas,
    createdAt: now,
    updatedAt: now,
    ...(input.expiresAt && input.expiresAt > now ? { expiresAt: input.expiresAt } : {})
  }
  await itemStore.setItem(id, item)
  return item
}

export const listDeliveries = async () => {
  const items: DeliveryItem[] = []
  await itemStore.iterate<DeliveryItem, void>((value) => { if (value?.id) items.push(value) })
  return items.sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getDelivery = async (id: string) => itemStore.getItem<DeliveryItem>(id)

export const getDeliveryFiles = async (item: DeliveryItem) => {
  const files: File[] = []
  for (const meta of item.files) {
    const value = await fileStore.getItem<Blob>(`${item.id}:${meta.id}`)
    if (value) files.push(value instanceof File ? value : new File([value], meta.name, { type: meta.mimeType, lastModified: meta.lastModified }))
  }
  return files
}

export const updateDelivery = async (item: DeliveryItem, patch: Partial<DeliveryItem>) => {
  const updated = { ...item, ...patch, id: item.id, schemaVersion: 1 as const, updatedAt: Date.now() }
  await itemStore.setItem(item.id, updated)
  return updated
}

export const deleteDelivery = async (item: DeliveryItem) => {
  await Promise.all(item.files.map(file => fileStore.removeItem(`${item.id}:${file.id}`)))
  await itemStore.removeItem(item.id)
}

export const exportDeliveryPackage = async (item: DeliveryItem) => {
  const zip = new JSZip()
  zip.file('manifest.json', JSON.stringify({ format: PACKAGE_FORMAT, schemaVersion: 1, item }, null, 2))
  const folder = zip.folder('files')!
  const files = await getDeliveryFiles(item)
  files.forEach((file, index) => folder.file(`${item.files[index]!.id}-${safeName(file.name)}`, file))
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 5 } })
  return new File([blob], `${safeName(item.title)}.nrjdrop`, { type: 'application/vnd.nianrenji.delivery+zip' })
}

export const importDeliveryPackage = async (file: File): Promise<DeliveryItem> => {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error('投递包超过 200MB，移动端无法安全导入')
  const zip = await JSZip.loadAsync(file)
  const manifestFile = zip.file('manifest.json')
  if (!manifestFile) throw new Error('投递包缺少清单文件')
  const manifest = JSON.parse(await manifestFile.async('string'))
  if (manifest?.format !== PACKAGE_FORMAT || Number(manifest.schemaVersion) !== 1 || !manifest.item) throw new Error('不是有效的黏人精投递包')
  const source = manifest.item as DeliveryItem
  if (!Array.isArray(source.files) || source.files.length > MAX_FILE_COUNT) throw new Error('投递包文件清单异常')
  const files: File[] = []
  for (const meta of source.files) {
    const match = Object.values(zip.files).find(entry => !entry.dir && entry.name.startsWith(`files/${meta.id}-`))
    if (!match) throw new Error(`投递包缺少文件：${safeName(meta.name)}`)
    const blob = await match.async('blob')
    if (blob.size > MAX_FILE_BYTES) throw new Error(`${safeName(meta.name)} 超过安全上限`)
    if (meta.checksum && await checksum(blob) !== meta.checksum) throw new Error(`${safeName(meta.name)} 校验失败，文件可能已损坏`)
    files.push(new File([blob], safeName(meta.name), { type: String(meta.mimeType || blob.type), lastModified: Number(meta.lastModified || Date.now()) }))
  }
  return createDelivery({ title: source.title, note: source.note, text: source.text, url: source.url, files, direction: 'received', source: 'package', expiresAt: source.expiresAt })
}

export const createDeliveryQrPayload = (item: DeliveryItem) => {
  if (item.files.length) throw new Error('含文件的投递请使用投递包或系统分享，二维码只承载文字和链接')
  const payload = { v: 1, title: item.title, note: item.note, text: item.text, url: item.url, expiresAt: item.expiresAt }
  const encoded = QR_PREFIX + arrayBufferToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  if (encoded.length > QR_MAX_LENGTH) throw new Error('文字内容过长，请改用投递包分享')
  return encoded
}

export const decodeDeliveryQrPayload = (raw: string) => {
  const value = raw.trim()
  if (!value.startsWith(QR_PREFIX)) throw new Error('不是有效的投递口令')
  let payload: any
  try { payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(value.slice(QR_PREFIX.length)))) } catch { throw new Error('投递口令已损坏') }
  if (Number(payload?.v) !== 1) throw new Error('暂不支持这个投递口令版本')
  if (payload.expiresAt && Number(payload.expiresAt) <= Date.now()) throw new Error('这份投递已经过期')
  return payload as { v: 1; title?: string; note?: string; text?: string; url?: string; expiresAt?: number }
}

export const importDeliveryQrPayload = async (raw: string) => {
  const value = raw.trim()
  if (!value.startsWith(QR_PREFIX)) {
    if (/^https?:\/\//i.test(value)) return createDelivery({ url: value, direction: 'received', source: 'qr' })
    throw new Error('不是有效的投递口令')
  }
  const payload = decodeDeliveryQrPayload(value)
  return createDelivery({ title: payload.title, note: payload.note, text: payload.text, url: payload.url, direction: 'received', source: 'qr', expiresAt: payload.expiresAt })
}

export const deliveryKindLabel = (kind: DeliveryKind) => ({ text: '文字', link: '链接', image: '图片', video: '视频', audio: '音频', book: '书籍', bubble: '气泡方案', worldbook: '世界书', archive: '压缩包', file: '文件', mixed: '组合内容' })[kind]

export const formatDeliverySize = (size: number) => size >= 1024 ** 2 ? `${(size / 1024 ** 2).toFixed(size >= 10 * 1024 ** 2 ? 0 : 1)} MB` : size >= 1024 ? `${(size / 1024).toFixed(1)} KB` : `${size} B`

export const downloadDeliveryFile = (file: File) => {
  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const shareDelivery = async (item: DeliveryItem) => {
  const packageFile = await exportDeliveryPackage(item)
  const data: ShareData = { title: item.title, text: item.note || item.text.slice(0, 500), files: [packageFile] }
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
    try { await navigator.share(data); await updateDelivery(item, { direction: 'sent' }); return 'shared' as const } catch (error: any) { if (error?.name === 'AbortError') return 'cancelled' as const; throw error }
  }
  downloadDeliveryFile(packageFile)
  await updateDelivery(item, { direction: 'sent' })
  return 'downloaded' as const
}

export const deliveryStorage = { itemStore, fileStore }
