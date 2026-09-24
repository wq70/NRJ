/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { globalSettings } from '../store'
import localforage from 'localforage'
import AppearanceWallpaperModal from './AppearanceWallpaperModal.vue'
import AppearanceAppIconModal from './AppearanceAppIconModal.vue'
import AppearanceFontModal from './AppearanceFontModal.vue'
import AppearanceWatermarkModal from './AppearanceWatermarkModal.vue'
import AvatarUploadModal from './AvatarUploadModal.vue'
import { useCustomFonts } from '../composables/useCustomFonts'
import { useWatermark } from '../composables/useWatermark'
import { getIosWebDisplayMode, isIosWebEnvironment } from '../utils/iosWeb'

const emit = defineEmits(['close'])
const { records: customFonts, initialize: initializeFonts } = useCustomFonts()
const { config: watermarkConfig, initialize: initializeWatermark } = useWatermark()


// 全局聊天背景
const showGlobalWallpaperModal = ref(false)
const globalChatWallpaper = ref<string | null>(null)
const wallpaperStore = localforage.createInstance({
  name: 'nrt-app',
  storeName: 'chatWallpapers'
})

// 加载全局聊天背景与水印
onMounted(async () => {
  await initializeFonts()
  await initializeWatermark()
  try {
    const globalWp = await wallpaperStore.getItem<string>('wallpaper_global')
    globalChatWallpaper.value = globalWp || null
  } catch (e) {
    console.error('Failed to load global wallpaper', e)
  }
})

const handleGlobalWallpaperSaved = async (url: string | null) => {
  try {
    globalChatWallpaper.value = url
    if (url) {
      await wallpaperStore.setItem('wallpaper_global', url)
    } else {
      await wallpaperStore.removeItem('wallpaper_global')
    }
  } catch (e) {
    console.error('Failed to save global wallpaper', e)
  }
}

const activeTab = ref('all') // 'all', 'display', 'personalize', 'lockscreen'
const showIosPwaFullscreenSetting = isIosWebEnvironment()
const iosWebDisplayMode = getIosWebDisplayMode()

