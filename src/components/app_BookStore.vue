<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { globalSettings } from '../store/global'
import { useBookStore } from '../composables/useBookStore'
import { calculateBookStoreRankScore, countBookStoreWords, estimateGenerationBudget } from '../services/bookStoreEngine'
import BookImportCenter from './bookstore/BookImportCenter.vue'
import BookOnlineSearch from './bookstore/BookOnlineSearch.vue'
import type { BookImportCandidate } from '../services/bookImportService'
import type { BookStoreAnnotation, BookStoreChapter, BookStoreLibraryBook, BookStoreWork, BookStoreWorkKind } from '../types/bookstore'

const emit = defineEmits<{ (e: 'close'): void; (e: 'open-api'): void }>()
const store = useBookStore()
type Tab = 'home' | 'explore' | 'create' | 'shelf' | 'profile'
type Route = { name: 'tabs' } | { name: 'detail'; workId: string } | { name: 'library-detail'; bookId: string } | { name: 'reader'; targetKind: 'work' | 'library'; targetId: string; chapterId: string } | { name: 'editor'; workId: string; chapterId?: string } | { name: 'jobs' } | { name: 'settings' } | { name: 'import' } | { name: 'online' }
const activeTab = ref<Tab>('home')
const route = ref<Route>({ name: 'tabs' })
const search = ref('')
const librarySearch = ref('')
const libraryStatus = ref<'all' | 'unread' | 'reading' | 'finished'>('all')
const exploreKind = ref<'all' | BookStoreWorkKind>('all')
const toast = ref('')
const listening = ref(false)
const readerScroll = ref<HTMLElement | null>(null)
const showReaderContents = ref(false)
const showAnnotations = ref(false)
const readerSearch = ref('')
const selectionState = reactive({ visible: false, quote: '', start: 0, end: 0, x: 0, y: 0 })
const annotationEditor = reactive<{ visible: boolean; annotationId: string; note: string; color: BookStoreAnnotation['color'] }>({ visible: false, annotationId: '', note: '', color: 'yellow' })
let speechUtterance: SpeechSynthesisUtterance | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined
let progressTimer: ReturnType<typeof setTimeout> | undefined
let wakeLock: { release: () => Promise<void> } | null = null
const notify = (message: string) => { toast.value = message; if (toastTimer) clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 2400) }
onMounted(() => store.initialize())
const stopListening = () => {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  speechUtterance = null
  listening.value = false
}
onBeforeUnmount(() => { stopListening(); if (progressTimer) clearTimeout(progressTimer); void wakeLock?.release() })

const activeWork = computed(() => {
  const current = route.value
  return 'workId' in current ? store.state.works.find(item => item.id === current.workId) || null : current.name === 'reader' && current.targetKind === 'work' ? store.state.works.find(item => item.id === current.targetId) || null : null
})
const activeLibraryBook = computed(() => {
  const current = route.value
  const bookId = current.name === 'library-detail' ? current.bookId : current.name === 'reader' && current.targetKind === 'library' ? current.targetId : ''
  return store.state.library.find(item => item.id === bookId) || null
})
const readerTarget = computed(() => activeLibraryBook.value || activeWork.value)
const activeChapter = computed(() => {
  const current = route.value
  return current.name === 'reader' ? readerTarget.value?.chapters.find(item => item.id === current.chapterId) || null : current.name === 'editor' ? activeWork.value?.chapters.find(item => item.id === current.chapterId) || null : null
})
const rankedWorks = computed(() => store.state.works.slice().sort((a, b) => calculateBookStoreRankScore(b) - calculateBookStoreRankScore(a)))
const featuredWorks = computed(() => store.state.works.filter(item => item.featured).slice(0, 5))
const filteredWorks = computed(() => {
  const query = search.value.trim().toLowerCase()
  return rankedWorks.value.filter(work => (exploreKind.value === 'all' || work.kind === exploreKind.value) && (!query || `${work.title} ${work.authorName} ${work.summary} ${work.category} ${work.tags.join(' ')} ${work.fandom || ''} ${work.characters.join(' ')} ${work.relationships.join(' ')}`.toLowerCase().includes(query)))
})
const filteredLibraryBooks = computed(() => {
  const query = librarySearch.value.trim().toLowerCase()
  return store.libraryBooks.value.filter(book => {
    const status = store.state.readingStates.find(item => item.bookId === book.id)?.status || 'unread'
    return (libraryStatus.value === 'all' || status === libraryStatus.value) && (!query || `${book.title} ${book.author} ${book.summary} ${book.tags.join(' ')}`.toLowerCase().includes(query))
  })
})
const totalWritingWords = computed(() => store.myWorks.value.reduce((sum, work) => sum + work.chapters.reduce((n, chapter) => n + chapter.wordCount, 0), 0))
const inShelf = (workId: string) => store.state.shelf.some(item => item.workId === workId)
const isFollowing = (authorId: string) => store.state.followedAuthorIds.includes(authorId)
const publishedChapters = (work: BookStoreWork) => work.chapters.filter(item => item.status === 'published').sort((a, b) => a.order - b.order)
const coverStyle = (work: BookStoreWork) => ({ backgroundImage: work.cover ? `url(${work.cover})` : `linear-gradient(145deg,${work.coverColor},color-mix(in srgb,${work.coverColor} 58%,#18191d))` })
const openWork = (work: BookStoreWork) => { route.value = { name: 'detail', workId: work.id } }
const goBack = () => {
  const current = route.value
  if (current.name === 'reader') { stopListening(); showReaderContents.value = false; showAnnotations.value = false; selectionState.visible = false; route.value = current.targetKind === 'work' ? { name: 'detail', workId: current.targetId } : { name: 'library-detail', bookId: current.targetId }; return }
  route.value = current.name === 'editor' ? { name: 'detail', workId: current.workId } : { name: 'tabs' }
}
const openReader = (work: BookStoreWork, chapter?: BookStoreChapter) => {
  const target = chapter || publishedChapters(work)[0]
  if (!target) return notify('这本作品还没有已发布章节')
  store.saveProgress(work.id, target.id); route.value = { name: 'reader', targetKind: 'work', targetId: work.id, chapterId: target.id }; nextTick(restoreReaderPosition)
}
const openLibraryBook = (book: BookStoreLibraryBook) => { route.value = { name: 'library-detail', bookId: book.id } }
const openLibraryReader = (book: BookStoreLibraryBook, chapter?: BookStoreChapter) => {
  const state = store.state.readingStates.find(item => item.bookId === book.id)
  const target = chapter || book.chapters.find(item => item.id === state?.chapterId) || book.chapters[0]
  if (!target) return notify('这本书没有可读取的正文')
  store.saveLibraryProgress(book.id, target.id, state?.progressOffset || 0, state?.progressPercent || 0)
  route.value = { name: 'reader', targetKind: 'library', targetId: book.id, chapterId: target.id }; nextTick(restoreReaderPosition)
}
const nextChapter = (direction: -1 | 1) => {
  const book = readerTarget.value; const current = activeChapter.value; const currentRoute = route.value
  if (!book || !current || currentRoute.name !== 'reader') return
  const list = 'authorId' in book ? publishedChapters(book) : book.chapters.slice().sort((a, b) => a.order - b.order); const index = list.findIndex(item => item.id === current.id); const target = list[index + direction]
  if (!target) return notify(direction > 0 ? '已经是最后一章' : '已经是第一章')
  stopListening(); if (currentRoute.targetKind === 'work') store.saveProgress(currentRoute.targetId, target.id); else store.saveLibraryProgress(currentRoute.targetId, target.id, 0, Math.round((index + direction) / Math.max(1, list.length - 1) * 100))
  route.value = { ...currentRoute, chapterId: target.id }; nextTick(() => readerScroll.value?.scrollTo({ top: 0 }))
}
const toggleListen = () => {
  if (listening.value) return stopListening()
  const chapter = activeChapter.value
  if (!chapter || typeof window === 'undefined' || !('speechSynthesis' in window)) return notify('当前设备暂不支持系统朗读')
  stopListening()
  speechUtterance = new SpeechSynthesisUtterance(`${chapter.title}。${chapter.content}`)
  speechUtterance.lang = activeLibraryBook.value?.language || 'zh-CN'; speechUtterance.rate = store.state.settings.ttsRate; speechUtterance.pitch = store.state.settings.ttsPitch
  speechUtterance.onend = stopListening; speechUtterance.onerror = stopListening
  window.speechSynthesis.speak(speechUtterance); listening.value = true; notify('正在使用设备语音朗读，不消耗 API')
}

