/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, ref } from 'vue'
import localforage from 'localforage'
import { useChatAuth } from '../composables/useChatAuth'
import { mockChats } from '../composables/chatState/state'
import { ensureMemoryState } from './memoryEngine'
import type {
  CoupleEntry, CoupleModuleDefinition, CoupleModuleStats, CoupleSpace, CoupleSpaceState
} from '../types/coupleSpace'

export const coupleModuleCatalog: CoupleModuleDefinition[] = [
  { id: 'exchange-diary', name: '交换日记', shortName: '日记', icon: '记', group: 'exchange', kind: 'exchange', description: '分别写下同一天，提交后再交换阅读，也可以轮流续写。', prompt: '写下今天最想和对方交换的一段真实感受', actionLabel: '写一篇', accent: '#d9828f' },
  { id: 'love-post', name: '情书邮局', shortName: '情书', icon: '信', group: 'exchange', kind: 'letter', description: '写信、回信、定时寄出，把往返信件装订成属于你们的信集。', prompt: '这封信最想让对方知道什么？', actionLabel: '写封信', accent: '#b86f65' },
  { id: 'time-capsule', name: '时光胶囊', shortName: '胶囊', icon: '藏', group: 'exchange', kind: 'capsule', description: '分别放入秘密，在约定日期共同开启并回应过去的自己。', prompt: '写下现在想留给未来的一句话', actionLabel: '封存胶囊', accent: '#8f799c' },
  { id: 'blind-answers', name: '盲答交换', shortName: '盲答', icon: '答', group: 'exchange', kind: 'quiz', description: '双方回答前互不可见，提交后同时揭晓，还能猜对方的答案。', prompt: '如果明天可以一起做一件事，你最想做什么？', actionLabel: '开始盲答', accent: '#cc7b97' },
  { id: 'question-studio', name: '双人问卷编辑器', shortName: '问卷', icon: '题', group: 'exchange', kind: 'quiz', description: '自己出题、制作选项和卡组，决定谁先答以及何时揭晓。', prompt: '给这份问卷写下第一道问题', actionLabel: '制作问卷', accent: '#a96f91' },
  { id: 'chemistry-lab', name: '默契实验室', shortName: '默契', icon: '合', group: 'play', kind: 'game', description: '猜选择、排回忆、同时投票，用差异开启新的了解。', prompt: '周末突然空出半天，你觉得对方会选什么活动？', actionLabel: '做次实验', accent: '#7f83ad' },
  { id: 'memory-puzzle', name: '回忆拼图', shortName: '拼图', icon: '忆', group: 'play', kind: 'memory', description: '排序、真假猜和局部线索，把旧回忆重新玩一遍。', prompt: '写一条真实回忆和一条相似的干扰描述', actionLabel: '出一道题', accent: '#a57c70' },
  { id: 'story-relay', name: '双人故事接龙', shortName: '接龙', icon: '续', group: 'create', kind: 'story', description: '轮流写作、选择分支，把共同脑洞写成一本完整故事。', prompt: '用一句话写下故事的开场', actionLabel: '开新故事', accent: '#7888aa' },
  { id: 'shared-canvas', name: '双人画板', shortName: '画板', icon: '画', group: 'create', kind: 'drawing', description: '轮流作画、交换半幅画，也可以玩你画我猜。', prompt: '给这张共同画取个名字', actionLabel: '开始画', accent: '#6f93a0' },
  { id: 'scrapbook', name: '双人剪贴簿', shortName: '剪贴', icon: '册', group: 'create', kind: 'scrapbook', description: '把文字、照片和贴纸共同排成主题页，积累成月刊与纪念册。', prompt: '这一页想记录什么主题？', actionLabel: '做一页', accent: '#bc836a' },
  { id: 'mood-bottle', name: '心情交换瓶', shortName: '心情', icon: '瓶', group: 'exchange', kind: 'mood', description: '说明此刻需要倾听、安慰、建议还是安静陪伴。', prompt: '此刻是什么心情？你希望对方怎样陪你？', actionLabel: '投递心情', accent: '#7397a5' },
  { id: 'love-jars', name: '夸夸感谢愿望罐', shortName: '心意罐', icon: '罐', group: 'exchange', kind: 'jar', description: '分别积攒夸奖、感谢和愿望，在需要时随机抽取。', prompt: '放进一件具体的欣赏、感谢或愿望', actionLabel: '放入一张', accent: '#c17876' },
  { id: 'secret-surprise', name: '秘密惊喜', shortName: '惊喜', icon: '秘', group: 'exchange', kind: 'surprise', description: '隐藏准备内容，逐步放出线索，直到约定时刻揭晓。', prompt: '写下惊喜内容；在揭晓前不会提供给角色', actionLabel: '准备惊喜', accent: '#9d7595' },
  { id: 'couple-coupons', name: '情侣券', shortName: '情侣券', icon: '券', group: 'exchange', kind: 'coupon', description: '制作有边界、有期限、需要对方确认兑现的专属券。', prompt: '这张券可以兑换什么？有哪些使用条件？', actionLabel: '制作一张', accent: '#c58a66' },
  { id: 'wish-match', name: '愿望匹配池', shortName: '匹配池', icon: '愿', group: 'life', kind: 'match', description: '分别投放想做的事，只揭晓双方都愿意尝试的项目。', prompt: '每行写一个想一起做的愿望', actionLabel: '投入愿望', accent: '#7c9a82' },
  { id: 'date-planner', name: '约会策划台', shortName: '约会', icon: '约', group: 'life', kind: 'plan', description: '共同协商主题、时间、预算、准备事项并在结束后复盘。', prompt: '这次想要怎样的约会或线上共同体验？', actionLabel: '策划约会', accent: '#c4777f' },
  { id: 'hundred-things', name: '一百件共同小事', shortName: '小事', icon: '百', group: 'life', kind: 'checklist', description: '共同维护可修改的生活清单，双方确认后才真正完成。', prompt: '每行写一件想共同完成的小事', actionLabel: '建立清单', accent: '#879269' },
  { id: 'couple-kitchen', name: '双人料理屋', shortName: '料理', icon: '味', group: 'life', kind: 'recipe', description: '一起选食材、组合菜单、记录成品并编写共同食谱。', prompt: '写下现有食材、口味或想共同完成的一道菜', actionLabel: '开一桌', accent: '#bd805e' },
  { id: 'travel-book', name: '共同旅行册', shortName: '旅行', icon: '旅', group: 'life', kind: 'travel', description: '匹配目的地、规划路线，通过现实、云旅行或故事旅行收集印章。', prompt: '想去哪里？希望在那里完成什么？', actionLabel: '规划旅程', accent: '#5f9293' },
  { id: 'shared-home', name: '共同小屋', shortName: '小屋', icon: '屋', group: 'nurture', kind: 'room', description: '共同布置房间，把真实互动产出的作品和纪念物放进家里。', prompt: '给小屋或这次布置取个名字', actionLabel: '进入小屋', accent: '#9c826d' },
  { id: 'shared-pet', name: '共同养宠物', shortName: '宠物', icon: '宠', group: 'nurture', kind: 'pet', description: '共同取名、照料、训练与装扮；离开不会生病或死亡。', prompt: '给共同宠物取个名字', actionLabel: '照顾宠物', accent: '#a77c69' },
  { id: 'shared-plant', name: '共同种植', shortName: '种植', icon: '芽', group: 'nurture', kind: 'plant', description: '用信件、约定与共同活动培育分枝，每片叶子都能挂回忆。', prompt: '给这株植物取个名字', actionLabel: '照料植物', accent: '#73946f' },
  { id: 'collection-book', name: '共同收藏交换册', shortName: '收藏', icon: '集', group: 'nurture', kind: 'collection', description: '通过互动获得不同碎片，提出交换并完成主题套组。', prompt: '记录一件想共同收藏的物品或系列', actionLabel: '加入收藏', accent: '#8c829f' },
  { id: 'adventure-book', name: '双人冒险书', shortName: '冒险', icon: '境', group: 'play', kind: 'adventure', description: '各自选择行动、保留秘密目标，在分支世界里共同推进章节。', prompt: '选择世界并写下冒险的起点', actionLabel: '开启冒险', accent: '#687c9d' },
  { id: 'boardgame-studio', name: '双人桌游工坊', shortName: '桌游', icon: '游', group: 'play', kind: 'boardgame', description: '默契选择、真假猜、禁词描述、故事骰子和自制卡组。', prompt: '写下本局题目、禁词或挑战', actionLabel: '开一局', accent: '#8c729f' },
  { id: 'daily-ritual', name: '早安晚安交换', shortName: '仪式', icon: '朝', group: 'exchange', kind: 'ritual', description: '交换今日期待、最好一刻和想放下的事，不做断签惩罚。', prompt: '今天最想让对方知道什么？', actionLabel: '开始交换', accent: '#aa8269' },
  { id: 'repair-room', name: '关系修复室', shortName: '修复', icon: '解', group: 'repair', kind: 'repair', description: '分别梳理事实、感受、需要与边界，再逐项确认理解。', prompt: '只描述发生的事情，不先评价对方', actionLabel: '认真谈谈', accent: '#718a91' },
  { id: 'apology-workshop', name: '道歉与和好工坊', shortName: '和好', icon: '和', group: 'repair', kind: 'apology', description: '明确行为、影响、责任和补救；对方可以暂不接受。', prompt: '具体发生了什么？你愿意承担和补救什么？', actionLabel: '写下道歉', accent: '#9b7d72' },
  { id: 'relationship-manual', name: '相处说明书', shortName: '说明书', icon: '懂', group: 'repair', kind: 'manual', description: '共同维护陪伴方式、称呼、禁区和重要边界，修改后重新确认。', prompt: '写下一条希望对方理解并尊重的相处方式', actionLabel: '补充一条', accent: '#758b83' },
  { id: 'future-simulator', name: '未来生活模拟器', shortName: '未来', icon: '未', group: 'play', kind: 'future', description: '模拟同居、旅行、共同项目等情景，比较选择并形成共识。', prompt: '选择一个未来场景，并写下最重要的一个决定', actionLabel: '开始模拟', accent: '#777da1' }
]

