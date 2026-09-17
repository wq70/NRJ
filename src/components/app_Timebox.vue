<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useTimebox } from '../composables/useTimebox'
import { formatClockMs, localDateKey } from '../services/timeboxEngine'
import type { TimeboxMode, TimeboxOutcome, TimeboxSettings, TimeboxTask } from '../types/timebox'

defineEmits<{ (event: 'close'): void }>()

const timebox = useTimebox()
const view = ref<'today' | 'plan' | 'focus' | 'records' | 'settings'>('today')
const toast = ref('')
const taskSheet = ref(false)
const taskDetail = ref<TimeboxTask | null>(null)
const deleteTarget = ref<TimeboxTask | null>(null)
const resetConfirm = ref(false)
const importInput = ref<HTMLInputElement | null>(null)
const quickTitle = ref('')
const quickMinutes = ref(25)
const quickMode = ref<TimeboxMode>('countdown')
const reviewOutcome = ref<TimeboxOutcome>('completed')
const reviewNote = ref('')
const interruptionReason = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const blankTask = () => ({ title: '', note: '', project: '', tags: '', estimateMinutes: 25, scheduledDate: '', scheduledTime: '', deadline: '', definitionOfDone: '', priority: 0, energy: 'medium' as const, allowSplit: true })
const taskDraft = ref(blankTask())

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const pad = (value: number) => String(value).padStart(2, '0')
const dateInputValue = (timestamp: number | null) => timestamp ? `${new Date(timestamp).getFullYear()}-${pad(new Date(timestamp).getMonth() + 1)}-${pad(new Date(timestamp).getDate())}` : ''
const timeInputValue = (timestamp: number | null) => timestamp ? `${pad(new Date(timestamp).getHours())}:${pad(new Date(timestamp).getMinutes())}` : ''
const datetimeInputValue = (timestamp: number | null) => timestamp ? `${dateInputValue(timestamp)}T${timeInputValue(timestamp)}` : ''
const formatDate = (timestamp: number | null) => timestamp ? new Date(timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未安排'
const formatDuration = (milliseconds: number) => {
  const minutes = Math.round(milliseconds / 60000)
  if (minutes < 60) return `${minutes} 分钟`
  return `${Math.floor(minutes / 60)} 小时 ${minutes % 60 ? `${minutes % 60} 分` : ''}`.trim()
}

const activeDisplay = computed(() => {
  const session = timebox.activeSession.value
  if (!session) return '00:00'
  return session.mode === 'stopwatch' || session.mode === 'flowtime'
    ? formatClockMs(timebox.elapsedMs.value)
    : formatClockMs(timebox.remainingMs.value)
})
const activeProgress = computed(() => {
  const session = timebox.activeSession.value
  if (!session || session.mode === 'stopwatch' || session.mode === 'flowtime') return 0
  return Math.max(0, Math.min(100, 100 - timebox.remainingMs.value / (session.plannedMinutes * 60000) * 100))
})
const plannedTodayMinutes = computed(() => timebox.todayTasks.value.reduce((sum, task) => sum + task.estimateMinutes, 0))
const inboxTasks = computed(() => timebox.state.tasks.filter(item => item.status === 'inbox'))
const plannedTasks = computed(() => timebox.state.tasks.filter(item => item.status !== 'cancelled' && item.status !== 'completed' && item.scheduledStart).sort((a, b) => (a.scheduledStart || 0) - (b.scheduledStart || 0)))
const recentSessions = computed(() => timebox.completedSessions.value.slice().sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)))
const totalFocusMs = computed(() => timebox.completedSessions.value.reduce((sum, item) => sum + item.actualFocusMs, 0))
const completionRate = computed(() => {
  const sessions = timebox.completedSessions.value
  if (!sessions.length) return 0
  return Math.round(sessions.filter(item => item.outcome === 'completed').length / sessions.length * 100)
})
const estimationAccuracy = computed(() => {
  const comparable = timebox.completedSessions.value.filter(item => item.plannedMinutes > 0 && item.actualFocusMs > 0)
  if (!comparable.length) return 0
  const error = comparable.reduce((sum, item) => sum + Math.abs(item.actualFocusMs / 60000 - item.plannedMinutes) / item.plannedMinutes, 0) / comparable.length
  return Math.max(0, Math.round((1 - Math.min(1, error)) * 100))
})
const weekBars = computed(() => Array.from({ length: 7 }, (_, offset) => {
  const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (6 - offset))
  const key = localDateKey(date.getTime())
  const minutes = timebox.completedSessions.value.filter(item => item.finishedAt && localDateKey(item.finishedAt) === key).reduce((sum, item) => sum + item.actualFocusMs / 60000, 0)
  return { key, label: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()], minutes: Math.round(minutes) }
}))
const weekMax = computed(() => Math.max(30, ...weekBars.value.map(item => item.minutes)))
const selectedCharacter = computed(() => timebox.characters.value.find(item => String(item.characterEntityId || item.id) === String(timebox.state.settings.companionCharacterId)))
const notificationSupportText = computed(() => typeof Notification === 'undefined'
  ? '当前环境不支持'
  : Notification.permission === 'granted' ? '系统权限已授予' : '需要点击后申请权限')