const allSettingsData = computed(() => {
  const wallpaperItems: any[] = [
    { 
      id: 'wallpaper', 
      type: 'link', 
      label: '桌面壁纸', 
      valueText: '默认'
    },
    { 
      id: 'chatListWallpaper', 
      type: 'link', 
      label: '聊天列表壁纸', 
      valueText: '默认'
    },
    {
      id: 'globalChatWallpaper',
      type: 'link',
      label: '全局聊天室背景',
      valueText: globalChatWallpaper.value ? '已设置' : '默认'
    }
  ]

  const personalizeItems: any[] = [
    { 
      id: 'accent_color', 
      type: 'color', 
      label: '系统强调色', 
      colorValue: globalSettings.accentColor
    },
    {
      id: 'text_edit_focus_color',
      type: 'custom_color_reset',
      label: '输入框高亮光圈',
      description: '通用文本编辑弹窗选中时的光圈与边框色',
      colorValue: globalSettings.textEditFocusColor || '#3b82f6',
      canReset: (globalSettings.textEditFocusColor || '#3b82f6') !== '#3b82f6'
    },
    {
      id: 'app_icons',
      type: 'link',
      label: '自定义应用图标',
      valueText: '设置'
    },
    {
      id: 'custom_fonts',
      type: 'link',
      label: '自定义字体',
      valueText: customFonts.filter(font => font.enabled).length
        ? `已启用 ${customFonts.filter(font => font.enabled).length} 个`
        : '默认'
    },
    {
      id: 'screenshot_watermark',
      type: 'link',
      label: '界面截图水印',
      valueText: watermarkConfig.enabled ? '已启用' : '未开启'
    },
    {
      id: 'enableAvatarCrop',
      type: 'toggle',
      label: '上传头像时裁剪',
      value: globalSettings.enableAvatarCrop
    },
    {
      id: 'enableSlider',
      type: 'toggle',
      label: '侧边栏可拖拽',
      value: globalSettings.enableSlider
    },
    {
      id: 'sliderIcon',
      type: 'link',
      label: '侧边栏拖拽图标',
      valueText: globalSettings.sliderIcon
    },
    {
      id: 'disableBrowserAutofill',
      type: 'toggle',
      label: '禁止浏览器自动填入',
      value: globalSettings.disableBrowserAutofill
    }
  ]

  const lockScreenItems: any[] = [
    {
      id: 'enableLockScreen',
      type: 'toggle',
      label: '启用锁屏',
      value: globalSettings.enableLockScreen
    }
  ]

  if (globalSettings.enableLockScreen) {
    wallpaperItems.push({
      id: 'lockScreenWallpaper',
      type: 'link',
      label: '锁屏壁纸',
      valueText: '默认'
    })

    const unlockMethodNames: Record<string, string> = {
      swipe: '滑动解锁',
      digit: '数字密码',
      qa: '私密问答'
    }
    lockScreenItems.push({
      id: 'unlockMethod',
      type: 'link',
      label: '解锁方式',
      valueText: unlockMethodNames[globalSettings.unlockMethod] || '滑动解锁'
    })

    if (globalSettings.unlockMethod === 'digit') {
      lockScreenItems.push({
        id: 'unlockDigit',
        type: 'link',
        label: '数字密码',
        valueText: globalSettings.unlockDigit ? '已设置' : '未设置'
      })
    }

    if (globalSettings.unlockMethod === 'qa') {
      lockScreenItems.push({
        id: 'unlockQaQuestion',
        type: 'link',
        label: '专属问题',
        valueText: globalSettings.unlockQaQuestion || '未设置'
      })
      lockScreenItems.push({
        id: 'unlockQaAnswer',
        type: 'link',
        label: '正确答案',
        valueText: globalSettings.unlockQaAnswer ? '已隐藏' : '未设置'
      })
    }
  }

  const scalePercent = Math.round((globalSettings.uiScale || 1) * 100)
  const displayItems: any[] = [
    { id: 'darkMode', type: 'toggle', label: '夜间模式', value: globalSettings.darkMode },
    { id: 'nightShift', type: 'toggle', label: '护眼模式', value: globalSettings.nightShift },
    { id: 'uiScale', type: 'link', label: '界面缩放', valueText: `${scalePercent}%` },
    { id: 'showStatusBar', type: 'toggle', label: '显示状态栏', value: globalSettings.showStatusBar },
    { id: 'showNotch', type: 'toggle', label: '灵动岛', value: globalSettings.showNotch },
    { id: 'showDockAppNames', type: 'toggle', label: 'Dock应用名', value: globalSettings.showDockAppNames }
  ]

  if (showIosPwaFullscreenSetting) {
    displayItems.push({
      id: 'iosPwaFullscreen',
      type: 'toggle',
      label: 'iOS PWA 全屏',
      description: iosWebDisplayMode === 'standalone'
        ? '背景延伸至屏幕边缘，并避开时间、灵动岛与底部横条'
        : 'Safari 仅适配安全区；添加到主屏幕后可获得沉浸显示',
      value: globalSettings.iosPwaFullscreen
    })
  }

  return [
    {
      id: 'display',
      title: '显示',
      items: displayItems
    },
    {
      id: 'personalize',
      title: '个性化',
      items: personalizeItems
    },
    {
      id: 'wallpapers',
      title: '壁纸与背景',
      items: wallpaperItems
    },
    {
      id: 'lockscreen',
      title: '锁屏',
      items: lockScreenItems
    }
  ]
})

const displayedSettingsData = computed(() => {
  if (activeTab.value === 'all') return allSettingsData.value
  return allSettingsData.value.filter(group => group.id === activeTab.value)
})

// === 弹窗状态与逻辑 ===

// 壁纸
const showWallpaperModal = ref(false)
const wallpaperTarget = ref<'desktop' | 'lockscreen' | 'chatlist'>('desktop')

// 自定义应用图标与水印
const showAppIconModal = ref(false)
const showFontModal = ref(false)
const showWatermarkModal = ref(false)

// 强调色 (极简黑白灰阶)
const showColorModal = ref(false)
const colorOptions = [
  '#000000', // 纯黑
  '#1a1a1a', // 深黑
  '#333333', // 深灰
  '#666666', // 中灰
  '#999999', // 浅灰
  '#bbbbbb', // 亮灰
  '#dddddd', // 银灰
  '#f0f0f0'  // 近白
]
const applyAccentColor = (color: string) => {
  globalSettings.accentColor = color
  showColorModal.value = false
}

// 解锁方式
const showUnlockMethodModal = ref(false)
const unlockMethodOptions = [
  { id: 'swipe', name: '滑动解锁' },
  { id: 'digit', name: '数字密码' },
  { id: 'qa', name: '私密问答' }
]
const applyUnlockMethod = (methodId: string) => {
  globalSettings.unlockMethod = methodId
  showUnlockMethodModal.value = false
}