const readerChapters = computed(() => {
  const target = readerTarget.value
  if (!target) return []
  return ('authorId' in target ? publishedChapters(target) : target.chapters.slice().sort((a, b) => a.order - b.order))
})
const currentAnnotations = computed(() => {
  const current = route.value; const chapter = activeChapter.value
  if (current.name !== 'reader' || !chapter) return []
  return store.state.annotations.filter(item => item.targetKind === current.targetKind && item.targetId === current.targetId && item.chapterId === chapter.id).sort((a, b) => a.start - b.start)
})
const visibleAnnotations = computed(() => {
  const current = route.value
  if (current.name === 'reader') return store.state.annotations.filter(item => item.targetKind === current.targetKind && item.targetId === current.targetId).sort((a, b) => b.updatedAt - a.updatedAt)
  if (current.name === 'library-detail') return store.state.annotations.filter(item => item.targetKind === 'library' && item.targetId === current.bookId).sort((a, b) => b.updatedAt - a.updatedAt)
  return []
})
const readerParagraphs = computed(() => {
  const content = activeChapter.value?.content || ''
  const paragraphs: Array<{ text: string; start: number; segments: Array<{ text: string; annotation?: BookStoreAnnotation }> }> = []
  for (const match of content.matchAll(/[^\n]+/g)) {
    const paragraph = match[0].trim(); if (!paragraph) continue
    const start = (match.index || 0) + match[0].indexOf(paragraph); const end = start + paragraph.length
    const marks = currentAnnotations.value.filter(item => item.kind !== 'bookmark' && item.end > start && item.start < end)
    const boundaries = [...new Set([start, end, ...marks.flatMap(item => [Math.max(start, item.start), Math.min(end, item.end)])])].sort((a, b) => a - b)
    const segments = boundaries.slice(0, -1).map((point, index) => ({ text: content.slice(point, boundaries[index + 1]), annotation: marks.find(item => item.start <= point && item.end >= boundaries[index + 1]!) }))
    paragraphs.push({ text: paragraph, start, segments })
  }
  return paragraphs
})
const filteredReaderChapters = computed(() => {
  const query = readerSearch.value.trim().toLowerCase()
  if (!query) return readerChapters.value
  return readerChapters.value.filter(chapter => `${chapter.title} ${chapter.content}`.toLowerCase().includes(query))
})
const readerStyle = computed(() => ({ fontSize: `${store.state.settings.fontSize}px`, lineHeight: store.state.settings.lineHeight, maxWidth: `${store.state.settings.contentWidth}px` }))
const readerClass = computed(() => [`font-${store.state.settings.fontFamily}`, `align-${store.state.settings.textAlign}`, { 'no-indent': !store.state.settings.paragraphIndent }])

const restoreReaderPosition = () => {
  const current = route.value
  if (current.name !== 'reader') return
  const offset = current.targetKind === 'library' ? store.state.readingStates.find(item => item.bookId === current.targetId)?.progressOffset || 0 : store.state.shelf.find(item => item.workId === current.targetId)?.progressOffset || 0
  requestAnimationFrame(() => readerScroll.value?.scrollTo({ top: offset }))
  void syncWakeLock()
}
const onReaderScroll = () => {
  const element = readerScroll.value; const current = route.value
  if (!element || current.name !== 'reader') return
  if (progressTimer) clearTimeout(progressTimer)
  progressTimer = setTimeout(() => {
    const max = Math.max(1, element.scrollHeight - element.clientHeight)
    const chapterPercent = Math.min(100, element.scrollTop / max * 100)
    const chapterIndex = Math.max(0, readerChapters.value.findIndex(item => item.id === current.chapterId))
    const percent = (chapterIndex + chapterPercent / 100) / Math.max(1, readerChapters.value.length) * 100
    if (current.targetKind === 'work') store.saveProgress(current.targetId, current.chapterId, element.scrollTop)
    else store.saveLibraryProgress(current.targetId, current.chapterId, element.scrollTop, percent)
  }, 220)
}
const openReaderChapter = (chapter: BookStoreChapter) => {
  const current = route.value; if (current.name !== 'reader') return
  stopListening(); route.value = { ...current, chapterId: chapter.id }; showReaderContents.value = false; readerSearch.value = ''; nextTick(() => readerScroll.value?.scrollTo({ top: 0 }))
}
const syncWakeLock = async () => {
  if (wakeLock) { await wakeLock.release().catch(() => undefined); wakeLock = null }
  if (!store.state.settings.keepScreenAwake || route.value.name !== 'reader' || !('wakeLock' in navigator)) return
  try { wakeLock = await (navigator as any).wakeLock.request('screen') }
  catch { notify('当前浏览器未允许保持屏幕常亮') }
}
const updateReaderSetting = (patch: Parameters<typeof store.updateSettings>[0]) => { store.updateSettings(patch); if ('keepScreenAwake' in patch) void syncWakeLock() }
const captureSelection = () => {
  const selection = window.getSelection(); const article = readerScroll.value?.querySelector('article')
  if (!selection || !article || selection.isCollapsed || !selection.rangeCount || !article.contains(selection.anchorNode) || !article.contains(selection.focusNode)) return
  const quote = selection.toString().trim().slice(0, 1200); const content = activeChapter.value?.content || ''
  if (!quote) return
  const anchorElement = selection.anchorNode instanceof Element ? selection.anchorNode : selection.anchorNode?.parentElement
  const paragraph = anchorElement?.closest<HTMLElement>('p[data-start]')
  let start = content.indexOf(quote)
  if (paragraph && selection.anchorNode && paragraph.contains(selection.focusNode)) {
    const before = document.createRange(); before.selectNodeContents(paragraph); before.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset)
    start = Number(paragraph.dataset.start || 0) + before.toString().length
  }
  if (start < 0) return
  const range = selection.getRangeAt(0); const rect = range.getBoundingClientRect()
  Object.assign(selectionState, { visible: true, quote, start, end: start + quote.length, x: Math.max(12, Math.min(window.innerWidth - 170, rect.left)), y: Math.max(54, rect.top - 42) })
}
const createAnnotation = (kind: 'highlight' | 'note') => {
  const current = route.value; const chapter = activeChapter.value
  if (current.name !== 'reader' || !chapter || !selectionState.quote) return
  const annotation = store.addAnnotation({ targetKind: current.targetKind, targetId: current.targetId, chapterId: chapter.id, kind, start: selectionState.start, end: selectionState.end, quote: selectionState.quote, prefix: chapter.content.slice(Math.max(0, selectionState.start - 32), selectionState.start), suffix: chapter.content.slice(selectionState.end, selectionState.end + 32), color: 'yellow', note: '' })
  window.getSelection()?.removeAllRanges(); selectionState.visible = false
  if (kind === 'note') editAnnotation(annotation)
  else notify('已划重点')
}
const closeSelection = () => { selectionState.visible = false; window.getSelection()?.removeAllRanges() }
const addBookmark = () => {
  const current = route.value; const chapter = activeChapter.value; if (current.name !== 'reader' || !chapter) return
  const exists = currentAnnotations.value.find(item => item.kind === 'bookmark')
  if (exists) { store.removeAnnotation(exists.id); notify('已取消本章书签'); return }
  store.addAnnotation({ targetKind: current.targetKind, targetId: current.targetId, chapterId: chapter.id, kind: 'bookmark', start: 0, end: 0, quote: chapter.title, prefix: '', suffix: '', color: 'yellow', note: '' }); notify('已添加本章书签')
}
const editAnnotation = (annotation: BookStoreAnnotation) => { Object.assign(annotationEditor, { visible: true, annotationId: annotation.id, note: annotation.note, color: annotation.color }) }
const saveAnnotationEditor = () => { store.updateAnnotation(annotationEditor.annotationId, { note: annotationEditor.note.trim(), color: annotationEditor.color }); annotationEditor.visible = false; notify('批注已保存') }
const jumpToAnnotation = (annotation: BookStoreAnnotation) => {
  const target = annotation.targetKind === 'library' ? store.state.library.find(item => item.id === annotation.targetId) : store.state.works.find(item => item.id === annotation.targetId)
  const chapter = target?.chapters.find(item => item.id === annotation.chapterId)
  if (!target || !chapter) return notify('原章节已不存在')
  showAnnotations.value = false
  if (annotation.targetKind === 'library') openLibraryReader(target as BookStoreLibraryBook, chapter)
  else openReader(target as BookStoreWork, chapter)
}