const openNewTask = () => { taskDraft.value = blankTask(); taskSheet.value = true }
const openTask = (task: TimeboxTask) => { taskDetail.value = task }

const saveTask = () => {
  if (!taskDraft.value.title.trim()) { notify('请先填写任务名称'); return }
  let scheduledStart: number | null = null
  if (taskDraft.value.scheduledDate) {
    const time = taskDraft.value.scheduledTime || '09:00'
    scheduledStart = new Date(`${taskDraft.value.scheduledDate}T${time}:00`).getTime()
  }
  const deadline = taskDraft.value.deadline ? new Date(`${taskDraft.value.deadline}T23:59:00`).getTime() : null
  timebox.createTask({
    title: taskDraft.value.title, note: taskDraft.value.note, project: taskDraft.value.project,
    tags: taskDraft.value.tags.split(/[,，\s]+/).map(item => item.trim()).filter(Boolean), estimateMinutes: taskDraft.value.estimateMinutes,
    scheduledStart, deadline, definitionOfDone: taskDraft.value.definitionOfDone, priority: taskDraft.value.priority as 0 | 1 | 2 | 3,
    energy: taskDraft.value.energy, allowSplit: taskDraft.value.allowSplit
  })
  taskSheet.value = false; notify('任务已保存')
}

const rescheduleTask = (task: TimeboxTask, event: Event) => {
  const value = (event.target as HTMLInputElement).value
  if (!value) { timebox.updateTask(task.id, { scheduledStart: null, scheduledEnd: null, status: 'inbox' }); return }
  const timestamp = new Date(value).getTime()
  timebox.updateTask(task.id, { scheduledStart: timestamp, scheduledEnd: timestamp + task.estimateMinutes * 60000, status: 'planned' })
}

const editTaskText = (task: TimeboxTask, key: 'title' | 'project' | 'definitionOfDone' | 'note', event: Event) => {
  const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value.trim()
  if (key === 'title' && !value) { notify('任务名称不能为空'); (event.target as HTMLInputElement).value = task.title; return }
  timebox.updateTask(task.id, { [key]: value })
}

const editTaskMinutes = (task: TimeboxTask, event: Event) => {
  const input = event.target as HTMLInputElement
  const minutes = Math.max(1, Math.min(1440, Math.round(Number(input.value) || task.estimateMinutes)))
  timebox.updateTask(task.id, { estimateMinutes: minutes })
  input.value = String(minutes)
}

const startTask = async (task: TimeboxTask) => {
  try { await timebox.startSession(task.id, { mode: timebox.state.settings.defaultMode, minutes: task.estimateMinutes }); view.value = 'focus' }
  catch (cause) { notify(cause instanceof Error ? cause.message : '无法开始时间盒') }
}

const startQuick = async () => {
  try { await timebox.startSession(null, { title: quickTitle.value || '临时专注', mode: quickMode.value, minutes: quickMinutes.value }); view.value = 'focus'; quickTitle.value = '' }
  catch (cause) { notify(cause instanceof Error ? cause.message : '无法开始时间盒') }
}

const submitReview = async () => {
  await timebox.finishSession(reviewOutcome.value, reviewNote.value)
  reviewNote.value = ''; reviewOutcome.value = 'completed'; notify('本次时间盒已结算'); view.value = 'today'
}

const recordInterruption = () => {
  if (!timebox.state.settings.recordInterruptions) { notify('请先在设置中开启中断记录'); return }
  timebox.addInterruption(interruptionReason.value || '手动记录')
  interruptionReason.value = ''; notify('已记录一次中断')
}

const toggleSetting = (key: keyof TimeboxSettings, value: boolean) => void timebox.updateSettings({ [key]: value } as Partial<TimeboxSettings>)

