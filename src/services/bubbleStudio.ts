/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { reactive } from 'vue'
import localforage from 'localforage'
import type {
  BubbleCharacterCandidate,
  BubbleCreatorProfile,
  BubbleFan,
  BubbleFanArchetype,
  BubbleFanLetter,
  BubbleFanReply,
  BubblePost,
  BubblePostKind,
  BubblePublishInput,
  BubbleStudioSnapshot
} from '../types/bubble'

const STORAGE_KEY = 'clingy_bubble_creator_v1'
const assetStore = localforage.createInstance({ name: 'nrt-app', storeName: 'bubbleCreatorAssets' })

const DAY = 86_400_000
const uid = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const fanSeeds: Array<[string, BubbleFanArchetype, string, number, number, string]> = [
  ['焦糖云朵', 'longtime', 'zh-CN', 94, 82, '从很早以前就在，记得许多小事'],
  ['今晚也不睡', 'romance', 'zh-CN', 83, 91, '几乎每次出现都会回复'],
  ['山茶邮局', 'station', 'zh-CN', 90, 73, '擅长整理信息和照顾新粉'],
  ['事业批一号', 'career', 'zh-CN', 88, 78, '最关心作品、舞台和成长'],
  ['数据小队长', 'data', 'zh-CN', 86, 84, '喜欢记录时间和重要节点'],
  ['路过的月亮', 'quiet', 'zh-CN', 76, 36, '常常只看不说话'],
  ['今天入坑', 'newcomer', 'zh-CN', 55, 88, '还在认识这里的一切'],
  ['先吃饭再说', 'parental', 'zh-CN', 81, 77, '总在提醒你好好休息'],
  ['梗图生产线', 'meme', 'zh-CN', 72, 95, '反应很快，擅长接梗'],
  ['bluehour', 'international', 'en-US', 70, 68, '会用英文留下简短而热情的回复'],
  ['春日翻译站', 'station', 'zh-CN', 87, 69, '偶尔帮助海外粉丝理解内容'],
  ['柚子汽水', 'romance', 'zh-CN', 79, 83, '喜欢自拍和生活碎片'],
  ['只看作品', 'career', 'zh-CN', 74, 58, '表达直接但并不冷淡'],
  ['晚风收藏家', 'longtime', 'zh-CN', 91, 64, '喜欢保存每一条语音'],
  ['安静待一会', 'quiet', 'zh-CN', 68, 31, '很少回复，但一直订阅'],
  ['小猫保护协会', 'parental', 'zh-CN', 84, 75, '对熬夜和受伤格外敏感'],
  ['오늘도함께', 'international', 'ko-KR', 73, 62, '来自海外的长期订阅者'],
  ['胶片边角', 'newcomer', 'zh-CN', 61, 71, '因为最近的一次内容开始关注']
]

const createFan = (seed: typeof fanSeeds[number], index: number, now: number): BubbleFan => ({
  id: `fan_seed_${index + 1}`,
  name: seed[0],
  avatarText: seed[0].slice(0, 1).toUpperCase(),
  archetype: seed[1],
  locale: seed[2],
  joinedAt: now - DAY * (12 + index * 19),
  loyalty: seed[3],
  activity: seed[4],
  messageCount: 0,
  lastActiveAt: now - index * 3_600_000,
  note: seed[5],
  isCharacter: false,
  characterId: '',
  secretIdentity: false,
  special: index < 3,
  muted: false
})

export const createDefaultBubbleSnapshot = (now = Date.now()): BubbleStudioSnapshot => ({
  schemaVersion: 1,
  profile: {
    stageName: '我的频道', handle: 'mybubble', bio: '把今天的小事留在这里。', fandomName: '小泡泡', fanNickname: '你', accent: '#7379a8', avatarText: '我', subscriptionLabel: '月度泡泡', openedAt: now
  },
  posts: [],
  fans: fanSeeds.map((seed, index) => createFan(seed, index, now)),
  replies: [],
  letters: [],
  settings: {
    allowCharacterSubscribers: false,
    chatBridgeEnabled: false,
    sharePublishedPostsToChat: false,
    shareFanFeedbackToChat: false,
    shareCharacterSubscriptionEventsToChat: false,
    autoTranslate: true,
    gentleModeration: true,
    reducedMotion: false,
    replyDensity: 'balanced'
  },
  lastOpenedAt: now,
  createdAt: now,
  updatedAt: now
})

