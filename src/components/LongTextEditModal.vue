/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <Teleport to="body">
    <Transition name="clingy-sheet-fade">
      <div 
        v-if="visible" 
        class="clingy-scribe-viewport"
        @click.self="handleCancel"
      >
        <div 
          class="clingy-scribe-frame"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <!-- 刊头区：极简纯白与典雅排印 -->
          <header class="scribe-masthead">
            <div class="masthead-left">
              <button 
                type="button" 
                class="scribe-nav-btn"
                @click="handleCancel"
                aria-label="返回"
              >
                <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
                <span class="nav-label">返回</span>
              </button>
            </div>

            <div class="masthead-center">
              <h1 class="scribe-title">{{ title || '文本编辑' }}</h1>
              <div class="scribe-metrics">
                <span class="metric-num">{{ textLength }}</span>
                <span class="metric-unit">字</span>
                <span class="metrics-sep">/</span>
                <span class="metric-num">{{ paragraphCount }}</span>
                <span class="metric-unit">段</span>
                <span class="metrics-sep">/</span>
                <span class="metric-read">约 {{ readingTimeMinutes }} 分钟阅读</span>
              </div>
            </div>

            <div class="masthead-right">
              <button 
                type="button" 
                class="scribe-commit-btn"
                @click="handleSave"
                title="完成并保存"
              >
                完成
              </button>
            </div>
          </header>

          <!-- 工具区：极细线框、纤致克制 -->
          <section class="scribe-toolkit-strip">
            <div class="toolkit-left">
              <button 
                type="button"
                class="tool-chip-btn"
                :class="{ 'is-active': searchVisible }"
                @click="toggleSearch"
                title="查找关键词"
              >
                <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="21" y1="21" x2="16.2" y2="16.2"/>
                </svg>
                <span>查找</span>
              </button>

              <button 
                type="button"
                class="tool-chip-btn"
                @click="copyAllContent"
                title="复制全文"
              >
                <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <span>{{ copyFeedback ? '已复制' : '复制' }}</span>
              </button>
            </div>

            <div class="toolkit-right">
              <button 
                v-if="canReset"
                type="button"
                class="tool-chip-btn subtle-action"
                @click="requestReset"
                title="恢复为默认内容"
              >
                恢复默认
              </button>

              <button 
                v-if="inputText.length > 0"
                type="button"
                class="tool-chip-btn subtle-action"
                @click="requestClear"
                title="清空当前文本"
              >
                清空
              </button>
            </div>
          </section>

          <!-- 检索抽屉：极简白底单线 -->
          <Transition name="scribe-drawer">
            <div v-if="searchVisible" class="scribe-search-drawer">
              <div class="search-input-shell">
                <svg class="search-lens-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="21" y1="21" x2="16.2" y2="16.2"/>
                </svg>
                <input 
                  ref="searchInputRef"
                  type="text" 
                  class="search-inner-input" 
                  placeholder="查找关键词..." 
                  v-model="searchKeyword"
                  @keydown.enter.prevent="findNext"
                  @input="resetSearch"
                />
              </div>

              <div class="search-controls">
                <span class="search-counter" v-if="searchKeyword">
                  {{ matchCount > 0 ? currentMatchIndex + 1 : 0 }} / {{ matchCount }}
                </span>
                <button 
                  type="button" 
                  class="search-nav-btn" 
                  @click="findPrev" 
                  :disabled="!matchCount"
                  title="上一个"
                >
                  <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="18 15 12 9 6 15"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  class="search-nav-btn" 
                  @click="findNext" 
                  :disabled="!matchCount"
                  title="下一个"
                >
                  <svg class="nav-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                <button 
                  type="button" 
                  class="search-dismiss-btn" 
                  @click="toggleSearch"
                  title="关闭查找"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
          </Transition>

          <!-- 正文编辑区：纯白书卷排版、自然呼吸感 -->
          <main class="scribe-body">
            <textarea 
              ref="textareaRef"
              v-model="inputText" 
              :placeholder="placeholder || '在此输入文本内容...'"
              class="scribe-textarea"
              spellcheck="false"
              autocapitalize="off"
              autocomplete="off"
            ></textarea>
          </main>

          <!-- 标点快捷输入横轨：纯白活字质感琴键 -->
          <footer class="scribe-punctuation-rail">
            <div class="rail-edge-shadow left-shadow"></div>
            <div class="rail-scroll-track">
              <button 
                v-for="symbol in punctuationList" 
                :key="symbol.label"
                type="button"
                class="rail-symbol-btn"
                @click="insertPunctuation(symbol.insert, symbol.offset)"
              >
                {{ symbol.label }}
              </button>
            </div>
            <div class="rail-edge-shadow right-shadow"></div>
          </footer>

          <!-- 极简纯白二次确认弹窗 -->
          <Transition name="scribe-dialog-fade">
            <div v-if="confirmDialog.visible" class="scribe-inline-modal-mask" @click.self="cancelConfirm">
              <div class="scribe-inline-dialog">
                <h3 class="dialog-title">{{ confirmDialog.title }}</h3>
                <p class="dialog-desc">{{ confirmDialog.message }}</p>
                <div class="dialog-actions">
                  <button type="button" class="dialog-cancel-btn" @click="cancelConfirm">取消</button>
                  <button type="button" class="dialog-confirm-btn" @click="executeConfirm">确认</button>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { ref, watch, computed, nextTick } from 'vue'