const showCreate = ref(false)
const createDraft = reactive({ title: '', kind: 'original' as BookStoreWorkKind, summary: '', category: '', fandom: '' })
const createNewWork = () => {
  if (!createDraft.title.trim()) return notify('请先填写作品名')
  const work = store.createWork(createDraft); Object.assign(createDraft, { title: '', kind: 'original', summary: '', category: '', fandom: '' }); showCreate.value = false; activeTab.value = 'create'; route.value = { name: 'editor', workId: work.id }
}

const editorTitle = ref('')
const editorContent = ref('')
const editorSummary = ref('')
const editorWorkTitle = ref('')
const editorCategory = ref('')
const editorFandom = ref('')
const editorCharacters = ref('')
const editorRelationships = ref('')
const editorTags = ref('')
const editorWarnings = ref('')
const syncEditor = () => {
  const work = activeWork.value; const chapter = activeChapter.value
  editorTitle.value = chapter?.title || ''; editorContent.value = chapter?.content || ''; editorWorkTitle.value = work?.title || ''; editorSummary.value = work?.summary || ''; editorCategory.value = work?.category || ''; editorFandom.value = work?.fandom || ''; editorCharacters.value = work?.characters.join('，') || ''; editorRelationships.value = work?.relationships.join('，') || ''; editorTags.value = work?.tags.join('，') || ''; editorWarnings.value = work?.warnings.join('，') || ''
}
const openEditor = (work: BookStoreWork, chapter?: BookStoreChapter) => {
  const target = chapter || work.chapters.slice().sort((a, b) => a.order - b.order)[0]
  route.value = { name: 'editor', workId: work.id, chapterId: target?.id }; nextTick(syncEditor)
}
const ensureEditorChapter = () => {
  const work = activeWork.value; if (!work) return null
  let chapter = activeChapter.value
  if (!chapter) { chapter = store.addChapter(work.id, '') || null; if (chapter) route.value = { name: 'editor', workId: work.id, chapterId: chapter.id } }
  return chapter
}
const saveEditor = () => {
  const work = activeWork.value; const chapter = ensureEditorChapter(); if (!work || !chapter) return
  store.updateWork(work.id, { title: editorWorkTitle.value.trim() || work.title, summary: editorSummary.value, category: editorCategory.value.trim() || work.category, fandom: editorFandom.value.trim(), characters: splitTags(editorCharacters.value), relationships: splitTags(editorRelationships.value), tags: splitTags(editorTags.value), warnings: splitTags(editorWarnings.value) })
  store.saveChapter(work.id, chapter.id, { title: editorTitle.value.trim() || `第${chapter.order}章`, content: editorContent.value }); notify('草稿已保存')
}
const publishEditor = () => { saveEditor(); const work = activeWork.value; const chapter = activeChapter.value; if (!work || !chapter || !editorContent.value.trim()) return notify('正文为空，暂时不能发布'); store.publishChapter(work.id, chapter.id); notify('章节已发布') }
const addEditorChapter = () => { const work = activeWork.value; if (!work) return; saveEditor(); const chapter = store.addChapter(work.id); if (chapter) { route.value = { name: 'editor', workId: work.id, chapterId: chapter.id }; nextTick(syncEditor) } }
const splitTags = (value: string) => [...new Set(value.split(/[，,、\n]/).map(item => item.trim()).filter(Boolean))].slice(0, 16)

const aiVisible = ref(false)
const aiMode = ref<'outline' | 'chapter'>('chapter')
const aiPrompt = ref('')
const aiTargetLength = ref(1800)
const aiBudget = computed(() => estimateGenerationBudget(aiPrompt.value, aiTargetLength.value))
const openAi = (mode: 'outline' | 'chapter') => { saveEditor(); aiMode.value = mode; aiPrompt.value = mode === 'outline' ? '整理核心冲突、人物弧光和章节走向' : '按照当前设定和前文自然续写本章'; aiTargetLength.value = mode === 'outline' ? 1200 : 1800; aiVisible.value = true }
const submitAi = async () => {
  const work = activeWork.value; if (!work) return
  const chapter = aiMode.value === 'chapter' ? (ensureEditorChapter() || undefined) : undefined
  const job = store.createJob({ kind: aiMode.value, workId: work.id, chapterId: chapter?.id, prompt: aiPrompt.value, targetLength: aiTargetLength.value })
  aiVisible.value = false; route.value = { name: 'jobs' }; void store.runJob(job.id)
}

const reviewText = ref('')
const reviewRating = ref(5)
const submitReview = () => { const work = activeWork.value; if (!work || !reviewText.value.trim()) return; store.addReview(work.id, reviewText.value, reviewRating.value); reviewText.value = ''; notify('书评已发布') }
const showReaderSettings = ref(false)
const themeClass = computed(() => `theme-${store.state.settings.readerTheme}`)