const normalizeSnapshot = (raw: Partial<BubbleStudioSnapshot> | null | undefined): BubbleStudioSnapshot => {
  const fallback = createDefaultBubbleSnapshot()
  return {
    ...fallback,
    ...raw,
    schemaVersion: 1,
    profile: { ...fallback.profile, ...(raw?.profile || {}) },
    posts: Array.isArray(raw?.posts) ? raw.posts : fallback.posts,
    fans: Array.isArray(raw?.fans) && raw.fans.length ? raw.fans : fallback.fans,
    replies: Array.isArray(raw?.replies) ? raw.replies : fallback.replies,
    letters: Array.isArray(raw?.letters) ? raw.letters : fallback.letters,
    settings: { ...fallback.settings, ...(raw?.settings || {}) }
  }
}

const readSnapshot = () => {
  if (typeof localStorage === 'undefined') return createDefaultBubbleSnapshot()
  try { return normalizeSnapshot(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')) }
  catch { return createDefaultBubbleSnapshot() }
}

export const bubbleStudioState = reactive<BubbleStudioSnapshot>(readSnapshot())

const persist = () => {
  bubbleStudioState.updatedAt = Date.now()
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(bubbleStudioState))
}

const stringHash = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const seededRandom = (seed: number) => {
  let value = seed || 1
  return () => {
    value += 0x6D2B79F5
    let result = value
    result = Math.imul(result ^ (result >>> 15), result | 1)
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61)
    return ((result ^ (result >>> 14)) >>> 0) / 4_294_967_296
  }
}

const pick = <T>(items: T[], random: () => number) => items[Math.floor(random() * items.length) % items.length]
const contentHint = (content: string) => content.replace(/\s+/g, ' ').trim().slice(0, 18)

const replyBanks: Record<BubbleFanArchetype, string[]> = {
  longtime: ['看到这句话突然想起很久以前的那次分享', '你还是和以前一样，会把这些小事告诉我们', '今天也好好收到了', '不急着说很多，我们一直在'],
  newcomer: ['刚来就遇到这条，感觉好幸运', '这里平时也这么热闹吗', '正在一点点补以前的内容', '第一次赶上实时泡泡！'],
  career: ['很期待你接下来想做的东西', '认真准备的样子最让人安心', '作品会替你说话，慢慢来', '今天的状态听起来很不错'],
  romance: ['怎么会有人发一句话就让人开心', '好啦，我有在认真听', '这算不算今天的特别暗号', '请继续把这些小事都告诉我'],
  parental: ['先答应我今天有好好吃饭', '累的话就早点休息，不用勉强营业', '注意保暖，也别一直盯着屏幕', '知道你平安就够了'],
  data: ['记录：今天也是被泡泡叫醒的一天', '这一条值得单独存档', '已经截图记进今天的大事了', '本次出现时间已记录'],
  quiet: ['收到。', '在听', '悄悄留个脚印', '嗯，今天也在'],
  meme: ['前排先放一个禁止撤回', '等等，这句话很适合做成新梗', '翻译一下：想我们了', '谁懂，我刚点进来就看到这个'],
  international: ['I am so happy to see your message today!', 'Please take care and rest well.', 'Sending love from far away.', 'This made my whole day.'],
  station: ['已为刚来的朋友整理重点：今天心情不错', '大家慢一点发，不要把重要回复刷走啦', '这条先加入今日泡泡记录', '海外朋友稍等，正在帮忙整理意思']
}

const kindReplies: Partial<Record<BubblePostKind, string[]>> = {
  photo: ['这张照片的氛围也太好了', '原图可以偷偷保留吗', '今天的照片会看很多遍', '这个角度请多拍几次'],
  video: ['视频已经循环播放了', '刚才那个瞬间也太可爱了', '戴耳机看完回来再夸一次', '这段一定要好好收藏'],
  voice: ['声音一出来就安静下来了', '这条语音请不要设置过期', '戴上耳机听更像在身边', '今晚可以靠这条语音睡觉了'],
  story: ['差一点就错过这条限时', '今天的碎片也收到了', '很喜欢这种没有负担的小分享'],
  poll: ['已经认真投票了', '我的选择一定不会输吧', '选完才发现大家好像完全不同'],
  ask: ['问题已经放进问题箱啦', '想问的太多，最后只写了一句', '会不会刚好抽到我的问题'],
  live: ['已经在等开场了', '今晚会播多久呀', '耳机和零食都准备好了']
}

