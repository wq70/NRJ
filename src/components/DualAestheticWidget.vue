/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { defaultWidgetConfig, useWidgetInstances, type DualAestheticWidgetConfig } from '../composables/useWidgetInstances'
import { useMusicPlayer } from '../composables/useMusicPlayer'
import type { MusicTrack } from '../types/music'
import localforage from 'localforage'

const props = withDefaults(
  defineProps<{
    instanceId?: string
    editing?: boolean
    // 兼容嵌入在人脉漫游页面中直接传参
    standalone?: boolean
    ownerChat?: any
    subAvatars?: string[]
    themeSong?: MusicTrack | null
  }>(),
  {
    instanceId: '',
    editing: false,
    standalone: false,
    ownerChat: null,
    subAvatars: () => [],
    themeSong: null
  }
)

// 桌面小组件实例持久化（如作为独立桌面组件运行时）
const { records, updateConfig } = useWidgetInstances()
const defaults = defaultWidgetConfig('dual-aesthetic') as DualAestheticWidgetConfig

const config = computed<DualAestheticWidgetConfig>(() => {
  if (props.standalone) {
    const avatar = props.ownerChat?.avatarUrl || ''
    const name = props.ownerChat?.remark || props.ownerChat?.name || 'My'
    return {
      greeting: 'Good afternoon',
      timeText: '',
      dateText: '',
      weekText: '',
      avatarUrl: avatar,
      batteryTitle: `${name}’s Phone battery`,
      batteryPercent: 100,
      circleAvatars: props.subAvatars.slice(0, 4),
      songTitle: 'Be around with you',
      songCover: avatar || 'public/dove.jpg',
      duration: '4:50',
      currentPosition: '2:46'
    }
  }
  return { ...defaults, ...(records[props.instanceId]?.config as Partial<DualAestheticWidgetConfig> | undefined) }
})

// 时间与问候自适应计算
const nowTime = ref('')
const nowDate = ref('')
const nowWeek = ref('')
const nowGreeting = ref('')

const updateTime = () => {
  const d = new Date()
  const hours = d.getHours()
  const mins = d.getMinutes()
  nowTime.value = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const date = String(d.getDate()).padStart(2, '0')
  nowDate.value = `${month}/${date}`
  const weeks = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  nowWeek.value = weeks[d.getDay()]
  if (hours >= 5 && hours < 12) nowGreeting.value = 'Good morning'
  else if (hours >= 12 && hours < 18) nowGreeting.value = 'Good afternoon'
  else nowGreeting.value = 'Good evening'
}