const props = defineProps<{
  visible: boolean
  title: string
  currentText: string
  defaultText: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved', text: string): void
}>()

const inputText = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const copyFeedback = ref(false)

// 检索系统
const searchVisible = ref(false)
const searchKeyword = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const matchIndices = ref<number[]>([])
const currentMatchIndex = ref(-1)

// 标点符号快捷键配置
const punctuationList = [
  { label: '“ ”', insert: '“”', offset: 1 },
  { label: '（）', insert: '（）', offset: 1 },
  { label: '——', insert: '——', offset: 2 },
  { label: '……', insert: '……', offset: 2 },
  { label: '、', insert: '、', offset: 1 },
  { label: '，', insert: '，', offset: 1 },
  { label: '。', insert: '。', offset: 1 },
  { label: '「」', insert: '「」', offset: 1 },
  { label: '『』', insert: '『』', offset: 1 },
  { label: '《》', insert: '《》', offset: 1 },
  { label: '！', insert: '！', offset: 1 },
  { label: '？', insert: '？', offset: 1 }
]

const textLength = computed(() => {
  return inputText.value.length
})

const paragraphCount = computed(() => {
  if (!inputText.value.trim()) return 0
  return inputText.value.split(/\n+/).filter(Boolean).length
})

const readingTimeMinutes = computed(() => {
  const count = textLength.value
  if (count <= 0) return 0
  return Math.max(1, Math.round(count / 350))
})

const canReset = computed(() => {
  return props.defaultText !== undefined && inputText.value !== props.defaultText
})

watch(() => props.visible, (newVal) => {
  if (newVal) {
    inputText.value = props.currentText || ''
    searchVisible.value = false
    searchKeyword.value = ''
    resetSearch()
    nextTick(() => {
      if (textareaRef.value) {
        textareaRef.value.focus()
      }
    })
  }
})

// 查找核心逻辑
const resetSearch = () => {
  matchIndices.value = []
  currentMatchIndex.value = -1
  if (!searchKeyword.value || !inputText.value) return
  
  const keyword = searchKeyword.value.toLowerCase()
  const text = inputText.value.toLowerCase()
  let startIndex = 0
  let index: number
  
  while ((index = text.indexOf(keyword, startIndex)) > -1) {
    matchIndices.value.push(index)
    startIndex = index + keyword.length
  }
}

const matchCount = computed(() => matchIndices.value.length)

const scrollToMatch = () => {
  if (matchIndices.value.length === 0 || !textareaRef.value) return
  
  const index = matchIndices.value[currentMatchIndex.value]
  const el = textareaRef.value
  
  el.focus()
  el.setSelectionRange(index, index + searchKeyword.value.length)
  
  const ratio = index / Math.max(inputText.value.length, 1)
  el.scrollTop = el.scrollHeight * ratio - el.clientHeight / 2
}

