/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, readonly, ref } from 'vue'
import { sendCapabilityMessage } from '../services/api'
import { buildChapterContext, countBookStoreWords, estimateGenerationBudget, simulateBookStoreWork } from '../services/bookStoreEngine'
import { createDefaultBookStoreSnapshot, loadBookStoreSnapshot, saveBookStoreSnapshot } from '../services/bookStoreRepository'
import type { BookStoreAnnotation, BookStoreChapter, BookStoreGenerationJob, BookStoreLibraryBook, BookStoreReadingState, BookStoreSnapshot, BookStoreUsageRecord, BookStoreWork, BookStoreWorkKind } from '../types/bookstore'
import { appendServiceSms } from '../services/smsService'

const state = reactive<BookStoreSnapshot>(createDefaultBookStoreSnapshot())
const ready = ref(false)
const busy = ref(false)
const error = ref('')
let initializing: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | undefined
let activeController: AbortController | null = null
const cancelledJobIds = new Set<string>()
const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => { void saveBookStoreSnapshot(state) }, 140)
}

const initialize = async () => {
  if (ready.value) return
  if (initializing) return initializing
  initializing = (async () => {
    Object.assign(state, await loadBookStoreSnapshot())
    const elapsedHours = Math.max(0, (Date.now() - state.lastSimulatedAt) / 3600000)
    if (elapsedHours >= 1) {
      state.works.forEach(work => {
        const result = simulateBookStoreWork(work, elapsedHours, state.lastSimulatedAt)
        work.views += result.views; work.effectiveReads += result.reads; work.shelfCount += result.shelves; work.commentCount += result.comments; work.followerGain += result.followers
        const author = state.authors.find(item => item.id === work.authorId)
        if (author) author.followers += result.followers
      })
      state.lastSimulatedAt = Date.now()
      await saveBookStoreSnapshot(state)
    }
    ready.value = true
  })().finally(() => { initializing = null })
  return initializing
}

const currentAuthor = computed(() => state.authors.find(item => item.id === state.currentAuthorId) || state.authors[0])
const myWorks = computed(() => state.works.filter(item => item.authorId === state.currentAuthorId))
const shelfWorks = computed(() => state.shelf.map(entry => ({ entry, work: state.works.find(work => work.id === entry.workId) })).filter(item => item.work))
const libraryBooks = computed(() => state.library.slice().sort((a, b) => {
  const aRead = state.readingStates.find(item => item.bookId === a.id)?.lastReadAt || a.addedAt
  const bRead = state.readingStates.find(item => item.bookId === b.id)?.lastReadAt || b.addedAt
  return bRead - aRead
}))
const activeJobs = computed(() => state.jobs.filter(item => ['queued', 'running', 'paused'].includes(item.status)))
const todayUsage = computed(() => {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  return state.usage.filter(item => item.createdAt >= start.getTime() && item.status !== 'estimated').reduce((sum, item) => sum + (item.actualTokens || item.estimatedInputTokens + item.estimatedOutputTokens), 0)
})

const createWork = (input: { title: string; kind: BookStoreWorkKind; summary?: string; category?: string; fandom?: string }) => {
  const author = currentAuthor.value
  if (!author) throw new Error('作者资料尚未准备好')
  const createdAt = Date.now()
  const work: BookStoreWork = {
    id: id('work'), title: input.title.trim() || '未命名作品', authorId: author.id, authorName: author.name, kind: input.kind, status: 'draft', summary: input.summary?.trim() || '', outline: '', cover: '', coverColor: input.kind === 'fandom' ? '#796d85' : '#8e7b68', category: input.category?.trim() || (input.kind === 'fandom' ? '衍生同人' : '原创小说'), tags: [], fandom: input.fandom?.trim() || '', characters: [], relationships: [], warnings: [], rating: 'general', aiDisclosure: 'none', permission: { translation: false, podfic: false, illustration: true, continuation: false }, chapters: [], views: 0, effectiveReads: 0, shelfCount: 0, followerGain: 0, commentCount: 0, score: 0, featured: false, signed: false, createdAt, updatedAt: createdAt
  }
  state.works.unshift(work); scheduleSave(); return work
}

