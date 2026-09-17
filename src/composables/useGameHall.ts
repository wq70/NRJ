/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, ref } from 'vue'
import { useChatAuth } from './useChatAuth'
import { mockChats } from './chatState/state'
import { listCurrentChatCharacterDirectory, createMatchedListenerContact } from '../services/characterDirectory'
import { sendCapabilityMessage } from '../services/api'
import {
  createTwentyOneState, createUndercoverState, drawGameCard, drawTwentyOneCard, gameHallCatalog,
  nextParticipantIndex, resolveUndercoverVotes, settleTwentyOne, twentyOneValue, undercoverWordFor
} from '../services/gameHallEngine'
import { loadGameHallSnapshot, saveGameHallSnapshot } from '../services/gameHallRepository'
import { createDefaultGameHallSnapshot, type GameHallGameId, type GameHallMessage, type GameHallParticipant, type GameHallRoomDraft, type GameHallSession } from '../types/gameHall'

const state = reactive(createDefaultGameHallSnapshot())
const initializedAccountId = ref('')
const busy = ref(false)
const error = ref('')
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const currentAccountId = () => useChatAuth().currentChatUserId.value || 'guest'
const currentGame = computed(() => gameHallCatalog.find(item => item.id === state.activeSession?.gameId) || null)
const currentParticipant = computed(() => state.activeSession?.participants[state.activeSession.turnIndex] || null)
const characters = computed(() => listCurrentChatCharacterDirectory())

const playSound = (kind: GameHallMessage['kind']) => {
  if (!state.settings.soundEnabled || typeof window === 'undefined') return
  try {
    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return
    const context = new AudioContextCtor()
    const oscillator = context.createOscillator(); const gain = context.createGain()
    oscillator.type = 'sine'; oscillator.frequency.value = kind === 'system' ? 520 : 390
    gain.gain.setValueAtTime(0.035, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09)
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + 0.1)
    oscillator.addEventListener('ended', () => { void context.close() }, { once: true })
  } catch {}
}

const initialize = () => {
  const accountId = currentAccountId()
  if (initializedAccountId.value === accountId) return
  Object.assign(state, loadGameHallSnapshot(accountId))
  initializedAccountId.value = accountId
}

const persist = () => saveGameHallSnapshot(currentAccountId(), state)

const addMessage = (session: GameHallSession, sender: GameHallParticipant | null, content: string, kind: GameHallMessage['kind'] = 'speech') => {
  const cleaned = content.trim()
  if (!cleaned) return
  session.messages.push({ id: uid('game_msg'), senderId: sender?.id || 'system', senderName: sender?.name || '系统', kind, content: cleaned, createdAt: Date.now() })
  playSound(kind)
  if (kind !== 'system') session.highlights = [...session.highlights, `${sender?.name || '玩家'}：${cleaned}`].slice(-12)
}

const userParticipant = (): GameHallParticipant => {
  const account = useChatAuth().currentAccount.value
  return {
    id: `user:${currentAccountId()}`, kind: 'user', sourceId: currentAccountId(), name: account?.name || '我', avatarUrl: account?.avatarUrl || '',
    avatarText: String(account?.name || '我').slice(0, 2), persona: account?.persona || '', socialId: account?.accountId || '', signature: '', isFriend: true, score: 0, ready: true
  }
}

const characterParticipant = (entityId: string): GameHallParticipant | null => {
  const entry = characters.value.find(item => item.entityId === entityId)
  if (!entry) return null
  const chat = mockChats.value.find(item => String(item.characterEntityId || item.id) === entry.entityId)
  return {
    id: `character:${entry.entityId}`, kind: 'character', sourceId: entry.entityId, chatId: chat?.id, name: entry.name,
    avatarUrl: String(chat?.avatarUrl || ''), avatarText: entry.name.slice(0, 2), persona: entry.persona, socialId: entry.socialProfile.socialId,
    signature: entry.socialProfile.signature || '', isFriend: true, score: 0, ready: true
  }
}

const fallbackStrangerNames = ['南枝', '听澜', '小满', '白榆', '青禾', '云岫', '见夏', '望舒']
const fallbackStranger = (index: number): GameHallParticipant => {
  const name = fallbackStrangerNames[(Date.now() + index * 3) % fallbackStrangerNames.length]
  return {
    id: uid('game_stranger'), kind: 'ai-stranger', name, avatarUrl: '', avatarText: name.slice(0, 2),
    persona: '独立、友善但有边界，玩游戏时会认真表达自己的选择，也可能保留意见。', socialId: `player_${Date.now().toString(36)}_${index + 1}`.slice(0, 20),
    signature: '在游戏里碰巧同桌的人。', isFriend: false, score: 0, ready: true
  }
}

