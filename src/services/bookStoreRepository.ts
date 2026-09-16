/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import localforage from 'localforage'
import type { BookStoreSnapshot, BookStoreWork } from '../types/bookstore'

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'bookStore' })
const SNAPSHOT_KEY = 'snapshot_v1'
const now = Date.now()
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`

const chapter = (title: string, content: string, order: number) => ({ id: id('chapter'), title, content, summary: content.slice(0, 120), status: 'published' as const, order, wordCount: content.length, createdAt: now - (4 - order) * 86400000, updatedAt: now, publishedAt: now - (4 - order) * 86400000 })
const sample = (input: Partial<BookStoreWork> & Pick<BookStoreWork, 'title' | 'authorId' | 'authorName' | 'summary' | 'category' | 'tags' | 'coverColor'>, contents: [string, string]): BookStoreWork => ({
  id: id('work'), kind: 'original', status: 'serializing', outline: '', cover: '', fandom: '', characters: [], relationships: [], warnings: [], rating: 'general', aiDisclosure: 'none', permission: { translation: false, podfic: true, illustration: true, continuation: false }, chapters: [chapter('第一章', contents[0], 1), chapter('第二章', contents[1], 2)], views: 1600, effectiveReads: 1080, shelfCount: 342, followerGain: 38, commentCount: 26, score: 4.7, featured: false, signed: false, createdAt: now - 12 * 86400000, updatedAt: now - 3600000, ...input
})

export const createDefaultBookStoreSnapshot = (): BookStoreSnapshot => {
  const author = { id: 'author_self', name: '未眠书页', bio: '把没有说完的故事写到天亮。', avatarText: '书', followers: 128, reputation: 460, level: 3, signed: false, badges: ['连续创作 7 天'], createdAt: now - 30 * 86400000 }
  const guest = { id: 'author_guest', name: '白昼信差', bio: '幻想与日常之间。', avatarText: '白', followers: 2860, reputation: 8200, level: 8, signed: true, badges: ['年度潜力作者', '完结作者'], createdAt: now - 300 * 86400000 }
  const works = [
    sample({ title: '风从旧站台来', authorId: guest.id, authorName: guest.name, summary: '她收到一封从二十年前寄来的信，而旧站台只会在雨夜出现。', category: '悬疑幻想', tags: ['时空', '小城', '慢热'], coverColor: '#6f8279', featured: true, signed: true }, ['傍晚六点十七分，最后一班慢车从旧站台旁驶过。林栀抱着刚从旧书店买来的纸箱，听见里面传出一声很轻的钟响。\n\n纸箱最底下，躺着一封没有署名、却写着她童年住址的信。', '信封里只有一页纸：不要让十月三日再次发生。\n\n十月三日是母亲从不肯提起的日子，也是旧火车站停止运营的日期。纸页右下角，是二十年前的北岸邮局印章。']),
    sample({ title: '春日来信', authorId: author.id, authorName: author.name, summary: '交换错误的两封信，让两个从未见面的人共享了整个春天。', category: '现代言情', tags: ['书信', '治愈', '双向奔赴'], coverColor: '#c99d91', views: 820, effectiveReads: 610, shelfCount: 190, commentCount: 18 }, ['程雾拆开信时，才发现收件人并不是自己。窗外的玉兰刚开，陌生人的句子却像认识她很久。', '她把回信放进街角的绿色邮筒，没有留下姓名，只在信末画了一片很小的云。三天后，新的信来了。']),
    sample({ title: '星河航行守则', authorId: guest.id, authorName: guest.name, summary: '落单的领航员与一艘不愿返航的旧飞船。', category: '科幻', tags: ['星际', '群像', '冒险'], coverColor: '#556581', score: 4.8, shelfCount: 480 }, ['导航系统第三次拒绝返航指令时，周予终于意识到，旧飞船并不是出了故障。它在等待一个已经失联七年的坐标。', '远星的光穿过观察窗，飞船调出一段被删除的航行日志。说话的人，正是周予以为再也不会听见的队长。']),
    sample({ title: '月色回廊', authorId: author.id, authorName: author.name, summary: '原作结局之后，他们在回廊尽头重新相遇。', category: '衍生同人', tags: ['原作后', '重逢', 'HE'], coverColor: '#766780', kind: 'fandom', fandom: '月庭纪事', characters: ['沈砚', '闻溪'], relationships: ['沈砚/闻溪'], warnings: ['含原作结局剧透'], signed: false, featured: true }, ['闻溪再次走进月庭时，回廊上的灯全灭了。只有尽头站着一个人，衣角沾着旧雪。', '沈砚没有问她为什么回来。他只是把那盏留了三年的灯递过去，像原作最后那场告别从未发生。'])
  ]
  return { version: 2, initialized: true, currentAuthorId: author.id, authors: [author, guest], works, shelf: [{ workId: works[0].id, progressChapterId: works[0].chapters[0].id, progressOffset: 0, addedAt: now - 3 * 86400000, updatedAt: now - 2 * 3600000, lastReadAt: now - 2 * 3600000 }], followedAuthorIds: [guest.id], reviews: [{ id: id('review'), workId: works[0].id, authorName: '沿岸读者', content: '旧站台和来信的意象很有电影感，第二章收得特别好。', rating: 5, likes: 18, createdAt: now - 7200000, source: 'simulation' }], jobs: [], usage: [], settings: { dailyTokenBudget: 30000, perTaskTokenBudget: 12000, allowFallback: false, retryLimit: 2, autoReview: false, readerTheme: 'paper', fontSize: 18, lineHeight: 1.95, pageMode: 'scroll', fontFamily: 'serif', textAlign: 'justify', paragraphIndent: true, paragraphSpacing: 1.1, contentWidth: 740, autoMarkRead: true, keepScreenAwake: false, ttsRate: .95, ttsPitch: 1 }, library: [], readingStates: [], annotations: [], lastSimulatedAt: now, updatedAt: now }
}

export const normalizeBookStoreSnapshot = (raw?: Partial<BookStoreSnapshot> | null): BookStoreSnapshot => {
  const base = createDefaultBookStoreSnapshot()
  if (!raw || (Number(raw.version) !== 1 && Number(raw.version) !== 2)) return base
  return { ...base, ...raw, version: 2, authors: Array.isArray(raw.authors) ? raw.authors : base.authors, works: Array.isArray(raw.works) ? raw.works.map(work => ({ ...work, outline: work.outline || '' })) : base.works, shelf: Array.isArray(raw.shelf) ? raw.shelf : [], followedAuthorIds: Array.isArray(raw.followedAuthorIds) ? raw.followedAuthorIds : [], reviews: Array.isArray(raw.reviews) ? raw.reviews : [], jobs: Array.isArray(raw.jobs) ? raw.jobs.map(job => job.status === 'running' ? { ...job, status: 'paused' as const, error: '应用关闭后任务已安全暂停，可继续生成。' } : job) : [], usage: Array.isArray(raw.usage) ? raw.usage.slice(-500) : [], settings: { ...base.settings, ...(raw.settings || {}) }, library: Array.isArray(raw.library) ? raw.library : [], readingStates: Array.isArray(raw.readingStates) ? raw.readingStates : [], annotations: Array.isArray(raw.annotations) ? raw.annotations : [] }
}

export const loadBookStoreSnapshot = async () => normalizeBookStoreSnapshot(await store.getItem<BookStoreSnapshot>(SNAPSHOT_KEY))
export const saveBookStoreSnapshot = async (snapshot: BookStoreSnapshot) => { snapshot.updatedAt = Date.now(); await store.setItem(SNAPSHOT_KEY, JSON.parse(JSON.stringify(snapshot))) }
