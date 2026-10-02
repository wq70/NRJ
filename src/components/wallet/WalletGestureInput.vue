<script setup lang="ts">
import { computed, ref } from 'vue'
import { appendWalletGesturePoint } from '../../services/walletService'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: string): void; (event: 'drawing', value: boolean): void }>()
const drawing = ref(false)
let pointerId: number | null = null
let stroke = ''
const cursor = ref<{ x: number; y: number } | null>(null)
const points = Array.from({ length: 9 }, (_, i) => ({ id: i + 1, x: 40 + i % 3 * 80, y: 40 + Math.floor(i / 3) * 80 }))
const path = computed(() => [...props.modelValue].map(id => points[Number(id) - 1]).filter(Boolean).map(p => `${p.x},${p.y}`).join(' '))
const last = computed(() => points[Number(props.modelValue.slice(-1)) - 1])
const position = (event: PointerEvent) => {
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect()
  return { x: (event.clientX - rect.left) / rect.width * 240, y: (event.clientY - rect.top) / rect.height * 240 }
}
const addAt = (p: { x: number; y: number }) => {
  const point = points.find(item => Math.hypot(item.x - p.x, item.y - p.y) <= 25)
  if (point) { stroke = appendWalletGesturePoint(stroke, point.id); emit('update:modelValue', stroke) }
}
const start = (event: PointerEvent) => {
  if (pointerId !== null || !event.isPrimary || event.button !== 0) return
  event.preventDefault()
  pointerId = event.pointerId
  ;(event.currentTarget as SVGElement).setPointerCapture(event.pointerId)
  stroke = ''; emit('update:modelValue', '')
  drawing.value = true; emit('drawing', true)
  cursor.value = position(event); addAt(cursor.value)
}
const move = (event: PointerEvent) => {
  if (!drawing.value || event.pointerId !== pointerId) return
  const p = position(event)
  addAt(p); cursor.value = p
}
const finish = (event: PointerEvent, cancelled = false) => {
  if (event.pointerId !== pointerId) return
  if (!cancelled) move(event)
  pointerId = null; drawing.value = false; cursor.value = null
  if (cancelled) emit('update:modelValue', '')
  emit('drawing', false)
}
const key = (event: KeyboardEvent) => {
  if (/^[1-9]$/.test(event.key)) { event.preventDefault(); emit('update:modelValue', appendWalletGesturePoint(props.modelValue, Number(event.key))) }
  else if (event.key === 'Backspace' || event.key === 'Escape') { event.preventDefault(); emit('update:modelValue', '') }
}
</script>

<template>
  <div class="wallet-gesture">
    <svg viewBox="0 0 240 240" tabindex="0" role="group" aria-label="九宫格手势，至少连接四个点。键盘可按数字1至9，退格清空" @pointerdown="start" @pointermove="move" @pointerup="finish($event)" @pointercancel="finish($event, true)" @lostpointercapture="finish($event, true)" @keydown="key">
      <polyline v-if="modelValue" :points="path" class="gesture-line" />
      <line v-if="drawing && cursor && last" :x1="last.x" :y1="last.y" :x2="cursor.x" :y2="cursor.y" class="gesture-line" />
      <g v-for="point in points" :key="point.id" :class="{ selected: modelValue.includes(String(point.id)) }">
        <circle :cx="point.x" :cy="point.y" r="17" class="gesture-ring" />
        <circle :cx="point.x" :cy="point.y" r="5" class="gesture-dot" />
      </g>
    </svg>
    <button type="button" class="gesture-redraw" @click="emit('update:modelValue', '')">重新绘制</button>
  </div>
</template>

<style scoped>
.wallet-gesture{width:100%;max-width:240px;margin:0 auto;color:var(--w-text-secondary,var(--text-secondary,#4b5563))}.wallet-gesture svg{display:block;width:100%;aspect-ratio:1;touch-action:none;user-select:none;cursor:crosshair;outline-offset:-2px}.gesture-line{fill:none;stroke:var(--w-accent-gold,#b28a34);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.gesture-ring{fill:transparent;stroke:var(--w-border,var(--border-color,#d8dde3));stroke-width:1}.gesture-dot{fill:currentColor}.selected .gesture-ring{stroke:var(--w-accent-gold,#b28a34);fill:rgba(178,138,52,.08)}.selected .gesture-dot{fill:var(--w-accent-gold,#b28a34)}.gesture-redraw{display:block;margin:0 auto;padding:5px 10px;border:0;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}
</style>
