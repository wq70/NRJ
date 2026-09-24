/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  categories: string[]
  activeCategory: string
}>()

const emit = defineEmits<{
  (e: 'change', category: string): void
}>()

const itemRefs = ref<Record<string, HTMLElement | null>>({})

const setItemRef = (el: any, cat: string) => {
  if (el) {
    itemRefs.value[cat] = el as HTMLElement
  }
}

const scrollTabIntoView = (cat: string) => {
  nextTick(() => {
    const el = itemRefs.value[cat]
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      })
    }
  })
}

const selectCategory = (cat: string) => {
  emit('change', cat)
  scrollTabIntoView(cat)
}

watch(
  () => props.activeCategory,
  (newCat) => {
    if (newCat) {
      scrollTabIntoView(newCat)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="capsule-tab-container">
    <div class="capsule-tab-bar">
      <button
        v-for="cat in categories" 
        :key="cat"
        :ref="(el) => setItemRef(el, cat)"
        type="button"
        class="capsule-tab-item"
        :class="{ active: activeCategory === cat }"
        @click="selectCategory(cat)"
      >
        <span class="tab-label">{{ cat }}</span>
        <span v-if="activeCategory === cat" class="tab-active-dot" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.capsule-tab-container {
  width: 100%;
  padding: 4px 0 8px;
  box-sizing: border-box;
}

.capsule-tab-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  width: 100%;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.01);
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.capsule-tab-bar::-webkit-scrollbar {
  display: none;
}

.capsule-tab-item {
  flex: 1 1 0;
  min-width: 0;
  box-sizing: border-box;
  text-align: center;
  border: none;
  background: transparent;
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Segoe UI", Roboto, sans-serif;
  font-size: 13.5px;
  font-weight: 500;
  color: #8e8e93;
  padding: 8px 2px;
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  transition: all 0.22s cubic-bezier(0.25, 1, 0.5, 1);
  letter-spacing: 0.2px;
  white-space: nowrap;
  user-select: none;
}

.capsule-tab-item:hover {
  color: #374151;
}

.capsule-tab-item:active {
  transform: scale(0.96);
}

.capsule-tab-item.active {
  background: #111827;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(17, 24, 39, 0.14);
}

.tab-label {
  display: block;
  line-height: 1.2;
}

.tab-active-dot {
  display: none;
}

:global(.dark-theme) .capsule-tab-bar {
  background: #1e1e20;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}

:global(.dark-theme) .capsule-tab-item {
  color: #9ca3af;
}

:global(.dark-theme) .capsule-tab-item:hover {
  color: #e5e7eb;
}

:global(.dark-theme) .capsule-tab-item.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 2px 8px rgba(255, 255, 255, 0.2);
}
</style>