const parseJson = (content: string) => {
  const cleaned = content.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
  const start = cleaned.indexOf('{'); const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try { return JSON.parse(cleaned.slice(start, end + 1)) } catch { return null }
}

const generateStrangers = async (count: number) => {
  const fallbacks = Array.from({ length: count }, (_, index) => fallbackStranger(index))
  if (!count) return []
  try {
    const response = await sendCapabilityMessage('game-host', [
      { role: 'system', content: '你是桌游大厅的AI陌生玩家生成器。生成的人物必须彼此不同、有正常社交边界，不冒充现实真人。只返回合法JSON。' },
      { role: 'user', content: `生成 ${count} 位用于桌游的虚拟陌生玩家。姓名不得使用现实公众人物。返回 {"players":[{"name":"2至8字昵称","persona":"身份背景、性格、说话方式、游戏习惯与边界，80至180字","signature":"短签名"}]}。` }
    ])
    const rows = parseJson(response.content)?.players
    if (!Array.isArray(rows)) return fallbacks
    const usedNames = new Set<string>()
    return fallbacks.map((fallback, index) => {
      const requested = String(rows[index]?.name || fallback.name).trim().slice(0, 16)
      const name = requested && !usedNames.has(requested) ? requested : fallback.name
      usedNames.add(name)
      return {
        ...fallback, name, avatarText: name.slice(0, 2),
        persona: String(rows[index]?.persona || fallback.persona).trim().slice(0, 1200),
        signature: String(rows[index]?.signature || fallback.signature).trim().slice(0, 100)
      }
    })
  } catch { return fallbacks }
}

const createRoom = async (draft: GameHallRoomDraft) => {
  initialize(); busy.value = true; error.value = ''
  try {
    const game = gameHallCatalog.find(item => item.id === draft.gameId)
    if (!game) throw new Error('没有找到这个游戏')
    const selected = draft.selectedCharacterIds.map(characterParticipant).filter(Boolean) as GameHallParticipant[]
    const participants = [userParticipant(), ...selected, ...await generateStrangers(Math.max(0, draft.strangerCount))].slice(0, game.maxPlayers)
    if (participants.length < game.minPlayers) throw new Error(`这个游戏至少需要 ${game.minPlayers} 位玩家`)
    const session: GameHallSession = {
      id: uid('game_session'), accountId: currentAccountId(), gameId: game.id, status: 'room', participants,
      createdAt: Date.now(), turnIndex: 0, round: 1, messages: [], skippedCount: 0, completedTurns: 0,
      summary: '', highlights: [], winners: [], chatBridgeApproved: false
    }
    state.activeSession = session
    addMessage(session, null, `房间已创建，${participants.length} 位玩家已经到齐。`, 'system')
    persist(); return session
  } finally { busy.value = false }
}

const startGame = () => {
  const session = state.activeSession
  if (!session || session.status !== 'room') return
  session.status = 'playing'; session.startedAt = Date.now(); session.turnIndex = 0; session.round = 1
  if (session.gameId === 'undercover') session.undercover = createUndercoverState(session.participants, session.id)
  else if (session.gameId === 'twenty-one') session.twentyOne = createTwentyOneState(session.participants, session.id)
  else session.currentCard = drawGameCard(session.gameId, `${session.id}:1`)
  addMessage(session, null, `${currentGame.value?.name || '游戏'}开始。`, 'system')
  persist()
}

const buildParticipantContext = (participant: GameHallParticipant) => {
  const bridge = state.settings.chatBridge
  const persona = bridge.enabled && bridge.gameReadsCharacterPersona ? participant.persona : '请保持自然、有边界的普通桌游玩家表现。'
  if (!(bridge.enabled && bridge.gameReadsRecentChat) || participant.kind !== 'character') return `玩家设定：${persona}`
  const chat = mockChats.value.find(item => String(item.characterEntityId || item.id) === String(participant.sourceId))
  const recent = (chat?.messages || []).slice(-8).map((item: any) => `${item.type === 'right' ? '用户' : participant.name}：${String(item.content || '').slice(0, 300)}`).join('\n')
  return `玩家设定：${persona}\n用户主动允许参考的近期聊天：\n${recent || '无'}`
}

