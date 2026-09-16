/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import JSZip from 'jszip'
import mammoth from 'mammoth'
import { countBookStoreWords } from './bookStoreEngine'
import type { BookStoreChapter, BookStoreImportFormat, BookStoreLibraryBook } from '../types/bookstore'

export interface BookImportCandidate {
  id: string
  sourcePath: string
  selected: boolean
  warning?: string
  book: Omit<BookStoreLibraryBook, 'id' | 'addedAt' | 'updatedAt'>
}

const MAX_SOURCE_BYTES = 300 * 1024 * 1024
const MAX_ENTRY_BYTES = 80 * 1024 * 1024
const MAX_ARCHIVE_ENTRIES = 1200
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const textExtensions = new Set(['txt', 'md', 'markdown', 'json', 'html', 'htm', 'fb2', 'epub', 'docx', 'pdf', 'mobi', 'azw', 'azw3'])
const archiveExtensions = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cbz'])
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'])
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const extensionOf = (name: string) => name.split(/[?#]/)[0]!.split('.').pop()?.toLowerCase() || ''
const baseName = (name: string) => decodeURIComponent(name.split(/[\\/]/).pop() || '未命名书籍').replace(/\.(txt|md|markdown|json|html?|fb2|epub|docx|pdf|mobi|azw3?|zip|rar|7z|tar|gz|tgz|bz2|xz|cbz)$/i, '')
const safePath = (name: string) => !name.startsWith('/') && !name.startsWith('\\') && !/(^|[\\/])\.\.([\\/]|$)/.test(name)

const htmlToText = (html: string) => {
  if (typeof DOMParser === 'undefined') return html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const document = new DOMParser().parseFromString(html, 'text/html')
  document.querySelectorAll('script,style,noscript,template').forEach(node => node.remove())
  document.querySelectorAll('br').forEach(node => node.replaceWith('\n'))
  document.querySelectorAll('p,div,section,article,h1,h2,h3,h4,h5,h6,li,blockquote').forEach(node => node.append('\n'))
  return (document.body.textContent || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

const chapterTitlePattern = /^(?:\s{0,3}#{1,4}\s+.+|\s*(?:第[0-9零一二三四五六七八九十百千万两〇]+[章节卷回部篇]|序章|楔子|引子|前言|后记|尾声|番外(?:[一二三四五六七八九十0-9]*)?)(?:[\s　:：·.-].*)?)\s*$/i

export const splitBookText = (text: string, fallbackTitle = '正文'): Array<{ title: string; content: string }> => {
  const normalized = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []
  const lines = normalized.split('\n')
  const markers = lines.map((line, index) => chapterTitlePattern.test(line.trim()) ? index : -1).filter(index => index >= 0)
  if (!markers.length || markers.length > 2000) return [{ title: fallbackTitle, content: normalized }]
  const result: Array<{ title: string; content: string }> = []
  if (markers[0]! > 0) {
    const preface = lines.slice(0, markers[0]).join('\n').trim()
    if (preface) result.push({ title: '序言', content: preface })
  }
  markers.forEach((start, position) => {
    const end = markers[position + 1] ?? lines.length
    const title = lines[start]!.replace(/^\s{0,3}#{1,4}\s*/, '').trim()
    const content = lines.slice(start + 1, end).join('\n').trim()
    if (content) result.push({ title: title || `第${position + 1}章`, content })
  })
  return result.length ? result : [{ title: fallbackTitle, content: normalized }]
}

const makeChapter = (title: string, content: string, order: number, images?: string[]): BookStoreChapter => {
  const timestamp = Date.now()
  return { id: id('chapter'), title: title || `第${order}章`, content, summary: content.slice(0, 180), status: 'published', order, wordCount: countBookStoreWords(content), createdAt: timestamp, updatedAt: timestamp, publishedAt: timestamp, ...(images?.length ? { images } : {}) }
}

const textBook = (input: { title: string; text: string; format: BookStoreImportFormat; fileName?: string; size?: number; author?: string; summary?: string; language?: string; sourceName?: string; sourceUrl?: string; origin?: 'local' | 'url' | 'online' }) => {
  const sections = splitBookText(input.text)
  return {
    title: input.title || '未命名书籍', author: input.author || '未知作者', summary: input.summary || '导入到本地书架的书籍', cover: '', coverColor: '#776b60', category: '本地阅读', tags: [input.format.toUpperCase()], language: input.language || '', format: input.format, origin: input.origin || 'local', sourceName: input.sourceName || (input.origin === 'url' ? '网络地址' : '本地文件'), sourceUrl: input.sourceUrl, fileName: input.fileName, size: input.size || new Blob([input.text]).size, chapters: sections.map((section, index) => makeChapter(section.title, section.content, index + 1))
  } satisfies Omit<BookStoreLibraryBook, 'id' | 'addedAt' | 'updatedAt'>
}

const toCandidate = (book: Omit<BookStoreLibraryBook, 'id' | 'addedAt' | 'updatedAt'>, sourcePath: string, warning?: string): BookImportCandidate => ({ id: id('import'), sourcePath, selected: true, warning, book })

const parseJsonBooks = (text: string, fileName: string, size: number): BookImportCandidate[] => {
  const raw = JSON.parse(text)
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.books) ? raw.books : [raw]
  return list.flatMap((item: any, index: number) => {
    if (typeof item === 'string') return [toCandidate(textBook({ title: list.length > 1 ? `${baseName(fileName)} ${index + 1}` : baseName(fileName), text: item, format: 'json', fileName, size }), fileName)]
    if (!item || typeof item !== 'object') return []
    const chapters = Array.isArray(item.chapters) ? item.chapters.map((chapter: any, chapterIndex: number) => makeChapter(String(chapter?.title || `第${chapterIndex + 1}章`), String(chapter?.content || chapter?.text || ''), chapterIndex + 1)).filter((chapter: BookStoreChapter) => chapter.content) : []
    const body = String(item.content || item.text || item.body || '')
    const book = textBook({ title: String(item.title || item.name || `${baseName(fileName)}${list.length > 1 ? ` ${index + 1}` : ''}`), text: body, format: 'json', fileName, size, author: String(item.author || item.authorName || '未知作者'), summary: String(item.summary || item.description || ''), language: String(item.language || '') })
    if (chapters.length) book.chapters = chapters
    return book.chapters.length ? [toCandidate(book, fileName)] : []
  })
}

const parseFb2 = (text: string, fileName: string, size: number) => {
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  if (xml.querySelector('parsererror')) throw new Error('FB2 文件结构无效')
  const title = xml.querySelector('description title-info book-title')?.textContent?.trim() || baseName(fileName)
  const first = xml.querySelector('description title-info author first-name')?.textContent?.trim() || ''
  const last = xml.querySelector('description title-info author last-name')?.textContent?.trim() || ''
  const sections = [...xml.querySelectorAll('body > section')]
  const chapters = sections.map((section, index) => makeChapter(section.querySelector(':scope > title')?.textContent?.trim() || `第${index + 1}章`, [...section.querySelectorAll('p')].map(node => node.textContent?.trim()).filter(Boolean).join('\n\n'), index + 1)).filter(chapter => chapter.content)
  const book = textBook({ title, text: '', format: 'fb2', fileName, size, author: `${first} ${last}`.trim() || '未知作者', summary: xml.querySelector('description title-info annotation')?.textContent?.trim() || '', language: xml.querySelector('description title-info lang')?.textContent?.trim() || '' })
  book.chapters = chapters
  return toCandidate(book, fileName)
}

const parseEpub = async (file: File) => {
  const zip = await JSZip.loadAsync(file)
  const container = await zip.file('META-INF/container.xml')?.async('text')
  if (!container) throw new Error('EPUB 缺少 container.xml')
  const containerXml = new DOMParser().parseFromString(container, 'application/xml')
  const opfPath = containerXml.querySelector('rootfile')?.getAttribute('full-path') || ''
  const opfText = await zip.file(opfPath)?.async('text')
  if (!opfText) throw new Error('EPUB 缺少内容清单')
  const opf = new DOMParser().parseFromString(opfText, 'application/xml')
  const directory = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : ''
  const manifest = new Map([...opf.querySelectorAll('manifest item')].map(item => [item.getAttribute('id') || '', item.getAttribute('href') || '']))
  const chapters: BookStoreChapter[] = []
  for (const item of [...opf.querySelectorAll('spine itemref')]) {
    const href = manifest.get(item.getAttribute('idref') || '')
    const chapterFile = href ? zip.file(`${directory}${href.split('#')[0]}`) : null
    if (!chapterFile) continue
    const html = await chapterFile.async('text')
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const title = parsed.querySelector('h1,h2,h3,title')?.textContent?.trim() || `第${chapters.length + 1}章`
    const content = htmlToText(html)
    if (content) chapters.push(makeChapter(title, content, chapters.length + 1))
  }
  const metadataText = (selector: string) => opf.querySelector(selector)?.textContent?.trim() || ''
  const book = textBook({ title: metadataText('metadata title, metadata dc\\:title') || baseName(file.name), text: '', format: 'epub', fileName: file.name, size: file.size, author: metadataText('metadata creator, metadata dc\\:creator') || '未知作者', summary: metadataText('metadata description, metadata dc\\:description'), language: metadataText('metadata language, metadata dc\\:language') })
  book.chapters = chapters
  if (!chapters.length) throw new Error('EPUB 中没有可读取的正文')
  return toCandidate(book, file.name)
}

const parseDocx = async (file: File) => {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
  return toCandidate(textBook({ title: baseName(file.name), text: result.value, format: 'docx', fileName: file.name, size: file.size }), file.name, result.messages.length ? '部分复杂排版已转换为连续正文' : undefined)
}

const parsePdf = async (file: File) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const chapters: BookStoreChapter[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map((item: any) => typeof item.str === 'string' ? item.str : '').join(' ').replace(/\s+/g, ' ').trim()
    chapters.push(makeChapter(`第 ${pageNumber} 页`, text || '（此页可能为扫描图片，暂未识别到文本）', pageNumber))
  }
  const metadata = await pdf.getMetadata().catch(() => null)
  const info = (metadata?.info || {}) as Record<string, unknown>
  const book = textBook({ title: String(info.Title || baseName(file.name)), text: '', format: 'pdf', fileName: file.name, size: file.size, author: String(info.Author || '未知作者'), summary: String(info.Subject || '') })
  book.chapters = chapters
  return toCandidate(book, file.name, chapters.some(chapter => chapter.content.startsWith('（此页')) ? '检测到无文本页面；扫描版 PDF 需要 OCR 后才能全文检索' : undefined)
}

const parseMobi = async (file: File, format: 'mobi' | 'azw3') => {
  const parser = await import('@lingo-reader/mobi-parser')
  const reader = format === 'azw3' ? await parser.initKf8File(file) : await parser.initMobiFile(file)
  try {
    const metadata = reader.getMetadata()
    const toc = reader.getToc().flatMap(item => [item, ...(item.children || [])])
    const chapters = reader.getSpine().map((spine, index) => {
      const loaded = reader.loadChapter(spine.id)
      const tocTitle = toc.find(item => reader.resolveHref(item.href)?.id === spine.id)?.label
      return loaded ? makeChapter(tocTitle || `第${index + 1}章`, htmlToText(loaded.html), index + 1) : null
    }).filter((chapter): chapter is BookStoreChapter => Boolean(chapter?.content))
    const book = textBook({ title: metadata.title || baseName(file.name), text: '', format, fileName: file.name, size: file.size, author: metadata.author?.join('、') || '未知作者', summary: htmlToText(metadata.description || ''), language: metadata.language })
    book.chapters = chapters
    if (!chapters.length) throw new Error(`${format.toUpperCase()} 中没有可读取的正文`)
    return toCandidate(book, file.name)
  } finally { reader.destroy() }
}

const dataUrl = (file: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file) })

const parseComic = async (title: string, files: Array<{ name: string; file: Blob }>, sourcePath: string, size: number) => {
  const images: string[] = []
  for (const item of files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
    if (item.file.size > MAX_IMAGE_BYTES) continue
    images.push(await dataUrl(item.file))
  }
  if (!images.length) throw new Error('压缩包中没有可读取的图片')
  const book = textBook({ title, text: '', format: 'cbz', fileName: sourcePath, size })
  book.category = '漫画'
  book.chapters = [makeChapter('图像正文', '', 1, images)]
  return toCandidate(book, sourcePath, files.length !== images.length ? '过大的图片已跳过' : undefined)
}

const parseArchiveEntries = async (archiveFile: File) => {
  if (archiveFile.size > MAX_SOURCE_BYTES) throw new Error('压缩包超过 300MB，为避免移动端内存耗尽已停止解析')
  const ext = extensionOf(archiveFile.name)
  const extracted: Array<{ name: string; file: File }> = []
  if (ext === 'zip' || ext === 'cbz') {
    const zip = await JSZip.loadAsync(archiveFile)
    const entries = Object.values(zip.files).filter(entry => !entry.dir)
    if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error(`压缩包包含 ${entries.length} 个文件，超过安全上限 ${MAX_ARCHIVE_ENTRIES}`)
    let total = 0
    for (const entry of entries) {
      if (!safePath(entry.name)) throw new Error(`压缩包包含不安全路径：${entry.name}`)
      const meta = (entry as any)._data || {}
      const size = Number(meta.uncompressedSize || 0)
      const compressed = Number(meta.compressedSize || 0)
      if (size > MAX_ENTRY_BYTES || (compressed > 0 && size / compressed > 250)) throw new Error(`压缩包条目异常：${entry.name}`)
      total += size
      if (total > MAX_SOURCE_BYTES) throw new Error('压缩包解压后超过 300MB 安全上限')
      const blob = await entry.async('blob')
      extracted.push({ name: entry.name, file: new File([blob], entry.name, { type: blob.type }) })
    }
  } else {
    const { Archive } = await import('libarchive.js')
    Archive.init({ workerUrl: '/libarchive/worker-bundle.js' })
    const archive = await Archive.open(archiveFile)
    if (await archive.hasEncryptedData()) throw new Error('压缩包已加密，请先在设备上解压后再导入')
    const listing = await archive.getFilesArray()
    if (listing.length > MAX_ARCHIVE_ENTRIES) throw new Error(`压缩包包含 ${listing.length} 个文件，超过安全上限 ${MAX_ARCHIVE_ENTRIES}`)
    let total = 0
    for (const entry of listing) {
      const name = `${entry.path || ''}${entry.file.name || ''}`
      if (!name || /[\\/]$/.test(name)) continue
      if (!safePath(name)) throw new Error(`压缩包包含不安全路径：${name}`)
      const file = await entry.file.extract()
      if (!file || file.size > MAX_ENTRY_BYTES) continue
      total += file.size
      if (total > MAX_SOURCE_BYTES) throw new Error('压缩包解压后超过 300MB 安全上限')
      extracted.push({ name, file: new File([file], name, { type: file.type }) })
    }
  }
  const images = extracted.filter(item => imageExtensions.has(extensionOf(item.name)))
  const readable = extracted.filter(item => textExtensions.has(extensionOf(item.name)))
  if ((ext === 'cbz' || (!readable.length && images.length)) && images.length) return [await parseComic(baseName(archiveFile.name), images, archiveFile.name, archiveFile.size)]
  const candidates: BookImportCandidate[] = []
  for (const item of readable) candidates.push(...await parseBookFile(item.file, item.name, false))
  if (!candidates.length) throw new Error('压缩包里没有找到支持的书籍或漫画图片')
  return candidates
}

export const parseBookFile = async (file: File, sourcePath = file.name, allowArchive = true): Promise<BookImportCandidate[]> => {
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`${file.name} 超过 300MB，移动网页端无法安全导入`)
  const ext = extensionOf(file.name)
  if (allowArchive && archiveExtensions.has(ext)) return parseArchiveEntries(file)
  if (ext === 'epub') return [await parseEpub(file)]
  if (ext === 'docx') return [await parseDocx(file)]
  if (ext === 'pdf') return [await parsePdf(file)]
  if (ext === 'mobi' || ext === 'azw' || ext === 'azw3') return [await parseMobi(file, ext === 'mobi' ? 'mobi' : 'azw3')]
  const text = await file.text()
  if (ext === 'json') return parseJsonBooks(text, sourcePath, file.size)
  if (ext === 'fb2') return [parseFb2(text, sourcePath, file.size)]
  if (ext === 'html' || ext === 'htm') return [toCandidate(textBook({ title: baseName(sourcePath), text: htmlToText(text), format: 'html', fileName: sourcePath, size: file.size }), sourcePath)]
  if (ext === 'md' || ext === 'markdown') return [toCandidate(textBook({ title: baseName(sourcePath), text, format: 'markdown', fileName: sourcePath, size: file.size }), sourcePath)]
  if (ext === 'txt' || !ext) return [toCandidate(textBook({ title: baseName(sourcePath), text, format: 'txt', fileName: sourcePath, size: file.size }), sourcePath)]
  throw new Error(`暂不识别 ${ext ? `.${ext}` : '此'} 文件`)
}

export const parseBookFiles = async (files: File[]) => {
  const candidates: BookImportCandidate[] = []
  const errors: string[] = []
  for (const file of files) {
    try { candidates.push(...await parseBookFile(file)) }
    catch (cause: any) { errors.push(`${file.name}：${String(cause?.message || '解析失败')}`) }
  }
  return { candidates, errors }
}

export const importBookFromUrl = async (url: string) => {
  const parsed = new URL(url)
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('只支持 HTTP 或 HTTPS 地址')
  const response = await fetch(parsed.toString(), { headers: { Accept: 'application/epub+zip,application/pdf,application/json,text/plain,text/markdown,text/html,*/*' } })
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`)
  const length = Number(response.headers.get('content-length') || 0)
  if (length > MAX_SOURCE_BYTES) throw new Error('文件超过 300MB，已停止下载')
  const blob = await response.blob()
  if (blob.size > MAX_SOURCE_BYTES) throw new Error('文件超过 300MB，已停止解析')
  const disposition = response.headers.get('content-disposition') || ''
  const dispositionName = disposition.match(/filename\*?=(?:UTF-8''|\")?([^";]+)/i)?.[1]
  const typeExtension: Record<string, string> = { 'application/epub+zip': 'epub', 'application/pdf': 'pdf', 'application/json': 'json', 'text/markdown': 'md', 'text/html': 'html', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' }
  let name = dispositionName ? decodeURIComponent(dispositionName.replace(/"/g, '')) : parsed.pathname.split('/').pop() || '网络书籍'
  const inferredExtension = typeExtension[blob.type.split(';')[0] || '']
  if (!extensionOf(name) || (!textExtensions.has(extensionOf(name)) && !archiveExtensions.has(extensionOf(name)) && inferredExtension)) name += `.${inferredExtension || 'txt'}`
  const file = new File([blob], name, { type: blob.type })
  const candidates = await parseBookFile(file)
  candidates.forEach(candidate => { candidate.book.origin = 'url'; candidate.book.sourceName = parsed.hostname; candidate.book.sourceUrl = parsed.toString() })
  return candidates
}
