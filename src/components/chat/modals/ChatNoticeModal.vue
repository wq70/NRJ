/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = withDefaults(defineProps<{
  visible: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}>(), {
  title: '提示',
  confirmText: '确定',
  cancelText: ''
})

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const handleClose = () => {
  emit('update:visible', false)
  emit('cancel')
}

const handleConfirm = () => {
  emit('update:visible', false)
  emit('confirm')
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div v-if="visible" class="notice-modal-mask" @click.self="handleClose">
        <div class="notice-modal-card">
          <div class="notice-modal-header">
            <h3 class="notice-modal-title">{{ title }}</h3>
          </div>
          
          <div class="notice-modal-body">
            <p class="notice-modal-text">{{ message }}</p>
          </div>

          <div class="notice-modal-footer">
            <button
              v-if="cancelText"
              type="button"
              class="notice-modal-btn notice-modal-btn-cancel"
              @click="handleClose"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              class="notice-modal-btn notice-modal-btn-confirm"
              @click="handleConfirm"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.notice-modal-mask {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
}

.notice-modal-card {
  width: 100%;
  max-width: 320px;
  background: #ffffff;
  border-radius: 20px;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: noticePopIn 0.26s cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
}

.notice-modal-header {
  padding: 22px 24px 8px;
  text-align: center;
}

.notice-modal-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
  letter-spacing: -0.02em;
}

.notice-modal-body {
  padding: 10px 24px 22px;
  text-align: center;
}

.notice-modal-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: #4b5563;
  word-break: break-word;
  white-space: pre-line;
}

.notice-modal-footer {
  display: flex;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: #fafafa;
}

.notice-modal-btn {
  flex: 1;
  height: 48px;
  border: none;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.notice-modal-btn:active {
  background: rgba(0, 0, 0, 0.05);
}

.notice-modal-btn-cancel {
  color: #6b7280;
  font-weight: 500;
  border-right: 1px solid rgba(0, 0, 0, 0.06);
}

.notice-modal-btn-confirm {
  color: #3b82f6;
  font-weight: 600;
}

.notice-modal-btn-confirm:active {
  color: #2563eb;
}

@keyframes noticePopIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
