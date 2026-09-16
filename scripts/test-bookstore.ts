/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { buildChapterContext, calculateBookStoreRankScore, countBookStoreWords, estimateGenerationBudget, simulateBookStoreWork } from '../src/services/bookStoreEngine'
import { splitBookText } from '../src/services/bookImportService'
import { createDefaultBookStoreSnapshot, normalizeBookStoreSnapshot } from '../src/services/bookStoreRepository'
import type { BookStoreWork } from '../src/types/bookstore'

const now = Date.now()
const chapter = (id: string, order: number, content: string) => ({ id, title: `第${order}章`, content, summary: `摘要${order}`, status: 'published' as const, order, wordCount: content.length, createdAt: now, updatedAt: now, publishedAt: now })
const work: BookStoreWork = {
  id: 'work_test', title: '测试作品', authorId: 'author_test', authorName: '未眠书页', kind: 'original', status: 'serializing', summary: '用于验证书城核心逻辑。', outline: '', cover: '', coverColor: '#765f52', category: '幻想', tags: ['成长'], characters: ['主角'], relationships: [], warnings: [], rating: 'general', aiDisclosure: 'none', permission: { translation: false, podfic: true, illustration: true, continuation: false }, chapters: [1, 2, 3, 4, 5].map(index => chapter(`chapter_${index}`, index, `正文${index}末尾内容`)), views: 100, effectiveReads: 80, shelfCount: 10, followerGain: 1, commentCount: 2, score: 4.5, featured: false, signed: false, createdAt: now, updatedAt: now
}

assert.equal(countBookStoreWords('你好 world 2026'), 4, '中英文混排字数应稳定')
assert.equal(estimateGenerationBudget('短提示', 1800).chunks, 1, '短正文不应产生多余请求')
const longBudget = estimateGenerationBudget('长篇创作', 10000)
assert.equal(longBudget.chunks, 8, '长正文应被拆分为可恢复的小块')
assert.ok(longBudget.estimatedTotalTokens > longBudget.estimatedOutputTokens, '预算应同时包含上下文和输出')
assert.deepEqual(simulateBookStoreWork({ ...work, status: 'draft' }, 24), { views: 0, reads: 0, shelves: 0, comments: 0, followers: 0 }, '草稿不能获得公开读者数据')
assert.ok(simulateBookStoreWork(work, 24, 1000).views > 0, '已发布作品应获得受控的自然数据')
assert.ok(calculateBookStoreRankScore({ ...work, effectiveReads: 1000 }) > calculateBookStoreRankScore(work), '更多有效阅读应提高排序分')
const context = buildChapterContext(work, 'chapter_5')
assert.ok(!context.includes('摘要1') && context.includes('摘要2') && context.includes('摘要4'), '生成上下文只应携带最近三个前置章节')
assert.ok(context.length < 3000, '生成上下文必须有稳定上限，避免 API 输入持续膨胀')
const split = splitBookText('序言内容\n\n第一章 初见\n正文一\n\n第二章\n正文二')
assert.equal(split.length, 3, '带序言的中文章节应被完整分割')
assert.equal(split[1]?.title, '第一章 初见', '章节标题不应在导入中丢失')
assert.equal(splitBookText('# Opening\nText\n\n## Next\nMore').length, 2, 'Markdown 标题应转为阅读章节')
const legacy = createDefaultBookStoreSnapshot() as any
legacy.version = 1
delete legacy.library
delete legacy.readingStates
delete legacy.annotations
delete legacy.settings.fontFamily
const migrated = normalizeBookStoreSnapshot(legacy)
assert.equal(migrated.version, 2, '旧书城数据应原地迁移，不应重置')
assert.equal(migrated.works.length, legacy.works.length, '迁移不得丢失原有作品')
assert.deepEqual(migrated.library, [], '旧数据迁移后应初始化本地书库')
assert.equal(migrated.settings.fontFamily, 'serif', '旧阅读设置应补齐新字段')

console.log('bookstore tests passed')
