<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'

interface ExpireOption {
  value: string
  label: string
  desc: string
}

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'close'): void
}>()

const options: ExpireOption[] = [
  { value: 'none', label: '永久有效', desc: '不过期，适合长期保存与设备接力' },
  { value: '10m', label: '10 分钟', desc: '即时接力、临时传输保护' },
  { value: '1h', label: '1 小时', desc: '短时分享、临时内容中转' },
  { value: '1d', label: '24 小时', desc: '次日失效，更利于安全留存' }
]

// 解析初始的自定义时长
const isCustomInitial = props.modelValue.startsWith('custom:')
const parsedNum = isCustomInitial ? parseInt(props.modelValue.replace('custom:', ''), 10) : 3
const parsedUnit = isCustomInitial ? props.modelValue.slice(-1) as ('m' | 'h' | 'd') : 'd'

const isCustomMode = ref(isCustomInitial)
const customNum = ref(Number.isNaN(parsedNum) || parsedNum <= 0 ? 3 : parsedNum)
const customUnit = ref<'m' | 'h' | 'd'>(['m', 'h', 'd'].includes(parsedUnit) ? parsedUnit : 'd')

const previewExpireTime = computed(() => {
  const num = customNum.value
  if (!num || num <= 0) return '请输入有效数字'
  let ms = 0
  if (customUnit.value === 'm') ms = num * 60_000
  else if (customUnit.value === 'h') ms = num * 3_600_000
  else if (customUnit.value === 'd') ms = num * 86_400_000

  const target = new Date(Date.now() + ms)
  const month = target.getMonth() + 1
  const date = target.getDate()
  const hours = target.getHours().toString().padStart(2, '0')
  const minutes = target.getMinutes().toString().padStart(2, '0')
  return `预计在 ${month}月${date}日 ${hours}:${minutes} 过期`
})

const selectPreset = (value: string) => {
  isCustomMode.value = false
  emit('update:modelValue', value)
  emit('close')
}

const confirmCustom = () => {
  const num = Math.max(1, Math.min(customNum.value || 1, 999))
  const val = `custom:${num}${customUnit.value}`
  emit('update:modelValue', val)
  emit('close')
}
</script>

