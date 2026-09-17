/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import JSZip from 'jszip'
import { parseBookFile } from './bookImportService'
import { saveWatchTogetherBlob } from './watchTogetherRepository'
import type { WatchTogetherChapter, WatchTogetherItem, WatchTogetherKind } from '../types/watchTogether'

const MAX_FILE_BYTES = 1024 * 1024 * 1024
const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 1800
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp'])
const videoExtensions = new Set(['mp4', 'm4v', 'mov', 'webm', 'ogv', 'mkv', 'avi', 'flv', 'wmv', 'ts', 'm2ts', 'mpeg', 'mpg'])
const audioExtensions = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'oga', 'opus', 'aiff', 'aif', 'alac', 'ape', 'wma', 'amr', 'ac3', 'm3u', 'm3u8'])
const novelExtensions = new Set(['txt', 'md', 'markdown', 'html', 'htm', 'json', 'fb2', 'epub', 'docx', 'pdf', 'mobi', 'azw', 'azw3'])
const archiveExtensions = new Set(['zip', 'cbz', 'rar', 'cbr', '7z', 'cb7', 'tar', 'cbt', 'gz', 'tgz', 'bz2', 'xz'])
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
const ext = (name: string) => name.split(/[?#]/)[0]!.split('.').pop()?.toLowerCase() || ''
const titleOf = (name: string) => decodeURIComponent(name.split(/[\\/]/).pop() || '未命名内容').replace(/\.[^.]+$/, '')
const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
const safePath = (name: string) => !name.startsWith('/') && !name.startsWith('\\') && !/(^|[\\/])\.\.([\\/]|$)/.test(name)

const baseItem = (kind: WatchTogetherKind, file: File): WatchTogetherItem => ({
  id: uid('watch_item'), kind, title: titleOf(file.name), subtitle: '', creator: '', description: '', cover: '',
  origin: 'local', sourceId: '', sourceName: '本地文件', sourceUrl: '', access: 'direct', mediaUrl: '',
  mimeType: file.type || '', fileName: file.name, size: file.size, chapters: [], tags: [ext(file.name).toUpperCase()].filter(Boolean),
  addedAt: Date.now(), updatedAt: Date.now()
})

const inferKind = (file: File, preferred?: WatchTogetherKind): WatchTogetherKind => {
  if (preferred) return preferred
  const extension = ext(file.name)
  if (videoExtensions.has(extension) || file.type.startsWith('video/')) return 'video'
  if (audioExtensions.has(extension) || file.type.startsWith('audio/')) return 'audio'
  if (extension === 'cbz' || extension === 'cbr' || extension === 'cb7' || imageExtensions.has(extension) || file.type.startsWith('image/')) return 'comic'
  return 'novel'
}

const storeMedia = async (file: File, kind: 'video' | 'audio') => {
  const item = baseItem(kind, file)
  const key = `media_${item.id}`
  await saveWatchTogetherBlob(key, file)
  item.mediaUrl = `blob-key:${key}`
  item.chapters = [{ id: uid('chapter'), title: kind === 'video' ? '正片' : '音轨 1', order: 1, blobKeys: [key] }]
  return item
}

const storeComicImages = async (title: string, files: File[], sourceName: string) => {
  const seed = files[0] || new File([], `${title}.cbz`)
  const item = baseItem('comic', seed)
  item.title = title
  item.fileName = sourceName
  item.size = files.reduce((sum, file) => sum + file.size, 0)
  const keys: string[] = []
  for (const file of files.sort((a, b) => naturalSort(a.name, b.name))) {
    const key = `comic_${item.id}_${keys.length}`
    await saveWatchTogetherBlob(key, file)
    keys.push(key)
  }
  item.chapters = [{ id: uid('chapter'), title: '图像正文', order: 1, blobKeys: keys }]
  return item
}

const parseArchive = async (file: File, preferred?: WatchTogetherKind) => {
  if (file.size > MAX_ARCHIVE_BYTES) throw new Error('压缩包超过 500MB，移动网页端无法安全解压')
  const files: File[] = []
  const extension = ext(file.name)
  if (extension === 'zip' || extension === 'cbz') {
    const zip = await JSZip.loadAsync(file)
    const entries = Object.values(zip.files).filter(entry => !entry.dir)
    if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error(`压缩包文件数超过 ${MAX_ARCHIVE_ENTRIES}`)
    let total = 0
    for (const entry of entries) {
      if (!safePath(entry.name)) throw new Error(`压缩包包含不安全路径：${entry.name}`)
      const blob = await entry.async('blob')
      total += blob.size
      if (total > MAX_ARCHIVE_BYTES) throw new Error('压缩包解压后超过 500MB')
      files.push(new File([blob], entry.name, { type: blob.type }))
    }
  } else {
    const { Archive } = await import('libarchive.js')
    Archive.init({ workerUrl: '/libarchive/worker-bundle.js' })
    const archive = await Archive.open(file)
    if (await archive.hasEncryptedData()) throw new Error('暂不支持加密压缩包')
    const entries = await archive.getFilesArray()
    if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error(`压缩包文件数超过 ${MAX_ARCHIVE_ENTRIES}`)
    let total = 0
    for (const entry of entries) {
      const name = `${entry.path || ''}${entry.file.name || ''}`
      if (!name || /[\\/]$/.test(name)) continue
      if (!safePath(name)) throw new Error(`压缩包包含不安全路径：${name}`)
      const blob = await entry.file.extract()
      if (!blob) continue
      total += blob.size
      if (total > MAX_ARCHIVE_BYTES) throw new Error('压缩包解压后超过 500MB')
      files.push(new File([blob], name, { type: blob.type }))
    }
  }
  const images = files.filter(entry => imageExtensions.has(ext(entry.name)))
  if ((preferred === 'comic' || /^cb[rz7t]$/.test(extension) || images.length === files.length) && images.length) {
    return [await storeComicImages(titleOf(file.name), images, file.name)]
  }
  const usable = files.filter(entry => {
    const extension = ext(entry.name)
    if (preferred === 'video') return videoExtensions.has(extension)
    if (preferred === 'audio') return audioExtensions.has(extension)
    if (preferred === 'novel') return novelExtensions.has(extension)
    if (preferred === 'comic') return imageExtensions.has(extension) || extension === 'pdf'
    return novelExtensions.has(extension) || videoExtensions.has(extension) || audioExtensions.has(extension) || imageExtensions.has(extension)
  })
  const results: WatchTogetherItem[] = []
  for (const entry of usable) results.push(...await importWatchTogetherFile(entry, preferred, false))
  if (!results.length) throw new Error('压缩包中没有找到可读取或播放的内容')
  return results
}

export const importWatchTogetherFile = async (file: File, preferred?: WatchTogetherKind, allowArchive = true): Promise<WatchTogetherItem[]> => {
  if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} 超过 1GB，移动网页端不适合整文件导入`)
  if (allowArchive && archiveExtensions.has(ext(file.name))) return parseArchive(file, preferred)
  const kind = inferKind(file, preferred)
  if (kind === 'audio' && (ext(file.name) === 'm3u' || ext(file.name) === 'm3u8')) {
    const lines = (await file.text()).split(/\r?\n/).map(line => line.trim()).filter(Boolean)
    if (lines.some(line => line.startsWith('#EXT-X-'))) throw new Error('本地 HLS 清单无法关联分片，请添加原始 HTTPS 播放地址')
    const urls = lines.filter(line => /^https?:\/\//i.test(line))
    if (!urls.length) throw new Error('播放列表中没有可直接访问的 HTTP 音频地址')
    return urls.map((url, index) => {
      const item = baseItem('audio', file)
      item.id = uid('watch_item')
      item.title = urls.length > 1 ? `${titleOf(file.name)} ${index + 1}` : titleOf(file.name)
      item.origin = 'url'
      item.sourceName = '本地播放列表'
      item.sourceUrl = url
      item.mediaUrl = url
      item.mimeType = /\.m3u8(?:$|\?)/i.test(url) ? 'application/vnd.apple.mpegurl' : 'audio/mpeg'
      item.chapters = [{ id: uid('chapter'), title: `音轨 ${index + 1}`, order: 1 }]
      return item
    })
  }
  if (kind === 'video' || kind === 'audio') return [await storeMedia(file, kind)]
  if (kind === 'comic' && (imageExtensions.has(ext(file.name)) || file.type.startsWith('image/'))) return [await storeComicImages(titleOf(file.name), [file], file.name)]
  if (kind === 'comic' && ext(file.name) === 'pdf') {
    const item = baseItem('comic', file)
    const key = `comic_pdf_${item.id}`
    await saveWatchTogetherBlob(key, file)
    item.mediaUrl = `blob-key:${key}`
    item.chapters = [{ id: uid('chapter'), title: 'PDF 正文', order: 1, blobKeys: [key] }]
    return [item]
  }
  if (kind === 'comic' && ext(file.name) === 'epub') {
    const zip = await JSZip.loadAsync(file)
    const images: File[] = []
    for (const entry of Object.values(zip.files).filter(entry => !entry.dir && imageExtensions.has(ext(entry.name)))) {
      const blob = await entry.async('blob')
      images.push(new File([blob], entry.name, { type: blob.type }))
    }
    if (!images.length) throw new Error('这个 EPUB 中没有可作为漫画页读取的图片')
    return [await storeComicImages(titleOf(file.name), images, file.name)]
  }
  const candidates = await parseBookFile(file)
  return candidates.map(candidate => {
    const book = candidate.book
    const item = baseItem('novel', file)
    item.title = book.title
    item.creator = book.author
    item.description = book.summary
    item.cover = book.cover
    item.tags = book.tags
    item.chapters = book.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, order: chapter.order, text: chapter.content, blobKeys: undefined } satisfies WatchTogetherChapter))
    return item
  })
}

export const importWatchTogetherFiles = async (files: File[], preferred?: WatchTogetherKind) => {
  const items: WatchTogetherItem[] = []
  const errors: string[] = []
  for (const file of files) {
    try { items.push(...await importWatchTogetherFile(file, preferred)) }
    catch (cause) { errors.push(`${file.name}：${cause instanceof Error ? cause.message : '导入失败'}`) }
  }
  return { items, errors }
}
