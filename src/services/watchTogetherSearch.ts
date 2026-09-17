/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { downloadOnlineBook, searchOnlineBooks } from './bookOnlineService'
import type { OnlineBookResult } from './bookOnlineService'
import type { WatchTogetherItem, WatchTogetherKind, WatchTogetherSearchResult } from '../types/watchTogether'

export interface WatchTogetherSourceStatus {
  id: string
  name: string
  ok: boolean
  count: number
  message: string
}

const requestJson = async (url: string, timeout = 14000) => {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

const clean = (value: unknown) => Array.isArray(value) ? value.join('、') : String(value || '')
const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
const mediaKinds: Record<Exclude<WatchTogetherKind, 'novel'>, { query: string; extensions: RegExp; mime: RegExp }> = {
  video: { query: 'mediatype:movies', extensions: /\.(mp4|m4v|webm|ogv|mov)$/i, mime: /^video\//i },
  comic: { query: 'mediatype:texts AND (subject:comic OR subject:comics OR subject:manga)', extensions: /\.pdf$/i, mime: /^application\/pdf/i },
  audio: { query: 'mediatype:audio', extensions: /\.(mp3|m4a|ogg|oga|flac|wav|opus)$/i, mime: /^audio\//i }
}

const resolveArchiveResult = async (kind: Exclude<WatchTogetherKind, 'novel'>, doc: any): Promise<WatchTogetherSearchResult | null> => {
  const identifier = String(doc.identifier || '')
  if (!identifier) return null
  const metadata = await requestJson(`https://archive.org/metadata/${encodeURIComponent(identifier)}`)
  const rule = mediaKinds[kind]
  const files = Array.isArray(metadata?.files) ? metadata.files : []
  const file = files.find((entry: any) => {
    const name = String(entry?.name || '')
    const format = String(entry?.format || '')
    const source = String(entry?.source || '')
    return rule.extensions.test(name) && !/torrent|thumb|sample|preview|encrypted/i.test(`${name} ${format}`) && source !== 'metadata'
  })
  if (!file) return null
  const name = String(file.name)
  const mediaUrl = `https://archive.org/download/${encodeURIComponent(identifier)}/${name.split('/').map(encodeURIComponent).join('/')}`
  return {
    id: `internet-archive:${identifier}:${name}`,
    kind,
    title: clean(doc.title) || identifier,
    subtitle: clean(doc.date || doc.year),
    creator: clean(doc.creator),
    description: clean(doc.description).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
    cover: `https://archive.org/services/img/${encodeURIComponent(identifier)}`,
    sourceId: 'internet-archive', sourceName: 'Internet Archive', sourceUrl: `https://archive.org/details/${encodeURIComponent(identifier)}`,
    mediaUrl, mimeType: String(file?.mime || (kind === 'video' ? 'video/mp4' : kind === 'audio' ? 'audio/mpeg' : 'application/pdf')),
    access: 'direct', playable: true, availability: '已找到可直接读取的公开文件'
  }
}

const searchArchive = async (kind: Exclude<WatchTogetherKind, 'novel'>, query: string) => {
  const media = mediaKinds[kind]
  const params = new URLSearchParams({
    q: `(${media.query}) AND (title:(${query}) OR creator:(${query}) OR description:(${query}))`,
    fl: 'identifier,title,creator,description,date,year', rows: '12', page: '1', output: 'json'
  })
  const data = await requestJson(`https://archive.org/advancedsearch.php?${params}`)
  const docs = Array.isArray(data?.response?.docs) ? data.response.docs : []
  const settled = await Promise.allSettled(docs.slice(0, 8).map((doc: any) => resolveArchiveResult(kind, doc)))
  return settled.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : [])
}

const searchWikimedia = async (kind: Exclude<WatchTogetherKind, 'novel'>, query: string) => {
  const fileType = kind === 'video' ? 'video' : kind === 'audio' ? 'audio' : 'bitmap'
  const params = new URLSearchParams({
    origin: '*', action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '12',
    gsrsearch: `${query} filetype:${fileType}`, prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata'
  })
  const data = await requestJson(`https://commons.wikimedia.org/w/api.php?${params}`)
  return Object.values(data?.query?.pages || {}).flatMap((page: any) => {
    const info = page?.imageinfo?.[0]
    const mime = String(info?.mime || '')
    const playable = kind === 'comic' ? mime.startsWith('image/') : mediaKinds[kind].mime.test(mime)
    if (!playable || !info?.url) return []
    const metadata = info.extmetadata || {}
    return [{
      id: `wikimedia:${page.pageid}`, kind, title: String(page.title || '').replace(/^File:/, ''), subtitle: '',
      creator: String(metadata.Artist?.value || '').replace(/<[^>]+>/g, ''),
      description: String(metadata.ImageDescription?.value || '').replace(/<[^>]+>/g, ' ').slice(0, 500),
      cover: kind === 'comic' ? String(info.thumburl || info.url) : '', sourceId: 'wikimedia', sourceName: 'Wikimedia Commons',
      sourceUrl: String(info.descriptionurl || ''), mediaUrl: String(info.url), mimeType: mime, access: 'direct' as const,
      playable: true, availability: '开放媒体文件可直接读取'
    } satisfies WatchTogetherSearchResult]
  })
}

const searchPeerTube = async (query: string) => {
  const params = new URLSearchParams({ search: query, count: '12', start: '0', sort: '-match' })
  const data = await requestJson(`https://sepiasearch.org/api/v1/search/videos?${params}`)
  return (Array.isArray(data?.data) ? data.data : []).map((entry: any) => {
    const sourceUrl = String(entry.url || '')
    let embed = ''
    try {
      const parsed = new URL(sourceUrl)
      embed = `${parsed.origin}/videos/embed/${String(entry.uuid || '').trim()}`
    } catch {}
    return {
      id: `peertube:${entry.uuid}`, kind: 'video' as const, title: String(entry.name || '未命名视频'),
      subtitle: String(entry.publishedAt || '').slice(0, 10), creator: String(entry.account?.displayName || entry.channel?.displayName || ''),
      description: String(entry.description || '').slice(0, 500), cover: String(entry.thumbnailUrl || ''),
      sourceId: 'peertube', sourceName: 'PeerTube', sourceUrl, mediaUrl: embed || sourceUrl,
      mimeType: 'text/html', access: 'embed' as const, playable: Boolean(embed), availability: embed ? '可使用来源站嵌入播放器' : '只能前往来源页'
    } satisfies WatchTogetherSearchResult
  }).filter((entry: WatchTogetherSearchResult) => entry.playable)
}

const searchPodcasts = async (query: string) => {
  const params = new URLSearchParams({ term: query, media: 'podcast', entity: 'podcast', limit: '8', country: 'CN' })
  const data = await requestJson(`https://itunes.apple.com/search?${params}`)
  const podcasts = Array.isArray(data?.results) ? data.results : []
  const settled = await Promise.allSettled(podcasts.map(async (podcast: any) => {
    const feedUrl = String(podcast.feedUrl || '')
    if (!feedUrl) return null
    const response = await fetch(feedUrl, { headers: { Accept: 'application/rss+xml,application/xml,text/xml' } })
    if (!response.ok) return null
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml')
    const episode = xml.querySelector('channel > item')
    const enclosure = episode?.querySelector('enclosure')
    const mediaUrl = enclosure?.getAttribute('url') || ''
    if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) return null
    const episodeTitle = episode?.querySelector('title')?.textContent?.trim() || ''
    return {
      id: `podcast:${podcast.collectionId}:${episode?.querySelector('guid')?.textContent || mediaUrl}`,
      kind: 'audio' as const, title: String(podcast.collectionName || podcast.trackName || '未命名播客'),
      subtitle: episodeTitle, creator: String(podcast.artistName || ''),
      description: episode?.querySelector('description')?.textContent?.replace(/<[^>]+>/g, ' ').slice(0, 500) || '',
      cover: String(podcast.artworkUrl600 || podcast.artworkUrl100 || ''), sourceId: 'apple-podcasts', sourceName: 'Apple Podcasts / RSS',
      sourceUrl: String(podcast.collectionViewUrl || feedUrl), mediaUrl, mimeType: enclosure?.getAttribute('type') || 'audio/mpeg',
      access: 'direct' as const, playable: true, availability: `可播放最新单集${episodeTitle ? `：${episodeTitle}` : ''}`
    } satisfies WatchTogetherSearchResult
  }))
  return settled.flatMap(entry => entry.status === 'fulfilled' && entry.value ? [entry.value] : [])
}

const searchMangaDex = async (query: string) => {
  const params = new URLSearchParams({ title: query, limit: '6', 'includes[]': 'cover_art', 'contentRating[]': 'safe' })
  const data = await requestJson(`https://api.mangadex.org/manga?${params}`)
  const manga = Array.isArray(data?.data) ? data.data : []
  const settled = await Promise.allSettled(manga.map(async (entry: any) => {
    const feedParams = new URLSearchParams({ limit: '1', 'translatedLanguage[]': 'zh', 'order[chapter]': 'asc', 'includes[]': 'scanlation_group' })
    let feed = await requestJson(`https://api.mangadex.org/manga/${encodeURIComponent(entry.id)}/feed?${feedParams}`)
    if (!feed?.data?.length) {
      const fallback = new URLSearchParams({ limit: '1', 'order[chapter]': 'asc', 'includes[]': 'scanlation_group' })
      feed = await requestJson(`https://api.mangadex.org/manga/${encodeURIComponent(entry.id)}/feed?${fallback}`)
    }
    const chapter = feed?.data?.[0]
    if (!chapter?.id) return null
    const atHome = await requestJson(`https://api.mangadex.org/at-home/server/${encodeURIComponent(chapter.id)}`)
    const hash = String(atHome?.chapter?.hash || '')
    const files = Array.isArray(atHome?.chapter?.dataSaver) ? atHome.chapter.dataSaver : []
    if (!atHome?.baseUrl || !hash || !files.length) return null
    const titleMap = entry.attributes?.title || {}
    const title = String(titleMap['zh-ro'] || titleMap.en || titleMap.ja || Object.values(titleMap)[0] || '未命名漫画')
    const coverRelation = (entry.relationships || []).find((relation: any) => relation.type === 'cover_art')
    const coverName = coverRelation?.attributes?.fileName
    const group = (chapter.relationships || []).find((relation: any) => relation.type === 'scanlation_group')?.attributes?.name || ''
    return {
      id: `mangadex:${entry.id}:${chapter.id}`, kind: 'comic' as const, title,
      subtitle: `第 ${chapter.attributes?.chapter || '1'} 话`, creator: group ? `汉化组：${group}` : 'MangaDex 社区上传',
      description: String(entry.attributes?.description?.zh || entry.attributes?.description?.en || '').slice(0, 500),
      cover: coverName ? `https://uploads.mangadex.org/covers/${entry.id}/${coverName}.256.jpg` : '',
      sourceId: 'mangadex', sourceName: 'MangaDex', sourceUrl: `https://mangadex.org/title/${entry.id}`,
      mediaUrl: '', mimeType: 'image/jpeg', access: 'direct' as const, playable: true,
      availability: group ? `可读取章节 · ${group}` : '可读取章节',
      pageUrls: files.map((name: string) => `${atHome.baseUrl}/data-saver/${hash}/${name}`)
    } satisfies WatchTogetherSearchResult
  }))
  return settled.flatMap(entry => entry.status === 'fulfilled' && entry.value ? [entry.value] : [])
}

const searchNovel = async (query: string) => {
  const data = await searchOnlineBooks(query)
  return {
    results: data.results.map(result => ({
      id: result.id, kind: 'novel' as const, title: result.title, subtitle: result.language, creator: result.author,
      description: result.summary, cover: result.cover, sourceId: result.sourceId, sourceName: result.sourceName,
      sourceUrl: result.detailUrl || '', mediaUrl: result.downloadUrl || '', mimeType: '', access: 'direct' as const,
      playable: true, availability: '来源提供全文；打开时再次验证文件'
    } satisfies WatchTogetherSearchResult)),
    statuses: data.statuses.map(status => ({ id: status.sourceId, name: status.sourceName, ok: status.ok, count: status.count, message: status.message }))
  }
}

export const searchWatchTogether = async (kind: WatchTogetherKind, query: string) => {
  const trimmed = query.trim()
  if (!trimmed) return { results: [] as WatchTogetherSearchResult[], statuses: [] as WatchTogetherSourceStatus[] }
  if (kind === 'novel') return searchNovel(trimmed)
  const sources: Array<{ id: string; name: string; run: () => Promise<WatchTogetherSearchResult[]> }> = [
    { id: 'internet-archive', name: 'Internet Archive', run: () => searchArchive(kind, trimmed) },
    { id: 'wikimedia', name: 'Wikimedia Commons', run: () => searchWikimedia(kind, trimmed) }
  ]
  if (kind === 'video') sources.push({ id: 'peertube', name: 'PeerTube', run: () => searchPeerTube(trimmed) })
  if (kind === 'audio') sources.push({ id: 'apple-podcasts', name: 'Apple Podcasts / RSS', run: () => searchPodcasts(trimmed) })
  if (kind === 'comic') sources.push({ id: 'mangadex', name: 'MangaDex', run: () => searchMangaDex(trimmed) })
  const settled = await Promise.all(sources.map(async source => {
    try {
      const results = await source.run()
      return { results, status: { id: source.id, name: source.name, ok: true, count: results.length, message: results.length ? '可用' : '没有可直接播放的结果' } }
    } catch (cause) {
      return { results: [] as WatchTogetherSearchResult[], status: { id: source.id, name: source.name, ok: false, count: 0, message: cause instanceof Error ? cause.message : '暂时不可用' } }
    }
  }))
  const seen = new Set<string>()
  const results = settled.flatMap(entry => entry.results).filter(entry => {
    if (!entry.playable) return false
    const key = `${entry.title.replace(/\s+/g, '').toLowerCase()}|${entry.creator.replace(/\s+/g, '').toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  return { results, statuses: settled.map(entry => entry.status) }
}

const onlineBookFromResult = (result: WatchTogetherSearchResult): OnlineBookResult => ({
  id: result.id,
  sourceId: result.sourceId as OnlineBookResult['sourceId'],
  sourceName: result.sourceName,
  title: result.title,
  author: result.creator,
  summary: result.description,
  language: result.subtitle,
  cover: result.cover,
  formats: [],
  detailUrl: result.sourceUrl,
  downloadUrl: result.mediaUrl || undefined,
  readable: true
})

export const materializeWatchTogetherResult = async (result: WatchTogetherSearchResult): Promise<WatchTogetherItem[]> => {
  if (result.kind === 'novel') {
    const candidates = await downloadOnlineBook(onlineBookFromResult(result))
    return candidates.map(candidate => ({
      id: uid('watch_item'), kind: 'novel', title: candidate.book.title, subtitle: candidate.book.language,
      creator: candidate.book.author, description: candidate.book.summary, cover: candidate.book.cover,
      origin: 'online', sourceId: result.sourceId, sourceName: result.sourceName, sourceUrl: result.sourceUrl,
      access: 'direct', mediaUrl: '', mimeType: '', fileName: candidate.book.fileName || '', size: candidate.book.size,
      chapters: candidate.book.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, order: chapter.order, text: chapter.content })),
      tags: candidate.book.tags, addedAt: Date.now(), updatedAt: Date.now()
    }))
  }
  return [{
    id: uid('watch_item'), kind: result.kind, title: result.title, subtitle: result.subtitle, creator: result.creator,
    description: result.description, cover: result.cover, origin: 'online', sourceId: result.sourceId,
    sourceName: result.sourceName, sourceUrl: result.sourceUrl, access: result.access, mediaUrl: result.mediaUrl,
    mimeType: result.mimeType, fileName: '', size: 0,
    chapters: [{ id: uid('chapter'), title: result.subtitle || (result.kind === 'audio' ? '音轨 1' : result.kind === 'comic' ? '正文' : '正片'), order: 1, pageUrls: result.pageUrls }],
    tags: [result.sourceName], addedAt: Date.now(), updatedAt: Date.now()
  }]
}

export const createWatchTogetherUrlItem = (kind: WatchTogetherKind, url: string, title = ''): WatchTogetherItem => {
  const parsed = new URL(url)
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('只支持 HTTP 或 HTTPS 地址')
  const extension = parsed.pathname.split('.').pop()?.toLowerCase() || ''
  let embedUrl = ''
  if (kind === 'video') {
    const youtubeId = parsed.hostname.includes('youtu.be') ? parsed.pathname.split('/').filter(Boolean)[0] : parsed.searchParams.get('v')
    const bilibiliId = parsed.pathname.match(/\/(BV[a-zA-Z0-9]+)/)?.[1]
    const vimeoId = parsed.hostname.includes('vimeo.com') ? parsed.pathname.match(/\/(\d+)/)?.[1] : ''
    if (youtubeId) embedUrl = `https://www.youtube.com/embed/${encodeURIComponent(youtubeId)}?playsinline=1`
    else if (bilibiliId) embedUrl = `https://player.bilibili.com/player.html?bvid=${encodeURIComponent(bilibiliId)}&high_quality=1`
    else if (vimeoId) embedUrl = `https://player.vimeo.com/video/${encodeURIComponent(vimeoId)}`
  }
  const mime = kind === 'video' ? (extension === 'm3u8' ? 'application/vnd.apple.mpegurl' : 'video/mp4') : kind === 'audio' ? (extension === 'm3u8' ? 'application/vnd.apple.mpegurl' : 'audio/mpeg') : kind === 'comic' && extension === 'pdf' ? 'application/pdf' : ''
  return {
    id: uid('watch_item'), kind, title: title.trim() || parsed.pathname.split('/').filter(Boolean).pop() || parsed.hostname,
    subtitle: '', creator: '', description: '', cover: '', origin: 'url', sourceId: 'url', sourceName: parsed.hostname,
    sourceUrl: parsed.toString(), access: embedUrl ? 'embed' : 'direct', mediaUrl: embedUrl || parsed.toString(), mimeType: embedUrl ? 'text/html' : mime,
    fileName: '', size: 0, chapters: [{ id: uid('chapter'), title: '正文', order: 1 }], tags: ['URL'],
    addedAt: Date.now(), updatedAt: Date.now()
  }
}

export const importWatchTogetherUrl = async (kind: WatchTogetherKind, url: string, title = '') => {
  if (kind !== 'novel') return [createWatchTogetherUrlItem(kind, url, title)]
  const { importBookFromUrl } = await import('./bookImportService')
  const candidates = await importBookFromUrl(url)
  return candidates.map(candidate => ({
    id: uid('watch_item'), kind: 'novel' as const, title: title.trim() || candidate.book.title, subtitle: candidate.book.language,
    creator: candidate.book.author, description: candidate.book.summary, cover: candidate.book.cover, origin: 'url' as const,
    sourceId: 'url', sourceName: '网络地址', sourceUrl: url, access: 'direct' as const, mediaUrl: '', mimeType: '',
    fileName: candidate.book.fileName || '', size: candidate.book.size,
    chapters: candidate.book.chapters.map(chapter => ({ id: chapter.id, title: chapter.title, order: chapter.order, text: chapter.content })),
    tags: candidate.book.tags, addedAt: Date.now(), updatedAt: Date.now()
  }))
}
