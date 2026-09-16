/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { sendCapabilityMessage } from './api'
import { loadCharacterPhone, saveCharacterPhone } from './characterPhoneRepository'
import { makeBuiltInApp } from './characterPhone'
import { receiveSmsMessage, type SmsContactRecord, type SmsThreadRecord } from './smsService'

const cleanReply = (value: string) => String(value || '')
  .replace(/^```(?:json)?\s*/i, '')
  .replace(/```\s*$/i, '')
  .replace(/^<msg>|<\/msg>$/gi, '')
  .trim()
  .slice(0, 1200)

const mirrorToPhone = async (accountId: string, contact: SmsContactRecord, text: string, direction: 'incoming' | 'outgoing') => {
  const characterId = String(contact.linkedCharacterId || contact.id)
  const timelineId = contact.timelineId || 'main'
  const record = await loadCharacterPhone(accountId, characterId, contact.id, timelineId)
  if (!record.generated || !record.devices.length) return
  const device = record.devices.find(item => item.active) || record.devices[0]
  let app = device.apps.find(item => item.id === 'sms' || item.kind === 'sms')
  if (!app) { app = makeBuiltInApp('sms'); device.apps.push(app) }
  app.entries.push({
    id: `sms_bridge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: direction === 'incoming' ? '用户' : contact.name,
    subtitle: direction === 'incoming' ? '收到短信' : '已发送短信',
    content: text,
    createdAt: Date.now(),
    read: direction === 'outgoing',
    contactId: direction === 'incoming' ? accountId : characterId,
    meta: { smsBridge: true, direction }
  })
  app.entries = app.entries.slice(-300)
  app.badge = app.entries.filter(item => !item.read).length
  await saveCharacterPhone(record)
}

export const generateCharacterSmsReply = async (input: {
  accountId: string
  contact: SmsContactRecord
  thread: SmsThreadRecord
  userText: string
}) => {
  await mirrorToPhone(input.accountId, input.contact, input.userText, 'incoming')
  const history = input.thread.messages.slice(-16).map(message => `${message.type === 'send' ? '用户' : input.contact.name}：${message.text}`).join('\n')
  const response = await sendCapabilityMessage('chat', [
    { role: 'system', content: `你正在扮演${input.contact.name}，通过传统手机短信回复用户。\n人物设定：${input.contact.persona || '保持自然、克制，不擅自补充重大背景。'}\n短信与普通聊天分开：不要提到正在输入、头像、聊天软件界面，也不要把短信自动当作普通聊天记忆。回复一到三条自然短信，总字数不超过180字。可以不立即亲密，不要每次反问，不要替用户说话。只输出短信正文；多条用换行分隔。` },
    { role: 'user', content: `近期短信：\n${history || '无'}\n\n用户刚发来：${input.userText}` }
  ], { purpose: 'phone-followup' })
  const text = cleanReply(response.content)
  if (!text) throw new Error('角色没有生成可发送的短信')
  const parts = text.split(/\n+/).map(item => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 3)
  for (const part of parts) receiveSmsMessage(input.accountId, input.thread.id, part, { source: 'character-reply', actualActor: 'character', generated: true })
  await mirrorToPhone(input.accountId, input.contact, parts.join('\n'), 'outgoing')
  return parts
}

export const generateCharacterProactiveSms = async (input: { accountId: string; contact: SmsContactRecord; thread: SmsThreadRecord }) => {
  const history = input.thread.messages.slice(-10).map(message => `${message.type === 'send' ? '用户' : input.contact.name}：${message.text}`).join('\n')
  const hour = new Date().getHours()
  const response = await sendCapabilityMessage('chat', [
    { role: 'system', content: `你正在扮演${input.contact.name}，决定是否主动给用户发一条传统手机短信。人物设定：${input.contact.persona || '保持自然、克制，不擅自补充重大背景。'}\n当前是${hour}点。用户已经明确允许角色主动短信，但这不代表必须亲密或必须问候。结合人物生活写一到两条自然短信，总字数不超过120字。不要编造紧急事故、钱款、订单或用户已经答应的约定。只输出短信正文，多条用换行分隔。` },
    { role: 'user', content: `近期短信：\n${history || '还没有短信记录'}\n\n写一条此刻自然、不过度打扰的主动短信。` }
  ], { purpose: 'phone-followup' })
  const parts = cleanReply(response.content).split(/\n+/).map(item => item.replace(/^[-•]\s*/, '').trim()).filter(Boolean).slice(0, 2)
  if (!parts.length) return []
  for (const part of parts) receiveSmsMessage(input.accountId, input.thread.id, part, { source: 'character-proactive', actualActor: 'character', generated: true })
  await mirrorToPhone(input.accountId, input.contact, parts.join('\n'), 'outgoing')
  return parts
}
