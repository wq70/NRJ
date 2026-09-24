/* WARNING: 本项目专属"粘人精"，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useChatState } from '../../composables/useChatState'
import { useChatRoomAPI } from '../../composables/useChatRoomAPI'
import { useChatAuth } from '../../composables/useChatAuth'
import { hasPendingReplyReplacement } from '../../services/replyVariants'
import ChatMessageEditModal from './modals/ChatMessageEditModal.vue'

const props = defineProps<{ groupMode?: boolean; group?: any; externalIsGenerating?: boolean }>()
const emit = defineEmits<{
  (e: 'back'): void
  (e: 'send', text: string): void
  (e: 'trigger-api'): void
  (e: 'stop-generate'): void
  (e: 'regenerate'): void
}>()

const { selectedChat, effectiveMyProfile: myProfile, mockChats, buildChatMessages, showNotification } = useChatState()
const activeChat = computed(() => props.group || selectedChat.value)

const isRoomActive = ref(true)
const inputMessage = ref('')
const messageAreaRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 提示 Toast
const toastText = ref('')
const toastVisible = ref(false)
let toastTimer: any = null

function showToast(msg: string) {
  toastText.value = msg
  toastVisible.value = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastVisible.value = false
  }, 1800)
}

const displayMessages = computed(() => {
  if (!activeChat.value?.messages) return []
  return activeChat.value.messages.filter((m: any) =>
    m.isOfflineMeetMsg && (m.type === 'left' || m.type === 'right' || m.type === 'system' || m.type === 'narration')
  )
})

function updatePreviewAndTime(content: string) {
  if (!selectedChat.value) return
  selectedChat.value.preview = content
  const now = new Date()
  selectedChat.value.time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function saveCustomContacts(targetChat: any = selectedChat.value) {
  if (!targetChat || targetChat.id === 1) return
  if (hasPendingReplyReplacement(targetChat)) return
  const { currentChatUserId } = useChatAuth()
  const contactsKey = currentChatUserId.value ? `clingy_custom_contacts_${currentChatUserId.value}` : 'clingy_custom_contacts'
  const savedStr = localStorage.getItem(contactsKey)
  if (savedStr) {
    const contacts = JSON.parse(savedStr)
    const index = contacts.findIndex((c: any) => c.id === targetChat.id)
    if (index !== -1) {
      contacts[index].messages = targetChat.messages
      contacts[index].preview = targetChat.preview
      contacts[index].time = targetChat.time
      localStorage.setItem(contactsKey, JSON.stringify(contacts))
    }
  }
}

async function scrollToBottom() {
  await nextTick()
  if (messageAreaRef.value) {
    messageAreaRef.value.scrollTop = messageAreaRef.value.scrollHeight
  }
}

const getOfflineMeetMode = () => 'separate' as const

const {
  isGenerating,
  triggerAPI,
  handleStopCall,
  handleRegenerate
} = useChatRoomAPI(
  mockChats,
  selectedChat,
  myProfile,
  buildChatMessages,
  showNotification,
  saveCustomContacts,
  scrollToBottom,
  isRoomActive,
  undefined,
  getOfflineMeetMode
)

const showExtensionPanel = ref(false)
const displayedGenerating = computed(() => props.groupMode ? Boolean(props.externalIsGenerating) : isGenerating.value)

const handleRegenerateClick = () => {
  if (props.groupMode) return emit('regenerate')
  handleRegenerate(showExtensionPanel, showToast)
}

const handleStop = () => props.groupMode ? emit('stop-generate') : handleStopCall()
const handleTrigger = () => props.groupMode ? emit('trigger-api') : triggerAPI()

const handleSend = async () => {
  const text = inputMessage.value.trim()
  if (!text || !activeChat.value || displayedGenerating.value) return

  if (props.groupMode) {
    emit('send', text)
    inputMessage.value = ''
    resetTextareaHeight()
    await scrollToBottom()
    return
  }

  if (!selectedChat.value.messages) {
    selectedChat.value.messages = []
  }

  const now = Date.now()
  selectedChat.value.messages.push({
    id: now,
    type: 'right',
    content: text,
    isOfflineMeetMsg: true,
    timestamp: now
  })

  inputMessage.value = ''
  resetTextareaHeight()
  updatePreviewAndTime(text)
  saveCustomContacts()
  await scrollToBottom()
  await triggerAPI()
}

function resetTextareaHeight() {
  if (textareaRef.value) {
    textareaRef.value.style.height = '36px'
  }
}

function handleInput() {
  if (!textareaRef.value) return
  textareaRef.value.style.height = 'auto'
  textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 120) + 'px'
}

// 格式化时间
function formatMsgTime(timestamp?: number) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 连续发言判断（弱化重复头像）
function isContinuation(idx: number): boolean {
  if (idx === 0) return false
  const prev = displayMessages.value[idx - 1]
  const curr = displayMessages.value[idx]
  if (!prev || !curr) return false
  return prev.type === curr.type && (curr.type === 'left' || curr.type === 'right')
}

// 文本段落解析（支持 *动作/心理* 样式）
interface ParsedParagraph {
  text: string
  isAction: boolean
}

function parseParagraphs(content: string): ParsedParagraph[] {
  if (!content) return []
  const rawParagraphs = content.split('\n').filter(p => p.trim().length > 0)
  return rawParagraphs.map(p => {
    const trimmed = p.trim()
    const isAction = (trimmed.startsWith('*') && trimmed.endsWith('*')) || (trimmed.startsWith('（') && trimmed.endsWith('）')) || (trimmed.startsWith('(') && trimmed.endsWith(')'))
    return {
      text: trimmed,
      isAction
    }
  })
}

// 复制消息
async function handleCopy(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    showToast('已复制内容')
  } catch {
    showToast('复制失败')
  }
}

// 删除消息
function handleDelete(msgId: number) {
  if (!selectedChat.value?.messages) return
  const idx = selectedChat.value.messages.findIndex((m: any) => m.id === msgId)
  if (idx !== -1) {
    selectedChat.value.messages.splice(idx, 1)
    saveCustomContacts()
    showToast('已删除消息')
  }
}

// 编辑消息
const showEditModal = ref(false)
const editTargetId = ref<number | undefined>(undefined)
const editInitialContent = ref('')
const editInitialType = ref('left')

function handleOpenEdit(msg: any) {
  editTargetId.value = msg.id
  editInitialContent.value = msg.content || ''
  editInitialType.value = msg.type || 'left'
  showEditModal.value = true
}

function handleSaveEdit(payload: { messageId?: number; content: string; type: string; action: 'replace' | 'insert_above' | 'insert_below' }) {
  if (!payload.messageId || !selectedChat.value?.messages) return
  const index = selectedChat.value.messages.findIndex((m: any) => m.id === payload.messageId)
  if (index === -1) return

  if (payload.action === 'replace') {
    selectedChat.value.messages[index].content = payload.content
    selectedChat.value.messages[index].type = payload.type
    saveCustomContacts()
    showToast('消息已修改')
  } else {
    const isAbove = payload.action === 'insert_above'
    const insertIndex = isAbove ? index : index + 1
    const targetMsg = selectedChat.value.messages[index]
    const newTimestamp = targetMsg.timestamp ? targetMsg.timestamp + (isAbove ? -1 : 1) : Date.now()
    const newMessage = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      timestamp: newTimestamp,
      type: payload.type,
      content: payload.content,
      isOfflineMeetMsg: true
    }
    selectedChat.value.messages.splice(insertIndex, 0, newMessage)
    selectedChat.value.messages.sort((a: any, b: any) => (a.timestamp || a.id) - (b.timestamp || b.id))
    saveCustomContacts()
    showToast('已插入消息')
  }
  showEditModal.value = false
}

onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="offline-wrapper" v-if="activeChat">
    <!-- 顶部纯白标题栏 -->
    <header class="offline-topbar">
      <button class="back-action-btn" @click="emit('back')" title="结束见面">
        <span class="back-chevron">‹</span>
        <span class="back-label">结束见面</span>
      </button>
      <div class="room-title-info">
        <div class="room-name">{{ activeChat.name || '角色' }}</div>
        <div class="room-sub">线下互动录 · 面对面互动</div>
      </div>
      <div class="topbar-actions">
        <button
          v-if="displayedGenerating"
          class="topbar-btn stop-btn"
          @click="handleStop"
          title="停止生成"
        >
          ■
        </button>
        <button
          v-else
          class="topbar-btn regen-btn"
          @click="handleRegenerateClick"
          title="重新生成"
        >
          ↻
        </button>
      </div>
    </header>

    <!-- 滚动消息内容区 -->
    <main class="offline-chat-area" ref="messageAreaRef">
      <div class="offline-scene-header">
        <div class="scene-badge">「 你们正处于线下面对面的真实接触中 」</div>
        <div class="scene-desc">地点保持模糊，由你或角色共同决定氛围与节奏</div>
      </div>

      <div v-if="displayMessages.length === 0" class="offline-empty-notice">
        暂无记录。在下方输入动作或说话，开启你们的面对面故事。
      </div>

      <div class="offline-dialog-stream">
        <template v-for="(msg, idx) in displayMessages" :key="msg.id">
          <!-- 旁白 / 系统条目 -->
          <section v-if="msg.type === 'system' || msg.type === 'narration'" class="stream-narration">
            <span class="narration-line">—— {{ msg.content }} ——</span>
          </section>

          <!-- 角色侧消息 (left) -->
          <section
            v-else-if="msg.type === 'left'"
            class="msg-row left"
            :class="{ continuation: isContinuation(idx) }"
          >
            <div class="square-avatar">
              <img
                v-if="activeChat.avatarUrl && !isContinuation(idx)"
                :src="activeChat.avatarUrl"
                :alt="activeChat.name"
                class="avatar-img"
              />
              <span v-else-if="!isContinuation(idx)" class="avatar-letter">
                {{ String(activeChat.name || 'C').charAt(0) }}
              </span>
            </div>
            <div class="msg-content-wrapper">
              <div v-if="!isContinuation(idx)" class="msg-meta">
                <span class="speaker-name">{{ activeChat.name || '角色' }}</span>
                <span class="msg-time">{{ formatMsgTime(msg.timestamp) }}</span>
              </div>
              <div class="msg-box">
                <div class="msg-paragraphs">
                  <p
                    v-for="(para, pIdx) in parseParagraphs(msg.content)"
                    :key="pIdx"
                    :class="{ 'action-text': para.isAction }"
                  >
                    {{ para.text }}
                  </p>
                </div>
                <!-- 悬浮工具条 -->
                <div class="msg-toolbar">
                  <button class="tool-btn" @click="handleCopy(msg.content)">复制</button>
                  <button class="tool-btn" @click="handleOpenEdit(msg)">编辑</button>
                  <button class="tool-btn" :disabled="displayedGenerating" @click="handleRegenerateClick" title="重新生成">↻</button>
                  <button class="tool-btn danger" @click="handleDelete(msg.id)">删除</button>
                </div>
              </div>
            </div>
          </section>

          <!-- 用户侧消息 (right) -->
          <section
            v-else-if="msg.type === 'right'"
            class="msg-row right"
            :class="{ continuation: isContinuation(idx) }"
          >
            <div class="msg-content-wrapper">
              <div v-if="!isContinuation(idx)" class="msg-meta">
                <span class="msg-time">{{ formatMsgTime(msg.timestamp) }}</span>
                <span class="speaker-name">{{ myProfile.name || '我' }}</span>
              </div>
              <div class="msg-box">
                <div class="msg-paragraphs">
                  <p
                    v-for="(para, pIdx) in parseParagraphs(msg.content)"
                    :key="pIdx"
                    :class="{ 'action-text': para.isAction }"
                  >
                    {{ para.text }}
                  </p>
                </div>
                <!-- 悬浮工具条 -->
                <div class="msg-toolbar">
                  <button class="tool-btn" @click="handleCopy(msg.content)">复制</button>
                  <button class="tool-btn" @click="handleOpenEdit(msg)">编辑</button>
                  <button class="tool-btn danger" @click="handleDelete(msg.id)">删除</button>
                </div>
              </div>
            </div>
            <div class="square-avatar">
              <img
                v-if="myProfile.avatarUrl && !isContinuation(idx)"
                :src="myProfile.avatarUrl"
                :alt="myProfile.name"
                class="avatar-img"
              />
              <span v-else-if="!isContinuation(idx)" class="avatar-letter">
                {{ String(myProfile.name || '我').charAt(0) }}
              </span>
            </div>
          </section>
        </template>

        <!-- 对方回应状态 -->
        <div v-if="activeChat.isTyping || displayedGenerating" class="typing-notice">
          {{ activeChat.name || '对方' }} 正在回应<span class="typing-dots">...</span>
        </div>
      </div>
    </main>

    <!-- 底部纯白输入栏 -->
    <footer class="offline-composer-wrap">
      <div class="offline-composer">
        <textarea
          ref="textareaRef"
          v-model="inputMessage"
          class="composer-textarea"
          placeholder="描述你的动作，或说点什么..."
          rows="1"
          @input="handleInput"
          @keydown.enter.exact.prevent="handleSend"
        ></textarea>
        <div class="composer-actions">
          <button
            v-if="groupMode"
            class="composer-btn trigger"
            :disabled="displayedGenerating"
            @click="handleTrigger"
            title="请求回应"
          >
            回应
          </button>
          <button
            v-if="displayedGenerating"
            class="composer-btn stop"
            @click="handleStop"
            title="停止生成"
          >
            停止
          </button>
          <button
            v-else
            class="composer-btn send"
            :disabled="!inputMessage.trim()"
            @click="handleSend"
          >
            发送
          </button>
        </div>
      </div>
    </footer>

    <!-- 提示 Toast -->
    <transition name="toast-fade">
      <div v-if="toastVisible" class="offline-toast">
        {{ toastText }}
      </div>
    </transition>

    <!-- 消息编辑弹窗 -->
    <ChatMessageEditModal
      :visible="showEditModal"
      :message-id="editTargetId"
      :initial-content="editInitialContent"
      :initial-type="editInitialType"
      :has-media="false"
      @close="showEditModal = false"
      @save="handleSaveEdit"
    />
  </div>
</template>

<style scoped>
/* 纯白现代极简排版风格 */
.offline-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #ffffff;
  color: #242424;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
  position: relative;
  overflow: hidden;
}

