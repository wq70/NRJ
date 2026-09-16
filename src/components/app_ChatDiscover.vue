/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import localforage from 'localforage'
import TextEditModal from './TextEditModal.vue'
import DiscoverPublish from './app_DiscoverPublish.vue'
import DiscoverDetailModal from './discover/modals/DiscoverDetailModal.vue'
import DiscoverBehaviorModal from './discover/modals/DiscoverBehaviorModal.vue'
import DiscoverBatchDeleteModal from './discover/modals/DiscoverBatchDeleteModal.vue'

import { useChatDiscover } from '../composables/useChatDiscover'
import { sendCapabilityMessage, sendChatMessage } from '../services/api'
import { processMomentTags } from '../composables/useChatRoomMessage'
import { ensureRelationship } from '../composables/useChatRelationship'
import { addMomentNotification, canViewMoment } from '../services/moments'
import { getMomentBehavior } from '../services/moments'
import { globalPromptSettings } from '../store'
import ChatVoiceModal from './chat/modals/ChatVoiceModal.vue'
import { playRecordedVoice, saveRecordedVoice } from '../services/browserMedia'
import { useVoicePlayer } from '../composables/useVoicePlayer'
import { useChatEmoji } from '../composables/useChatEmoji'
import { selectRoleAvailableEmojis, selectUserSendableEmojis } from '../services/chatEmojiScope'
import { consumePendingReceiptShare, isMomentPaymentEnabledForCharacter, loadMomentReceiptCodes, type MomentReceiptDraft } from '../services/momentPayments'

const {
  currentChatUserId,
  mockMoments,
  groups,
  personas,
  activePersonaIndex,
  activePersona,
  activeAvatar,
  activeSignature,
  showPlayerControls,
  resolvedAvatars,
  availableCharacters,
  allNotifications,
  unreadNotificationCount,
  currentActor,
  getKey,
  loadPersonas,
  loadActiveIndex,
  loadSignature,
  loadMoments,
  saveMoments,
  refreshData,
  isLikedByMe,
  toggleMomentLike,
  toggleCommentLike,
  formatTime,
  discoverStore,
  loadCustomContacts
} = useChatDiscover()

const showPublishView = ref(false)
const showActionMenu = ref(false)
const showSignModal = ref(false)
const activeActionMomentId = ref<string | null>(null)
const commentDraft = ref('')
const replyTarget = ref<{ id: string, author: string } | null>(null)
const previewImage = ref('')
const editingMoment = ref<any | null>(null)
const showMomentEditModal = ref(false)
const detailMoment = ref<any | null>(null)
const showDetailModal = ref(false)
const showNotifications = ref(false)
const showCharacterPicker = ref(false)
const showBehaviorSettings = ref(false)
const activeMomentMenuId = ref<string | null>(null)
const pendingDeleteMoment = ref<any | null>(null)
const manualMoment = ref<any | null>(null)
const manualViewLoading = ref(false)
const pendingReceiptDraft = ref<MomentReceiptDraft | null>(null)
const showCommentVoiceModal = ref(false)
const showCommentEmojiPicker = ref(false)
const commentMediaTarget = ref<{ momentId: string; target?: { id: string; author: string } } | null>(null)
const { emojis, loadEmojis } = useChatEmoji()
const userCommentEmojis = computed(() => selectUserSendableEmojis(emojis.value))
const { playVoice } = useVoicePlayer()
const isReceiptActive = (moment: any) => Boolean(moment?.receiptCode && loadMomentReceiptCodes(currentChatUserId.value || 'guest').some(code => code.id === moment.receiptCode.id && code.active))
const openPendingReceiptComposer = () => {
  const draft = consumePendingReceiptShare(currentChatUserId.value || 'guest')
  if (!draft) return
  pendingReceiptDraft.value = draft
  showPublishView.value = true
}

const manualEligibleCharacters = computed(() => availableCharacters.value.filter((chat: any) => !manualMoment.value || canViewMoment(manualMoment.value, { id: chat.id, name: chat.name, groups: chat.groups, groupIds: chat.groupIds, isFriend: ensureRelationship(chat).friendship === 'friends' })))

const isSelectionMode = ref(false)
const selectedIds = ref<string[]>([])
const showBatchDeleteModal = ref(false)