const updateWork = (workId: string, patch: Partial<BookStoreWork>) => {
  const work = state.works.find(item => item.id === workId)
  if (!work) return false
  Object.assign(work, patch, { id: work.id, authorId: work.authorId, updatedAt: Date.now() })
  scheduleSave(); return true
}

const addChapter = (workId: string, title = '') => {
  const work = state.works.find(item => item.id === workId)
  if (!work) return null
  const createdAt = Date.now(); const order = work.chapters.length + 1
  const chapter: BookStoreChapter = { id: id('chapter'), title: title.trim() || `第${order}章`, content: '', summary: '', status: 'draft', order, wordCount: 0, createdAt, updatedAt: createdAt }
  work.chapters.push(chapter); work.updatedAt = createdAt; scheduleSave(); return chapter
}

const saveChapter = (workId: string, chapterId: string, patch: Partial<BookStoreChapter>) => {
  const work = state.works.find(item => item.id === workId); const chapter = work?.chapters.find(item => item.id === chapterId)
  if (!work || !chapter) return false
  Object.assign(chapter, patch, { id: chapter.id, order: chapter.order, updatedAt: Date.now() })
  chapter.wordCount = countBookStoreWords(chapter.content)
  work.updatedAt = Date.now(); scheduleSave(); return true
}

const publishChapter = (workId: string, chapterId: string) => {
  const work = state.works.find(item => item.id === workId); const chapter = work?.chapters.find(item => item.id === chapterId)
  if (!work || !chapter || !chapter.content.trim()) return false
  chapter.status = 'published'; chapter.publishedAt ||= Date.now(); chapter.updatedAt = Date.now(); work.status = 'serializing'; work.updatedAt = Date.now(); scheduleSave(); return true
}

const toggleShelf = (workId: string) => {
  const index = state.shelf.findIndex(item => item.workId === workId)
  if (index >= 0) state.shelf.splice(index, 1)
  else state.shelf.unshift({ workId, progressOffset: 0, addedAt: Date.now(), updatedAt: Date.now() })
  scheduleSave(); return index < 0
}

const saveProgress = (workId: string, chapterId: string, progressOffset = 0) => {
  let entry = state.shelf.find(item => item.workId === workId)
  if (!entry) { entry = { workId, progressOffset: 0, addedAt: Date.now(), updatedAt: Date.now() }; state.shelf.unshift(entry) }
  entry.progressChapterId = chapterId; entry.progressOffset = Math.max(0, progressOffset); entry.updatedAt = Date.now(); entry.lastReadAt = Date.now(); scheduleSave()
}

const toggleFollow = (authorId: string) => {
  const index = state.followedAuthorIds.indexOf(authorId)
  if (index >= 0) state.followedAuthorIds.splice(index, 1); else state.followedAuthorIds.push(authorId)
  scheduleSave(); return index < 0
}

const addReview = (workId: string, content: string, rating: number) => {
  const text = content.trim()
  if (!text || !state.works.some(item => item.id === workId)) return false
  state.reviews.unshift({ id: id('review'), workId, authorName: '我', content: text.slice(0, 1200), rating: Math.max(1, Math.min(5, Math.round(rating))), likes: 0, createdAt: Date.now(), source: 'user' })
  const work = state.works.find(item => item.id === workId)!
  work.commentCount += 1
  scheduleSave(); return true
}

const deleteChapter = (workId: string, chapterId: string) => {
  const work = state.works.find(item => item.id === workId); const index = work?.chapters.findIndex(item => item.id === chapterId) ?? -1
  if (!work || index < 0) return false
  work.chapters.splice(index, 1); work.chapters.forEach((chapter, order) => { chapter.order = order + 1 }); work.updatedAt = Date.now(); scheduleSave(); return true
}

