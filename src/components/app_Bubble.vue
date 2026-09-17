<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { mockChats } from '../composables/chatState/state'
import {
  bubblePostKindLabel,
  bubbleStudioDay,
  bubbleStudioState,
  exportBubbleStudioData,
  getBubbleStudioAsset,
  hideBubbleReply,
  importBubbleStudioData,
  markBubbleLetterRead,
  markBubbleReplyRead,
  materializeScheduledBubblePosts,
  publishBubblePost,
  resetBubbleStudio,
  revealCharacterBubbleFan,
  saveBubbleStudioAsset,
  saveBubbleStudioSettings,
  syncCharacterBubbleFans,
  toggleBubbleFanSpecial,
  toggleBubbleLetterLike,
  toggleBubbleReplyLike,
  toggleBubbleReplyPinned,
  totalBubbleSubscribers,
  touchBubbleStudio,
  updateBubbleProfile
} from '../services/bubbleStudio'
import type { BubbleCreatorProfile, BubbleFan, BubbleFanLetter, BubbleFanReply, BubblePost, BubblePostKind, BubbleView } from '../types/bubble'
import './app_Bubble.css'

defineEmits<{ (event: 'close'): void }>()

const view = ref<BubbleView>('home')
const notice = ref('')
const postKind = ref<BubblePostKind>('text')
const postContent = ref('')
const publishMode = ref<'now' | 'scheduled'>('now')
const scheduledAt = ref('')
const pollOptions = ref(['', ''])
const uploadedAsset = reactive({ id: '', name: '', mimeType: '' })
const uploading = ref(false)
const mediaInput = ref<HTMLInputElement | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const mediaUrls = ref<Record<string, string>>({})
const activePost = ref<BubblePost | null>(null)
const activeLetter = ref<BubbleFanLetter | null>(null)
const activeFan = ref<BubbleFan | null>(null)
const profileSheet = ref(false)
const resetConfirm = ref(false)
const fanSearch = ref('')
const fanFilter = ref<'all' | 'special' | 'character'>('all')
const inboxFilter = ref<'all' | 'unread' | 'liked' | 'letters'>('all')
let noticeTimer: ReturnType<typeof setTimeout> | undefined

const profileDraft = reactive<BubbleCreatorProfile>({ ...bubbleStudioState.profile })
const publishedPosts = computed(() => bubbleStudioState.posts.filter(item => item.status === 'published'))
const scheduledPosts = computed(() => bubbleStudioState.posts.filter(item => item.status === 'scheduled'))
const subscribers = computed(() => totalBubbleSubscribers())
const studioDay = computed(() => bubbleStudioDay())
const unreadCount = computed(() => bubbleStudioState.replies.filter(item => !item.read && !item.hidden).length + bubbleStudioState.letters.filter(item => !item.read).length)
const totalHearts = computed(() => publishedPosts.value.reduce((sum, item) => sum + item.heartCount, 0))
const activeReplies = computed(() => activePost.value ? bubbleStudioState.replies.filter(item => item.postId === activePost.value?.id && !item.hidden).sort((a, b) => a.createdAt - b.createdAt) : [])
const characterCandidates = computed(() => bubbleStudioState.settings.allowCharacterSubscribers ? mockChats.value
  .filter(item => !item.isGroup && item.contactState !== 'deleted' && item.id !== 1)
  .map(item => ({ id: String(item.id), name: String(item.name || item.realName || '角色'), avatarText: String(item.avatarText || item.name || '角').slice(0, 2) })) : [])

const visibleInbox = computed(() => {
  if (inboxFilter.value === 'letters') return []
  return bubbleStudioState.replies.filter(item => !item.hidden)
    .filter(item => inboxFilter.value === 'all' || (inboxFilter.value === 'unread' && !item.read) || (inboxFilter.value === 'liked' && item.liked))
    .sort((a, b) => b.createdAt - a.createdAt)
})

const visibleFans = computed(() => {
  const keyword = fanSearch.value.trim().toLowerCase()
  return bubbleStudioState.fans
    .filter(item => fanFilter.value === 'all' || (fanFilter.value === 'special' && item.special) || (fanFilter.value === 'character' && item.isCharacter))
    .filter(item => !keyword || `${item.name}${item.note}`.toLowerCase().includes(keyword))
    .sort((a, b) => Number(b.special) - Number(a.special) || b.lastActiveAt - a.lastActiveAt)
})