watch(activePersonaIndex, () => loadSignature())
watch(currentChatUserId, () => {
  resolvedAvatars.value = {}
  refreshData()
})
watch(detailMoment, (val) => {
  showDetailModal.value = !!val
})
watch(showDetailModal, (val) => {
  if (!val) detailMoment.value = null
})

onMounted(() => {
  loadCustomContacts()
  refreshData().then(openPendingReceiptComposer)
  loadEmojis()
  window.addEventListener('storage', (e) => {
    if (e.key === getKey('app_chat_personas')) loadPersonas().then(() => loadSignature())
    if (e.key === getKey('app_chat_active_persona_index')) {
      loadActiveIndex()
      loadSignature()
    }
  })
  window.addEventListener('clingy:moments-updated', loadMoments)
  window.addEventListener('clingy:open-receipt-share', openPendingReceiptComposer)
})
onUnmounted(() => {
  window.removeEventListener('clingy:moments-updated', loadMoments)
  window.removeEventListener('clingy:open-receipt-share', openPendingReceiptComposer)
})

const enterSelectionMode = () => { isSelectionMode.value = true; selectedIds.value = []; closeActionMenu() }
const exitSelectionMode = () => { isSelectionMode.value = false; selectedIds.value = [] }
const toggleSelection = (id: string) => {
  if (selectedIds.value.includes(id)) selectedIds.value = selectedIds.value.filter(i => i !== id)
  else selectedIds.value.push(id)
}
const isAllSelected = computed(() => mockMoments.value.length > 0 && selectedIds.value.length === mockMoments.value.length)
const toggleSelectAll = () => {
  if (isAllSelected.value) selectedIds.value = []
  else selectedIds.value = mockMoments.value.map(m => m.id)
}
const confirmBatchDelete = async () => {
  if (selectedIds.value.length === 0) return
  mockMoments.value = mockMoments.value.filter(m => !selectedIds.value.includes(m.id))
  try { await discoverStore.setItem(getKey('moments_list'), JSON.parse(JSON.stringify(mockMoments.value))) } catch(e) {}
  showBatchDeleteModal.value = false
  exitSelectionMode()
}

const openCommentBox = (moment: any, target: any = null) => {
  detailMoment.value = null
  activeActionMomentId.value = moment.id
  replyTarget.value = target ? { id: target.id, author: target.author } : null
  commentDraft.value = ''
}

const submitComment = async () => {
  const moment = mockMoments.value.find(m => m.id === activeActionMomentId.value)
  const content = commentDraft.value.trim()
  if (!moment || !content) return
  moment.comments ||= []
  moment.comments.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    author: currentActor.value.name,
    authorId: currentActor.value.id,
    content,
    replyTo: replyTarget.value?.id || '',
    replyToAuthor: replyTarget.value?.author || '',
    likes: [],
    createdAt: Date.now()
  })
  await saveMoments()
  closeCommentBox()
}

const appendMediaComment = async (kind: 'voice' | 'emoji', payload: any) => {
  const context = commentMediaTarget.value
  if (!context) return
  const moment = mockMoments.value.find(m => m.id === context.momentId)
  if (!moment) return
  moment.comments ||= []
  moment.comments.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    author: currentActor.value.name,
    authorId: currentActor.value.id,
    content: kind === 'voice' ? (payload.text || '[语音回复]') : (payload.name || '[表情包]'),
    kind,
    voice: kind === 'voice' ? payload : undefined,
    emojiId: kind === 'emoji' ? payload.id : undefined,
    emojiName: kind === 'emoji' ? payload.name : undefined,
    replyTo: context.target?.id || '',
    replyToAuthor: context.target?.author || '',
    likes: [],
    createdAt: Date.now()
  })
  await saveMoments()
  commentMediaTarget.value = null
  closeCommentBox()
}

const openCommentMedia = (kind: 'voice' | 'emoji', moment: any, target: any = null) => {
  commentMediaTarget.value = { momentId: moment.id, target: target ? { id: target.id, author: target.author } : undefined }
  if (kind === 'voice') showCommentVoiceModal.value = true
  else showCommentEmojiPicker.value = true
}

