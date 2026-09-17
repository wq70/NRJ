/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { createDefaultGameHallSnapshot } from '../src/types/gameHall'
import {
  createTwentyOneState, createUndercoverState, drawGameCard, drawTwentyOneCard, gameHallCatalog,
  resolveUndercoverVotes, settleTwentyOne, twentyOneValue, undercoverWordFor
} from '../src/services/gameHallEngine'
import { buildGameHallChatContext, syncGameHallChatBridge } from '../src/services/gameHallChatBridge'

const participants = [
  { id: 'user:1', kind: 'user' as const, name: '我', avatarUrl: '', avatarText: '我', persona: '', socialId: '', signature: '', isFriend: true, score: 0, ready: true },
  { id: 'character:1', kind: 'character' as const, sourceId: 'char-1', name: '角色甲', avatarUrl: '', avatarText: '角', persona: '冷静', socialId: 'char_1', signature: '', isFriend: true, score: 0, ready: true },
  { id: 'stranger:1', kind: 'ai-stranger' as const, name: '青禾', avatarUrl: '', avatarText: '青', persona: '谨慎', socialId: 'ai_1', signature: '', isFriend: false, score: 0, ready: true }
]

assert.equal(gameHallCatalog.length, 6)
assert.equal(new Set(gameHallCatalog.map(item => item.id)).size, gameHallCatalog.length)
gameHallCatalog.forEach(game => assert.ok(game.minPlayers >= 2 && game.maxPlayers >= game.minPlayers))

assert.deepEqual(drawGameCard('truth-dare', 'same-seed'), drawGameCard('truth-dare', 'same-seed'), 'cards must be deterministic for one turn seed')
assert.ok(drawGameCard('would-you-rather', 'choice').optionA)

const undercover = createUndercoverState(participants, 'undercover-seed')
assert.equal(undercover.undercoverIds.length, 1)
assert.notEqual(undercoverWordFor(undercover, undercover.undercoverIds[0]), undercover.commonWord)
undercover.votes = { 'user:1': 'stranger:1', 'character:1': 'stranger:1', 'stranger:1': 'character:1' }
assert.equal(resolveUndercoverVotes(undercover), 'stranger:1')
undercover.votes = { 'user:1': 'stranger:1', 'character:1': 'character:1' }
assert.equal(resolveUndercoverVotes(undercover), '', 'ties must not eliminate a player')

const twentyOne = createTwentyOneState(participants, 'card-seed')
assert.equal(twentyOne.deck.length, 46)
participants.forEach(participant => assert.equal(twentyOne.hands[participant.id].length, 2))
const before = twentyOne.deck.length
drawTwentyOneCard(twentyOne, participants[0].id)
assert.equal(twentyOne.deck.length, before - 1)
assert.equal(twentyOneValue([{ suit: '♠', rank: 'A', value: 11 }, { suit: '♥', rank: 'K', value: 10 }, { suit: '♦', rank: 'A', value: 11 }]), 12)
const settled = { ...twentyOne, hands: { 'user:1': [{ suit: '♠', rank: 'K', value: 10 }, { suit: '♥', rank: 'Q', value: 10 }], 'character:1': [{ suit: '♣', rank: 'K', value: 10 }, { suit: '♦', rank: '9', value: 9 }], 'stranger:1': [{ suit: '♠', rank: 'K', value: 10 }, { suit: '♥', rank: 'K', value: 10 }, { suit: '♦', rank: '2', value: 2 }] } }
assert.deepEqual(settleTwentyOne(participants, settled), ['user:1'])

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value) },
  removeItem: (key: string) => { memory.delete(key) }
} })
const snapshot = createDefaultGameHallSnapshot()
snapshot.records.push({
  id: 'record-1', accountId: 'account-1', gameId: 'truth-dare', status: 'finished', participants,
  createdAt: 1, endedAt: 2, turnIndex: 0, round: 2, messages: [{ id: 'm1', senderId: 'character:1', senderName: '角色甲', kind: 'speech', content: '这是游戏内回答', createdAt: 1 }],
  skippedCount: 0, completedTurns: 3, summary: '一起玩了真心话大冒险。', highlights: ['角色甲：这是游戏内回答'], winners: [], chatBridgeApproved: true
})
syncGameHallChatBridge('account-1', snapshot)
assert.equal(buildGameHallChatContext({ id: 'char-1' }, 'account-1'), '', 'master-off must isolate every record')
snapshot.settings.chatBridge.enabled = true
syncGameHallChatBridge('account-1', snapshot)
assert.equal(buildGameHallChatContext({ id: 'char-1' }, 'account-1'), '', 'master-on without an enabled field must still be isolated')
snapshot.settings.chatBridge.chatReadsGameSummary = true
syncGameHallChatBridge('account-1', snapshot)
assert.ok(buildGameHallChatContext({ id: 'char-1' }, 'account-1').includes('一起玩了真心话大冒险'))
assert.equal(buildGameHallChatContext({ id: 'char-2' }, 'account-1'), '', 'a record must not leak to another character')
assert.equal(buildGameHallChatContext({ id: 'char-1' }, 'other-account'), '', 'a record must not leak across accounts')

console.log('game hall tests passed: catalog, party cards, undercover, twenty-one and triple-authorized chat bridge')
