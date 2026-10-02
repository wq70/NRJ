<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CharacterPhoneApp, CharacterPhoneAppEntry } from '../../types/characterPhone'
import { localPhoneDate, phoneEntryDate, phoneEntryImage, phoneEntryMatches, phoneResourceUrl } from '../../services/characterPhonePresentation'
import PhoneIcon from './PhoneIcon.vue'
const props = defineProps<{ app: CharacterPhoneApp; now: number; busy: boolean }>()
const emit = defineEmits<{
  seen: [entry: CharacterPhoneAppEntry]
  write: [entry: CharacterPhoneAppEntry]
  remove: [entry: CharacterPhoneAppEntry]
  share: [entries: CharacterPhoneAppEntry[]]
  refresh: [mode: 'incremental' | 'replace-generated']
  save: []
  state: [nested: boolean]
}>()
const query = ref(''), selected = ref<CharacterPhoneAppEntry | null>(null), editing = ref(false), tools = ref(false)
const draft = ref<CharacterPhoneAppEntry | null>(null), confirmDiscard = ref(false), confirmRemove = ref(false), confirmReplace = ref(false)
const originalDraft = ref(''), error = ref(''), filter = ref('all'), selectedDate = ref('')
const month = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const gallery = computed(() => ['photos', 'gallery'].includes(props.app.kind))
const entries = computed(() => [...props.app.entries].filter(e => phoneEntryMatches(e, query.value)).filter(e => {
  if (props.app.kind === 'calendar' && selectedDate.value) return localPhoneDate(phoneEntryDate(e)) === selectedDate.value
  if (filter.value === 'pinned') return e.meta?.pinned === true
  if (filter.value === 'missed') return e.meta?.direction === 'missed'
  return true
}).sort((a, b) => Number(b.meta?.pinned === true) - Number(a.meta?.pinned === true) || b.createdAt - a.createdAt))
const days = computed(() => {
  const start = (month.value.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => new Date(month.value.getFullYear(), month.value.getMonth(), i - start + 1))
})
const dateLabel = (entry: CharacterPhoneAppEntry) => phoneEntryDate(entry).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const hasDate = (day: Date) => props.app.entries.some(e => localPhoneDate(phoneEntryDate(e)) === localPhoneDate(day))
const moveMonth = (delta: number) => { month.value = new Date(month.value.getFullYear(), month.value.getMonth() + delta, 1) }
const open = (entry: CharacterPhoneAppEntry) => { selected.value = entry; emit('seen', entry) }
const edit = (entry?: CharacterPhoneAppEntry) => {
  draft.value = entry ? JSON.parse(JSON.stringify(entry)) : { id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, title: '', content: '', createdAt: Date.now(), read: true, meta: {} }
  draft.value!.meta ||= {}
  for (const field of ['startAt', 'endAt']) {
    const raw = draft.value!.meta![field]
    if (typeof raw === 'number') {
      const date = new Date(raw)
      if (Number.isFinite(date.getTime())) draft.value!.meta![field] = `${localPhoneDate(date)}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
    }
  }
  originalDraft.value = JSON.stringify(draft.value)
  editing.value = true; tools.value = false; error.value = ''
}
const back = () => {
  if (confirmDiscard.value || confirmRemove.value || confirmReplace.value) { confirmDiscard.value = false; confirmRemove.value = false; confirmReplace.value = false; return true }
  if (editing.value) {
    if (JSON.stringify(draft.value) !== originalDraft.value) confirmDiscard.value = true
    else editing.value = false
    return true
  }
  if (tools.value) { tools.value = false; return true }
  if (selected.value) { selected.value = null; return true }
  return false
}
const commit = () => {
  if (!draft.value?.title.trim()) { error.value = '请填写标题'; return }
  if (draft.value.meta?.url && !phoneResourceUrl(draft.value.meta.url)) { error.value = '链接请使用 http 或 https 地址'; return }
  if (draft.value.meta?.imageUrl && !phoneResourceUrl(draft.value.meta.imageUrl, true)) { error.value = '图片地址无效'; return }
  if (draft.value.meta?.startAt && draft.value.meta?.endAt && new Date(String(draft.value.meta.endAt)) < new Date(String(draft.value.meta.startAt))) { error.value = '结束时间不能早于开始时间'; return }
  emit('write', { ...draft.value, title: draft.value.title.trim(), updatedAt: Date.now(), meta: { ...draft.value.meta, generated: false, actor: 'user', viewerSeen: true } })
}
const saved = () => { editing.value = false; selected.value = null; error.value = '' }
const importImage = (event: Event) => {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file || !draft.value) return
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024) { error.value = '请选择 8 MB 以内的 PNG、JPEG、WebP 或 GIF 图片'; return }
  const current = draft.value, reader = new FileReader()
  reader.onload = () => { if (draft.value === current) { current.meta = { ...current.meta, imageUrl: String(reader.result) }; current.title ||= file.name } }
  reader.onerror = () => { error.value = '图片读取失败，请重试' }
  reader.readAsDataURL(file); input.value = ''
}
watch(() => [editing.value, !!selected.value, tools.value], () => emit('state', editing.value || !!selected.value || tools.value))
defineExpose({ back, edit, saved, dirty: () => editing.value && JSON.stringify(draft.value) !== originalDraft.value })
</script>

<template>
  <div class="phone-content">
    <template v-if="editing && draft">
      <div class="phone-subbar"><button @click="back">取消</button><b>{{ app.entries.some(e => e.id === draft?.id) ? '编辑记录' : '添加记录' }}</b><button class="accent-text" :disabled="busy" @click="commit">{{ busy ? '保存中' : '保存' }}</button></div>
      <div class="phone-scroll phone-editor">
        <label>标题<input v-model="draft.title" maxlength="120" placeholder="填写标题"></label>
        <label>摘要<input v-model="draft.subtitle" maxlength="300" placeholder="选填"></label>
        <label>正文<textarea v-model="draft.content" rows="9" placeholder="写下内容…"></textarea></label>
        <template v-if="draft.meta">
          <template v-if="gallery"><label>图片地址<input v-model="draft.meta.imageUrl" placeholder="https://…"></label><label class="phone-upload">从本地导入图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="importImage"></label></template>
          <label v-if="['browser','files','maps'].includes(app.kind)">关联链接<input v-model="draft.meta.url" placeholder="https://…"></label>
          <template v-if="app.kind === 'calendar'"><label>开始时间<input v-model="draft.meta.startAt" type="datetime-local"></label><label>结束时间<input v-model="draft.meta.endAt" type="datetime-local"></label><label>地点<input v-model="draft.meta.location"></label></template>
          <label v-if="app.kind === 'maps'">地点<input v-model="draft.meta.location"></label>
          <template v-if="app.kind === 'clock'"><label>闹钟时间<input v-model="draft.meta.alarmTime" type="time"></label><label>启用<input v-model="draft.meta.enabled" class="phone-switch" type="checkbox"></label><p class="phone-hint">这是角色设备中的闹钟记录，不会设置系统闹钟。</p></template>
          <template v-if="app.kind === 'calls'"><label>通话类型<select v-model="draft.meta.direction"><option value="">未注明</option><option value="incoming">呼入</option><option value="outgoing">呼出</option><option value="missed">未接</option></select></label><label>时长（秒）<input v-model.number="draft.meta.duration" type="number" min="0"></label></template>
          <label v-if="app.kind === 'sms'">发送方<input v-model="draft.meta.sender"></label>
          <label v-if="app.kind === 'files'">文件类型<input v-model="draft.meta.fileType" placeholder="例如 PDF"></label>
          <label>置顶<input v-model="draft.meta.pinned" class="phone-switch" type="checkbox"></label>
        </template>
        <p v-if="error" class="phone-error" role="alert">{{ error }}</p>
      </div>
    </template>
    <template v-else-if="selected">
      <div class="phone-subbar"><button @click="selected = null">返回列表</button><span></span><button @click="edit(selected)">编辑</button></div>
      <article class="phone-scroll phone-detail">
        <img v-if="gallery && phoneEntryImage(selected)" :src="phoneEntryImage(selected)" :alt="selected.title" class="phone-photo-full">
        <p class="phone-eyebrow">{{ dateLabel(selected) }} · {{ selected.meta?.generated === true ? '生成记录' : '保存的记录' }}</p>
        <h2>{{ selected.title }}</h2><p class="phone-muted">{{ selected.subtitle }}</p>
        <p v-if="selected.meta?.location">地点：{{ selected.meta.location }}</p>
        <p v-if="selected.meta?.endAt">结束：{{ selected.meta.endAt }}</p>
        <p v-if="selected.meta?.duration !== undefined">通话时长：{{ selected.meta.duration }} 秒</p>
        <p class="phone-prose">{{ selected.content || '这条记录没有正文。' }}</p>
        <a v-if="phoneResourceUrl(selected.meta?.url)" :href="phoneResourceUrl(selected.meta?.url)" target="_blank" rel="noopener noreferrer" class="phone-link">打开关联链接 ↗</a>
        <p v-if="gallery && !phoneEntryImage(selected)" class="phone-hint">这是一条照片描述，尚未关联图片。可以编辑并导入图片。</p>
        <div class="phone-actions"><button @click="emit('share', [selected])">分享到单聊</button><button class="danger-text" @click="confirmRemove = true">删除记录</button></div>
      </article>
    </template>
    <template v-else>
      <div class="phone-content-toolbar"><label class="phone-search"><PhoneIcon name="search"/><input v-model="query" :placeholder="`搜索${app.name}`" aria-label="搜索应用内容"></label><button class="phone-icon-button" aria-label="添加记录" @click="edit()"><PhoneIcon name="plus"/></button><button class="phone-icon-button" aria-label="应用管理" :aria-expanded="tools" @click="tools = !tools"><PhoneIcon name="more"/></button></div>
      <div v-if="tools" class="phone-scroll phone-app-tools">
        <h3>内容管理</h3><div class="phone-actions"><button :disabled="busy" @click="emit('refresh','incremental')">增量刷新</button><button :disabled="busy" @click="confirmReplace = true">全新刷新</button><button @click="emit('share', app.entries)">分享到单聊</button></div>
        <p class="phone-hint">刷新会调用已配置的模型。全新刷新仅替换已标记的生成内容。</p>
        <label>允许角色使用<input v-model="app.allowCharacterUse" class="phone-switch" type="checkbox" @change="emit('save')"></label>
        <label>允许后台使用<input v-model="app.allowBackgroundUse" class="phone-switch" type="checkbox" @change="emit('save')"></label>
        <label>操作权限<select v-model="app.managementMode" @change="emit('save')"><option value="readonly">只读</option><option value="confirm">需确认</option><option value="autonomous">自主操作</option></select></label>
        <label>刷新方式<select v-model="app.refreshMode" @change="emit('save')"><option value="manual">手动</option><option value="auto">自动</option></select></label>
        <label v-if="app.refreshMode === 'auto'">间隔（分钟）<input v-model.number="app.refreshIntervalMinutes" type="number" min="15" @change="emit('save')"></label>
        <button @click="tools = false">完成</button>
      </div>
      <div v-else class="phone-scroll">
        <div v-if="app.kind === 'calendar'" class="phone-calendar">
          <div class="phone-subbar"><button aria-label="上个月" @click="moveMonth(-1)">‹</button><b>{{ month.toLocaleDateString('zh-CN',{year:'numeric',month:'long'}) }}</b><button aria-label="下个月" @click="moveMonth(1)">›</button></div>
          <div class="phone-calendar-grid"><small v-for="day in ['一','二','三','四','五','六','日']" :key="day">{{ day }}</small><button v-for="day in days" :key="day.toISOString()" :class="{ selected: selectedDate === localPhoneDate(day), muted: day.getMonth() !== month.getMonth(), 'has-event': hasDate(day) }" @click="selectedDate = localPhoneDate(day)">{{ day.getDate() }}</button></div>
          <button class="phone-text-button" @click="selectedDate = ''">{{ selectedDate ? `${selectedDate} · 查看全部日程` : '全部日程' }}</button>
        </div>
        <div v-if="app.kind === 'clock'" class="phone-clock"><strong>{{ new Date(now).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) }}</strong><span>{{ new Date(now).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}) }}</span><p>角色闹钟记录</p></div>
        <div v-if="['notes','browser','calls'].includes(app.kind)" class="phone-filters"><button :class="{selected:filter==='all'}" @click="filter='all'">全部</button><button v-if="app.kind==='calls'" :class="{selected:filter==='missed'}" @click="filter='missed'">未接</button><button v-else :class="{selected:filter==='pinned'}" @click="filter='pinned'">{{ app.kind==='browser' ? '收藏' : '置顶' }}</button></div>
        <div v-if="entries.length" class="phone-entry-list" :class="[{ 'phone-gallery': gallery, 'phone-note-grid': app.kind === 'notes', 'phone-feed': app.kind === 'feed' || app.kind === 'page', 'phone-dashboard': app.kind === 'dashboard' }, `kind-${app.kind}`]">
          <button v-for="entry in entries" :key="entry.id" class="phone-entry" @click="open(entry)">
            <template v-if="gallery"><img v-if="phoneEntryImage(entry)" :src="phoneEntryImage(entry)" :alt="entry.title" loading="lazy"><div v-else class="phone-photo-placeholder"><PhoneIcon name="photos"/><small>照片描述</small></div></template>
            <PhoneIcon v-else-if="['files','calls','maps','browser','sms'].includes(app.kind)" :name="app.kind"/>
            <div class="phone-entry-copy"><small v-if="app.kind==='clock'" class="phone-alarm-time">{{ entry.meta?.alarmTime || '未设时间' }} · {{ entry.meta?.enabled ? '已开启' : '已关闭' }}</small><small v-if="app.kind==='calls'">{{ entry.meta?.direction === 'missed' ? '未接' : entry.meta?.direction === 'outgoing' ? '呼出' : entry.meta?.direction === 'incoming' ? '呼入' : '通话记录' }}</small><small v-if="app.kind==='sms' && entry.meta?.sender">{{ entry.meta.sender }}</small><b>{{ entry.meta?.pinned ? '· ' : '' }}{{ entry.title }}</b><span>{{ entry.subtitle || entry.content || '查看详情' }}</span><small>{{ dateLabel(entry) }}</small></div>
          </button>
        </div>
        <div v-else class="phone-empty"><PhoneIcon :name="app.kind"/><h3>{{ query || selectedDate || filter !== 'all' ? '没有符合条件的记录' : '这里还没有内容' }}</h3><p>{{ query || selectedDate || filter !== 'all' ? '试试其他关键词或筛选条件。' : '可以手动添加，也可以在右上角管理中按人设生成。' }}</p><button v-if="!query && !selectedDate && filter==='all'" @click="edit()">添加记录</button></div>
      </div>
    </template>
    <div v-if="confirmDiscard || confirmRemove || confirmReplace" class="phone-overlay" role="dialog" aria-modal="true" aria-label="确认操作">
      <div class="phone-sheet"><h3>{{ confirmDiscard ? '保留未保存的修改？' : confirmRemove ? '删除这条记录？' : '重新生成内容？' }}</h3><p>{{ confirmDiscard ? '离开编辑会丢弃本次修改。' : confirmRemove ? '删除后可以通过提示中的撤销恢复。' : '替换本应用已标记的生成记录，手动内容和来源不明的旧记录会保留。' }}</p><div class="phone-actions"><button @click="confirmDiscard=false;confirmRemove=false;confirmReplace=false">取消</button><button v-if="confirmDiscard" @click="confirmDiscard=false;editing=false">放弃修改</button><button v-else-if="confirmRemove" class="danger-text" @click="emit('remove',selected!);confirmRemove=false;selected=null">删除</button><button v-else :disabled="busy" @click="emit('refresh','replace-generated');confirmReplace=false">确认刷新</button></div></div>
    </div>
  </div>
</template>
