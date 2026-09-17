/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { GameHallCardState, GameHallGameDefinition, GameHallGameId, GameHallParticipant, TwentyOneCard, TwentyOneState, UndercoverState } from '../types/gameHall'

export const gameHallCatalog: GameHallGameDefinition[] = [
  { id: 'truth-dare', name: '真心话大冒险', shortName: '真心话', icon: '问', description: '轮流选择真心话或轻量挑战，适合破冰和熟悉彼此。', category: '破冰', minPlayers: 2, maxPlayers: 8, duration: '10–30分钟', difficulty: '轻松', supportsVoice: true, hasPrivateInfo: false, accent: '#d27681' },
  { id: 'would-you-rather', name: '心动二选一', shortName: '二选一', icon: '选', description: '在两种选择之间站队，并说说为什么。', category: '默契', minPlayers: 2, maxPlayers: 8, duration: '8–20分钟', difficulty: '轻松', supportsVoice: true, hasPrivateInfo: false, accent: '#9b6ea5' },
  { id: 'never-have-i-ever', name: '我从来没有', shortName: '从来没有', icon: '未', description: '安全题库下的经历分享，任何题目都可以跳过。', category: '破冰', minPlayers: 2, maxPlayers: 8, duration: '10–25分钟', difficulty: '轻松', supportsVoice: true, hasPrivateInfo: false, accent: '#5d8c87' },
  { id: 'two-truths', name: '两真一假', shortName: '两真一假', icon: '辨', description: '给出三句话，让桌上的伙伴找出那句伪装。', category: '默契', minPlayers: 2, maxPlayers: 8, duration: '10–25分钟', difficulty: '适中', supportsVoice: true, hasPrivateInfo: false, accent: '#92724f' },
  { id: 'undercover', name: '谁是卧底', shortName: '谁是卧底', icon: '伏', description: '用不露底的线索描述词语，讨论并投出卧底。', category: '推理', minPlayers: 3, maxPlayers: 8, duration: '15–35分钟', difficulty: '适中', supportsVoice: true, hasPrivateInfo: true, accent: '#536b88' },
  { id: 'twenty-one', name: '二十一点积分赛', shortName: '二十一点', icon: '牌', description: '不含下注的休闲卡牌局，尽量接近21点且不要爆牌。', category: '卡牌', minPlayers: 2, maxPlayers: 6, duration: '5–15分钟', difficulty: '轻松', supportsVoice: false, hasPrivateInfo: true, accent: '#496d55' }
]

const safeDecks: Record<Exclude<GameHallGameId, 'undercover' | 'twenty-one'>, GameHallCardState[]> = {
  'truth-dare': [
    { prompt: '如果可以立刻学会一项技能，你会选什么？', truth: '说出最想拥有的一项技能。', challenge: '用一句广告词向大家推销你自己。' },
    { prompt: '最近一次让你真心觉得开心的小事是什么？', truth: '分享最近的一件开心小事。', challenge: '给桌上每个人取一个温柔的临时昵称。' },
    { prompt: '你最想重温人生中的哪一天？', truth: '说说想重温那一天的原因。', challenge: '模仿一种动物说一句晚安。' },
    { prompt: '别人对你的哪种误解最常见？', truth: '澄清一个关于自己的小误解。', challenge: '用三个完全不相关的词编一句话。' },
    { prompt: '你偷偷坚持最久的一件事是什么？', truth: '分享一个自己坚持过的习惯。', challenge: '认真夸奖下一位玩家，但不能提外表。' },
    { prompt: '如果今天可以暂停时间一小时，你会做什么？', truth: '说出暂停时间后的安排。', challenge: '闭眼描述你想象中此刻房间的样子。' }
  ],
  'would-you-rather': [
    { prompt: '只能选一个', optionA: '随时读懂别人的情绪', optionB: '随时准确表达自己的情绪' },
    { prompt: '一起旅行时更想选', optionA: '没有计划的随走随停', optionB: '安排完整的安心路线' },
    { prompt: '更愿意拥有', optionA: '永远充足的时间', optionB: '永远稳定的勇气' },
    { prompt: '朋友难过时你更倾向', optionA: '安静陪在旁边', optionB: '主动想办法解决' },
    { prompt: '只能保留一种记忆', optionA: '所有快乐的小事', optionB: '所有重要的成长' },
    { prompt: '共同完成一件事时更喜欢', optionA: '边做边商量', optionB: '先定好分工再开始' }
  ],
  'never-have-i-ever': [
    { prompt: '我从来没有因为一首歌想起某个人。' },
    { prompt: '我从来没有把闹钟关掉后继续睡。' },
    { prompt: '我从来没有在发出消息后立刻后悔。' },
    { prompt: '我从来没有假装听懂其实完全没懂。' },
    { prompt: '我从来没有因为舍不得而保留一件没用的小东西。' },
    { prompt: '我从来没有临时改变计划，结果反而遇到惊喜。' }
  ],
  'two-truths': [
    { prompt: '轮到你说两件真实的小事和一件虚构的小事。其他人会猜哪句是假的。' },
    { prompt: '请围绕“小时候”说两真一假。' },
    { prompt: '请围绕“旅行或想去的地方”说两真一假。' },
    { prompt: '请围绕“习惯与小怪癖”说两真一假。' }
  ]
}

