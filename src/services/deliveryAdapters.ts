/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { importBubblePresetFile } from './bubbleWorkshop'
import { parseBookFiles } from './bookImportService'
import { loadBookStoreSnapshot, saveBookStoreSnapshot } from './bookStoreRepository'
import { worldBooks, type WorldBook } from '../store/worldBook'
import type { BookStoreLibraryBook } from '../types/bookstore'
import type { DeliveryItem } from '../types/delivery'
import { getDeliveryFiles } from './deliveryService'

export type DeliveryDestination = 'book_store' | 'bubble_dressup' | 'world_book'

const ext = (name: string) => name.split('.').pop()?.toLowerCase() || ''
const bookExtensions = new Set(['txt', 'md', 'markdown', 'json', 'html', 'htm', 'fb2', 'epub', 'docx', 'pdf', 'mobi', 'azw', 'azw3', 'zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cbz'])

export const availableDeliveryDestinations = (item: DeliveryItem) => {
  const result: DeliveryDestination[] = []
  if (item.files.some(file => bookExtensions.has(ext(file.name)))) result.push('book_store')
  if (item.files.some(file => ['nrjbubble', 'zip', 'json'].includes(ext(file.name)))) result.push('bubble_dressup')
  if (item.files.some(file => ext(file.name) === 'json')) result.push('world_book')
  return result
}

const addBooks = async (books: Array<Omit<BookStoreLibraryBook, 'id' | 'addedAt' | 'updatedAt'>>) => {
  const snapshot = await loadBookStoreSnapshot()
  let added = 0
  for (const input of books) {
    const duplicate = snapshot.library.some(book => (input.sourceId && book.sourceId === input.sourceId) || `${book.title}|${book.author}|${book.size}` === `${input.title}|${input.author}|${input.size}`)
    if (duplicate) continue
    const now = Date.now()
    const id = `book_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    snapshot.library.unshift({ ...input, id, addedAt: now, updatedAt: now })
    snapshot.readingStates.unshift({ bookId: id, progressOffset: 0, progressPercent: 0, status: 'unread', addedAt: now, updatedAt: now })
    added++
  }
  if (added) await saveBookStoreSnapshot(snapshot)
  return added
}

const normalizeWorldBook = (raw: any): WorldBook | null => {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.entries)) return null
  const now = Date.now()
  return {
    id: `world_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type: raw.type === 'folder' ? 'folder' : 'book',
    groupIds: [],
    title: String(raw.title || '导入的世界书').slice(0, 100),
    author: String(raw.author || '').slice(0, 100),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String).slice(0, 30) : [],
    rating: Math.max(0, Math.min(5, Number(raw.rating || 0))),
    coverColor: String(raw.coverColor || '#F2E8E3'),
    coverImage: typeof raw.coverImage === 'string' && raw.coverImage.startsWith('data:image/') ? raw.coverImage : '',
    bgImage: typeof raw.bgImage === 'string' && raw.bgImage.startsWith('data:image/') ? raw.bgImage : '',
    bgBlur: Math.max(0, Math.min(100, Number(raw.bgBlur ?? 40))),
    updatedAt: now,
    enabled: raw.enabled !== false,
    globalPosition: ['front', 'middle', 'back', 'custom'].includes(raw.globalPosition) ? raw.globalPosition : 'middle',
    globalDepth: Number(raw.globalDepth || 0),
    globalWeight: Number(raw.globalWeight || 1),
    entries: raw.entries.slice(0, 5000).map((entry: any, index: number) => ({
      id: `entry_${now.toString(36)}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      title: String(entry?.title || `条目 ${index + 1}`).slice(0, 100),
      content: String(entry?.content || '').slice(0, 1_000_000),
      updatedAt: now,
      enabled: entry?.enabled !== false,
      light: entry?.light === 'green' ? 'green' : 'blue',
      keywords: String(entry?.keywords || '').slice(0, 2000),
      overrideSettings: entry?.overrideSettings === true,
      position: ['front', 'middle', 'back', 'custom'].includes(entry?.position) ? entry.position : 'middle',
      depth: Number(entry?.depth || 0),
      weight: Number(entry?.weight || 1)
    }))
  }
}

export const importDeliveryToDestination = async (item: DeliveryItem, destination: DeliveryDestination) => {
  const files = await getDeliveryFiles(item)
  if (destination === 'book_store') {
    const result = await parseBookFiles(files.filter(file => bookExtensions.has(ext(file.name))))
    if (!result.candidates.length) throw new Error(result.errors[0] || '投递中没有可导入的书籍')
    const added = await addBooks(result.candidates.map(candidate => candidate.book))
    return added ? `已向书城加入 ${added} 本书` : '书城中已有相同书籍，未重复导入'
  }
  if (destination === 'bubble_dressup') {
    const candidates = files.filter(file => ['nrjbubble', 'zip', 'json'].includes(ext(file.name)))
    let added = 0
    let lastError = ''
    for (const file of candidates) {
      try { added += (await importBubblePresetFile(file)).length } catch (error) { lastError = error instanceof Error ? error.message : '无法解析气泡方案' }
    }
    if (!added) throw new Error(lastError || '投递中没有有效的气泡方案')
    return `已向气泡工坊加入 ${added} 个方案`
  }
  const jsonFiles = files.filter(file => ext(file.name) === 'json')
  const imported: WorldBook[] = []
  for (const file of jsonFiles) {
    let raw: any
    try { raw = JSON.parse(await file.text()) } catch { continue }
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.worldBooks) ? raw.worldBooks : [raw]
    list.forEach((value: any) => { const book = normalizeWorldBook(value); if (book) imported.push(book) })
  }
  if (!imported.length) throw new Error('投递中的 JSON 不是可识别的世界书格式')
  worldBooks.unshift(...imported)
  return `已向世界书加入 ${imported.length} 本内容`
}