const finishLibraryImport = async (candidates: BookImportCandidate[]) => {
  const expectedBytes = candidates.reduce((sum, item) => sum + Math.max(item.book.size, item.book.chapters.reduce((total, chapter) => total + new Blob([chapter.content, ...(chapter.images || [])]).size, 0)), 0)
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate().catch(() => null)
    if (estimate?.quota && estimate.usage != null && estimate.quota - estimate.usage < expectedBytes * 1.35) return notify('设备可用存储空间不足，请减少选择或先移除部分本地书籍')
    void navigator.storage.persist?.().catch(() => false)
  }
  const books = store.addLibraryBooks(candidates.map(item => item.book))
  if (!books.length) return notify('没有选择可导入的书籍')
  route.value = { name: 'tabs' }; activeTab.value = 'shelf'; notify(`已将 ${books.length} 本书加入本地书架`)
  if (books.length === 1) openLibraryReader(books[0]!)
}
const importCreativeCandidate = (candidate: BookImportCandidate) => {
  const work = store.createWork({ title: candidate.book.title, kind: 'original', summary: candidate.book.summary, category: candidate.book.category })
  candidate.book.chapters.forEach(source => {
    const chapter = store.addChapter(work.id, source.title)
    if (chapter) store.saveChapter(work.id, chapter.id, { content: source.content, summary: source.summary })
  })
  const first = work.chapters[0]
  route.value = { name: 'editor', workId: work.id, chapterId: first?.id }; nextTick(syncEditor); notify('已作为创作草稿导入，请确认后发布')
}
const exportWork = (work: BookStoreWork) => {
  const body = [`《${work.title}》`, `作者：${work.authorName}`, '', work.summary, '', ...work.chapters.slice().sort((a, b) => a.order - b.order).flatMap(chapter => [chapter.title, '', chapter.content, ''])].join('\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${work.title}.txt`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const confirmState = reactive<{ visible: boolean; title: string; message: string; action?: () => void }>({ visible: false, title: '', message: '' })
const askConfirm = (title: string, message: string, action: () => void) => { Object.assign(confirmState, { visible: true, title, message, action }) }
const confirmAction = () => { confirmState.action?.(); confirmState.visible = false }
const removeCurrentWork = () => { const work = activeWork.value; if (!work) return; askConfirm('删除作品', `“${work.title}”的正文、任务和书评将一并删除，此操作无法撤销。`, () => { store.deleteWork(work.id); route.value = { name: 'tabs' }; activeTab.value = 'create'; notify('作品已删除') }) }
const removeCurrentLibraryBook = () => { const book = activeLibraryBook.value; if (!book) return; askConfirm('移出本地书架', `将删除“${book.title}”的本地正文、进度、书签与批注，此操作无法撤销。`, () => { store.removeLibraryBook(book.id); route.value = { name: 'tabs' }; activeTab.value = 'shelf'; notify('已从本地书架移除') }) }
const applyContract = (work: BookStoreWork) => {
  const words = work.chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0)
  if (work.kind === 'fandom') return notify('同人作品不进入商业签约，可参与同人精选与活动')
  if (words < 5000 || work.status === 'draft') return notify('原创作品发布满 5000 字后可申请模拟签约')
  store.updateWork(work.id, { signed: true }); notify('已通过模拟编辑审核，签约状态已更新')
}
const formatCount = (value: number) => value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value)
const dateText = (value?: number) => value ? new Date(value).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '尚未阅读'
const readStatusText = (bookId: string) => ({ unread: '未读', reading: '在读', finished: '已读完' }[store.state.readingStates.find(item => item.bookId === bookId)?.status || 'unread'])
const formatBytes = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : value >= 1024 ? `${Math.round(value / 1024)} KB` : `${value} B`
</script>

