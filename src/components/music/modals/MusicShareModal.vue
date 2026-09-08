/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import type { MusicTrack } from '../../../types/music'
import { useMusicLibrary } from '../../../composables/useMusicLibrary'
import { useMusicPlayer } from '../../../composables/useMusicPlayer'

const props = defineProps<{
  visible: boolean
  track: MusicTrack | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { setMessage } = useMusicLibrary()
const { currentLyricIndex, preferredQuality } = useMusicPlayer()

const isGeneratingCard = ref(false)
const copiedType = ref<string | null>(null)
let copyTimer: number | null = null

const currentLyric = computed(() => {
  if (!props.track || !props.track.lyrics || props.track.lyrics.length === 0) return null
  const activeIdx = currentLyricIndex.value
  if (activeIdx >= 0 && activeIdx < props.track.lyrics.length) {
    const l = props.track.lyrics[activeIdx]
    if (l && l.text.trim()) return l
  }
  // 选取第1句非空歌词
  return props.track.lyrics.find(item => item.text.trim().length > 0) || null
})

const qualityLabel = computed(() => {
  const map: Record<string, string> = {
    standard: '标准音质',
    higher: '高品质 192K',
    exhigh: '极高 320K',
    lossless: '无损 FLAC',
    hires: 'Hi-Res 高解析'
  }
  return map[preferredQuality.value] || '高品质'
})

const shareUrl = computed(() => {
  if (!props.track) return window.location.href
  return props.track.externalUrl || window.location.href
})

const shareContentText = computed(() => {
  if (!props.track) return ''
  const lyricPart = currentLyric.value ? `\n“${currentLyric.value.text}”` : ''
  return `🎵 推荐歌曲：《${props.track.title}》- ${props.track.artist || '独奏'}${lyricPart}\n🔗 试听链接：${shareUrl.value}`
})

const triggerCopyAnim = (type: string) => {
  copiedType.value = type
  if (copyTimer !== null) clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => {
    copiedType.value = null
  }, 2000)
}

// 复制普通歌曲链接
const handleCopyLink = async () => {
  if (!props.track) return
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    triggerCopyAnim('link')
    setMessage('歌曲链接已复制到剪贴板')
  } catch {
    setMessage('复制链接失败，请手动复制')
  }
}

// 复制图文格式文案
const handleCopyText = async () => {
  if (!props.track) return
  try {
    await navigator.clipboard.writeText(shareContentText.value)
    triggerCopyAnim('text')
    setMessage('分享文案已复制')
  } catch {
    setMessage('复制失败，请重试')
  }
}

// 系统原生分享
const handleNativeShare = async () => {
  if (!props.track) return
  if (navigator.share) {
    try {
      await navigator.share({
        title: props.track.title,
        text: `《${props.track.title}》 - ${props.track.artist || '独奏'}`,
        url: shareUrl.value
      })
    } catch {
      // 用户取消分享无需处理
    }
  } else {
    await handleCopyText()
  }
}

