/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { globalSettings } from '../store'
import { useMusicPlayer } from '../composables/useMusicPlayer'

defineProps<{
  isDark?: boolean
}>()

const emit = defineEmits<{
  (e: 'open-app', appId: string): void
}>()

const { 
  currentTrack, 
  isPlaying, 
  isBuffering, 
  currentTime: musicCurrentTime, 
  progressPercent, 
  currentLyricIndex,
  isLikedCurrent,
  togglePlay, 
  toggleLike,
  nextTrack, 
  prevTrack, 
  clearQueue,
  seek,
  formatTime 
} = useMusicPlayer()

const currentLyricText = computed(() => {
  if (!currentTrack.value) return ''
  const lyrics = currentTrack.value.lyrics
  if (!lyrics || !lyrics.length) return ''
  if (currentLyricIndex.value >= 0 && currentLyricIndex.value < lyrics.length) {
    return lyrics[currentLyricIndex.value].text || ''
  }
  return ''
})

const currentTime = ref('')
const isExpanded = ref(false)
const notchRef = ref<HTMLElement | null>(null)
let timer: ReturnType<typeof setInterval>

const remainingTimeStr = computed(() => {
  const duration = currentTrack.value?.duration || 0
  const rem = Math.max(0, duration - musicCurrentTime.value)
  return `-${formatTime(rem)}`
})

const handleProgressBarClick = (e: MouseEvent) => {
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement
  if (!target || !currentTrack.value?.duration) return
  const rect = target.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  seek(ratio * currentTrack.value.duration)
}

const batteryLevel = ref(100)
const isCharging = ref(false)

const batteryWidth = computed(() => {
  return (batteryLevel.value / 100) * 17
})

const batteryColor = computed(() => {
  if (isCharging.value) return '#4ade80'
  if (batteryLevel.value <= 20) return '#ef4444'
  return 'currentColor'
})

interface BatteryManager extends EventTarget {
  charging: boolean;
  level: number;
}
declare global {
  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
  }
}

