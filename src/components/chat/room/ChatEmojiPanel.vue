<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { builtInChatEmojiPacks, builtInChatEmojis, findBuiltInChatEmoji } from '../../../services/builtInChatEmojis'
import { builtInEmojiRecentIds } from '../../../composables/useBuiltInEmojiRecent'

const props = defineProps<{ personalEmojis: any[]; visible: boolean }>()
const emit = defineEmits<{ (e: 'send', item: any): void; (e: 'manage'): void }>()
const activePack = ref(props.personalEmojis.length ? 'mine' : 'wechat')
const search = ref('')
const showSearch = ref(false)
const hasInteracted = ref(false)
watch(() => props.personalEmojis.length, length => {
  if (length && !hasInteracted.value) activePack.value = 'mine'
})
const recent = computed(() => builtInEmojiRecentIds.value.map(findBuiltInChatEmoji).filter(Boolean))
const items = computed(() => {
  const source = search.value.trim()
    ? [...builtInChatEmojis, ...props.personalEmojis]
    : activePack.value === 'mine' ? props.personalEmojis : activePack.value === 'recent' ? recent.value : builtInChatEmojis.filter(item => item.packId === activePack.value)
  const keyword = search.value.trim().toLowerCase()
  return keyword ? source.filter(item => `${item.name} ${item.packName || ''}`.toLowerCase().includes(keyword)) : source
})
const selectPack = (id: string) => { hasInteracted.value = true; activePack.value = id; search.value = ''; showSearch.value = false }
const toggleSearch = () => { hasInteracted.value = true; showSearch.value = !showSearch.value; search.value = '' }
</script>

<template>
  <div class="chat-emoji-picker">
    <div class="picker-toolbar">
      <div class="picker-tabs" role="tablist" aria-label="表情分类">
        <button type="button" class="picker-tab" role="tab" :aria-selected="activePack === 'mine'" :class="{ active: activePack === 'mine' }" @click="selectPack('mine')">我的</button>
        <button type="button" class="picker-tab" role="tab" :aria-selected="activePack === 'recent'" :class="{ active: activePack === 'recent' }" @click="selectPack('recent')">最近</button>
        <button v-for="pack in builtInChatEmojiPacks" :key="pack.id" type="button" class="picker-tab" role="tab" :aria-selected="activePack === pack.id" :class="{ active: activePack === pack.id }" @click="selectPack(pack.id)">{{ pack.name }}</button>
      </div>
      <button type="button" class="picker-search-toggle" aria-label="搜索表情" :aria-expanded="showSearch" @click="toggleSearch">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/></svg>
      </button>
    </div>
    <input v-if="showSearch" v-model="search" class="picker-search" type="search" placeholder="搜索表情名称或平台" aria-label="搜索表情名称或平台">
    <div v-if="!items.length" class="emoji-panel-empty picker-empty">
      <div class="empty-text">{{ search.trim() ? '没有找到表情' : activePack === 'recent' ? '发送后会显示在这里' : '暂无用户表情包' }}</div>
      <button v-if="activePack === 'mine' && !search.trim()" type="button" class="picker-manage" @click="emit('manage')">前往“表情包管理”添加</button>
    </div>
    <div v-else :key="`${activePack}:${search}`" class="emoji-panel-grid picker-grid" :class="{ 'builtin-grid': activePack !== 'mine' || search.trim() }">
      <button v-for="item in items" :key="item.id" type="button" class="emoji-panel-item picker-item" :class="{ 'builtin-item': item.builtIn }" :title="item.packName ? `${item.packName}·${item.name}` : item.name" @click="emit('send', item)">
        <div class="emoji-img-wrapper"><img v-if="visible" :src="item.previewUrl" :alt="item.name" loading="lazy"></div>
        <span class="emoji-item-name">{{ item.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-emoji-picker { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; }
.picker-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 12px 0; min-width: 0; flex-shrink: 0; }
.picker-tabs { display: flex; gap: 4px; overflow-x: auto; min-width: 0; flex: 1; scrollbar-width: none; }
.picker-tabs::-webkit-scrollbar { display: none; }
.picker-tab { border: 0; background: transparent; color: var(--text-secondary); border-radius: 8px; font: inherit; font-size: 11px; padding: 5px 8px; white-space: nowrap; flex-shrink: 0; cursor: pointer; }
.picker-tab.active { color: var(--text-primary); background: var(--bg-secondary, rgba(0,0,0,.06)); }
.picker-search-toggle { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: var(--text-secondary); flex-shrink: 0; cursor: pointer; }
.picker-search { margin: 4px 12px 0; min-width: 0; height: 28px; flex-shrink: 0; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); border-radius: 8px; padding: 0 8px; font: inherit; font-size: 12px; outline: none; }
.picker-search:focus { border-color: var(--text-secondary); }
.picker-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 16px; padding: 12px 16px; overflow-y: auto; scrollbar-width: thin; height: auto; min-height: 0; flex: 1; align-content: start; }
.picker-grid.builtin-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px 6px; padding: 8px 12px; }
.picker-item { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 80px; padding: 4px; gap: 4px; border: 0; border-radius: 8px; overflow: hidden; background: transparent; cursor: pointer; transition: transform .1s, background-color .2s; font: inherit; color: inherit; min-width: 0; }
.picker-item:active { transform: scale(.92); background: rgba(0,0,0,.05); }
:global(.is-dark) .picker-item:active { background: rgba(255,255,255,.08); }
.emoji-img-wrapper { display: flex; align-items: center; justify-content: center; width: 100%; height: 52px; }
.emoji-img-wrapper img { width: 100%; height: 100%; object-fit: contain; }
.emoji-item-name { max-width: 100%; font-size: 11px; color: var(--text-secondary, #666); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.picker-item.builtin-item { height: 56px; padding: 2px; gap: 2px; }
.builtin-item .emoji-img-wrapper { height: 34px; }
.builtin-item .emoji-img-wrapper img { max-width: 36px; }
.builtin-item .emoji-item-name { font-size: 10px; }
.picker-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: auto; flex: 1; color: var(--text-secondary); gap: 8px; }
.picker-empty .empty-text { font-size: 14px; font-weight: 500; }
.picker-manage { border: 0; padding: 0; font: inherit; font-size: 12px; background: transparent; color: #3b82f6; text-decoration: underline; cursor: pointer; }
.picker-tab:focus-visible, .picker-search-toggle:focus-visible, .picker-item:focus-visible { outline: 1px solid var(--text-secondary); outline-offset: -1px; }
@media (max-width: 340px) { .picker-grid.builtin-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
</style>
