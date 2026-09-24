/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
export type CallRecordSortType = 'timeDesc' | 'timeAsc' | 'durationDesc' | 'durationAsc'

const props = defineProps<{
  show: boolean
  modelValue: CallRecordSortType
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'update:modelValue', value: CallRecordSortType): void
  (e: 'select', value: CallRecordSortType): void
}>()

const sortOptions: { value: CallRecordSortType; label: string; desc: string }[] = [
  { value: 'timeDesc', label: '按时间 (从新到旧)', desc: '最新通话排在最前面' },
  { value: 'timeAsc', label: '按时间 (从旧到新)', desc: '最早通话排在最前面' },
  { value: 'durationDesc', label: '按时长 (从长到短)', desc: '通话时间最长的排在最前' },
  { value: 'durationAsc', label: '按时长 (从短到长)', desc: '通话时间最短的排在最前' }
]

const handleSelect = (value: CallRecordSortType) => {
  emit('update:modelValue', value)
  emit('select', value)
  emit('close')
}
</script>

<template>
  <transition name="modal-fade">
    <div v-if="show" class="modal-overlay" @click.self="emit('close')">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="modal-title">排序方式</div>
          <button class="close-btn" @click="emit('close')" aria-label="关闭">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="options-list">
            <div
              v-for="item in sortOptions"
              :key="item.value"
              class="option-item"
              :class="{ active: modelValue === item.value }"
              @click="handleSelect(item.value)"
            >
              <div class="option-info">
                <span class="option-label">{{ item.label }}</span>
                <span class="option-desc">{{ item.desc }}</span>
              </div>
              <div class="option-check" v-if="modelValue === item.value">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
  padding: 20px;
}

.modal-content {
  background: #ffffff;
  border-radius: 16px;
  width: 100%;
  max-width: 340px;
  overflow: hidden;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  transform-origin: center center;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.modal-title {
  font-size: 16px;
  font-weight: 600;
  color: #333333;
}

.close-btn {
  background: none;
  border: none;
  color: #999999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  margin: -4px;
  border-radius: 6px;
  transition: color 0.15s, background-color 0.15s;
}

.close-btn:hover {
  color: #555555;
  background-color: rgba(0, 0, 0, 0.04);
}

.modal-body {
  padding: 12px 16px 16px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-radius: 12px;
  background: #f7f8fa;
  cursor: pointer;
  border: 1.5px solid transparent;
  transition: all 0.2s ease;
}

.option-item:hover {
  background: #f0f2f5;
}

.option-item.active {
  background: rgba(255, 182, 193, 0.12);
  border-color: var(--theme-color, #FFB6C1);
}

.option-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-label {
  font-size: 14px;
  font-weight: 500;
  color: #333333;
}

.option-item.active .option-label {
  color: var(--theme-color, #e06d86);
  font-weight: 600;
}

.option-desc {
  font-size: 12px;
  color: #8c939d;
}

.option-check {
  color: var(--theme-color, #e06d86);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}

/* 动效 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.22s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-active .modal-content {
  animation: modalPopIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-fade-leave-active .modal-content {
  animation: modalPopOut 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes modalPopIn {
  from {
    transform: scale(0.92);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes modalPopOut {
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.92);
    opacity: 0;
  }
}

/* 深色模式兼容 */
:global(body.dark-theme) .modal-content {
  background: #232326;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
}

:global(body.dark-theme) .modal-header {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

:global(body.dark-theme) .modal-title {
  color: #f0f0f0;
}

:global(body.dark-theme) .close-btn {
  color: #888888;
}

:global(body.dark-theme) .close-btn:hover {
  color: #cccccc;
  background-color: rgba(255, 255, 255, 0.08);
}

:global(body.dark-theme) .option-item {
  background: #2b2b2f;
}

:global(body.dark-theme) .option-item:hover {
  background: #343439;
}

:global(body.dark-theme) .option-label {
  color: #e5e5e5;
}

:global(body.dark-theme) .option-desc {
  color: #808085;
}
</style>
