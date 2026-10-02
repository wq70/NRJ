/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { DanmakuEvent, DanmakuSource } from '../types/danmaku'
import type { GameHallSession } from '../types/gameHall'
import type { LiveSession } from '../types/live'
import type { TextGameProject, TextGameRuntimeState } from '../types/textGame'
import { danmakuHash } from './danmakuRuntime'
import { danmakuChatCompletionToken } from './danmakuSignals'

export const emptyDanmakuSource = (scene: DanmakuSource['scene']): DanmakuSource => ({ scene, sessionId: '', branchId: '', title: '', events: [], triggerId: '', ready: false, busy: false })
export const chatDanmakuSource = (chat: any, userName: string, offline: boolean, busy: boolean, active = true, accountId = 'guest'): DanmakuSource => {
  const source = emptyDanmakuSource(offline ? 'offline' : 'chat')
  if (!chat) return source
  const messages = (chat.messages || []).filter((m: any) => !m.isHidden && !m.isRecalled && !m.isUndelivered && !m._replyVariantPreview && !m.isVoiceCallProcessMsg && !m.isVideoCallProcessMsg && Boolean(m.isOfflineMeetMsg) === offline && ['left', 'right', 'narration'].includes(m.type) && !['inner_thought', 'user_thought', 'asset_error'].includes(m.messageType))
  const events: DanmakuEvent[] = []
  for (const message of messages) {
    const text = String(message.content || '').trim()
    if (!text || /^\[(图片|视频|文件|语音)/.test(text)) continue
    const actor = message.type === 'right' ? userName : message.senderNameSnapshot || message.senderName || chat.name || '角色'
    const id = `${message.type}:${message.turnId || message.id}:${(chat.isGroup || chat.chatType === 'group') ? message.senderId || actor : ''}`
    const last = events.at(-1)
    if (last?.id === id) last.text += `\n${text}`
    else events.push({ id, actor, text, kind: message.type === 'narration' ? 'action' : 'speech' })
  }
  const latestReply = [...events].reverse().find(event => !event.id.startsWith('right:'))
  const lastReplyMessage = [...messages].reverse().find((m: any) => m.type !== 'right')
  return { scene: source.scene, sessionId: `${chat.isGroup || chat.chatType === 'group' ? 'group' : 'chat'}:${chat.id}`, branchId: String(chat.timelineState?.activeTimelineId || 'main'), title: `${chat.name || '角色'} · ${offline ? '线下见面' : '聊天'}`, events, triggerId: latestReply?.id || events.at(-1)?.id || '', ready: active, busy: busy || Boolean(chat.isTyping || chat.pendingReplyVariantSetId || chat.pendingReplyReplacement), shareAllowed: String(chat.id) !== '1', autoToken: danmakuChatCompletionToken(chat, lastReplyMessage?.turnId, accountId) }
}
export const gameDanmakuSource = (session: GameHallSession | null, busy: boolean, active: boolean): DanmakuSource => {
  if (!session) return emptyDanmakuSource('game')
  // Recorded public messages carry their original prompt. Never expose undercover/deck/hand state.
  const events: DanmakuEvent[] = session.messages.filter(message => !message.danmakuShared).map(message => ({ id: message.id, actor: message.senderName, text: message.danmakuPublicPrompt ? `题目：${message.danmakuPublicPrompt}\n${message.content}` : message.content, kind: message.kind === 'system' ? 'result' : message.kind === 'action' ? 'action' : 'speech', options: message.danmakuPublicOptions }))
  if (session.currentCard && session.status !== 'finished') events.push({ id: `card:${session.round}:${session.completedTurns}`, actor: '本轮题目', text: session.currentCard.prompt, kind: 'scene', options: [session.currentCard.optionA, session.currentCard.optionB].filter(Boolean) as string[] })
  return { scene: 'game', sessionId: session.id, branchId: 'main', title: '综艺游戏现场', events, triggerId: events.filter(e => !e.id.startsWith('card:')).at(-1)?.id || events.at(-1)?.id || '', ready: active, busy, shareAllowed: session.status === 'playing' }
}
export const storyDanmakuSource = (project: TextGameProject | null, runtime: TextGameRuntimeState | null, active: boolean, availableChoices: string[] = []): DanmakuSource => {
  if (!project || !runtime) return emptyDanmakuSource('story')
  // Earlier nodes are observed history; future nodes, hidden variables and ending metadata stay out.
  const events: DanmakuEvent[] = runtime.history.flatMap((entry, index) => {
    const node = project.nodes.find(n => n.id === entry.nodeId)
    if (!node) return []
    const observed: DanmakuEvent[] = [{ id: `${entry.nodeId}:${index ? runtime.history[index - 1]!.visitedAt : runtime.startedAt}`, actor: node.speaker || '旁白', text: node.text, kind: 'scene' }]
    if (entry.choiceText) observed.push({ id: `choice:${entry.visitedAt}`, actor: '玩家', text: `已作选择：${entry.choiceText}`, kind: 'action' })
    return observed
  })
  const current = project.nodes.find(n => n.id === runtime.currentNodeId)
  if (current) {
    const last = events.at(-1)
    const id = `${current.id}:${runtime.history.at(-1)?.visitedAt || runtime.startedAt}`
    if (last?.id !== id) events.push({ id, actor: current.speaker || '旁白', text: current.text, kind: 'scene' })
    const visibleCurrent = events.at(-1)!
    visibleCurrent.options = availableChoices
    if (current.kind === 'ending') { visibleCurrent.text += `\n${current.endingTitle}\n${current.endingDescription}`; visibleCurrent.kind = 'result' }
  }
  return { scene: 'story', sessionId: `${project.id}:${runtime.startedAt}`, branchId: 'play', title: project.title, events, triggerId: events.at(-1)?.id || '', ready: active, busy: false }
}
export const liveDanmakuSource = (session: LiveSession | null, busy: boolean, active: boolean): DanmakuSource => {
  if (!session) return emptyDanmakuSource('live')
  const events: DanmakuEvent[] = session.events.filter(e => ['host', 'message', 'scene'].includes(e.type) && !e.virtual).map(e => ({ id: e.id, actor: e.actorName, text: e.content, kind: e.type === 'scene' ? 'scene' : 'speech' }))
  return { scene: 'live', sessionId: session.id, branchId: 'main', title: session.title, events, triggerId: events.at(-1)?.id || '', ready: active && session.status === 'live', busy, shareAllowed: true }
}
export const watchDanmakuSource = (item: any, chapter: any, messages: any[], shareText: boolean, active: boolean, busy: boolean, sessionId?: string, visibleText = ''): DanmakuSource => {
  if (!item) return emptyDanmakuSource('watch')
  const events: DanmakuEvent[] = []
  // Only the on-screen fragment explicitly supplied by the reader may be shared, never whole chapters.
  if (shareText && visibleText.trim()) events.push({ id: `fragment:${chapter?.id || item.id}:${danmakuHash(visibleText)}`, actor: '当前可见片段', text: visibleText.slice(0, 3000), kind: 'scene' })
  messages.filter(m => m.sender === 'user' || m.sender === 'character').forEach(m => events.push({ id: String(m.id), actor: m.sender === 'user' ? '我' : '共赏角色', text: String(m.content || ''), kind: 'speech' }))
  return { scene: 'watch', sessionId: `${item.id}:${sessionId || 'solo'}`, branchId: chapter?.id || 'main', title: item.title, events, triggerId: events.at(-1)?.id || '', ready: active, busy, shareAllowed: Boolean(sessionId) }
}
