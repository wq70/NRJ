/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { chatSettings, globalSettings } from '../../../store'

const props = defineProps<{
  selectedChat: any
  currentChatWallpaper: string | null
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'show-transfer-preview'): void
  (e: 'show-bubble-beautify-modal'): void
  (e: 'show-avatar-display-modal'): void
  (e: 'show-name-display-modal'): void
  (e: 'show-time-display-modal'): void
  (e: 'trigger-wallpaper-upload'): void
  (e: 'clear-wallpaper'): void
  (e: 'save'): void
}>()

const handleSave = () => {
  emit('save')
}

const showScaleModal = ref(false)
const chatScaleOptions = [
  { label: '跟随全局外观设置', value: 0 },
  { label: '极小 (75%)', value: 0.75 },
  { label: '小 (80%)', value: 0.8 },
  { label: '稍小 (85%)', value: 0.85 },
  { label: '适中偏小 (90%)', value: 0.9 },
  { label: '微调 (95%)', value: 0.95 },
  { label: '标准 (100%)', value: 1.0 },
  { label: '微大 (105%)', value: 1.05 },
  { label: '较大 (110%)', value: 1.1 },
  { label: '超大 (120%)', value: 1.2 }
]

const currentScaleText = computed(() => {
  const s = Number(chatSettings.chatUiScale) || 0
  if (s <= 0) {
    const globalPercent = Math.round((globalSettings.uiScale || 1) * 100)
    return `跟随外观 (${globalPercent}%)`
  }
  return `${Math.round(s * 100)}% (独立)`
})

// 滑动条绑定百分比 (例如 100 表示 1.0)
const sliderPercent = ref(100)
const isFollowGlobal = ref(true)

const openScaleModal = () => {
  const s = Number(chatSettings.chatUiScale) || 0
  if (s <= 0) {
    isFollowGlobal.value = true
    sliderPercent.value = Math.round((globalSettings.uiScale || 1) * 100)
  } else {
    isFollowGlobal.value = false
    sliderPercent.value = Math.round(s * 100)
  }
  showScaleModal.value = true
}

// 预览缩放比例
const previewZoom = computed(() => {
  if (isFollowGlobal.value) {
    return (globalSettings.uiScale || 1)
  }
  return sliderPercent.value / 100
})

const onSliderInput = (val: number) => {
  isFollowGlobal.value = false
  sliderPercent.value = val
  chatSettings.chatUiScale = Math.round(val) / 100
  handleSave()
}

const adjustScale = (delta: number) => {
  isFollowGlobal.value = false
  const target = Math.max(70, Math.min(130, sliderPercent.value + delta))
  sliderPercent.value = target
  chatSettings.chatUiScale = Math.round(target) / 100
  handleSave()
}

const resetToGlobal = () => {
  isFollowGlobal.value = true
  chatSettings.chatUiScale = 0
  sliderPercent.value = Math.round((globalSettings.uiScale || 1) * 100)
  handleSave()
}

const resetToDefault = () => {
  isFollowGlobal.value = false
  sliderPercent.value = 100
  chatSettings.chatUiScale = 1.0
  handleSave()
}
</script>