const deleteWork = (workId: string) => {
  const index = state.works.findIndex(item => item.id === workId && item.authorId === state.currentAuthorId)
  if (index < 0) return false
  state.works.splice(index, 1); state.shelf = state.shelf.filter(item => item.workId !== workId); state.reviews = state.reviews.filter(item => item.workId !== workId); state.jobs = state.jobs.filter(item => item.workId !== workId); scheduleSave(); return true
}

const updateSettings = (patch: Partial<BookStoreSnapshot['settings']>) => { Object.assign(state.settings, patch); scheduleSave() }

const addLibraryBooks = (books: Array<Omit<BookStoreLibraryBook, 'id' | 'addedAt' | 'updatedAt'>>) => {
  const added: BookStoreLibraryBook[] = []
  books.forEach(input => {
    const duplicate = state.library.find(book => (input.sourceId && book.sourceId === input.sourceId) || `${book.title}|${book.author}|${book.size}` === `${input.title}|${input.author}|${input.size}`)
    if (duplicate) { added.push(duplicate); return }
    const timestamp = Date.now()
    const book: BookStoreLibraryBook = { ...input, id: id('book'), addedAt: timestamp, updatedAt: timestamp }
    state.library.unshift(book)
    state.readingStates.unshift({ bookId: book.id, progressOffset: 0, progressPercent: 0, status: 'unread', addedAt: timestamp, updatedAt: timestamp })
    added.push(book)
    const accountId = localStorage.getItem('clingy_chat_auth_state') || 'guest'
    appendServiceSms(accountId, {
      source: 'books', threadId: 'book-store-service', name: '书城提醒', number: '1069 0021 00',
      text: `《${book.title}》已加入书库${book.author ? `，作者：${book.author}` : ''}。`, relatedId: `book-added:${book.id}`, category: 'service', createdAt: timestamp
    })
  })
  scheduleSave(); return added
}

const removeLibraryBook = (bookId: string) => {
  const index = state.library.findIndex(book => book.id === bookId)
  if (index < 0) return false
  state.library.splice(index, 1)
  state.readingStates = state.readingStates.filter(item => item.bookId !== bookId)
  state.annotations = state.annotations.filter(item => !(item.targetKind === 'library' && item.targetId === bookId))
  scheduleSave(); return true
}

const saveLibraryProgress = (bookId: string, chapterId: string, progressOffset = 0, progressPercent = 0) => {
  let reading = state.readingStates.find(item => item.bookId === bookId)
  const timestamp = Date.now()
  if (!reading) {
    reading = { bookId, progressOffset: 0, progressPercent: 0, status: 'unread', addedAt: timestamp, updatedAt: timestamp }
    state.readingStates.unshift(reading)
  }
  reading.chapterId = chapterId
  reading.progressOffset = Math.max(0, progressOffset)
  reading.progressPercent = Math.max(0, Math.min(100, progressPercent))
  reading.status = reading.progressPercent >= 99.5 ? 'finished' : 'reading'
  reading.lastReadAt = timestamp; reading.updatedAt = timestamp; scheduleSave()
}

const setReadStatus = (bookId: string, status: BookStoreReadingState['status']) => {
  let reading = state.readingStates.find(item => item.bookId === bookId)
  const timestamp = Date.now()
  if (!reading) { reading = { bookId, progressOffset: 0, progressPercent: 0, status, addedAt: timestamp, updatedAt: timestamp }; state.readingStates.unshift(reading) }
  reading.status = status
  if (status === 'finished') reading.progressPercent = 100
  if (status === 'unread') { reading.progressPercent = 0; reading.progressOffset = 0; reading.chapterId = undefined; reading.lastReadAt = undefined }
  reading.updatedAt = timestamp; scheduleSave()
}

const addAnnotation = (input: Omit<BookStoreAnnotation, 'id' | 'createdAt' | 'updatedAt'>) => {
  const timestamp = Date.now()
  const annotation: BookStoreAnnotation = { ...input, id: id('annotation'), createdAt: timestamp, updatedAt: timestamp }
  state.annotations.unshift(annotation); scheduleSave(); return annotation
}