const fanById = (id: string) => bubbleStudioState.fans.find(item => item.id === id)
const postById = (id: string) => bubbleStudioState.posts.find(item => item.id === id)
const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const formatCount = (value: number) => value >= 10_000 ? `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}万` : String(value)
const archetypeLabel: Record<BubbleFan['archetype'], string> = { longtime: '长期陪伴', newcomer: '新订阅', career: '作品关注', romance: '亲密关注', parental: '照顾型', data: '记录型', quiet: '安静陪伴', meme: '气氛担当', international: '海外粉丝', station: '粉丝站' }
const kindIcon: Record<BubblePostKind, string> = { text: '言', photo: '图', video: '影', voice: '音', story: '瞬', poll: '选', ask: '问', live: '播' }

const showNotice = (message: string) => {
  notice.value = message
  if (noticeTimer) clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => { notice.value = '' }, 2400)
}

const navigate = (target: BubbleView) => {
  view.value = target
  activePost.value = null
  activeLetter.value = null
  activeFan.value = null
}

const beginPublish = (kind: BubblePostKind = 'text') => {
  postKind.value = kind
  view.value = 'publish'
  nextTick(() => document.querySelector<HTMLTextAreaElement>('.bb-compose-textarea')?.focus())
}

const selectPostKind = (kind: BubblePostKind) => {
  postKind.value = kind
  if (!['photo', 'video', 'voice'].includes(kind)) clearAsset()
}

const requestMedia = () => mediaInput.value?.click()
const handleMedia = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const expected = postKind.value === 'photo' ? 'image/' : postKind.value === 'video' ? 'video/' : 'audio/'
  if (!file.type.startsWith(expected)) { showNotice(`请选择${postKind.value === 'photo' ? '图片' : postKind.value === 'video' ? '视频' : '音频'}文件`); return }
  uploading.value = true
  try {
    const saved = await saveBubbleStudioAsset(file)
    Object.assign(uploadedAsset, saved)
    const blob = await getBubbleStudioAsset(saved.id)
    if (blob) mediaUrls.value[saved.id] = URL.createObjectURL(blob)
    showNotice('素材已保存到本机')
  } catch (reason) { showNotice(reason instanceof Error ? reason.message : '素材保存失败') }
  uploading.value = false
  ;(event.target as HTMLInputElement).value = ''
}

const clearAsset = () => {
  if (uploadedAsset.id && mediaUrls.value[uploadedAsset.id]) URL.revokeObjectURL(mediaUrls.value[uploadedAsset.id])
  Object.assign(uploadedAsset, { id: '', name: '', mimeType: '' })
}

const canPublish = computed(() => Boolean(postContent.value.trim() || uploadedAsset.id || postKind.value === 'live'))

const submitPost = () => {
  if (!canPublish.value) { showNotice('先写一点想告诉粉丝的内容'); return }
  if (postKind.value === 'poll' && pollOptions.value.filter(item => item.trim()).length < 2) { showNotice('投票至少需要两个选项'); return }
  let publishAt = Date.now()
  if (publishMode.value === 'scheduled') {
    publishAt = new Date(scheduledAt.value).getTime()
    if (!Number.isFinite(publishAt) || publishAt <= Date.now()) { showNotice('请选择未来的发布时间'); return }
  }
  const post = publishBubblePost({
    kind: postKind.value, content: postContent.value, publishAt,
    mediaAssetId: uploadedAsset.id, mediaName: uploadedAsset.name, mediaMimeType: uploadedAsset.mimeType,
    pollOptions: postKind.value === 'poll' ? pollOptions.value : []
  })
  if (post.status === 'published' && bubbleStudioState.settings.allowCharacterSubscribers) syncCharacterBubbleFans(characterCandidates.value)
  postContent.value = ''
  pollOptions.value = ['', '']
  publishMode.value = 'now'
  scheduledAt.value = ''
  Object.assign(uploadedAsset, { id: '', name: '', mimeType: '' })
  view.value = 'home'
  showNotice(post.status === 'scheduled' ? '已加入定时发布' : `已发布，收到 ${post.replyCount} 条粉丝回复`)
}

const openPost = async (post: BubblePost) => {
  activePost.value = post
  for (const reply of bubbleStudioState.replies.filter(item => item.postId === post.id && !item.read)) markBubbleReplyRead(reply.id)
  if (post.mediaAssetId && !mediaUrls.value[post.mediaAssetId]) {
    const blob = await getBubbleStudioAsset(post.mediaAssetId)
    if (blob) mediaUrls.value[post.mediaAssetId] = URL.createObjectURL(blob)
  }
}

const openReply = (reply: BubbleFanReply) => {
  markBubbleReplyRead(reply.id)
  const post = postById(reply.postId)
  if (post) void openPost(post)
}

const openLetter = (letter: BubbleFanLetter) => {
  markBubbleLetterRead(letter.id)
  activeLetter.value = letter
}

const openProfile = () => {
  Object.assign(profileDraft, bubbleStudioState.profile)
  profileSheet.value = true
}

