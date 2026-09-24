/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <Teleport to="body">
    <div 
      v-if="visible" 
      class="clingy-scribe-backdrop" 
      @click.self="handleClose"
      @keydown.esc="handleClose"
    >
      <div 
        class="clingy-scribe-sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <!-- 便笺顶栏：标题与轻触关闭 -->
        <header class="sheet-masthead">
          <div class="masthead-meta">
            <span class="meta-label">EDIT</span>
            <h2 class="meta-title">{{ title }}</h2>
          </div>
          <button 
            type="button" 
            class="masthead-close-btn" 
            title="关闭"
            aria-label="关闭"
            @click="handleClose"
          >
            <svg class="close-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <!-- 书写工作区 -->
        <section class="sheet-editor-box">
          <textarea
            ref="inputRef"
            v-model="inputText"
            :placeholder="placeholder || '在此挥笔撰写...'"
            class="sheet-textarea"
            rows="3"
            spellcheck="false"
            @input="handleInputResize"
            @keydown.enter="handleKeyEnter"
          ></textarea>
        </section>

        <!-- 底部交互控制带 -->
        <footer class="sheet-dock">
          <div class="dock-status">
            <span class="char-meter">{{ characterCount }} 字</span>
            <span v-if="hasChanges" class="status-badge modified">已编辑</span>
            <span v-else class="status-badge untouched">原样</span>
          </div>

          <div class="dock-actions">
            <!-- 辅助按钮：恢复默认 -->
            <button
              v-if="canReset"
              type="button"
              class="dock-action-btn subtle-btn"
              title="复原默认文案"
              @click="handleReset"
            >
              重置
            </button>

            <!-- 辅助按钮：一键清空 -->
            <button
              v-if="inputText.length > 0"
              type="button"
              class="dock-action-btn subtle-btn"
              title="清空输入"
              @click="handleClear"
            >
              清空
            </button>

            <!-- 主提交按钮 -->
            <button
              type="button"
              class="dock-action-btn commit-btn"
              @click="handleSave"
            >
              保存
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'

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
const inputRef = ref<HTMLTextAreaElement | null>(null)

const characterCount = computed(() => {
  return inputText.value.length
})

const hasChanges = computed(() => {
  return inputText.value !== props.currentText
})

const canReset = computed(() => {
  return props.defaultText !== undefined && inputText.value !== props.defaultText
})

const handleInputResize = () => {
  if (inputRef.value) {
    inputRef.value.style.height = 'auto'
    const nextHeight = Math.min(Math.max(inputRef.value.scrollHeight, 72), 220)
    inputRef.value.style.height = `${nextHeight}px`
  }
}

const focusAndPositionCursor = () => {
  if (inputRef.value) {
    inputRef.value.focus()
    const len = inputRef.value.value.length
    inputRef.value.setSelectionRange(len, len)
  }
}

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      inputText.value = props.currentText || ''
      nextTick(() => {
        handleInputResize()
        focusAndPositionCursor()
      })
    }
  }
)

watch(inputText, () => {
  nextTick(() => {
    handleInputResize()
  })
})

const handleClose = () => {
  emit('update:visible', false)
}

const handleClear = () => {
  inputText.value = ''
  nextTick(() => {
    handleInputResize()
    inputRef.value?.focus()
  })
}

const handleReset = () => {
  inputText.value = props.defaultText || ''
  nextTick(() => {
    handleInputResize()
    focusAndPositionCursor()
  })
}

const handleKeyEnter = (e: KeyboardEvent) => {
  // 单行回车或 Ctrl/Cmd+Enter 即可快捷提交；Shift+Enter 允许换行
  if (e.shiftKey) return
  e.preventDefault()
  handleSave()
}

const handleSave = () => {
  const finalVal = inputText.value.trim() !== '' ? inputText.value.trim() : props.defaultText
  emit('saved', finalVal)
  handleClose()
}
</script>

<style scoped>
.clingy-scribe-backdrop * {
  box-sizing: border-box;
}

.clingy-scribe-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(18, 20, 26, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 9999;
  animation: scribeFade 0.18s ease-out;
}

@keyframes scribeFade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 笺纸主体容器：纯色、挺括、文学质感 */
.clingy-scribe-sheet {
  width: 100%;
  max-width: 380px;
  background-color: #ffffff;
  border: 1px solid #e8eaee;
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scribeSlide 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scribeSlide {
  from {
    transform: translateY(12px) scale(0.98);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

/* 笺顶信息栏 */
.sheet-masthead {
  padding: 18px 20px 14px 20px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  border-bottom: 1px solid #f0f2f5;
  background-color: #fafbfc;
}

.masthead-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: #8c93a0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-transform: uppercase;
}

.meta-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2329;
  letter-spacing: 0.2px;
  line-height: 1.3;
}

.masthead-close-btn {
  background: transparent;
  border: none;
  padding: 6px;
  margin-top: -2px;
  margin-right: -4px;
  color: #8c93a0;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.masthead-close-btn:hover {
  color: #1f2329;
  background-color: #eef1f4;
}

/* 文本编辑区域 */
.sheet-editor-box {
  padding: 16px 20px 12px 20px;
  background-color: #ffffff;
}

.sheet-textarea {
  width: 100%;
  min-height: 72px;
  max-height: 220px;
  padding: 12px 14px;
  font-size: 15px;
  line-height: 1.65;
  color: #1f2329;
  background-color: #f7f8fa;
  border: 1px solid #e5e8ec;
  border-radius: 10px;
  outline: none;
  resize: none;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Segoe UI", Roboto, sans-serif;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.sheet-textarea:focus {
  background-color: #ffffff;
  border-color: var(--text-edit-focus-color, #3b82f6);
  box-shadow: 0 0 0 3px var(--text-edit-focus-ring, rgba(59, 130, 246, 0.22));
}

.sheet-textarea::placeholder {
  color: #a0a6b1;
  font-weight: 400;
}

/* 底部交互控制带 */
.sheet-dock {
  padding: 12px 20px 16px 20px;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.dock-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.char-meter {
  color: #8c93a0;
  font-weight: 500;
}

.status-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.status-badge.modified {
  background-color: #eff6ff;
  color: #2563eb;
}

.status-badge.untouched {
  background-color: #f3f4f6;
  color: #9ca3af;
}

.dock-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dock-action-btn {
  border: none;
  outline: none;
  cursor: pointer;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 0.15s ease, color 0.15s ease;
  font-family: inherit;
}

.subtle-btn {
  background-color: transparent;
  color: #64748b;
  padding: 6px 10px;
}

.subtle-btn:hover {
  background-color: #f1f5f9;
  color: #0f172a;
}

.commit-btn {
  background-color: #1f2329;
  color: #ffffff;
  padding: 7px 18px;
  font-weight: 600;
}

.commit-btn:hover {
  background-color: #374151;
}

.commit-btn:active {
  background-color: #111827;
}
</style>
