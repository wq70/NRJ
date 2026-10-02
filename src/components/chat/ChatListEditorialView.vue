<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useChatAuth } from '../../composables/useChatAuth'
import { globalSettings } from '../../store'

const props = defineProps<{
  chats: any[]
  customGroups: string[]
  activeGroup: string
  isMultiSelectMode: boolean
  selectedChatIds: Set<string | number>
}>()

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'account-switch'): void
  (event: 'open-create-contact'): void
  (event: 'open-create-group'): void
  (event: 'open-chat', chat: any): void
  (event: 'start-long-press', pointer: MouseEvent | TouchEvent, chat: any): void
  (event: 'clear-long-press', pointer?: MouseEvent | TouchEvent): void
  (event: 'select-group', group: string): void
  (event: 'group-menu', group: string): void
  (event: 'add-group'): void
  (event: 'manage-groups'): void
  (event: 'exit-multi-select'): void
  (event: 'toggle-select', id: string | number): void
  (event: 'select-all', chats: any[]): void
  (event: 'assign-groups'): void
  (event: 'delete-selected'): void
}>()

type Category = 'all' | 'group' | 'unread'
type Quote = { text: string; source: string; day: string; yearMonth: string }

const { currentChatUserId, currentAccount } = useChatAuth()
const searchText = ref('')
const category = ref<Category>('all')
const createMenuVisible = ref(false)
const groupMenuVisible = ref(false)
const quoteEditorVisible = ref(false)
const showRealName = ref(false)
const toast = ref('')
const clock = ref(new Date())
let clockTimer: number | null = null
let toastTimer: number | null = null
let groupHoldTimer: number | null = null
let groupHoldTriggered = false

const defaultQuote = (): Quote => {
  const today = new Date()
  return {
    text: '我什么也不是。我永远也不会成为什么。除此之外，我拥有世上所有的梦。',
    source: '- 费尔南多·佩索阿《烟草店》',
    day: String(today.getDate()).padStart(2, '0'),
    yearMonth: `/ ${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}`
  }
}

const quote = ref<Quote>(defaultQuote())
const quoteDraft = ref<Quote>(defaultQuote())
const quoteKey = (accountId: string) => `clingy_pinned_quote_${accountId}`
const nameModeKey = (accountId: string) => `clingy_chat_list_name_mode_${accountId}`

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = '' }, 1800)
}

const readQuote = (accountId: string): Quote => {
  let saved = localStorage.getItem(quoteKey(accountId))
  const legacy = localStorage.getItem('clingy_pinned_quote')
  if (!saved && legacy && !localStorage.getItem('clingy_pinned_quote_migrated_to')) {
    saved = legacy
    localStorage.setItem(quoteKey(accountId), legacy)
    localStorage.setItem('clingy_pinned_quote_migrated_to', accountId)
  }
  if (!saved) return defaultQuote()
  try {
    const parsed = JSON.parse(saved) as Partial<Quote>
    const fallback = defaultQuote()
    return {
      text: typeof parsed.text === 'string' && parsed.text.trim() ? parsed.text : fallback.text,
      source: typeof parsed.source === 'string' ? parsed.source : fallback.source,
      day: typeof parsed.day === 'string' && parsed.day.trim() ? parsed.day : fallback.day,
      yearMonth: typeof parsed.yearMonth === 'string' && parsed.yearMonth.trim() ? parsed.yearMonth : fallback.yearMonth
    }
  } catch {
    return defaultQuote()
  }
}

watch(currentChatUserId, accountId => {
  searchText.value = ''
  category.value = 'all'
  createMenuVisible.value = false
  groupMenuVisible.value = false
  quoteEditorVisible.value = false
  quote.value = accountId ? readQuote(accountId) : defaultQuote()
  showRealName.value = accountId ? localStorage.getItem(nameModeKey(accountId)) === 'real' : false
}, { immediate: true })

const displayName = computed(() => showRealName.value && currentAccount.value?.realName?.trim()
  ? currentAccount.value.realName.trim()
  : currentAccount.value?.name || '未命名用户')

const toggleDisplayName = () => {
  if (!currentChatUserId.value) return
  if (!currentAccount.value?.realName?.trim()) {
    notify('当前账号还没有填写真名')
    return
  }
  showRealName.value = !showRealName.value
  localStorage.setItem(nameModeKey(currentChatUserId.value), showRealName.value ? 'real' : 'network')
  notify(showRealName.value ? '已显示真名' : '已显示网名')
}

const openQuoteEditor = () => {
  quoteDraft.value = { ...quote.value }
  quoteEditorVisible.value = true
}