<template>
  <div class="role-edit-section">
    <div class="glass-panel" v-show="matchSearch('聊天页面缩放', '聊天界面缩放', '聊天缩放', '页面大小')">
      <div class="glass-list-item" style="flex-direction: column; align-items: flex-start; padding: 12px 16px;" @click="openScaleModal">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="item-label">聊天页面缩放</div>
          <div class="item-value">
            <span class="item-value-text">{{ currentScaleText }}</span>
            <span class="arrow">></span>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4;">
          单独调整聊天窗口大小。若单独设定，优先级高于外观设置的全局调整。
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('红包与转账气泡风格')">
      <div class="glass-list-item" v-show="matchSearch('红包与转账气泡风格')" @click="emit('show-transfer-preview')">
        <div class="item-label">红包与转账气泡风格</div>
        <div class="item-value"><span class="item-value-text">{{ chatSettings.transferStyle === 'glass' ? '现代毛玻璃流体' : (chatSettings.transferStyle === 'ticket' ? '立式票据凭证' : '仿微信') }}</span><span class="arrow">></span></div>
      </div>
    </div>
      
    <div class="glass-panel" v-show="matchSearch('气泡美化', '思维链美化')">
      <div class="glass-list-item" v-show="matchSearch('气泡美化')" @click="emit('show-bubble-beautify-modal')">
        <div class="item-label">气泡样式</div>
        <div class="item-value">
          <span class="item-value-text">选择并应用预设</span>
          <span class="arrow">></span>
        </div>
      </div>
      
      <div class="glass-list-item" style="flex-direction: column; align-items: flex-start; padding: 12px 16px;" v-show="matchSearch('思维链美化')">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="item-label">思维链与正文合并</div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" :checked="chatSettings.cotInSameBubble" @change="(e) => { chatSettings.cotInSameBubble = (e.target as HTMLInputElement).checked; handleSave(); }">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4;">
          关闭时，思考过程将独立显示为简洁的虚线区块
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('对话头像显示', '对话昵称显示', '对话时间显示')">
      <div class="glass-list-item" v-show="matchSearch('对话头像显示')" @click="emit('show-avatar-display-modal')">
        <div class="item-label">对话头像显示</div>
        <div class="item-value">
          <span class="item-value-text">
            {{ chatSettings.avatarDisplayStyle === 'user_only' ? '只显示用户头像' : (chatSettings.avatarDisplayStyle === 'character_only' ? '只显示角色头像' : (chatSettings.avatarDisplayStyle === 'none' ? '不显示双方头像' : '都显示双方头像')) }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>

      <div class="glass-list-item" v-show="matchSearch('对话昵称显示')" @click="emit('show-name-display-modal')">
        <div class="item-label">对话昵称显示</div>
        <div class="item-value">
          <span class="item-value-text">
            {{ chatSettings.nameDisplayStyle === 'user_only' ? '只显示用户昵称' : (chatSettings.nameDisplayStyle === 'character_only' ? '只显示角色昵称' : (chatSettings.nameDisplayStyle === 'none' ? '不显示双方昵称' : '都显示双方昵称')) }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>

      <div class="glass-list-item" v-show="matchSearch('对话时间显示', '时间格式', '气泡时间')" @click="emit('show-time-display-modal')">
        <div class="item-label">对话时间显示</div>
        <div class="item-value">
          <span class="item-value-text">
            {{ chatSettings.timeDisplayStyle === 'none' ? '不显示' : (chatSettings.timeDisplayStyle === 'hm' ? '显示（时分）' : '显示（时分秒）') }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>

      <div class="glass-list-item" v-show="matchSearch('对话时间显示', '时间显示位置', '气泡显示时间', '对话时间位置')" @click="emit('show-time-display-modal')">
        <div class="item-label">气泡时间位置</div>
        <div class="item-value">
          <span class="item-value-text">
            {{
              chatSettings.timeDisplayPosition === 'bubble_outer' ? '气泡外侧' :
              chatSettings.timeDisplayPosition === 'name_side' ? '昵称旁边' :
              chatSettings.timeDisplayPosition === 'bubble_bottom' ? '气泡正下方' :
              chatSettings.timeDisplayPosition === 'bubble_inner' ? '气泡内部' : '头像下方'
            }}
          </span>
          <span class="arrow">></span>
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('显示回复耗时', '显示系统内部旁白', '系统旁白')">
      <div class="glass-list-item" v-show="matchSearch('显示回复耗时')">
        <div class="item-label">显示回复耗时</div>
        <div class="item-value">
          <label class="switch" @click.stop>
            <input type="checkbox" :checked="selectedChat.showCostTime !== false" @change="(e) => { selectedChat.showCostTime = (e.target as HTMLInputElement).checked; handleSave(); }">
            <span class="slider"></span>
          </label>
        </div>
      </div>
      <div class="glass-list-item" style="flex-direction: column; align-items: flex-start; padding: 12px 16px;" v-show="matchSearch('显示系统内部旁白', '系统旁白')">
        <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
          <div class="item-label">显示系统内部旁白</div>
          <div class="item-value">
            <label class="switch" @click.stop>
              <input type="checkbox" v-model="chatSettings.showSystemNarration">
              <span class="slider"></span>
            </label>
          </div>
        </div>
        <div style="font-size: 11px; color: var(--text-tertiary); margin-top: 4px; line-height: 1.4;">
          朋友圈读取、通话衔接等内部上下文默认隐藏
        </div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('专属聊天背景', '清除背景')">
      <div class="glass-list-item" v-show="matchSearch('专属聊天背景')" @click="emit('trigger-wallpaper-upload')">
        <div class="item-label">专属聊天背景</div>
        <div class="item-value">
          <span class="item-value-text" :style="{ color: currentChatWallpaper ? 'var(--text-primary)' : 'var(--text-tertiary)' }">{{ currentChatWallpaper ? '已设置' : '未设置' }}</span>
          <span class="arrow">></span>
        </div>
      </div>
      <div v-if="currentChatWallpaper" class="glass-list-item" v-show="matchSearch('清除背景')" @click="emit('clear-wallpaper')">
        <div class="item-label" style="color: #FF4D4F; width: 100%; text-align: center;">清除背景</div>
      </div>
    </div>

    <!-- 聊天缩放选择弹窗 -->
    <Teleport to="body">
      <div v-if="showScaleModal" class="wb-modal-overlay" style="z-index: 10001;" @click.self="showScaleModal = false">
        <div class="custom-confirm-modal scale-slider-modal" style="max-width: 350px; padding: 20px 18px 18px;">
          <div class="confirm-title" style="margin-bottom: 8px; font-size: 17px; font-weight: 600;">设置聊天页面缩放</div>
          <div style="font-size: 11px; color: var(--text-tertiary); margin-bottom: 14px; line-height: 1.4; text-align: center;">
            单独调整聊天页面大小时，优先覆盖外观设置中的全局缩放。
          </div>

          <!-- 实时预览区卡片 -->
          <div class="scale-preview-card">
            <div class="scale-preview-header">
              <span class="scale-preview-tag">实时效果预览</span>
              <span class="scale-preview-indicator">
                {{ isFollowGlobal ? `跟随外观 (${Math.round((globalSettings.uiScale || 1) * 100)}%)` : `${sliderPercent}%` }}
              </span>
            </div>
            <div class="scale-preview-viewport">
              <div class="scale-preview-chat-body" :style="{ transform: `scale(${previewZoom})`, transformOrigin: 'top center' }">
                <div class="preview-msg left">
                  <div class="preview-avatar">角</div>
                  <div class="preview-bubble">调节滑块，即刻预览效果～</div>
                </div>
                <div class="preview-msg right">
                  <div class="preview-bubble">聊天字号气泡都能放大缩小！</div>
                  <div class="preview-avatar">我</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 滑块调节区 -->
          <div class="scale-slider-container">
            <div class="scale-slider-row">
              <button class="scale-step-btn" @click="adjustScale(-5)" title="减小5%">-</button>
              <input 
                type="range" 
                min="70" 
                max="130" 
                step="1"
                :value="sliderPercent" 
                @input="onSliderInput(Number(($event.target as HTMLInputElement).value))"
                class="scale-range-input"
              />
              <button class="scale-step-btn" @click="adjustScale(5)" title="增加5%">+</button>
              <button 
                class="scale-step-btn scale-reset-btn" 
                :class="{ active: Math.abs(sliderPercent - 100) >= 1 || isFollowGlobal }"
                @click="resetToDefault" 
                title="重置回到 100%"
              >
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            </div>
            <div class="scale-slider-labels">
              <span>极小 70%</span>
              <span 
                class="scale-center-clickable"
                :class="{ 'scale-active-label': !isFollowGlobal && Math.abs(sliderPercent - 100) < 1 }"
                @click="resetToDefault"
                title="点击回到 100%"
              >标准 100%</span>
              <span>放大 130%</span>
            </div>
          </div>

          <!-- 重置与操作按钮 -->
          <div class="scale-actions-row">
            <button 
              class="scale-action-chip" 
              :class="{ active: isFollowGlobal }"
              @click="resetToGlobal"
            >
              重置（跟随外观）
            </button>
            <button 
              class="scale-action-chip"
              :class="{ active: !isFollowGlobal && Math.abs(sliderPercent - 100) < 1 }"
              @click="resetToDefault"
            >
              标准 (100%)
            </button>
          </div>

          <div class="scale-modal-footer" style="margin-top: 14px;">
            <button class="scale-confirm-btn" @click="showScaleModal = false">完成</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
@import './ChatSettingsStyles.css';
</style>