<template>
  <div class="expires-modal-layer" @click.self="emit('close')">
    <div class="expires-dialog" role="dialog" aria-modal="true" aria-labelledby="expires-modal-title">
      <header class="expires-header">
        <h3 id="expires-modal-title">选择有效时间</h3>
        <p>过期时间将写入投递包和识别口令</p>
      </header>

      <div class="expires-options-list">
        <!-- 预设选项 -->
        <button
          v-for="item in options"
          :key="item.value"
          type="button"
          class="expires-option-item"
          :class="{ active: !isCustomMode && modelValue === item.value }"
          @click="selectPreset(item.value)"
        >
          <div class="option-text">
            <span class="option-label">{{ item.label }}</span>
            <span class="option-desc">{{ item.desc }}</span>
          </div>
          <div class="option-indicator">
            <svg v-if="!isCustomMode && modelValue === item.value" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <polyline points="20 6 9 17 4 12" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </button>

        <!-- 自定义时间选项入口 -->
        <div class="custom-card-wrapper" :class="{ expanded: isCustomMode }">
          <button
            type="button"
            class="expires-option-item custom-trigger"
            :class="{ active: isCustomMode }"
            @click="isCustomMode = !isCustomMode"
          >
            <div class="option-text">
              <span class="option-label">自定义时间</span>
              <span class="option-desc">自行输入时长与单位（分钟、小时、天）</span>
            </div>
            <div class="option-indicator">
              <svg v-if="isCustomMode" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polyline points="20 6 9 17 4 12" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <svg v-else class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 18l6-6-6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </button>

          <!-- 自定义面板展开内容 -->
          <div v-if="isCustomMode" class="custom-inputs-box">
            <div class="custom-row">
              <input
                v-model.number="customNum"
                type="number"
                min="1"
                max="999"
                class="num-input"
                placeholder="数量"
              >
              <div class="unit-tabs">
                <button
                  type="button"
                  :class="{ active: customUnit === 'm' }"
                  @click="customUnit = 'm'"
                >分钟</button>
                <button
                  type="button"
                  :class="{ active: customUnit === 'h' }"
                  @click="customUnit = 'h'"
                >小时</button>
                <button
                  type="button"
                  :class="{ active: customUnit === 'd' }"
                  @click="customUnit = 'd'"
                >天</button>
              </div>
            </div>

            <div class="custom-preview">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke-width="1.8"/>
                <polyline points="12 6 12 12 16 14" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
              <span>{{ previewExpireTime }}</span>
            </div>

            <button type="button" class="apply-custom-btn" @click="confirmCustom">
              设定此自定义时间
            </button>
          </div>
        </div>
      </div>

      <footer class="expires-footer">
        <button type="button" class="cancel-btn" @click="emit('close')">
          取消
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
.expires-modal-layer {
  position: absolute;
  inset: 0;
  z-index: 135;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  padding: 16px;
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.expires-dialog {
  width: min(380px, calc(100% - 20px));
  max-height: min(680px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  background: var(--surface-card, #ffffff);
  border-radius: var(--radius-lg, 24px);
  box-shadow: var(--shadow-float, 0 16px 40px -6px rgba(0, 0, 0, 0.22));
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  overflow: hidden;
  animation: scaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
  from { transform: scale(0.93); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.expires-header {
  padding: 16px 20px 10px;
  border-bottom: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  text-align: center;
  flex-shrink: 0;
}

.expires-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main, #1d1d1f);
}

.expires-header p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--text-secondary, #86868b);
}

.expires-options-list {
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  overflow-y: auto;
  gap: 2px;
}

.expires-option-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: var(--radius-md, 16px);
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.expires-option-item:hover {
  background: var(--surface-subtle, #f5f5f7);
}

.expires-option-item:active {
  transform: scale(0.98);
}

.expires-option-item.active {
  background: var(--surface-subtle, #f5f5f7);
  border-color: var(--border-hairline, rgba(0, 0, 0, 0.06));
}

.option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.option-label {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-main, #1d1d1f);
}

.expires-option-item.active .option-label {
  color: var(--accent, #0071e3);
}

.option-desc {
  font-size: 11px;
  color: var(--text-secondary, #86868b);
}

.option-indicator {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent, #0071e3);
  flex-shrink: 0;
}

.option-indicator svg {
  width: 17px;
  height: 17px;
}

.option-indicator .chevron {
  width: 14px;
  height: 14px;
  color: var(--text-tertiary, #aeaeb2);
}

/* 自定义卡片与输入框 */
.custom-card-wrapper {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-md, 16px);
  transition: all 0.2s ease;
}

.custom-card-wrapper.expanded {
  background: var(--surface-subtle, #f5f5f7);
}

.custom-inputs-box {
  padding: 4px 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.custom-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.num-input {
  width: 80px;
  height: 38px;
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.1));
  border-radius: var(--radius-sm, 10px);
  padding: 0 10px;
  font-size: 14px;
  font-weight: 600;
  background: var(--surface-card, #ffffff);
  color: var(--text-main, #1d1d1f);
  outline: none;
  text-align: center;
}

.num-input:focus {
  border-color: var(--accent, #0071e3);
}

.unit-tabs {
  display: flex;
  flex: 1;
  background: var(--surface-card, #ffffff);
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-sm, 10px);
  padding: 3px;
  gap: 3px;
}

.unit-tabs button {
  flex: 1;
  height: 32px;
  border-radius: 8px;
  border: none;
  background: transparent;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #86868b);
  cursor: pointer;
  transition: all 0.15s ease;
}

.unit-tabs button.active {
  background: var(--surface-subtle, #f5f5f7);
  color: var(--accent, #0071e3);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.custom-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary, #86868b);
}

.custom-preview svg {
  width: 14px;
  height: 14px;
  stroke: var(--text-secondary, #86868b);
}

.apply-custom-btn {
  height: 38px;
  border-radius: var(--radius-pill, 9999px);
  border: none;
  background: #1d1d1f;
  color: #ffffff;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dark-mode .apply-custom-btn {
  background: #ffffff;
  color: #000000;
}

.apply-custom-btn:active {
  transform: scale(0.98);
}

.expires-footer {
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  flex-shrink: 0;
}

.cancel-btn {
  width: 100%;
  min-height: 40px;
  border-radius: var(--radius-pill, 9999px);
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  background: var(--surface-subtle, #f5f5f7);
  color: var(--text-secondary, #86868b);
  font-size: 13px;
  font-weight: 550;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-btn:hover {
  color: var(--text-main, #1d1d1f);
}

.cancel-btn:active {
  transform: scale(0.98);
}
</style>