// 滑块图标
const showSliderIconModal = ref(false)
const sliderIconOptions = ['⚬', '・', '✦', '✧', '⊹', '♡', '☁', '✐']
const applySliderIcon = (icon: string) => {
  globalSettings.sliderIcon = icon
  showSliderIconModal.value = false
}

// 界面缩放弹窗（滑动条 + 实时预览 + 重置）
const showScaleModal = ref(false)
const sliderScalePercent = ref(100)

const openScaleModal = () => {
  sliderScalePercent.value = Math.round((globalSettings.uiScale || 1) * 100)
  showScaleModal.value = true
}

const onScaleSliderInput = (val: number) => {
  sliderScalePercent.value = val
  globalSettings.uiScale = Math.round(val) / 100
}

const adjustUiScale = (delta: number) => {
  const target = Math.max(70, Math.min(130, sliderScalePercent.value + delta))
  sliderScalePercent.value = target
  globalSettings.uiScale = Math.round(target) / 100
}

const resetUiScale = () => {
  sliderScalePercent.value = 100
  globalSettings.uiScale = 1.0
}

// 输入弹窗
const showInputModal = ref(false)
const inputModalTitle = ref('')
const inputModalValue = ref('')
const inputModalTarget = ref('') // 'digit', 'qa_q', 'qa_a', 'idName', 'idDesc'
const inputModalError = ref('')

const openInputModal = (target: string, title: string, currentValue: string) => {
  inputModalTarget.value = target
  inputModalTitle.value = title
  inputModalValue.value = currentValue
  inputModalError.value = ''
  showInputModal.value = true
}

const handleInputModalSubmit = async () => {
  if (inputModalTarget.value === 'digit') {
    if (!inputModalValue.value) {
      inputModalError.value = '不可以为空哦'
      return
    }
    if (!/^\d+$/.test(inputModalValue.value)) {
      inputModalError.value = '只能填写数字'
      return
    }
    globalSettings.unlockDigit = inputModalValue.value
  } else if (inputModalTarget.value === 'qa_q') {
    if (!inputModalValue.value.trim()) {
      inputModalError.value = '不可以为空哦'
      return
    }
    globalSettings.unlockQaQuestion = inputModalValue.value.trim()
  } else if (inputModalTarget.value === 'qa_a') {
    if (!inputModalValue.value.trim()) {
      inputModalError.value = '不可以为空哦'
      return
    }
    globalSettings.unlockQaAnswer = inputModalValue.value.trim()
  }
  showInputModal.value = false
}


// 点击项目分发
const handleItemClick = (item: any) => {
  if (item.type === 'toggle') {
    if (['darkMode', 'nightShift', 'showStatusBar', 'showNotch', 'iosPwaFullscreen', 'chargingBoltInside', 'enableAvatarCrop', 'enableSlider', 'showDockAppNames', 'enableLockScreen', 'disableBrowserAutofill'].includes(item.id)) {
      (globalSettings as any)[item.id] = !item.value
    }
  } else if (item.id === 'uiScale') {
    openScaleModal()
  } else if (item.id === 'wallpaper') {
    wallpaperTarget.value = 'desktop'
    showWallpaperModal.value = true
  } else if (item.id === 'chatListWallpaper') {
    wallpaperTarget.value = 'chatlist'
    showWallpaperModal.value = true
  } else if (item.id === 'globalChatWallpaper') {
    showGlobalWallpaperModal.value = true
  } else if (item.id === 'lockScreenWallpaper') {
    wallpaperTarget.value = 'lockscreen'
    showWallpaperModal.value = true
  } else if (item.id === 'accent_color') {
    showColorModal.value = true
  } else if (item.id === 'app_icons') {
    showAppIconModal.value = true
  } else if (item.id === 'custom_fonts') {
    showFontModal.value = true
  } else if (item.id === 'screenshot_watermark') {
    showWatermarkModal.value = true
  } else if (item.id === 'sliderIcon') {
    showSliderIconModal.value = true
  } else if (item.id === 'unlockMethod') {
    showUnlockMethodModal.value = true
  } else if (item.id === 'unlockDigit') {
    openInputModal('digit', '设置密码', globalSettings.unlockDigit)
  } else if (item.id === 'unlockQaQuestion') {
    openInputModal('qa_q', '提个问题', globalSettings.unlockQaQuestion)
  } else if (item.id === 'unlockQaAnswer') {
    openInputModal('qa_a', '正确答案', globalSettings.unlockQaAnswer)
  }
}
</script>

