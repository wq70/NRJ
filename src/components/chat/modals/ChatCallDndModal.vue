/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    dndStart?: string
    dndEnd?: string
  }>(),
  {
    dndStart: '',
    dndEnd: ''
  }
)

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'close'): void
  (e: 'save', payload: { start: string; end: string }): void
}>()

const localStart = ref('')
const localEnd = ref('')
const errorMsg = ref('')

const presets = [
  { label: '夜间免打扰 (23:00 ~ 07:00)', start: '23:00', end: '07:00' },
  { label: '晚睡免打扰 (00:00 ~ 08:00)', start: '00:00', end: '08:00' },
  { label: '工作专注 (09:00 ~ 18:00)', start: '09:00', end: '18:00' },
  { label: '午休免打扰 (12:30 ~ 14:00)', start: '12:30', end: '14:00' }
]

watch(
  () => props.visible,
  (val) => {
    if (val) {
      localStart.value = props.dndStart || ''
      localEnd.value = props.dndEnd || ''
      errorMsg.value = ''
    }
  },
  { immediate: true }
)

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
}

const applyPreset = (start: string, end: string) => {
  localStart.value = start
  localEnd.value = end
  errorMsg.value = ''
}

const handleClear = () => {
  localStart.value = ''
  localEnd.value = ''
  errorMsg.value = ''
}

const handleConfirm = () => {
  const s = localStart.value.trim()
  const e = localEnd.value.trim()

  if ((s && !e) || (!s && e)) {
    errorMsg.value = '开始时间与结束时间需同时设置或同时留空'
    return
  }

  if (s && e && s === e) {
    errorMsg.value = '开始时间与结束时间不能完全相同'
    return
  }

  emit('save', { start: s, end: e })
  handleClose()
}
</script>

<template>
  <div v-if="visible" class="call-dnd-modal-mask" @click.self="handleClose">
    <div class="call-dnd-modal-card">
      <div class="modal-top-bar">
        <div class="modal-title-group">
          <div class="modal-main-title">免打扰时段</div>
          <div class="modal-sub-title">留空表示不限制，此时段内角色拨来的电话不响铃</div>
        </div>
        <button class="modal-icon-close" aria-label="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- 时间区间输入 -->
      <div class="time-range-wrapper">
        <div class="time-input-group" :class="{ 'has-error': !!errorMsg }">
          <div class="time-box">
            <span class="time-label">开始</span>
            <input
              v-model="localStart"
              type="time"
              class="native-time-input"
            />
          </div>
          <div class="time-divider">至</div>
          <div class="time-box">
            <span class="time-label">结束</span>
            <input
              v-model="localEnd"
              type="time"
              class="native-time-input"
            />
          </div>
        </div>
        <div v-if="errorMsg" class="input-error-tip">{{ errorMsg }}</div>
      </div>

      <!-- 快捷预设列表 -->
      <div class="preset-section">
        <div class="preset-section-header">
          <span class="preset-label">常用快捷时段</span>
          <button
            v-if="localStart || localEnd"
            type="button"
            class="preset-clear-link"
            @click="handleClear"
          >
            清空时段
          </button>
        </div>
        <div class="preset-list">
          <button
            v-for="item in presets"
            :key="item.label"
            type="button"
            class="preset-card-btn"
            :class="{ active: localStart === item.start && localEnd === item.end }"
            @click="applyPreset(item.start, item.end)"
          >
            <span class="preset-card-name">{{ item.label }}</span>
            <span class="preset-card-check" aria-hidden="true">
              <svg v-if="localStart === item.start && localEnd === item.end" viewBox="0 0 24 24">
                <path d="M5 12.5L9.5 17L19 7"/>
              </svg>
            </span>
          </button>
        </div>
      </div>

      <!-- 底部操作按钮 -->
      <div class="modal-action-row">
        <button type="button" class="btn-clear" @click="handleClear">
          不限时段
        </button>
        <button type="button" class="btn-cancel" @click="handleClose">
          取消
        </button>
        <button type="button" class="btn-confirm" @click="handleConfirm">
          确认保存
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-dnd-modal-mask {
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

.call-dnd-modal-card {
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

:global(.is-dark) .call-dnd-modal-card {
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

/* 时间选择区 */
.time-range-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.time-input-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--sys-bg-primary, #f5f5f7) 75%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--text-primary, #000) 10%, transparent);
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.time-input-group:focus-within {
  background: var(--sys-bg-primary, #ffffff);
  border-color: var(--text-primary, #1d1d1f);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--text-primary, #1d1d1f) 12%, transparent);
}

.time-input-group.has-error {
  border-color: #ff4d4f;
  background: color-mix(in srgb, #ff4d4f 6%, var(--sys-bg-primary, #ffffff));
}

.time-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.time-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary, #888);
  flex-shrink: 0;
}

.native-time-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  color: var(--text-primary, #1d1d1f);
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  padding: 4px 0;
}

.time-divider {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary, #888);
  flex-shrink: 0;
}

.input-error-tip {
  font-size: 12px;
  color: #ff4d4f;
  padding-left: 4px;
  animation: modal-fade-in 0.18s ease;
}

/* 快捷预设区域 */
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

.preset-clear-link {
  font-size: 11.5px;
  color: var(--text-secondary, #666);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.18s ease;
}

.preset-clear-link:hover {
  color: var(--text-primary, #000);
  text-decoration: underline;
}

.preset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.preset-card-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-radius: 11px;
  font-family: inherit;
  font-size: 12.5px;
  font-weight: 500;
  border: 1px solid color-mix(in srgb, var(--text-primary, #000) 8%, transparent);
  background: color-mix(in srgb, var(--sys-bg-primary, #000) 3%, transparent);
  color: var(--text-secondary, #555);
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
  box-sizing: border-box;
}

:global(.is-dark) .preset-card-btn {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary, #aaa);
}

.preset-card-btn:hover {
  background: color-mix(in srgb, var(--text-primary, #000) 7%, transparent);
  color: var(--text-primary, #000);
}

:global(.is-dark) .preset-card-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.preset-card-btn.active {
  background: var(--text-primary, #1d1d1f);
  color: var(--sys-bg-primary, #ffffff);
  border-color: var(--text-primary, #1d1d1f);
  box-shadow: 0 2px 6px color-mix(in srgb, var(--text-primary, #000) 16%, transparent);
}

:global(.is-dark) .preset-card-btn.active {
  background: var(--text-primary, #ffffff);
  color: var(--sys-bg-secondary, #121214);
  border-color: var(--text-primary, #ffffff);
}

.preset-card-check {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.preset-card-check svg {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 底部操作按钮 */
.modal-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.btn-clear,
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

.btn-clear {
  flex: 1;
  border: 1px solid color-mix(in srgb, var(--text-primary, #000) 12%, transparent);
  background: transparent;
  color: var(--text-tertiary, #888);
}

.btn-clear:hover {
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-primary, #000);
  border-color: color-mix(in srgb, var(--text-primary, #000) 24%, transparent);
}

:global(.is-dark) .btn-clear:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.btn-clear:active {
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
