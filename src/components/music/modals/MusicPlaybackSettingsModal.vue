/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MusicQuality, MusicVideoMode, MusicVideoQuality } from '../../../types/music'
import { useMusicPlayer } from '../../../composables/useMusicPlayer'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const {
  volume, preferredQuality, preferredVideoMode, preferredVideoQuality, videoDataSaver, sleepEndsAt,
  setVolume, setQuality, setVideoMode, setVideoQuality, setVideoDataSaver, setSleepTimer
} = useMusicPlayer()

const qualities: Array<{ id: MusicQuality; name: string; desc: string }> = [
  { id: 'standard', name: '标准', desc: '省流' },
  { id: 'higher', name: '较高', desc: '192k' },
  { id: 'exhigh', name: '极高', desc: '320k' },
  { id: 'lossless', name: '无损', desc: 'FLAC' },
  { id: 'hires', name: 'Hi-Res', desc: '极高音质' }
]

const timers = [
  { value: 0, label: '关闭' },
  { value: 15, label: '15分钟' },
  { value: 30, label: '30分钟' },
  { value: 60, label: '1小时' }
]
const videoModes: Array<{ id: MusicVideoMode; name: string; desc: string }> = [
  { id: 'off', name: '关闭', desc: '不查询' },
  { id: 'manual', name: '手动', desc: '点击播放' },
  { id: 'auto', name: '自动', desc: '匹配即播' }
]
const videoQualities: Array<{ id: MusicVideoQuality; name: string }> = [
  { id: 'auto', name: '自动' }, { id: '480', name: '480P' }, { id: '720', name: '720P' }, { id: '1080', name: '1080P' }
]
const videoModeText = computed(() => ({ off: '已关闭', manual: '手动开启', auto: '自动播放' })[preferredVideoMode.value])

const customMinutes = ref<number | ''>('')
const sleepText = computed(() => {
  if (sleepEndsAt.value > Date.now()) {
    const remain = Math.max(1, Math.ceil((sleepEndsAt.value - Date.now()) / 60000))
    return `${remain} 分钟后停止`
  }
  return '未设定'
})

const applyCustomTimer = () => {
  const val = Number(customMinutes.value)
  if (!Number.isFinite(val) || val <= 0) return
  const clamped = Math.min(1440, Math.max(1, Math.round(val)))
  setSleepTimer(clamped)
  customMinutes.value = ''
}
</script>