let timer: any = null
onMounted(() => {
  updateTime()
  timer = setInterval(updateTime, 1000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

// 音乐联动
const musicPlayer = useMusicPlayer()
const isPlaying = computed(() => {
  return musicPlayer.isPlaying.value
})

const displaySongTitle = computed(() => {
  if (musicPlayer.currentTrack.value?.title) {
    return musicPlayer.currentTrack.value.title
  }
  return (props.standalone && props.themeSong?.title) || config.value.songTitle || 'Be around with you'
})

const displayCover = computed(() => {
  if (musicPlayer.currentTrack.value?.coverUrl) {
    return musicPlayer.currentTrack.value.coverUrl
  }
  if (props.standalone && props.themeSong && !musicPlayer.currentTrack.value) return props.themeSong.coverUrl || ''
  return config.value.songCover || props.ownerChat?.avatarUrl || ''
})

const formatTime = (secs: number) => {
  if (!secs || isNaN(secs)) return '0:00'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const displayCurrentTime = computed(() => {
  if (musicPlayer.playbackDuration.value > 0) {
    return formatTime(musicPlayer.currentTime.value)
  }
  if (props.standalone && props.themeSong && !musicPlayer.currentTrack.value) return '0:00'
  return config.value.currentPosition || '2:46'
})

const displayDuration = computed(() => {
  if (musicPlayer.playbackDuration.value > 0) {
    return formatTime(musicPlayer.playbackDuration.value)
  }
  if (props.standalone && props.themeSong && !musicPlayer.currentTrack.value) return formatTime(props.themeSong.duration)
  return config.value.duration || '4:50'
})

const progressPercent = computed(() => {
  if (musicPlayer.playbackDuration.value > 0) {
    return musicPlayer.progressPercent.value
  }
  if (props.standalone && props.themeSong && !musicPlayer.currentTrack.value) return 0
  return 60
})

const togglePlay = () => {
  if (!musicPlayer.currentTrack.value && props.standalone && props.themeSong) {
    void musicPlayer.playTrack(props.themeSong)
    return
  }
  musicPlayer.togglePlay()
}

const prevTrack = () => {
  musicPlayer.prevTrack()
}

const nextTrack = () => {
  musicPlayer.nextTrack()
}

// 图片选择上传 (桌面组件编辑模式)
const pickSongCover = async () => {
  if (!props.editing || props.standalone) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = async (e: any) => {
    const file = e.target?.files?.[0]
    if (!file) return
    const store = localforage.createInstance({ name: 'nrt-app', storeName: 'widgetInstances' })
    const key = `widget_cover_${props.instanceId}_${Date.now()}`
    await store.setItem(key, file)
    const url = URL.createObjectURL(file)
    await updateConfig<DualAestheticWidgetConfig>(props.instanceId, { songCover: url })
  }
  input.click()
}
</script>

<template>
  <div class="aesthetic-dual-widget" :class="{ 'is-editing': editing, 'is-standalone': standalone }">
    <!-- 左侧信息区 (时钟、头像、电量、4小圆) -->
    <div class="aesthetic-left-panel">
      <!-- 问候语 -->
      <div class="greeting-row">
        <span class="greeting-text">{{ config.greeting || nowGreeting }}</span>
      </div>

      <!-- 时间大字 -->
      <div class="time-large">
        {{ nowTime || '12:30' }}
      </div>

      <!-- 用户圆形头像与日期星期 -->
      <div class="avatar-date-row">
        <div class="avatar-circle">
          <img v-if="config.avatarUrl || ownerChat?.avatarUrl" :src="config.avatarUrl || ownerChat?.avatarUrl" class="circle-img" alt="avatar" />
          <div v-else class="avatar-fallback">{{ (ownerChat?.name || '伴').slice(0, 1) }}</div>
        </div>
        <div class="date-col">
          <span class="date-text">{{ nowDate || '02/06' }}</span>
          <span class="week-text">{{ nowWeek || 'Wed' }}</span>
        </div>
      </div>

      <!-- 手机电量状态文本 -->
      <div class="battery-title-row">
        <span>{{ config.batteryTitle || 'Phone battery' }}</span>
      </div>

      <!-- 纯色电量胶囊进度条（无渐变） -->
      <div class="battery-bar-wrap">
        <div class="battery-bar-fill" :style="{ width: `${config.batteryPercent || 100}%` }">
          <span class="battery-percent-text">{{ config.batteryPercent || 100 }}%</span>
        </div>
      </div>

      <!-- 底部 4 个并排纯色小圆圈头像（人脉/代表） -->
      <div class="bottom-circles-row">
        <template v-if="config.circleAvatars && config.circleAvatars.length">
          <div v-for="(img, idx) in config.circleAvatars.slice(0, 4)" :key="idx" class="mini-avatar-item">
            <img v-if="img" :src="img" class="mini-avatar-img" />
            <div v-else class="mini-avatar-fallback">{{ idx + 1 }}</div>
          </div>
        </template>
        <template v-else>
          <div v-for="i in 4" :key="i" class="mini-avatar-item">
            <div class="mini-avatar-fallback dot-inner"></div>
          </div>
        </template>
      </div>
    </div>

    <!-- 右侧音乐播放器纯白精致卡片（1:1复刻样式） -->
    <div class="aesthetic-music-card">
      <!-- 封面图片 -->
      <div class="music-cover-box" @click="pickSongCover" :title="editing ? '点击更换封面' : ''">
        <img v-if="displayCover" :src="displayCover" class="music-cover-img" alt="cover" />
        <div v-else class="music-cover-placeholder">
          <svg viewBox="0 0 24 24" width="36" height="36" stroke="#94a3b8" stroke-width="1.6" fill="none">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </div>
      </div>

      <!-- 歌曲标题 -->
      <div class="music-title-box">
        <span class="music-title-text">{{ displaySongTitle }}</span>
      </div>

      <!-- 播放时间与细进度条 -->
      <div class="music-progress-section">
        <div class="music-track-bar">
          <div class="music-track-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
        <div class="music-time-row">
          <span class="music-time-cur">{{ displayCurrentTime }}</span>
          <span class="music-time-total">{{ displayDuration }}</span>
        </div>
      </div>

      <!-- 播放控制按键 (无 emoji，纯几何 SVG 拟物图标) -->
      <div class="music-controls-row">
        <!-- 上一首 -->
        <button type="button" class="ctrl-btn sub-ctrl" title="上一首" @click.stop="prevTrack">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
            <line x1="5" y1="19" x2="5" y2="5" />
          </svg>
        </button>

        <!-- 播放 / 暂停 -->
        <button type="button" class="ctrl-btn play-ctrl" title="播放 / 暂停" @click.stop="togglePlay">
          <svg v-if="isPlaying" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="10" y1="5" x2="10" y2="19" />
            <line x1="14" y1="5" x2="14" y2="19" />
          </svg>
          <svg v-else viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />
          </svg>
        </button>

        <!-- 下一首 -->
        <button type="button" class="ctrl-btn sub-ctrl" title="下一首" @click.stop="nextTrack">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
            <line x1="19" y1="5" x2="19" y2="19" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 整个组件外层：彻底杜绝背景色与渐变，纯白透亮 */
.aesthetic-dual-widget {
  position: relative;
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  background: transparent !important;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

/* 左侧布局 */
.aesthetic-left-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 0;
  padding: 4px 0 2px;
}

/* 顶部问候语 */
.greeting-row {
  line-height: 1.2;
}

.greeting-text {
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  letter-spacing: 0.2px;
}

/* 大号时钟 */
.time-large {
  font-size: 26px;
  font-weight: 600;
  color: #1e293b;
  letter-spacing: -0.5px;
  line-height: 1.1;
  margin: 3px 0 8px;
}

/* 圆形头像与日期 */
.avatar-date-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.avatar-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}

.circle-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
}

.date-col {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.date-text {
  font-size: 12px;
  font-weight: 500;
  color: #475569;
}

.week-text {
  font-size: 11px;
  color: #94a3b8;
}

/* 手机状态标题 */
.battery-title-row {
  font-size: 11px;
  color: #64748b;
  margin-bottom: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 纯色电量胶囊进度条（无渐变，采用纯正 Slate 蓝灰） */
.battery-bar-wrap {
  width: 100%;
  height: 20px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  margin-bottom: 14px;
}

.battery-bar-fill {
  height: 100%;
  background: #64748b; /* 纯色，坚决不带渐变 */
  border-radius: 999px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  box-sizing: border-box;
  transition: width 0.3s ease;
}

.battery-percent-text {
  font-size: 10.5px;
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.3px;
}

/* 底部 4 个并排小圆圈 */
.bottom-circles-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.mini-avatar-item {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.mini-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mini-avatar-fallback {
  width: 100%;
  height: 100%;
  background: #f1f5f9;
  font-size: 10px;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dot-inner {
  background: #cbd5e1;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* 右侧音乐卡片：纯白、极简线条、极轻柔阴影 */
.aesthetic-music-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  box-sizing: border-box;
}

/* 封面图片 */
.music-cover-box {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 14px;
  overflow: hidden;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.music-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.music-cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 歌曲标题 */
.music-title-box {
  margin-top: 9px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.music-title-text {
  font-size: 12.5px;
  font-weight: 500;
  color: #334155;
  letter-spacing: 0.2px;
}

/* 进度条与时间 */
.music-progress-section {
  margin-top: 8px;
}

.music-track-bar {
  width: 100%;
  height: 3px;
  background: #e2e8f0;
  border-radius: 2px;
  overflow: hidden;
  position: relative;
}

.music-track-fill {
  height: 100%;
  background: #64748b; /* 纯色 */
  border-radius: 2px;
}

.music-time-row {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
  font-size: 9.5px;
  color: #94a3b8;
  font-family: monospace;
}

/* 拟物按钮行 */
.music-controls-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 6px;
}

.ctrl-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  transition: transform 0.15s ease, color 0.15s ease;
}

.ctrl-btn:hover {
  color: #0f172a;
}

.ctrl-btn:active {
  transform: scale(0.92);
}

.play-ctrl {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #334155;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
}

.play-ctrl:hover {
  background: #f1f5f9;
}

@media (max-width: 380px) {
  .aesthetic-dual-widget {
    gap: 10px;
  }
  .time-large {
    font-size: 22px;
  }
  .music-controls-row {
    gap: 8px;
  }
}
</style>
