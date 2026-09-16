/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { importBookFromUrl, type BookImportCandidate } from './bookImportService'
import { countBookStoreWords } from './bookStoreEngine'
import type { BookStoreChapter, BookStoreLibraryBook } from '../types/bookstore'

export type OnlineBookSourceId = 'gutenberg' | 'feedbooks' | 'wikisource' | 'internet-archive' | 'dbooks'

export interface OnlineBookResult {
  id: string
  sourceId: OnlineBookSourceId
  sourceName: string
  title: string
  author: string
  summary: string
  language: string
  cover: string
  formats: string[]
  detailUrl?: string
  downloadUrl?: string
  readable: true
}

export interface OnlineSourceStatus {
  sourceId: OnlineBookSourceId
  sourceName: string
  ok: boolean
  count: number
  message: string
  elapsedMs: number
}

const sourceNames: Record<OnlineBookSourceId, string> = {
  gutenberg: 'Project Gutenberg',
  feedbooks: 'Feedbooks 公版书',
  wikisource: '中文维基文库',
  'internet-archive': 'Internet Archive',
  dbooks: 'DBooks 开放图书'
}
const request = async (url: string, timeout = 15000) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json,application/atom+xml,application/xml,text/xml,*/*' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response
  } finally { clearTimeout(timer) }
}
const text = (element: Element | null | undefined, selector: string) => element?.querySelector(selector)?.textContent?.trim() || ''
const absolute = (value: string, base: string) => { try { return new URL(value, base).toString() } catch { return '' } }
const acquisition = (entry: Element, base: string) => {
  const links = [...entry.querySelectorAll('link')].map(link => ({ href: absolute(link.getAttribute('href') || '', base), type: link.getAttribute('type') || '', rel: link.getAttribute('rel') || '' }))
  const preferred = links.find(link => /opds-spec\.org\/acquisition/.test(link.rel) && /epub/.test(link.type)) || links.find(link => /opds-spec\.org\/acquisition/.test(link.rel) && /text\/plain|html|pdf/.test(link.type)) || links.find(link => /\.epub(?:$|\?)/i.test(link.href)) || links.find(link => /\.txt(?:$|\?)/i.test(link.href))
  return preferred?.href || ''
}
const parseOpds = (xmlText: string, sourceId: 'gutenberg' | 'feedbooks', base: string) => {
  const xml = new DOMParser().parseFromString(xmlText, 'application/xml')
  const results: OnlineBookResult[] = []
  for (const entry of [...xml.querySelectorAll('entry')]) {
    const downloadUrl = acquisition(entry, base)
    const cover = [...entry.querySelectorAll('link')].find(link => /image/.test(link.getAttribute('rel') || ''))?.getAttribute('href') || ''
    const title = text(entry, 'title')
    if (!title || !downloadUrl) continue
    results.push({ id: `${sourceId}:${text(entry, 'id') || downloadUrl}`, sourceId, sourceName: sourceNames[sourceId], title, author: text(entry, 'author name') || '未知作者', summary: text(entry, 'summary,content'), language: text(entry, 'language,dc\\:language'), cover: absolute(cover, base), formats: [downloadUrl.split(/[?#]/)[0]!.split('.').pop()?.toUpperCase() || '全文'], downloadUrl, detailUrl: downloadUrl, readable: true })
  }
  return results
}

const searchGutenberg = async (query: string) => {
  const url = `https://www.gutenberg.org/ebooks.opds/?search=${encodeURIComponent(query)}`
  return parseOpds(await (await request(url)).text(), 'gutenberg', url).slice(0, 20)
}

const searchFeedbooks = async (query: string) => {
  const url = `https://catalog.feedbooks.com/search.atom?query=${encodeURIComponent(query)}`
  return parseOpds(await (await request(url)).text(), 'feedbooks', url).slice(0, 20)
}

const searchWikisource = async (query: string) => {
  const params = new URLSearchParams({ origin: '*', action: 'query', format: 'json', list: 'search', srnamespace: '0', srlimit: '20', srsearch: query })
  const data = await (await request(`https://zh.wikisource.org/w/api.php?${params}`)).json() as any
  return (data?.query?.search || []).map((item: any) => ({ id: `wikisource:${item.pageid}`, sourceId: 'wikisource' as const, sourceName: sourceNames.wikisource, title: String(item.title || ''), author: '维基文库', summary: String(item.snippet || '').replace(/<[^>]+>/g, ''), language: 'zh', cover: '', formats: ['在线全文'], detailUrl: `https://zh.wikisource.org/wiki/${encodeURIComponent(item.title)}`, readable: true as const }))
}

const searchInternetArchive = async (query: string) => {
  const search = `(title:(${query}) OR creator:(${query})) AND mediatype:texts AND (format:"EPUB" OR format:"Text" OR format:"PDF")`
  const params = new URLSearchParams({ q: search, fl: 'identifier,title,creator,description,language', rows: '20', page: '1', output: 'json' })
  const data = await (await request(`https://archive.org/advancedsearch.php?${params}`)).json() as any
  return (data?.response?.docs || []).map((item: any) => ({ id: `internet-archive:${item.identifier}`, sourceId: 'internet-archive' as const, sourceName: sourceNames['internet-archive'], title: String(item.title || item.identifier), author: Array.isArray(item.creator) ? item.creator.join('、') : String(item.creator || '未知作者'), summary: Array.isArray(item.description) ? item.description.join(' ') : String(item.description || ''), language: Array.isArray(item.language) ? item.language.join(',') : String(item.language || ''), cover: `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`, formats: ['EPUB', 'TXT', 'PDF'], detailUrl: `https://archive.org/details/${encodeURIComponent(item.identifier)}`, readable: true as const }))
}

const searchDBooks = async (query: string) => {
  const data = await (await request(`https://www.dbooks.org/api/search/${encodeURIComponent(query)}`)).json() as any
  return (data?.books || []).map((item: any) => ({ id: `dbooks:${item.id}`, sourceId: 'dbooks' as const, sourceName: sourceNames.dbooks, title: String(item.title || ''), author: String(item.authors || '未知作者'), summary: String(item.subtitle || ''), language: '', cover: String(item.image || ''), formats: ['PDF/EPUB'], detailUrl: String(item.url || ''), readable: true as const }))
}

const sourceSearchers: Record<OnlineBookSourceId, (query: string) => Promise<OnlineBookResult[]>> = { gutenberg: searchGutenberg, feedbooks: searchFeedbooks, wikisource: searchWikisource, 'internet-archive': searchInternetArchive, dbooks: searchDBooks }

export const searchOnlineBooks = async (query: string) => {
  const trimmed = query.trim()
  if (!trimmed) return { results: [] as OnlineBookResult[], statuses: [] as OnlineSourceStatus[] }
  const entries = Object.entries(sourceSearchers) as Array<[OnlineBookSourceId, (query: string) => Promise<OnlineBookResult[]>]>
  const settled = await Promise.all(entries.map(async ([sourceId, searcher]) => {
    const start = performance.now()
    try {
      const results = await searcher(trimmed)
      return { results, status: { sourceId, sourceName: sourceNames[sourceId], ok: true, count: results.length, message: results.length ? '可用' : '没有匹配全文', elapsedMs: Math.round(performance.now() - start) } satisfies OnlineSourceStatus }
    } catch (cause: any) {
      return { results: [] as OnlineBookResult[], status: { sourceId, sourceName: sourceNames[sourceId], ok: false, count: 0, message: cause?.name === 'AbortError' ? '连接超时' : String(cause?.message || '暂时不可用'), elapsedMs: Math.round(performance.now() - start) } satisfies OnlineSourceStatus }
    }
  }))
  const seen = new Set<string>()
  const results = settled.flatMap(item => item.results).filter(item => {
    const key = `${item.title.replace(/\s+/g, '').toLowerCase()}|${item.author.replace(/\s+/g, '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key); return true
  })
  return { results, statuses: settled.map(item => item.status) }
}

const buildWikisourceCandidate = async (result: OnlineBookResult): Promise<BookImportCandidate[]> => {
  const title = result.title
  const listParams = new URLSearchParams({ origin: '*', action: 'query', format: 'json', list: 'allpages', aplimit: 'max', apprefix: `${title}/`, apnamespace: '0' })
  const list = await (await request(`https://zh.wikisource.org/w/api.php?${listParams}`)).json() as any
  const pageTitles = [title, ...(list?.query?.allpages || []).map((item: any) => String(item.title))].slice(0, 500)
  const chapters: BookStoreChapter[] = []
  for (const pageTitle of pageTitles) {
    const params = new URLSearchParams({ origin: '*', action: 'parse', format: 'json', prop: 'text', page: pageTitle, disableeditsection: '1', redirects: '1' })
    try {
      const data = await (await request(`https://zh.wikisource.org/w/api.php?${params}`)).json() as any
      const html = String(data?.parse?.text?.['*'] || '')
      const document = new DOMParser().parseFromString(html, 'text/html')
      document.querySelectorAll('style,script,.mw-editsection,.ws-noexport,.noprint,table').forEach(node => node.remove())
      const body = (document.body.textContent || '').replace(/\[编辑\]/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
      if (body.length < 20) continue
      const timestamp = Date.now()
      chapters.push({ id: `chapter_${timestamp.toString(36)}_${chapters.length}`, title: pageTitle === title ? '正文' : pageTitle.slice(title.length + 1) || `第${chapters.length + 1}章`, content: body, summary: body.slice(0, 180), status: 'published', order: chapters.length + 1, wordCount: countBookStoreWords(body), createdAt: timestamp, updatedAt: timestamp, publishedAt: timestamp, sourceUrl: `https://zh.wikisource.org/wiki/${encodeURIComponent(pageTitle)}` })
    } catch { /* 单个子页异常不阻断整本书 */ }
  }
  if (!chapters.length) throw new Error('没有读取到可用正文')
  const now = Date.now()
  const book: Omit<BookStoreLibraryBook, 'id' | 'addedAt' | 'updatedAt'> = { title, author: result.author, summary: result.summary, cover: result.cover, coverColor: '#6b786f', category: '在线全文', tags: ['维基文库'], language: result.language, format: 'web', origin: 'online', sourceName: result.sourceName, sourceId: result.id, sourceUrl: result.detailUrl, size: chapters.reduce((sum, chapter) => sum + new Blob([chapter.content]).size, 0), chapters }
  return [{ id: `import_${now.toString(36)}`, sourcePath: result.detailUrl || title, selected: true, book }]
}