/* 顶部栏 */
.offline-topbar {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  z-index: 20;
  flex-shrink: 0;
}

.back-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #4b5563;
  padding: 6px 8px 6px 0;
  transition: color 0.2s;
}

.back-action-btn:hover {
  color: #111827;
}

.back-chevron {
  font-size: 20px;
  line-height: 1;
  font-weight: 300;
}

.back-label {
  font-size: 14px;
  font-weight: 500;
}

.room-title-info {
  text-align: center;
  flex: 1;
  min-width: 0;
  padding: 0 12px;
}

.room-name {
  font-size: 14px;
  font-weight: 600;
  color: #18181b;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.room-sub {
  font-size: 11px;
  color: #a1a1aa;
  margin-top: 1px;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.topbar-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #e4e4e7;
  background: #ffffff;
  border-radius: 4px;
  color: #52525b;
  display: grid;
  place-items: center;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.topbar-btn:hover {
  background: #f4f4f5;
  color: #18181b;
}

.topbar-btn.stop-btn {
  color: #ef4444;
  border-color: #fca5a5;
}

/* 消息滚动区域 */
.offline-chat-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px 20px 100px;
  scroll-behavior: smooth;
  background: #ffffff;
}

.offline-scene-header {
  text-align: center;
  margin: 8px 0 28px;
}