const handleCommentVoiceSend = async (data: { text: string; seconds: number; audioBlob?: Blob; mimeType?: string; isRealVoice?: boolean; transcriptStatus?: string }) => {
  const audioId = data.audioBlob ? await saveRecordedVoice(data.audioBlob) : undefined
  await appendMediaComment('voice', { ...data, audioId, source: 'user' })
  showCommentVoiceModal.value = false
}

const selectCommentEmoji = async (emoji: any) => {
  await appendMediaComment('emoji', emoji)
  showCommentEmojiPicker.value = false
}

const resolveEmojiUrl = (comment: any) => {
  const emoji = emojis.value.find(item => String(item.id) === String(comment.emojiId))
  return emoji?.previewUrl || (typeof comment.emojiUrl === 'string' ? comment.emojiUrl : '')
}

const speakFallback = (text: string) => {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
}

const playMomentVoice = async (item: any) => {
  const voice = item?.voice
  if (!voice) return
  if (voice.audioId) {
    try { await playRecordedVoice(voice.audioId); return } catch (_) {}
  }
  const character = availableCharacters.value.find((chat: any) => String(chat.id) === String(item.authorId))
  if (character && voice.text) {
    try {
      const numericId = Array.from(String(item.id || Date.now())).reduce((sum, char) => sum + char.charCodeAt(0), 0)
      await playVoice(numericId, voice.text, character)
      return
    } catch (_) {}
  }
  speakFallback(voice.text || item.content || '')
}

const handleDetailCommentSubmit = async (momentId: string, content: string, target?: { id: string, author: string }) => {
  const moment = mockMoments.value.find(m => m.id === momentId)
  if (!moment) return
  moment.comments ||= []
  moment.comments.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    author: currentActor.value.name,
    authorId: currentActor.value.id,
    content,
    replyTo: target?.id || '',
    replyToAuthor: target?.author || '',
    likes: [],
    createdAt: Date.now()
  })
  await saveMoments()
}

const deleteComment = async (moment: any, comment: any) => {
  if (comment.authorId !== currentActor.value.id && comment.author !== currentActor.value.name) return
  moment.comments = moment.comments.filter((c: any) => c.id !== comment.id)
  await saveMoments()
}

const closeCommentBox = () => { activeActionMomentId.value = null; replyTarget.value = null; commentDraft.value = '' }

const getAvatarUrl = (moment: any) => {
  if (resolvedAvatars.value[moment.id]) return resolvedAvatars.value[moment.id]
  if (!moment.avatar) return ''
  const url = moment.avatar
  if (url.startsWith('data:image') || url.startsWith('http') || url.startsWith('blob:') || url.startsWith('/') || url.startsWith('./')) return url
  return ''
}

const getAvatarText = (moment: any) => {
  if (moment.avatar && !moment.avatar.startsWith('localforage:') && !getAvatarUrl(moment)) return moment.avatar
  return moment.author ? moment.author.charAt(0) : '我'
}

const confirmDeleteMoment = async () => {
  if (!pendingDeleteMoment.value) return
  mockMoments.value = mockMoments.value.filter(m => m.id !== pendingDeleteMoment.value.id)
  try { await discoverStore.setItem(getKey('moments_list'), JSON.parse(JSON.stringify(mockMoments.value))) } catch(e) {}
  if (detailMoment.value?.id === pendingDeleteMoment.value.id) detailMoment.value = null
  pendingDeleteMoment.value = null
}

const togglePinned = async (moment: any) => { moment.pinned = !moment.pinned; mockMoments.value.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || Number(b.time) - Number(a.time)); await saveMoments() }
const openMomentEdit = (moment: any) => { editingMoment.value = moment; showMomentEditModal.value = true }
const saveMomentEdit = async (content: string) => { if (editingMoment.value) { editingMoment.value.content = content.trim(); editingMoment.value.updatedAt = Date.now(); await saveMoments() }; showMomentEditModal.value = false }
const openDetail = (moment: any) => { activeMomentMenuId.value = null; if (!isSelectionMode.value) detailMoment.value = moment }
const openManualViewer = (moment: any) => { manualMoment.value = moment; showCharacterPicker.value = true }

