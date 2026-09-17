/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, readonly, ref } from 'vue'
import { mockChats } from './chatState/state'
import { sendCapabilityMessage } from '../services/api'
import { createFateReading, fateMethods, serializeReadingForAi } from '../services/fateEngine'
import { clearFateSnapshot, createDefaultFateSnapshot, loadFateSnapshot, normalizeFateSnapshot, saveFateSnapshot } from '../services/fateRepository'
import type { CreateFateReadingInput, FateProfile, FateReading, FateSettings, FateSnapshot } from '../types/fate'

const state = reactive<FateSnapshot>(createDefaultFateSnapshot())
const ready = ref(false)
const busy = ref(false)
let initializePromise: Promise<void> | null = null

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const replaceState = (snapshot: FateSnapshot) => {
  state.version = 1
  state.profiles.splice(0, state.profiles.length, ...snapshot.profiles)
  state.readings.splice(0, state.readings.length, ...snapshot.readings)
  Object.assign(state.settings, snapshot.settings)
  state.favoriteMethodIds.splice(0, state.favoriteMethodIds.length, ...snapshot.favoriteMethodIds)
  state.updatedAt = snapshot.updatedAt
}
const persist = async () => saveFateSnapshot(state)

const initialize = async () => {
  if (ready.value) return
  if (!initializePromise) initializePromise = loadFateSnapshot().then(snapshot => { replaceState(snapshot); ready.value = true })
  await initializePromise
}

const createProfile = async (input: Omit<FateProfile, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'> & { isDefault?: boolean }) => {
  const now = Date.now()
  const profile: FateProfile = { ...input, id: `fate_profile_${now}_${Math.random().toString(36).slice(2, 7)}`, isDefault: Boolean(input.isDefault || !state.profiles.length), createdAt: now, updatedAt: now }
  if (profile.isDefault) state.profiles.forEach(item => { item.isDefault = false })
  state.profiles.push(profile)
  await persist()
  return profile
}

const updateProfile = async (id: string, patch: Partial<FateProfile>) => {
  const profile = state.profiles.find(item => item.id === id)
  if (!profile) return null
  if (patch.isDefault) state.profiles.forEach(item => { item.isDefault = item.id === id })
  Object.assign(profile, patch, { id, updatedAt: Date.now() })
  await persist()
  return profile
}

const deleteProfile = async (id: string) => {
  const index = state.profiles.findIndex(item => item.id === id)
  if (index < 0) return false
  const wasDefault = state.profiles[index].isDefault
  state.profiles.splice(index, 1)
  if (wasDefault && state.profiles[0]) state.profiles[0].isDefault = true
  await persist()
  return true
}

const generateReading = async (input: CreateFateReadingInput) => {
  const reading = createFateReading(input)
  if (state.settings.saveHistory) {
    state.readings.push(reading)
    if (state.readings.length > 2000) state.readings.splice(0, state.readings.length - 2000)
    await persist()
  }
  return reading
}

const saveReading = async (reading: FateReading) => {
  const index = state.readings.findIndex(item => item.id === reading.id)
  if (index >= 0) state.readings.splice(index, 1, clone(reading))
  else state.readings.push(clone(reading))
  await persist()
}

const deleteReading = async (id: string) => {
  const index = state.readings.findIndex(item => item.id === id)
  if (index < 0) return false
  state.readings.splice(index, 1)
  await persist()
  return true
}

const toggleFavoriteReading = async (id: string) => {
  const reading = state.readings.find(item => item.id === id)
  if (!reading) return false
  reading.favorite = !reading.favorite
  await persist()
  return reading.favorite
}

const toggleFavoriteMethod = async (id: string) => {
  const index = state.favoriteMethodIds.indexOf(id)
  if (index >= 0) state.favoriteMethodIds.splice(index, 1)
  else state.favoriteMethodIds.push(id)
  await persist()
}

const updateSettings = async (patch: Partial<FateSettings>) => { Object.assign(state.settings, patch); await persist() }

const interpretWithAi = async (reading: FateReading, character?: any) => {
  if (busy.value) throw new Error('正在解读上一份结果')
  busy.value = true
  try {
    const characterName = character && state.settings.includeCharacterNameInAi
      ? `\n用户主动允许发送的角色名称：${String(character.name || '未命名角色')}`
      : ''
    const characterContext = character && state.settings.includeCharacterPersona
      ? `\n用户主动选择的角色：${String(character.name || '未命名角色')}\n角色设定（只用于语气与可能性推演，不可宣称读心）：${String(character.persona || character.description || '未设置').slice(0, 5000)}`
      : ''
    const response = await sendCapabilityMessage('chat-auxiliary', [
      { role: 'system', content: '你是温和、克制的象征解读助手。只能依据提供的原始盘面，不得改牌、改卦、增加不存在的宫位或声称能够读心。区分传统象征与现实事实，避免绝对预测。禁止对死亡、疾病诊断、怀孕、犯罪指控、投资收益给出确定结论。输出自然中文，包含：整体主题、逐项联系、现实行动、一个复盘问题。不使用 Markdown 标题。' },
      { role: 'user', content: `请结合以下结构化结果解读。${characterName}${characterContext}\n\n${serializeReadingForAi(reading, { includeTargetName: state.settings.includeCharacterNameInAi || state.settings.includeCharacterPersona })}` }
    ], { purpose: 'prompt-generation', payloadReady: true })
    reading.aiInterpretation = response.content.trim()
    await saveReading(reading)
    return reading.aiInterpretation
  } finally { busy.value = false }
}

const exportData = () => clone(state)
const importData = async (raw: unknown) => { const normalized = normalizeFateSnapshot(raw as Partial<FateSnapshot>); replaceState(normalized); await persist() }
const resetAll = async () => { await clearFateSnapshot(); replaceState(createDefaultFateSnapshot()); await persist() }

export const useFate = () => {
  const characters = computed(() => mockChats.value.filter(chat => !chat?.isGroup).map(chat => ({ id: String(chat.id), name: String(chat.name || '未命名角色'), avatarUrl: String(chat.avatarUrl || chat.avatar || ''), avatarText: String(chat.avatarText || chat.name || '缘').slice(0, 1), persona: String(chat.persona || chat.description || '') })))
  const defaultProfile = computed(() => state.profiles.find(item => item.isDefault) || state.profiles[0] || null)
  const recentReadings = computed(() => state.readings.slice().sort((a, b) => b.createdAt - a.createdAt))
  const favoriteMethods = computed(() => state.favoriteMethodIds.map(id => fateMethods.find(method => method.id === id)).filter(Boolean))
  return { state: readonly(state), ready: readonly(ready), busy: readonly(busy), characters, defaultProfile, recentReadings, favoriteMethods, initialize, createProfile, updateProfile, deleteProfile, generateReading, saveReading, deleteReading, toggleFavoriteReading, toggleFavoriteMethod, updateSettings, interpretWithAi, exportData, importData, resetAll }
}