const findNext = () => {
  if (!searchKeyword.value) return
  if (matchIndices.value.length === 0) resetSearch()
  if (matchIndices.value.length === 0) return
  
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchIndices.value.length
  scrollToMatch()
}

const findPrev = () => {
  if (!searchKeyword.value) return
  if (matchIndices.value.length === 0) resetSearch()
  if (matchIndices.value.length === 0) return
  
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchIndices.value.length) % matchIndices.value.length
  scrollToMatch()
}

const toggleSearch = () => {
  searchVisible.value = !searchVisible.value
  if (searchVisible.value) {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  } else {
    searchKeyword.value = ''
    resetSearch()
    textareaRef.value?.focus()
  }
}

// 标点插入
const insertPunctuation = (symbol: string, offset: number) => {
  const el = textareaRef.value
  if (!el) return
  
  const start = el.selectionStart ?? inputText.value.length
  const end = el.selectionEnd ?? inputText.value.length
  const current = inputText.value
  
  inputText.value = current.substring(0, start) + symbol + current.substring(end)
  
  nextTick(() => {
    el.focus()
    const targetPos = start + offset
    el.setSelectionRange(targetPos, targetPos)
  })
}

// 复制全文
const copyAllContent = async () => {
  if (!inputText.value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(inputText.value)
    } else {
      const el = textareaRef.value
      if (el) {
        el.select()
        document.execCommand('copy')
      }
    }
    copyFeedback.value = true
    setTimeout(() => {
      copyFeedback.value = false
    }, 1500)
  } catch {
    // 降级处理
  }
}

// 纯白确认弹窗
const confirmDialog = ref({
  visible: false,
  title: '',
  message: '',
  action: '' as 'clear' | 'reset' | ''
})

const requestClear = () => {
  confirmDialog.value = {
    visible: true,
    title: '清空文本',
    message: '确认清空当前的全部文本内容吗？',
    action: 'clear'
  }
}

const requestReset = () => {
  confirmDialog.value = {
    visible: true,
    title: '恢复默认',
    message: '确认恢复为初始默认设定吗？当前未保存的修改将被覆盖。',
    action: 'reset'
  }
}

const cancelConfirm = () => {
  confirmDialog.value.visible = false
  confirmDialog.value.action = ''
}