const requestCharacterView = async (chat: any) => {
  if (!manualMoment.value || manualViewLoading.value) return
  manualViewLoading.value = true
  try {
    const moment = manualMoment.value
    const comments = (moment.comments || []).map((c: any) => `[${c.id}]${c.author}:${c.kind === 'voice' ? `语音“${c.voice?.text || c.content}”` : c.kind === 'emoji' ? `表情包“${c.emojiName || c.content}”` : c.content}`).join('；') || '无'
    const receiptHint = isReceiptActive(moment) && ensureRelationship(chat).friendship === 'friends' && isMomentPaymentEnabledForCharacter(currentChatUserId.value || 'guest', chat)
      ? ` 这条动态附带有效的收款码${moment.receiptCode.amountCents ? `，指定金额 ${(moment.receiptCode.amountCents / 100).toFixed(2)} 元` : ''}${moment.receiptCode.remark ? `，备注“${moment.receiptCode.remark}”` : ''}。如果你真心愿意付款，可输出 <pay_moment id="${moment.id}" amount="金额" remark="付款留言" />；不愿付款时不要输出。`
      : ''
    const roleEmojiNames = selectRoleAvailableEmojis(emojis.value as any[], String(chat.id)).map((item: any) => item.name).filter(Boolean)
    const emojiHint = roleEmojiNames.length ? ` 可用表情包：${roleEmojiNames.join('、')}。` : ' 当前没有可用表情包，不要输出表情包回复。'
    const systemPrompt = globalPromptSettings.language === 'en'
      ? `You are ${chat.name}. Persona: ${chat.persona || 'Act according to the personality and relationship established in prior conversation'}. View this Moments post as a real person would. Independently decide whether to only view, like, comment, reply, send a voice reply, use an available sticker, pay an attached receipt code, or combine relevant interactions. Voice replies use media="voice" and stickers use media="emoji" on <interact_moment>. You do not need to interact merely to complete a task. Output only tags you genuinely choose; do not output chat messages. Moment ID: ${moment.id}; author: ${moment.author}; content: ${moment.content}; comments: ${comments}.${receiptHint}`
      : `你是${chat.name}。你的人设是：${chat.persona || '按照你在既有对话中形成的性格与关系行事'}。请像真人刷到动态一样，只依据你自己的性格、当下感受、与作者的关系和内容，自主决定只看、点赞、文字评论、语音回复、表情包回复、回复评论或组合互动；不必为了完成任务而互动。语音评论使用 media="voice"，表情包评论使用 media="emoji"。${emojiHint}只输出你确实想做的朋友圈互动标签，不要输出聊天消息。动态ID：${moment.id}；作者：${moment.author}；内容：${moment.content}；评论：${comments}。${receiptHint}`
    const request = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: globalPromptSettings.language === 'en' ? 'View this Moments post.' : '请看看这条朋友圈。' }
    ]
    let result
    try { result = await sendCapabilityMessage('moment-interaction', request) }
    catch { result = await sendChatMessage(request) }
    chat.__forceMomentAction = true
    try { await processMomentTags(typeof result === 'string' ? result : result.content, chat) } finally { delete chat.__forceMomentAction }
    await loadMoments()
    const viewed = mockMoments.value.find(m => m.id === moment.id)
    if (viewed) {
      viewed.views ||= []
      if (!viewed.views.some((person: any) => String(person.id) === String(chat.id))) viewed.views.push({ id: chat.id, name: chat.name, viewedAt: Date.now() })
      if (viewed.isOwn) addMomentNotification(viewed, { id: chat.id, name: chat.name }, 'view')
      await saveMoments()
    }
  } catch (error: any) {
    window.alert(`角色查看失败：${error?.message || '请检查 API 配置'}`)
  } finally {
    manualViewLoading.value = false
    showCharacterPicker.value = false
  }
}

const markNotificationsRead = async () => { mockMoments.value.forEach(m => (m.notifications || []).forEach((n: any) => n.read = true)); await saveMoments() }
const openNotificationMoment = async (notice: any) => { const moment = mockMoments.value.find(m => m.id === notice.momentId); if (!moment) return; const original = (moment.notifications || []).find((n: any) => n.id === notice.id); if (original) original.read = true; await saveMoments(); showNotifications.value = false; detailMoment.value = moment }