// 绘制并生成海报图片
const handleSavePoster = async () => {
  if (!props.track || isGeneratingCard.value) return
  isGeneratingCard.value = true

  try {
    const canvas = document.createElement('canvas')
    const width = 750
    const height = 1100
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      setMessage('生成海报失败')
      isGeneratingCard.value = false
      return
    }

    // 绘制背景渐变
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, '#1c1b24')
    bgGrad.addColorStop(0.5, '#121217')
    bgGrad.addColorStop(1, '#09090b')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // 顶部柔光微弱白光晕
    const glowGrad = ctx.createRadialGradient(width / 2, 280, 20, width / 2, 280, 420)
    glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)')
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = glowGrad
    ctx.fillRect(0, 0, width, 700)

    // 绘制封面
    let coverImg: HTMLImageElement | null = null
    if (props.track.coverUrl) {
      coverImg = await new Promise<HTMLImageElement | null>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => resolve(img)
        img.onerror = () => resolve(null)
        img.src = props.track?.coverUrl || ''
      })
    }

    const coverSize = 420
    const coverX = (width - coverSize) / 2
    const coverY = 120
    const radius = 24

    ctx.save()
    // 封面圆角裁剪与阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
    ctx.shadowBlur = 38
    ctx.shadowOffsetY = 18

    ctx.beginPath()
    ctx.moveTo(coverX + radius, coverY)
    ctx.lineTo(coverX + coverSize - radius, coverY)
    ctx.quadraticCurveTo(coverX + coverSize, coverY, coverX + coverSize, coverY + radius)
    ctx.lineTo(coverX + coverSize, coverY + coverSize - radius)
    ctx.quadraticCurveTo(coverX + coverSize, coverY + coverSize, coverX + coverSize - radius, coverY + coverSize)
    ctx.lineTo(coverX + radius, coverY + coverSize)
    ctx.quadraticCurveTo(coverX, coverY + coverSize, coverX, coverY + coverSize - radius)
    ctx.lineTo(coverX, coverY + radius)
    ctx.quadraticCurveTo(coverX, coverY, coverX + radius, coverY)
    ctx.closePath()
    ctx.fillStyle = '#22222a'
    ctx.fill()
    ctx.clip()

    if (coverImg) {
      ctx.drawImage(coverImg, coverX, coverY, coverSize, coverSize)
    } else {
      ctx.fillStyle = '#2c2c34'
      ctx.fillRect(coverX, coverY, coverSize, coverSize)
      ctx.fillStyle = '#8e8e93'
      ctx.font = 'bold 36px -apple-system, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('MUSIC', width / 2, coverY + coverSize / 2 + 12)
    }
    ctx.restore()

    // 绘制歌曲名
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    ctx.textAlign = 'center'
    const titleText = props.track.title.length > 20 ? props.track.title.slice(0, 19) + '…' : props.track.title
    ctx.fillText(titleText, width / 2, 630)

    // 绘制歌手名
    ctx.fillStyle = '#a1a1aa'
    ctx.font = '24px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText(props.track.artist || '独奏', width / 2, 680)

    // 绘制装饰分割线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(width / 2 - 120, 725)
    ctx.lineTo(width / 2 + 120, 725)
    ctx.stroke()

    // 绘制精选歌词
    if (currentLyric.value) {
      ctx.fillStyle = '#e4e4e7'
      ctx.font = 'italic 26px -apple-system, serif, sans-serif'
      ctx.fillText(`“${currentLyric.value.text}”`, width / 2, 785)
      if (currentLyric.value.translation) {
        ctx.fillStyle = '#9ca3af'
        ctx.font = '20px -apple-system, sans-serif'
        ctx.fillText(currentLyric.value.translation, width / 2, 825)
      }
    }

    // 底部专属卡片信息
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
    ctx.font = '20px -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('· 正在分享此刻心动旋律 ·', width / 2, 990)

    // 导出并触发下载/复制
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${props.track.title}_音乐卡片.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    triggerCopyAnim('poster')
    setMessage('海报已生成并开始下载')
  } catch (err) {
    console.error(err)
    setMessage('海报生成失败')
  } finally {
    isGeneratingCard.value = false
  }
}
</script>

<template>
  <div v-if="visible" class="share-modal-overlay" @click.self="emit('close')">
    <div class="share-dialog-card" @click.stop>
      <!-- 头部 -->
      <header class="share-header">
        <div class="header-main">
          <span class="header-tag">MUSIC SHARE</span>
          <h3 class="share-title">分享音乐</h3>
        </div>
        <button class="modal-close-btn" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>

      <!-- 歌曲预览小卡片 -->
      <div class="track-preview-box" v-if="track">
        <div class="preview-cover-wrap">
          <img
            v-if="track.coverUrl"
            :src="track.coverUrl"
            :alt="track.title"
            class="preview-cover-img"
          />
          <div v-else class="preview-cover-fallback">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <div class="cover-vinyl-badge"></div>
        </div>

        <div class="preview-meta">
          <div class="meta-title" :title="track.title">{{ track.title }}</div>
          <div class="meta-artist">{{ track.artist || '独奏' }}</div>
          <div class="meta-badges">
            <span class="meta-badge quality">{{ qualityLabel }}</span>
            <span class="meta-badge duration" v-if="track.duration">
              {{ Math.floor(track.duration / 60) }}:{{ String(Math.floor(track.duration % 60)).padStart(2, '0') }}
            </span>
          </div>
        </div>
      </div>

      <!-- 歌词高光寄语 (若存在) -->
      <div class="lyric-highlight-bar" v-if="currentLyric">
        <svg viewBox="0 0 24 24" width="14" height="14" class="quote-icon" fill="currentColor">
          <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
        </svg>
        <span class="lyric-text-line">{{ currentLyric.text }}</span>
      </div>

      <!-- 操作分享网格 -->
      <div class="share-actions-grid">
        <!-- 复制链接 -->
        <button class="action-card-btn" @click="handleCopyLink">
          <div class="action-icon-circle" :class="{ 'is-active': copiedType === 'link' }">
            <svg v-if="copiedType === 'link'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <span class="action-name">{{ copiedType === 'link' ? '已复制' : '复制链接' }}</span>
          <small class="action-desc">单曲直达链接</small>
        </button>

        <!-- 复制图文文案 -->
        <button class="action-card-btn" @click="handleCopyText">
          <div class="action-icon-circle" :class="{ 'is-active': copiedType === 'text' }">
            <svg v-if="copiedType === 'text'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </div>
          <span class="action-name">{{ copiedType === 'text' ? '已复制' : '分享文案' }}</span>
          <small class="action-desc">精排版图文</small>
        </button>

        <!-- 生成音乐卡片海报 -->
        <button class="action-card-btn" :disabled="isGeneratingCard" @click="handleSavePoster">
          <div class="action-icon-circle" :class="{ 'is-active': copiedType === 'poster' }">
            <svg v-if="copiedType === 'poster'" viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <svg v-else viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
          </div>
          <span class="action-name">{{ isGeneratingCard ? '生成中…' : '音乐海报' }}</span>
          <small class="action-desc">精美唱片卡片</small>
        </button>

        <!-- 系统分享 -->
        <button class="action-card-btn" @click="handleNativeShare">
          <div class="action-icon-circle">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="18" cy="5" r="3"></circle>
              <circle cx="6" cy="12" r="3"></circle>
              <circle cx="18" cy="19" r="3"></circle>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
            </svg>
          </div>
          <span class="action-name">系统分享</span>
          <small class="action-desc">应用及好友</small>
        </button>
      </div>

      <!-- 底部提示 -->
      <p class="share-footer-hint">随时随地，与重要的人共享美好旋律</p>
    </div>
  </div>