const undercoverPairs = [
  ['咖啡', '奶茶'], ['月亮', '星星'], ['猫', '狐狸'], ['钢琴', '吉他'], ['火锅', '烧烤'], ['地铁', '公交'], ['电影', '电视剧'], ['夏天', '春天'], ['雨伞', '雨衣'], ['图书馆', '书店']
]

const hash = (value: string) => Array.from(value).reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261)
export const seededIndex = (seed: string, length: number) => length ? hash(seed) % length : 0

export const drawGameCard = (gameId: GameHallGameId, seed: string): GameHallCardState => {
  if (gameId === 'undercover' || gameId === 'twenty-one') return { prompt: '' }
  const deck = safeDecks[gameId]
  return { ...deck[seededIndex(seed, deck.length)] }
}

export const nextParticipantIndex = (participants: GameHallParticipant[], current: number) => participants.length ? (current + 1) % participants.length : 0

export const createUndercoverState = (participants: GameHallParticipant[], seed: string): UndercoverState => {
  const pair = undercoverPairs[seededIndex(seed, undercoverPairs.length)]
  const undercoverIndex = seededIndex(`${seed}:undercover`, participants.length)
  return { commonWord: pair[0], undercoverWord: pair[1], undercoverIds: [participants[undercoverIndex]?.id].filter(Boolean), clues: {}, votes: {}, eliminatedIds: [], round: 1, stage: 'clue' }
}

export const undercoverWordFor = (state: UndercoverState, participantId: string) => state.undercoverIds.includes(participantId) ? state.undercoverWord : state.commonWord

export const resolveUndercoverVotes = (state: UndercoverState) => {
  const counts: Record<string, number> = {}
  Object.values(state.votes).forEach(id => { counts[id] = (counts[id] || 0) + 1 })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  if (!sorted.length || (sorted[1] && sorted[0][1] === sorted[1][1])) return ''
  return sorted[0][0]
}

const suits = ['♠', '♥', '♣', '♦']
const ranks = [
  ['A', 11], ['2', 2], ['3', 3], ['4', 4], ['5', 5], ['6', 6], ['7', 7], ['8', 8], ['9', 9], ['10', 10], ['J', 10], ['Q', 10], ['K', 10]
] as const

export const twentyOneValue = (cards: TwentyOneCard[]) => {
  let total = cards.reduce((sum, card) => sum + card.value, 0)
  let aces = cards.filter(card => card.rank === 'A').length
  while (total > 21 && aces > 0) { total -= 10; aces -= 1 }
  return total
}

export const createTwentyOneState = (participants: GameHallParticipant[], seed: string): TwentyOneState => {
  const deck = suits.flatMap(suit => ranks.map(([rank, value]) => ({ suit, rank, value })))
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const target = seededIndex(`${seed}:${index}`, index + 1)
    ;[deck[index], deck[target]] = [deck[target], deck[index]]
  }
  const hands: Record<string, TwentyOneCard[]> = Object.fromEntries(participants.map(item => [item.id, []]))
  for (let round = 0; round < 2; round += 1) participants.forEach(item => hands[item.id].push(deck.pop()!))
  return { deck, hands, stoodIds: [], bustedIds: [], activeIndex: 0 }
}

export const drawTwentyOneCard = (state: TwentyOneState, participantId: string) => {
  const card = state.deck.pop()
  if (!card) return null
  state.hands[participantId].push(card)
  if (twentyOneValue(state.hands[participantId]) > 21 && !state.bustedIds.includes(participantId)) state.bustedIds.push(participantId)
  return card
}

export const settleTwentyOne = (participants: GameHallParticipant[], state: TwentyOneState) => {
  const valid = participants.map(item => ({ id: item.id, value: twentyOneValue(state.hands[item.id] || []) })).filter(item => item.value <= 21)
  if (!valid.length) return []
  const best = Math.max(...valid.map(item => item.value))
  return valid.filter(item => item.value === best).map(item => item.id)
}
