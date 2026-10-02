/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { reactive } from 'vue'
import { danmakuHash } from './danmakuRuntime'
const completed = reactive<Record<string, { turnId: string; signature: string; token: string }>>({})
const keyFor = (chat: any, accountId: string) => JSON.stringify([accountId, chat.id, chat.timelineState?.activeTimelineId || 'main'])
const signatureFor = (chat: any, turnId: string) => danmakuHash(JSON.stringify((chat.messages || []).filter((m: any) => m.turnId === turnId).map((m: any) => [m.id, m.content, m.isRecalled, m.isHidden, m.isOfflineMeetMsg])))
export const markDanmakuChatComplete = (chat: any, turnId: string, accountId = 'guest') => {
  if (!chat || !turnId) return
  completed[keyFor(chat, accountId)] = { turnId, signature: signatureFor(chat, turnId), token: crypto.randomUUID() }
}
export const danmakuChatCompletionToken = (chat: any, turnId?: string, accountId = 'guest') => {
  const completion = completed[keyFor(chat, accountId)]
  return completion && completion.turnId === turnId && completion.signature === signatureFor(chat, turnId!) ? completion.token : ''
}
