/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { registerMusicEmbedController, updateMusicEmbedState, type MusicEmbedController } from '../../composables/useMusicPlayer'

const props = defineProps<{ url: string; volume: number; title: string; quality: number }>()
const video = ref<HTMLVideoElement | null>(null)

const controller: MusicEmbedController = {
  async load(url, autoplay) {
    const element = video.value
    if (!element) throw new Error('视频播放器没有准备好')
    if (element.src !== url) {
      element.src = url
      element.load()
      await new Promise<void>((resolve, reject) => {
        const ready = () => { cleanup(); resolve() }
        const failed = () => { cleanup(); reject(new Error('视频地址无法加载')) }
        const cleanup = () => { element.removeEventListener('loadedmetadata', ready); element.removeEventListener('error', failed) }
        element.addEventListener('loadedmetadata', ready, { once: true })
        element.addEventListener('error', failed, { once: true })
      })
    }
    element.volume = props.volume
    if (autoplay) await element.play()
  },
  play() { void video.value?.play().catch(() => updateMusicEmbedState('error')) },
  pause() { video.value?.pause() },
  seek(seconds) { if (video.value && Number.isFinite(seconds)) video.value.currentTime = Math.max(0, seconds) },
  setVolume(value) { if (video.value) video.value.volume = value },
  destroy() { if (video.value) { video.value.pause(); video.value.removeAttribute('src'); video.value.load() } }
}

const requestFullscreen = () => { if (video.value?.requestFullscreen) void video.value.requestFullscreen() }
const requestPictureInPicture = () => {
  const element = video.value as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<unknown> }) | null
  if (element?.requestPictureInPicture) void element.requestPictureInPicture().catch(() => undefined)
}

watch(() => props.volume, value => controller.setVolume(value))
onMounted(() => registerMusicEmbedController(controller))
onBeforeUnmount(() => { registerMusicEmbedController(null); controller.destroy() })
</script>

<template>
  <div class="direct-video-shell">
    <video
      ref="video"
      playsinline
      preload="metadata"
      :aria-label="title"
      @play="updateMusicEmbedState('playing', video?.duration || 0, video?.currentTime || 0)"
      @pause="updateMusicEmbedState('paused', video?.duration || 0, video?.currentTime || 0)"
      @waiting="updateMusicEmbedState('buffering', video?.duration || 0, video?.currentTime || 0)"
      @canplay="updateMusicEmbedState(video?.paused ? 'paused' : 'playing', video?.duration || 0, video?.currentTime || 0)"
      @timeupdate="updateMusicEmbedState(video?.paused ? 'paused' : 'playing', video?.duration || 0, video?.currentTime || 0)"
      @ended="updateMusicEmbedState('ended', video?.duration || 0, video?.currentTime || 0)"
      @error="updateMusicEmbedState('error')"
      @dblclick="requestFullscreen"
    ></video>
    <div class="video-tools">
      <span v-if="quality">{{ quality }}P</span>
      <button type="button" title="画中画" aria-label="画中画" @click="requestPictureInPicture">▣</button>
      <button type="button" title="全屏播放" aria-label="全屏播放" @click="requestFullscreen">⛶</button>
    </div>
  </div>
</template>

<style scoped>
.direct-video-shell{position:relative;width:min(88vw,390px);overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:13px;background:#080808;box-shadow:0 14px 30px rgba(0,0,0,.22)}
.direct-video-shell video{display:block;width:100%;aspect-ratio:16/9;min-height:190px;max-height:42vh;background:#080808;object-fit:contain}
.video-tools{position:absolute;top:7px;right:7px;display:flex;align-items:center;gap:5px}
.video-tools span,.video-tools button{height:25px;border:1px solid rgba(255,255,255,.18);border-radius:8px;background:rgba(0,0,0,.5);color:#fff;backdrop-filter:blur(8px)}
.video-tools span{display:grid;place-items:center;padding:0 7px;font-size:8px}.video-tools button{width:27px;padding:0;font-size:13px}
@media(max-width:340px){.direct-video-shell{width:calc(100vw - 28px)}.direct-video-shell video{min-height:164px}}
</style>
