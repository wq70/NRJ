/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    modelValue?: number
    defaultValue?: number
    title?: string
    subTitle?: string
    placeholder?: string
    unit?: string
    min?: number
    max?: number
    presets?: number[]
  }>(),
  {
    modelValue: 50,
    defaultValue: 50,
    title: '心声存储上限',
    subTitle: '角色生成的心声超出此上限时，将自动淘汰较早记录',
    placeholder: '搜索或输入上限条数...',
    unit: '条',
    min: 1,
    max: 1000,
    presets: () => [20, 50, 100, 200, 500]
  }
)

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'close'): void
  (e: 'save', val: number): void
  (e: 'reset'): void
}>()

const inputValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const errorMsg = ref('')

const effectiveDefault = computed(() => {
  return props.defaultValue !== undefined ? props.defaultValue : (props.modelValue ?? 50)
})

watch(
  () => props.visible,
  (val) => {
    if (val) {
      inputValue.value = String(props.modelValue ?? effectiveDefault.value)
      errorMsg.value = ''
      nextTick(() => {
        if (inputRef.value) {
          inputRef.value.focus()
          inputRef.value.select()
        }
      })
    }
  },
  { immediate: true }
)

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const selectPreset = (num: number) => {
  inputValue.value = String(num)
  errorMsg.value = ''
  if (inputRef.value) {
    inputRef.value.focus()
  }
}

const clearInput = () => {
  inputValue.value = ''
  errorMsg.value = ''
  if (inputRef.value) {
    inputRef.value.focus()
  }
}

const handleReset = () => {
  inputValue.value = String(effectiveDefault.value)
  errorMsg.value = ''
  emit('reset')
  if (inputRef.value) {
    inputRef.value.focus()
    inputRef.value.select()
  }
}

const handleConfirm = () => {
  const trimmed = inputValue.value.trim()
  if (!trimmed) {
    errorMsg.value = `请输入${props.title}条数`
    return
  }
  const parsed = parseInt(trimmed, 10)
  if (isNaN(parsed) || parsed < props.min) {
    errorMsg.value = `数值必须为大于或等于 ${props.min} 的整数`
    return
  }
  if (parsed > props.max) {
    errorMsg.value = `数值最大不可超过 ${props.max} ${props.unit}`
    return
  }
  emit('save', parsed)
  handleClose()
}
</script>

<template>
  <div v-if="visible" class="inner-thought-modal-mask" @click.self="handleClose">
    <div class="inner-thought-modal-card">
      <div class="modal-top-bar">
        <div class="modal-title-group">
          <div class="modal-main-title">{{ title }}</div>
          <div class="modal-sub-title">{{ subTitle }}</div>
        </div>
        <button class="modal-icon-close" aria-label="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 搜索框/输入框风格 -->
      <div class="search-input-wrapper">
        <div class="search-input-box" :class="{ 'has-error': !!errorMsg }">
          <span class="search-box-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <line x1="16.5" y1="16.5" x2="21.5" y2="21.5" />
            </svg>
          </span>
          <input
            ref="inputRef"
            v-model="inputValue"
            type="number"
            :min="min"
            :max="max"
            inputmode="numeric"
            :placeholder="placeholder || `输入条数 (${min} ~ ${max})...`"
            class="search-text-input"
            @keydown.enter.prevent="handleConfirm"
          />
          <button
            v-if="inputValue"
            type="button"
            class="search-clear-btn"
            aria-label="清空输入"
            @click="clearInput"
          >
            <svg viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <span class="search-unit-badge">{{ unit }}</span>
        </div>
        <div v-if="errorMsg" class="input-error-tip">{{ errorMsg }}</div>
      </div>

      <!-- 快捷预设区域（横向流式平铺） -->
      <div v-if="presets && presets.length" class="preset-section">
        <div class="preset-section-header">
          <span class="preset-label">常用预设</span>
          <span v-if="effectiveDefault !== undefined" class="preset-default-hint">
            推荐默认: {{ effectiveDefault }}{{ unit }}
          </span>
        </div>
        <div class="preset-grid">
          <button
            v-for="num in presets"
            :key="num"
            type="button"
            class="preset-chip"
            :class="{ active: String(num) === inputValue.trim() }"
            @click="selectPreset(num)"
          >
            {{ num }} {{ unit }}
          </button>
        </div>
      </div>

      <!-- 底部操作按钮：重置 | 取消 | 确认保存 -->
      <div class="modal-action-row">
        <button type="button" class="btn-reset" title="恢复推荐默认值" @click="handleReset">
          重置默认
        </button>
        <button type="button" class="btn-cancel" @click="handleClose">取消</button>
        <button type="button" class="btn-confirm" @click="handleConfirm">确认保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.inner-thought-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.46);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 16px;
  animation: modal-fade-in 0.22s ease-out;
}

.inner-thought-modal-card {
  width: min(92vw, 390px);
  background: #ffffff;
  border-radius: 20px;
  padding: 22px 20px 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16), 0 4px 12px rgba(0, 0, 0, 0.06);
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 16px;
  animation: modal-card-in 0.24s cubic-bezier(0.18, 0.89, 0.32, 1.15);
  box-sizing: border-box;
}