const executeConfirm = () => {
  if (confirmDialog.value.action === 'clear') {
    inputText.value = ''
  } else if (confirmDialog.value.action === 'reset') {
    inputText.value = props.defaultText || ''
  }
  confirmDialog.value.visible = false
  confirmDialog.value.action = ''
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

const handleCancel = () => {
  emit('update:visible', false)
}

const handleSave = () => {
  const finalVal = inputText.value.trim() !== '' ? inputText.value.trim() : props.defaultText
  emit('saved', finalVal)
  handleCancel()
}
</script>

<style scoped>
.clingy-scribe-viewport * {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}

/* 视口全屏遮罩：干净极简纯白半透微光 */
.clingy-scribe-viewport {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  padding: 0;
}

/* 纸卷主体：100% 纯白底色，整洁通透 */
.clingy-scribe-frame {
  width: 100vw;
  height: 100dvh;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 大屏与平板：呈现开阔舒展的纯白书页质感 */
@media (min-width: 768px) {
  .clingy-scribe-viewport {
    padding: 32px;
  }
  .clingy-scribe-frame {
    width: min(860px, 92vw);
    height: min(88vh, 880px);
    border-radius: 20px;
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
  }
}

/* 刊头：纯白极简、极细分割、沉静高贵 */
.scribe-masthead {
  padding: env(safe-area-inset-top, 0px) 24px 0 24px;
  min-height: calc(64px + env(safe-area-inset-top, 0px));
  background-color: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 16px;
}

.masthead-left,
.masthead-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.masthead-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  text-align: center;
}

.scribe-title {
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  color: #1a1a1a;
  letter-spacing: 0.06em;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.scribe-metrics {
  font-size: 11px;
  color: #9c9c9c;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
}

.metric-num {
  color: #666666;
  font-weight: 500;
}

.metric-unit {
  color: #9c9c9c;
}

.metrics-sep {
  color: #d8d8d8;
  font-size: 10px;
  margin: 0 1px;
}

.metric-read {
  color: #9c9c9c;
}

/* 返回操作：返璞归真，极简中文字符 */
.scribe-nav-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  font-weight: 400;
  color: #555555;
  letter-spacing: 0.03em;
  font-family: inherit;
  transition: color 0.15s ease;
  border-radius: 6px;
}

.scribe-nav-btn:hover {
  color: #111111;
}

.nav-icon {
  width: 16px;
  height: 16px;
  stroke-width: 1.6;
}

.nav-label {
  font-size: 13.5px;
}

/* 完成按钮：雅致墨色极简胶囊，全页面唯一的点睛重心 */
.scribe-commit-btn {
  background-color: #181818;
  color: #ffffff;
  border: none;
  border-radius: 18px;
  padding: 6px 18px;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.scribe-commit-btn:hover {
  background-color: #333333;
  transform: translateY(-0.5px);
}

.scribe-commit-btn:active {
  background-color: #000000;
  transform: scale(0.97) translateY(0);
}

/* 工具栏：极简通透纯白，微细边框 */
.scribe-toolkit-strip {
  padding: 8px 24px;
  background-color: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.035);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  gap: 12px;
}

.toolkit-left,
.toolkit-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-chip-btn {
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 14px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 400;
  color: #555555;
  letter-spacing: 0.03em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: inherit;
  transition: all 0.15s ease;
}

.tool-chip-btn:hover {
  color: #111111;
  border-color: rgba(0, 0, 0, 0.18);
  background-color: #fafafa;
}

.tool-chip-btn.is-active {
  background-color: #181818;
  color: #ffffff;
  border-color: #181818;
}

.tool-icon {
  width: 12.5px;
  height: 12.5px;
}

.subtle-action {
  color: #777777;
}

/* 检索抽屉：纯白无灰质感 */
.scribe-search-drawer {
  background-color: #ffffff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  padding: 8px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}

.search-input-shell {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.09);
  border-radius: 8px;
  padding: 5px 12px;
  transition: border-color 0.15s ease;
}

.search-input-shell:focus-within {
  border-color: rgba(0, 0, 0, 0.35);
}

.search-lens-icon {
  width: 13px;
  height: 13px;
  color: #999999;
  flex-shrink: 0;
}

.search-inner-input {
  flex: 1;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: #1a1a1a;
  font-family: inherit;
  padding: 0;
  letter-spacing: 0.02em;
}

.search-inner-input::placeholder {
  color: #bbbbbb;
}

.search-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.search-counter {
  font-size: 11px;
  color: #888888;
  font-variant-numeric: tabular-nums;
  margin-right: 4px;
  letter-spacing: 0.02em;
}

.search-nav-btn,
.search-dismiss-btn {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #555555;
  padding: 0;
  transition: all 0.15s ease;
}

.search-nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.search-nav-btn:hover:not(:disabled),
.search-dismiss-btn:hover {
  background-color: #fafafa;
  border-color: rgba(0, 0, 0, 0.2);
  color: #111111;
}

.nav-arrow {
  width: 13px;
  height: 13px;
}

.search-dismiss-btn svg {
  width: 13px;
  height: 13px;
}

/* 正文编辑区：纯白版心，排版呼吸感 */
.scribe-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 30px;
  background-color: #ffffff;
  overflow: hidden;
}

@media (max-width: 640px) {
  .scribe-body {
    padding: 20px 20px;
  }
}

.scribe-textarea {
  flex: 1;
  width: 100%;
  border: none;
  background: #ffffff;
  outline: none;
  font-size: 15px;
  font-weight: 400;
  line-height: 2.0;
  letter-spacing: 0.025em;
  color: #242426;
  resize: none;
  overflow-y: auto;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Serif CJK SC", "Songti SC", "Source Han Serif SC", "Hiragino Sans GB", "Microsoft YaHei", serif;
  caret-color: #181818;
  padding: 0;
  margin: 0;
}

