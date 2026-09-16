/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { mockChats } from '../composables/chatState/state'
import { useChatAuth } from '../composables/useChatAuth'
import type { DeliveryItem } from '../types/delivery'
import { loadDeliverySettings } from './deliveryService'

export interface DeliveryChatTarget { id: string | number; name: string; avatarText: string; avatarUrl?: string }

export const listDeliveryChatTargets = (): DeliveryChatTarget[] => mockChats.value
  .filter((chat: any) => chat.id !== 1 && chat.chatType !== 'group' && chat.contactState !== 'blocked')
  .map((chat: any) => ({ id: chat.id, name: String(chat.name || chat.realName || '未命名联系人'), avatarText: String(chat.avatarText || chat.name || '?').slice(0, 1), avatarUrl: chat.avatarUrl || '' }))

export const sendDeliveryToChat = (item: DeliveryItem, targetId: string | number, permissions: { allowCharacterRead: boolean; allowMemory: boolean }) => {
  const chat = mockChats.value.find((value: any) => String(value.id) === String(targetId) && value.id !== 1 && value.chatType !== 'group')
  if (!chat) throw new Error('没有找到这个聊天联系人')
  const settings = loadDeliverySettings()
  if (!settings.chatIntegration.enabled) throw new Error('请先在投递设置中开启聊天联动')
  const allowCharacterRead = settings.chatIntegration.allowCharacterRead && permissions.allowCharacterRead
  const allowMemory = settings.chatIntegration.allowMemory && allowCharacterRead && permissions.allowMemory

  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const contacts = JSON.parse(localStorage.getItem(contactsKey) || '[]')
  const index = contacts.findIndex((contact: any) => String(contact.id) === String(chat.id))
  if (index < 0) throw new Error('联系人数据尚未准备好，请重新打开聊天后再试')

  const stamp = Date.now()
  const message = {
    id: stamp,
    timestamp: stamp,
    type: 'right',
    messageType: 'delivery',
    content: `[投递：${item.title}]`,
    excludeFromGeneralMemory: !allowMemory,
    deliveryData: {
      deliveryId: item.id,
      title: item.title,
      kind: item.kind,
      note: item.note,
      text: item.text,
      url: item.url,
      fileNames: item.files.map(file => file.name),
      totalSize: item.files.reduce((sum, file) => sum + file.size, 0),
      allowCharacterRead,
      allowMemory
    }
  }
  chat.messages ||= []
  chat.messages.push(message)
  chat.preview = message.content
  chat.time = new Date(stamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })

  contacts[index].messages = chat.messages
  localStorage.setItem(contactsKey, JSON.stringify(contacts))
  return message
}