const saveQuote = () => {
  if (!quoteDraft.value.text.trim()) return notify('文案内容不能为空')
  if (!currentChatUserId.value) return
  const source = quoteDraft.value.source.trim()
  quote.value = {
    text: quoteDraft.value.text.trim(),
    source: source && !source.startsWith('-') ? `- ${source}` : source,
    day: quoteDraft.value.day.trim() || defaultQuote().day,
    yearMonth: quoteDraft.value.yearMonth.trim()
      ? (quoteDraft.value.yearMonth.trim().startsWith('/') ? quoteDraft.value.yearMonth.trim() : `/ ${quoteDraft.value.yearMonth.trim()}`)
      : defaultQuote().yearMonth
  }
  localStorage.setItem(quoteKey(currentChatUserId.value), JSON.stringify(quote.value))
  quoteEditorVisible.value = false
  notify('文案已更新')
}

const resetQuote = () => {
  if (!currentChatUserId.value) return
  localStorage.removeItem(quoteKey(currentChatUserId.value))
  quote.value = defaultQuote()
  quoteDraft.value = { ...quote.value }
  quoteEditorVisible.value = false
  notify('已恢复默认文案')
}

const categories: { id: Category; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'group', label: '群聊' },
  { id: 'unread', label: '未读' }
]

const visibleChats = computed(() => {
  let chats = props.chats
  if (category.value === 'group') chats = chats.filter(chat => chat.chatType === 'group')
  if (category.value === 'unread') chats = chats.filter(chat => chat.unread > 0)
  const query = searchText.value.trim().toLocaleLowerCase()
  if (query) chats = chats.filter(chat => [chat.name, chat.realName, chat.remark, chat.preview].some(value => String(value || '').toLocaleLowerCase().includes(query)))
  return chats
})

const pinnedChats = computed(() => !props.isMultiSelectMode && category.value === 'all' ? visibleChats.value.filter(chat => chat.isPinned) : [])
const regularChats = computed(() => pinnedChats.value.length ? visibleChats.value.filter(chat => !chat.isPinned) : visibleChats.value)
const searchClock = computed(() => clock.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }))
const wallpaperStyle = computed(() => globalSettings.chatListWallpaper !== 'default'
  ? { backgroundImage: `url(${globalSettings.chatListWallpaper})` }
  : undefined)

const beginGroupHold = (group: string) => {
  groupHoldTriggered = false
  if (groupHoldTimer) window.clearTimeout(groupHoldTimer)
  groupHoldTimer = window.setTimeout(() => {
    groupHoldTriggered = true
    groupMenuVisible.value = false
    emit('group-menu', group)
  }, 600)
}

const cancelGroupHold = () => {
  if (groupHoldTimer) window.clearTimeout(groupHoldTimer)
  groupHoldTimer = null
}

const selectGroup = (group: string) => {
  cancelGroupHold()
  if (groupHoldTriggered) { groupHoldTriggered = false; return }
  emit('select-group', group)
  groupMenuVisible.value = false
}

onMounted(() => { clockTimer = window.setInterval(() => { clock.value = new Date() }, 60_000) })
onUnmounted(() => {
  if (clockTimer) window.clearInterval(clockTimer)
  if (toastTimer) window.clearTimeout(toastTimer)
  cancelGroupHold()
})
</script>

