import catalogue from '../constants/builtInChatEmojis.json'

export interface BuiltInChatEmoji {
  id: string
  name: string
  protocolName: string
  type: 'url'
  data: string
  previewUrl: string
  category: 'user'
  builtIn: true
  packId: string
  packName: string
}

const baseUrl = import.meta.env?.BASE_URL || '/'
export const builtInChatEmojiPacks = catalogue.packs.map(pack => ({ id: pack.id, name: pack.name, count: pack.items.length }))
export const builtInChatEmojis: BuiltInChatEmoji[] = catalogue.packs.flatMap(pack => pack.items.map(item => {
  const url = `${baseUrl}chat-emojis/${item.file}`
  return { id: item.id, name: item.name, protocolName: `${pack.name}·${item.name}`, type: 'url', data: url, previewUrl: url, category: 'user', builtIn: true, packId: pack.id, packName: pack.name }
}))
const byId = new Map(builtInChatEmojis.map(item => [item.id, item]))
const protocolNames = new Set(builtInChatEmojis.map(item => item.protocolName))
// Short references are request-only; messages always persist the stable asset ID.
const promptReferenceById = new Map(builtInChatEmojis.map((item, index) => [item.id, `b${index.toString(36)}`]))
const byPromptReference = new Map(builtInChatEmojis.map(item => [promptReferenceById.get(item.id)!, item]))
export const findBuiltInEmojiPromptReference = (id: string) => byPromptReference.get(id)
export const isBuiltInEmojiResponse = (id: unknown, name: unknown) => byId.has(String(id || ''))
  || byPromptReference.has(String(id || '')) || protocolNames.has(String(name || '').trim())
export const builtInEmojiPromptCatalogue = () => builtInChatEmojis.map(item => `${item.protocolName}=${promptReferenceById.get(item.id)}`).join('、')
export const findBuiltInChatEmoji = (id: unknown) => byId.get(String(id || ''))
export const roleEmojiName = (item: { id: string; name?: string }) => findBuiltInChatEmoji(item.id)?.protocolName || item.name || ''

// Local application URLs cannot be fetched by a remote vision API. Convert only
// the requested emoji to a static data URL, never the entire built-in library.
const visionCache = new Map<string, Promise<string>>()
export const builtInEmojiVisionData = async (id: string): Promise<string> => {
  const emoji = findBuiltInChatEmoji(id)
  if (!emoji) return ''
  const cached = visionCache.get(id)
  if (cached) return cached
  const pending = (async () => {
    const response = await fetch(emoji.data)
    if (!response.ok) throw new Error('内置表情图片读取失败')
    const blob = await response.blob()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('内置表情图片读取失败'))
      reader.readAsDataURL(blob)
    })
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('内置表情预览读取失败')
    context.drawImage(image, 0, 0)
    return canvas.toDataURL('image/png')
  })()
  if (visionCache.size >= 32) visionCache.delete(visionCache.keys().next().value!)
  visionCache.set(id, pending)
  try { return await pending } catch (error) { visionCache.delete(id); throw error }
}
