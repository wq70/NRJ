<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  selectedChat: any
  totalUnreadCount: number
  currentDateStr: string
  currentDayStr: string
  appearanceStyle?: string
  compactCallRecords?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'open-settings'): void
  (e: 'show-inner-thought-modal'): void
  (e: 'show-memory-modal'): void
  (e: 'open-call-records'): void
  (e: 'open-offline-meet'): void
  (e: 'click-overlay'): void
  (e: 'open-timelines'): void
  (e: 'show-voice-call'): void
  (e: 'show-video-call'): void
}>()

const showCompactActions = ref(false)
const compactHeaderRef = ref<HTMLElement | null>(null)
const isSoftPink = computed(() => props.appearanceStyle === 'softPink')

const runCompactAction = (event: 'show-voice-call' | 'show-video-call' | 'show-inner-thought-modal' | 'show-memory-modal' | 'open-call-records' | 'open-offline-meet' | 'open-timelines') => {
  showCompactActions.value = false
  if (event === 'show-voice-call') emit('show-voice-call')
  else if (event === 'show-video-call') emit('show-video-call')
  else if (event === 'show-inner-thought-modal') emit('show-inner-thought-modal')
  else if (event === 'show-memory-modal') emit('show-memory-modal')
  else if (event === 'open-call-records') emit('open-call-records')
  else if (event === 'open-offline-meet') emit('open-offline-meet')
  else emit('open-timelines')
}

const closeHeaderOverlays = () => {
  showCompactActions.value = false
  emit('click-overlay')
}

const activeTimelineName = computed(() => props.selectedChat?.timelineState?.timelines?.find(
  (item: any) => item.id === props.selectedChat?.timelineState?.activeTimelineId
)?.name || '主时间线')

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  timer = setInterval(() => {
    now.value = Date.now()
  }, 1000)
  document.addEventListener('pointerdown', handleOutsidePointer)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('pointerdown', handleOutsidePointer)
})

function handleOutsidePointer(event: PointerEvent) {
  if (!showCompactActions.value || compactHeaderRef.value?.contains(event.target as Node)) return
  showCompactActions.value = false
}

