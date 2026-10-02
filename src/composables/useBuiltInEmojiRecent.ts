import { ref } from 'vue'
import { findBuiltInChatEmoji } from '../services/builtInChatEmojis'

export const BUILT_IN_EMOJI_RECENT_KEY = 'nrj_builtin_emoji_recent'
const readRecent = (): string[] => {
  try {
    const value = JSON.parse(localStorage.getItem(BUILT_IN_EMOJI_RECENT_KEY) || '[]')
    return Array.isArray(value) ? [...new Set<string>(value.filter((id: unknown) => typeof id === 'string' && findBuiltInChatEmoji(id)))].slice(0, 24) : []
  } catch { return [] }
}
export const builtInEmojiRecentIds = ref(readRecent())
export const recordBuiltInEmojiUsage = (id: string) => {
  if (!findBuiltInChatEmoji(id)) return
  builtInEmojiRecentIds.value = [id, ...builtInEmojiRecentIds.value.filter(value => value !== id)].slice(0, 24)
  try { localStorage.setItem(BUILT_IN_EMOJI_RECENT_KEY, JSON.stringify(builtInEmojiRecentIds.value)) } catch { /* Sending remains available when browser storage is full. */ }
}
