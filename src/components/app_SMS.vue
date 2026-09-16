<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { globalSettings } from '../store'
import { useChatAuth } from '../composables/useChatAuth'
import { generateCharacterSmsReply } from '../services/smsCharacterService'
import {
  clearSmsThread, createSmsThread, deleteSmsThread, ensureCharacterSmsThread, ensureSmsIdentity, findSmsThread,
  loadSmsContacts, loadSmsSettings, loadSmsThreads, markSmsThreadRead, processScheduledSms, receiveRandomStrangerSms,
  saveSmsDraft, saveSmsSettings, sendSmsMessage, smsSettingsUpdatedEventName, smsUpdatedEventName, startPrankSms,
  stopNarrativeSms, updateSmsThread, continueNarrativeSms, type SmsContactRecord, type SmsSettings, type SmsThreadCategory,
  type SmsThreadRecord
} from '../services/smsService'

const emit = defineEmits(['close'])
const { currentChatUserId } = useChatAuth()
const accountId = () => currentChatUserId.value || 'guest'

const smsList = ref<SmsThreadRecord[]>([])
const settings = ref<SmsSettings>(loadSmsSettings(accountId()))
const contacts = ref<SmsContactRecord[]>([])
const activeSms = ref<SmsThreadRecord | null>(null)
const view = ref<'list' | 'detail' | 'compose' | 'settings' | 'play'>('list')
const previousView = ref<'list' | 'detail'>('list')
const search = ref('')
const activeFilter = ref<'all' | SmsThreadCategory | 'archived'>('all')
const draft = ref('')
const manualNumber = ref('')
const manualName = ref('')
const scheduleAt = ref('')
const busy = ref(false)
const menuOpen = ref(false)
const confirmAction = ref<'delete' | 'clear' | null>(null)
const toast = ref('')
const messageListEl = ref<HTMLElement | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

const reload = () => {
  processScheduledSms(accountId())
  smsList.value = loadSmsThreads(accountId())
  settings.value = loadSmsSettings(accountId())
  contacts.value = loadSmsContacts(accountId())
  if (activeSms.value) activeSms.value = smsList.value.find(thread => thread.id === activeSms.value?.id) || null
}