const state = ref<CoupleSpaceState>({ version: 1, activeSpaceId: '', spaces: [] })
let loadedAccountId = ''
export const coupleMediaStore = localforage.createInstance({ name: 'nrt-app', storeName: 'couple-space-media' })
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const accountId = () => useChatAuth().currentChatUserId.value || 'guest'
const storageKey = (id = accountId()) => `clingy_couple_space_v1_${id}`
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const defaultBridge = () => ({
  chatKnowsRelationship: false, chatReadsMemories: false, chatWritesMemories: false,
  chatCanMentionActivities: false, characterCanInviteFromChat: false,
  characterCanEndRelationship: false, writeLongTermMemory: false,
  rememberAfterEnding: false, tokenBudget: 0 as const
})
const defaultAutonomy = () => ({
  allowCharacterInvites: false, allowCharacterInitiatedActivities: false,
  allowCharacterLetters: false, allowCharacterQuestions: false,
  allowCharacterSurprises: false, quietHoursEnabled: true, quietStart: 23, quietEnd: 8
})
const defaultPrivacy = () => ({
  sensitiveTopics: false, adultTopics: false, healthData: false,
  moneyData: false, locationData: false, notifications: false
})

export const loadCoupleSpaces = (force = false) => {
  const id = accountId()
  if (!force && loadedAccountId === id) return state.value
  loadedAccountId = id
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(id)) || 'null') as CoupleSpaceState | null
    state.value = parsed?.version === 1 && Array.isArray(parsed.spaces)
      ? { version: 1, activeSpaceId: String(parsed.activeSpaceId || ''), spaces: parsed.spaces }
      : { version: 1, activeSpaceId: '', spaces: [] }
  } catch { state.value = { version: 1, activeSpaceId: '', spaces: [] } }
  state.value.spaces.forEach(space => {
    space.entries ||= []; space.invites ||= []; space.audits ||= []; space.moduleStats ||= {}
    space.enabledModules ||= Object.fromEntries(coupleModuleCatalog.map(item => [item.id, true]))
    space.bridge = { ...defaultBridge(), ...(space.bridge || {}) }
    space.autonomy = { ...defaultAutonomy(), ...(space.autonomy || {}) }
    space.privacy = { ...defaultPrivacy(), ...(space.privacy || {}) }
  })
  return state.value
}