.scene-badge {
  font-size: 12px;
  font-family: serif, "Songti SC", Simsun;
  color: #71717a;
  letter-spacing: 0.05em;
}

.scene-desc {
  font-size: 11px;
  color: #a1a1aa;
  margin-top: 4px;
}

.offline-empty-notice {
  text-align: center;
  color: #a1a1aa;
  font-size: 13px;
  margin-top: 48px;
  font-style: italic;
}

.offline-dialog-stream {
  width: min(860px, 100%);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 旁白 */
.stream-narration {
  text-align: center;
  margin: 12px 0;
}

.narration-line {
  font-size: 12px;
  color: #a1a1aa;
  letter-spacing: 0.03em;
  font-style: italic;
}

/* 消息行结构 (左右镜像) */
.msg-row {
  display: grid;
  align-items: start;
  column-gap: 14px;
  width: 100%;
}

.msg-row.left {
  grid-template-columns: 46px minmax(0, 1fr);
  justify-content: start;
}

.msg-row.right {
  grid-template-columns: minmax(0, 1fr) 46px;
  justify-content: end;
}

/* 方形头像 */
.square-avatar {
  width: 46px;
  height: 46px;
  border: 1px solid #e4e4e7;
  background: #fafafa;
  border-radius: 4px;
  display: grid;
  place-items: center;
  user-select: none;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.avatar-letter {
  font-family: Georgia, serif;
  font-weight: 700;
  font-size: 17px;
  color: #52525b;
}

.msg-content-wrapper {
  min-width: 0;
  padding-top: 2px;
}

.msg-row.right .msg-content-wrapper {
  text-align: right;
}

/* 名字与时间 */
.msg-meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
  min-height: 18px;
}

.msg-row.right .msg-meta {
  justify-content: flex-end;
}

.speaker-name {
  font-size: 13px;
  font-weight: 600;
  color: #27272a;
  letter-spacing: 0.02em;
}

.msg-time {
  font-size: 11px;
  color: #a1a1aa;
}

/* 正文框体 (纯白非传统圆角气泡) */
.msg-box {
  position: relative;
  display: inline-block;
  width: 100%;
  text-align: left;
  border-top: 1px solid #ebebeb;
  padding: 10px 0 0;
  background: transparent;
}

.msg-paragraphs {
  font-size: 14.5px;
  line-height: 1.85;
  letter-spacing: 0.01em;
  color: #27272a;
  word-break: break-word;
}

.msg-paragraphs p {
  margin: 0 0 10px;
}

.msg-paragraphs p:last-child {
  margin-bottom: 0;
}

/* 动作描写高雅斜体灰字 */
.action-text {
  font-style: italic;
  color: #71717a;
}

/* 悬浮快捷工具栏 */
.msg-toolbar {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 4px;
  opacity: 0.25;
  transition: opacity 0.2s ease;
}

.msg-row.right .msg-toolbar {
  justify-content: flex-end;
}

.msg-row:hover .msg-toolbar,
.msg-row:focus-within .msg-toolbar {
  opacity: 1;
}

.tool-btn {
  height: 24px;
  min-width: 24px;
  padding: 0 8px;
  border: 1px solid transparent;
  background: transparent;
  border-radius: 3px;
  color: #71717a;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tool-btn:hover {
  background: #f4f4f5;
  color: #18181b;
  border-color: #e4e4e7;
}

.tool-btn.danger:hover {
  color: #ef4444;
  background: #fef2f2;
  border-color: #fecaca;
}

/* 连续消息优化 */
.msg-row.continuation {
  margin-top: -14px;
}

.msg-row.continuation .square-avatar {
  visibility: hidden;
  height: 1px;
  border: none;
  background: transparent;
}

.msg-row.continuation .msg-meta {
  display: none;
}

.msg-row.continuation .msg-box {
  border-top-color: #f2f2f2;
  padding-top: 6px;
}

/* 正在输入提示 */
.typing-notice {
  font-size: 12.5px;
  color: #a1a1aa;
  text-align: center;
  margin: 8px 0;
  font-style: italic;
}

.typing-dots {
  display: inline-block;
  letter-spacing: 2px;
  animation: pulse 1.4s infinite ease-in-out;
}

@keyframes pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* 底部输入框 */
.offline-composer-wrap {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px 16px;
  background: linear-gradient(to top, #ffffff 78%, rgba(255, 255, 255, 0));
  z-index: 25;
}

.offline-composer {
  width: min(860px, 100%);
  margin: 0 auto;
  min-height: 52px;
  border: 1px solid #e4e4e7;
  background: #ffffff;
  border-radius: 6px;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 10px;
  padding: 8px 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.offline-composer:focus-within {
  border-color: #a1a1aa;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.07);
}

.composer-textarea {
  min-height: 36px;
  max-height: 120px;
  padding: 6px 4px;
  font-size: 13.5px;
  line-height: 1.55;
  color: #18181b;
  border: none;
  background: transparent;
  outline: none;
  resize: none;
  font-family: inherit;
}

.composer-textarea::placeholder {
  color: #a1a1aa;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.composer-btn {
  height: 34px;
  padding: 0 16px;
  border: 1px solid #18181b;
  background: #18181b;
  color: #ffffff;
  border-radius: 4px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.composer-btn:hover:not(:disabled) {
  opacity: 0.88;
}

.composer-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  border-color: #d4d4d8;
  background: #d4d4d8;
  color: #71717a;
}

.composer-btn.stop {
  background: #ef4444;
  border-color: #ef4444;
  color: #ffffff;
}

.composer-btn.trigger {
  background: #ffffff;
  border-color: #d4d4d8;
  color: #3f3f46;
}

.composer-btn.trigger:hover:not(:disabled) {
  background: #f4f4f5;
}

/* 简约 Toast */
.offline-toast {
  position: absolute;
  top: 68px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(24, 24, 27, 0.88);
  color: #ffffff;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 12px;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.2s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -6px);
}

@media (max-width: 720px) {
  .offline-chat-area {
    padding: 16px 12px 96px;
  }
  .msg-row.left {
    grid-template-columns: 40px minmax(0, 1fr);
  }
  .msg-row.right {
    grid-template-columns: minmax(0, 1fr) 40px;
  }
  .square-avatar {
    width: 40px;
    height: 40px;
  }
  .msg-paragraphs {
    font-size: 14px;
    line-height: 1.75;
  }
  .msg-toolbar {
    opacity: 0.7;
  }
}
</style>