const latestMessage = (thread: SmsThreadRecord) => thread.messages.at(-1)
const categoryLabel = (category?: SmsThreadCategory) => ({ personal: '个人', transaction: '交易', service: '服务', otp: '验证码', stranger: '陌生', promotion: '推广', blocked: '已拦截' }[category || 'personal'])
const formatTime = (createdAt?: number) => {
  if (!createdAt) return ''
  const diff = Date.now() - createdAt
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))}分钟前`
  const date = new Date(createdAt)
  if (date.toDateString() === new Date().toDateString()) return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}
const formatMessageTime = (createdAt?: number) => createdAt ? new Date(createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const messageStatus = (status?: string) => ({ scheduled: '待发送', sending: '发送中', sent: '已发送', delivered: '已送达', failed: '发送失败', blocked: '已拦截' }[status || ''] || '')

const filteredThreads = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return smsList.value.filter(thread => {
    if (activeFilter.value === 'archived' ? !thread.archived : thread.archived) return false
    if (activeFilter.value !== 'all' && activeFilter.value !== 'archived' && thread.category !== activeFilter.value) return false
    if (!keyword) return true
    return `${thread.customName || thread.name} ${thread.number || ''} ${thread.messages.map(item => item.text).join(' ')}`.toLowerCase().includes(keyword)
  })
})
const unreadCount = computed(() => smsList.value.filter(item => item.unread && !item.archived && !item.blocked).length)
const enabledStrangerKinds = computed(() => Object.values(settings.value.strangerKinds).some(Boolean))
const currentContact = computed(() => activeSms.value?.linkedCharacterId ? contacts.value.find(item => item.linkedCharacterId === activeSms.value?.linkedCharacterId) || null : null)
const canReply = computed(() => Boolean(activeSms.value?.allowReply && !activeSms.value?.blocked && settings.value.enabled))
const userNumber = computed(() => ensureSmsIdentity(accountId()))

const scrollToBottom = async () => { await nextTick(); messageListEl.value?.scrollTo({ top: messageListEl.value.scrollHeight, behavior: 'smooth' }) }
const openSms = (thread: SmsThreadRecord) => {
  activeSms.value = thread
  draft.value = thread.draft || ''
  view.value = 'detail'
  menuOpen.value = false
  markSmsThreadRead(accountId(), thread.id)
  reload(); void scrollToBottom()
}
const back = () => {
  if (view.value === 'detail') { activeSms.value = null; view.value = 'list'; return }
  if (view.value === 'compose' || view.value === 'settings' || view.value === 'play') { view.value = previousView.value; return }
  emit('close')
}
const openPanel = (target: 'compose' | 'settings' | 'play') => {
  previousView.value = view.value === 'detail' ? 'detail' : 'list'
  view.value = target
  menuOpen.value = false
}

const chooseContact = (contact: SmsContactRecord) => {
  const thread = ensureCharacterSmsThread(accountId(), contact)
  reload(); openSms(findSmsThread(accountId(), thread.id) || thread)
}
const createManual = () => {
  const number = manualNumber.value.replace(/[^\d+#*]/g, '')
  if (number.length < 5) { notify('请输入至少 5 位号码'); return }
  const thread = createSmsThread(accountId(), { name: manualName.value.trim() || number, number, participantType: 'manual', avatarType: 'text', avatarText: (manualName.value.trim() || '?').slice(0, 1), category: 'personal' })
  manualNumber.value = ''; manualName.value = ''; reload(); openSms(findSmsThread(accountId(), thread.id) || thread)
}

const persistDraft = () => { if (activeSms.value) saveSmsDraft(accountId(), activeSms.value.id, draft.value) }
const send = async () => {
  const text = draft.value.trim()
  if (!activeSms.value || !text || !canReply.value || busy.value) return
  const scheduledAt = scheduleAt.value ? new Date(scheduleAt.value).getTime() : undefined
  if (scheduledAt && scheduledAt <= Date.now() + 60_000) { notify('定时时间至少晚于当前时间 1 分钟'); return }
  const threadId = activeSms.value.id
  const sent = sendSmsMessage(accountId(), threadId, text, { scheduledAt })
  if (!sent) { notify('短信未能发送'); return }
  draft.value = ''; scheduleAt.value = ''; saveSmsDraft(accountId(), threadId, '')
  reload(); await scrollToBottom()
  if (scheduledAt) { notify('已加入定时发送'); return }
  const thread = findSmsThread(accountId(), threadId)
  if (!thread) return
  if (thread.narrative && !thread.narrative.ended) {
    busy.value = true
    try { continueNarrativeSms(accountId(), threadId); reload(); await scrollToBottom() }
    finally { busy.value = false }
    return
  }
  const contact = currentContact.value
  if (contact && settings.value.allowCharacterReplies) {
    busy.value = true
    try {
      await generateCharacterSmsReply({ accountId: accountId(), contact, thread, userText: text })
      reload(); await scrollToBottom()
    } catch (error) {
      notify(error instanceof Error ? `已发出；暂未收到回复：${error.message}` : '已发出；暂未收到回复')
    } finally { busy.value = false }
  }
}

const saveSettingsNow = () => { settings.value = saveSmsSettings(accountId(), settings.value); notify('设置已保存') }
const refreshStranger = () => {
  const result = receiveRandomStrangerSms(accountId())
  if (!result.ok) {
    notify(result.reason === 'disabled' ? '请先开启陌生短信' : result.reason === 'daily_limit' ? '今天的陌生短信数量已达上限' : '请至少选择一种陌生短信类型')
    return
  }
  reload(); openSms(result.thread)
}
const launchPrank = (contact: SmsContactRecord) => {
  const result = startPrankSms(accountId(), contact.name)
  if (!result.ok) { notify('请先开启整蛊短信和“允许朋友策划”'); return }
  reload(); openSms(result.thread)
}
const endNarrative = () => {
  if (!activeSms.value || !stopNarrativeSms(accountId(), activeSms.value.id)) return
  reload(); notify('互动已结束')
}

const toggleThread = (key: 'pinned' | 'archived' | 'blocked' | 'muted') => {
  if (!activeSms.value) return
  updateSmsThread(accountId(), activeSms.value.id, { [key]: !activeSms.value[key] })
  reload(); menuOpen.value = false
  if (key === 'archived') { activeSms.value = null; view.value = 'list' }
}
const runConfirmedAction = () => {
  if (!activeSms.value || !confirmAction.value) return
  const id = activeSms.value.id
  if (confirmAction.value === 'delete') { deleteSmsThread(accountId(), id); activeSms.value = null; view.value = 'list' }
  else { clearSmsThread(accountId(), id); reload() }
  confirmAction.value = null; menuOpen.value = false; reload()
}
const setFilter = (value: typeof activeFilter.value) => { activeFilter.value = value }

const onSmsUpdated = (event: Event) => { if ((event as CustomEvent).detail?.accountId === accountId()) reload() }
const onSettingsUpdated = (event: Event) => { if ((event as CustomEvent).detail?.accountId === accountId()) settings.value = loadSmsSettings(accountId()) }
watch(currentChatUserId, () => { activeSms.value = null; view.value = 'list'; reload() })
watch(draft, persistDraft)
onMounted(() => {
  reload(); ensureSmsIdentity(accountId())
  window.addEventListener(smsUpdatedEventName, onSmsUpdated)
  window.addEventListener(smsSettingsUpdatedEventName, onSettingsUpdated)
})
onUnmounted(() => {
  window.removeEventListener(smsUpdatedEventName, onSmsUpdated)
  window.removeEventListener(smsSettingsUpdatedEventName, onSettingsUpdated)
  if (toastTimer) clearTimeout(toastTimer)
})
</script>

<template>
  <div class="sms-app" :class="{ 'dark-mode': globalSettings.darkMode }">
    <header class="app-header">
      <button class="nav-icon" type="button" :aria-label="view === 'list' ? '返回桌面' : '返回'" @click="back">
        <svg v-if="view !== 'list'" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></svg>
        <svg v-else viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /><path d="M9 12h9" /></svg>
      </button>
      <div class="header-copy">
        <template v-if="view === 'list'"><h1>短信</h1><p>{{ unreadCount ? `${unreadCount} 条未读` : userNumber }}</p></template>
        <template v-else-if="view === 'detail' && activeSms"><h1>{{ activeSms.customName || activeSms.name }}</h1><p>{{ activeSms.number }} · {{ categoryLabel(activeSms.category) }}</p></template>
        <template v-else-if="view === 'compose'"><h1>新信息</h1><p>选择联系人或输入虚拟号码</p></template>
        <template v-else-if="view === 'play'"><h1>短信玩法</h1><p>陌生来信与朋友整蛊</p></template>
        <template v-else><h1>短信设置</h1><p>所有拓展默认不打扰聊天</p></template>
      </div>
      <div class="header-actions">
        <template v-if="view === 'list'">
          <button class="nav-icon" type="button" aria-label="短信玩法" @click="openPanel('play')"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="9" /></svg></button>
          <button class="nav-icon" type="button" aria-label="新建短信" @click="openPanel('compose')"><svg viewBox="0 0 24 24"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></svg></button>
          <button class="nav-icon" type="button" aria-label="短信设置" @click="openPanel('settings')"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg></button>
        </template>
        <template v-else-if="view === 'detail'">
          <button class="nav-icon" type="button" aria-label="会话选项" @click="menuOpen = !menuOpen"><svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg></button>
        </template>
      </div>
    </header>

    <main v-if="view === 'list'" class="list-view">
      <div class="search-row">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        <input v-model="search" type="search" placeholder="搜索联系人、号码或短信内容" aria-label="搜索短信">
      </div>
      <nav class="filter-row" aria-label="短信分类">
        <button v-for="item in [{k:'all',n:'全部'},{k:'personal',n:'个人'},{k:'transaction',n:'交易'},{k:'service',n:'服务'},{k:'stranger',n:'陌生'},{k:'blocked',n:'拦截'},{k:'archived',n:'归档'}]" :key="item.k" type="button" :class="{ active: activeFilter === item.k }" @click="setFilter(item.k as any)">{{ item.n }}</button>
      </nav>
      <section class="thread-list">
        <button v-for="thread in filteredThreads" :key="thread.id" class="thread-row" type="button" @click="openSms(thread)">
          <span class="avatar" :class="`cat-${thread.category || 'personal'}`">
            <svg v-if="thread.avatarIcon === 'bell'" viewBox="0 0 24 24"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M14 21h-4" /></svg>
            <svg v-else-if="thread.avatarIcon === 'bank'" viewBox="0 0 24 24"><path d="m3 9 9-5 9 5M5 10v8m5-8v8m4-8v8m5-8v8M3 20h18" /></svg>
            <span v-else>{{ thread.avatarText || thread.name.slice(0, 1) }}</span>
          </span>
          <span class="thread-main">
            <span class="thread-top"><strong>{{ thread.customName || thread.name }}</strong><time>{{ formatTime(latestMessage(thread)?.createdAt) }}</time></span>
            <span class="thread-bottom"><span>{{ thread.draft ? `草稿：${thread.draft}` : latestMessage(thread)?.text || '暂无短信' }}</span><i v-if="thread.unread"></i></span>
          </span>
          <span v-if="thread.pinned" class="pin" aria-label="已置顶">⌃</span>
        </button>
        <div v-if="!filteredThreads.length" class="empty"><span>信</span><strong>{{ search ? '没有匹配的短信' : '这里还没有短信' }}</strong><p>{{ search ? '试试联系人、号码或正文中的其他关键词。' : '可以新建短信，或在短信玩法中接收一条陌生来信。' }}</p></div>
      </section>
    </main>

    <main v-else-if="view === 'detail' && activeSms" class="detail-view">
      <div v-if="activeSms.blocked" class="notice-line">这个号码已被拦截，无法继续发送短信。</div>
      <div v-else-if="activeSms.narrative && !activeSms.narrative.ended" class="notice-line playful">这是可随时结束的{{ activeSms.narrative.kind === 'prank' ? '整蛊' : '陌生来信' }}互动，不会默认影响普通聊天。<button type="button" @click="endNarrative">结束</button></div>
      <section ref="messageListEl" class="message-list">
        <div v-if="!activeSms.messages.length" class="empty compact"><span>…</span><strong>还没有短信</strong><p>发送一条信息开始这段会话。</p></div>
        <article v-for="message in activeSms.messages" :key="message.id" class="message-row" :class="message.type">
          <time>{{ formatMessageTime(message.createdAt) }}</time>
          <p>{{ message.text }}</p>
          <small v-if="message.type === 'send' && messageStatus(message.status)">{{ messageStatus(message.status) }}</small>
        </article>
        <div v-if="busy" class="replying"><i></i><i></i><i></i><span>等待回复</span></div>
      </section>
      <form class="compose-bar" :class="{ disabled: !canReply }" @submit.prevent="send">
        <button class="mini-button" type="button" :disabled="!canReply" aria-label="设置定时发送" @click="scheduleAt = scheduleAt ? '' : new Date(Date.now()+3600000).toISOString().slice(0,16)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></button>
        <div class="draft-box"><textarea v-model="draft" :disabled="!canReply" rows="1" maxlength="5000" :placeholder="canReply ? '输入短信内容' : '该会话不可回复'" @keydown.ctrl.enter="send"></textarea><input v-if="scheduleAt" v-model="scheduleAt" type="datetime-local" aria-label="定时发送时间"></div>
        <button class="send-button" type="submit" :disabled="!draft.trim() || !canReply || busy" aria-label="发送短信"><svg viewBox="0 0 24 24"><path d="m22 2-9 20-2-9-9-2Z" /><path d="M22 2 11 13" /></svg></button>
      </form>
    </main>

    <main v-else-if="view === 'compose'" class="panel-view">
      <section class="panel-card manual-compose"><h2>输入号码</h2><label><span>虚拟手机号或服务号</span><input v-model="manualNumber" inputmode="tel" maxlength="24" placeholder="例如 17012345678"></label><label><span>备注名（可选）</span><input v-model="manualName" maxlength="40" placeholder="未保存的联系人"></label><button class="primary" type="button" @click="createManual">开始短信</button></section>
      <section class="panel-section"><h2>角色联系人</h2><p class="section-note">号码由角色身份稳定生成，不使用任何真实手机号。</p><button v-for="contact in contacts" :key="contact.id" class="contact-row" type="button" @click="chooseContact(contact)"><span>{{ contact.avatarText }}</span><b>{{ contact.name }}</b><small>{{ contact.number }}</small><i>›</i></button><div v-if="!contacts.length" class="inline-empty">聊天中还没有可用的角色联系人。</div></section>
    </main>

    <main v-else-if="view === 'play'" class="panel-view">
      <section class="panel-card play-card"><div><h2>接收陌生来信</h2><p>只写入短信收件箱，不弹出打断，也不会默认影响角色聊天。</p></div><button class="primary compact-button" type="button" :disabled="!settings.strangerEnabled || !enabledStrangerKinds" @click="refreshStranger">接收一条</button></section>
      <section class="panel-section"><h2>朋友委托整蛊</h2><p class="section-note">选择一位角色作为策划者。互动可随时结束，不涉及真实订单、钱款、验证码或严重安全事件。</p><button v-for="contact in contacts" :key="`prank-${contact.id}`" class="contact-row" type="button" :disabled="!settings.prankEnabled || !settings.prankAllowFriends" @click="launchPrank(contact)"><span>{{ contact.avatarText }}</span><b>{{ contact.name }}</b><small>拜托陌生号码联系我</small><i>›</i></button><div v-if="!settings.prankEnabled || !settings.prankAllowFriends" class="inline-empty">需要先在短信设置中开启整蛊短信和“允许朋友策划”。</div></section>
      <button class="secondary-wide" type="button" @click="openPanel('settings')">管理玩法与打扰开关</button>
    </main>

    <main v-else class="settings-view">
      <section class="settings-group"><h2>基本行为</h2>
        <label class="setting-row"><span><b>启用短信功能</b><small>关闭后不再生成或发送新短信，已有记录保留</small></span><input v-model="settings.enabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row"><span><b>允许主动通知打扰</b><small>默认关闭；关闭时新短信只留在收件箱</small></span><input v-model="settings.allowInterruptions" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row"><span><b>聊天期间保持静默</b><small>单聊、群聊和通话时不显示短信弹窗</small></span><input v-model="settings.protectActiveChat" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row"><span><b>勿扰时段</b><small>{{ settings.quietHoursStart }}—{{ settings.quietHoursEnd }}</small></span><input v-model="settings.quietHoursEnabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <div v-if="settings.quietHoursEnabled" class="time-row"><label>开始<input v-model="settings.quietHoursStart" type="time" @change="saveSettingsNow"></label><label>结束<input v-model="settings.quietHoursEnd" type="time" @change="saveSettingsNow"></label></div>
      </section>

      <section class="settings-group"><h2>角色与普通聊天</h2>
        <label class="setting-row"><span><b>允许角色回复短信</b><small>仅在你主动发短信后调用角色回复</small></span><input v-model="settings.allowCharacterReplies" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row"><span><b>允许角色主动发短信</b><small>拓展能力，默认关闭</small></span><input v-model="settings.allowCharacterProactive" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row"><span><b>允许短信影响普通聊天</b><small>总开关；关闭时所有短信保持独立</small></span><input v-model="settings.allowSmsAffectChat" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <template v-if="settings.allowSmsAffectChat">
          <label class="setting-row nested"><span><b>你发给 TA 的短信</b><small>允许当前角色理解你发给 TA 的近期短信</small></span><input v-model="settings.allowUserPhoneAffectChat" type="checkbox" @change="saveSettingsNow"><i></i></label>
          <label class="setting-row nested"><span><b>TA 发给你的短信</b><small>允许当前角色延续自己近期发出的短信</small></span><input v-model="settings.allowCharacterPhoneAffectChat" type="checkbox" @change="saveSettingsNow"><i></i></label>
          <label class="setting-row nested"><span><b>陌生与整蛊短信</b><small>分别控制是否允许进入聊天</small></span><span class="dual-switch"><input v-model="settings.allowStrangerAffectChat" aria-label="陌生短信影响聊天" type="checkbox" @change="saveSettingsNow"><input v-model="settings.allowPrankAffectChat" aria-label="整蛊短信影响聊天" type="checkbox" @change="saveSettingsNow"></span></label>
          <label class="setting-row nested"><span><b>资金短信</b><small>允许角色知晓近期到账与支出短信</small></span><input v-model="settings.allowFinanceAffectChat" type="checkbox" @change="saveSettingsNow"><i></i></label>
        </template>
      </section>

      <section class="settings-group"><h2>陌生来信</h2>
        <label class="setting-row"><span><b>启用陌生短信</b><small>开启后仍需你主动接收，除非另开自动接收</small></span><input v-model="settings.strangerEnabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row nested"><span><b>自动随时间接收</b><small>不会默认弹窗打断</small></span><input v-model="settings.strangerAutoReceive" :disabled="!settings.strangerEnabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <div class="choice-grid"><label><input v-model="settings.strangerKinds.daily" type="checkbox" @change="saveSettingsNow"><span>日常</span></label><label><input v-model="settings.strangerKinds.wrongNumber" type="checkbox" @change="saveSettingsNow"><span>错号</span></label><label><input v-model="settings.strangerKinds.comedy" type="checkbox" @change="saveSettingsNow"><span>喜剧</span></label><label><input v-model="settings.strangerKinds.mystery" type="checkbox" @change="saveSettingsNow"><span>悬疑</span></label></div>
        <label class="number-row"><span>每天最多接收</span><input v-model.number="settings.strangerDailyLimit" type="number" min="1" max="20" @change="saveSettingsNow"><small>条</small></label>
      </section>

      <section class="settings-group"><h2>整蛊短信</h2>
        <label class="setting-row"><span><b>启用整蛊短信</b><small>默认关闭，可随时结束，禁止钱款和严重安全题材</small></span><input v-model="settings.prankEnabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row nested"><span><b>允许朋友或角色策划</b><small>通过独立陌生号码执行</small></span><input v-model="settings.prankAllowFriends" :disabled="!settings.prankEnabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="setting-row nested"><span><b>结束时揭晓策划者</b><small>关闭后只说明事件已结束</small></span><input v-model="settings.prankRevealAtEnd" :disabled="!settings.prankEnabled" type="checkbox" @change="saveSettingsNow"><i></i></label>
        <label class="number-row"><span>最多互动轮数</span><input v-model.number="settings.prankMaxTurns" type="number" min="2" max="20" @change="saveSettingsNow"><small>轮</small></label>
      </section>

      <section class="settings-group"><h2>通知来源</h2>
        <label v-for="source in [{k:'wallet',n:'钱包与银行卡'},{k:'moments',n:'朋友圈与收款'},{k:'calls',n:'电话记录'},{k:'forum',n:'论坛通知'},{k:'books',n:'书城提醒'}]" :key="source.k" class="setting-row compact-setting"><span><b>{{ source.n }}</b></span><input v-model="settings.sourceToggles[source.k as keyof typeof settings.sourceToggles]" type="checkbox" @change="saveSettingsNow"><i></i></label>
      </section>
    </main>

    <div v-if="menuOpen && activeSms" class="popover" @click.self="menuOpen = false">
      <div class="menu-card"><button type="button" @click="toggleThread('pinned')">{{ activeSms.pinned ? '取消置顶' : '置顶会话' }}</button><button type="button" @click="markSmsThreadRead(accountId(), activeSms.id, activeSms.unread); reload(); menuOpen=false">{{ activeSms.unread ? '标为已读' : '标为未读' }}</button><button type="button" @click="toggleThread('muted')">{{ activeSms.muted ? '取消静音' : '静音通知' }}</button><button type="button" @click="toggleThread('archived')">归档会话</button><button type="button" @click="toggleThread('blocked')">{{ activeSms.blocked ? '解除拦截' : '拦截号码' }}</button><button type="button" @click="confirmAction = 'clear'">清空短信</button><button class="danger" type="button" @click="confirmAction = 'delete'">删除会话</button></div>
    </div>

    <div v-if="confirmAction" class="modal-layer" @click.self="confirmAction = null"><section class="confirm-card"><h2>{{ confirmAction === 'delete' ? '删除这个会话？' : '清空所有短信？' }}</h2><p>{{ confirmAction === 'delete' ? '会话和本机短信记录将被删除，已经发生的交易或其他应用事件不会撤销。' : '会话会保留，但其中的短信记录无法恢复。' }}</p><div><button type="button" @click="confirmAction = null">取消</button><button class="danger" type="button" @click="runConfirmedAction">确认</button></div></section></div>
    <Transition name="toast"><div v-if="toast" class="toast">{{ toast }}</div></Transition>
  </div>
</template>

<style scoped>
.sms-app{--bg:var(--sys-bg-secondary);--surface:var(--sys-bg-primary);--text:var(--text-primary);--sub:var(--text-tertiary);--line:var(--border-color);--accent:#4a4a4f;position:absolute;inset:0;z-index:100;display:flex;min-width:0;min-height:0;flex-direction:column;overflow:hidden;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Segoe UI",sans-serif}.sms-app.dark-mode{--bg:#121212;--surface:#232325;--text:#f5f5f7;--sub:#98989d;--line:rgba(255,255,255,.09);--accent:#dedee3}.sms-app *{box-sizing:border-box}.sms-app button,.sms-app input,.sms-app textarea{font:inherit}.sms-app button{color:inherit}.sms-app svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.app-header{display:grid;grid-template-columns:40px minmax(0,1fr) auto;min-height:68px;align-items:center;gap:6px;padding:calc(10px + env(safe-area-inset-top)) 14px 8px;border-bottom:1px solid var(--line);background:var(--bg)}.nav-icon{display:grid;width:36px;height:36px;padding:7px;border:0;border-radius:50%;background:transparent;cursor:pointer;place-items:center}.nav-icon:active{background:var(--surface)}.header-copy{min-width:0;text-align:center}.header-copy h1{overflow:hidden;margin:0;font-size:17px;font-weight:650;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}.header-copy p{overflow:hidden;margin:2px 0 0;color:var(--sub);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.header-actions{display:flex;min-width:36px;justify-content:flex-end}.list-view,.detail-view,.panel-view,.settings-view{display:flex;min-height:0;flex:1;flex-direction:column}.search-row{display:flex;align-items:center;gap:8px;margin:10px 16px 7px;padding:8px 11px;border-radius:18px;background:var(--surface);color:var(--sub)}.search-row svg{width:17px;height:17px}.search-row input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:var(--text);font-size:13px}.search-row input::placeholder{color:var(--sub)}.filter-row{display:flex;flex:none;gap:7px;overflow-x:auto;padding:2px 16px 9px;scrollbar-width:none}.filter-row::-webkit-scrollbar{display:none}.filter-row button{flex:none;padding:5px 10px;border:1px solid var(--line);border-radius:13px;background:transparent;color:var(--sub);font-size:11px;cursor:pointer}.filter-row button.active{border-color:var(--text);background:var(--text);color:var(--bg)}.thread-list{min-height:0;flex:1;overflow-y:auto;padding-bottom:calc(20px + env(safe-area-inset-bottom));scrollbar-width:none}.thread-row{position:relative;display:flex;width:100%;min-width:0;align-items:center;padding:11px 16px;border:0;background:transparent;text-align:left;cursor:pointer}.thread-row:active{background:var(--surface)}.avatar{display:grid;width:42px;height:42px;flex:none;margin-right:11px;border-radius:50%;background:var(--surface);color:var(--text);font-size:16px;font-weight:650;place-items:center}.avatar svg{width:19px;height:19px}.cat-transaction{background:#eff6f0;color:#376b43}.dark-mode .cat-transaction{background:#213627;color:#9dd5a8}.cat-stranger,.cat-blocked{background:#f3f0f6;color:#685976}.dark-mode .cat-stranger,.dark-mode .cat-blocked{background:#342d3c;color:#c9b5d8}.thread-main{display:flex;min-width:0;flex:1;flex-direction:column;gap:4px}.thread-top,.thread-bottom{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:8px}.thread-top strong{overflow:hidden;min-width:0;font-size:15px;font-weight:580;text-overflow:ellipsis;white-space:nowrap}.thread-top time{flex:none;color:var(--sub);font-size:11px}.thread-bottom>span{display:-webkit-box;min-width:0;overflow:hidden;flex:1;color:var(--sub);font-size:12px;line-height:1.35;-webkit-box-orient:vertical;-webkit-line-clamp:2}.thread-bottom i{width:7px;height:7px;flex:none;border-radius:50%;background:var(--text)}.pin{position:absolute;top:31px;right:9px;color:var(--sub);font-size:10px}.empty{display:flex;align-items:center;flex-direction:column;padding:70px 30px;color:var(--sub);text-align:center}.empty>span{display:grid;width:45px;height:45px;margin-bottom:12px;border:1px solid var(--line);border-radius:50%;font-size:18px;place-items:center}.empty strong{margin-bottom:6px;color:var(--text);font-size:14px}.empty p{max-width:250px;font-size:12px;line-height:1.55}.empty.compact{margin:auto;padding:30px}.notice-line{display:flex;align-items:center;justify-content:center;gap:8px;padding:7px 14px;background:var(--surface);color:var(--sub);font-size:11px;line-height:1.35;text-align:center}.notice-line button{flex:none;padding:2px 6px;border:1px solid var(--line);border-radius:9px;background:transparent;font-size:10px}.message-list{display:flex;min-height:0;flex:1;flex-direction:column;overflow-y:auto;padding:14px 15px 24px;background:var(--bg);scrollbar-width:none}.message-row{display:flex;width:100%;align-items:flex-start;flex-direction:column;margin:7px 0}.message-row.send{align-items:flex-end}.message-row time{align-self:center;margin:0 0 7px;color:var(--sub);font-size:10px}.message-row p{max-width:min(82%,420px);margin:0;padding:9px 12px;border-radius:13px 13px 13px 4px;background:var(--surface);font-size:13px;line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap}.message-row.send p{border-radius:13px 13px 4px 13px;background:var(--text);color:var(--bg)}.message-row small{margin-top:3px;color:var(--sub);font-size:9px}.replying{display:flex;align-items:center;gap:4px;align-self:flex-start;margin-top:6px;padding:8px 11px;border-radius:13px;background:var(--surface);color:var(--sub);font-size:10px}.replying i{width:4px;height:4px;border-radius:50%;background:var(--sub);animation:pulse 1s infinite}.replying i:nth-child(2){animation-delay:.15s}.replying i:nth-child(3){animation-delay:.3s}@keyframes pulse{50%{opacity:.2}}.compose-bar{display:flex;align-items:flex-end;gap:8px;padding:9px 12px calc(9px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--bg)}.compose-bar.disabled{opacity:.65}.mini-button,.send-button{display:grid;width:34px;height:34px;flex:none;padding:7px;border:0;border-radius:50%;background:var(--surface);cursor:pointer;place-items:center}.send-button{background:var(--text);color:var(--bg)}.mini-button:disabled,.send-button:disabled{cursor:not-allowed;opacity:.35}.draft-box{display:flex;min-width:0;flex:1;flex-direction:column;overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--surface)}.draft-box textarea{width:100%;max-height:100px;min-height:34px;resize:none;border:0;outline:0;padding:8px 11px;background:transparent;color:var(--text);font-size:13px;line-height:1.35}.draft-box textarea::placeholder{color:var(--sub)}.draft-box input{width:100%;border:0;border-top:1px solid var(--line);outline:0;padding:6px 10px;background:transparent;color:var(--sub);font-size:10px}.panel-view,.settings-view{overflow-y:auto;padding:14px 16px calc(30px + env(safe-area-inset-bottom));scrollbar-width:none}.panel-card,.settings-group{margin-bottom:15px;padding:15px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}.panel-card h2,.panel-section h2,.settings-group h2{margin:0 0 5px;font-size:14px}.panel-card p,.section-note{margin:0;color:var(--sub);font-size:11px;line-height:1.5}.manual-compose{display:flex;flex-direction:column;gap:10px}.manual-compose label{display:flex;flex-direction:column;gap:5px}.manual-compose label span{color:var(--sub);font-size:11px}.manual-compose input{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:9px;outline:0;background:var(--bg);color:var(--text);font-size:13px}.primary,.secondary-wide{padding:9px 14px;border:0;border-radius:10px;background:var(--text);color:var(--bg)!important;font-size:12px;cursor:pointer}.primary:disabled{opacity:.35}.panel-section{margin-bottom:18px}.contact-row{display:grid;width:100%;grid-template-columns:34px minmax(0,1fr) auto 10px;align-items:center;gap:9px;padding:10px 0;border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;cursor:pointer}.contact-row:disabled{cursor:not-allowed;opacity:.4}.contact-row>span{display:grid;width:32px;height:32px;border-radius:50%;background:var(--surface);font-size:13px;place-items:center}.contact-row b{overflow:hidden;font-size:13px;font-weight:550;text-overflow:ellipsis;white-space:nowrap}.contact-row small{max-width:130px;overflow:hidden;color:var(--sub);font-size:10px;text-overflow:ellipsis;white-space:nowrap}.contact-row i{color:var(--sub);font-size:17px;font-style:normal}.inline-empty{padding:14px 2px;color:var(--sub);font-size:11px;line-height:1.5}.play-card{display:flex;align-items:center;justify-content:space-between;gap:12px}.play-card>div{min-width:0}.compact-button{flex:none;padding:7px 10px}.secondary-wide{width:100%;background:transparent;color:var(--text)!important;border:1px solid var(--line)}.settings-view{gap:0}.settings-group{padding:0;overflow:hidden}.settings-group>h2{padding:13px 13px 8px;color:var(--sub);font-size:11px;font-weight:550}.setting-row{position:relative;display:flex;min-height:51px;align-items:center;justify-content:space-between;gap:12px;padding:9px 13px;border-top:1px solid var(--line);cursor:pointer}.setting-row.nested{padding-left:24px}.setting-row>span:first-child{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.setting-row b{font-size:12px;font-weight:540}.setting-row small{color:var(--sub);font-size:10px;line-height:1.35}.setting-row>input[type=checkbox]{position:absolute;width:0;height:0;opacity:0}.setting-row>i{position:relative;width:35px;height:20px;flex:none;border-radius:10px;background:#c7c7cc;transition:.2s}.setting-row>i:after{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;content:'';transition:.2s}.setting-row>input:checked+i{background:var(--text)}.setting-row>input:checked+i:after{transform:translateX(15px)}.setting-row>input:disabled+i{opacity:.35}.compact-setting{min-height:43px}.time-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding:9px 13px;border-top:1px solid var(--line)}.time-row label{display:flex;align-items:center;justify-content:space-between;gap:6px;color:var(--sub);font-size:10px}.time-row input,.number-row input{min-width:0;padding:5px 6px;border:1px solid var(--line);border-radius:7px;outline:0;background:var(--bg);color:var(--text);font-size:11px}.choice-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:9px 13px;border-top:1px solid var(--line)}.choice-grid label{position:relative}.choice-grid input{position:absolute;opacity:0}.choice-grid span{display:block;padding:6px 3px;border:1px solid var(--line);border-radius:8px;color:var(--sub);font-size:10px;text-align:center}.choice-grid input:checked+span{border-color:var(--text);background:var(--text);color:var(--bg)}.number-row{display:flex;align-items:center;gap:8px;padding:9px 13px;border-top:1px solid var(--line);font-size:11px}.number-row span{flex:1}.number-row input{width:54px;text-align:center}.number-row small{color:var(--sub)}.dual-switch{display:flex!important;flex:none!important;flex-direction:row!important;gap:5px!important}.dual-switch input{width:18px;height:18px;accent-color:var(--text)}.popover,.modal-layer{position:absolute;z-index:20;inset:0;background:rgba(0,0,0,.25)}.menu-card{position:absolute;top:calc(59px + env(safe-area-inset-top));right:12px;display:flex;width:150px;overflow:hidden;flex-direction:column;border:1px solid var(--line);border-radius:12px;background:var(--bg);box-shadow:0 10px 30px rgba(0,0,0,.16)}.menu-card button{padding:10px 13px;border:0;border-bottom:1px solid var(--line);background:transparent;font-size:12px;text-align:left;cursor:pointer}.menu-card button:last-child{border:0}.danger{color:#d64545!important}.modal-layer{display:grid;place-items:center}.confirm-card{width:min(290px,calc(100% - 36px));padding:17px;border-radius:15px;background:var(--bg);box-shadow:0 14px 40px rgba(0,0,0,.24)}.confirm-card h2{margin:0 0 8px;font-size:15px}.confirm-card p{margin:0;color:var(--sub);font-size:11px;line-height:1.55}.confirm-card>div{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.confirm-card button{padding:7px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;font-size:11px;cursor:pointer}.toast{position:absolute;z-index:40;right:18px;bottom:calc(20px + env(safe-area-inset-bottom));left:18px;padding:9px 13px;border-radius:10px;background:rgba(25,25,27,.9);color:#fff;font-size:11px;text-align:center;box-shadow:0 5px 20px rgba(0,0,0,.2)}.toast-enter-active,.toast-leave-active{transition:.18s}.toast-enter-from,.toast-leave-to{opacity:0;transform:translateY(5px)}
@media(max-width:340px){.app-header{padding-right:9px;padding-left:9px}.header-actions .nav-icon{width:32px;padding:6px}.search-row,.filter-row{margin-right:11px;margin-left:11px}.filter-row{padding-right:0;padding-left:0}.thread-row{padding-right:11px;padding-left:11px}.contact-row small{max-width:92px}.choice-grid{grid-template-columns:1fr 1fr}.panel-view,.settings-view{padding-right:11px;padding-left:11px}}
@media(min-width:600px){.panel-view,.settings-view{width:100%;max-width:620px;align-self:center}.thread-list,.list-view>.search-row,.list-view>.filter-row{width:100%;max-width:680px;align-self:center}}
</style>