const getStatusText = () => {
  if (!props.selectedChat?.enableImmersiveStatus) return ''

  const offlineUntil = props.selectedChat?.offlineUntil || 0
  const isOffline = offlineUntil > now.value
  const baseStatus = props.selectedChat?.statusText || ''

  if (isOffline) {
    const diff = offlineUntil - now.value
    const m = Math.floor(diff / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    const timeStr = m > 0 ? `约 ${m} 分 ${s} 秒后恢复` : `还有 ${s} 秒回归`
    return baseStatus ? `${baseStatus}（离线中，${timeStr}）` : `离线中，${timeStr}`
  }

  return baseStatus || '在线'
}

const showStatusRow = () => {
  return !!props.selectedChat?.enableImmersiveStatus
}
</script>

<template>
  <header v-if="isSoftPink" ref="compactHeaderRef" class="chat-compact-header" @click="closeHeaderOverlays">
    <button class="compact-header-button compact-back-button" type="button" aria-label="返回" @click.stop="emit('back')">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
      <span v-if="totalUnreadCount > 0" class="compact-unread-badge">{{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}</span>
    </button>
    <div class="compact-header-title">
      <strong>{{ selectedChat?.name || '消息' }}</strong>
      <small v-if="showStatusRow()">{{ getStatusText() }}</small>
    </div>
    <div class="compact-header-actions">
      <button class="compact-header-button" type="button" aria-label="通话与更多功能" :aria-expanded="showCompactActions" @click.stop="showCompactActions = !showCompactActions">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/></svg>
      </button>
      <button class="compact-header-button compact-settings-button" type="button" aria-label="聊天设置" @click.stop="emit('open-settings')">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
      </button>
      <Transition name="compact-menu">
        <div v-if="showCompactActions" class="compact-call-menu" role="menu" @click.stop>
          <button type="button" role="menuitem" @click="runCompactAction('show-voice-call')"><span>语音通话</span><svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg></button>
          <button type="button" role="menuitem" @click="runCompactAction('show-video-call')"><span>视频通话</span><svg viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3Z"/></svg></button>
          <i></i>
          <button type="button" role="menuitem" @click="runCompactAction('show-inner-thought-modal')"><span>查看内心</span><b>心声</b></button>
          <button type="button" role="menuitem" @click="runCompactAction('show-memory-modal')"><span>记忆</span><b>记录</b></button>
          <button v-if="compactCallRecords" type="button" role="menuitem" @click="runCompactAction('open-call-records')"><span>通话记录</span><b>历史</b></button>
          <button v-if="selectedChat?.offlineMeetEnabled" type="button" role="menuitem" @click="runCompactAction('open-offline-meet')"><span>线下见面</span><b>见面</b></button>
          <button v-if="(selectedChat?.timelineState?.timelines?.length || 0) > 1" type="button" role="menuitem" @click="runCompactAction('open-timelines')"><span>时间线</span><b>{{ activeTimelineName }}</b></button>
        </div>
      </Transition>
    </div>
  </header>

  <header v-else class="chat-advanced-header glass-header" @click="emit('click-overlay')">
    <div class="chat-header-main">
      <div class="chat-header-top-row">
        <div class="chat-header-profile">
          <div v-if="totalUnreadCount > 0" class="back-btn-wrapper" @click="emit('back')">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" class="back-arrow"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <div class="back-unread-badge">{{ totalUnreadCount > 99 ? '99+' : totalUnreadCount }}</div>
          </div>
          <div class="chat-header-avatar" @click="emit('back')">
            <img v-if="selectedChat?.avatarUrl" :src="selectedChat.avatarUrl" class="chat-header-avatar-img" alt="头像" />
            <span v-else>{{ selectedChat?.avatarText || '伴' }}</span>
          </div>
          <div style="display: flex; flex-direction: column; justify-content: center;" @click="emit('open-call-records')" class="clickable-header-name">
            <div class="chat-header-name">{{ selectedChat?.name || '消息' }}</div>
            <div
              v-if="showStatusRow()"
              style="font-size: 11px; color: var(--text-tertiary); display: flex; align-items: center; gap: 4px; margin-top: 2px; font-weight: normal;"
            >
              {{ getStatusText() }}
            </div>
            <div v-if="(selectedChat?.timelineState?.timelines?.length || 0) > 1" class="header-timeline-chip" @click.stop="emit('open-timelines')">{{ activeTimelineName }}⌄</div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-right: 4px;">
          <div
            v-if="selectedChat?.offlineMeetEnabled && selectedChat?.offlineMeetMode === 'separate'"
            class="icon-btn offline-meet-entry"
            title="进入线下见面"
            @click="emit('open-offline-meet')"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div class="icon-btn" @click="emit('show-inner-thought-modal')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
              <polyline points="22,6 12,13 2,6"></polyline>
            </svg>
          </div>
          <div class="icon-btn" @click="emit('show-memory-modal')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: #999999;">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <div class="icon-btn" @click="emit('open-settings')">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="none" fill="#999999"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </div>
        </div>
      </div>

      <div class="chat-time-capsule">
        <div class="capsule-content">
          <span class="capsule-date">{{ currentDateStr }}</span>
          <span class="capsule-day">{{ currentDayStr }}</span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
@import '../ChatRoomView.css';

.clickable-header-name {
  cursor: pointer;
  transition: opacity 0.2s;
}
.clickable-header-name:active {
  opacity: 0.7;
}
.header-timeline-chip{align-self:flex-start;margin-top:3px;padding:2px 7px;border-radius:8px;background:rgba(143,124,255,.1);color:#7561dc;font-size:9px;line-height:1.4;cursor:pointer;max-width:130px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat-compact-header{position:relative;z-index:120;display:grid;grid-template-columns:92px minmax(0,1fr) 92px;align-items:center;min-height:64px;padding:calc(env(safe-area-inset-top,0px) + 4px) 8px 4px;border-bottom:1px solid var(--soft-pink-line,#eee9eb);background:var(--soft-pink-surface,rgba(255,255,255,.94));color:var(--soft-pink-text,#171518);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px)}
.compact-header-title{display:flex;min-width:0;align-items:center;flex-direction:column;justify-content:center;text-align:center}.compact-header-title strong{overflow:hidden;max-width:100%;font-size:16px;font-weight:650;letter-spacing:.02em;text-overflow:ellipsis;white-space:nowrap}.compact-header-title small{overflow:hidden;max-width:100%;margin-top:2px;color:var(--soft-pink-muted,#999296);font-size:9px;font-weight:400;text-overflow:ellipsis;white-space:nowrap}.compact-header-actions{position:relative;display:flex;justify-content:flex-end}.compact-header-button{position:relative;display:grid;width:42px;height:42px;padding:0;border:0;border-radius:50%;background:transparent;color:inherit;place-items:center}.compact-header-button:active{background:var(--soft-pink-pressed,rgba(91,70,79,.07))}.compact-header-button svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.compact-settings-button svg{width:24px;fill:currentColor;stroke:none}.compact-back-button{justify-self:start}.compact-back-button svg{width:27px;height:27px;stroke-width:1.7}.compact-unread-badge{position:absolute;top:1px;right:-1px;display:grid;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#e85c65;color:#fff;font-size:9px;place-items:center}.compact-call-menu{position:absolute;top:47px;right:2px;display:flex;width:168px;overflow:hidden;flex-direction:column;padding:6px;border:1px solid var(--soft-pink-line,#eee6e9);border-radius:14px;background:var(--soft-pink-menu,rgba(255,255,255,.98));box-shadow:0 12px 34px rgba(43,31,36,.14);z-index:20}.compact-call-menu button{display:flex;min-height:38px;align-items:center;justify-content:space-between;padding:0 10px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left}.compact-call-menu button:active{background:var(--soft-pink-pressed,rgba(91,70,79,.07))}.compact-call-menu button span{font-size:13px}.compact-call-menu button b{overflow:hidden;max-width:74px;color:var(--soft-pink-muted,#999296);font-size:9px;font-weight:450;text-overflow:ellipsis;white-space:nowrap}.compact-call-menu button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.compact-call-menu>i{height:1px;margin:4px 8px;background:var(--soft-pink-line,#eee6e9)}.compact-menu-enter-active,.compact-menu-leave-active{transition:opacity .15s ease,transform .15s ease}.compact-menu-enter-from,.compact-menu-leave-to{opacity:0;transform:translateY(-4px) scale(.98)}
@media (max-width:360px){.chat-compact-header{grid-template-columns:84px minmax(0,1fr) 84px;padding-left:4px;padding-right:4px}.compact-header-button{width:39px;height:39px}}
</style>