const saveProfile = () => {
  if (!profileDraft.stageName.trim()) { showNotice('请填写频道名称'); return }
  updateBubbleProfile({ ...profileDraft, stageName: profileDraft.stageName.trim(), handle: profileDraft.handle.trim().replace(/^@/, '') || 'mybubble', avatarText: profileDraft.avatarText.trim().slice(0, 2) || profileDraft.stageName.slice(0, 1) })
  profileSheet.value = false
  showNotice('频道资料已保存')
}

const addPollOption = () => { if (pollOptions.value.length < 4) pollOptions.value.push('') }
const removePollOption = (index: number) => { if (pollOptions.value.length > 2) pollOptions.value.splice(index, 1) }

const toggleSetting = (key: 'allowCharacterSubscribers' | 'chatBridgeEnabled' | 'sharePublishedPostsToChat' | 'shareFanFeedbackToChat' | 'shareCharacterSubscriptionEventsToChat' | 'autoTranslate' | 'gentleModeration' | 'reducedMotion') => {
  bubbleStudioState.settings[key] = !bubbleStudioState.settings[key]
  saveBubbleStudioSettings()
  if (key === 'allowCharacterSubscribers' && bubbleStudioState.settings[key]) {
    const added = syncCharacterBubbleFans(characterCandidates.value, publishedPosts.value.length > 0)
    showNotice(added ? '一位熟悉的人悄悄订阅了你' : '已允许角色匿名订阅')
  }
}

const changeDensity = (event: Event) => {
  bubbleStudioState.settings.replyDensity = (event.target as HTMLSelectElement).value as typeof bubbleStudioState.settings.replyDensity
  saveBubbleStudioSettings()
}

const revealFan = (fan: BubbleFan) => {
  if (revealCharacterBubbleFan(fan.id, characterCandidates.value)) { activeFan.value = bubbleStudioState.fans.find(item => item.id === fan.id) || null; showNotice('你认出了这位订阅者') }
  else showNotice('暂时还没有足够线索')
}