export const persistCoupleSpaces = () => {
  localStorage.setItem(storageKey(), JSON.stringify(state.value))
  window.dispatchEvent(new CustomEvent('clingy:couple-space-updated', { detail: { accountId: accountId() } }))
}

export const createCoupleSpace = (input: {
  chat: any; userNickname: string; characterNickname: string; title: string; declaration: string; anniversary: string
}) => {
  loadCoupleSpaces()
  const now = Date.now()
  const space: CoupleSpace = {
    id: uid('couple'), accountId: accountId(), characterId: String(input.chat.characterEntityId || input.chat.id), chatId: input.chat.id,
    characterName: String(input.chat.realName || input.chat.name || '角色'), characterAvatar: input.chat.avatarUrl || '', characterPersona: String(input.chat.persona || ''),
    userNickname: input.userNickname.trim() || '我', characterNickname: input.characterNickname.trim() || String(input.chat.name || 'TA'),
    title: input.title.trim() || '我们的空间', declaration: input.declaration.trim(), anniversary: input.anniversary,
    createdAt: now, updatedAt: now, status: 'pending', theme: 'blush',
    invites: [{ id: uid('invite'), direction: 'user_to_character', status: 'pending', message: input.declaration.trim() || '想和你一起拥有一个只属于我们的空间。', createdAt: now }],
    entries: [], enabledModules: Object.fromEntries(coupleModuleCatalog.map(item => [item.id, true])),
    bridge: defaultBridge(), autonomy: defaultAutonomy(), privacy: defaultPrivacy(), moduleStats: {}, audits: []
  }
  state.value.spaces.unshift(space); state.value.activeSpaceId = space.id; persistCoupleSpaces(); return space
}