const handlePublish = async (data: { text: string, images: {url: string, isBase64: boolean}[], visibility: string, groupIds?: string[], characterIds?: Array<string | number>, location?: string, mentions?: { id: string | number, name: string }[], voice?: any, receiptCode?: any }) => {
  const currentName = activePersona.value?.name || '我'
  const currentAvatar = activePersona.value?.avatar || ''
  const newMoment = {
    id: Date.now().toString(), author: currentName, avatar: currentAvatar, content: data.text,
    images: data.images.map(img => img.url), time: Date.now(), visibility: data.visibility,
    visibilityGroups: data.groupIds || [], location: data.location || '', mentions: data.mentions || [],
    visibilityCharacterIds: data.characterIds || [], voice: data.voice || undefined, receiptCode: data.receiptCode || undefined,
    isOwn: true, likes: [], comments: []
  }
  const firstUnpinned = mockMoments.value.findIndex(m => !m.pinned)
  mockMoments.value.splice(firstUnpinned < 0 ? mockMoments.value.length : firstUnpinned, 0, newMoment)
  showPublishView.value = false
  pendingReceiptDraft.value = null
  try { await discoverStore.setItem(getKey('moments_list'), JSON.parse(JSON.stringify(mockMoments.value))) } catch(e) {}
}

const toggleActionMenu = () => showActionMenu.value = !showActionMenu.value
const closeActionMenu = () => showActionMenu.value = false
const togglePlayerControls = () => { showPlayerControls.value = !showPlayerControls.value; localStorage.setItem('clingy_discover_show_controls', String(showPlayerControls.value)); closeActionMenu() }
const openSignModal = () => showSignModal.value = true

const handleSignSave = (text: string) => {
  activeSignature.value = text
  if (activePersona.value) {
    const saved = localStorage.getItem(getKey('app_chat_personas'))
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        const target = parsed.find((p: any) => p.id === activePersona.value.id)
        if (target) {
          target.customText = text
          localStorage.setItem(getKey('app_chat_personas'), JSON.stringify(parsed))
          const pIndex = personas.value.findIndex(p => p.id === activePersona.value.id)
          if (pIndex !== -1) personas.value[pIndex].customText = text
        }
      } catch(e) {}
    }
  }
}
</script>