<template>
  <div class="book-store" :class="{ 'is-dark': globalSettings.darkMode }">
    <div v-if="!store.ready.value" class="bs-loading"><i></i><span>正在整理书架…</span></div>

    <template v-else>
      <main v-if="route.name==='tabs'" class="bs-main">
        <section v-if="activeTab==='home'" class="bs-page bs-home">
          <header class="bs-home-head"><button class="bs-close" @click="emit('close')">‹</button><div><small>NRJ READS</small><h1>书城</h1></div><button class="bs-icon-btn" aria-label="搜索" @click="activeTab='explore'">⌕</button></header>
          <div v-if="store.libraryBooks.value[0]" class="continue-card" @click="openLibraryReader(store.libraryBooks.value[0]!)"><div><small>本地阅读 · {{dateText(store.state.readingStates.find(s=>s.bookId===store.libraryBooks.value[0]!.id)?.lastReadAt)}}</small><strong>{{store.libraryBooks.value[0]!.title}}</strong><span>{{readStatusText(store.libraryBooks.value[0]!.id)}} · {{store.libraryBooks.value[0]!.chapters.length}} 章</span></div><b>继续 ›</b></div>
          <div v-else-if="store.shelfWorks.value[0]?.work" class="continue-card" @click="openReader(store.shelfWorks.value[0]!.work!)"><div><small>继续阅读 · {{dateText(store.shelfWorks.value[0]!.entry.lastReadAt)}}</small><strong>{{store.shelfWorks.value[0]!.work!.title}}</strong><span>{{store.shelfWorks.value[0]!.work!.chapters.find(c=>c.id===store.shelfWorks.value[0]!.entry.progressChapterId)?.title||'从第一章开始'}}</span></div><b>继续 ›</b></div>
          <div class="reader-entry-row"><button @click="route={name:'import'}"><i>⇧</i><span><b>导入书籍</b><small>文件、压缩包、URL</small></span></button><button @click="route={name:'online'}"><i>⌕</i><span><b>在线全文</b><small>直接搜索并阅读</small></span></button></div>
          <section class="feature-section"><div class="section-title"><div><small>EDITOR'S PICK</small><h2>今日精选</h2></div><button @click="activeTab='explore'">查看全部</button></div><div class="feature-scroll"><article v-for="work in featuredWorks" :key="work.id" class="feature-book" @click="openWork(work)"><div class="feature-cover" :style="coverStyle(work)"><span>{{work.kind==='fandom'?'同人':'原创'}}</span><b>{{work.title}}</b></div><strong>{{work.title}}</strong><small>{{work.authorName}}</small></article></div></section>
          <section class="rank-section"><div class="section-title"><div><small>TRENDING</small><h2>正在被读到</h2></div></div><button v-for="(work,index) in rankedWorks.slice(0,5)" :key="work.id" class="rank-row" @click="openWork(work)"><i>{{String(index+1).padStart(2,'0')}}</i><div class="mini-cover" :style="coverStyle(work)"></div><span><strong>{{work.title}}</strong><small>{{work.category}} · {{work.tags.slice(0,2).join(' · ')}}</small><em>{{formatCount(work.effectiveReads)}} 人读过</em></span><b>›</b></button></section>
        </section>

        <section v-else-if="activeTab==='explore'" class="bs-page bs-explore">
          <header class="simple-head wide-action"><button class="bs-close" @click="emit('close')">‹</button><h1>发现</h1><button class="head-text" @click="route={name:'online'}">在线全文</button></header>
          <div class="search-box"><span>⌕</span><input v-model="search" placeholder="书名、作者、原作、角色或标签" /></div>
          <div class="filter-row"><button v-for="item in [{id:'all',name:'全部'},{id:'original',name:'原创馆'},{id:'fandom',name:'同人馆'}]" :key="item.id" :class="{active:exploreKind===item.id}" @click="exploreKind=item.id as any">{{item.name}}</button></div>
          <div class="result-caption"><b>{{filteredWorks.length}}</b> 部作品<span>支持标签、角色与关系筛选</span></div>
          <div class="work-list"><button v-for="work in filteredWorks" :key="work.id" class="work-row" @click="openWork(work)"><div class="list-cover" :style="coverStyle(work)"><small>{{work.kind==='fandom'?'衍生':'原创'}}</small></div><span><strong>{{work.title}}</strong><em>{{work.authorName}} · {{work.status==='completed'?'已完结':'连载中'}}</em><p>{{work.summary}}</p><small>{{[work.fandom,...work.tags].filter(Boolean).slice(0,4).join(' · ')}}</small></span></button><div v-if="!filteredWorks.length" class="empty-state">没有找到符合条件的作品<br><small>试试减少关键词或切换作品馆</small></div></div>
        </section>

        <section v-else-if="activeTab==='create'" class="bs-page bs-create">
          <header class="simple-head"><button class="bs-close" @click="emit('close')">‹</button><h1>创作中心</h1><button class="head-text" @click="route={name:'jobs'}">任务</button></header>
          <div class="creator-summary"><div class="creator-avatar">{{store.currentAuthor.value?.avatarText}}</div><span><strong>{{store.currentAuthor.value?.name}}</strong><small>{{store.currentAuthor.value?.signed?'签约作者':'自由创作者'}} · Lv.{{store.currentAuthor.value?.level}}</small></span><button @click="activeTab='profile'">主页</button></div>
          <div class="creator-stats"><span><b>{{store.myWorks.value.length}}</b><small>作品</small></span><span><b>{{formatCount(totalWritingWords)}}</b><small>总字数</small></span><span><b>{{formatCount(store.currentAuthor.value?.followers||0)}}</b><small>粉丝</small></span><span><b>{{store.todayUsage.value}}</b><small>今日 Tokens</small></span></div>
          <div class="creation-actions"><button @click="showCreate=true"><i>＋</i><span><b>创建作品</b><small>原创、同人或短篇</small></span></button><button @click="route={name:'import'}"><i>⇧</i><span><b>导入作品</b><small>书籍或创作草稿</small></span></button></div>
          <div class="section-title compact"><div><small>MY WORKS</small><h2>我的作品</h2></div></div>
          <div class="my-work-list"><article v-for="work in store.myWorks.value" :key="work.id"><button class="my-work-main" @click="openEditor(work)"><div class="my-cover" :style="coverStyle(work)"></div><span><strong>{{work.title}}</strong><small>{{work.status==='draft'?'草稿':work.status==='completed'?'已完结':'连载中'}} · {{work.chapters.reduce((n,c)=>n+c.wordCount,0)}} 字</small><em>{{work.chapters.length}} 章 · {{work.shelfCount}} 收藏 · {{work.commentCount}} 评论</em></span></button><button class="more-text" @click="openWork(work)">作品页</button></article><div v-if="!store.myWorks.value.length" class="empty-state">还没有作品<br><small>写下第一段故事，书城会替你保存每次修改</small></div></div>
        </section>

        <section v-else-if="activeTab==='shelf'" class="bs-page bs-shelf">
          <header class="simple-head"><button class="bs-close" @click="emit('close')">‹</button><h1>书架</h1><button class="head-text" @click="route={name:'import'}">导入</button></header>
          <div v-if="store.libraryBooks.value.length" class="shelf-heading"><strong>本地书库</strong><small>{{store.libraryBooks.value.length}} 本</small></div>
          <div v-if="store.libraryBooks.value.length" class="library-filter"><div><span>⌕</span><input v-model="librarySearch" placeholder="搜索本地书名、作者或正文标签"/></div><select v-model="libraryStatus" aria-label="阅读状态筛选"><option value="all">全部</option><option value="unread">未读</option><option value="reading">在读</option><option value="finished">已读完</option></select></div>
          <div v-if="store.libraryBooks.value.length" class="shelf-grid library-grid"><button v-for="book in filteredLibraryBooks" :key="book.id" @click="openLibraryBook(book)"><div class="shelf-cover local-cover" :style="book.cover?{backgroundImage:`url(${book.cover})`}:{backgroundImage:`linear-gradient(145deg,${book.coverColor},#383633)`}"><span>{{book.format.toUpperCase()}}</span></div><strong>{{book.title}}</strong><small>{{readStatusText(book.id)}} · {{store.state.readingStates.find(s=>s.bookId===book.id)?.progressPercent.toFixed(0)||0}}%</small></button><div v-if="!filteredLibraryBooks.length" class="empty-state shelf-empty">没有符合条件的本地书籍</div></div>
          <div class="shelf-heading"><strong>收藏与阅读进度</strong><small>{{store.shelfWorks.value.length}} 本</small></div>
          <div class="shelf-grid"><button v-for="item in store.shelfWorks.value" :key="item.work!.id" @click="openReader(item.work!)"><div class="shelf-cover" :style="coverStyle(item.work!)"><span>{{item.work!.kind==='fandom'?'同人':'原创'}}</span></div><strong>{{item.work!.title}}</strong><small>{{item.work!.chapters.find(c=>c.id===item.entry.progressChapterId)?.title||'尚未开始'}}</small></button><div v-if="!store.shelfWorks.value.length" class="empty-state shelf-empty">书架还是空的<br><small>在作品页点击“加入书架”即可收藏</small></div></div>
        </section>

        <section v-else class="bs-page bs-profile">
          <header class="simple-head"><button class="bs-close" @click="emit('close')">‹</button><h1>我的</h1><button class="bs-icon-btn small" @click="route={name:'settings'}">⚙</button></header>
          <div class="profile-card"><div class="profile-avatar">{{store.currentAuthor.value?.avatarText}}</div><h2>{{store.currentAuthor.value?.name}}</h2><p>{{store.currentAuthor.value?.bio}}</p><div><span><b>{{store.currentAuthor.value?.followers}}</b><small>粉丝</small></span><span><b>{{store.state.followedAuthorIds.length}}</b><small>关注</small></span><span><b>{{store.currentAuthor.value?.reputation}}</b><small>声望</small></span></div></div>
          <div class="profile-menu"><button @click="activeTab='create'"><i>✎</i><span><b>创作中心</b><small>作品、数据与存稿</small></span><em>›</em></button><button @click="route={name:'import'}"><i>⇧</i><span><b>导入中心</b><small>文件、压缩包与网络地址</small></span><em>›</em></button><button @click="route={name:'online'}"><i>⌕</i><span><b>在线全文</b><small>聚合搜索并保存离线</small></span><em>›</em></button><button @click="route={name:'jobs'}"><i>◴</i><span><b>生成任务</b><small>预算、进度与断点恢复</small></span><em>›</em></button><button @click="route={name:'settings'}"><i>字</i><span><b>阅读与AI预算</b><small>字体、主题和每日上限</small></span><em>›</em></button><button @click="emit('open-api')"><i>API</i><span><b>API 节点</b><small>为书城创作分配模型</small></span><em>›</em></button></div>
          <div class="badge-section"><h3>创作荣誉</h3><span v-for="badge in store.currentAuthor.value?.badges" :key="badge">{{badge}}</span><span>写作者 Lv.{{store.currentAuthor.value?.level}}</span></div>
        </section>
      </main>

      <nav v-if="route.name==='tabs'" class="bs-tabbar"><button v-for="item in [{id:'home',icon:'⌂',name:'书城'},{id:'explore',icon:'⌕',name:'发现'},{id:'create',icon:'✎',name:'创作'},{id:'shelf',icon:'▥',name:'书架'},{id:'profile',icon:'○',name:'我的'}]" :key="item.id" :class="{active:activeTab===item.id,create:item.id==='create'}" @click="activeTab=item.id as Tab"><i>{{item.icon}}</i><span>{{item.name}}</span></button></nav>

      <BookImportCenter v-else-if="route.name==='import'" @close="route={name:'tabs'}" @import="finishLibraryImport" @creative-import="importCreativeCandidate" />
      <BookOnlineSearch v-else-if="route.name==='online'" @close="route={name:'tabs'}" @import="finishLibraryImport" @notice="notify" />

      <section v-else-if="route.name==='detail'&&activeWork" class="bs-overlay bs-detail"><header class="overlay-head"><button @click="goBack">‹</button><span>作品详情</span><button @click="exportWork(activeWork)">导出</button></header><div class="detail-scroll"><div class="book-hero"><div class="detail-cover" :style="coverStyle(activeWork)"><span>{{activeWork.kind==='fandom'?'FANWORK':'ORIGINAL'}}</span></div><div><small>{{activeWork.category}}</small><h1>{{activeWork.title}}</h1><button class="author-link" @click="store.toggleFollow(activeWork.authorId);notify(isFollowing(activeWork.authorId)?'已关注作者':'已取消关注')">{{activeWork.authorName}} <em>{{isFollowing(activeWork.authorId)?'已关注':'＋关注'}}</em></button><p>{{activeWork.status==='completed'?'已完结':'连载中'}} · {{activeWork.chapters.reduce((n,c)=>n+c.wordCount,0)}} 字 · {{activeWork.score||'暂无'}} 分</p></div></div><div v-if="activeWork.kind==='fandom'" class="fandom-meta"><b>{{activeWork.fandom||'未填写原作'}}</b><span>{{activeWork.relationships.join(' · ')||'无关系标签'}}</span><small>{{activeWork.warnings.join(' · ')||'无特殊预警'}}</small></div><p class="book-summary">{{activeWork.summary||'作者还没有填写作品简介。'}}</p><div class="tag-cloud"><span v-for="tag in activeWork.tags" :key="tag">{{tag}}</span><span v-for="warning in activeWork.warnings" :key="warning" class="warning">{{warning}}</span></div><div class="detail-actions"><button class="primary" @click="openReader(activeWork)">开始阅读</button><button :class="{saved:inShelf(activeWork.id)}" @click="store.toggleShelf(activeWork.id);notify(inShelf(activeWork.id)?'已加入书架':'已移出书架')">{{inShelf(activeWork.id)?'已在书架':'加入书架'}}</button></div><div v-if="activeWork.authorId===store.state.currentAuthorId" class="owner-actions"><button @click="openEditor(activeWork)">继续创作</button><button @click="applyContract(activeWork)">{{activeWork.signed?'已模拟签约':'申请模拟签约'}}</button><button class="danger" @click="removeCurrentWork">删除作品</button></div><section class="chapter-section"><h2>目录 <small>{{activeWork.chapters.length}} 章</small></h2><button v-for="chapter in activeWork.chapters.slice().sort((a,b)=>a.order-b.order)" :key="chapter.id" @click="chapter.status==='published'?openReader(activeWork,chapter):activeWork.authorId===store.state.currentAuthorId?openEditor(activeWork,chapter):notify('该章尚未发布')"><span><b>{{chapter.title}}</b><small>{{chapter.wordCount}} 字 · {{chapter.status==='published'?'已发布':'草稿'}}</small></span><em>›</em></button><div v-if="!activeWork.chapters.length" class="empty-state">目录还没有章节</div></section><section class="review-section"><h2>读者书评 <small>{{store.state.reviews.filter(r=>r.workId===activeWork!.id).length}}</small></h2><article v-for="review in store.state.reviews.filter(r=>r.workId===activeWork!.id)" :key="review.id"><div><b>{{review.authorName}}</b><span>{{'★'.repeat(review.rating)}}</span></div><p>{{review.content}}</p><small>{{dateText(review.createdAt)}} · {{review.likes}} 人赞同</small></article><div class="review-compose"><div class="stars"><button v-for="n in 5" :key="n" :class="{active:n<=reviewRating}" @click="reviewRating=n">★</button></div><textarea v-model="reviewText" placeholder="写下真实、具体的阅读感受"></textarea><button @click="submitReview">发布书评</button></div></section></div></section>

      <section v-else-if="route.name==='library-detail'&&activeLibraryBook" class="bs-overlay bs-detail"><header class="overlay-head"><button @click="goBack">‹</button><span>书籍详情</span><button class="danger-text" @click="removeCurrentLibraryBook">移除</button></header><div class="detail-scroll"><div class="book-hero"><div class="detail-cover local-detail-cover" :style="activeLibraryBook.cover?{backgroundImage:`url(${activeLibraryBook.cover})`}:{backgroundImage:`linear-gradient(145deg,${activeLibraryBook.coverColor},#343331)`}"><span>{{activeLibraryBook.format.toUpperCase()}}</span></div><div><small>{{activeLibraryBook.category}}</small><h1>{{activeLibraryBook.title}}</h1><p>{{activeLibraryBook.author}} · {{activeLibraryBook.chapters.length}} 章</p><p>{{formatBytes(activeLibraryBook.size)}} · {{activeLibraryBook.sourceName}}</p></div></div><p class="book-summary">{{activeLibraryBook.summary||'这本书暂时没有简介。'}}</p><div class="tag-cloud"><span>{{activeLibraryBook.origin==='online'?'在线全文':activeLibraryBook.origin==='url'?'URL 导入':'本地导入'}}</span><span v-for="tag in activeLibraryBook.tags" :key="tag">{{tag}}</span></div><div class="detail-actions"><button class="primary" @click="openLibraryReader(activeLibraryBook)">继续阅读</button><button @click="showAnnotations=true">书签与批注 {{store.state.annotations.filter(a=>a.targetKind==='library'&&a.targetId===activeLibraryBook!.id).length}}</button></div><div class="read-status-row"><span>阅读状态</span><button v-for="item in [{id:'unread',name:'未读'},{id:'reading',name:'在读'},{id:'finished',name:'已读完'}]" :key="item.id" :class="{active:readStatusText(activeLibraryBook.id)===item.name}" @click="store.setReadStatus(activeLibraryBook!.id,item.id as any)">{{item.name}}</button></div><section class="chapter-section"><h2>目录 <small>{{activeLibraryBook.chapters.length}} 章</small></h2><button v-for="chapter in activeLibraryBook.chapters.slice().sort((a,b)=>a.order-b.order)" :key="chapter.id" @click="openLibraryReader(activeLibraryBook,chapter)"><span><b>{{chapter.title}}</b><small>{{chapter.images?.length?`${chapter.images.length} 页图片`:`${chapter.wordCount} 字`}}</small></span><em>›</em></button></section><p class="source-footnote">来源：{{activeLibraryBook.sourceName}}<br>{{activeLibraryBook.sourceUrl||activeLibraryBook.fileName}}</p></div></section>

      <section v-else-if="route.name==='reader'&&readerTarget&&activeChapter" class="bs-overlay bs-reader" :class="themeClass"><header class="reader-head"><button @click="goBack">‹</button><span><b>{{readerTarget.title}}</b><small>{{activeChapter.title}}</small></span><div class="reader-tools"><button aria-label="目录" @click="showReaderContents=true">☰</button><button aria-label="书签" :class="{active:currentAnnotations.some(a=>a.kind==='bookmark')}" @click="addBookmark">◇</button><button :aria-label="listening?'停止朗读':'听书'" :class="{active:listening}" @click="toggleListen">{{listening?'■':'▶'}}</button><button aria-label="阅读设置" @click="showReaderSettings=!showReaderSettings">Aa</button></div></header><div ref="readerScroll" class="bs-reader-scroll" @scroll.passive="onReaderScroll" @mouseup="captureSelection" @touchend="captureSelection"><article :class="readerClass" :style="readerStyle"><h1>{{activeChapter.title}}</h1><div v-if="activeChapter.images?.length" class="comic-pages"><img v-for="(image,index) in activeChapter.images" :key="index" :src="image" :alt="`第 ${index+1} 页`" loading="lazy"/></div><template v-else><p v-for="paragraph in readerParagraphs" :key="paragraph.start" :data-start="paragraph.start" :style="{marginBottom:`${store.state.settings.paragraphSpacing}em`}"><span v-for="(segment,index) in paragraph.segments" :key="index" :class="segment.annotation?['reader-mark',`mark-${segment.annotation.color}`]:undefined" @click="segment.annotation&&editAnnotation(segment.annotation)">{{segment.text}}</span></p></template><div class="chapter-end">— 本章完 —</div></article><div class="reader-next"><button @click="nextChapter(-1)">上一章</button><button @click="nextChapter(1)">下一章</button></div></div><div v-if="selectionState.visible" class="selection-menu" :style="{left:`${selectionState.x}px`,top:`${selectionState.y}px`}"><button @click="createAnnotation('highlight')">划重点</button><button @click="createAnnotation('note')">写批注</button><button @click="closeSelection">取消</button></div><div v-if="showReaderSettings" class="reader-panel"><div class="listen-row"><span>听书</span><button @click="toggleListen">{{listening?'停止设备朗读':'开始设备朗读'}}</button><small>不消耗 API</small></div><div><span>字号</span><button @click="updateReaderSetting({fontSize:Math.max(14,store.state.settings.fontSize-1)})">A−</button><b>{{store.state.settings.fontSize}}</b><button @click="updateReaderSetting({fontSize:Math.min(28,store.state.settings.fontSize+1)})">A＋</button></div><div><span>背景</span><button v-for="theme in ['paper','white','green','dark']" :key="theme" :class="['theme-dot',theme,{active:store.state.settings.readerTheme===theme}]" @click="updateReaderSetting({readerTheme:theme as any})"></button></div><div class="panel-options"><span>字体</span><button v-for="item in [{id:'serif',name:'宋体'},{id:'sans',name:'黑体'},{id:'system',name:'系统'}]" :key="item.id" :class="{active:store.state.settings.fontFamily===item.id}" @click="updateReaderSetting({fontFamily:item.id as any})">{{item.name}}</button></div><div class="panel-options"><span>排版</span><button :class="{active:store.state.settings.textAlign==='justify'}" @click="updateReaderSetting({textAlign:store.state.settings.textAlign==='justify'?'left':'justify'})">两端对齐</button><button :class="{active:store.state.settings.paragraphIndent}" @click="updateReaderSetting({paragraphIndent:!store.state.settings.paragraphIndent})">首行缩进</button></div><div class="panel-options"><span>屏幕</span><button :class="{active:store.state.settings.keepScreenAwake}" @click="updateReaderSetting({keepScreenAwake:!store.state.settings.keepScreenAwake})">保持常亮</button><button @click="showAnnotations=true;showReaderSettings=false">书签批注</button></div><button class="panel-close" @click="showReaderSettings=false">完成</button></div></section>

      <section v-else-if="route.name==='editor'&&activeWork" class="bs-overlay bs-editor"><header class="overlay-head"><button @click="goBack">‹</button><span>{{activeChapter?'章节编辑':'作品编辑'}}</span><button @click="saveEditor">保存</button></header><div class="editor-scroll"><div class="editor-work-meta"><small>{{activeWork.kind==='fandom'?'同人创作':'原创创作'}} · 作品资料</small><input v-model="editorWorkTitle" class="work-title-input" placeholder="作品名"/><div class="meta-grid"><input v-model="editorCategory" placeholder="作品分类"/><select :value="activeWork.rating" aria-label="内容分级" @change="store.updateWork(activeWork!.id,{rating:($event.target as HTMLSelectElement).value as any})"><option value="general">全年龄</option><option value="teen">青少年</option><option value="mature">成人向</option><option value="explicit">限制级</option></select></div><textarea v-model="editorSummary" rows="2" placeholder="作品简介"></textarea><template v-if="activeWork.kind==='fandom'"><input v-model="editorFandom" placeholder="原作 / Fandom"/><input v-model="editorCharacters" placeholder="角色，用逗号分隔"/><input v-model="editorRelationships" placeholder="角色关系，用斜线或逗号分隔"/></template><input v-model="editorTags" placeholder="标签，用逗号分隔"/><input v-model="editorWarnings" placeholder="内容预警，用逗号分隔"/><div class="permission-row"><span>授权</span><button :class="{active:activeWork.permission.illustration}" @click="store.updateWork(activeWork!.id,{permission:{...activeWork!.permission,illustration:!activeWork!.permission.illustration}})">配图</button><button :class="{active:activeWork.permission.podfic}" @click="store.updateWork(activeWork!.id,{permission:{...activeWork!.permission,podfic:!activeWork!.permission.podfic}})">有声</button><button :class="{active:activeWork.permission.translation}" @click="store.updateWork(activeWork!.id,{permission:{...activeWork!.permission,translation:!activeWork!.permission.translation}})">翻译</button><button :class="{active:activeWork.permission.continuation}" @click="store.updateWork(activeWork!.id,{permission:{...activeWork!.permission,continuation:!activeWork!.permission.continuation}})">续写</button></div><details v-if="activeWork.outline" class="outline-box"><summary>查看 AI 作品大纲</summary><pre>{{activeWork.outline}}</pre></details></div><div class="chapter-switch"><select :value="activeChapter?.id" @change="route={name:'editor',workId:activeWork!.id,chapterId:($event.target as HTMLSelectElement).value};nextTick(syncEditor)"><option v-for="chapter in activeWork.chapters.slice().sort((a,b)=>a.order-b.order)" :key="chapter.id" :value="chapter.id">{{chapter.title}}</option></select><button @click="addEditorChapter">＋ 新章</button></div><input v-model="editorTitle" class="chapter-title-input" placeholder="章节标题"/><textarea v-model="editorContent" class="chapter-content-input" placeholder="从这里开始写故事…"></textarea><div class="editor-count"><span>{{countBookStoreWords(editorContent)}} 字</span><span>{{activeChapter?.status==='published'?'已发布':'草稿'}}</span></div></div><footer class="editor-toolbar"><button @click="openAi('outline')"><i>◇</i><span>大纲</span></button><button @click="openAi('chapter')"><i>✦</i><span>AI续写</span></button><button @click="saveEditor"><i>▣</i><span>存稿</span></button><button class="publish" @click="publishEditor"><i>↑</i><span>发布</span></button></footer></section>

      <section v-else-if="route.name==='jobs'" class="bs-overlay bs-jobs"><header class="overlay-head"><button @click="route={name:'tabs'}">‹</button><span>生成任务</span><button @click="emit('open-api')">API</button></header><div class="jobs-summary"><span><b>{{store.todayUsage.value}}</b><small>今日 Tokens</small></span><span><b>{{store.state.settings.dailyTokenBudget}}</b><small>每日预算</small></span></div><div class="job-list"><article v-for="job in store.state.jobs" :key="job.id"><div><span><b>{{job.kind==='outline'?'作品大纲':job.kind==='chapter'?'章节正文':'内容任务'}}</b><small>{{store.state.works.find(w=>w.id===job.workId)?.title}}</small></span><em :class="job.status">{{{queued:'等待中',running:'生成中',paused:'已暂停',completed:'已完成',failed:'失败',cancelled:'已取消'}[job.status]}}</em></div><div class="progress"><i :style="{width:`${job.progress}%`}"></i></div><p>{{job.error||`${job.completedChunks}/${job.totalChunks} 个内容块 · ${job.progress}%`}}</p><footer><button v-if="['queued','paused','failed'].includes(job.status)" :disabled="store.busy.value" @click="store.runJob(job.id)">继续生成</button><button v-if="job.status==='running'" @click="store.pauseJob">暂停</button><button v-if="!['completed','cancelled'].includes(job.status)" class="danger" @click="store.cancelJob(job.id)">取消</button></footer></article><div v-if="!store.state.jobs.length" class="empty-state">暂无生成任务<br><small>在章节编辑器中选择“大纲”或“AI续写”</small></div></div></section>

      <section v-else-if="route.name==='settings'" class="bs-overlay bs-settings"><header class="overlay-head"><button @click="route={name:'tabs'}">‹</button><span>阅读与预算</span><i></i></header><div class="settings-scroll"><section><h2>阅读器</h2><label><span><b>正文字号</b><small>当前 {{store.state.settings.fontSize}}px</small></span><input type="range" min="14" max="28" :value="store.state.settings.fontSize" @input="store.updateSettings({fontSize:Number(($event.target as HTMLInputElement).value)})"/></label><label><span><b>行距</b><small>当前 {{store.state.settings.lineHeight}}</small></span><input type="range" min="1.5" max="2.4" step="0.05" :value="store.state.settings.lineHeight" @input="store.updateSettings({lineHeight:Number(($event.target as HTMLInputElement).value)})"/></label></section><section><h2>AI 使用预算</h2><label><span><b>每日 Token 上限</b><small>达到后任务自动暂停</small></span><input class="number-input" type="number" min="1000" step="1000" :value="store.state.settings.dailyTokenBudget" @change="store.updateSettings({dailyTokenBudget:Math.max(1000,Number(($event.target as HTMLInputElement).value))})"/></label><label><span><b>单任务上限</b><small>生成前先估算，不超额执行</small></span><input class="number-input" type="number" min="1000" step="1000" :value="store.state.settings.perTaskTokenBudget" @change="store.updateSettings({perTaskTokenBudget:Math.max(1000,Number(($event.target as HTMLInputElement).value))})"/></label><label><span><b>失败重试次数</b><small>鉴权与余额错误不会重试</small></span><input class="number-input" type="number" min="0" max="5" :value="store.state.settings.retryLimit" @change="store.updateSettings({retryLimit:Math.max(0,Math.min(5,Number(($event.target as HTMLInputElement).value)))})"/></label><button class="setting-link" @click="emit('open-api')"><span><b>书城专属API节点</b><small>为正文与内容生态分别选择模型</small></span><em>›</em></button></section><p class="settings-note">阅读、搜索、书架、榜单、粉丝增长和签约判断均在本地完成，不消耗API。只有明确触发AI创作或精选内容时才会调用模型。</p></div></section>

      <div v-if="showReaderContents" class="bs-modal reader-drawer" @click.self="showReaderContents=false"><section><header><button @click="showReaderContents=false">关闭</button><b>目录与搜索</b><button @click="showAnnotations=true;showReaderContents=false">批注</button></header><div class="drawer-search"><span>⌕</span><input v-model="readerSearch" placeholder="搜索章节标题或正文"/></div><div class="drawer-list"><button v-for="chapter in filteredReaderChapters" :key="chapter.id" :class="{active:chapter.id===activeChapter?.id}" @click="openReaderChapter(chapter)"><span><b>{{chapter.title}}</b><small>{{chapter.images?.length?`${chapter.images.length} 页`:`${chapter.wordCount} 字`}}</small></span><em>›</em></button><p v-if="!filteredReaderChapters.length">没有找到匹配内容</p></div></section></div>

      <div v-if="showAnnotations" class="bs-modal reader-drawer" @click.self="showAnnotations=false"><section><header><button @click="showAnnotations=false">关闭</button><b>书签与批注</b><i></i></header><div class="annotation-list"><article v-for="item in visibleAnnotations" :key="item.id"><button class="annotation-main" @click="jumpToAnnotation(item)"><i :class="`color-${item.color}`"></i><span><b>{{item.kind==='bookmark'?'书签':item.kind==='note'?'批注':'重点'}}</b><small>{{readerTarget?.chapters.find(c=>c.id===item.chapterId)?.title||activeLibraryBook?.chapters.find(c=>c.id===item.chapterId)?.title||'原章节'}}</small><p>{{item.quote}}</p><em v-if="item.note">{{item.note}}</em></span></button><button aria-label="编辑批注" @click="editAnnotation(item)">⋯</button></article><div v-if="!visibleAnnotations.length" class="empty-state">还没有书签或批注<br><small>阅读时点书签，或选中文字划重点</small></div></div></section></div>

      <div v-if="annotationEditor.visible" class="bs-modal annotation-editor" @click.self="annotationEditor.visible=false"><section><header><button @click="annotationEditor.visible=false">取消</button><b>编辑批注</b><button @click="saveAnnotationEditor">保存</button></header><div class="annotation-colors"><button v-for="color in ['yellow','green','blue','pink']" :key="color" :class="[color,{active:annotationEditor.color===color}]" :aria-label="color" @click="annotationEditor.color=color as any"></button></div><textarea v-model="annotationEditor.note" maxlength="2000" rows="6" placeholder="记录想法，也可以只保留划线"></textarea><button class="annotation-delete" @click="store.removeAnnotation(annotationEditor.annotationId);annotationEditor.visible=false;notify('批注已删除')">删除这条标记</button></section></div>

      <div v-if="showCreate" class="bs-modal" @click.self="showCreate=false"><section><header><button @click="showCreate=false">取消</button><b>创建作品</b><button @click="createNewWork">创建</button></header><label><span>作品名称</span><input v-model="createDraft.title" maxlength="40" placeholder="给故事取一个名字"/></label><div class="kind-choice"><button :class="{active:createDraft.kind==='original'}" @click="createDraft.kind='original'"><b>原创</b><small>可参与模拟签约与收益</small></button><button :class="{active:createDraft.kind==='fandom'}" @click="createDraft.kind='fandom'"><b>同人</b><small>支持原作、角色和关系标签</small></button></div><label v-if="createDraft.kind==='fandom'"><span>原作／作品宇宙</span><input v-model="createDraft.fandom" placeholder="例如：月庭纪事"/></label><label><span>分类</span><input v-model="createDraft.category" placeholder="例如：悬疑、现代言情、科幻"/></label><label><span>一句话简介</span><textarea v-model="createDraft.summary" rows="3" placeholder="故事的核心吸引力"></textarea></label></section></div>

      <div v-if="aiVisible" class="bs-modal" @click.self="aiVisible=false"><section><header><button @click="aiVisible=false">取消</button><b>{{aiMode==='outline'?'生成作品大纲':'分块生成正文'}}</b><button @click="submitAi">加入任务</button></header><label><span>写作要求</span><textarea v-model="aiPrompt" rows="5"></textarea></label><label><span>目标长度</span><input v-model.number="aiTargetLength" class="number-input full" type="number" min="200" max="100000" step="200"/></label><div class="budget-card"><b>预计 {{aiBudget.chunks}} 次分块调用</b><span>输入约 {{aiBudget.estimatedInputTokens}} · 输出约 {{aiBudget.estimatedOutputTokens}} Tokens</span><small>每个内容块完成后立即保存，可暂停并继续。</small></div></section></div>

      <div v-if="confirmState.visible" class="bs-modal confirm"><section><h3>{{confirmState.title}}</h3><p>{{confirmState.message}}</p><div><button @click="confirmState.visible=false">取消</button><button class="danger" @click="confirmAction">确认删除</button></div></section></div>
      <Transition name="toast"><div v-if="toast" class="bs-toast">{{toast}}</div></Transition>
    </template>
  </div>
</template>

<style src="./app_BookStore.css" scoped></style>
