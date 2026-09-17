/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { createFateReading, fateMethods, getKingWenHexagram, serializeReadingForAi } from '../src/services/fateEngine'
import { buildFateChatContext, syncFateChatBridge } from '../src/services/fateChatBridge'
import { createDefaultFateSnapshot, createDefaultFateSettings } from '../src/services/fateRepository'
import type { FateProfile } from '../src/types/fate'

const method = (id: string) => {
  const value = fateMethods.find(item => item.id === id)
  assert.ok(value, `missing fate method: ${id}`)
  return value
}

const profile: FateProfile = {
  id: 'test-profile', name: '测试档案', birthday: '1995-02-23', birthTime: '17:30', gender: '女', birthplace: '上海', timezone: 'Asia/Shanghai', isDefault: true, createdAt: 1, updatedAt: 1
}

assert.ok(fateMethods.length >= 20, 'fate catalog should remain comprehensive')
assert.equal(new Set(fateMethods.map(item => item.id)).size, fateMethods.length, 'method ids must be unique')
assert.deepEqual(getKingWenHexagram([1, 1, 1, 1, 1, 1]), { number: 1, name: '乾' })
assert.deepEqual(getKingWenHexagram([0, 0, 0, 0, 0, 0]), { number: 2, name: '坤' })
assert.deepEqual(getKingWenHexagram([1, 0, 0, 0, 1, 0]), { number: 3, name: '屯' })

const tarotA = createFateReading({ method: method('tarot'), question: '我需要看见什么？', targetKind: 'self', profile, allowReversed: true, seed: 'stable-seed' })
const tarotB = createFateReading({ method: method('tarot'), question: '我需要看见什么？', targetKind: 'self', profile, allowReversed: true, seed: 'stable-seed' })
assert.equal(tarotA.items.length, 3)
assert.deepEqual(tarotA.items, tarotB.items, 'same seed should reproduce the exact draw')
assert.equal(new Set(tarotA.items.map(item => item.id)).size, tarotA.items.length, 'one reading must not repeat cards')
assert.equal(tarotA.chatInfluence, false, 'new readings must never affect chat by default')

const defaults = createDefaultFateSettings()
assert.equal(defaults.chatIntegrationEnabled, false)
assert.equal(defaults.includeReadingsInChatPrompt, false)
assert.equal(defaults.includeCharacterNameInAi, false)
assert.equal(defaults.includeCharacterPersona, false)

const namedReading = createFateReading({ method: method('tarot'), question: '关系会怎样？', targetKind: 'character', targetId: 'chat-1', targetName: '私密角色名', allowReversed: false, seed: 'privacy-seed' })
assert.equal(serializeReadingForAi(namedReading).includes('私密角色名'), false, 'AI payload must anonymize the role unless explicitly enabled')
assert.equal(serializeReadingForAi(namedReading, { includeTargetName: true }).includes('私密角色名'), true)

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value) },
  removeItem: (key: string) => { memory.delete(key) }
} })
const bridgeSnapshot = createDefaultFateSnapshot()
bridgeSnapshot.readings.push(namedReading)
syncFateChatBridge(bridgeSnapshot)
assert.equal(buildFateChatContext({ id: 'chat-1' }), '', 'master-off bridge must be fully isolated')
bridgeSnapshot.settings.chatIntegrationEnabled = true
bridgeSnapshot.settings.includeReadingsInChatPrompt = true
syncFateChatBridge(bridgeSnapshot)
assert.equal(buildFateChatContext({ id: 'chat-1' }), '', 'unapproved reading must remain isolated')
namedReading.chatInfluence = true
syncFateChatBridge(bridgeSnapshot)
assert.ok(buildFateChatContext({ id: 'chat-1' }).includes('关系会怎样？'), 'triple-authorized reading should reach only the related chat')
assert.equal(buildFateChatContext({ id: 'chat-2' }), '', 'authorized reading must not leak into another chat')

const iching = createFateReading({ method: method('iching'), question: '事情如何变化？', targetKind: 'general', allowReversed: false, seed: 'hexagram-seed' })
assert.ok(String(iching.facts.六爻).split('、').length === 6)
assert.ok(iching.items.length >= 1 && iching.items.length <= 2)

const bazi = createFateReading({ method: method('bazi'), question: '', targetKind: 'self', profile, allowReversed: false, seed: 'bazi-seed' })
assert.equal(bazi.items.length, 4)
assert.ok(String(bazi.facts.四柱).length >= 8)

const ziwei = createFateReading({ method: method('ziwei'), question: '', targetKind: 'self', profile, allowReversed: false, seed: 'ziwei-seed' })
assert.equal(ziwei.items.length, 12)
assert.ok(ziwei.facts.命主 && ziwei.facts.身主)

const pendulumResults = new Set(Array.from({ length: 40 }, (_, index) => createFateReading({ method: method('pendulum'), question: '现在适合吗？', targetKind: 'general', allowReversed: false, seed: `pendulum-${index}` }).summary))
assert.ok(pendulumResults.size >= 3, 'lightweight random tools should not collapse to one repeated result')

console.log(`fate tests passed: ${fateMethods.length} methods, deterministic cards, hexagram, bazi, ziwei and distribution checks`)