<template>
  <div class="editorial-chat" :class="{ 'is-dark': globalSettings.darkMode, 'has-wallpaper': globalSettings.chatListWallpaper !== 'default' }" :style="wallpaperStyle">
    <div v-if="toast" class="editorial-toast" role="status">{{ toast }}</div>

    <header v-if="isMultiSelectMode" class="editorial-topbar editorial-selection-header">
      <button type="button" @click="emit('exit-multi-select')">取消</button>
      <strong>已选 {{ selectedChatIds.size }} 项</strong>
      <button type="button" @click="emit('select-all', visibleChats)">全选</button>
    </header>
    <main class="editorial-scroll">
      <template v-if="!isMultiSelectMode">
        <section class="editorial-hero" aria-label="当前账号">
          <div class="editorial-account-row">
            <button class="editorial-account-avatar" type="button" aria-label="返回桌面" title="返回桌面" :style="currentAccount?.avatarUrl ? { backgroundImage: `url(${currentAccount.avatarUrl})` } : {}" @click="emit('close')">{{ currentAccount?.avatarUrl ? '' : (currentAccount?.name?.charAt(0) || '我') }}</button>
            <div class="editorial-account-copy">
              <button class="editorial-account-name" type="button" title="点击切换网名或真名" @click="toggleDisplayName">{{ displayName }}</button>
              <button class="editorial-account-switch" type="button" aria-label="切换账号" @click="emit('account-switch')">Options <svg viewBox="0 0 12 12"><path d="m4 2 4 4-4 4" /></svg></button>
            </div>
            <button class="editorial-hero-new" type="button" aria-label="新建" title="新建" @click="createMenuVisible = true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14" /></svg></button>
          </div>
          <button class="editorial-quote" type="button" aria-label="编辑置顶文案" @click="openQuoteEditor">
            <svg class="editorial-quote-edit" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" /></svg>
            <span class="editorial-quote-date"><strong>{{ quote.day }}</strong><small>{{ quote.yearMonth }}</small></span>
            <span class="editorial-quote-text">{{ quote.text }}</span>
            <span v-if="quote.source" class="editorial-quote-source">{{ quote.source }}</span>
          </button>
        </section>

        <section v-if="pinnedChats.length" class="editorial-pinned" aria-label="置顶联系人">
          <h2>置顶联系人</h2>
          <div class="editorial-pinned-row">
            <button v-for="chat in pinnedChats" :key="chat.id" class="editorial-pin" type="button"
              @mousedown="emit('start-long-press', $event, chat)" @touchstart="emit('start-long-press', $event, chat)"
              @mouseup="emit('clear-long-press')" @touchend="emit('clear-long-press')" @mouseleave="emit('clear-long-press')" @touchmove="emit('clear-long-press', $event)"
              @click="emit('open-chat', chat)">
              <span class="editorial-pin-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}">{{ chat.avatarUrl ? '' : (chat.avatarText || '群') }}<i v-if="chat.unread > 0"></i></span>
              <span class="editorial-pin-name">{{ chat.name }}</span>
            </button>
          </div>
        </section>
      </template>

      <div class="editorial-search">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9.5" cy="9.5" r="6.8" stroke="#1e2229" stroke-width="1.8" fill="#f8fafc" /><path d="M6.2 8.5C6.4 6.8 7.6 5.5 9.3 5.3" stroke="#fff" stroke-width="1.2" stroke-linecap="round" /><path d="M14.4 14.4 15.9 15.9" stroke="#64748b" stroke-width="3" stroke-linecap="round" /><path d="M16 16 20.8 20.8" stroke="#0f172a" stroke-width="3.2" stroke-linecap="round" /><path d="M15.8 15.8 19.8 19.8" stroke="#94a3b8" stroke-width="1" stroke-linecap="round" /></svg>
        <input v-model="searchText" type="search" placeholder="Search memories..." aria-label="搜索会话" />
        <button v-if="searchText" type="button" aria-label="清空搜索" @click="searchText = ''">×</button>
        <span v-else>{{ searchClock }}</span>
      </div>

      <div class="editorial-filter-row">
        <div class="editorial-filter-scroll" role="tablist" aria-label="会话分类">
          <button v-for="item in categories" :key="item.id" type="button" role="tab" :aria-selected="category === item.id" :class="{ active: category === item.id }" @click="category = item.id">{{ item.label }}</button>
        </div>
      </div>

      <div v-if="customGroups.length" class="editorial-group-row">
        <button type="button" @click="groupMenuVisible = true">分组 · {{ activeGroup }} <span>⌄</span></button>
        <span v-if="category !== 'all' || searchText.trim()">{{ visibleChats.length }} 个会话</span>
      </div>

      <section class="editorial-message-list" aria-label="会话列表">
        <div v-if="visibleChats.length === 0" class="editorial-empty">{{ searchText.trim() ? '没有匹配的会话' : '暂无会话' }}</div>
        <div v-for="chat in regularChats" :key="chat.id" class="editorial-message-wrap">
          <button v-if="isMultiSelectMode" class="editorial-checkbox" type="button" :aria-label="`选择${chat.name}`" :aria-pressed="selectedChatIds.has(chat.id)" @click="emit('toggle-select', chat.id)"><span :class="{ checked: selectedChatIds.has(chat.id) }">{{ selectedChatIds.has(chat.id) ? '✓' : '' }}</span></button>
          <button class="editorial-message" type="button"
            @mousedown="emit('start-long-press', $event, chat)" @touchstart="emit('start-long-press', $event, chat)"
            @mouseup="emit('clear-long-press')" @touchend="emit('clear-long-press')" @mouseleave="emit('clear-long-press')" @touchmove="emit('clear-long-press', $event)"
            @click="emit('open-chat', chat)">
            <span class="editorial-message-avatar" :style="chat.avatarUrl ? { backgroundImage: `url(${chat.avatarUrl})` } : {}">{{ chat.avatarUrl ? '' : (chat.avatarText || '群') }}<i v-if="chat.unread > 0" class="editorial-unread">{{ chat.unread > 99 ? '99+' : chat.unread }}</i></span>
            <span class="editorial-message-copy"><span class="editorial-message-top"><strong>{{ chat.name }}</strong><time>{{ chat.time }}</time></span><span class="editorial-message-bottom"><span>{{ chat.preview }}</span><em v-if="chat.isTyping">输入中</em></span></span>
          </button>
        </div>
      </section>
    </main>

    <div v-if="isMultiSelectMode" class="editorial-batchbar"><button type="button" :disabled="selectedChatIds.size === 0" @click="emit('assign-groups')">移动分组</button><button type="button" :disabled="selectedChatIds.size === 0" @click="emit('delete-selected')">删除 ({{ selectedChatIds.size }})</button></div>

    <Teleport to="body">
      <div v-if="createMenuVisible" class="editorial-modal-overlay" :class="{ 'is-dark': globalSettings.darkMode }" @click.self="createMenuVisible = false">
        <section class="editorial-action-sheet" role="dialog" aria-modal="true" aria-label="新建">
          <header class="editorial-sheet-header"><div><small>NEW</small><strong>新建</strong></div><button type="button" aria-label="关闭" @click="createMenuVisible = false">×</button></header>
          <div class="editorial-sheet-options">
            <button type="button" @click="createMenuVisible = false; emit('open-create-contact')"><span class="editorial-sheet-icon">01</span><span><strong>新建或导入角色</strong><small>创建联系人或导入角色资料</small></span><span class="editorial-sheet-chevron">›</span></button>
            <button type="button" @click="createMenuVisible = false; emit('open-create-group')"><span class="editorial-sheet-icon">02</span><span><strong>创建群聊</strong><small>邀请联系人开始群聊</small></span><span class="editorial-sheet-chevron">›</span></button>
          </div>
        </section>
      </div>
      <div v-if="groupMenuVisible" class="editorial-modal-overlay" :class="{ 'is-dark': globalSettings.darkMode }" @click.self="groupMenuVisible = false">
        <section class="editorial-action-sheet editorial-group-sheet" role="dialog" aria-modal="true" aria-label="选择分组">
          <header class="editorial-sheet-header"><div><small>GROUPS</small><strong>选择分组</strong></div><button type="button" aria-label="关闭" @click="groupMenuVisible = false">×</button></header>
          <div class="editorial-group-options">
            <div v-for="group in ['全部', ...customGroups]" :key="group" class="editorial-group-option"><button type="button" :class="{ active: activeGroup === group }" @mousedown="group !== '全部' && beginGroupHold(group)" @mouseup="cancelGroupHold" @mouseleave="cancelGroupHold" @touchstart="group !== '全部' && beginGroupHold(group)" @touchend="cancelGroupHold" @touchmove="cancelGroupHold" @click="selectGroup(group)">{{ group }}<span v-if="activeGroup === group">✓</span></button><button v-if="group !== '全部'" class="editorial-group-more" type="button" :aria-label="`管理${group}`" @click="groupMenuVisible = false; emit('group-menu', group)">···</button></div>
          </div>
          <div class="editorial-sheet-tools"><button type="button" @click="groupMenuVisible = false; emit('add-group')">＋ 新建分组</button><button type="button" @click="groupMenuVisible = false; emit('manage-groups')">管理分组</button></div>
        </section>
      </div>
      <div v-if="quoteEditorVisible" class="editorial-modal-overlay" :class="{ 'is-dark': globalSettings.darkMode }" @click.self="quoteEditorVisible = false"><section class="editorial-quote-dialog" role="dialog" aria-modal="true" aria-label="编辑置顶文案"><header><strong>编辑置顶文案</strong><button type="button" aria-label="关闭" @click="quoteEditorVisible = false">×</button></header><label>文案内容<textarea v-model="quoteDraft.text" maxlength="500" placeholder="写下想留在这里的话"></textarea></label><label>出处与作者<input v-model="quoteDraft.source" maxlength="100" placeholder="出处与作者" /></label><div class="editorial-quote-fields"><label>日份<input v-model="quoteDraft.day" maxlength="4" placeholder="25" /></label><label>年月<input v-model="quoteDraft.yearMonth" maxlength="20" placeholder="/ 2026.09" /></label></div><footer><button type="button" @click="resetQuote">恢复默认</button><button type="button" @click="quoteEditorVisible = false">取消</button><button type="button" @click="saveQuote">保存</button></footer></section></div>
    </Teleport>
  </div>
</template>

<style scoped src="./ChatListEditorialView.css"></style>