const updateAnnotation = (annotationId: string, patch: Partial<Pick<BookStoreAnnotation, 'note' | 'color'>>) => {
  const annotation = state.annotations.find(item => item.id === annotationId)
  if (!annotation) return false
  Object.assign(annotation, patch, { updatedAt: Date.now() }); scheduleSave(); return true
}

const removeAnnotation = (annotationId: string) => {
  const index = state.annotations.findIndex(item => item.id === annotationId)
  if (index < 0) return false
  state.annotations.splice(index, 1); scheduleSave(); return true
}

const requestWithRetry = async (messages: any[], signal: AbortSignal) => {
  let lastError: unknown
  for (let attempt = 0; attempt <= state.settings.retryLimit; attempt++) {
    try { return await sendCapabilityMessage('bookstore-writing', messages, { signal }) }
    catch (cause: any) {
      lastError = cause
      if (signal.aborted || /API Key|余额|model|模型|参数|401|403|404/i.test(String(cause?.message || ''))) throw cause
      if (attempt < state.settings.retryLimit) await new Promise(resolve => setTimeout(resolve, 600 * 2 ** attempt + Math.round(Math.random() * 240)))
    }
  }
  throw lastError
}

const runJob = async (jobId: string) => {
  const job = state.jobs.find(item => item.id === jobId); const work = job && state.works.find(item => item.id === job.workId)
  if (!job || !work || busy.value) return false
  const budget = estimateGenerationBudget(job.prompt, job.targetLength)
  const remainingChunks = Math.max(1, budget.chunks - job.completedChunks)
  const remainingRatio = remainingChunks / budget.chunks
  const projected = Math.ceil(budget.estimatedTotalTokens * remainingRatio)
  if (budget.estimatedTotalTokens > state.settings.perTaskTokenBudget) { job.status = 'paused'; job.error = `预计约 ${budget.estimatedTotalTokens} Tokens，超过单任务预算 ${state.settings.perTaskTokenBudget}`; scheduleSave(); return false }
  if (todayUsage.value + projected > state.settings.dailyTokenBudget) { job.status = 'paused'; job.error = '继续生成会超过今日 Token 预算'; scheduleSave(); return false }
  busy.value = true; error.value = ''; activeController = new AbortController(); job.status = 'running'; job.error = ''; job.totalChunks = budget.chunks; job.updatedAt = Date.now(); scheduleSave()
  cancelledJobIds.delete(job.id)
  const startCompletedChunks = job.completedChunks
  const usage: BookStoreUsageRecord = { id: id('usage'), jobId: job.id, workId: work.id, kind: job.kind, estimatedInputTokens: Math.ceil(budget.estimatedInputTokens * remainingRatio), estimatedOutputTokens: Math.ceil(budget.estimatedOutputTokens * remainingRatio), status: 'estimated', createdAt: Date.now() }
  state.usage.push(usage)
  try {
    if (job.kind === 'outline') {
      const result = await requestWithRetry([{ role: 'system', content: '你是小说策划编辑。只输出清晰、可执行的中文作品大纲，包含核心冲突、人物弧光、分卷方向和章节建议。不要输出聊天内容。' }, { role: 'user', content: `${buildChapterContext(work)}\n用户要求：${job.prompt}` }], activeController.signal)
      work.outline = String((result as any)?.content || result).trim().slice(0, 12000); work.aiDisclosure = 'assisted'; job.completedChunks = 1; job.progress = 100
      usage.actualTokens = Number((result as any)?.tokens || 0) || undefined
    } else if (job.kind === 'chapter') {
      const chapter = work.chapters.find(item => item.id === job.chapterId) || addChapter(work.id, '')
      if (!chapter) throw new Error('找不到待生成章节')
      let assembled = job.completedChunks ? chapter.content : ''
      for (let index = job.completedChunks; index < budget.chunks; index++) {
        const remaining = Math.max(200, job.targetLength - assembled.length)
        const target = Math.min(budget.chunkChars, remaining)
        const result = await requestWithRetry([{ role: 'system', content: `你是严谨的中文小说作者。仅输出可直接接入正文的小说内容，不要解释，不要标题，不要Markdown。保持人物、时间线、视角和文风一致。本段约${target}字，避免重复上一段。` }, { role: 'user', content: `${buildChapterContext(work, chapter.id)}\n当前章节：${chapter.title}\n写作要求：${job.prompt}\n本章已生成内容末尾：\n${assembled.slice(-900) || '尚未开始'}` }], activeController.signal)
        const text = String((result as any)?.content || result).trim()
        if (!text) throw new Error('模型没有返回正文')
        assembled = `${assembled}${assembled ? '\n\n' : ''}${text}`
        chapter.content = assembled; chapter.wordCount = countBookStoreWords(assembled); chapter.updatedAt = Date.now(); job.completedChunks = index + 1; job.progress = Math.round(job.completedChunks / budget.chunks * 100); job.updatedAt = Date.now()
        usage.actualTokens = (usage.actualTokens || 0) + (Number((result as any)?.tokens || 0) || 0)
        await saveBookStoreSnapshot(state)
      }
      chapter.summary ||= assembled.slice(0, 180); work.aiDisclosure = 'assisted'
    }
    job.status = 'completed'; job.progress = 100; job.error = ''; usage.status = 'success'; scheduleSave(); return true
  } catch (cause: any) {
    if (cancelledJobIds.has(job.id)) { job.status = 'cancelled'; job.error = ''; cancelledJobIds.delete(job.id) }
    else if (activeController.signal.aborted) { job.status = 'paused'; job.error = '任务已暂停，可从已完成内容继续。' }
    else { const message = String(cause?.message || '生成失败'); job.status = 'failed'; job.error = message; error.value = message }
    if (!usage.actualTokens) {
      const attemptedChunks = Math.max(1, job.completedChunks - startCompletedChunks)
      usage.estimatedInputTokens = Math.ceil(usage.estimatedInputTokens * attemptedChunks / remainingChunks)
      usage.estimatedOutputTokens = Math.ceil(usage.estimatedOutputTokens * attemptedChunks / remainingChunks)
    }
    usage.status = 'failed'; scheduleSave(); return false
  } finally { job.updatedAt = Date.now(); busy.value = false; activeController = null; await saveBookStoreSnapshot(state) }
}