:global(.is-dark) .inner-thought-modal-card {
  background: var(--sys-bg-secondary, #1f1f23);
  border-color: color-mix(in srgb, var(--text-primary, #fff) 12%, transparent);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.24);
}

.modal-top-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.modal-title-group {
  min-width: 0;
  flex: 1;
}

.modal-main-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #1d1d1f);
  line-height: 1.35;
  letter-spacing: -0.01em;
}

.modal-sub-title {
  font-size: 11.5px;
  color: var(--text-tertiary, #86868b);
  margin-top: 4px;
  line-height: 1.45;
}

.modal-icon-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-secondary, #666);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s ease;
  padding: 0;
}

:global(.is-dark) .modal-icon-close {
  background: rgba(255, 255, 255, 0.08);
}

.modal-icon-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--text-primary, #000);
  transform: scale(1.06);
}

:global(.is-dark) .modal-icon-close:hover {
  background: rgba(255, 255, 255, 0.15);
}

.modal-icon-close svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 搜索框居中样式 */
.search-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-input-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--sys-bg-primary, #f5f5f7) 75%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--text-primary, #000) 10%, transparent);
  border-radius: 14px;
  padding: 0 14px;
  height: 48px;
  transition: all 0.22s ease;
  box-sizing: border-box;
}

.search-input-box:focus-within {
  background: var(--sys-bg-primary, #ffffff);
  border-color: var(--text-primary, #1d1d1f);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-primary, #1d1d1f) 12%, transparent);
}

.search-input-box.has-error {
  border-color: #ff4d4f;
  background: color-mix(in srgb, #ff4d4f 6%, var(--sys-bg-primary, #ffffff));
}

.search-box-icon {
  width: 18px;
  height: 18px;
  color: var(--text-tertiary, #888);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.search-box-icon svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.search-text-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary, #1d1d1f);
  font-size: 15px;
  font-weight: 500;
  font-family: inherit;
  box-sizing: border-box;
}

.search-text-input::placeholder {
  color: var(--text-tertiary, #aaa);
  font-size: 13.5px;
  font-weight: 400;
}

/* 隐藏原生 number 箭头 */
.search-text-input::-webkit-outer-spin-button,
.search-text-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.search-text-input[type='number'] {
  -moz-appearance: textfield;
}

.search-clear-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.08);
  color: var(--text-secondary, #666);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: all 0.15s ease;
}

:global(.is-dark) .search-clear-btn {
  background: rgba(255, 255, 255, 0.12);
}

.search-clear-btn:hover {
  background: rgba(0, 0, 0, 0.16);
  color: var(--text-primary, #000);
}

.search-clear-btn svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.search-unit-badge {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  flex-shrink: 0;
  padding-left: 4px;
}

.input-error-tip {
  font-size: 12px;
  color: #ff4d4f;
  padding-left: 4px;
  animation: modal-fade-in 0.18s ease;
}

/* 常用预设区域 */
.preset-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.preset-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.preset-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary, #888);
}

.preset-default-hint {
  font-size: 11px;
  color: var(--text-tertiary, #999);
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.preset-chip {
  flex: 1 1 auto;
  min-width: 58px;
  height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  border: 1px solid color-mix(in srgb, var(--text-primary, #000) 10%, transparent);
  background: color-mix(in srgb, var(--sys-bg-primary, #000) 4%, transparent);
  color: var(--text-secondary, #555);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.18s ease;
  user-select: none;
  box-sizing: border-box;
}

:global(.is-dark) .preset-chip {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary, #aaa);
}

.preset-chip:hover {
  background: color-mix(in srgb, var(--text-primary, #000) 8%, transparent);
  color: var(--text-primary, #000);
  border-color: color-mix(in srgb, var(--text-primary, #000) 22%, transparent);
  transform: translateY(-1px);
}

:global(.is-dark) .preset-chip:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.2);
}

.preset-chip:active {
  transform: translateY(0);
}

.preset-chip.active {
  background: var(--text-primary, #1d1d1f);
  color: var(--sys-bg-primary, #ffffff);
  border-color: var(--text-primary, #1d1d1f);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--text-primary, #000) 18%, transparent);
  font-weight: 600;
}

:global(.is-dark) .preset-chip.active {
  background: var(--text-primary, #ffffff);
  color: var(--sys-bg-secondary, #121214);
  border-color: var(--text-primary, #ffffff);
}

/* 底部操作按钮：重置 | 取消 | 确认保存 */
.modal-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.btn-reset,
.btn-cancel,
.btn-confirm {
  height: 42px;
  border-radius: 12px;
  font-size: 13.5px;
  font-weight: 600;
  font-family: inherit;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
  user-select: none;
}

.btn-reset {
  flex: 1;
  border: 1px solid color-mix(in srgb, var(--text-primary, #000) 12%, transparent);
  background: transparent;
  color: var(--text-tertiary, #888);
}

.btn-reset:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-primary, #000);
  border-color: color-mix(in srgb, var(--text-primary, #000) 24%, transparent);
}

:global(.is-dark) .btn-reset:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.btn-reset:active {
  transform: scale(0.98);
}

.btn-cancel {
  flex: 1;
  border: 1px solid color-mix(in srgb, var(--text-primary, #000) 12%, transparent);
  background: transparent;
  color: var(--text-secondary, #666);
}

.btn-cancel:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-primary, #000);
}

:global(.is-dark) .btn-cancel:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.btn-cancel:active {
  transform: scale(0.98);
}

.btn-confirm {
  flex: 1.4;
  border: none;
  background: var(--text-primary, #1d1d1f);
  color: var(--sys-bg-primary, #ffffff);
  box-shadow: 0 4px 12px color-mix(in srgb, var(--text-primary, #000) 18%, transparent);
}

:global(.is-dark) .btn-confirm {
  background: var(--text-primary, #ffffff);
  color: var(--sys-bg-secondary, #121214);
}

.btn-confirm:hover {
  opacity: 0.92;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px color-mix(in srgb, var(--text-primary, #000) 24%, transparent);
}

.btn-confirm:active {
  transform: translateY(0) scale(0.98);
}

@keyframes modal-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes modal-card-in {
  from {
    opacity: 0;
    transform: scale(0.94) translateY(6px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
</style>
