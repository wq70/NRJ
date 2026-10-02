<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { DanmakuComment, DanmakuSettings } from '../../types/danmaku'
const props = defineProps<{ comments: DanmakuComment[]; settings: DanmakuSettings; playback: number; pause: boolean }>()
const cursor = ref(0)
const layerRef = ref<HTMLElement | null>(null)
const width = ref(240)
let observer: ResizeObserver | null = null
watch(layerRef, element => {
  observer?.disconnect()
  if (!element) return
  width.value = element.clientWidth
  observer = new ResizeObserver(entries => { width.value = entries[0]?.contentRect.width || element.clientWidth })
  observer.observe(element)
})
let timer: ReturnType<typeof setTimeout> | null = null
const visible = computed(() => {
  const ordinary = props.comments.filter(c=>!c.pinned).slice(-24)
  return [...props.comments.filter(c=>c.pinned).slice(-1),...ordinary.slice(cursor.value,cursor.value+props.settings.maxOnScreen)].slice(0,props.settings.maxOnScreen)
})
const tick = () => {
  if(timer)clearTimeout(timer)
  if(props.pause || props.settings.paused || !props.settings.visible)return
  timer=setTimeout(()=>{cursor.value=(cursor.value+props.settings.maxOnScreen)%Math.max(1,props.comments.filter(c=>!c.pinned).slice(-24).length);tick()},props.settings.speed*1000)
}
watch(()=>[props.comments.map(c=>c.id).join(','),props.playback],()=>{cursor.value=Math.max(0,props.comments.filter(c=>!c.pinned).slice(-24).length-props.settings.maxOnScreen);tick()},{immediate:true})
watch(()=>[props.pause,props.settings.paused,props.settings.speed,props.settings.visible],tick)
onBeforeUnmount(()=>{if(timer)clearTimeout(timer);observer?.disconnect()})
</script>
<template>
  <div v-if="settings.enabled && settings.visible && settings.display!=='list'" ref="layerRef" class="dm-layer" :class="{'dm-scrolling':settings.display==='scroll' && !settings.reduceMotion,'dm-paused':pause||settings.paused}" :style="{fontSize:`${settings.fontSize}px`,opacity:settings.opacity,'--dm-duration':`${settings.speed}s`,'--dm-width':`${width}px`}" aria-live="off">
    <div v-for="comment in visible" :key="`${comment.id}:${playback}:${cursor}`" class="dm-line" :style="{color:settings.color||comment.color}"><span v-if="settings.showNames">{{comment.viewerName}}：</span>{{comment.text}}</div>
    <span v-if="!comments.length" class="dm-layer-empty">观众已入席 · 点击观众席生成评论</span>
  </div>
</template>