export const updateCoupleSpace = (space: CoupleSpace, patch: Partial<CoupleSpace>) => {
  Object.assign(space, patch, { updatedAt: Date.now() }); persistCoupleSpaces()
}

export const respondToCoupleInvite = (space: CoupleSpace, accepted: boolean, response = '') => {
  const invite = space.invites.find(item => item.status === 'pending')
  if (invite) { invite.status = accepted ? 'accepted' : 'declined'; invite.respondedAt = Date.now(); invite.response = response.trim() }
  space.status = accepted ? 'active' : 'ended'; space.updatedAt = Date.now(); if (!accepted) space.endedAt = Date.now()
  persistCoupleSpaces()
}

export const createCoupleEntry = (space: CoupleSpace, input: Partial<CoupleEntry> & Pick<CoupleEntry, 'moduleId' | 'title' | 'content'>) => {
  const now = Date.now()
  const entry: CoupleEntry = {
    id: uid('entry'), moduleId: input.moduleId, title: input.title.trim() || '未命名记录', content: input.content.trim(),
    secondaryContent: input.secondaryContent?.trim(), partnerContent: input.partnerContent?.trim(), status: input.status || 'waiting',
    createdBy: input.createdBy || 'user', createdAt: now, updatedAt: now, revealAt: input.revealAt,
    memoryPermission: input.memoryPermission || 'space-only', tags: input.tags || [], checklist: input.checklist,
    options: input.options, userChoice: input.userChoice, partnerChoice: input.partnerChoice, mediaKey: input.mediaKey, meta: input.meta
  }
  space.entries.unshift(entry); space.updatedAt = now; persistCoupleSpaces(); return entry
}

export const updateCoupleEntry = (space: CoupleSpace, entry: CoupleEntry, patch: Partial<CoupleEntry>) => {
  Object.assign(entry, patch, { updatedAt: Date.now() }); space.updatedAt = Date.now(); persistCoupleSpaces()
}

export const removeCoupleEntry = async (space: CoupleSpace, entry: CoupleEntry) => {
  if (entry.mediaKey) await coupleMediaStore.removeItem(entry.mediaKey)
  space.entries = space.entries.filter(item => item.id !== entry.id); space.updatedAt = Date.now(); persistCoupleSpaces()
}

export const deleteCoupleSpace = async (space: CoupleSpace) => {
  syncAllCoupleLongTermMemories(space, true)
  await Promise.all(space.entries.map(entry => entry.mediaKey ? coupleMediaStore.removeItem(entry.mediaKey) : Promise.resolve()))
  state.value.spaces = state.value.spaces.filter(item => item.id !== space.id)
  if (state.value.activeSpaceId === space.id) state.value.activeSpaceId = state.value.spaces[0]?.id || ''
  persistCoupleSpaces()
}

export const ensureModuleStats = (space: CoupleSpace, moduleId: string, fallbackName: string): CoupleModuleStats => {
  space.moduleStats[moduleId] ||= { level: 1, progress: 0, energy: 72, name: fallbackName, selectedItems: [] }
  return space.moduleStats[moduleId]
}