</template>

<style scoped>
.share-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background-color: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.share-dialog-card {
  width: 100%;
  max-width: 390px;
  background-color: var(--music-card-bg, #ffffff);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
  border-radius: 26px;
  box-shadow: 0 24px 50px -12px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: popUp 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 22px 20px 20px;
  box-sizing: border-box;
}

/* 头部 */
.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-tag {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--music-text-sub, #64748b);
  text-transform: uppercase;
  opacity: 0.85;
}

.share-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--music-text, #1e293b);
  letter-spacing: -0.01em;
}

.modal-close-btn {
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
  transition: background-color 0.15s, transform 0.15s;
}

.modal-close-btn:active {
  transform: scale(0.92);
}

/* 歌曲预览卡片 */
.track-preview-box {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: var(--music-secondary-bg, #f8fafc);
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  border-radius: 18px;
  margin-bottom: 12px;
  position: relative;
  overflow: hidden;
}

.preview-cover-wrap {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  background: #18181b;
}

.preview-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-cover-fallback {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #71717a;
}

.cover-vinyl-badge {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.15);
  pointer-events: none;
}

.preview-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-title {
  font-size: 14.5px;
  font-weight: 650;
  color: var(--music-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-artist {
  font-size: 12px;
  color: var(--music-text-sub, #64748b);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.meta-badge {
  font-size: 9.5px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
}

.meta-badge.quality {
  background: var(--music-pill-bg, rgba(0, 0, 0, 0.06));
  color: var(--music-text, #334155);
  font-weight: 600;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.08));
}

.meta-badge.duration {
  background: var(--music-card-border, rgba(0, 0, 0, 0.05));
  color: var(--music-text-sub, #94a3b8);
  font-family: monospace;
}

/* 歌词卡片 */
.lyric-highlight-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 14px;
  background: var(--music-secondary-bg, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  margin-bottom: 16px;
}

.quote-icon {
  color: var(--music-text-sub, #8e8e93);
  flex-shrink: 0;
}

.lyric-text-line {
  font-size: 11.5px;
  color: var(--music-text, #334155);
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
}

/* 操作网格 */
.share-actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 14px;
}

.action-card-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 14px 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--music-card-border, rgba(0, 0, 0, 0.06));
  background: var(--music-secondary-bg, rgba(0, 0, 0, 0.02));
  color: var(--music-text, #1e293b);
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, transform 0.15s;
}

.action-card-btn:active {
  transform: scale(0.95);
  background-color: var(--music-btn-active, rgba(0, 0, 0, 0.05));
}

.action-card-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--music-card-bg, #ffffff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: grid;
  place-items: center;
  color: var(--music-text, #334155);
  margin-bottom: 8px;
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.action-icon-circle.is-active {
  background: var(--music-text, #1e293b);
  color: var(--music-card-bg, #ffffff);
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.action-name {
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.2;
}

.action-desc {
  font-size: 9px;
  color: var(--music-text-sub, #94a3b8);
  margin-top: 3px;
  white-space: nowrap;
}

.share-footer-hint {
  margin: 0;
  text-align: center;
  font-size: 10px;
  color: var(--music-text-sub, #94a3b8);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes popUp {
  from { opacity: 0; transform: scale(0.92) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