const enableNotifications = async () => {
  const result = await timebox.requestNotificationPermission()
  notify(result === 'granted' ? '浏览器通知已开启' : result === 'unsupported' ? '当前环境不支持浏览器通知' : '通知权限未授予')
}

const downloadExport = () => {
  const blob = new Blob([JSON.stringify(timebox.exportData(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = `时间盒备份-${localDateKey(Date.now())}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const importBackup = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { await timebox.importData(JSON.parse(await file.text())); notify('备份已导入') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '无法导入这个文件') }
  ;(event.target as HTMLInputElement).value = ''
}

const confirmDeleteTask = () => {
  if (!deleteTarget.value) return
  if (!timebox.deleteTask(deleteTarget.value.id)) { notify('进行中的任务不能删除'); return }
  deleteTarget.value = null; taskDetail.value = null; notify('任务已删除')
}

const applyReset = async () => { await timebox.resetAll(); resetConfirm.value = false; view.value = 'today'; notify('时间盒数据与设置已重置') }

onMounted(async () => { await timebox.initialize(); quickMinutes.value = timebox.state.settings.defaultFocusMinutes; quickMode.value = timebox.state.settings.defaultMode; timebox.startRuntime() })
onBeforeUnmount(() => { timebox.stopRuntime(); if (toastTimer) clearTimeout(toastTimer) })
</script>

<template>
  <div class="tb-app">
    <header class="tb-header">
      <button class="tb-icon-button" type="button" aria-label="关闭时间盒" @click="$emit('close')">‹</button>
      <div><h1>时间盒</h1><p>{{ timebox.activeSession.value ? '正在专注 · ' + timebox.activeSession.value.taskTitle : '把计划放进真实时间里' }}</p></div>
      <button class="tb-add-button" type="button" aria-label="新建任务" @click="openNewTask">＋</button>
    </header>

    <Transition name="tb-toast"><div v-if="toast" class="tb-toast" role="status">{{ toast }}</div></Transition>

    <main v-if="view==='today'" class="tb-scroll">
      <section v-if="timebox.activeSession.value" class="tb-running-card" @click="view='focus'">
        <div class="tb-running-ring" :style="{'--progress':`${activeProgress*3.6}deg`}"><span>{{ activeDisplay }}</span></div>
        <div class="tb-running-copy"><small>{{ timebox.activeSession.value.status==='paused'?'已暂停':timebox.activeSession.value.status==='awaiting_review'?'等待结算':'正在进行' }}</small><strong>{{ timebox.activeSession.value.taskTitle }}</strong><p>点击回到专注页</p></div><b>›</b>
      </section>

      <section class="tb-day-heading"><div><small>{{ new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}) }}</small><h2>今天</h2></div><div class="tb-day-metrics"><span><b>{{ plannedTodayMinutes }}</b><small>计划分钟</small></span><span><b>{{ Math.round(timebox.todayFocusMs.value/60000) }}</b><small>已专注</small></span></div></section>

      <section class="tb-card tb-quick">
        <div class="tb-section-title"><div><h3>立即开始</h3><p>没有自动行为，点击后才会计时</p></div></div>
        <input v-model="quickTitle" class="tb-input" maxlength="80" placeholder="现在想完成什么？">
        <div class="tb-quick-controls"><div class="tb-segments"><button v-for="item in [{id:'countdown',name:'倒计时'},{id:'pomodoro',name:'番茄'},{id:'stopwatch',name:'正计时'},{id:'flowtime',name:'心流'}]" :key="item.id" type="button" :class="{active:quickMode===item.id}" @click="quickMode=item.id as TimeboxMode">{{ item.name }}</button></div><label><input v-model.number="quickMinutes" type="number" inputmode="numeric" min="1" max="1440"><span>分钟</span></label></div>
        <button class="tb-primary wide" type="button" @click="startQuick">开始时间盒</button>
      </section>

      <div class="tb-section-title outside"><div><h3>今日任务</h3><p>{{ timebox.todayTasks.value.length ? `${timebox.todayTasks.value.length} 项待安排或执行` : '今天还没有任务' }}</p></div><button type="button" @click="openNewTask">添加</button></div>
      <section v-if="timebox.todayTasks.value.length" class="tb-card tb-task-list">
        <article v-for="task in timebox.todayTasks.value" :key="task.id" @click="openTask(task)">
          <button class="tb-play" type="button" aria-label="开始任务" @click.stop="startTask(task)">▶</button>
          <div><strong>{{ task.title }}</strong><small>{{ task.scheduledStart ? formatDate(task.scheduledStart) : '收集箱' }} · {{ task.estimateMinutes }} 分钟<span v-if="task.project"> · {{ task.project }}</span></small></div>
          <em :class="`energy-${task.energy}`">{{ task.energy==='high'?'高能':task.energy==='low'?'低能':'常规' }}</em>
        </article>
      </section>
      <section v-else class="tb-empty"><span>今</span><strong>留一点真实可用的时间</strong><p>新建任务并安排时间，或直接开始一个临时时间盒。</p></section>
    </main>

    <main v-else-if="view==='plan'" class="tb-scroll">
      <section class="tb-plan-summary"><div><small>今日容量</small><strong>{{ plannedTodayMinutes }} 分钟</strong><p>{{ plannedTodayMinutes>480?'计划已经超过 8 小时，建议保留缓冲。':'固定任务与收集箱会一起显示。' }}</p></div><button type="button" @click="openNewTask">新建任务</button></section>
      <div class="tb-section-title outside"><div><h3>时间轴</h3><p>按安排时间排序</p></div></div>
      <section v-if="plannedTasks.length" class="tb-timeline">
        <article v-for="task in plannedTasks" :key="task.id"><time>{{ timeInputValue(task.scheduledStart) }}</time><i></i><div class="tb-card" @click="openTask(task)"><span><strong>{{ task.title }}</strong><small>{{ task.estimateMinutes }} 分钟 · {{ task.project || '无项目' }}</small></span><button type="button" @click.stop="startTask(task)">开始</button></div></article>
      </section>
      <section v-else class="tb-empty compact"><span>排</span><strong>还没有已安排任务</strong><p>任务可以保留在收集箱，也可以指定日期和时间。</p></section>
      <div class="tb-section-title outside"><div><h3>收集箱</h3><p>未确定具体时间的任务</p></div><b>{{ inboxTasks.length }}</b></div>
      <section v-if="inboxTasks.length" class="tb-card tb-inbox-list"><article v-for="task in inboxTasks" :key="task.id"><button type="button" @click="openTask(task)"><span><strong>{{ task.title }}</strong><small>{{ task.estimateMinutes }} 分钟 · {{ task.project || '未分类' }}</small></span><em>›</em></button><input :value="datetimeInputValue(task.scheduledStart)" type="datetime-local" aria-label="安排时间" @change="rescheduleTask(task,$event)"></article></section>
    </main>

    <main v-else-if="view==='focus'" class="tb-focus">
      <template v-if="timebox.activeSession.value">
        <div class="tb-focus-top"><span>{{ timebox.activeSession.value.mode==='pomodoro'?'番茄专注':timebox.activeSession.value.mode==='flowtime'?'心流计时':timebox.activeSession.value.mode==='stopwatch'?'正计时':'时间盒' }}</span><button type="button" @click="view='today'">收起</button></div>
        <section class="tb-focus-main">
          <p>{{ timebox.activeSession.value.status==='paused'?'时间已暂停':timebox.activeSession.value.status==='awaiting_review'?'时间到了，确认本次结果':'只做眼前这一件事' }}</p>
          <h2>{{ timebox.activeSession.value.taskTitle }}</h2>
          <div class="tb-timer" :class="{paused:timebox.activeSession.value.status==='paused'}">{{ activeDisplay }}</div>
          <div v-if="timebox.activeTask.value?.definitionOfDone" class="tb-done-definition"><small>完成定义</small><span>{{ timebox.activeTask.value.definitionOfDone }}</span></div>
          <div v-if="timebox.activeSession.value.status==='running'" class="tb-focus-actions"><button type="button" @click="timebox.pauseSession()">暂停</button><button class="primary" type="button" @click="reviewOutcome='completed';timebox.endNowForReview()">提前完成</button></div>
          <div v-else-if="timebox.activeSession.value.status==='paused'" class="tb-focus-actions"><button type="button" @click="timebox.finishSession('cancelled');view='today'">取消本次</button><button class="primary" type="button" @click="timebox.resumeSession()">继续</button></div>
        </section>

        <section v-if="timebox.activeSession.value.status!=='awaiting_review'" class="tb-focus-tools">
          <button type="button" @click="timebox.extendSession(5)"><b>+5</b><span>延长分钟</span></button>
          <button type="button" @click="recordInterruption"><b>记</b><span>一次打断</span></button>
          <button v-if="timebox.state.settings.companionEnabled && timebox.state.settings.companionManualCall" type="button" :disabled="timebox.busy.value" @click="timebox.callCompanion()"><b>陪</b><span>叫叫TA</span></button>
        </section>
        <div v-if="timebox.state.settings.recordInterruptions && timebox.activeSession.value.status!=='awaiting_review'" class="tb-inline-entry"><input v-model="interruptionReason" maxlength="100" placeholder="打断原因（可选）"><button type="button" @click="recordInterruption">记录</button></div>
        <section v-if="timebox.state.settings.companionEnabled && (timebox.state.settings.companionSilentPresence || timebox.activeSession.value.companionMessages.length) && (selectedCharacter || timebox.activeSession.value.companionMessages.length)" class="tb-companion-card">
          <div class="tb-companion-head"><span :style="selectedCharacter?.avatarUrl?{backgroundImage:`url(${selectedCharacter.avatarUrl})`}:{}">{{ selectedCharacter?.avatarUrl?'':selectedCharacter?.avatarText || '伴' }}</span><div><strong>{{ selectedCharacter?.name || '陪伴角色' }}</strong><small>{{ timebox.busy.value?'正在回应…':'与你一起专注' }}</small></div></div>
          <p v-if="timebox.activeSession.value.companionMessages.length">{{ timebox.activeSession.value.companionMessages.at(-1)?.text }}</p><p v-else>安静在场，不会主动占用你的注意力。</p>
        </section>
        <section v-if="timebox.activeSession.value.status==='awaiting_review'" class="tb-review-card">
          <div class="tb-section-title"><div><h3>这段时间怎么样？</h3><p>选择结果后才会结算</p></div></div>
          <div class="tb-outcomes"><button v-for="item in [{id:'completed',name:'完成'},{id:'partial',name:'部分完成'},{id:'unfinished',name:'未完成'},{id:'cancelled',name:'不计入'}]" :key="item.id" type="button" :class="{active:reviewOutcome===item.id}" @click="reviewOutcome=item.id as TimeboxOutcome">{{ item.name }}</button></div>
          <textarea v-model="reviewNote" rows="3" maxlength="500" placeholder="成果、卡点或下一步（可选）"></textarea>
          <button class="tb-primary wide" type="button" @click="submitReview">保存结果</button>
        </section>
      </template>
      <section v-else class="tb-empty focus-empty"><span>盒</span><strong>当前没有进行中的时间盒</strong><p>从今日任务开始，或创建一个临时专注。</p><button class="tb-primary" type="button" @click="view='today'">回到今天</button></section>
    </main>

    <main v-else-if="view==='records'" class="tb-scroll">
      <section v-if="!timebox.state.settings.recordHistory" class="tb-permission-card"><span>录</span><div><strong>历史记录目前关闭</strong><p>默认不会保存已经结束的会话。开启后才会生成统计。</p></div><button type="button" @click="toggleSetting('recordHistory',true)">开启</button></section>
      <template v-else>
        <section class="tb-stats-grid"><div><small>累计专注</small><strong>{{ formatDuration(totalFocusMs) }}</strong></div><div><small>完成率</small><strong>{{ completionRate }}%</strong></div><div><small>估时贴合</small><strong>{{ estimationAccuracy }}%</strong></div></section>
        <section v-if="timebox.state.settings.analytics" class="tb-card tb-week-chart"><div class="tb-section-title"><div><h3>近七天</h3><p>每天实际专注分钟</p></div></div><div class="tb-bars"><div v-for="item in weekBars" :key="item.key"><span><i :style="{height:`${Math.max(item.minutes?8:2,item.minutes/weekMax*100)}%`}"></i></span><b>{{ item.label }}</b><small>{{ item.minutes || '' }}</small></div></div></section>
        <section v-else class="tb-permission-card compact"><span>析</span><div><strong>详细分析已关闭</strong><p>可单独开启图表与估时分析。</p></div><button type="button" @click="toggleSetting('analytics',true)">开启</button></section>
        <div class="tb-section-title outside"><div><h3>最近记录</h3><p>{{ recentSessions.length }} 次已结算会话</p></div></div>
        <section v-if="recentSessions.length" class="tb-card tb-record-list"><article v-for="session in recentSessions.slice(0,60)" :key="session.id"><span :class="`outcome-${session.outcome}`">{{ session.outcome==='completed'?'✓':session.outcome==='partial'?'◐':'·' }}</span><div><strong>{{ session.taskTitle }}</strong><small>{{ session.finishedAt?new Date(session.finishedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'' }} · {{ formatDuration(session.actualFocusMs) }}</small><p v-if="session.reviewNote">{{ session.reviewNote }}</p></div><em>{{ session.plannedMinutes }}m</em></article></section>
        <section v-else class="tb-empty compact"><span>录</span><strong>还没有专注记录</strong><p>完成一次时间盒并结算后会显示在这里。</p></section>
      </template>
    </main>

    <main v-else class="tb-scroll tb-settings">
      <section class="tb-card tb-setting-group"><div class="tb-setting-heading"><h3>计时规则</h3><p>只设置默认值，不会自动开始</p></div><label class="tb-select-row"><span><strong>默认计时方式</strong><small>新时间盒预先选择的模式</small></span><select :value="timebox.state.settings.defaultMode" @change="timebox.updateSettings({defaultMode:($event.target as HTMLSelectElement).value as TimeboxMode})"><option value="countdown">倒计时</option><option value="pomodoro">番茄专注</option><option value="stopwatch">正计时</option><option value="flowtime">心流计时</option></select></label><label class="tb-number-row"><span><strong>默认专注</strong><small>1 到 1440 分钟</small></span><input :value="timebox.state.settings.defaultFocusMinutes" type="number" min="1" max="1440" inputmode="numeric" @change="timebox.updateSettings({defaultFocusMinutes:Number(($event.target as HTMLInputElement).value)})"><em>分钟</em></label><label class="tb-number-row"><span><strong>短休息</strong><small>手动开始休息时使用</small></span><input :value="timebox.state.settings.shortBreakMinutes" type="number" min="1" max="120" inputmode="numeric" @change="timebox.updateSettings({shortBreakMinutes:Number(($event.target as HTMLInputElement).value)})"><em>分钟</em></label></section>

      <section v-for="group in [
        {title:'提醒与环境',note:'浏览器与系统能力可能不同',items:[['completionSound','结束铃声','页面可运行时播放提示音'],['vibration','震动反馈','支持的移动设备上震动'],['keepScreenAwake','屏幕常亮','仅在专注页可见时申请'],['fullscreenOnStart','开始时全屏','需要浏览器允许'],['leaveDetection','离页检测','与中断记录同时开启后生效']]},
        {title:'数据记录',note:'关闭时只保存运行所需状态',items:[['recordHistory','保存专注历史','结束后保留会话记录'],['recordInterruptions','记录中断','允许手动或离页记录'],['analytics','统计分析','生成趋势和估时分析']]}
      ]" :key="group.title" class="tb-card tb-setting-group"><div class="tb-setting-heading"><h3>{{ group.title }}</h3><p>{{ group.note }}</p></div><button v-for="item in group.items" :key="item[0]" class="tb-switch-row" type="button" @click="toggleSetting(item[0] as keyof TimeboxSettings,!timebox.state.settings[item[0] as keyof TimeboxSettings])"><span><strong>{{ item[1] }}</strong><small>{{ item[2] }}</small></span><i :class="{on:timebox.state.settings[item[0] as keyof TimeboxSettings]}"><b></b></i></button></section>

      <section class="tb-card tb-setting-group"><div class="tb-setting-heading"><h3>浏览器通知</h3><p>iOS 需要主屏幕PWA与系统支持；关闭应用后的定时提醒不作虚假承诺</p></div><button class="tb-action-row" type="button" @click="timebox.state.settings.browserNotifications?toggleSetting('browserNotifications',false):enableNotifications()"><span><strong>本机浏览器通知</strong><small>{{ notificationSupportText }}</small></span><em>{{ timebox.state.settings.browserNotifications?'关闭':'设置' }}</em></button></section>

      <section class="tb-card tb-setting-group"><div class="tb-setting-heading"><h3>角色陪伴</h3><p>每项独立授权，不开启就不会调用模型或读取聊天</p></div><button class="tb-switch-row master" type="button" @click="toggleSetting('companionEnabled',!timebox.state.settings.companionEnabled)"><span><strong>角色陪伴总开关</strong><small>控制时间盒中的全部角色能力</small></span><i :class="{on:timebox.state.settings.companionEnabled}"><b></b></i></button><template v-if="timebox.state.settings.companionEnabled"><label class="tb-select-row"><span><strong>陪伴角色</strong><small>只列出已有单聊角色</small></span><select :value="String(timebox.state.settings.companionCharacterId || '')" @change="timebox.updateSettings({companionCharacterId:($event.target as HTMLSelectElement).value||null})"><option value="">请选择</option><option v-for="character in timebox.characters.value" :key="character.id" :value="String(character.characterEntityId||character.id)">{{ character.name }}</option></select></label><button v-for="item in [
          ['companionSilentPresence','静默在场','只显示角色状态，不调用模型'],['companionStartMessage','开始回应','开始时生成一句回应'],['companionFinishMessage','完成回应','结算时根据真实结果回应'],['companionManualCall','手动呼叫','专注中点击后才回应'],['companionStrictMode','明确监督','语气更坚定但不羞辱'],['companionRomanceMode','亲密表达','仅在既有关系允许时自然亲密'],['companionAi','AI角色回应','开启后才会调用聊天模型'],['companionReadTaskNote','读取任务说明','允许模型看到任务补充'],['companionReadStats','读取专注统计','允许模型看到时长与中断'],['companionWriteToChat','写入聊天','把陪伴回应加入角色单聊'],['companionWriteMemory','写入长期记忆','仅完成任务时记录共同经历']
        ]" :key="item[0]" class="tb-switch-row" type="button" @click="toggleSetting(item[0] as keyof TimeboxSettings,!timebox.state.settings[item[0] as keyof TimeboxSettings])"><span><strong>{{ item[1] }}</strong><small>{{ item[2] }}</small></span><i :class="{on:timebox.state.settings[item[0] as keyof TimeboxSettings]}"><b></b></i></button><label v-if="timebox.state.settings.companionAi" class="tb-number-row"><span><strong>每日 AI 消息上限</strong><small>达到后改用本地短句</small></span><input :value="timebox.state.settings.dailyAiMessageLimit" type="number" min="0" max="20" inputmode="numeric" @change="timebox.updateSettings({dailyAiMessageLimit:Number(($event.target as HTMLInputElement).value)})"><em>条</em></label></template></section>

      <section class="tb-card tb-setting-group"><div class="tb-setting-heading"><h3>外部连接</h3><p>当前保持本地优先；以下能力未配置时不会上传数据</p></div><div v-for="item in [['WebDAV 同步','通过高级设置进行整机备份'],['系统日历','可使用 JSON 备份保留完整计划'],['托管推送','关闭PWA后的提醒需要公共服务'],['跨设备计时','需要同步服务与设备所有权']]" :key="item[0]" class="tb-unconfigured-row"><span><strong>{{ item[0] }}</strong><small>{{ item[1] }}</small></span><em>未配置</em></div></section>

      <section class="tb-card tb-setting-group"><div class="tb-setting-heading"><h3>数据管理</h3><p>备份包含时间盒任务、记录和设置</p></div><button class="tb-action-row" type="button" @click="downloadExport"><span><strong>导出 JSON 备份</strong><small>保存到当前设备</small></span><em>导出</em></button><button class="tb-action-row" type="button" @click="importInput?.click()"><span><strong>导入备份</strong><small>会替换当前时间盒数据</small></span><em>选择</em></button><input ref="importInput" class="tb-hidden-file" type="file" accept="application/json,.json" @change="importBackup"><button class="tb-action-row danger" type="button" @click="resetConfirm=true"><span><strong>重置时间盒</strong><small>清空任务、记录并关闭全部开关</small></span><em>重置</em></button></section>
    </main>

    <nav class="tb-tabs" aria-label="时间盒导航"><button v-for="item in [{id:'today',name:'今日',mark:'今'},{id:'plan',name:'计划',mark:'排'},{id:'focus',name:'专注',mark:'钟'},{id:'records',name:'记录',mark:'析'},{id:'settings',name:'设置',mark:'设'}]" :key="item.id" type="button" :class="{active:view===item.id}" @click="view=item.id as 'today'|'plan'|'focus'|'records'|'settings'"><span>{{ item.mark }}</span><small>{{ item.name }}</small></button></nav>

    <div v-if="taskSheet" class="tb-sheet-layer" @click.self="taskSheet=false"><section class="tb-sheet"><header><button type="button" @click="taskSheet=false">取消</button><strong>新建任务</strong><button type="button" @click="saveTask">保存</button></header><div class="tb-sheet-scroll"><label><span>任务名称</span><input v-model="taskDraft.title" maxlength="80" autofocus placeholder="要完成什么？"></label><label><span>完成定义</span><input v-model="taskDraft.definitionOfDone" maxlength="160" placeholder="做到什么程度算完成"></label><div class="tb-form-grid"><label><span>预计时长</span><input v-model.number="taskDraft.estimateMinutes" type="number" min="1" max="1440" inputmode="numeric"></label><label><span>项目</span><input v-model="taskDraft.project" maxlength="40" placeholder="可选"></label><label><span>日期</span><input v-model="taskDraft.scheduledDate" type="date"></label><label><span>时间</span><input v-model="taskDraft.scheduledTime" type="time" :disabled="!taskDraft.scheduledDate"></label><label><span>截止日期</span><input v-model="taskDraft.deadline" type="date"></label><label><span>精力</span><select v-model="taskDraft.energy"><option value="low">低能量</option><option value="medium">常规</option><option value="high">高能量</option></select></label></div><label><span>标签</span><input v-model="taskDraft.tags" maxlength="120" placeholder="用空格或逗号分隔"></label><label><span>任务说明</span><textarea v-model="taskDraft.note" rows="4" maxlength="1000" placeholder="资料、步骤或上下文（可选）"></textarea></label></div></section></div>

    <div v-if="taskDetail" class="tb-sheet-layer" @click.self="taskDetail=null"><section class="tb-sheet detail"><header><button type="button" @click="taskDetail=null">关闭</button><strong>任务详情</strong><button class="danger-text" type="button" @click="deleteTarget=taskDetail">删除</button></header><div class="tb-sheet-scroll"><div class="tb-detail-title"><small>{{ taskDetail.project || '未分类' }}</small><h2>{{ taskDetail.title }}</h2><p>{{ taskDetail.definitionOfDone || '没有设置完成定义' }}</p></div><div class="tb-detail-metrics"><span><small>预计</small><strong>{{ taskDetail.estimateMinutes }} 分钟</strong></span><span><small>安排</small><strong>{{ formatDate(taskDetail.scheduledStart) }}</strong></span></div><label><span>任务名称</span><input :value="taskDetail.title" maxlength="80" @change="editTaskText(taskDetail,'title',$event)"></label><div class="tb-form-grid"><label><span>预计时长</span><input :value="taskDetail.estimateMinutes" type="number" min="1" max="1440" inputmode="numeric" @change="editTaskMinutes(taskDetail,$event)"></label><label><span>项目</span><input :value="taskDetail.project" maxlength="40" placeholder="可选" @change="editTaskText(taskDetail,'project',$event)"></label></div><label><span>完成定义</span><input :value="taskDetail.definitionOfDone" maxlength="160" placeholder="做到什么程度算完成" @change="editTaskText(taskDetail,'definitionOfDone',$event)"></label><label><span>重新安排</span><input :value="datetimeInputValue(taskDetail.scheduledStart)" type="datetime-local" @change="rescheduleTask(taskDetail,$event)"></label><label><span>任务说明</span><textarea :value="taskDetail.note" rows="4" maxlength="1000" placeholder="资料、步骤或上下文" @change="editTaskText(taskDetail,'note',$event)"></textarea></label><div v-if="taskDetail.tags.length" class="tb-tags"><span v-for="tag in taskDetail.tags" :key="tag">{{ tag }}</span></div><button class="tb-primary wide" type="button" @click="startTask(taskDetail);taskDetail=null">开始这个任务</button></div></section></div>

    <div v-if="deleteTarget" class="tb-dialog-layer" role="dialog" aria-modal="true" @click.self="deleteTarget=null"><section class="tb-dialog"><h2>删除任务？</h2><p>“{{ deleteTarget.title }}”会从计划中移除；已经保存的历史记录不受影响。</p><div><button type="button" @click="deleteTarget=null">保留</button><button class="danger" type="button" @click="confirmDeleteTask">删除</button></div></section></div>
    <div v-if="resetConfirm" class="tb-dialog-layer" role="dialog" aria-modal="true" @click.self="resetConfirm=false"><section class="tb-dialog"><h2>重置时间盒？</h2><p>任务、专注历史、统计和全部时间盒开关都会清空。请先导出需要保留的数据。</p><div><button type="button" @click="resetConfirm=false">取消</button><button class="danger" type="button" @click="applyReset">确认重置</button></div></section></div>
  </div>
</template>

<style scoped src="./app_Timebox.css"></style>
