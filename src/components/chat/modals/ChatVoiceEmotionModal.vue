/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
const props = defineProps<{
  visible: boolean
  currentEmotion: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'select', value: string): void
}>()

const emotionOptions = [
  { value: '', label: '无 (默认)' },
  { value: 'happy', label: '开心 (happy)' },
  { value: 'sad', label: '悲伤 (sad)' },
  { value: 'angry', label: '生气 (angry)' }
]

const close = () => {
  emit('update:visible', false)
}

const handleSelect = (val: string) => {
  emit('select', val)
}
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay" style="z-index: 10010;" @click.self="close">
    <div class="custom-confirm-modal pure-white-modal" style="max-width: 320px; padding-bottom: 20px; background: #ffffff !important;">
      <div class="confirm-title" style="margin-bottom: 16px;">选择情感风格</div>
      <div style="padding: 0 16px; display: flex; flex-direction: column; gap: 8px;">
        <div 
          v-for="opt in emotionOptions" 
          :key="opt.value" 
          class="memory-type-item pure-white-item"
          :class="{ active: currentEmotion === opt.value }"
          @click="handleSelect(opt.value)"
          style="margin-bottom: 0;"
        >
          <div class="type-name" style="margin-bottom: 0;">{{ opt.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';

.pure-white-modal {
  background: #ffffff !important;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.12) !important;
  border: 1px solid rgba(0, 0, 0, 0.08) !important;
}

.pure-white-item {
  background: #ffffff !important;
  border: 1px solid rgba(0, 0, 0, 0.12) !important;
  transition: all 0.2s ease;
}

.pure-white-item:hover {
  border-color: rgba(0, 0, 0, 0.25) !important;
}

.pure-white-item.active {
  background: #ffffff !important;
  border: 1.5px solid var(--text-primary) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
</style>