const exportData = () => {
  const blob = new Blob([JSON.stringify(exportBubbleStudioData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `泡泡频道-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showNotice('泡泡数据已导出；本地媒体需单独保留')
}

const handleImport = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { importBubbleStudioData(JSON.parse(await file.text())); showNotice('泡泡数据已导入') }
  catch (reason) { showNotice(reason instanceof Error ? reason.message : '导入失败') }
  ;(event.target as HTMLInputElement).value = ''
}

const confirmReset = () => {
  resetBubbleStudio()
  resetConfirm.value = false
  navigate('home')
  showNotice('已恢复为新的泡泡频道')
}

const hydrateVisibleMedia = async () => {
  for (const post of publishedPosts.value.slice(0, 12)) {
    if (!post.mediaAssetId || mediaUrls.value[post.mediaAssetId]) continue
    const blob = await getBubbleStudioAsset(post.mediaAssetId)
    if (blob) mediaUrls.value[post.mediaAssetId] = URL.createObjectURL(blob)
  }
}

const onVisibilityChange = () => {
  if (document.visibilityState !== 'visible') return
  const count = materializeScheduledBubblePosts()
  if (count) { void hydrateVisibleMedia(); showNotice(`${count} 条定时泡泡已发布`) }
}

onMounted(() => {
  touchBubbleStudio()
  materializeScheduledBubblePosts()
  void hydrateVisibleMedia()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  Object.values(mediaUrls.value).forEach(url => URL.revokeObjectURL(url))
})
</script>

<template>
  <section class="bb-app" :class="{ 'reduced-motion': bubbleStudioState.settings.reducedMotion }" :style="{ '--bb-accent': bubbleStudioState.profile.accent }">
    <header class="bb-header">
      <button class="bb-header-button" aria-label="返回桌面" @click="$emit('close')">‹</button>
      <div>
        <h1>{{ view === 'home' ? '泡泡' : view === 'publish' ? '发布' : view === 'inbox' ? '收件箱' : view === 'fans' ? '粉丝' : '我的频道' }}</h1>
        <p>{{ bubbleStudioState.profile.stageName }} · D+{{ studioDay }}</p>
      </div>
      <button class="bb-avatar-button" aria-label="编辑频道资料" @click="openProfile">{{ bubbleStudioState.profile.avatarText }}</button>
    </header>

    <Transition name="bb-toast"><div v-if="notice" class="bb-toast">{{ notice }}</div></Transition>

    <main v-if="view === 'home'" class="bb-scroll bb-home">
      <section class="bb-hero">
        <div class="bb-hero-top">
          <span class="bb-hero-avatar">{{ bubbleStudioState.profile.avatarText }}</span>
          <div><small>@{{ bubbleStudioState.profile.handle }}</small><h2>{{ bubbleStudioState.profile.stageName }}</h2><p>{{ bubbleStudioState.profile.bio }}</p></div>
          <button @click="openProfile">编辑</button>
        </div>
        <div class="bb-metrics">
          <span><strong>{{ formatCount(subscribers) }}</strong><small>订阅者</small></span>
          <span><strong>{{ formatCount(totalHearts) }}</strong><small>收到喜欢</small></span>
          <span><strong>{{ unreadCount }}</strong><small>未读来信</small></span>
        </div>
      </section>

      <section class="bb-quick-card">
        <button class="bb-quick-compose" @click="beginPublish('text')">
          <span>{{ bubbleStudioState.profile.avatarText }}</span>
          <p>现在想对 {{ bubbleStudioState.profile.fandomName }} 说什么？</p>
          <b>＋</b>
        </button>
        <div class="bb-quick-actions">
          <button @click="beginPublish('photo')"><span>图</span>照片</button>
          <button @click="beginPublish('voice')"><span>音</span>语音</button>
          <button @click="beginPublish('ask')"><span>问</span>ASK</button>
          <button @click="beginPublish('live')"><span>播</span>Live</button>
        </div>
      </section>

      <section v-if="scheduledPosts.length" class="bb-scheduled">
        <span>待</span><div><strong>{{ scheduledPosts.length }} 条定时泡泡</strong><small>最近将在 {{ formatTime(scheduledPosts[scheduledPosts.length - 1].publishAt) }} 发布</small></div><button @click="navigate('publish')">查看</button>
      </section>

      <div class="bb-section-heading"><div><small>MY CHANNEL</small><h2>我的泡泡</h2></div><span>{{ publishedPosts.length }} 条</span></div>

      <section v-if="publishedPosts.length" class="bb-feed">
        <article v-for="post in publishedPosts" :key="post.id" class="bb-post">
          <header><span>{{ kindIcon[post.kind] }}</span><div><strong>{{ bubbleStudioState.profile.stageName }}</strong><small>{{ formatTime(post.publishAt) }} · {{ bubblePostKindLabel[post.kind] }}</small></div><em>•••</em></header>
          <p v-if="post.content">{{ post.content }}</p>
          <img v-if="post.mediaMimeType.startsWith('image/') && mediaUrls[post.mediaAssetId]" :src="mediaUrls[post.mediaAssetId]" :alt="post.mediaName || '泡泡照片'">
          <video v-else-if="post.mediaMimeType.startsWith('video/') && mediaUrls[post.mediaAssetId]" :src="mediaUrls[post.mediaAssetId]" controls preload="metadata"></video>
          <audio v-else-if="post.mediaMimeType.startsWith('audio/') && mediaUrls[post.mediaAssetId]" :src="mediaUrls[post.mediaAssetId]" controls></audio>
          <div v-if="post.pollOptions.length" class="bb-poll-preview"><span v-for="option in post.pollOptions" :key="option">{{ option }}<i></i></span></div>
          <div class="bb-post-stats"><span>♡ {{ post.heartCount }}</span><span>回 {{ post.replyCount }}</span><span>阅 {{ post.readCount }}</span><b v-if="post.subscriberDelta">+{{ post.subscriberDelta }} 订阅</b></div>
          <button class="bb-reply-preview" @click="openPost(post)">
            <template v-if="post.replyCount"><span>{{ fanById(bubbleStudioState.replies.find(item => item.postId === post.id)?.fanId || '')?.avatarText || '粉' }}</span><p>{{ bubbleStudioState.replies.find(item => item.postId === post.id)?.content }}</p><b>查看全部</b></template>
            <template v-else><p>暂时还没有回复</p></template>
          </button>
        </article>
      </section>
      <section v-else class="bb-empty">
        <span>泡</span><strong>你的频道已经准备好了</strong><p>发布第一条泡泡后，粉丝会根据自己的性格和关注点留下不同反馈。</p><button @click="beginPublish('text')">发布第一条泡泡</button>
      </section>
    </main>

    <main v-else-if="view === 'publish'" class="bb-scroll bb-publish">
      <section class="bb-compose-card">
        <header><span>{{ bubbleStudioState.profile.avatarText }}</span><div><strong>{{ bubbleStudioState.profile.stageName }}</strong><small>将发送给 {{ formatCount(subscribers) }} 位订阅者</small></div></header>
        <div class="bb-kind-strip">
          <button v-for="kind in (['text','photo','video','voice','story','poll','ask','live'] as BubblePostKind[])" :key="kind" :class="{ active: postKind === kind }" @click="selectPostKind(kind)"><span>{{ kindIcon[kind] }}</span>{{ bubblePostKindLabel[kind] }}</button>
        </div>
        <textarea v-model="postContent" class="bb-compose-textarea" :placeholder="postKind === 'ask' ? '向粉丝征集什么问题？' : postKind === 'live' ? '给今晚的 Live 写一句预告…' : `告诉${bubbleStudioState.profile.fandomName}今天发生了什么…`" maxlength="1200"></textarea>
        <div class="bb-compose-meta"><span>{{ postContent.length }}/1200</span><small>支持连续短句、换行和表情</small></div>

        <button v-if="['photo','video','voice'].includes(postKind) && !uploadedAsset.id" class="bb-upload" :disabled="uploading" @click="requestMedia"><span>＋</span><div><strong>{{ uploading ? '正在保存…' : `添加${bubblePostKindLabel[postKind]}` }}</strong><small>素材仅保存在当前设备</small></div></button>
        <div v-if="uploadedAsset.id" class="bb-uploaded"><span>{{ kindIcon[postKind] }}</span><div><strong>{{ uploadedAsset.name }}</strong><small>已保存到本机</small></div><button @click="clearAsset">移除</button></div>

        <div v-if="postKind === 'poll'" class="bb-poll-editor">
          <label v-for="(_, index) in pollOptions" :key="index"><span>{{ index + 1 }}</span><input v-model="pollOptions[index]" :placeholder="`选项 ${index + 1}`" maxlength="36"><button v-if="pollOptions.length > 2" @click="removePollOption(index)">×</button></label>
          <button v-if="pollOptions.length < 4" class="bb-add-option" @click="addPollOption">＋ 添加选项</button>
        </div>
      </section>

      <section class="bb-publish-options">
        <button :class="{ active: publishMode === 'now' }" @click="publishMode = 'now'"><span>即</span><div><strong>立即发布</strong><small>粉丝会陆续看到并回复</small></div><b>✓</b></button>
        <button :class="{ active: publishMode === 'scheduled' }" @click="publishMode = 'scheduled'"><span>时</span><div><strong>定时发布</strong><small>再次打开应用时会自动补发</small></div><b>✓</b></button>
        <label v-if="publishMode === 'scheduled'"><span>发布时间</span><input v-model="scheduledAt" type="datetime-local"></label>
      </section>

      <section class="bb-publish-note"><span>预</span><p>发布后会根据内容类型、粉丝偏好和活跃度生成自然分散的反馈，不会把它变成一对一聊天。</p></section>
      <button class="bb-primary" :disabled="!canPublish || uploading" @click="submitPost">{{ publishMode === 'scheduled' ? '加入定时发布' : '发布给粉丝' }}</button>

      <section v-if="scheduledPosts.length" class="bb-draft-list">
        <div class="bb-section-heading compact"><div><small>SCHEDULED</small><h2>等待发布</h2></div><span>{{ scheduledPosts.length }}</span></div>
        <article v-for="post in scheduledPosts" :key="post.id"><span>{{ kindIcon[post.kind] }}</span><div><strong>{{ post.content || post.mediaName || bubblePostKindLabel[post.kind] }}</strong><small>{{ formatTime(post.publishAt) }}</small></div></article>
      </section>
    </main>

    <main v-else-if="view === 'inbox'" class="bb-scroll bb-inbox">
      <section class="bb-inbox-summary"><span><strong>{{ unreadCount }}</strong><small>未读</small></span><span><strong>{{ bubbleStudioState.replies.filter(item => item.liked).length }}</strong><small>已翻牌</small></span><span><strong>{{ bubbleStudioState.letters.length }}</strong><small>粉丝信</small></span></section>
      <div class="bb-filter-row">
        <button v-for="item in ([['all','全部'],['unread','未读'],['liked','已翻牌'],['letters','粉丝信']] as const)" :key="item[0]" :class="{ active: inboxFilter === item[0] }" @click="inboxFilter = item[0]">{{ item[1] }}</button>
      </div>
      <section v-if="inboxFilter === 'letters'" class="bb-letter-list">
        <button v-for="letter in bubbleStudioState.letters" :key="letter.id" :class="{ unread: !letter.read }" @click="openLetter(letter)"><span>{{ fanById(letter.fanId)?.avatarText || '信' }}</span><div><strong>{{ letter.title }}</strong><small>{{ fanById(letter.fanId)?.name }} · {{ formatTime(letter.createdAt) }}</small><p>{{ letter.content }}</p></div><i></i></button>
        <div v-if="!bubbleStudioState.letters.length" class="bb-empty compact"><span>信</span><strong>还没有粉丝信</strong><p>持续分享后，长期陪伴的粉丝可能会写来更完整的信。</p></div>
      </section>
      <section v-else-if="visibleInbox.length" class="bb-inbox-list">
        <article v-for="reply in visibleInbox" :key="reply.id" :class="{ unread: !reply.read }">
          <button class="bb-inbox-main" @click="openReply(reply)"><span>{{ fanById(reply.fanId)?.avatarText || '粉' }}</span><div><strong>{{ fanById(reply.fanId)?.name || '订阅者' }} <em v-if="fanById(reply.fanId)?.special">特别关注</em></strong><p>{{ reply.content }}</p><small>{{ postById(reply.postId)?.content || bubblePostKindLabel[postById(reply.postId)?.kind || 'text'] }} · {{ formatTime(reply.createdAt) }}</small></div><i></i></button>
          <div class="bb-inbox-actions"><button :class="{ active: reply.liked }" @click="toggleBubbleReplyLike(reply.id)">♡ 翻牌</button><button :class="{ active: reply.pinned }" @click="toggleBubbleReplyPinned(reply.id)">置顶</button><button @click="hideBubbleReply(reply.id)">隐藏</button></div>
        </article>
      </section>
      <section v-else class="bb-empty compact"><span>收</span><strong>这里暂时很安静</strong><p>发布泡泡后，粉丝回复、翻牌和来信都会集中在这里。</p></section>
    </main>

    <main v-else-if="view === 'fans'" class="bb-scroll bb-fans">
      <section class="bb-fan-hero"><div><small>SUBSCRIBERS</small><strong>{{ formatCount(subscribers) }}</strong><p>{{ bubbleStudioState.profile.fandomName }}正在慢慢形成自己的气氛。</p></div><span>+{{ publishedPosts.reduce((sum, item) => sum + item.subscriberDelta, 0) }}</span></section>
      <div class="bb-fan-tools"><label><span>⌕</span><input v-model="fanSearch" placeholder="搜索昵称或备注"></label><div><button v-for="item in ([['all','全部'],['special','特别'],['character','角色']] as const)" :key="item[0]" :class="{ active: fanFilter === item[0] }" @click="fanFilter = item[0]">{{ item[1] }}</button></div></div>
      <section class="bb-fan-list">
        <button v-for="fan in visibleFans" :key="fan.id" @click="activeFan = fan"><span :class="{ secret: fan.secretIdentity }">{{ fan.avatarText }}</span><div><strong>{{ fan.name }} <em v-if="fan.special">特别</em></strong><p>{{ fan.note }}</p><small>{{ archetypeLabel[fan.archetype] }} · 已互动 {{ fan.messageCount }} 次</small></div><b>›</b></button>
      </section>
      <section v-if="!visibleFans.length" class="bb-empty compact"><span>粉</span><strong>没有找到对应粉丝</strong><p>尝试切换筛选条件或修改搜索词。</p></section>
    </main>

    <main v-else class="bb-scroll bb-profile">
      <section class="bb-profile-card"><span>{{ bubbleStudioState.profile.avatarText }}</span><div><small>@{{ bubbleStudioState.profile.handle }}</small><strong>{{ bubbleStudioState.profile.stageName }}</strong><p>{{ bubbleStudioState.profile.fandomName }} · {{ bubbleStudioState.profile.subscriptionLabel }}</p></div><button @click="openProfile">编辑</button></section>
      <section class="bb-setting-group">
        <header><strong>体验设置</strong><small>只影响泡泡，不改变聊天或其他应用</small></header>
        <button class="bb-switch-row" @click="toggleSetting('allowCharacterSubscribers')"><span><strong>允许角色匿名订阅</strong><small>已有角色可能以小号成为你的粉丝</small></span><i :class="{ on: bubbleStudioState.settings.allowCharacterSubscribers }"><b></b></i></button>
        <button class="bb-switch-row" @click="toggleSetting('autoTranslate')"><span><strong>显示海外回复翻译</strong><small>在原文下方显示本地模拟翻译</small></span><i :class="{ on: bubbleStudioState.settings.autoTranslate }"><b></b></i></button>
        <button class="bb-switch-row" @click="toggleSetting('gentleModeration')"><span><strong>温和内容过滤</strong><small>降低攻击性和极端粉丝回复出现</small></span><i :class="{ on: bubbleStudioState.settings.gentleModeration }"><b></b></i></button>
        <button class="bb-switch-row" @click="toggleSetting('reducedMotion')"><span><strong>减少动态效果</strong><small>关闭不必要的界面动画</small></span><i :class="{ on: bubbleStudioState.settings.reducedMotion }"><b></b></i></button>
        <label class="bb-select-row"><span><strong>回复热闹程度</strong><small>决定每条泡泡的典型回复数量</small></span><select :value="bubbleStudioState.settings.replyDensity" @change="changeDensity"><option value="quiet">安静</option><option value="balanced">自然</option><option value="busy">热闹</option></select></label>
      </section>
      <section class="bb-setting-group">
        <header><strong>聊天提示词联动</strong><small>全部默认关闭；总开关关闭时不会增加任何聊天上下文</small></header>
        <button class="bb-switch-row master" @click="toggleSetting('chatBridgeEnabled')"><span><strong>允许泡泡影响聊天</strong><small>仅开启此项仍不会共享内容，需继续选择细分项</small></span><i :class="{ on: bubbleStudioState.settings.chatBridgeEnabled }"><b></b></i></button>
        <button class="bb-switch-row" :disabled="!bubbleStudioState.settings.chatBridgeEnabled" @click="toggleSetting('sharePublishedPostsToChat')"><span><strong>共享最近公开内容</strong><small>聊天角色可知道最近三条已发布泡泡</small></span><i :class="{ on: bubbleStudioState.settings.chatBridgeEnabled && bubbleStudioState.settings.sharePublishedPostsToChat }"><b></b></i></button>
        <button class="bb-switch-row" :disabled="!bubbleStudioState.settings.chatBridgeEnabled" @click="toggleSetting('shareFanFeedbackToChat')"><span><strong>共享粉丝反馈</strong><small>聊天角色可知道最近三条可见粉丝回复</small></span><i :class="{ on: bubbleStudioState.settings.chatBridgeEnabled && bubbleStudioState.settings.shareFanFeedbackToChat }"><b></b></i></button>
        <button class="bb-switch-row" :disabled="!bubbleStudioState.settings.chatBridgeEnabled" @click="toggleSetting('shareCharacterSubscriptionEventsToChat')"><span><strong>共享角色订阅事件</strong><small>只让对应角色知道自己是否订阅了你</small></span><i :class="{ on: bubbleStudioState.settings.chatBridgeEnabled && bubbleStudioState.settings.shareCharacterSubscriptionEventsToChat }"><b></b></i></button>
      </section>
      <section class="bb-setting-group">
        <header><strong>数据与隐私</strong><small>消息、粉丝与媒体默认只保存在当前设备</small></header>
        <button class="bb-action-row" @click="exportData"><span><strong>导出频道数据</strong><small>导出资料、帖子、回复和设置 JSON</small></span><em>导出</em></button>
        <button class="bb-action-row" @click="importInput?.click()"><span><strong>导入频道数据</strong><small>导入时保留当前设备上的媒体文件</small></span><em>导入</em></button>
        <button class="bb-action-row danger" @click="resetConfirm = true"><span><strong>重新开始</strong><small>清空泡泡记录并恢复模拟粉丝</small></span><em>重置</em></button>
      </section>
      <section class="bb-local-note"><span>本</span><div><strong>本地优先</strong><p>不需要账号和后端即可完整发布、接收粉丝反馈与经营频道。应用关闭期间不会在后台生成消息。</p></div></section>
    </main>

    <nav class="bb-tabs" aria-label="泡泡导航">
      <button :class="{ active: view === 'home' }" @click="navigate('home')"><span>泡</span><small>泡泡</small></button>
      <button :class="{ active: view === 'publish' }" @click="navigate('publish')"><span>＋</span><small>发布</small></button>
      <button :class="{ active: view === 'inbox' }" @click="navigate('inbox')"><span>收<i v-if="unreadCount">{{ unreadCount > 99 ? '99+' : unreadCount }}</i></span><small>收件箱</small></button>
      <button :class="{ active: view === 'fans' }" @click="navigate('fans')"><span>粉</span><small>粉丝</small></button>
      <button :class="{ active: view === 'profile' }" @click="navigate('profile')"><span>我</span><small>我的</small></button>
    </nav>

    <input ref="mediaInput" class="bb-hidden-file" type="file" :accept="postKind === 'photo' ? 'image/*' : postKind === 'video' ? 'video/*' : 'audio/*'" @change="handleMedia">
    <input ref="importInput" class="bb-hidden-file" type="file" accept="application/json,.json" @change="handleImport">

    <div v-if="activePost" class="bb-layer" @click.self="activePost = null">
      <section class="bb-sheet">
        <header><button @click="activePost = null">关闭</button><strong>粉丝回复</strong><span>{{ activeReplies.length }} 条</span></header>
        <div class="bb-sheet-scroll">
          <div class="bb-source-post"><small>{{ bubblePostKindLabel[activePost.kind] }} · {{ formatTime(activePost.publishAt) }}</small><p>{{ activePost.content || activePost.mediaName }}</p><span>♡ {{ activePost.heartCount }}　回 {{ activePost.replyCount }}　阅 {{ activePost.readCount }}</span></div>
          <article v-for="reply in activeReplies" :key="reply.id" class="bb-reply-card">
            <button class="bb-reply-person" @click="activeFan = fanById(reply.fanId) || null"><span>{{ fanById(reply.fanId)?.avatarText || '粉' }}</span><div><strong>{{ fanById(reply.fanId)?.name }}</strong><small>{{ formatTime(reply.createdAt) }}</small></div></button>
            <p>{{ reply.content }}</p>
            <small v-if="bubbleStudioState.settings.autoTranslate && reply.translatedContent">译：{{ reply.translatedContent }}</small>
            <div><button :class="{ active: reply.liked }" @click="toggleBubbleReplyLike(reply.id)">♡ 翻牌</button><button :class="{ active: reply.pinned }" @click="toggleBubbleReplyPinned(reply.id)">置顶</button><button @click="hideBubbleReply(reply.id)">隐藏</button></div>
          </article>
        </div>
      </section>
    </div>

    <div v-if="activeLetter" class="bb-layer" @click.self="activeLetter = null">
      <section class="bb-sheet bb-letter-sheet"><header><button @click="activeLetter = null">关闭</button><strong>粉丝信</strong><span></span></header><div class="bb-sheet-scroll"><span class="bb-letter-avatar">{{ fanById(activeLetter.fanId)?.avatarText }}</span><small>{{ fanById(activeLetter.fanId)?.name }} · {{ formatTime(activeLetter.createdAt) }}</small><h2>{{ activeLetter.title }}</h2><p>{{ activeLetter.content }}</p><button @click="toggleBubbleLetterLike(activeLetter.id); activeLetter = null; showNotice('已收藏这封信')">♡ 收藏这封信</button></div></section>
    </div>

    <div v-if="activeFan" class="bb-layer" @click.self="activeFan = null">
      <section class="bb-sheet bb-fan-sheet"><header><button @click="activeFan = null">关闭</button><strong>粉丝资料</strong><span></span></header><div class="bb-sheet-scroll"><span class="bb-fan-avatar">{{ activeFan.avatarText }}</span><h2>{{ activeFan.name }}</h2><small>{{ archetypeLabel[activeFan.archetype] }} · 订阅 {{ Math.max(1, Math.floor((Date.now() - activeFan.joinedAt) / 86400000)) }} 天</small><p>{{ activeFan.note }}</p><div class="bb-fan-detail-grid"><span><small>忠诚度</small><strong>{{ activeFan.loyalty }}</strong></span><span><small>活跃度</small><strong>{{ activeFan.activity }}</strong></span><span><small>互动</small><strong>{{ activeFan.messageCount }}</strong></span></div><button class="bb-sheet-primary" @click="toggleBubbleFanSpecial(activeFan.id); activeFan = bubbleStudioState.fans.find(item => item.id === activeFan?.id) || null">{{ activeFan.special ? '取消特别关注' : '设为特别关注' }}</button><button v-if="activeFan.isCharacter && activeFan.secretIdentity" class="bb-sheet-secondary" @click="revealFan(activeFan)">根据线索认出 TA</button></div></section>
    </div>

    <div v-if="profileSheet" class="bb-layer" @click.self="profileSheet = false">
      <section class="bb-sheet"><header><button @click="profileSheet = false">取消</button><strong>频道资料</strong><button @click="saveProfile">保存</button></header><div class="bb-sheet-scroll bb-form"><div class="bb-profile-preview"><span :style="{ background: profileDraft.accent }">{{ profileDraft.avatarText || profileDraft.stageName.slice(0, 1) }}</span><div><strong>{{ profileDraft.stageName || '频道名称' }}</strong><small>@{{ profileDraft.handle || 'mybubble' }}</small></div></div><label><span>频道名称</span><input v-model="profileDraft.stageName" maxlength="24"></label><div class="bb-form-grid"><label><span>账号</span><input v-model="profileDraft.handle" maxlength="24"></label><label><span>头像文字</span><input v-model="profileDraft.avatarText" maxlength="2"></label></div><label><span>频道介绍</span><textarea v-model="profileDraft.bio" rows="3" maxlength="120"></textarea></label><div class="bb-form-grid"><label><span>粉丝名</span><input v-model="profileDraft.fandomName" maxlength="16"></label><label><span>对粉丝的称呼</span><input v-model="profileDraft.fanNickname" maxlength="16"></label></div><label><span>订阅名称</span><input v-model="profileDraft.subscriptionLabel" maxlength="24"></label><label><span>频道主题色</span><div class="bb-color-field"><input v-model="profileDraft.accent" type="color"><input v-model="profileDraft.accent" maxlength="16"></div></label></div></section>
    </div>

    <div v-if="resetConfirm" class="bb-dialog-layer"><section class="bb-dialog"><span>重</span><h2>重新开始泡泡频道？</h2><p>频道资料、帖子、粉丝回复和来信将被清空。此操作不会影响聊天、角色或其他应用。</p><div><button @click="resetConfirm = false">取消</button><button class="danger" @click="confirmReset">确认重置</button></div></section></div>
  </section>
</template>