.scribe-textarea::placeholder {
  color: #c8c8cc;
  font-weight: 300;
  letter-spacing: 0.02em;
}

/* 极细滚动条 */
.scribe-textarea::-webkit-scrollbar {
  width: 3px;
}
.scribe-textarea::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.07);
  border-radius: 3px;
}
.scribe-textarea::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.15);
}
.scribe-textarea::-webkit-scrollbar-track {
  background: transparent;
}

/* 标点横轨：纯白素纸琴键感，两端带微白渐变掩映 */
.scribe-punctuation-rail {
  position: relative;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background-color: #ffffff;
  border-top: 1px solid rgba(0, 0, 0, 0.035);
  flex-shrink: 0;
}

.rail-edge-shadow {
  position: absolute;
  top: 0;
  bottom: env(safe-area-inset-bottom, 0px);
  width: 24px;
  pointer-events: none;
  z-index: 2;
}

.left-shadow {
  left: 0;
  background: linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0));
}

.right-shadow {
  right: 0;
  background: linear-gradient(to left, #ffffff, rgba(255, 255, 255, 0));
}

.rail-scroll-track {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.rail-scroll-track::-webkit-scrollbar {
  display: none;
}

.rail-symbol-btn {
  flex-shrink: 0;
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 13px;
  font-weight: 400;
  color: #383838;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Songti SC", "Source Han Serif SC", "PingFang SC", serif;
  transition: all 0.15s ease;
}

.rail-symbol-btn:hover {
  background-color: #fafafa;
  border-color: rgba(0, 0, 0, 0.18);
  color: #111111;
}

.rail-symbol-btn:active {
  background-color: #f2f2f2;
  transform: scale(0.96);
}

/* 纯白极简二次确认弹窗 */
.scribe-inline-modal-mask {
  position: absolute;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.16);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.scribe-inline-dialog {
  width: 100%;
  max-width: 300px;
  background-color: #ffffff;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.09);
  padding: 24px 20px 18px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.dialog-title {
  margin: 0 0 8px 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  letter-spacing: 0.04em;
}

.dialog-desc {
  margin: 0 0 20px 0;
  font-size: 13px;
  color: #666666;
  line-height: 1.55;
  letter-spacing: 0.01em;
}

.dialog-actions {
  display: flex;
  gap: 10px;
  width: 100%;
}

.dialog-cancel-btn,
.dialog-confirm-btn {
  flex: 1;
  padding: 8px 0;
  font-size: 13px;
  border-radius: 10px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s ease;
  letter-spacing: 0.04em;
}

.dialog-cancel-btn {
  background-color: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.09);
  color: #666666;
}

.dialog-cancel-btn:hover {
  background-color: #f7f7f7;
  color: #222222;
}

.dialog-confirm-btn {
  background-color: #181818;
  border: 1px solid #181818;
  color: #ffffff;
}

.dialog-confirm-btn:hover {
  background-color: #333333;
}

.dialog-confirm-btn:active {
  transform: scale(0.97);
}

.scribe-dialog-fade-enter-active,
.scribe-dialog-fade-leave-active {
  transition: opacity 0.16s ease;
}

.scribe-dialog-fade-enter-from,
.scribe-dialog-fade-leave-to {
  opacity: 0;
}

/* 过渡动效 */
.clingy-sheet-fade-enter-active,
.clingy-sheet-fade-leave-active {
  transition: opacity 0.18s ease;
}

.clingy-sheet-fade-enter-from,
.clingy-sheet-fade-leave-to {
  opacity: 0;
}

.scribe-drawer-enter-active,
.scribe-drawer-leave-active {
  transition: all 0.18s ease;
}

.scribe-drawer-enter-from,
.scribe-drawer-leave-to {
  transform: translateY(-6px);
  opacity: 0;
}
</style>