<template>
  <div class="view-container with-tabbar discover-view">
    <div class="discover-bg"></div>

    <main class="discover-main">
      <div class="discover-top-actions">
        <template v-if="!isSelectionMode">
          <div style="position: relative;">
            <svg @click="toggleActionMenu" viewBox="0 0 24 24" width="22" height="22" stroke="#555" stroke-width="2" fill="none" class="top-action-icon"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            <span v-if="unreadNotificationCount" class="moment-unread-badge">{{ unreadNotificationCount > 99 ? '99+' : unreadNotificationCount }}</span>
            <div v-if="showActionMenu" class="dropdown-overlay" @click.stop="closeActionMenu"></div>
            <div v-if="showActionMenu" class="action-dropdown">
              <div class="action-item" @click.stop="togglePlayerControls">{{ showPlayerControls ? '隐藏播放条' : '显示播放条' }}</div>
              <div class="action-item" @click.stop="enterSelectionMode">批量删除</div>
              <div class="action-item" @click.stop="showNotifications = true; closeActionMenu()">互动消息<span v-if="unreadNotificationCount">（{{ unreadNotificationCount }}）</span></div>
              <div class="action-item" @click.stop="showBehaviorSettings = true; closeActionMenu()">角色朋友圈设置</div>
            </div>
          </div>
          <svg @click="showPublishView = true" viewBox="0 0 24 24" width="22" height="22" stroke="#555" stroke-width="2" fill="none" class="top-action-icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </template>
        <template v-else>
          <div class="selection-action-btn" @click="exitSelectionMode">取消</div>
          <div class="selection-action-btn" @click="toggleSelectAll">{{ isAllSelected ? '取消全选' : '全选' }}</div>
        </template>
      </div>

      <div class="discover-header-section">
        <div class="discover-avatar-wrapper">
          <div class="discover-avatar-placeholder" v-if="!activeAvatar"></div>
          <img v-else :src="activeAvatar" class="discover-avatar-img" />
        </div>
        <div class="discover-player">
          <div class="player-pill" @click="openSignModal">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#999" stroke-width="2" fill="none" class="heart-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <div class="signature-text">{{ activeSignature }}</div>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="#555" stroke-width="2" fill="#555" class="heart-icon"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          </div>
          <div class="progress-bar-container" v-if="showPlayerControls"><div class="progress-track"><div class="progress-fill"></div></div></div>
          <div class="player-controls" v-if="showPlayerControls">
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#888" stroke-width="2" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#888" stroke-width="2" fill="#888"><polygon points="19 20 9 12 19 4 19 20"></polygon><line x1="5" y1="19" x2="5" y2="5"></line></svg>
            <div class="play-btn"><svg viewBox="0 0 24 24" width="20" height="20" stroke="#fff" stroke-width="2" fill="#fff"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg></div>
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="#888" stroke-width="2" fill="#888"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg>
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="#888" stroke-width="2" fill="none"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
          </div>
        </div>
      </div>

      <div class="discover-moments-section">
        <div v-for="moment in mockMoments" :key="moment.id" class="moment-item" :class="{'is-selection-mode': isSelectionMode}" @click="isSelectionMode ? toggleSelection(moment.id) : openDetail(moment)">
          <div v-if="isSelectionMode" class="moment-checkbox"><div class="checkbox-circle" :class="{'is-checked': selectedIds.includes(moment.id)}"><svg v-if="selectedIds.includes(moment.id)" viewBox="0 0 24 24" width="14" height="14" stroke="#fff" stroke-width="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg></div></div>
          <div class="moment-avatar">
            <img v-if="getAvatarUrl(moment)" :src="getAvatarUrl(moment)" style="width: 100%; height: 100%; border-radius: 8px; object-fit: cover;" />
            <span v-else>{{ getAvatarText(moment) }}</span>
          </div>
          <div class="moment-content-wrap">
            <div class="moment-author"><span v-if="moment.pinned" class="pinned-mark">置顶</span>{{ moment.author }}</div>
            <div class="moment-content">{{ moment.content }}</div>
            <button v-if="moment.voice" class="moment-voice-bubble" @click.stop="playMomentVoice(moment)"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg><span>{{ moment.voice.seconds || 1 }}″</span><small>{{ moment.voice.text || '语音动态' }}</small></button>
            <div v-if="moment.location" class="moment-meta">⌖ {{ moment.location }}</div>
            <div v-if="moment.mentions?.length" class="moment-meta">@{{ moment.mentions.map((person: any) => person.name).join(' @') }}</div>
            <div class="moment-images" v-if="moment.images && moment.images.length">
              <img v-for="(img, idx) in moment.images" :key="idx" :src="img" class="moment-img" @click.stop="previewImage = img" />
            </div>
            <div v-if="moment.receiptCode" class="moment-receipt-card">
              <img :src="moment.receiptCode.posterDataUrl" alt="朋友圈收款码" @click.stop="previewImage = moment.receiptCode.posterDataUrl" />
              <div><strong>收款码</strong><span>{{ isReceiptActive(moment) ? (moment.receiptCode.amountCents ? `¥${(moment.receiptCode.amountCents / 100).toFixed(2)}` : '金额由好友填写') : '已失效' }}</span><small v-if="moment.receiptCode.remark">{{ moment.receiptCode.remark }}</small><small v-if="moment.receiptPayments?.length">已收到 {{ moment.receiptPayments.length }} 笔</small></div>
            </div>
            <div v-if="moment.isGeneratingImage" class="moment-image-status">正在生成配图…</div>
            <div v-else-if="moment.imageError" class="moment-image-status is-error">配图生成失败，已发布文字动态</div>
            
            <div class="moment-footer">
              <div class="moment-time-wrap">
                <span class="moment-time">{{ formatTime(moment.time) }}</span>
                <svg v-if="moment.visibility && moment.visibility !== '公开'" viewBox="0 0 24 24" width="14" height="14" stroke="#888" stroke-width="2" fill="none" class="visibility-icon"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <div v-if="moment.isOwn && !isSelectionMode" class="own-moment-menu-wrap"><button class="own-moment-more" @click.stop="activeMomentMenuId = activeMomentMenuId === moment.id ? null : moment.id">•••</button><div v-if="activeMomentMenuId === moment.id" class="own-moment-menu"><button @click.stop="openMomentEdit(moment); activeMomentMenuId = null">编辑</button><button @click.stop="togglePinned(moment); activeMomentMenuId = null">{{ moment.pinned ? '取消置顶' : '置顶' }}</button><button class="danger" @click.stop="pendingDeleteMoment = moment; activeMomentMenuId = null">删除</button></div></div>
              </div>
              <div class="moment-actions" v-if="!isSelectionMode">
                <button class="moment-action-btn" title="让角色看看" @click.stop="openManualViewer(moment)"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path></svg></button>
                <button class="moment-action-btn" :class="{ active: isLikedByMe(moment) }" :title="isLikedByMe(moment) ? '取消点赞' : '点赞'" @click.stop="toggleMomentLike(moment)"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" :fill="isLikedByMe(moment) ? 'currentColor' : 'none'"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></button>
                <button class="moment-action-btn" title="评论" @click.stop="openCommentBox(moment)"><svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg></button>
              </div>
            </div>

            <div class="moment-interactions" v-if="(moment.likes && moment.likes.length) || (moment.comments && moment.comments.length)">
              <div class="moment-likes" v-if="moment.likes && moment.likes.length"><svg viewBox="0 0 24 24" width="12" height="12" stroke="#576b95" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span class="like-names">{{ moment.likes.join(', ') }}</span></div>
              <div class="moment-comments" v-if="moment.comments && moment.comments.length">
                <div v-for="(comment, cIdx) in moment.comments" :key="comment.id || cIdx" class="comment-item">
                  <div class="comment-main" @click.stop="openCommentBox(moment, comment)"><span class="comment-author">{{ comment.author }}</span><span v-if="comment.replyToAuthor" class="comment-reply">回复 {{ comment.replyToAuthor }}</span>:<button v-if="comment.kind === 'voice'" class="inline-voice" @click.stop="playMomentVoice(comment)">▶ {{ comment.voice?.seconds || 1 }}″</button><img v-else-if="comment.kind === 'emoji' && resolveEmojiUrl(comment)" :src="resolveEmojiUrl(comment)" :alt="comment.emojiName || '表情包'" class="comment-emoji" /><span v-else class="comment-text">{{ comment.content }}</span></div>
                  <div class="comment-tools">
                    <button @click.stop="toggleCommentLike(comment)" :class="{ active: comment.likes?.includes(currentActor.name) }"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg><span v-if="comment.likes?.length">{{ comment.likes.length }}</span></button>
                    <button v-if="comment.authorId === currentActor.id || comment.author === currentActor.name" @click.stop="deleteComment(moment, comment)"><svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6m3 0V4h8v2"></path></svg></button>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="activeActionMomentId === moment.id" class="comment-composer" @click.stop>
              <span v-if="replyTarget" class="reply-hint">回复 {{ replyTarget.author }}</span>
              <input v-model="commentDraft" maxlength="200" :placeholder="replyTarget ? `回复 ${replyTarget.author}…` : '说点什么…'" @keyup.enter="submitComment" />
              <button class="media-comment" title="语音回复" @click="openCommentMedia('voice', moment, replyTarget)">语音</button>
              <button class="media-comment" title="表情包回复" @click="openCommentMedia('emoji', moment, replyTarget)">表情</button>
              <button :disabled="!commentDraft.trim()" @click="submitComment">发送</button>
              <button class="cancel-comment" @click="closeCommentBox">取消</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <TextEditModal v-model:visible="showSignModal" title="自定义文案" :current-text="activeSignature" default-text="点击设置自定义文案..." placeholder="输入自定义文案" @saved="handleSignSave" />
    <TextEditModal v-model:visible="showMomentEditModal" title="编辑朋友圈" :current-text="editingMoment?.content || ''" default-text="" placeholder="这一刻的想法" @saved="saveMomentEdit" />
    
    <Teleport to="body">
      <!-- 动态详情弹窗 -->
      <DiscoverDetailModal
        v-model:visible="showDetailModal"
        :moment="detailMoment"
        :formatTime="formatTime"
        :currentActor="currentActor"
        :resolveEmojiUrl="resolveEmojiUrl"
        :isReceiptActive="isReceiptActive"
        @preview="url => previewImage = url"
        @submit-comment="handleDetailCommentSubmit"
        @toggle-like="toggleCommentLike"
        @play-voice="playMomentVoice"
        @request-media="(kind, moment, target) => openCommentMedia(kind, moment, target)"
      />

      <!-- 图片预览 -->
      <div v-if="previewImage" class="image-preview-overlay" @click="previewImage = ''"><img :src="previewImage" @click.stop /><a :href="previewImage" download="moment-image.png" @click.stop>保存图片</a></div>
      
      <!-- 角色查看 -->
      <div v-if="showCharacterPicker" class="moment-modal-overlay" @click.self="showCharacterPicker = false"><div class="moment-sheet"><h3>让谁看看这条</h3><button v-for="chat in manualEligibleCharacters" :key="chat.id" :disabled="manualViewLoading" @click="requestCharacterView(chat)">{{ chat.name }}</button><div v-if="!manualEligibleCharacters.length" class="empty-note">没有角色拥有这条动态的查看权限</div><button @click="showCharacterPicker = false">取消</button></div></div>
      
      <!-- 通知消息 -->
      <div v-if="showNotifications" class="moment-modal-overlay" @click.self="showNotifications = false"><div class="moment-sheet notification-sheet"><h3>互动消息</h3><div v-if="!allNotifications.length" class="empty-note">还没有新互动</div><div v-for="notice in allNotifications" :key="notice.id" class="notice-item" :class="{ unread: !notice.read }" @click="openNotificationMoment(notice)"><b>{{ notice.actorName }}</b> {{ notice.type === 'like' ? '赞了你的动态' : notice.type === 'comment' ? `评论：${notice.content}` : notice.type === 'reply' ? `回复：${notice.content}` : notice.type === 'view' ? '查看了这条动态' : notice.type === 'payment' ? `通过收款码向你转账 ¥${notice.content.split('|')[0]}` : '赞了你的评论' }}<small>{{ formatTime(notice.createdAt) }}</small></div><button @click="markNotificationsRead">全部已读</button><button @click="showNotifications = false">关闭</button></div></div>
      
      <!-- 朋友圈行为设置弹窗 -->
      <DiscoverBehaviorModal
        v-model:visible="showBehaviorSettings"
        :availableCharacters="availableCharacters"
        :groups="groups"
        :getMomentBehavior="getMomentBehavior"
        @contacts-updated="loadCustomContacts"
      />
      
      <!-- 删除确认 -->
      <div v-if="pendingDeleteMoment" class="moment-modal-overlay" @click.self="pendingDeleteMoment = null"><div class="moment-sheet"><h3>删除朋友圈</h3><div class="empty-note">删除后无法恢复，确定继续吗？</div><button class="danger-text" @click="confirmDeleteMoment">删除</button><button @click="pendingDeleteMoment = null">取消</button></div></div>
      
      <Transition name="zoom-fade">
        <DiscoverPublish v-if="showPublishView" :initial-receipt="pendingReceiptDraft" @close="showPublishView = false; pendingReceiptDraft = null" @publish="handlePublish" />
      </Transition>
      <ChatVoiceModal :visible="showCommentVoiceModal" @close="showCommentVoiceModal = false; commentMediaTarget = null" @send="handleCommentVoiceSend" />
      <div v-if="showCommentEmojiPicker" class="moment-modal-overlay" @click.self="showCommentEmojiPicker = false; commentMediaTarget = null"><div class="moment-sheet emoji-picker-sheet"><h3>选择表情包</h3><div v-if="userCommentEmojis.length" class="moment-emoji-grid"><button v-for="emoji in userCommentEmojis" :key="emoji.id" @click="selectCommentEmoji(emoji)"><img v-if="emoji.previewUrl" :src="emoji.previewUrl" :alt="emoji.name" /><span>{{ emoji.name }}</span></button></div><div v-else class="empty-note">还没有可发送的用户表情包</div><button @click="showCommentEmojiPicker = false; commentMediaTarget = null">取消</button></div></div>
    </Teleport>

    <!-- 底部批量删除栏 -->
    <Teleport to="body">
      <div v-if="isSelectionMode" class="batch-delete-bar">
        <div class="batch-delete-info">已选 {{ selectedIds.length }} 项</div>
        <button class="batch-delete-btn" :disabled="selectedIds.length === 0" @click="showBatchDeleteModal = true">删除</button>
      </div>

      <DiscoverBatchDeleteModal
        v-model:visible="showBatchDeleteModal"
        :count="selectedIds.length"
        @confirm="confirmBatchDelete"
      />
    </Teleport>
  </div>
</template>

<style scoped>
@import './app_ChatDiscover.css';
</style>
