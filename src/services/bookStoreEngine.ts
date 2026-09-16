/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { BookStoreWork } from '../types/bookstore'
import { estimateTextTokens } from '../utils/tokenEstimate'

export const countBookStoreWords = (value: string) => {
  const text = String(value || '').trim()
  if (!text) return 0
  const cjk = (text.match(/[\u3400-\u9fff\uf900-\ufaff]/g) || []).length
  const words = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []
  return cjk + words.length
}

export const calculateBookStoreRankScore = (work: Pick<BookStoreWork, 'effectiveReads' | 'shelfCount' | 'commentCount' | 'score' | 'updatedAt'>, now = Date.now()) => {
  const ageDays = Math.max(0, (now - work.updatedAt) / 86400000)
  const freshness = Math.max(0.35, Math.exp(-ageDays / 45))
  return Math.round((work.effectiveReads * .18 + work.shelfCount * 2.8 + work.commentCount * 5.5 + work.score * 32) * freshness)
}

export const estimateGenerationBudget = (prompt: string, targetLength: number) => {
  const safeLength = Math.max(200, Math.min(100000, Math.round(targetLength || 0)))
  const chunkChars = safeLength <= 2600 ? safeLength : 1400
  const chunks = Math.max(1, Math.ceil(safeLength / chunkChars))
  const inputPerChunk = estimateTextTokens(prompt) + 900
  const outputPerChunk = Math.ceil(chunkChars * 1.08)
  return {
    chunks,
    chunkChars,
    estimatedInputTokens: inputPerChunk * chunks,
    estimatedOutputTokens: outputPerChunk * chunks,
    estimatedTotalTokens: (inputPerChunk + outputPerChunk) * chunks
  }
}

export const simulateBookStoreWork = (work: BookStoreWork, elapsedHours: number, seed = Date.now()) => {
  const hours = Math.max(0, Math.min(168, elapsedHours))
  if (!hours || work.status === 'draft' || !work.chapters.some(chapter => chapter.status === 'published')) return { views: 0, reads: 0, shelves: 0, comments: 0, followers: 0 }
  const hash = [...`${work.id}:${Math.floor(seed / 3600000)}`].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
  const freshness = Math.max(.3, Math.exp(-(Date.now() - work.updatedAt) / 86400000 / 60))
  const quality = Math.max(.45, Math.min(1.35, work.score / 4.2))
  const exposure = Math.max(1, Math.round(hours * (2.2 + (hash % 7) / 4) * freshness * quality))
  const reads = Math.round(exposure * (.38 + (hash % 13) / 100))
  const shelves = Math.round(reads * (.08 + (hash % 8) / 100))
  const comments = Math.min(3, Math.floor(reads / 18))
  const followers = Math.floor(shelves / 5)
  return { views: exposure, reads, shelves, comments, followers }
}

export const buildChapterContext = (work: BookStoreWork, chapterId?: string) => {
  const chapters = work.chapters.slice().sort((a, b) => a.order - b.order)
  const targetIndex = Math.max(0, chapterId ? chapters.findIndex(item => item.id === chapterId) : chapters.length - 1)
  const previous = chapters.slice(0, targetIndex).slice(-3)
  const summaries = previous.map(item => `${item.title}：${item.summary || item.content.slice(0, 260)}`).join('\n')
  const lastTail = previous.at(-1)?.content.slice(-700) || ''
  return `作品：${work.title}\n类型：${work.kind === 'fandom' ? `同人，原作：${work.fandom || '未填写'}` : '原创'}\n简介：${work.summary}\n标签：${work.tags.join('、')}\n角色：${work.characters.join('、') || '未填写'}\n关系：${work.relationships.join('、') || '未填写'}\n内容预警：${work.warnings.join('、') || '无'}\n最近章节摘要：\n${summaries || '这是开篇'}\n上一章结尾：\n${lastTail || '无'}`
}