const createJob = (input: Pick<BookStoreGenerationJob, 'kind' | 'workId' | 'prompt' | 'targetLength'> & { chapterId?: string }) => {
  const createdAt = Date.now(); const budget = estimateGenerationBudget(input.prompt, input.targetLength)
  const job: BookStoreGenerationJob = { id: id('job'), ...input, status: 'queued', progress: 0, completedChunks: 0, totalChunks: budget.chunks, createdAt, updatedAt: createdAt }
  state.jobs.unshift(job); scheduleSave(); return job
}

const pauseJob = () => activeController?.abort()
const cancelJob = (jobId: string) => { const job = state.jobs.find(item => item.id === jobId); if (!job) return; if (job.status === 'running') { cancelledJobIds.add(jobId); activeController?.abort() }; job.status = 'cancelled'; job.error = ''; job.updatedAt = Date.now(); scheduleSave() }

export const useBookStore = () => ({ state, ready: readonly(ready), busy: readonly(busy), error: readonly(error), currentAuthor, myWorks, shelfWorks, libraryBooks, activeJobs, todayUsage, initialize, createWork, updateWork, addChapter, saveChapter, publishChapter, deleteChapter, deleteWork, toggleShelf, saveProgress, toggleFollow, addReview, updateSettings, addLibraryBooks, removeLibraryBook, saveLibraryProgress, setReadStatus, addAnnotation, updateAnnotation, removeAnnotation, createJob, runJob, pauseJob, cancelJob })