const aiPartyReply = async (participant: GameHallParticipant) => {
  const session = state.activeSession
  if (!session?.currentCard) return ''
  const game = currentGame.value
  const card = session.currentCard
  const instruction = session.gameId === 'two-truths'
    ? '请给出恰好三句简短陈述，其中两句符合你的人设，一句是合理虚构；不要揭晓答案。'
    : session.gameId === 'would-you-rather'
      ? `必须选择“A：${card.optionA}”或“B：${card.optionB}”，然后用一两句解释。`
      : session.gameId === 'truth-dare'
        ? `在“真心话：${card.truth}”和“大冒险：${card.challenge}”中自然选择一个并完成。`
        : `回应题目“${card.prompt}”，可以回答有过或没有，并用一两句自然补充。`
  try {
    const response = await sendCapabilityMessage('game-host', [
      { role: 'system', content: `你是${participant.name}，正在参加${game?.name || '桌游'}。${buildParticipantContext(participant)}\n这是游戏内发言，不得把游戏内容当作现实聊天记忆。不要替其他玩家回答。` },
      { role: 'user', content: `${card.prompt}\n${instruction}\n只输出你在桌上会说的话，不要添加标签或解释。` }
    ], participant.kind === 'character' ? { diagnosticContext: { chatId: `game:${session.id}`, characterIds: [String(participant.sourceId || '')], characterName: participant.name } } : {})
    return response.content.trim().slice(0, 800)
  } catch {
    if (session.gameId === 'would-you-rather') return `我选${(session.round + participant.name.length) % 2 ? 'A' : 'B'}。直觉上这个选择更像我。`
    if (session.gameId === 'two-truths') return '我曾经为了看日出很早起床。\n我会做一道拿手菜。\n我从来没有坐过地铁。'
    if (session.gameId === 'truth-dare') return `我选真心话。${card.truth || card.prompt}`
    return '有过类似的时刻，不过我更愿意把它当作一段有趣的小插曲。'
  }
}

const advancePartyTurn = () => {
  const session = state.activeSession
  if (!session) return
  session.completedTurns += 1
  session.turnIndex = nextParticipantIndex(session.participants, session.turnIndex)
  if (session.turnIndex === 0) session.round += 1
  session.currentCard = drawGameCard(session.gameId, `${session.id}:${session.completedTurns + 1}`)
  persist()
}

const answerPartyTurn = async (text: string) => {
  const session = state.activeSession; const participant = currentParticipant.value
  if (!session || !participant || !session.currentCard) return
  busy.value = true; error.value = ''
  try {
    const answer = participant.kind === 'user' ? text.trim() : await aiPartyReply(participant)
    if (!answer) throw new Error('请先写下你的回答')
    addMessage(session, participant, answer)
    participant.score += 1
    advancePartyTurn()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '暂时无法回答' }
  finally { busy.value = false }
}

const skipPartyTurn = () => {
  const session = state.activeSession; const participant = currentParticipant.value
  if (!session || !participant) return
  session.skippedCount += 1
  addMessage(session, participant, '选择跳过这一题。', 'action')
  advancePartyTurn()
}

const submitUndercoverClue = async (text: string) => {
  const session = state.activeSession; const participant = currentParticipant.value; const game = session?.undercover
  if (!session || !participant || !game || game.stage !== 'clue') return
  busy.value = true; error.value = ''
  try {
    let clue = text.trim()
    if (participant.kind !== 'user') {
      const word = undercoverWordFor(game, participant.id)
      try {
        const response = await sendCapabilityMessage('game-host', [
          { role: 'system', content: `你是${participant.name}，正在玩谁是卧底。${buildParticipantContext(participant)} 你的词是“${word}”。不得直接说出词语或其中任何一个字，不得透露身份。` },
          { role: 'user', content: `这是第${game.round}轮。其他公开线索：${Object.entries(game.clues).map(([id, value]) => `${session.participants.find(item => item.id === id)?.name}：${value}`).join('；') || '暂无'}。请给出一句简短、不过度明显且不重复的描述，只输出描述。` }
        ])
        clue = response.content.trim().slice(0, 80)
      } catch { clue = ['很常见，但每个人想到的画面不太一样。', '它经常出现在让人放松的时刻。', '我觉得它有一种很鲜明的感觉。'][(game.round + session.turnIndex) % 3] }
    }
    if (!clue) throw new Error('请先输入一句不露底的描述')
    game.clues[participant.id] = clue
    addMessage(session, participant, clue)
    session.turnIndex = nextParticipantIndex(session.participants, session.turnIndex)
    const alive = session.participants.filter(item => !game.eliminatedIds.includes(item.id))
    const allClued = alive.every(item => Boolean(game.clues[item.id]))
    if (allClued) { game.stage = 'vote'; session.turnIndex = session.participants.findIndex(item => item.kind === 'user') }
    else {
      let guard = 0
      while (game.eliminatedIds.includes(session.participants[session.turnIndex]?.id) && guard < session.participants.length) { session.turnIndex = nextParticipantIndex(session.participants, session.turnIndex); guard += 1 }
    }
    persist()
  } catch (cause) { error.value = cause instanceof Error ? cause.message : '线索提交失败' }
  finally { busy.value = false }
}