<template>
  <div v-if="visible" class="playback-mask" @click.self="emit('close')">
    <section class="playback-dialog" @click.stop>
      <!-- Header -->
      <header class="dialog-header">
        <div class="header-titles">
          <h3 class="main-title">播放设置</h3>
          <span class="sub-title">音质、画面、音量与定时停止</span>
        </div>
        <button class="close-btn" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <!-- Body Content -->
      <div class="dialog-body">
        <!-- Volume Section -->
        <div class="setting-card">
          <div class="card-header">
            <span class="card-label">音量输出</span>
            <div class="volume-action-group">
              <button class="pill-action-btn" @click="setVolume(0.85)">重置</button>
              <span class="value-badge">{{ Math.round(volume * 100) }}%</span>
            </div>
          </div>
          <div class="slider-wrapper">
            <input
              class="styled-range"
              type="range"
              min="0"
              max="1"
              step="0.01"
              :value="volume"
              @input="setVolume(Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>

        <!-- Audio Quality Section -->
        <div class="setting-card">
          <div class="card-header">
            <span class="card-label">在线音质</span>
            <span class="sub-badge">不支持时自动降级</span>
          </div>
          <div class="quality-selector">
            <button
              v-for="item in qualities"
              :key="item.id"
              class="quality-cell"
              :class="{ 'is-selected': preferredQuality === item.id }"
              @click="setQuality(item.id)"
            >
              <span class="quality-name">{{ item.name }}</span>
              <span class="quality-desc">{{ item.desc }}</span>
            </button>
          </div>
        </div>

        <div class="setting-card video-setting-card">
          <div class="card-header">
            <span class="card-label">MV 播放</span>
            <span class="sub-badge">{{ videoModeText }}</span>
          </div>
          <div class="video-mode-selector">
            <button v-for="item in videoModes" :key="item.id" type="button" class="video-mode-cell" :class="{ 'is-selected': preferredVideoMode === item.id }" @click="setVideoMode(item.id)">
              <span>{{ item.name }}</span><small>{{ item.desc }}</small>
            </button>
          </div>
          <div class="video-quality-row" :class="{ disabled: preferredVideoMode === 'off' }">
            <span>视频清晰度</span>
            <div>
              <button v-for="item in videoQualities" :key="item.id" type="button" :class="{ 'is-selected': preferredVideoQuality === item.id }" :disabled="preferredVideoMode === 'off'" @click="setVideoQuality(item.id)">{{ item.name }}</button>
            </div>
          </div>
          <button class="data-saver-row" type="button" :disabled="preferredVideoMode === 'off'" @click="setVideoDataSaver(!videoDataSaver)">
            <span><b>省流模式</b><small>优先 480P，加载过慢时回到歌曲</small></span>
            <i :class="{ active: videoDataSaver }"><em></em></i>
          </button>
        </div>

        <!-- Sleep Timer Section -->
        <div class="setting-card">
          <div class="card-header">
            <span class="card-label">定时停止</span>
            <span class="status-indicator" :class="{ 'is-active': sleepEndsAt > Date.now() }">
              {{ sleepText }}
            </span>
          </div>

          <div class="timer-chips">
            <button
              v-for="item in timers"
              :key="item.value"
              class="chip-btn"
              @click="setSleepTimer(item.value)"
            >
              {{ item.label }}
            </button>
          </div>

          <div class="custom-timer-group">
            <div class="input-container">
              <input
                v-model.number="customMinutes"
                class="custom-timer-field"
                type="number"
                min="1"
                max="1440"
                placeholder="自定义时长 (1-1440 分钟)"
                @keydown.enter="applyCustomTimer"
              />
            </div>
            <button
              class="submit-timer-btn"
              :disabled="!customMinutes || Number(customMinutes) <= 0"
              @click="applyCustomTimer"
            >
              设定
            </button>
          </div>
        </div>

        <!-- Note Footer -->
        <p class="dialog-disclaimer">
          音质与 MV 清晰度以平台实际返回为准；视频不可播放时会自动继续播放歌曲。
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.playback-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeInMask 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.playback-dialog {
  width: 100%;
  max-width: 410px;
  background-color: var(--music-card-bg, #ffffff);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 24px;
  box-shadow: 0 20px 48px -10px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popInDialog 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 22px 14px;
  border-bottom: 1px solid var(--music-divider, rgba(0, 0, 0, 0.05));
}

.header-titles {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--music-text, #1e293b);
}

.sub-title {
  font-size: 11px;
  color: var(--music-text-sub, #64748b);
  font-weight: 400;
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  background-color: var(--music-pill-bg, rgba(0, 0, 0, 0.04));
  color: var(--music-text, #334155);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.close-btn:hover {
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.08));
}

.close-btn:active {
  transform: scale(0.92);
}

.dialog-body {
  padding: 16px 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 80vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.setting-card {
  padding: 14px 16px;
  border-radius: 16px;
  background-color: var(--music-secondary-bg, rgba(0, 0, 0, 0.025));
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.05));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-label {
  font-size: 13px;
  font-weight: 650;
  color: var(--music-text, #1e293b);
}

.volume-action-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-action-btn {
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text-sub, #64748b);
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}

.pill-action-btn:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.value-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--music-text, #334155);
  min-width: 32px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sub-badge {
  font-size: 10px;
  color: var(--music-text-sub, #94a3b8);
  font-weight: 400;
}

.status-indicator {
  font-size: 11px;
  color: var(--music-text-sub, #64748b);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  background-color: var(--music-pill-bg, rgba(0, 0, 0, 0.03));
}

.status-indicator.is-active {
  color: var(--music-text, #0f172a);
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.08));
  font-weight: 600;
}

.slider-wrapper {
  display: flex;
  align-items: center;
  width: 100%;
}

.styled-range {
  width: 100%;
  height: 6px;
  appearance: none;
  -webkit-appearance: none;
  border-radius: 999px;
  background-color: var(--music-card-border, rgba(0, 0, 0, 0.1));
  outline: none;
  cursor: pointer;
}

.styled-range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--music-text, #1e293b);
  border: 2.5px solid var(--music-card-bg, #ffffff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transition: transform 0.1s ease;
}

.styled-range::-webkit-slider-thumb:active {
  transform: scale(1.15);
}

.styled-range::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background-color: var(--music-text, #1e293b);
  border: 2.5px solid var(--music-card-bg, #ffffff);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.25);
  transition: transform 0.1s ease;
}

.quality-selector {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}

.quality-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 2px;
  border-radius: 10px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.07));
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #334155);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s, transform 0.15s;
}

.quality-cell:active {
  transform: scale(0.96);
}

.quality-cell.is-selected {
  background-color: var(--music-text, #0f172a);
  border-color: var(--music-text, #0f172a);
  color: var(--music-bg, #ffffff);
}

.quality-name {
  font-size: 11px;
  font-weight: 650;
  line-height: 1.2;
}

.quality-desc {
  font-size: 8.5px;
  margin-top: 3px;
  opacity: 0.65;
}

.video-setting-card{gap:10px}
.video-mode-selector{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.video-mode-cell{display:flex;min-width:0;height:43px;align-items:center;justify-content:center;flex-direction:column;gap:2px;border:1px solid var(--music-card-border,rgba(0,0,0,.07));border-radius:10px;background:var(--music-card-bg,#fff);color:var(--music-text,#334155)}
.video-mode-cell span{font-size:11px;font-weight:650}.video-mode-cell small{color:inherit;font-size:8px;opacity:.62}
.video-mode-cell.is-selected{border-color:var(--music-text,#0f172a);background:var(--music-text,#0f172a);color:var(--music-bg,#fff)}
.video-quality-row{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:8px}.video-quality-row>span{flex:none;color:var(--music-text-sub,#64748b);font-size:9.5px}.video-quality-row>div{display:flex;min-width:0;gap:4px}.video-quality-row button{min-width:0;height:27px;padding:0 7px;border:1px solid var(--music-card-border,rgba(0,0,0,.07));border-radius:8px;background:var(--music-card-bg,#fff);color:var(--music-text,#334155);font-size:8.5px;white-space:nowrap}.video-quality-row button.is-selected{border-color:var(--music-text,#0f172a);background:var(--music-text,#0f172a);color:var(--music-bg,#fff)}
.video-quality-row.disabled,.data-saver-row:disabled{opacity:.42}
.data-saver-row{display:flex;width:100%;min-width:0;align-items:center;gap:10px;padding:8px 0 0;border:0;border-top:1px solid var(--music-divider,rgba(0,0,0,.06));background:transparent;color:var(--music-text,#334155);text-align:left}.data-saver-row>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:2px}.data-saver-row b{font-size:10.5px}.data-saver-row small{overflow:hidden;color:var(--music-text-sub,#64748b);font-size:8.5px;text-overflow:ellipsis;white-space:nowrap}.data-saver-row i{position:relative;width:31px;height:18px;flex:none;border-radius:999px;background:var(--music-card-border,rgba(0,0,0,.12));transition:.18s}.data-saver-row i em{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--music-card-bg,#fff);box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.18s}.data-saver-row i.active{background:var(--music-text,#0f172a)}.data-saver-row i.active em{transform:translateX(13px)}

.timer-chips {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.chip-btn {
  padding: 8px 4px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.07));
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #334155);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, transform 0.15s;
  text-align: center;
}

.chip-btn:hover {
  border-color: var(--music-card-border, rgba(0, 0, 0, 0.18));
}

.chip-btn:active {
  transform: scale(0.96);
}

.custom-timer-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.input-container {
  flex: 1;
  min-width: 0;
}

.custom-timer-field {
  width: 100%;
  box-sizing: border-box;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.09));
  background-color: var(--music-card-bg, #ffffff);
  color: var(--music-text, #0f172a);
  font-size: 11.5px;
  outline: none;
  transition: border-color 0.15s;
}

.custom-timer-field:focus {
  border-color: var(--music-text, #0f172a);
}

.custom-timer-field::placeholder {
  color: var(--music-text-sub, #94a3b8);
  font-size: 10.5px;
}

.submit-timer-btn {
  height: 36px;
  padding: 0 16px;
  border-radius: 10px;
  border: none;
  background-color: var(--music-text, #0f172a);
  color: var(--music-bg, #ffffff);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s, transform 0.15s;
}

.submit-timer-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.submit-timer-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.dialog-disclaimer {
  margin: 2px 0 0;
  font-size: 9.5px;
  color: var(--music-text-sub, #94a3b8);
  line-height: 1.5;
  text-align: center;
}

@keyframes fadeInMask {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes popInDialog {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@media(max-width:340px){.playback-mask{padding:12px}.dialog-body{padding-left:14px;padding-right:14px}.setting-card{padding-left:12px;padding-right:12px}.video-quality-row button{padding:0 5px}.data-saver-row small{max-width:190px}}
</style>
