<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { importBookFromUrl, parseBookFiles, type BookImportCandidate } from '../../services/bookImportService'

const emit = defineEmits<{
  (event: 'close'): void
  (event: 'import', candidates: BookImportCandidate[]): void
  (event: 'creative-import', candidate: BookImportCandidate): void
}>()

const candidates = ref<BookImportCandidate[]>([])
const errors = ref<string[]>([])
const url = ref('')
const busy = ref(false)
const status = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const selected = computed(() => candidates.value.filter(item => item.selected))
const allSelected = computed(() => candidates.value.length > 0 && selected.value.length === candidates.value.length)
const accept = '.txt,.md,.markdown,.json,.html,.htm,.docx,.epub,.pdf,.fb2,.mobi,.azw,.azw3,.zip,.cbz,.rar,.7z,.tar,.gz,.tgz,.bz2,.xz'

const analyze = async (files: File[]) => {
  if (!files.length || busy.value) return
  busy.value = true; errors.value = []; status.value = `正在解析 ${files.length} 个文件…`
  try {
    const result = await parseBookFiles(files)
    candidates.value.push(...result.candidates)
    errors.value.push(...result.errors)
    status.value = result.candidates.length ? `已识别 ${result.candidates.length} 本书，可逐本选择` : '没有识别到可导入书籍'
  } finally { busy.value = false }
}
const chooseFiles = () => fileInput.value?.click()
const onFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  void analyze(Array.from(input.files || []))
  input.value = ''
}
const onDrop = (event: DragEvent) => void analyze(Array.from(event.dataTransfer?.files || []))
const analyzeUrl = async () => {
  if (!url.value.trim() || busy.value) return
  busy.value = true; errors.value = []; status.value = '正在下载并检查完整文件…'
  try {
    const parsed = await importBookFromUrl(url.value.trim())
    candidates.value.push(...parsed); status.value = `已识别 ${parsed.length} 本书`
  } catch (cause: any) { errors.value = [String(cause?.message || '地址读取失败')]; status.value = '' }
  finally { busy.value = false }
}
const toggleAll = () => { const value = !allSelected.value; candidates.value.forEach(item => { item.selected = value }) }
const removeCandidate = (id: string) => { candidates.value = candidates.value.filter(item => item.id !== id) }
const finish = () => { if (selected.value.length) emit('import', selected.value) }
</script>

<template>
  <section class="import-center">
    <header class="import-head"><button @click="emit('close')">‹</button><span><b>导入中心</b><small>文件、压缩包或网络地址</small></span><button :disabled="!selected.length||busy" @click="finish">导入 {{selected.length||''}}</button></header>
    <div class="import-scroll">
      <section class="import-card file-drop" @dragover.prevent @drop.prevent="onDrop">
        <div><b>从设备选择</b><small>支持批量选择；压缩包会拆分成可勾选书目</small></div>
        <button :disabled="busy" @click="chooseFiles">选择文件</button>
        <input ref="fileInput" type="file" multiple :accept="accept" @change="onFiles" />
        <p>TXT · Markdown · JSON · HTML · DOCX · EPUB · PDF · FB2 · MOBI · AZW3 · ZIP/CBZ · RAR · 7Z · TAR/GZ</p>
      </section>
      <section class="import-card url-import">
        <label for="book-url"><b>从网络地址导入</b><small>输入可直接下载的完整书籍文件 URL</small></label>
        <div><input id="book-url" v-model="url" inputmode="url" autocomplete="url" placeholder="https://…/book.epub" @keyup.enter="analyzeUrl"/><button :disabled="busy||!url.trim()" @click="analyzeUrl">解析</button></div>
      </section>
      <div v-if="busy||status" class="import-status"><i v-if="busy"></i><span>{{status}}</span></div>
      <div v-if="errors.length" class="import-errors"><p v-for="message in errors" :key="message">{{message}}</p></div>
      <section v-if="candidates.length" class="candidate-section">
        <header><span><b>待导入书目</b><small>{{selected.length}} / {{candidates.length}} 已选择</small></span><button @click="toggleAll">{{allSelected?'取消全选':'全选'}}</button></header>
        <article v-for="item in candidates" :key="item.id" :class="{selected:item.selected}">
          <button class="candidate-check" :aria-label="item.selected?'取消选择':'选择书籍'" @click="item.selected=!item.selected"><i>{{item.selected?'✓':''}}</i></button>
          <span><b>{{item.book.title}}</b><small>{{item.book.author}} · {{item.book.format.toUpperCase()}} · {{item.book.chapters.length}} 章</small><em :title="item.sourcePath">{{item.sourcePath}}</em><p v-if="item.warning">{{item.warning}}</p></span>
          <button class="candidate-remove" aria-label="移除" @click="removeCandidate(item.id)">×</button>
        </article>
        <button v-if="selected.length===1&&['txt','markdown'].includes(selected[0]!.book.format)" class="creative-import" @click="emit('creative-import',selected[0]!)">作为创作草稿导入并编辑</button>
      </section>
      <section class="import-help"><b>导入说明</b><p>书籍内容只保存在当前浏览器的本地存储中。压缩包会先检查路径、条目数量、解压体积和异常压缩比；加密包会提示先在设备上解压。扫描版 PDF 可能没有可提取文本。</p></section>
    </div>
  </section>
