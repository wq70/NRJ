<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useFate } from '../composables/useFate'
import { fateCategories, fateMethods, todayFatePreview } from '../services/fateEngine'
import type { FateCategory, FateMethod, FateProfile, FateReading, FateTargetKind, FateView } from '../types/fate'
import './app_Fate.css'

defineEmits<{ (event: 'close'): void }>()

const fate = useFate()
const view = ref<FateView>('today')
const selectedMethod = ref<FateMethod | null>(null)
const activeReading = ref<FateReading | null>(null)
const question = ref('')
const targetKind = ref<FateTargetKind>('self')
const targetId = ref('')
const profileId = ref('')
const category = ref<'all' | FateCategory>('all')
const search = ref('')
const toast = ref('')
const profileSheet = ref(false)
const profileEditingId = ref('')
const aiConfirm = ref(false)
const deleteConfirm = ref(false)
const resetConfirm = ref(false)
const profileDeleteTarget = ref<FateProfile | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const ritualStep = ref<'compose' | 'ritual'>('compose')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const profileDraft = reactive({ name: '', birthday: '', birthTime: '12:00', gender: '女' as '男' | '女', birthplace: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
const today = computed(() => todayFatePreview())
const selectedProfile = computed(() => fate.state.profiles.find(item => item.id === profileId.value) || fate.defaultProfile.value || null)
const selectedCharacter = computed(() => fate.characters.value.find(item => item.id === targetId.value) || null)
const currentMethodFavorite = computed(() => selectedMethod.value ? fate.state.favoriteMethodIds.includes(selectedMethod.value.id) : false)
const isActiveSaved = computed(() => activeReading.value ? fate.state.readings.some(item => item.id === activeReading.value?.id) : false)
const groupedMethods = computed(() => fateCategories.map(group => ({ ...group, methods: filteredMethods.value.filter(item => item.category === group.id) })).filter(group => group.methods.length))
const filteredMethods = computed(() => {
  const keyword = search.value.trim().toLowerCase()
  return fateMethods.filter(item => (category.value === 'all' || item.category === category.value) && (!keyword || `${item.name}${item.description}${item.tags.join('')}`.toLowerCase().includes(keyword)))
})
const recommendedMethods = computed(() => {
  const text = question.value
  if (/梦|睡|醒/.test(text)) return fateMethods.filter(item => ['dream', 'oracle', 'tarot'].includes(item.id))
  if (/是吗|能否|可不可以|要不要/.test(text)) return fateMethods.filter(item => ['pendulum', 'iching', 'tarot'].includes(item.id))
  if (/选择|还是|哪个|两难/.test(text)) return fateMethods.filter(item => ['choice', 'tarot', 'astrology-dice'].includes(item.id))
  if (/TA|他|她|关系|感情|喜欢|想我/.test(text)) return fateMethods.filter(item => ['relationship', 'tarot', 'lenormand'].includes(item.id))
  return fateMethods.filter(item => ['tarot', 'iching', 'oracle'].includes(item.id))
})
const requiresProfile = (method?: FateMethod | null) => ['bazi', 'ziwei', 'zodiac', 'numerology'].includes(method?.id || '')
const formatTime = (timestamp: number) => new Date(timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const factsEntries = computed(() => activeReading.value ? Object.entries(activeReading.value.facts) : [])

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const openMethod = (method: FateMethod, preserveQuestion = true) => {
  selectedMethod.value = method
  activeReading.value = null
  ritualStep.value = 'compose'
  if (!preserveQuestion) question.value = ''
  if (!profileId.value && fate.defaultProfile.value) profileId.value = fate.defaultProfile.value.id
  view.value = 'ask'
}

const backFromAsk = () => {
  if (activeReading.value) { activeReading.value = null; ritualStep.value = 'compose'; return }
  selectedMethod.value = null
  view.value = 'today'
}

const startRitual = () => {
  if (!selectedMethod.value) { notify('请先选择一种玩法'); return }
  if (requiresProfile(selectedMethod.value) && !selectedProfile.value) { openNewProfile(); notify('这个工具需要出生档案'); return }
  if (targetKind.value === 'character' || targetKind.value === 'relationship') {
    if (!selectedCharacter.value) { notify('请先选择一位角色'); return }
  }
  ritualStep.value = fate.state.settings.reducedRitual ? 'compose' : 'ritual'
  if (fate.state.settings.reducedRitual) void drawReading()
}

const drawReading = async () => {
  if (!selectedMethod.value) return
  try {
    activeReading.value = await fate.generateReading({
      method: selectedMethod.value,
      question: question.value,
      targetKind: targetKind.value,
      targetId: selectedCharacter.value?.id,
      targetName: selectedCharacter.value?.name,
      profile: selectedProfile.value,
      allowReversed: fate.state.settings.allowReversed
    })
    ritualStep.value = 'compose'
  } catch (cause) { notify(cause instanceof Error ? cause.message : '暂时无法生成结果') }
}

const openReading = (reading: FateReading) => {
  activeReading.value = JSON.parse(JSON.stringify(reading))
  selectedMethod.value = fateMethods.find(item => item.id === reading.methodId) || null
  targetKind.value = reading.targetKind
  targetId.value = reading.targetId || ''
  profileId.value = reading.profileId || profileId.value
  view.value = 'ask'
}

const navigate = (target: FateView) => {
  view.value = target
  if (target === 'ask') { selectedMethod.value = null; activeReading.value = null; ritualStep.value = 'compose' }
}

const saveActiveReading = async () => {
  if (!activeReading.value) return
  await fate.saveReading(activeReading.value)
  notify('已保存到灵签册')
}

const toggleActiveFavorite = async () => {
  if (!activeReading.value) return
  activeReading.value.favorite = !activeReading.value.favorite
  await fate.saveReading(activeReading.value)
  notify(activeReading.value.favorite ? '已收藏' : '已取消收藏')
}

const saveReflection = async (reflection: FateReading['reflection']) => {
  if (!activeReading.value) return
  activeReading.value.reflection = reflection
  await fate.saveReading(activeReading.value)
  notify('复盘已保存')
}

const saveNote = async (event: Event) => {
  if (!activeReading.value) return
  activeReading.value.note = (event.target as HTMLTextAreaElement).value.trim()
  await fate.saveReading(activeReading.value)
  notify('笔记已保存')
}

const toggleChatInfluence = async () => {
  if (!activeReading.value?.targetId) return
  if (!fate.state.settings.chatIntegrationEnabled || !fate.state.settings.includeReadingsInChatPrompt) {
    notify('请先在“我的”中开启聊天联动与结果读取')
    return
  }
  if (!isActiveSaved.value) {
    notify('请先保存这份结果，再单独授权给聊天')
    return
  }
  activeReading.value.chatInfluence = !activeReading.value.chatInfluence
  await fate.saveReading(activeReading.value)
  notify(activeReading.value.chatInfluence ? '这份结果已允许相关角色聊天参考' : '这份结果已与聊天隔离')
}

const requestAi = () => {
  if (!activeReading.value) return
  if (fate.state.settings.confirmBeforeAi) aiConfirm.value = true
  else void runAi()
}

const runAi = async () => {
  if (!activeReading.value) return
  aiConfirm.value = false
  try { await fate.interpretWithAi(activeReading.value, selectedCharacter.value); notify('深度解读已完成') }
  catch (cause) { notify(cause instanceof Error ? cause.message : 'AI 解读失败') }
}

const shareReading = async () => {
  if (!activeReading.value) return
  const text = `${activeReading.value.methodName}｜${activeReading.value.question}\n${activeReading.value.summary}\n${activeReading.value.guidance}\n\n仅供娱乐与自我反思。`
  try {
    if (navigator.share) await navigator.share({ title: '缘分 · 我的解读', text })
    else { await navigator.clipboard.writeText(text); notify('结果已复制') }
  } catch (cause) { if ((cause as Error)?.name !== 'AbortError') notify('暂时无法分享') }
}

const deleteActiveReading = async () => {
  if (!activeReading.value) return
  await fate.deleteReading(activeReading.value.id)
  activeReading.value = null
  deleteConfirm.value = false
  view.value = 'journal'
  notify('记录已删除')
}

const openNewProfile = () => {
  profileEditingId.value = ''
  Object.assign(profileDraft, { name: '', birthday: '', birthTime: '12:00', gender: '女', birthplace: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  profileSheet.value = true
}

const openEditProfile = (profile: FateProfile) => {
  profileEditingId.value = profile.id
  Object.assign(profileDraft, { name: profile.name, birthday: profile.birthday, birthTime: profile.birthTime, gender: profile.gender, birthplace: profile.birthplace, timezone: profile.timezone })
  profileSheet.value = true
}

const saveProfile = async () => {
  if (!profileDraft.name.trim() || !profileDraft.birthday) { notify('请填写档案名称和出生日期'); return }
  const payload = { name: profileDraft.name.trim(), birthday: profileDraft.birthday, birthTime: profileDraft.birthTime || '12:00', gender: profileDraft.gender, birthplace: profileDraft.birthplace.trim(), timezone: profileDraft.timezone.trim() || Intl.DateTimeFormat().resolvedOptions().timeZone }
  if (profileEditingId.value) await fate.updateProfile(profileEditingId.value, payload)
  else { const profile = await fate.createProfile(payload); profileId.value = profile.id }
  profileSheet.value = false
  notify('出生档案已保存')
}

const confirmDeleteProfile = async () => {
  if (!profileDeleteTarget.value) return
  await fate.deleteProfile(profileDeleteTarget.value.id)
  if (profileId.value === profileDeleteTarget.value.id) profileId.value = fate.defaultProfile.value?.id || ''
  profileDeleteTarget.value = null
  notify('出生档案已删除')
}

const downloadExport = () => {
  const blob = new Blob([JSON.stringify(fate.exportData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `缘分备份-${new Date().toISOString().slice(0, 10)}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const importBackup = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { await fate.importData(JSON.parse(await file.text())); notify('缘分数据已导入') }
  catch { notify('无法识别这个备份文件') }
  ;(event.target as HTMLInputElement).value = ''
}

const applyReset = async () => { await fate.resetAll(); resetConfirm.value = false; activeReading.value = null; selectedMethod.value = null; view.value = 'today'; notify('缘分数据已清空') }

onMounted(async () => { await fate.initialize(); if (fate.defaultProfile.value) profileId.value = fate.defaultProfile.value.id })
onBeforeUnmount(() => { if (toastTimer) clearTimeout(toastTimer) })
</script>

<template>
  <div class="fate-app">
    <header class="fate-header">
      <button class="fate-icon-button" type="button" :aria-label="view==='ask'?'返回':'关闭缘分'" @click="view==='ask'?backFromAsk():$emit('close')">‹</button>
      <div><h1>{{ view==='ask' ? (activeReading ? activeReading.methodName : selectedMethod?.name || '问缘') : '缘分' }}</h1><p>{{ view==='ask' ? (activeReading ? '原始结果与解释分开保存' : '写下问题，再选择一种看见方式') : '万象可问，答案仍在你手中' }}</p></div>
      <button v-if="view==='ask' && activeReading" class="fate-icon-button fate-share-head" type="button" aria-label="分享结果" @click="shareReading">享</button>
      <button v-else class="fate-icon-button fate-profile-head" type="button" aria-label="出生档案" @click="view='profile'">我</button>
    </header>

    <Transition name="fate-toast"><div v-if="toast" class="fate-toast" role="status">{{ toast }}</div></Transition>

    <main v-if="view==='today'" class="fate-scroll">
      <section class="fate-hero">
        <div class="fate-orbit" aria-hidden="true"><i></i><i></i><i></i><span>缘</span></div>
        <div class="fate-hero-copy"><small>{{ new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}) }}</small><h2>{{ today.summary }}</h2><p>{{ today.guidance }}</p></div>
      </section>

      <section class="fate-question-card">
        <label for="fate-home-question">此刻最想知道什么？</label>
        <div><input id="fate-home-question" v-model="question" maxlength="300" placeholder="关系、选择、心情，或任何困惑"><button type="button" @click="selectedMethod=null;view='ask'">去问</button></div>
        <div class="fate-quick-prompts"><button v-for="prompt in ['TA可能怎么想','今天提醒我什么','两个选择怎么看','最近的关系状态']" :key="prompt" type="button" @click="question=prompt;targetKind=prompt.includes('TA')||prompt.includes('关系')?'relationship':'self';selectedMethod=null;view='ask'">{{ prompt }}</button></div>
      </section>

      <div class="fate-section-title"><div><h3>常用术式</h3><p>可以在万象中收藏或取消</p></div><button type="button" @click="view='explore'">查看全部</button></div>
      <section class="fate-method-grid featured">
        <button v-for="method in fate.favoriteMethods.value" :key="method!.id" type="button" :style="{'--method-accent':method!.accent}" @click="openMethod(method as FateMethod,false)"><span>{{ method!.glyph }}</span><strong>{{ method!.shortName }}</strong><small>{{ method!.tags[0] }}</small></button>
      </section>

      <div class="fate-section-title"><div><h3>今天的历</h3><p>来自设备当前时间</p></div></div>
      <section class="fate-today-facts">
        <article v-for="([key,value]) in Object.entries(today.facts).slice(0,6)" :key="key"><small>{{ key }}</small><strong>{{ Array.isArray(value)?value.slice(0,4).join(' · '):value }}</strong></article>
      </section>

      <template v-if="fate.recentReadings.value.length">
        <div class="fate-section-title"><div><h3>最近回响</h3><p>重新查看、记录现实反馈</p></div><button type="button" @click="view='journal'">灵签册</button></div>
        <section class="fate-recent-list"><button v-for="reading in fate.recentReadings.value.slice(0,3)" :key="reading.id" type="button" @click="openReading(reading)"><span>{{ fateMethods.find(item=>item.id===reading.methodId)?.glyph || '缘' }}</span><div><strong>{{ reading.methodName }} · {{ reading.question }}</strong><p>{{ reading.summary }}</p></div><time>{{ formatTime(reading.createdAt) }}</time></button></section>
      </template>
      <p class="fate-disclaimer">所有结果仅供娱乐与自我反思，不替代现实证据及专业建议。</p>
    </main>

    <main v-else-if="view==='explore'" class="fate-scroll">
      <div class="fate-search"><span>⌕</span><input v-model="search" placeholder="搜索塔罗、八字、梦境、选择……"></div>
      <div class="fate-category-tabs"><button type="button" :class="{active:category==='all'}" @click="category='all'">全部</button><button v-for="item in fateCategories" :key="item.id" type="button" :class="{active:category===item.id}" @click="category=item.id">{{ item.name }}</button></div>
      <section v-for="group in groupedMethods" :key="group.id" class="fate-catalog-group">
        <header><span>{{ group.glyph }}</span><div><h2>{{ group.name }}</h2><p>{{ group.methods.length }} 种可用玩法</p></div></header>
        <div class="fate-catalog-list"><button v-for="method in group.methods" :key="method.id" type="button" :style="{'--method-accent':method.accent}" @click="openMethod(method,false)"><span>{{ method.glyph }}</span><div><strong>{{ method.name }}</strong><p>{{ method.description }}</p><small>{{ method.tags.join(' · ') }}</small></div><em>›</em></button></div>
      </section>
      <section v-if="!filteredMethods.length" class="fate-empty"><span>寻</span><strong>没有找到对应玩法</strong><p>换一个关键词，或回到“全部”浏览。</p></section>
    </main>

    <main v-else-if="view==='journal'" class="fate-scroll">
      <section v-if="fate.recentReadings.value.length" class="fate-journal-summary"><div><small>已保存</small><strong>{{ fate.recentReadings.value.length }}</strong><span>次问缘</span></div><div><small>收藏</small><strong>{{ fate.recentReadings.value.filter(item=>item.favorite).length }}</strong><span>份结果</span></div><div><small>已复盘</small><strong>{{ fate.recentReadings.value.filter(item=>item.reflection).length }}</strong><span>次现实反馈</span></div></section>
      <section v-if="fate.recentReadings.value.length" class="fate-journal-list"><button v-for="reading in fate.recentReadings.value" :key="reading.id" type="button" @click="openReading(reading)"><span :style="{color:fateMethods.find(item=>item.id===reading.methodId)?.accent}">{{ fateMethods.find(item=>item.id===reading.methodId)?.glyph || '缘' }}</span><div><small>{{ reading.methodName }} · {{ reading.targetName || reading.profileName || '自己' }}</small><strong>{{ reading.question }}</strong><p>{{ reading.summary }}</p></div><aside><b v-if="reading.favorite">★</b><time>{{ formatTime(reading.createdAt) }}</time></aside></button></section>
      <section v-else class="fate-empty"><span>册</span><strong>灵签册还是空的</strong><p>每次完成的结果会保留原始盘面，方便之后复盘。</p><button type="button" @click="view='explore'">去看看玩法</button></section>
    </main>

    <main v-else-if="view==='profile'" class="fate-scroll fate-settings">
      <div class="fate-section-title first"><div><h3>出生档案</h3><p>仅保存在当前设备，可建立多个档案</p></div><button type="button" @click="openNewProfile">新增</button></div>
      <section v-if="fate.state.profiles.length" class="fate-profile-list"><article v-for="profile in fate.state.profiles" :key="profile.id"><button type="button" @click="profileId=profile.id;openEditProfile(profile)"><span>{{ profile.name.slice(0,1) }}</span><div><strong>{{ profile.name }} <em v-if="profile.isDefault">默认</em></strong><p>{{ profile.birthday }} {{ profile.birthTime }} · {{ profile.gender }}<template v-if="profile.birthplace"> · {{ profile.birthplace }}</template></p></div><b>›</b></button></article></section>
      <section v-else class="fate-profile-empty"><span>命</span><div><strong>还没有出生档案</strong><p>八字、紫微、星座和数字工具会用到日期与时间。</p></div><button type="button" @click="openNewProfile">建立</button></section>

      <div class="fate-section-title"><div><h3>解读偏好</h3><p>不影响其他应用的设置</p></div></div>
      <section class="fate-setting-card">
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({allowReversed:!fate.state.settings.allowReversed})"><span><strong>塔罗与符文逆位</strong><small>抽取时允许约 28% 的逆位</small></span><i :class="{on:fate.state.settings.allowReversed}"><b></b></i></button>
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({reducedRitual:!fate.state.settings.reducedRitual})"><span><strong>跳过仪式动画</strong><small>点击开始后直接呈现结果</small></span><i :class="{on:fate.state.settings.reducedRitual}"><b></b></i></button>
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({saveHistory:!fate.state.settings.saveHistory})"><span><strong>自动保存记录</strong><small>关闭后仍可在结果页手动保存</small></span><i :class="{on:fate.state.settings.saveHistory}"><b></b></i></button>
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({confirmBeforeAi:!fate.state.settings.confirmBeforeAi})"><span><strong>AI 调用前确认</strong><small>显示将发送的数据范围</small></span><i :class="{on:fate.state.settings.confirmBeforeAi}"><b></b></i></button>
      </section>

      <div class="fate-section-title"><div><h3>聊天联动</h3><p>全部默认关闭，必须逐层主动授权</p></div></div>
      <section class="fate-setting-card">
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({chatIntegrationEnabled:!fate.state.settings.chatIntegrationEnabled})"><span><strong>允许缘分影响聊天</strong><small>总开关；关闭时任何结果都不会进入聊天提示词</small></span><i :class="{on:fate.state.settings.chatIntegrationEnabled}"><b></b></i></button>
        <button type="button" class="fate-switch-row" :disabled="!fate.state.settings.chatIntegrationEnabled" @click="fate.updateSettings({includeReadingsInChatPrompt:!fate.state.settings.includeReadingsInChatPrompt})"><span><strong>聊天可读取已授权结果</strong><small>还需在每一份角色结果中单独开启</small></span><i :class="{on:fate.state.settings.chatIntegrationEnabled&&fate.state.settings.includeReadingsInChatPrompt}"><b></b></i></button>
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({includeCharacterNameInAi:!fate.state.settings.includeCharacterNameInAi})"><span><strong>AI 解读可读取角色名称</strong><small>只在主动请求解读时发送；默认匿名</small></span><i :class="{on:fate.state.settings.includeCharacterNameInAi}"><b></b></i></button>
        <button type="button" class="fate-switch-row" @click="fate.updateSettings({includeCharacterPersona:!fate.state.settings.includeCharacterPersona})"><span><strong>AI 解读可读取角色人设</strong><small>只在主动请求解读时发送，不读取聊天记录</small></span><i :class="{on:fate.state.settings.includeCharacterPersona}"><b></b></i></button>
      </section>

      <div class="fate-section-title"><div><h3>数据</h3><p>导出、恢复或清除缘分应用数据</p></div></div>
      <section class="fate-setting-card"><button type="button" class="fate-action-row" @click="downloadExport"><span><strong>导出 JSON 备份</strong><small>包含档案、设置、盘面和复盘</small></span><em>导出</em></button><button type="button" class="fate-action-row" @click="importInput?.click()"><span><strong>导入备份</strong><small>导入前会校验并规范数据结构</small></span><em>导入</em></button><button type="button" class="fate-action-row danger" @click="resetConfirm=true"><span><strong>清空缘分数据</strong><small>不会影响聊天或其他应用</small></span><em>清空</em></button></section>
      <input ref="importInput" class="fate-hidden-file" type="file" accept="application/json,.json" @change="importBackup">
      <p class="fate-disclaimer">出生时间和问题默认只保存在设备上。只有主动点击 AI 深度解读时才会发送结构化结果。</p>
    </main>

    <main v-else-if="view==='ask'" class="fate-scroll fate-ask-scroll">
      <template v-if="activeReading">
        <section class="fate-result-hero" :style="{'--method-accent':selectedMethod?.accent || '#765b98'}"><small>{{ activeReading.methodName }} · {{ activeReading.targetName || activeReading.profileName || '为自己' }}</small><h2>{{ activeReading.question }}</h2><p>{{ activeReading.summary }}</p><div><button v-if="!isActiveSaved" type="button" @click="saveActiveReading">保存</button><button type="button" @click="toggleActiveFavorite">{{ activeReading.favorite?'★ 已收藏':'☆ 收藏' }}</button><button type="button" @click="shareReading">分享</button></div></section>
        <div class="fate-section-title"><div><h3>原始结果</h3><p>算法结果固定保存，AI 不会改动</p></div></div>
        <section class="fate-reading-items" :class="{'palace-grid':activeReading.methodId==='ziwei','pillar-grid':activeReading.methodId==='bazi'}"><article v-for="item in activeReading.items" :key="item.id"><header><span>{{ item.glyph }}</span><div><small>{{ item.position }}</small><strong>{{ item.name }}<em v-if="item.reversed">逆位</em></strong></div></header><div class="fate-keywords"><b v-for="keyword in item.keywords" :key="keyword">{{ keyword }}</b></div><p>{{ item.meaning }}</p></article></section>
        <details v-if="factsEntries.length" class="fate-facts"><summary>查看计算资料与参数</summary><dl><template v-for="([key,value]) in factsEntries" :key="key"><dt>{{ key }}</dt><dd>{{ Array.isArray(value)?value.join(' · '):value }}</dd></template></dl><small>引擎版本 {{ activeReading.engineVersion }} · 记录种子 {{ activeReading.seed }}</small></details>
        <section class="fate-guidance"><span>照</span><div><small>给现实的提醒</small><p>{{ activeReading.guidance }}</p></div></section>
        <section v-if="activeReading.targetId" class="fate-setting-card fate-result-permission"><button type="button" class="fate-switch-row" :disabled="!fate.state.settings.chatIntegrationEnabled||!fate.state.settings.includeReadingsInChatPrompt" @click="toggleChatInfluence"><span><strong>允许这份结果影响相关角色聊天</strong><small v-if="!fate.state.settings.chatIntegrationEnabled||!fate.state.settings.includeReadingsInChatPrompt">总开关未完整开启，当前与聊天隔离</small><small v-else-if="!isActiveSaved">保存结果后才能单独授权</small><small v-else>仅提供象征参考，无关时不会主动提起</small></span><i :class="{on:activeReading.chatInfluence&&fate.state.settings.chatIntegrationEnabled&&fate.state.settings.includeReadingsInChatPrompt}"><b></b></i></button></section>
        <section v-if="activeReading.aiInterpretation" class="fate-ai-result"><header><span>解</span><div><strong>AI 深度解读</strong><small>基于上方原始结果，不代表事实判断</small></div></header><p>{{ activeReading.aiInterpretation }}</p></section>
        <button v-else class="fate-ai-button" type="button" :disabled="fate.busy.value" @click="requestAi"><span>解</span><div><strong>{{ fate.busy.value?'正在解读…':'结合问题深度解读' }}</strong><small>使用已配置的 API；没有配置也不影响基础玩法</small></div><b>›</b></button>
        <section class="fate-reflection"><header><strong>现实后来怎么样？</strong><small>复盘不是给占卜打分，而是看见自己的判断方式</small></header><div><button v-for="item in [{id:'matched',name:'有对应'},{id:'partial',name:'部分对应'},{id:'different',name:'不太一样'}]" :key="item.id" type="button" :class="{active:activeReading.reflection===item.id}" @click="saveReflection(item.id as FateReading['reflection'])">{{ item.name }}</button></div><textarea :value="activeReading.note" maxlength="1000" placeholder="写下你的感受或实际发生的事……" @change="saveNote"></textarea></section>
        <button class="fate-delete-reading" type="button" @click="deleteConfirm=true">删除这份记录</button>
        <p class="fate-disclaimer">{{ activeReading.caution }}</p>
      </template>

      <template v-else-if="ritualStep==='ritual' && selectedMethod">
        <section class="fate-ritual" :style="{'--method-accent':selectedMethod.accent}"><div class="fate-ritual-symbol"><i></i><i></i><span>{{ selectedMethod.glyph }}</span></div><small>{{ selectedMethod.name }}</small><h2>把问题留在心里</h2><p>当你准备好时，轻触下方按钮。结果由本次随机种子固定，不会因返回页面而改变。</p><button type="button" @click="drawReading">我准备好了</button><button class="secondary" type="button" @click="ritualStep='compose'">返回修改问题</button></section>
      </template>

      <template v-else>
        <section v-if="selectedMethod" class="fate-method-intro" :style="{'--method-accent':selectedMethod.accent}"><span>{{ selectedMethod.glyph }}</span><div><small>{{ selectedMethod.tags.join(' · ') }}</small><h2>{{ selectedMethod.name }}</h2><p>{{ selectedMethod.description }}</p></div><button type="button" :aria-label="currentMethodFavorite?'取消常用':'加入常用'" @click="fate.toggleFavoriteMethod(selectedMethod.id)">{{ currentMethodFavorite?'★':'☆' }}</button></section>
        <section class="fate-compose-card">
          <label><span>想问什么</span><textarea v-model="question" maxlength="300" :placeholder="selectedMethod?.questionHint || '写下此刻最在意的问题……'"></textarea></label>
          <div class="fate-target-tabs"><button v-for="item in [{id:'self',name:'关于自己'},{id:'character',name:'关于TA'},{id:'relationship',name:'这段关系'},{id:'general',name:'不设对象'}]" :key="item.id" type="button" :class="{active:targetKind===item.id}" @click="targetKind=item.id as FateTargetKind">{{ item.name }}</button></div>
          <label v-if="targetKind==='character'||targetKind==='relationship'" class="fate-field"><span>选择角色</span><select v-model="targetId"><option value="">请选择</option><option v-for="character in fate.characters.value" :key="character.id" :value="character.id">{{ character.name }}</option></select><small>仅用于本次显示；不会给角色发送消息。</small></label>
          <label v-if="requiresProfile(selectedMethod)" class="fate-field"><span>出生档案</span><select v-model="profileId"><option value="">请选择</option><option v-for="profile in fate.state.profiles" :key="profile.id" :value="profile.id">{{ profile.name }} · {{ profile.birthday }}</option></select><button type="button" @click="openNewProfile">新建档案</button></label>
          <button v-if="selectedMethod" class="fate-primary" type="button" @click="startRitual">开始 {{ selectedMethod.shortName }}</button>
        </section>
        <template v-if="!selectedMethod">
          <div class="fate-section-title"><div><h3>适合这个问题</h3><p>只是推荐，也可以去万象自行选择</p></div><button type="button" @click="view='explore'">全部玩法</button></div>
          <section class="fate-recommend-list"><button v-for="method in recommendedMethods" :key="method.id" type="button" :style="{'--method-accent':method.accent}" @click="openMethod(method)"><span>{{ method.glyph }}</span><div><strong>{{ method.name }}</strong><p>{{ method.description }}</p></div><em>选择</em></button></section>
        </template>
        <p class="fate-disclaimer">不要提交身份证号、住址等不必要的敏感信息。</p>
      </template>
    </main>

    <nav v-if="view!=='ask'" class="fate-tabs" aria-label="缘分导航"><button v-for="item in [{id:'today',glyph:'今',name:'今日'},{id:'ask',glyph:'问',name:'问缘'},{id:'explore',glyph:'象',name:'万象'},{id:'journal',glyph:'册',name:'灵签册'},{id:'profile',glyph:'我',name:'我的'}]" :key="item.id" type="button" :class="{active:view===item.id}" @click="navigate(item.id as FateView)"><span>{{ item.glyph }}</span><small>{{ item.name }}</small></button></nav>

    <div v-if="profileSheet" class="fate-layer" @click.self="profileSheet=false"><section class="fate-sheet"><header><button type="button" @click="profileSheet=false">取消</button><strong>{{ profileEditingId?'编辑出生档案':'新建出生档案' }}</strong><button type="button" @click="saveProfile">保存</button></header><div class="fate-sheet-body"><label><span>档案名称</span><input v-model="profileDraft.name" maxlength="30" placeholder="例如：我"></label><div class="fate-form-grid"><label><span>出生日期</span><input v-model="profileDraft.birthday" type="date"></label><label><span>出生时间</span><input v-model="profileDraft.birthTime" type="time"></label></div><div class="fate-form-grid"><label><span>性别（用于传统排盘）</span><select v-model="profileDraft.gender"><option value="女">女</option><option value="男">男</option></select></label><label><span>时区</span><input v-model="profileDraft.timezone" maxlength="60"></label></div><label><span>出生地点（可选备注）</span><input v-model="profileDraft.birthplace" maxlength="80" placeholder="城市或地区"></label><p>八字与紫微使用日期、时间和传统性别参数排盘；地点目前只作备注，不会自动联网查询。</p><template v-if="profileEditingId"><button class="fate-default-profile" type="button" @click="fate.updateProfile(profileEditingId,{isDefault:true});profileSheet=false">设为默认档案</button><button class="fate-remove-profile" type="button" @click="profileDeleteTarget=fate.state.profiles.find(item=>item.id===profileEditingId) || null;profileSheet=false">删除这个档案</button></template></div></section></div>

    <div v-if="aiConfirm" class="fate-dialog-layer"><section class="fate-dialog"><span>解</span><h2>发送给 AI 解读？</h2><p>将发送问题与原始盘面。<template v-if="selectedCharacter && fate.state.settings.includeCharacterNameInAi">还会发送所选角色名称。</template><template v-if="selectedCharacter && fate.state.settings.includeCharacterPersona">还会发送所选角色的人设摘要。</template>不会发送聊天记录，也不会写入角色记忆。</p><div><button type="button" @click="aiConfirm=false">取消</button><button class="primary" type="button" @click="runAi">确认发送</button></div></section></div>
    <div v-if="deleteConfirm" class="fate-dialog-layer"><section class="fate-dialog"><span>删</span><h2>删除这份记录？</h2><p>删除后无法从灵签册恢复，不会影响其他应用数据。</p><div><button type="button" @click="deleteConfirm=false">取消</button><button class="danger" type="button" @click="deleteActiveReading">删除</button></div></section></div>
    <div v-if="resetConfirm" class="fate-dialog-layer"><section class="fate-dialog"><span>清</span><h2>清空缘分数据？</h2><p>档案、设置和全部记录都会删除。聊天、角色及其他应用不受影响。</p><div><button type="button" @click="resetConfirm=false">取消</button><button class="danger" type="button" @click="applyReset">全部清空</button></div></section></div>
    <div v-if="profileDeleteTarget" class="fate-dialog-layer"><section class="fate-dialog"><span>删</span><h2>删除“{{ profileDeleteTarget.name }}”？</h2><p>已有占卜记录仍会保留当时的档案名称，但不能再用这个档案重新排盘。</p><div><button type="button" @click="profileDeleteTarget=null">取消</button><button class="danger" type="button" @click="confirmDeleteProfile">删除档案</button></div></section></div>
  </div>
</template>