export const rewardModuleActivity = (space: CoupleSpace, moduleId: string, fallbackName: string, amount = 8) => {
  const stats = ensureModuleStats(space, moduleId, fallbackName); stats.progress += amount; stats.energy = Math.min(100, stats.energy + Math.ceil(amount / 2)); stats.lastActionAt = Date.now()
  while (stats.progress >= 100) { stats.progress -= 100; stats.level += 1 }
  persistCoupleSpaces(); return stats
}

const persistContactMemory = (space: CoupleSpace, chat: any) => {
  const key = space.accountId === 'guest' ? 'clingy_custom_contacts' : `clingy_custom_contacts_${space.accountId}`
  try {
    const contacts = JSON.parse(localStorage.getItem(key) || '[]')
    const index = contacts.findIndex((item: any) => String(item.id) === String(chat.id))
    if (index < 0) return
    contacts[index].memoryState = JSON.parse(JSON.stringify(chat.memoryState))
    localStorage.setItem(key, JSON.stringify(contacts))
  } catch { /* 联系人尚未持久化时保留运行态，后续正常保存会带上记忆。 */ }
}

export const syncCoupleEntryLongTermMemory = (space: CoupleSpace, entry: CoupleEntry) => {
  const chat = mockChats.value.find(item => String(item.id) === String(space.chatId))
  if (!chat) return false
  const memory = ensureMemoryState(chat)
  const id = `couple_space_entry_${space.id}_${entry.id}`
  memory.tableRows = (memory.tableRows || []).filter((item: any) => item.id !== id)
  if (space.bridge.writeLongTermMemory && entry.memoryPermission === 'long-term' && space.status === 'active') {
    memory.tableRows.push({
      id, table: 'relationships', title: `情侣空间 · ${entry.title}`, value: entry.content,
      status: '有效', time: new Date(entry.createdAt).toLocaleString('zh-CN'),
      tags: ['情侣空间', entry.moduleId], importance: 4,
      evidence: { messageIds: [], excerpt: entry.content.slice(0, 240) },
      createdAt: entry.createdAt, updatedAt: Date.now(), sourceEventId: entry.id
    } as any)
  }
  persistContactMemory(space, chat); return true
}

export const syncAllCoupleLongTermMemories = (space: CoupleSpace, forgetAll = false) => {
  const previous = space.bridge.writeLongTermMemory
  if (forgetAll) space.bridge.writeLongTermMemory = false
  space.entries.forEach(entry => syncCoupleEntryLongTermMemory(space, entry))
  if (forgetAll) space.bridge.writeLongTermMemory = previous
}

export const buildCoupleChatContext = (chat: any, usesEnglish = false) => {
  const currentId = localStorage.getItem('clingy_chat_auth_state') || 'guest'
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(currentId)) || 'null') as CoupleSpaceState | null
    const space = saved?.spaces?.find(item => String(item.chatId) === String(chat.id) && item.status === 'active')
    if (!space?.bridge?.chatKnowsRelationship || !space.bridge.tokenBudget) return ''
    const parts = [usesEnglish ? `The user and ${space.characterName} have an active private couple space.` : `用户与${space.characterName}已建立独立情侣空间。`]
    if (space.bridge.chatReadsMemories) {
      const allowed = space.entries.filter(item => ['chat-allowed', 'long-term'].includes(item.memoryPermission) && item.status !== 'draft').slice(0, 6)
      if (allowed.length) parts.push((usesEnglish ? 'User-approved couple-space memories:\n' : '用户允许聊天读取的情侣空间记忆：\n') + allowed.map(item => `- ${item.title}：${item.content.slice(0, 180)}`).join('\n'))
    }
    if (!space.bridge.chatCanMentionActivities) parts.push(usesEnglish ? 'Do not proactively mention couple-space activities.' : '不得主动提起情侣空间活动。')
    const body = parts.join('\n').slice(0, Math.max(80, Number(space.bridge.tokenBudget) * 4))
    return `\n\n${usesEnglish ? '[Couple space permissioned context]' : '【情侣空间授权上下文】'}\n${body}`
  } catch { return '' }
}

export function useCoupleSpace() {
  loadCoupleSpaces()
  const activeSpace = computed(() => state.value.spaces.find(item => item.id === state.value.activeSpaceId) || state.value.spaces[0] || null)
  const setActiveSpace = (id: string) => { state.value.activeSpaceId = id; persistCoupleSpaces() }
  return { state, activeSpace, setActiveSpace }
}