const voteUndercover = (targetId: string) => {
  const session = state.activeSession; const game = session?.undercover
  if (!session || !game || game.stage !== 'vote') return
  const alive = session.participants.filter(item => !game.eliminatedIds.includes(item.id))
  const user = alive.find(item => item.kind === 'user')
  if (user) game.votes[user.id] = targetId
  alive.filter(item => item.kind !== 'user').forEach((participant, index) => {
    const choices = alive.filter(item => item.id !== participant.id)
    game.votes[participant.id] = choices[(participant.name.length + game.round + index) % choices.length]?.id || ''
  })
  const eliminatedId = resolveUndercoverVotes(game)
  if (!eliminatedId) {
    addMessage(session, null, '本轮平票，没有人被淘汰。', 'system')
  } else {
    game.eliminatedIds.push(eliminatedId)
    addMessage(session, null, `${session.participants.find(item => item.id === eliminatedId)?.name || '一位玩家'}被投票淘汰。`, 'system')
  }
  const aliveAfter = alive.filter(item => item.id !== eliminatedId)
  if (eliminatedId && game.undercoverIds.includes(eliminatedId)) {
    finishGame(aliveAfter.filter(item => !game.undercoverIds.includes(item.id)).map(item => item.id), '卧底被找到了，平民阵营获胜。')
  } else if (aliveAfter.length <= 2) {
    finishGame(aliveAfter.filter(item => game.undercoverIds.includes(item.id)).map(item => item.id), '卧底坚持到了最后，卧底阵营获胜。')
  } else {
    game.round += 1; game.stage = 'clue'; game.clues = {}; game.votes = {}
    session.turnIndex = session.participants.findIndex(item => aliveAfter.some(aliveItem => aliveItem.id === item.id))
    addMessage(session, null, `第 ${game.round} 轮描述开始。`, 'system')
    persist()
  }
}

const advanceTwentyOne = () => {
  const session = state.activeSession; const game = session?.twentyOne
  if (!session || !game) return
  let guard = 0
  do { game.activeIndex = nextParticipantIndex(session.participants, game.activeIndex); guard += 1 }
  while (guard <= session.participants.length && (game.stoodIds.includes(session.participants[game.activeIndex].id) || game.bustedIds.includes(session.participants[game.activeIndex].id)))
  session.turnIndex = game.activeIndex
  const finished = session.participants.every(item => game.stoodIds.includes(item.id) || game.bustedIds.includes(item.id))
  if (finished) finishGame(settleTwentyOne(session.participants, game), '二十一点积分赛结算完成。')
  else persist()
}

const twentyOneAction = (action: 'hit' | 'stand') => {
  const session = state.activeSession; const game = session?.twentyOne; const participant = currentParticipant.value
  if (!session || !game || !participant) return
  if (action === 'hit') {
    const card = drawTwentyOneCard(game, participant.id)
    addMessage(session, participant, `抽到 ${card?.suit || ''}${card?.rank || ''}，当前 ${twentyOneValue(game.hands[participant.id])} 点。`, 'action')
    if (!game.bustedIds.includes(participant.id)) { persist(); return }
    addMessage(session, null, `${participant.name}超过21点，本轮停牌。`, 'system')
  } else {
    game.stoodIds.push(participant.id)
    addMessage(session, participant, `${twentyOneValue(game.hands[participant.id])} 点停牌。`, 'action')
  }
  advanceTwentyOne()
}