</template>

<style scoped>
.import-center{position:absolute;z-index:85;inset:0;display:flex;min-width:0;min-height:0;flex-direction:column;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#222)}button,input{font:inherit}.import-head{display:grid;height:48px;flex:none;grid-template-columns:52px minmax(0,1fr) 70px;align-items:center;border-bottom:1px solid var(--border-color,rgba(0,0,0,.06));padding:0 9px}.import-head button{height:34px;border:0;background:transparent;color:#876d57;font-size:10px}.import-head button:first-child{text-align:left;font-size:28px}.import-head button:last-child{text-align:right}.import-head button:disabled{opacity:.35}.import-head span{min-width:0;text-align:center}.import-head b,.import-head small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.import-head b{font-size:12px}.import-head small{margin-top:1px;color:#999;font-size:8px}.import-scroll{min-height:0;flex:1;overflow-y:auto;padding:12px 16px calc(28px + env(safe-area-inset-bottom,0px))}.import-card{margin-bottom:10px;border-radius:12px;background:var(--sys-bg-secondary,#fff);padding:13px}.file-drop{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 10px}.import-card b,.import-card small{display:block}.import-card b{font-size:11px}.import-card small{margin-top:3px;color:#999;font-size:8px;line-height:1.45}.file-drop>button,.url-import button,.creative-import{height:30px;border:0;border-radius:8px;background:#3a342f;color:#fff;padding:0 11px;font-size:9px}.file-drop input{display:none}.file-drop p{grid-column:1/-1;margin:5px 0 0;color:#aaa;font-size:7.5px;line-height:1.6}.url-import label{display:block}.url-import>div{display:flex;min-width:0;gap:7px;margin-top:10px}.url-import input{box-sizing:border-box;min-width:0;height:32px;flex:1;border:1px solid var(--border-color,#ddd);border-radius:8px;outline:0;background:transparent;padding:0 9px;color:inherit;font-size:9px}.url-import button:disabled,.file-drop button:disabled{opacity:.45}.import-status{display:flex;align-items:center;gap:8px;padding:8px 3px;color:#777;font-size:9px}.import-status i{width:11px;height:11px;border:2px solid #cfc7c0;border-top-color:#765f4c;border-radius:50%;animation:spin .8s linear infinite}.import-errors{margin:8px 0;border-radius:9px;background:color-mix(in srgb,#b75a55 10%,transparent);padding:7px 10px}.import-errors p{margin:4px 0;color:#a34844;font-size:8px;line-height:1.55}.candidate-section{margin-top:14px}.candidate-section>header{display:flex;align-items:center;justify-content:space-between;padding:0 2px 7px}.candidate-section header span b,.candidate-section header span small{display:block}.candidate-section header b{font-size:11px}.candidate-section header small{margin-top:2px;color:#aaa;font-size:8px}.candidate-section header button{border:0;background:transparent;color:#826954;font-size:9px}.candidate-section article{display:flex;min-width:0;align-items:flex-start;gap:9px;margin-bottom:7px;border:1px solid transparent;border-radius:11px;background:var(--sys-bg-secondary,#fff);padding:10px}.candidate-section article.selected{border-color:color-mix(in srgb,#8d735d 45%,transparent)}.candidate-check,.candidate-remove{flex:none;border:0;background:transparent}.candidate-check{padding:1px}.candidate-check i{display:grid;width:17px;height:17px;place-items:center;border:1px solid #c8c0ba;border-radius:5px;color:#725a47;font-size:10px;font-style:normal}.selected .candidate-check i{border-color:#846a54;background:#846a54;color:#fff}.candidate-section article>span{min-width:0;flex:1}.candidate-section article span b,.candidate-section article span small,.candidate-section article span em{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.candidate-section article span b{font-size:10px}.candidate-section article span small{margin-top:3px;color:#888;font-size:8px}.candidate-section article span em{margin-top:3px;color:#aaa;font-size:7px;font-style:normal}.candidate-section article span p{margin:5px 0 0;color:#a17653;font-size:7.5px;line-height:1.45}.candidate-remove{color:#aaa;font-size:17px;line-height:17px}.creative-import{width:100%;margin-top:4px;background:transparent;color:#765f4c;border:1px solid #9b8675}.import-help{margin-top:18px;padding:0 3px;color:#999}.import-help b{font-size:9px}.import-help p{margin:5px 0;font-size:8px;line-height:1.7}@keyframes spin{to{transform:rotate(360deg)}}@media(max-width:340px){.import-scroll{padding-right:12px;padding-left:12px}.file-drop{grid-template-columns:minmax(0,1fr) 68px}.file-drop>button{padding:0 7px}.import-head{grid-template-columns:45px minmax(0,1fr) 62px}}
</style>