const updateTime = () => {
  const now = new Date()
  const hours = now.getHours().toString().padStart(2, '0')
  const minutes = now.getMinutes().toString().padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`
}

const handleClickOutside = (event: MouseEvent) => {
  if (!isExpanded.value || !notchRef.value) return
  const path = event.composedPath ? event.composedPath() : []
  if (path.length > 0) {
    if (!path.includes(notchRef.value)) {
      isExpanded.value = false
    }
  } else if (!notchRef.value.contains(event.target as Node)) {
    isExpanded.value = false
  }
}

const handleOpenMusic = () => {
  isExpanded.value = false
  emit('open-app', 'music')
}

const handlePrev = (e: MouseEvent) => {
  e.stopPropagation()
  prevTrack()
}

const handleTogglePlay = (e: MouseEvent) => {
  e.stopPropagation()
  togglePlay()
}

const handleNext = (e: MouseEvent) => {
  e.stopPropagation()
  nextTrack()
}

const handleDismissMusic = (e: MouseEvent) => {
  e.stopPropagation()
  clearQueue()
  isExpanded.value = false
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  updateTime()
  timer = setInterval(updateTime, 1000)

  if (navigator.getBattery) {
    navigator.getBattery().then((battery) => {
      batteryLevel.value = battery.level * 100
      isCharging.value = battery.charging

      battery.addEventListener('levelchange', () => {
        batteryLevel.value = battery.level * 100
      })
      battery.addEventListener('chargingchange', () => {
        isCharging.value = battery.charging
      })
    }).catch(err => {
      console.log('Battery API not supported or accessible', err)
    })
  }
})

onUnmounted(() => {
  clearInterval(timer)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="status-bar" :class="{ 'dark-mode': isDark }">
    <div class="time">{{ currentTime }}</div>
    <div 
      class="notch" 
      ref="notchRef" 
      :class="{ expanded: isExpanded, 'has-music': !!currentTrack, 'is-playing': isPlaying }" 
      v-if="globalSettings.showNotch" 
      @click="isExpanded = !isExpanded"
    >
      <!-- 未展开状态下的紧凑音乐指示器（有音乐时显示封面与跳动声波） -->
      <div class="notch-compact-music" :class="{ 'is-hidden': isExpanded }">
        <template v-if="currentTrack">
          <div class="compact-cover" :style="currentTrack.coverUrl ? { backgroundImage: `url(${currentTrack.coverUrl})` } : {}">
            <svg v-if="!currentTrack.coverUrl" viewBox="0 0 24 24" width="10" height="10" fill="white">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"/>
            </svg>
          </div>
          <div class="music-wave mini" :class="{ 'is-active': isPlaying }">
            <span></span><span></span><span></span>
          </div>
        </template>
      </div>

      <!-- 展开后的灵动岛大卡片 (1:1 iOS 原生音乐岛) -->
      <div class="notch-content" :class="{ show: isExpanded }">
        <!-- 顶部信息行：封面 + 歌曲歌手 + 声波 -->
        <div class="notch-top-row">
          <div class="notch-main-info" @click.stop="handleOpenMusic">
            <div class="music-cover" :style="currentTrack?.coverUrl ? { backgroundImage: `url(${currentTrack.coverUrl})` } : {}">
              <svg v-if="!currentTrack?.coverUrl" viewBox="0 0 24 24" width="22" height="22" fill="white">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </div>
            <div class="notch-track-details">
              <div class="track-title">{{ isBuffering ? '正在缓冲…' : (currentTrack?.title || 'Love OS 音乐') }}</div>
              <div class="track-artist">{{ currentTrack?.artist || '点击进入播放器' }}</div>
              <div class="track-lyric" v-if="currentLyricText" :key="currentLyricText">
                {{ currentLyricText }}
              </div>
            </div>
          </div>
          <div class="music-wave expanded-wave" :class="{ 'is-active': isPlaying }" @click.stop="handleOpenMusic">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        </div>

        <!-- 中部时间与胶囊进度条 -->
        <div class="notch-progress-row">
          <span class="time-label">{{ formatTime(musicCurrentTime) }}</span>
          <div class="progress-bar-wrapper" @click="handleProgressBarClick">
            <div class="progress-bar-track">
              <div class="progress-bar-fill" :style="{ width: `${progressPercent}%` }"></div>
            </div>
          </div>
          <span class="time-label">{{ remainingTimeStr }}</span>
        </div>

        <!-- 底部控制栏：喜欢 + 上一首/播放暂停/下一首 + 结束播放 -->
        <div class="notch-bottom-row" @click.stop="">
          <!-- 喜欢/收藏星标 -->
          <button class="action-icon-btn star-btn" :class="{ 'is-liked': isLikedCurrent }" @click="toggleLike" title="收藏">
            <svg viewBox="0 0 24 24" width="20" height="20" :fill="isLikedCurrent ? '#ef4444' : 'none'" :stroke="isLikedCurrent ? '#ef4444' : 'currentColor'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>

          <!-- 中间三键播放控制 -->
          <div class="playback-controls">
            <button class="action-icon-btn nav-btn" @click="handlePrev" title="上一首">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/>
              </svg>
            </button>
            <button class="action-icon-btn play-main-btn" @click="handleTogglePlay" :title="isPlaying ? '暂停' : '播放'">
              <svg v-if="isPlaying" viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <rect x="5" y="4" width="4.5" height="16" rx="1.5"/>
                <rect x="14.5" y="4" width="4.5" height="16" rx="1.5"/>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                <path d="M7 4v16l13-8z"/>
              </svg>
            </button>
            <button class="action-icon-btn nav-btn" @click="handleNext" title="下一首">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/>
              </svg>
            </button>
          </div>

          <!-- 右侧结束当前歌曲，并恢复普通灵动岛 -->
          <button class="action-icon-btn dismiss-music-btn" @click="handleDismissMusic" title="结束播放">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="notch-sensor" v-if="!currentTrack || isExpanded"></div>
      <div class="notch-camera" v-if="!currentTrack || isExpanded"></div>
    </div>
    <div class="icons">
      <!-- 精细 WiFi (1:1 风格, 调整尺寸适应电池比例) -->
      <span class="icon svg-icon">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
          <path d="M12 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4.56-4.56a6.43 6.43 0 0 0-9.12 0 .75.75 0 0 1-1.06-1.06 7.93 7.93 0 0 1 11.24 0 .75.75 0 0 1-1.06 1.06zm3.18-3.18a10.93 10.93 0 0 0-15.48 0 .75.75 0 1 1-1.06-1.06 12.43 12.43 0 0 1 17.6 0 .75.75 0 0 1-1.06 1.06z"/>
        </svg>
      </span>
      <!-- 1:1 电池 (带外边框和电量块) -->
      <span class="icon svg-icon battery-container">
        <!-- 外部充电闪电 -->
        <svg v-if="isCharging && !globalSettings.chargingBoltInside" class="charging-bolt" viewBox="0 0 24 24" width="12" height="12" fill="#4ade80" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 2L3 14h7v8l11-12h-7V2z"/>
        </svg>
        <div class="battery-wrapper">
          <svg viewBox="0 0 24 12" width="26" height="13" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="20" height="11" rx="3.5" stroke="currentColor" stroke-width="1"/>
            <rect x="2" y="2" :width="batteryWidth" height="8" rx="1.5" :fill="batteryColor"/>
            <path d="M22 4.5C23 4.5 23 4.8 23 6C23 7.2 23 7.5 22 7.5V4.5Z" fill="currentColor"/>
          </svg>
          <!-- 内部充电闪电 -->
          <svg v-if="isCharging && globalSettings.chargingBoltInside" class="charging-bolt-inside" viewBox="0 0 24 24" width="10" height="10" fill="#fff" xmlns="http://www.w3.org/2000/svg">
            <path d="M13 2L3 14h7v8l11-12h-7V2z"/>
          </svg>
        </div>
      </span>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  height: var(--app-status-bar-height, 44px);
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 max(20px, var(--app-safe-right, 0px)) 0 max(20px, var(--app-safe-left, 0px));
  font-size: 14px;
  font-weight: 600;
  z-index: 100;
  color: var(--text-primary);
  transition: color 0.3s ease;
  position: absolute;
  top: var(--app-safe-top, 0px);
  left: 0;
}

.time {
  width: 60px;
}

/* 模拟刘海/灵动岛区域 */
.notch {
  width: 124px;
  height: 28px;
  background-color: #000000;
  border-radius: 14px;
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  box-shadow: 
    inset 0px 1px 2px rgba(255, 255, 255, 0.15),
    inset 0px -1px 2px rgba(255, 255, 255, 0.05);
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: pointer;
  z-index: 1000;
  user-select: none;
}

.notch.has-music:not(.expanded) {
  width: 176px;
}

.notch.expanded {
  width: min(336px, calc(100vw - var(--app-safe-left, 0px) - var(--app-safe-right, 0px) - 16px));
  height: 176px;
  border-radius: 38px;
  box-shadow: 
    inset 0px 1px 2px rgba(255, 255, 255, 0.22),
    inset 0px -1px 2px rgba(255, 255, 255, 0.06),
    0 16px 40px rgba(0, 0, 0, 0.68);
}

.notch-compact-music {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 9px;
  box-sizing: border-box;
  opacity: 1;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.notch-compact-music.is-hidden {
  opacity: 0;
}

.compact-cover {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.music-wave.mini {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 12px;
}

.music-wave.mini span {
  display: block;
  width: 2.5px;
  height: 3px;
  background-color: #32d74b;
  border-radius: 1px;
}

.music-wave.mini.is-active span {
  animation: wave 1.2s ease-in-out infinite;
}

.music-wave.mini span:nth-child(1) { animation-delay: 0.0s; }
.music-wave.mini span:nth-child(2) { animation-delay: 0.2s; }
.music-wave.mini span:nth-child(3) { animation-delay: 0.4s; }

@keyframes wave {
  0%, 100% { height: 3px; }
  50% { height: 11px; }
}

.notch-sensor {
  position: absolute;
  top: 14px;
  left: calc(50% - 35px);
  transform: translateY(-50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: radial-gradient(circle at center, #151515 0%, #000 80%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.05);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.notch-camera {
  position: absolute;
  top: 14px;
  right: calc(50% - 50px);
  transform: translateY(-50%);
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #1a1a24 0%, #000 70%);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.1);
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.notch.expanded .notch-sensor,
.notch.expanded .notch-camera {
  opacity: 0;
}

.notch-camera::after {
  content: '';
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: rgba(50, 120, 255, 0.35);
  top: 25%;
  left: 25%;
  filter: blur(0.5px);
}

.notch-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 20px 14px;
  box-sizing: border-box;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.notch-content.show {
  opacity: 1;
  transition: opacity 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) 0.12s;
  pointer-events: auto;
}

/* 顶部第一行 */
.notch-top-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 48px;
}

.notch-main-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.music-cover {
  width: 48px;
  height: 48px;
  background: linear-gradient(135deg, #2b3a4a 0%, #1e2630 100%);
  background-size: cover;
  background-position: center;
  border-radius: 12px;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
}

.notch-track-details {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  flex: 1;
  padding-right: 8px;
}

.track-title {
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-artist {
  color: rgba(255, 255, 255, 0.55);
  font-size: 12px;
  font-weight: 400;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-lyric {
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  animation: lyricFadeIn 0.3s ease-out;
  margin-top: 1px;
}

.expanded-wave {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  flex-shrink: 0;
  cursor: pointer;
}

.expanded-wave span {
  display: block;
  width: 3.5px;
  height: 5px;
  background-color: #3b82f6;
  border-radius: 2px;
}

.expanded-wave.is-active span {
  animation: expandedWaveAnim 1.2s ease-in-out infinite;
}

.expanded-wave span:nth-child(1) { animation-delay: 0.0s; }
.expanded-wave span:nth-child(2) { animation-delay: 0.25s; }
.expanded-wave span:nth-child(3) { animation-delay: 0.1s; }
.expanded-wave span:nth-child(4) { animation-delay: 0.35s; }
.expanded-wave span:nth-child(5) { animation-delay: 0.18s; }

@keyframes expandedWaveAnim {
  0%, 100% { height: 4px; }
  50% { height: 18px; }
}

/* 中部第二行：时间与进度条 */
.notch-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 4px 0 2px;
}

.time-label {
  color: rgba(255, 255, 255, 0.45);
  font-size: 11px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  width: 32px;
}

.time-label:last-child {
  text-align: right;
}

.progress-bar-wrapper {
  flex: 1;
  padding: 6px 0;
  cursor: pointer;
}

.progress-bar-track {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.16);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 3px;
  transition: width 0.2s linear;
}

/* 底部第三行：控制按钮 */
.notch-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.action-icon-btn {
  background: none;
  border: none;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 6px;
  border-radius: 50%;
  transition: transform 0.15s, opacity 0.15s;
}

.action-icon-btn:hover {
  opacity: 0.85;
}

.action-icon-btn:active {
  transform: scale(0.88);
}

.playback-controls {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-btn {
  opacity: 0.95;
}

.play-main-btn {
  padding: 4px;
  opacity: 1;
}

.star-btn {
  color: rgba(255, 255, 255, 0.6);
}

.star-btn.is-liked {
  color: #ef4444;
}

.dismiss-music-btn {
  color: rgba(255, 255, 255, 0.6);
}

@keyframes lyricFadeIn {
  from {
    opacity: 0.2;
    transform: translateY(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.icons {
  display: flex;
  gap: 5px;
  align-items: center;
}

.icon {
  font-size: 12px;
  display: flex;
  align-items: center;
}

.svg-icon {
  display: flex;
  align-items: center;
}

.text-icon {
  font-size: 12px;
  font-weight: 700;
}

.battery-container {
  display: flex;
  align-items: center;
  gap: 2px;
}

.battery-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.charging-bolt {
  margin-right: -2px;
}

.charging-bolt-inside {
  position: absolute;
  left: 6px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
</style>
