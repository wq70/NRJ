/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    userTime?: string
    characterTime?: string
    characterName?: string
  }>(),
  {
    modelValue: '',
    userTime: '',
    characterTime: '',
    characterName: '角色'
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'back'): void
}>()

// --- 本地手机电量逻辑 ---
const batteryLevel = ref<number>(100)
const isCharging = ref<boolean>(false)
let batteryManager: any = null

const updateBatteryInfo = (bm: any) => {
  if (!bm) return
  batteryLevel.value = Math.round(bm.level * 100)
  isCharging.value = Boolean(bm.charging)
}

const onLevelChange = () => {
  if (batteryManager) updateBatteryInfo(batteryManager)
}

const onChargingChange = () => {
  if (batteryManager) updateBatteryInfo(batteryManager)
}

onMounted(async () => {
  try {
    const nav = navigator as any
    if (nav && typeof nav.getBattery === 'function') {
      batteryManager = await nav.getBattery()
      updateBatteryInfo(batteryManager)
      batteryManager.addEventListener('levelchange', onLevelChange)
      batteryManager.addEventListener('chargingchange', onChargingChange)
    }
  } catch (err) {
    // 忽略不支持 Battery API 的报错
  }
})

onUnmounted(() => {
  if (batteryManager) {
    try {
      batteryManager.removeEventListener('levelchange', onLevelChange)
      batteryManager.removeEventListener('chargingchange', onChargingChange)
    } catch {}
    batteryManager = null
  }
})

// --- 时间切换逻辑（用户 / 角色） ---
const timeTarget = ref<'user' | 'character'>('user')

const toggleTimeTarget = () => {
  timeTarget.value = timeTarget.value === 'user' ? 'character' : 'user'
}

// 格式化获取当前本地备用时间 (HH:mm)
const getLocalTime = () => {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

const displayedTime = computed(() => {
  if (timeTarget.value === 'user') {
    return props.userTime || getLocalTime()
  }
  return props.characterTime || props.userTime || getLocalTime()
})

const searchInputRef = ref<HTMLInputElement | null>(null)
</script>

<template>
  <div class="chat-settings-top-widget-bar">
    <!-- 左侧：电量模块 (点击退出返回) -->
    <div class="top-widget-col col-left" @click="emit('back')" title="点击返回">
      <div class="widget-unit">
        <span class="widget-main-val">{{ batteryLevel }}%</span>
        <svg v-if="isCharging" class="charging-icon" viewBox="0 0 24 24" width="10" height="10" fill="currentColor">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
        <span class="widget-sub-label">电量</span>
      </div>
    </div>

    <!-- 中间：自然空出，仅放搜索 SVG 与轻量输入 -->
    <div class="top-widget-col col-center" @click="searchInputRef?.focus()">
      <div class="widget-search-clean">
        <svg class="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="#6898d5" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          ref="searchInputRef"
          type="text"
          class="widget-search-input"
          :value="modelValue"
          @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          placeholder="搜索"
        />
        <div
          v-if="modelValue"
          class="clear-search-btn"
          @click.stop="emit('update:modelValue', '')"
        >
          ×
        </div>
      </div>
    </div>

    <!-- 右侧：时间模块 (固定“时间”标签，点击切换 用户 / 角色时间) -->
    <div class="top-widget-col col-right" @click="toggleTimeTarget" :title="`当前为${timeTarget === 'user' ? '用户' : '角色'}时间，点击切换`">
      <div class="widget-unit">
        <span class="widget-main-val">{{ displayedTime }}</span>
        <span class="widget-sub-label">时间</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-settings-top-widget-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px 8px;
  min-height: 40px;
  box-sizing: border-box;
  background: transparent;
  user-select: none;
  width: 100%;
}

/* 三栏均分布局 */
.top-widget-col {
  flex: 1;
  display: flex;
  align-items: center;
}

.col-left {
  justify-content: flex-start;
  cursor: pointer;
}

.col-center {
  justify-content: center;
}

.col-right {
  justify-content: flex-end;
  cursor: pointer;
}

/* 图1比例小组件：蓝字 + 灰字 */
.widget-unit {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  transition: opacity 0.15s ease;
}

.col-left:active .widget-unit,
.col-right:active .widget-unit {
  opacity: 0.6;
}

.widget-main-val {
  font-size: 13.5px;
  font-weight: 500;
  color: #5c97d8;
  letter-spacing: -0.2px;
  line-height: 1;
}

.charging-icon {
  color: #48bb78;
  align-self: center;
}

.widget-sub-label {
  font-size: 11.5px;
  color: #8e8e93;
  line-height: 1;
  font-weight: 400;
}

/* 中间极简无灰色背景搜索交互 */
.widget-search-clean {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 70px;
  max-width: 140px;
  background: transparent;
}

.search-icon {
  color: #5c97d8;
  flex-shrink: 0;
  opacity: 0.85;
}

.widget-search-input {
  width: 48px;
  border: none;
  background: transparent;
  outline: none;
  font-size: 12px;
  color: var(--text-primary, #1c1c1e);
  padding: 0;
  transition: width 0.2s ease;
}

.widget-search-input::placeholder {
  color: #999999;
  font-size: 11.5px;
}

.widget-search-input:focus,
.widget-search-input:not(:placeholder-shown) {
  width: 90px;
}

.clear-search-btn {
  font-size: 15px;
  color: #8e8e93;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-search-btn:hover {
  color: var(--text-primary, #1c1c1e);
}
</style>