<template>
  <div class="soft-appearance-container">
    <!-- 独立的装饰层（手账素材） -->
    <div class="deco-layer">
      <div class="deco-bg"></div>
      
      <!-- 弥散渐变水蓝背景层 -->
      <div class="gradient-overlay"></div>

      <!-- 装饰性返回视觉 (解耦了真正的点击) -->
      <div class="deco-back-visual">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span class="back-text">RETURN</span>
      </div>

    </div>

    <!-- 交互与内容层 -->
    <div class="interactive-layer">
      <!-- 真实的不可见返回触控区 -->
      <div class="back-touch-zone" @click="emit('close')"></div>

      <div class="fixed-header-container">
        
        <!-- 页面标题：强化高级排版 -->
        <div class="page-title-area">
          <div class="title-deco-line"></div>
          <h1 class="page-title">外观设置</h1>
          <p class="page-subtitle">Appearance / Settings</p>
        </div>

        <!-- 书签导航 Tab -->
        <div class="sticky-tab-container">
          <div class="book-tabs">
            <div class="book-tab-item" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">全部</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'display' }" @click="activeTab = 'display'">显示</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'personalize' }" @click="activeTab = 'personalize'">个性化</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'wallpapers' }" @click="activeTab = 'wallpapers'">壁纸</div>
            <div class="book-tab-item" :class="{ active: activeTab === 'lockscreen' }" @click="activeTab = 'lockscreen'">锁屏</div>
          </div>
        </div>
      </div>

      <div class="scroll-container">
        <div class="settings-card book-style" v-for="group in displayedSettingsData" :key="group.id">
          <div class="card-header">
            <span class="card-title-text">{{ group.title }}</span>
            <div class="card-title-line"></div>
          </div>
          <div class="settings-list">
            <div class="setting-item" v-for="item in group.items" :key="item.id" @click="handleItemClick(item)">
              <span class="item-copy">
                <span class="item-label">{{ item.label }}</span>
                <small v-if="item.description" class="item-description">{{ item.description }}</small>
              </span>
              <div class="item-control">
                <template v-if="item.type === 'toggle'">
                  <div class="soft-toggle" :class="{ 'is-active': item.value }">
                    <div class="soft-toggle-knob"></div>
                  </div>
                </template>
                <template v-else-if="item.type === 'link'">
                  <span class="soft-value">{{ item.valueText }}</span>
                </template>
                <template v-else-if="item.type === 'color'">
                  <div class="soft-color-preview">
                    <div class="color-dot" :style="{ background: item.colorValue }"></div>
                  </div>
                </template>
                <template v-else-if="item.type === 'custom_color_reset'">
                  <div class="focus-color-control" @click.stop>
                    <label class="native-color-picker-label" title="点击更改光圈颜色">
                      <input 
                        type="color" 
                        class="hidden-color-input"
                        :value="item.colorValue" 
                        @input="e => globalSettings.textEditFocusColor = (e.target as HTMLInputElement).value"
                      />
                      <div class="color-circle-preview" :style="{ backgroundColor: item.colorValue }"></div>
                    </label>
                    <button 
                      v-if="item.canReset"
                      type="button" 
                      class="color-reset-btn"
                      title="恢复默认淡蓝色"
                      @click="globalSettings.textEditFocusColor = '#3b82f6'"
                    >
                      重置
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </div>
        
        <div class="bottom-spacer"></div>
      </div>
    </div>

    <!-- 自定义图标弹窗 -->
    <AppearanceAppIconModal
      v-model:visible="showAppIconModal"
    />

    <AppearanceFontModal
      v-model:visible="showFontModal"
    />

    <!-- 界面截图水印弹窗 -->
    <AppearanceWatermarkModal
      v-model:visible="showWatermarkModal"
    />

    <!-- 壁纸弹窗 (保持复用) -->
    <AppearanceWallpaperModal
      v-model:visible="showWallpaperModal"
      current-style="ins"
      :target="wallpaperTarget"
    />

    <!-- 毛玻璃界面缩放弹窗 (滑动条 + 实时预览 + 重置) -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showScaleModal" @click="showScaleModal = false">
        <div class="soft-modal-panel scale-slider-soft-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">界面缩放</span>
            <button class="close-btn" @click="showScaleModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div class="scale-soft-content">
            <div class="scale-soft-status">
              <span class="scale-soft-tag">全屏实时预览中</span>
              <span class="scale-soft-val">{{ sliderScalePercent }}%</span>
            </div>

            <!-- 滑动条区域 -->
            <div class="scale-soft-slider-row">
              <button class="scale-soft-btn" @click="adjustUiScale(-5)" title="缩小5%">-</button>
              <input 
                type="range" 
                min="70" 
                max="130" 
                step="1"
                :value="sliderScalePercent" 
                @input="onScaleSliderInput(Number(($event.target as HTMLInputElement).value))"
                class="scale-soft-range"
              />
              <button class="scale-soft-btn" @click="adjustUiScale(5)" title="放大5%">+</button>
            </div>

            <div class="scale-soft-range-labels">
              <span>极小 70%</span>
              <span :class="{ 'active-label': Math.abs(sliderScalePercent - 100) < 1 }">标准 100%</span>
              <span>放大 130%</span>
            </div>

            <div class="scale-soft-hint">
              拖动滑块时整个系统界面即刻同步缩放。
            </div>

            <!-- 按钮操作区 -->
            <div class="scale-soft-actions">
              <button 
                class="scale-soft-reset-btn" 
                :class="{ disabled: Math.abs(sliderScalePercent - 100) < 1 }"
                @click="resetUiScale"
              >
                重置为 100%
              </button>
              <button class="scale-soft-done-btn" @click="showScaleModal = false">
                完成
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃颜色选择弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showColorModal" @click="showColorModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">选择强调色</span>
            <button class="close-btn" @click="showColorModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-color-grid">
            <div 
              class="soft-color-item" 
              v-for="color in colorOptions" 
              :key="color"
              :style="{ backgroundColor: color }"
              :class="{ active: globalSettings.accentColor === color }"
              @click="applyAccentColor(color)"
            ></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃解锁方式弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showUnlockMethodModal" @click="showUnlockMethodModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">解锁方式</span>
            <button class="close-btn" @click="showUnlockMethodModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-list">
            <div 
              class="soft-list-item" 
              v-for="method in unlockMethodOptions" 
              :key="method.id"
              @click="applyUnlockMethod(method.id)"
            >
              <span :class="{ 'is-selected': globalSettings.unlockMethod === method.id }">{{ method.name }}</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃滑块图标弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showSliderIconModal" @click="showSliderIconModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">侧边栏拖拽图标</span>
            <button class="close-btn" @click="showSliderIconModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-icon-grid">
            <div 
              class="soft-icon-item" 
              v-for="icon in sliderIconOptions" 
              :key="icon"
              :class="{ active: globalSettings.sliderIcon === icon }"
              @click="applySliderIcon(icon)"
            >
              {{ icon }}
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 毛玻璃输入弹窗 -->
    <Transition name="soft-fade">
      <div class="soft-modal-overlay" v-if="showInputModal" @click="showInputModal = false">
        <div class="soft-modal-panel" @click.stop>
          <div class="soft-modal-header">
            <span class="title">{{ inputModalTitle }}</span>
            <button class="close-btn" @click="showInputModal = false">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="soft-input-wrap">
            <input 
              type="text" 
              v-model="inputModalValue" 
              class="soft-input"
              :placeholder="inputModalTarget === 'digit' ? '填写数字' : '填写内容'"
              @keyup.enter="handleInputModalSubmit"
              @input="inputModalError = ''"
              autofocus
            />
            <div class="soft-error" v-if="inputModalError">{{ inputModalError }}</div>
          </div>
          <div class="soft-modal-actions">
            <button class="soft-btn-cancel" @click="showInputModal = false">取消</button>
            <button class="soft-btn-confirm" @click="handleInputModalSubmit">确认</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 头像上传弹窗：挂载到 body -->
    <Teleport to="body">
      <AvatarUploadModal
        v-model:visible="showGlobalWallpaperModal"
        :current-avatar="globalChatWallpaper"
        shape="wallpaper"
        title="设置全局聊天背景"
        @saved="handleGlobalWallpaperSaved"
      />
    </Teleport>

  </div>
</template>

<style scoped>
@import './AppearanceSettings.css';

.focus-color-control {
  display: flex;
  align-items: center;
  gap: 10px;
}

.native-color-picker-label {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hidden-color-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.color-circle-preview {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #ffffff;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.12);
  transition: transform 0.15s ease;
}

.color-circle-preview:hover {
  transform: scale(1.1);
}

.color-reset-btn {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-reset-btn:hover {
  background: #f3f4f6;
  color: var(--text-primary, #111827);
  border-color: #d1d5db;
}
</style>
