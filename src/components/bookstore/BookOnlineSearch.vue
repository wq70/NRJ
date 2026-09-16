<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { downloadOnlineBook, searchOnlineBooks, type OnlineBookResult, type OnlineSourceStatus } from '../../services/bookOnlineService'
import type { BookImportCandidate } from '../../services/bookImportService'

const emit = defineEmits<{ (event: 'close'): void; (event: 'import', candidates: BookImportCandidate[]): void; (event: 'notice', message: string): void }>()
const query = ref('')
const results = ref<OnlineBookResult[]>([])
const statuses = ref<OnlineSourceStatus[]>([])
const busy = ref(false)
const downloadingId = ref('')
const searched = ref(false)
const showSources = ref(false)
const availableSources = computed(() => statuses.value.filter(item => item.ok).length)

const search = async () => {
  if (!query.value.trim() || busy.value) return
  busy.value = true; searched.value = true; results.value = []; statuses.value = []
  try {
    const response = await searchOnlineBooks(query.value)
    results.value = response.results; statuses.value = response.statuses
  } finally { busy.value = false }
}
const read = async (book: OnlineBookResult) => {
  if (downloadingId.value) return
  downloadingId.value = book.id
  emit('notice', '正在获取完整正文并保存到本地…')
  try { emit('import', await downloadOnlineBook(book)) }
  catch (cause: any) { emit('notice', String(cause?.message || '完整正文获取失败')) }
  finally { downloadingId.value = '' }
}
</script>

<template>
  <section class="online-search">
    <header class="online-head"><button @click="emit('close')">‹</button><span><b>在线全文</b><small>无需自建后端</small></span><i></i></header>
    <div class="online-scroll">
      <div class="online-query"><span>⌕</span><input v-model="query" placeholder="输入书名或作者" enterkeyhint="search" @keyup.enter="search"/><button :disabled="busy||!query.trim()" @click="search">{{busy?'搜索中':'搜索'}}</button></div>
      <p class="online-note">这里只展示能够继续获取完整正文或完整文件的结果，不混入仅有简介、试读、购买或借阅页面。</p>
      <button v-if="statuses.length" class="source-summary" @click="showSources=!showSources"><span><b>{{availableSources}} / {{statuses.length}} 个全文源可用</b><small>不同网络环境下可用性会变化</small></span><em>{{showSources?'收起':'详情'}} ›</em></button>
      <div v-if="showSources" class="source-list"><span v-for="source in statuses" :key="source.sourceId" :class="{failed:!source.ok}"><i></i><b>{{source.sourceName}}</b><small>{{source.message}} · {{source.elapsedMs}}ms</small></span></div>
      <div v-if="busy" class="online-loading"><i></i><span>正在并行查询全文源…</span></div>
      <div v-else class="online-results">
        <article v-for="book in results" :key="book.id">
          <div class="online-cover" :style="book.cover?{backgroundImage:`url(${book.cover})`}:{}"><span v-if="!book.cover">{{book.title.slice(0,2)}}</span></div>
          <div><b>{{book.title}}</b><small>{{book.author}} · {{book.sourceName}}</small><p>{{book.summary||'该来源未提供简介，但已检测到可读取的完整内容。'}}</p><em>{{book.formats.join(' · ')}}</em></div>
          <button :disabled="Boolean(downloadingId)" @click="read(book)">{{downloadingId===book.id?'获取中':'在线阅读'}}</button>
        </article>
        <div v-if="searched&&!results.length" class="online-empty">没有找到可直接阅读的完整内容<br><small>可以换用原文书名、作者名，或前往导入中心粘贴完整文件地址</small></div>
        <div v-else-if="!searched" class="online-empty">搜索完整电子书与在线文本<br><small>聚合 Project Gutenberg、Feedbooks、中文维基文库、Internet Archive 与 DBooks</small></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.online-search{position:absolute;z-index:84;inset:0;display:flex;min-width:0;min-height:0;flex-direction:column;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#222)}button,input{font:inherit}.online-head{display:grid;height:48px;flex:none;grid-template-columns:50px minmax(0,1fr) 50px;align-items:center;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06));padding:0 9px}.online-head button{border:0;background:transparent;color:#806954;font-size:28px;text-align:left}.online-head span{text-align:center}.online-head b,.online-head small{display:block}.online-head b{font-size:12px}.online-head small{margin-top:1px;color:#999;font-size:8px}.online-scroll{min-height:0;flex:1;overflow-y:auto;padding:12px 16px calc(28px + env(safe-area-inset-bottom,0px))}.online-query{display:flex;height:35px;min-width:0;align-items:center;gap:7px;border-radius:10px;background:var(--sys-bg-secondary,#fff);padding:0 5px 0 10px}.online-query>span{color:#aaa}.online-query input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:inherit;font-size:10px}.online-query button{height:27px;border:0;border-radius:7px;background:#3a342f;padding:0 11px;color:#fff;font-size:9px}.online-query button:disabled{opacity:.4}.online-note{margin:8px 3px 12px;color:#999;font-size:7.5px;line-height:1.6}.source-summary{display:flex;width:100%;min-width:0;align-items:center;border:0;border-radius:10px;background:var(--sys-bg-secondary,#fff);padding:9px 11px;text-align:left}.source-summary span{min-width:0;flex:1}.source-summary b,.source-summary small{display:block}.source-summary b{font-size:9px}.source-summary small{margin-top:2px;color:#aaa;font-size:7.5px}.source-summary em{color:#8c735e;font-size:8px;font-style:normal}.source-list{margin:6px 2px 12px}.source-list span{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:5px;padding:5px 6px;font-size:8px}.source-list i{width:5px;height:5px;border-radius:50%;background:#4d9a73}.source-list .failed i{background:#bd6e64}.source-list b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.source-list small{color:#999}.online-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:60px 10px;color:#888;font-size:9px}.online-loading i{width:13px;height:13px;border:2px solid #d7d0ca;border-top-color:#806954;border-radius:50%;animation:spin .8s linear infinite}.online-results{margin-top:12px}.online-results article{display:grid;min-width:0;grid-template-columns:48px minmax(0,1fr) auto;gap:10px;margin-bottom:8px;border-radius:11px;background:var(--sys-bg-secondary,#fff);padding:10px}.online-cover{display:grid;width:48px;height:67px;place-items:center;border-radius:4px;background:#817467 center/cover no-repeat;color:#fff;font:12px Georgia}.online-results article>div:nth-child(2){min-width:0}.online-results article b,.online-results article small,.online-results article em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.online-results article b{font-size:10px}.online-results article small{margin-top:3px;color:#888;font-size:7.5px}.online-results article p{display:-webkit-box;overflow:hidden;margin:6px 0 4px;color:#777;font-size:8px;line-height:1.45;-webkit-box-orient:vertical;-webkit-line-clamp:2}.online-results article em{color:#9a795f;font-size:7px;font-style:normal}.online-results article>button{align-self:center;height:28px;border:1px solid #8e7764;border-radius:8px;background:transparent;padding:0 8px;color:#765e4b;font-size:8px}.online-results article>button:disabled{opacity:.45}.online-empty{padding:70px 16px;color:#888;font-size:10px;line-height:1.7;text-align:center}.online-empty small{color:#aaa;font-size:8px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:340px){.online-scroll{padding-right:12px;padding-left:12px}.online-results article{grid-template-columns:42px minmax(0,1fr) 61px;gap:8px;padding:8px}.online-cover{width:42px;height:60px}.online-results article>button{padding:0 5px}}
</style>