const internetArchiveUrl = async (result: OnlineBookResult) => {
  const identifier = result.id.split(':').slice(1).join(':')
  const metadata = await (await request(`https://archive.org/metadata/${encodeURIComponent(identifier)}`)).json() as any
  const files = (metadata?.files || []).filter((item: any) => item?.name && Number(item?.size || 0) <= 300 * 1024 * 1024)
  const preferred = files.find((item: any) => /\.epub$/i.test(item.name) && !/encrypted/i.test(item.name)) || files.find((item: any) => /(?:_djvu)?\.txt$/i.test(item.name)) || files.find((item: any) => /\.pdf$/i.test(item.name) && !/text\.pdf$/i.test(item.name))
  if (!preferred) throw new Error('该条目没有可直接读取的完整文件')
  return `https://archive.org/download/${encodeURIComponent(identifier)}/${preferred.name.split('/').map(encodeURIComponent).join('/')}`
}

const dbooksUrl = async (result: OnlineBookResult) => {
  const bookId = result.id.split(':').slice(1).join(':')
  const data = await (await request(`https://www.dbooks.org/api/book/${encodeURIComponent(bookId)}`)).json() as any
  if (!data?.download) throw new Error('此书当前没有可用下载地址')
  return String(data.download)
}

export const downloadOnlineBook = async (result: OnlineBookResult) => {
  if (result.sourceId === 'wikisource') return buildWikisourceCandidate(result)
  const url = result.downloadUrl || (result.sourceId === 'internet-archive' ? await internetArchiveUrl(result) : result.sourceId === 'dbooks' ? await dbooksUrl(result) : '')
  if (!url) throw new Error('没有找到可直接读取的完整文件')
  const candidates = await importBookFromUrl(url)
  candidates.forEach(candidate => {
    if (candidates.length === 1) candidate.book.title = result.title || candidate.book.title
    if (candidate.book.author === '未知作者') candidate.book.author = result.author
    candidate.book.summary ||= result.summary
    candidate.book.cover ||= result.cover
    candidate.book.origin = 'online'
    candidate.book.sourceName = result.sourceName
    candidate.book.sourceId = result.id
    candidate.book.sourceUrl = result.detailUrl || url
    if (!candidate.book.tags.includes(result.sourceName)) candidate.book.tags.push(result.sourceName)
  })
  return candidates
}

export const onlineSourceNames = sourceNames
