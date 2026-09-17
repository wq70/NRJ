/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { GameHallSnapshot } from '../types/gameHall'
import { gameHallCatalog } from './gameHallEngine'

const BRIDGE_PREFIX = 'clingy_game_hall_chat_bridge_v1_'

interface GameBridgeRecord {
  characterId: string
  gameName: string
  playedAt: number
  summary?: string
  result?: string
  highlights?: string[]
  dialogue?: string[]
}

export const syncGameHallChatBridge = (accountId: string, snapshot: GameHallSnapshot) => {
  if (typeof localStorage === 'undefined') return
  const settings = snapshot.settings.chatBridge
  const records: GameBridgeRecord[] = []
  const hasReadableField = [settings.chatReadsGameSummary, settings.chatReadsResults, settings.chatReadsHighlights, settings.chatReadsRoomDialogue].some(Boolean)
  if (settings.enabled && hasReadableField) {
    snapshot.records.filter(item => item.chatBridgeApproved).slice(0, 40).forEach(session => {
      const gameName = gameHallCatalog.find(game => game.id === session.gameId)?.name || '桌游'
      session.participants.filter(item => item.kind === 'character' && item.sourceId).forEach(character => records.push({
        characterId: String(character.sourceId), gameName, playedAt: session.endedAt || session.createdAt,
        summary: settings.chatReadsGameSummary ? session.summary : undefined,
        result: settings.chatReadsResults ? (session.winners.length ? `胜者：${session.participants.filter(item => session.winners.includes(item.id)).map(item => item.name).join('、')}` : '本局没有单独胜者') : undefined,
        highlights: settings.chatReadsHighlights ? session.highlights.slice(-5) : undefined,
        dialogue: settings.chatReadsRoomDialogue ? session.messages.filter(item => item.kind === 'speech').slice(-8).map(item => `${item.senderName}：${item.content}`) : undefined
      }))
    })
  }
  const key = `${BRIDGE_PREFIX}${accountId || 'guest'}`
  if (records.length) localStorage.setItem(key, JSON.stringify(records))
  else localStorage.removeItem(key)
}

export const buildGameHallChatContext = (chat: any, accountId: string, english = false) => {
  if (typeof localStorage === 'undefined') return ''
  let records: GameBridgeRecord[] = []
  try { records = JSON.parse(localStorage.getItem(`${BRIDGE_PREFIX}${accountId || 'guest'}`) || '[]') }
  catch { return '' }
  const characterId = String(chat?.characterEntityId || chat?.id || '')
  const matched = records.filter(item => item.characterId === characterId).slice(-8)
  if (!matched.length) return ''
  const body = matched.map(item => {
    const details = [item.summary, item.result, item.highlights?.length ? `${english ? 'Highlights' : '片段'}：${item.highlights.join('；')}` : '', item.dialogue?.length ? `${english ? 'Room dialogue' : '房间对话'}：${item.dialogue.join('；')}` : ''].filter(Boolean)
    return `${item.gameName}（${new Date(item.playedAt).toLocaleDateString(english ? 'en-US' : 'zh-CN')}）${details.length ? `\n${details.join('\n')}` : ''}`
  }).join('\n\n')
  return english
    ? `\n\n[User-approved tabletop game memories]\nThese are game events, not real-life events. Never treat roleplay, betrayal, elimination, romance, or danger in a game as something that happened in reality.\n${body}`
    : `\n\n【用户主动授权的桌游记忆】\n以下内容属于游戏经历，不等同于现实事件。不得把游戏中的身份、淘汰、欺骗、恋爱或危险当作现实发生。\n${body}`
}