const runAiTwentyOneTurn = () => {
  const session = state.activeSession; const game = session?.twentyOne; const participant = currentParticipant.value
  if (!session || !game || !participant || participant.kind === 'user') return
  while (twentyOneValue(game.hands[participant.id]) < 17 && !game.bustedIds.includes(participant.id)) drawTwentyOneCard(game, participant.id)
  if (!game.bustedIds.includes(participant.id)) game.stoodIds.push(participant.id)
  addMessage(session, participant, game.bustedIds.includes(participant.id) ? `抽到 ${twentyOneValue(game.hands[participant.id])} 点，爆牌了。` : `${twentyOneValue(game.hands[participant.id])} 点，我停牌。`, 'action')
  advanceTwentyOne()
}

const finishGame = (winnerIds: string[] = [], reason = '') => {
  const session = state.activeSession
  if (!session || session.status === 'finished') return
  session.status = 'finished'; session.endedAt = Date.now(); session.winners = winnerIds
  const winners = session.participants.filter(item => winnerIds.includes(item.id)).map(item => item.name)
  session.summary = `${currentGame.value?.name || '桌游'}由${session.participants.map(item => item.name).join('、')}共同完成，共进行了${Math.max(1, session.round)}轮。${reason}${winners.length ? ` 胜者是${winners.join('、')}。` : ''}`
  addMessage(session, null, session.summary, 'system')
  if (state.settings.keepRecords) {
    const index = state.records.findIndex(item => item.id === session.id)
    if (index >= 0) state.records[index] = clone(session)
    else state.records.unshift(clone(session))
    state.records = state.records.slice(0, 100)
  }
  persist()
}

const setRecordBridgeApproval = (sessionId: string, approved: boolean) => {
  const target = state.activeSession?.id === sessionId ? state.activeSession : state.records.find(item => item.id === sessionId) || null
  if (!target) return
  const settings = state.settings.chatBridge
  if (approved && (!settings.enabled || ![settings.chatReadsGameSummary, settings.chatReadsResults, settings.chatReadsHighlights, settings.chatReadsRoomDialogue].some(Boolean))) {
    throw new Error('请先开启聊天联动总开关，并至少选择一项写入内容')
  }
  target.chatBridgeApproved = approved
  const stored = state.records.find(item => item.id === sessionId)
  if (stored && stored !== target) stored.chatBridgeApproved = approved
  persist()
}

const addStrangerFriend = (participantId: string) => {
  const session = state.activeSession || state.records.find(record => record.participants.some(item => item.id === participantId))
  const participant = session?.participants.find(item => item.id === participantId && item.kind === 'ai-stranger')
  if (!session || !participant) throw new Error('没有找到这位AI玩家')
  if (!state.settings.allowAiFriendConversion) throw new Error('请先在设置中开启“允许赛后加AI玩家为好友”')
  const result = createMatchedListenerContact({
    entityId: participant.id, name: participant.name, socialId: participant.socialId, signature: participant.signature,
    persona: participant.persona, avatarUrl: participant.avatarUrl, interactionSummary: `在${currentGame.value?.name || '游戏大厅'}同桌认识。`, sourceTitle: '通过游戏大厅成为好友', avatarKeyPrefix: 'game_avatar'
  })
  participant.isFriend = true
  state.records.forEach(record => record.participants.filter(item => item.id === participantId).forEach(item => { item.isFriend = true }))
  persist(); return result
}

const leaveSession = () => { state.activeSession = null; persist() }
const deleteRecord = (id: string) => { state.records = state.records.filter(item => item.id !== id); persist() }
const toggleFavorite = (gameId: GameHallGameId) => {
  state.favoriteGameIds = state.favoriteGameIds.includes(gameId) ? state.favoriteGameIds.filter(id => id !== gameId) : [...state.favoriteGameIds, gameId]
  persist()
}
const saveSettings = () => persist()

export const useGameHall = () => ({
  state, busy, error, characters, currentGame, currentParticipant, initialize, createRoom, startGame, answerPartyTurn, skipPartyTurn,
  submitUndercoverClue, voteUndercover, twentyOneAction, runAiTwentyOneTurn, finishGame, leaveSession, deleteRecord, toggleFavorite,
  saveSettings, setRecordBridgeApproval, addStrangerFriend, undercoverWordFor, twentyOneValue
})
