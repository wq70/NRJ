import type { CharacterPhoneAppEntry, CharacterPhoneDevice } from '../types/characterPhone'

// Presentation metadata is intentionally separate from the character's read/knowledge state.
export const phoneEntrySeen = (entry: CharacterPhoneAppEntry) => entry.meta?.viewerSeen === true
export const markPhoneEntrySeen = (entry: CharacterPhoneAppEntry) => {
  entry.meta = { ...entry.meta, viewerSeen: true }
}
export const phoneResourceUrl = (value: unknown, image = false): string => {
  if (typeof value !== 'string') return ''
  if (image && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
export const phoneEntryImage = (entry: CharacterPhoneAppEntry) => phoneResourceUrl(entry.meta?.imageUrl || entry.meta?.url, true)
export const phoneEntryDate = (entry: CharacterPhoneAppEntry) => {
  const value = entry.meta?.startAt || entry.createdAt
  const date = new Date(typeof value === 'number' ? value : String(value))
  return Number.isFinite(date.getTime()) ? date : new Date(entry.createdAt)
}
export const localPhoneDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const phoneEntryMatches = (entry: CharacterPhoneAppEntry, query: string) => `${entry.title} ${entry.subtitle || ''} ${entry.content || ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
export const preservePhoneManualEntries = (oldDevice: CharacterPhoneDevice, next: CharacterPhoneDevice) => {
  const result = JSON.parse(JSON.stringify(next)) as CharacterPhoneDevice
  for (const oldApp of oldDevice.apps) {
    const manual = oldApp.entries.filter(entry => entry.meta?.generated !== true)
    const target = result.apps.find(app => app.id === oldApp.id)
    if (target) target.entries.push(...manual)
    else if (!oldApp.builtIn || manual.length) result.apps.push({ ...oldApp, entries: manual })
  }
  return result
}