export const simulateFanReplies = (post: Pick<BubblePost, 'id' | 'kind' | 'content' | 'createdAt'>, fans: BubbleFan[], density: BubbleStudioSnapshot['settings']['replyDensity']): BubbleFanReply[] => {
  const random = seededRandom(stringHash(`${post.id}|${post.content}|${post.kind}`))
  const available = fans.filter(fan => !fan.muted)
  const baseCount = density === 'quiet' ? 5 : density === 'busy' ? 14 : 9
  const count = Math.min(available.length, baseCount + Math.floor(random() * 4))
  const ranked = available
    .map(fan => ({ fan, score: fan.activity * .58 + fan.loyalty * .32 + random() * 42 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
  const hint = contentHint(post.content)
  return ranked.map(({ fan }, index) => {
    const bank = [...replyBanks[fan.archetype], ...(kindReplies[post.kind] || [])]
    let content = pick(bank, random)
    if (hint && random() > .72 && fan.archetype !== 'international') content = `“${hint}${post.content.length > 18 ? '…' : ''}” 看到这里真的很开心`
    return {
      id: `${post.id}_${fan.id}`,
      postId: post.id,
      fanId: fan.id,
      content,
      createdAt: post.createdAt + 9_000 + index * (6_000 + Math.floor(random() * 32_000)),
      read: false,
      liked: false,
      pinned: false,
      hidden: false,
      translatedContent: fan.locale === 'en-US' ? '今天看到你的消息真的很开心，请好好休息。' : fan.locale === 'ko-KR' ? '今天也能在一起真好。' : ''
    }
  })
}

const maybeCreateLetter = (post: BubblePost, replies: BubbleFanReply[], fans: BubbleFan[]): BubbleFanLetter | null => {
  if (bubbleStudioState.posts.filter(item => item.status === 'published').length % 3 !== 0) return null
  const reply = replies.find(item => (fans.find(fan => fan.id === item.fanId)?.loyalty || 0) >= 84)
  const fan = reply ? fans.find(item => item.id === reply.fanId) : null
  if (!fan) return null
  return {
    id: uid('letter'), fanId: fan.id, title: '谢谢你今天也有出现',
    content: `看到你分享「${contentHint(post.content) || '今天的片段'}」时，忽然觉得平凡的一天也有了值得记住的部分。你不用每次都表现得很好，愿意来这里说说话就已经足够了。`,
    createdAt: post.createdAt + 180_000, read: false, liked: false
  }
}

export const updateBubbleProfile = (input: Partial<BubbleCreatorProfile>) => {
  Object.assign(bubbleStudioState.profile, input)
  persist()
}

export const publishBubblePost = (input: BubblePublishInput, now = Date.now()) => {
  const publishAt = input.publishAt && input.publishAt > now ? input.publishAt : now
  const post: BubblePost = {
    id: uid('bubble_post'), kind: input.kind, content: input.content.trim(), createdAt: now, publishAt,
    status: publishAt > now ? 'scheduled' : 'published', mediaAssetId: input.mediaAssetId || '', mediaName: input.mediaName || '', mediaMimeType: input.mediaMimeType || '',
    pollOptions: (input.pollOptions || []).map(item => item.trim()).filter(Boolean).slice(0, 4), replyCount: 0, heartCount: 0, readCount: 0, subscriberDelta: 0
  }
  bubbleStudioState.posts.unshift(post)
  if (post.status === 'published') activateBubblePost(post)
  persist()
  return clone(post)
}

const activateBubblePost = (post: BubblePost) => {
  if (bubbleStudioState.replies.some(item => item.postId === post.id)) return
  const replies = simulateFanReplies(post, bubbleStudioState.fans, bubbleStudioState.settings.replyDensity)
  const random = seededRandom(stringHash(`${post.id}|metrics`))
  const deltaBase = post.kind === 'live' ? 18 : ['photo', 'video', 'voice'].includes(post.kind) ? 11 : 6
  post.replyCount = replies.length
  post.heartCount = replies.length * (4 + Math.floor(random() * 5))
  post.readCount = Math.max(post.heartCount + 12, Math.floor(bubbleStudioState.fans.length * (1.8 + random())))
  post.subscriberDelta = Math.max(0, deltaBase + Math.floor(random() * 9) - 3)
  replies.forEach(reply => {
    const fan = bubbleStudioState.fans.find(item => item.id === reply.fanId)
    if (fan) { fan.messageCount += 1; fan.lastActiveAt = reply.createdAt }
  })
  bubbleStudioState.replies.unshift(...replies.reverse())
  const letter = maybeCreateLetter(post, replies, bubbleStudioState.fans)
  if (letter) bubbleStudioState.letters.unshift(letter)
}

export const materializeScheduledBubblePosts = (now = Date.now()) => {
  let changed = 0
  bubbleStudioState.posts.forEach(post => {
    if (post.status === 'scheduled' && post.publishAt <= now) { post.status = 'published'; activateBubblePost(post); changed += 1 }
  })
  if (changed) persist()
  return changed
}

export const markBubbleReplyRead = (replyId: string) => {
  const reply = bubbleStudioState.replies.find(item => item.id === replyId)
  if (reply) { reply.read = true; persist() }
}

export const toggleBubbleReplyLike = (replyId: string) => {
  const reply = bubbleStudioState.replies.find(item => item.id === replyId)
  if (reply) { reply.liked = !reply.liked; reply.read = true; persist() }
}

export const toggleBubbleReplyPinned = (replyId: string) => {
  const reply = bubbleStudioState.replies.find(item => item.id === replyId)
  if (reply) { reply.pinned = !reply.pinned; reply.read = true; persist() }
}

export const hideBubbleReply = (replyId: string) => {
  const reply = bubbleStudioState.replies.find(item => item.id === replyId)
  if (reply) { reply.hidden = true; reply.read = true; persist() }
}

export const markBubbleLetterRead = (letterId: string) => {
  const letter = bubbleStudioState.letters.find(item => item.id === letterId)
  if (letter) { letter.read = true; persist() }
}

export const toggleBubbleLetterLike = (letterId: string) => {
  const letter = bubbleStudioState.letters.find(item => item.id === letterId)
  if (letter) { letter.liked = !letter.liked; letter.read = true; persist() }
}

export const toggleBubbleFanSpecial = (fanId: string) => {
  const fan = bubbleStudioState.fans.find(item => item.id === fanId)
  if (fan) { fan.special = !fan.special; persist() }
}

export const syncCharacterBubbleFans = (characters: BubbleCharacterCandidate[], force = false) => {
  if (!bubbleStudioState.settings.allowCharacterSubscribers && !force) return 0
  const existing = new Set(bubbleStudioState.fans.filter(item => item.isCharacter).map(item => item.characterId))
  const eligible = characters.filter(item => item.id && !existing.has(String(item.id)))
  if (!eligible.length) return 0
  const limit = force ? 1 : Math.min(1, Math.floor(bubbleStudioState.posts.filter(item => item.status === 'published').length / 2))
  if (!limit) return 0
  eligible.slice(0, limit).forEach((character, index) => {
    bubbleStudioState.fans.unshift({
      id: uid('character_fan'), name: `匿名订阅者 ${bubbleStudioState.fans.filter(item => item.isCharacter).length + index + 1}`, avatarText: '匿', archetype: 'quiet', locale: 'zh-CN',
      joinedAt: Date.now(), loyalty: 75, activity: 54, messageCount: 0, lastActiveAt: Date.now(), note: '这个小号给你一种似曾相识的感觉', isCharacter: true,
      characterId: String(character.id), secretIdentity: true, special: true, muted: false
    })
  })
  if (limit) persist()
  return limit
}

export const revealCharacterBubbleFan = (fanId: string, characters: BubbleCharacterCandidate[]) => {
  const fan = bubbleStudioState.fans.find(item => item.id === fanId && item.isCharacter)
  const character = fan ? characters.find(item => String(item.id) === fan.characterId) : null
  if (!fan || !character) return false
  fan.name = character.name
  fan.avatarText = character.avatarText || character.name.slice(0, 1)
  fan.secretIdentity = false
  fan.note = '原来 TA 一直在偷偷订阅你的泡泡'
  persist()
  return true
}

export const saveBubbleStudioAsset = async (file: File) => {
  const maxBytes = 25 * 1024 * 1024
  if (file.size > maxBytes) throw new Error('单个素材请控制在 25MB 以内')
  const id = uid('bubble_asset')
  await assetStore.setItem(id, file)
  return { id, name: file.name, mimeType: file.type }
}

export const getBubbleStudioAsset = (id: string) => assetStore.getItem<Blob>(id)

export const exportBubbleStudioData = () => clone(bubbleStudioState)

export const importBubbleStudioData = (value: unknown) => {
  const raw = value as Partial<BubbleStudioSnapshot>
  if (!raw || raw.schemaVersion !== 1 || !raw.profile || !Array.isArray(raw.posts) || !Array.isArray(raw.fans)) throw new Error('不是有效的泡泡数据文件')
  Object.assign(bubbleStudioState, normalizeSnapshot(raw))
  persist()
}

export const resetBubbleStudio = () => {
  Object.assign(bubbleStudioState, createDefaultBubbleSnapshot())
  persist()
}

export const saveBubbleStudioSettings = () => persist()
export const touchBubbleStudio = () => { bubbleStudioState.lastOpenedAt = Date.now(); persist() }
export const totalBubbleSubscribers = () => 128 + bubbleStudioState.fans.length * 7 + bubbleStudioState.posts.reduce((sum, post) => sum + post.subscriberDelta, 0)
export const bubbleStudioDay = () => Math.max(1, Math.floor((Date.now() - bubbleStudioState.profile.openedAt) / DAY) + 1)
export const bubblePostKindLabel: Record<BubblePostKind, string> = { text: '文字', photo: '照片', video: '视频', voice: '语音', story: '限时', poll: '投票', ask: '问答', live: '直播' }

export const buildBubbleChatContext = (characterId: string, useEnglish = false) => {
  const settings = bubbleStudioState.settings
  if (!settings.chatBridgeEnabled) return ''
  const sections: string[] = []
  if (settings.sharePublishedPostsToChat) {
    const posts = bubbleStudioState.posts.filter(item => item.status === 'published').slice(0, 3)
    if (posts.length) {
      const lines = posts.map(item => `- ${bubblePostKindLabel[item.kind]}：${(item.content || item.mediaName || '发布了一条内容').replace(/\s+/g, ' ').slice(0, 80)}`)
      sections.push(useEnglish ? `[Recent public Bubble posts by the user]\n${lines.join('\n')}` : `【用户最近公开发布的泡泡】\n${lines.join('\n')}`)
    }
  }
  if (settings.shareFanFeedbackToChat) {
    const replies = bubbleStudioState.replies.filter(item => !item.hidden).slice(0, 3)
    if (replies.length) {
      const lines = replies.map(item => `- ${bubbleStudioState.fans.find(fan => fan.id === item.fanId)?.name || '粉丝'}：${item.content.slice(0, 70)}`)
      sections.push(useEnglish ? `[Recent fan feedback on the user's Bubble]\n${lines.join('\n')}` : `【用户泡泡最近收到的粉丝反馈】\n${lines.join('\n')}`)
    }
  }
  if (settings.shareCharacterSubscriptionEventsToChat) {
    const fan = bubbleStudioState.fans.find(item => item.isCharacter && item.characterId === String(characterId))
    if (fan) {
      sections.push(useEnglish
        ? `[Bubble subscription known only to this character]\nThis character has subscribed to the user's Bubble${fan.secretIdentity ? ' with an anonymous account' : ''}. Do not claim knowledge of any post unless post sharing is also enabled.`
        : `【仅当前角色知道的泡泡订阅事件】\n当前角色${fan.secretIdentity ? '使用匿名小号' : ''}订阅了用户的泡泡。若“公开内容同步”未开启，不得声称知道用户发布的具体内容。`)
    }
  }
  return sections.length ? `\n\n${sections.join('\n\n')}` : ''
}
