<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useTextGame } from '../composables/useTextGame'
import { makeTextGameId, type TextGameAsset, type TextGameChoice, type TextGameNode, type TextGameSave } from '../types/textGame'
import './app_TextGame.css'

defineEmits<{ (event: 'close'): void; (event: 'open-api'): void }>()

type View = 'home' | 'studio' | 'player' | 'settings'
type StudioTab = 'script' | 'variables' | 'characters' | 'assets' | 'ai' | 'project'

const game = useTextGame()
const view = ref<View>('home')
const studioTab = ref<StudioTab>('script')
const toast = ref('')
const createSheet = ref(false)
const nodeSheet = ref(false)
const savesSheet = ref(false)
const deleteProjectTarget = ref<string | null>(null)
const deleteNodeTarget = ref<string | null>(null)
const deleteAssetTarget = ref<TextGameAsset | null>(null)
const importInput = ref<HTMLInputElement | null>(null)
const assetInput = ref<HTMLInputElement | null>(null)
const newTitle = ref('')
const newSummary = ref('')
const newAuthor = ref('')
const variableName = ref('')
const variableType = ref<'number' | 'boolean' | 'string'>('number')
const selectedCharacterId = ref('')
const selectedWorldBookId = ref('')
const aiIdea = ref('')
const manualSaveName = ref('')
const nodeDraft = ref<TextGameNode | null>(null)
const assets = ref<TextGameAsset[]>([])
const assetUrls = reactive<Record<string, string>>({})
let toastTimer: ReturnType<typeof setTimeout> | undefined

const project = computed(() => game.activeProject.value)
const node = computed(() => game.currentNode.value)
const visibleVariables = computed(() => project.value?.variables.filter(item => item.visible) || [])
const validationIssues = computed(() => project.value ? game.validateProject(project.value) : [])
const errorCount = computed(() => validationIssues.value.filter(item => item.severity === 'error').length)
const endings = computed(() => project.value?.nodes.filter(item => item.kind === 'ending') || [])
const unlockedEndingCount = computed(() => endings.value.filter(item => game.runtime.value?.unlockedEndingIds.includes(item.endingId)).length)
const currentBackgroundUrl = computed(() => node.value?.backgroundAssetId ? assetUrls[node.value.backgroundAssetId] || '' : '')
const currentPortraitUrl = computed(() => node.value?.portraitAssetId ? assetUrls[node.value.portraitAssetId] || '' : '')
const currentVideoUrl = computed(() => node.value?.videoAssetId ? assetUrls[node.value.videoAssetId] || '' : '')
const currentAudioUrl = computed(() => node.value?.audioAssetId ? assetUrls[node.value.audioAssetId] || '' : '')
const playerStyle = computed(() => ({ '--tg-story-accent': project.value?.accentColor || '#8b6f91', backgroundImage: currentBackgroundUrl.value ? `linear-gradient(rgba(18,15,20,.08),rgba(18,15,20,.45)),url(${currentBackgroundUrl.value})` : '' }))

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const revokeAssetUrls = () => {
  Object.values(assetUrls).forEach(url => URL.revokeObjectURL(url))
  Object.keys(assetUrls).forEach(key => delete assetUrls[key])
}

const loadAssets = async () => {
  revokeAssetUrls()
  if (!project.value) { assets.value = []; return }
  assets.value = await game.listAssets(project.value.id)
  await Promise.all(assets.value.map(async asset => {
    const blob = await game.getAssetBlob(asset.id)
    if (blob) assetUrls[asset.id] = URL.createObjectURL(blob)
  }))
}

const openProject = async (projectId: string) => {
  game.activeProjectId.value = projectId
  view.value = 'studio'; studioTab.value = 'script'
  await loadAssets()
}

const createProject = async () => {
  if (!newTitle.value.trim()) { notify('请先填写作品名称'); return }
  await game.createProject(newTitle.value, newSummary.value, newAuthor.value)
  createSheet.value = false; newTitle.value = ''; newSummary.value = ''; newAuthor.value = ''
  view.value = 'studio'; await loadAssets(); notify('作品已创建，示例分支可以直接试玩')
}

const enterPlayer = async (fromBeginning = false) => {
  if (!project.value) return
  if (errorCount.value) { notify(`还有 ${errorCount.value} 个错误，修复后才能试玩`); return }
  await game.startGame(project.value, fromBeginning)
  await loadAssets(); view.value = 'player'
}

const leavePlayer = async () => {
  if (game.runtime.value && project.value?.settings.autoSave) await game.makeSave('auto')
  view.value = 'studio'
}

const openNode = (source: TextGameNode) => {
  nodeDraft.value = JSON.parse(JSON.stringify(source)); nodeSheet.value = true
}

const createNode = async (kind: TextGameNode['kind']) => {
  const created = await game.addNode(kind); openNode(created)
}

const saveNode = async () => {
  if (!project.value || !nodeDraft.value) return
  if (!nodeDraft.value.title.trim()) { notify('节点标题不能为空'); return }
  const target = project.value.nodes.find(item => item.id === nodeDraft.value!.id)
  if (!target) return
  Object.assign(target, JSON.parse(JSON.stringify(nodeDraft.value)), { updatedAt: Date.now() })
  if (target.kind === 'ending' && !target.endingId) target.endingId = makeTextGameId('ending')
  await game.saveProject(project.value); nodeSheet.value = false; notify('节点已保存')
}

const appendChoice = () => { if (nodeDraft.value) game.addChoice(nodeDraft.value) }
const removeChoice = (choiceId: string) => { if (nodeDraft.value) nodeDraft.value.choices = nodeDraft.value.choices.filter(item => item.id !== choiceId) }
const addChoiceCondition = (choice: TextGameChoice) => {
  const variable = project.value?.variables[0]
  if (!variable) { notify('请先在“变量”中建立变量'); return }
  choice.conditions.push({ variableId: variable.id, operator: 'gte', value: variable.type === 'number' ? 0 : variable.type === 'boolean' ? true : '' })
}
const addChoiceEffect = (choice: TextGameChoice) => {
  const variable = project.value?.variables[0]
  if (!variable) { notify('请先在“变量”中建立变量'); return }
  choice.effects.push({ variableId: variable.id, operator: variable.type === 'number' ? 'add' : 'set', value: variable.type === 'number' ? 1 : variable.type === 'boolean' ? true : '' })
}

const addVariable = async () => {
  await game.addVariable(variableName.value, variableType.value)
  variableName.value = ''; notify('变量已添加')
}

const importCharacter = async () => {
  if (!selectedCharacterId.value) { notify('请选择一个角色'); return }
  try { await game.importCharacter(selectedCharacterId.value); selectedCharacterId.value = ''; notify('角色快照已加入作品') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '角色导入失败') }
}

const importWorldBook = async () => {
  if (!selectedWorldBookId.value) { notify('请选择一本世界书'); return }
  try { await game.importWorldBook(selectedWorldBookId.value); selectedWorldBookId.value = ''; notify('世界书内容已加入作品') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '世界书导入失败') }
}

const uploadAsset = async (event: Event) => {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  for (const file of files) {
    try { await game.addAsset(file) }
    catch (cause) { notify(cause instanceof Error ? `${file.name}：${cause.message}` : `${file.name} 导入失败`) }
  }
  ;(event.target as HTMLInputElement).value = ''
  await loadAssets(); if (files.length) notify(`已导入 ${files.length} 个素材`)
}

const confirmDeleteAsset = async () => {
  if (!deleteAssetTarget.value) return
  await game.removeAsset(deleteAssetTarget.value.id); deleteAssetTarget.value = null; await loadAssets(); notify('素材已删除')
}

const downloadProject = async () => {
  if (!project.value) return
  const blob = await game.exportProject(project.value)
  const url = URL.createObjectURL(blob); const link = document.createElement('a')
  link.href = url; link.download = `${project.value.title.replace(/[\\/:*?"<>|]/g, '_')}.nrjstory`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000); notify('作品包已导出')
}

const importProject = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try { const imported = await game.importProject(file); await openProject(imported.id); notify('作品包已导入') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '作品包导入失败') }
  ;(event.target as HTMLInputElement).value = ''
}

const runAi = async () => {
  if (!aiIdea.value.trim()) { notify('请先写下需要 AI 完成的内容'); return }
  try { const created = await game.generateOutline(aiIdea.value); aiIdea.value = ''; studioTab.value = 'script'; notify(`已生成 ${created.length} 个草稿节点，请检查并连接选项`) }
  catch (cause) { notify(cause instanceof Error ? cause.message : 'AI 创作失败') }
}

const next = async () => { if (!(await game.goNext())) notify(node.value?.kind === 'ending' ? '这个故事已经抵达结局' : '这个节点还没有连接后续剧情') }
const choose = async (choice: TextGameChoice) => { if (!(await game.choose(choice))) notify('当前条件还不能选择这个选项') }
const rollback = async () => { if (!(await game.rollback())) notify(project.value?.settings.allowRollback ? '已经没有更早的剧情了' : '作者关闭了剧情回退') }

const saveManual = async () => {
  await game.makeSave('manual', manualSaveName.value); manualSaveName.value = ''; notify('存档已保存')
}

const loadSave = async (save: TextGameSave) => {
  try { await game.loadSave(save); await loadAssets(); savesSheet.value = false; view.value = 'player'; notify('存档已读取') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '无法读取存档') }
}

const formatTime = (value: number) => new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
const formatSize = (value: number) => value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`
const assetName = (id: string) => assets.value.find(item => item.id === id)?.name || '未设置'

onMounted(async () => { await game.initialize() })
onBeforeUnmount(() => { revokeAssetUrls(); if (toastTimer) clearTimeout(toastTimer) })
watch(() => game.activeProjectId.value, () => { if (view.value !== 'home') void loadAssets() })
</script>

<template>
  <div class="tg-app">
    <header v-if="view!=='player'" class="tg-header">
      <button class="tg-icon-button" type="button" :aria-label="view==='home'?'关闭文游':'返回文游首页'" @click="view==='home'?$emit('close'):(view='home')">‹</button>
      <div><h1>{{ view==='home'?'文游':project?.title || '文游' }}</h1><p>{{ view==='home'?'写故事，也走进故事':studioTab==='script'?'剧本与分支':studioTab==='variables'?'变量与养成':studioTab==='characters'?'角色与世界':studioTab==='assets'?'图像、视频与声音':studioTab==='ai'?'AI 编剧室':'作品设置' }}</p></div>
      <button v-if="view==='studio'" class="tg-header-action" type="button" @click="enterPlayer(false)">试玩</button>
      <button v-else class="tg-icon-button add" type="button" aria-label="创建作品" @click="createSheet=true">＋</button>
    </header>

    <Transition name="tg-toast"><div v-if="toast" class="tg-toast" role="status">{{ toast }}</div></Transition>

    <main v-if="view==='home'" class="tg-scroll tg-home">
      <section class="tg-hero"><span>游</span><div><small>INTERACTIVE STORY</small><h2>每个选择，都能留下痕迹</h2><p>创作分支故事、邀请角色、加入图像视频与语音，并在本机保存每一条时间线。</p></div></section>
      <div class="tg-section-title"><div><h3>我的作品</h3><p>{{ game.state.projects.length ? `共 ${game.state.projects.length} 部，全部保存在当前设备` : '从一个可以立即试玩的故事骨架开始' }}</p></div><button type="button" @click="createSheet=true">新建</button></div>
      <section v-if="game.state.projects.length" class="tg-project-list">
        <article v-for="item in game.state.projects" :key="item.id">
          <button class="tg-project-main" type="button" @click="openProject(item.id)"><span :style="{background:item.accentColor}">{{ item.title.slice(0,1) }}</span><div><small>{{ item.tags.join(' · ') || '互动故事' }}</small><strong>{{ item.title }}</strong><p>{{ item.summary || '还没有填写作品简介' }}</p><em>{{ item.nodes.length }} 个节点 · {{ item.nodes.filter(node=>node.kind==='ending').length }} 个结局</em></div><b>›</b></button>
          <div class="tg-project-actions"><button type="button" @click="game.activeProjectId.value=item.id;enterPlayer(false)">继续</button><button type="button" @click="game.duplicateProject(item).then(()=>notify('作品副本已创建'))">复制</button><button class="danger" type="button" @click="deleteProjectTarget=item.id">删除</button></div>
        </article>
      </section>
      <section v-else class="tg-empty"><span>稿</span><strong>还没有文游作品</strong><p>创建后会自动准备一段含有分支和结局的示例剧情，你可以直接试玩或改写。</p><button type="button" @click="createSheet=true">创建作品</button></section>
      <div class="tg-section-title"><div><h3>本机作品包</h3><p>导入 .nrjstory，作品和素材不会上传</p></div><button type="button" @click="importInput?.click()">导入</button></div>
      <section class="tg-local-note"><span>本</span><div><strong>本地优先</strong><p>剧本、素材与存档默认只存放在这台设备。请定期导出作品包，并使用高级设置中的备份功能保护数据。</p></div></section>
      <input ref="importInput" class="tg-hidden" type="file" accept=".nrjstory,application/zip" @change="importProject">
    </main>

    <template v-else-if="view==='studio' && project">
      <main class="tg-scroll tg-studio">
        <section v-if="studioTab==='script'">
          <div class="tg-studio-summary"><div><small>剧情结构</small><strong>{{ project.nodes.length }}</strong><span>节点</span></div><div><small>结局</small><strong>{{ endings.length }}</strong><span>个</span></div><div><small>检查</small><strong :class="{warn:validationIssues.length}">{{ validationIssues.length }}</strong><span>项</span></div></div>
          <div class="tg-toolbar"><button type="button" @click="createNode('scene')">＋ 场景</button><button type="button" @click="createNode('choice')">＋ 选择</button><button type="button" @click="createNode('ending')">＋ 结局</button></div>
          <section class="tg-node-list"><article v-for="(item,index) in project.nodes" :key="item.id"><button type="button" @click="openNode(item)"><span :class="`kind-${item.kind}`">{{ item.kind==='scene'?'景':item.kind==='choice'?'选':'终' }}</span><div><small>{{ item.chapter }}<template v-if="item.id===project.startNodeId"> · 开始节点</template></small><strong>{{ item.title }}</strong><p>{{ item.speaker ? `${item.speaker}：` : '' }}{{ item.text || (item.kind==='ending'?item.endingTitle:'尚未填写正文') }}</p></div><aside><em>{{ item.kind==='choice'?`${item.choices.length} 项`:item.kind==='ending'?item.endingTone:`${index+1}` }}</em><b>›</b></aside></button></article></section>
          <template v-if="validationIssues.length"><div class="tg-section-title inside"><div><h3>结构检查</h3><p>错误会阻止试玩，提醒不会阻止</p></div></div><section class="tg-issue-list"><button v-for="(issue,index) in validationIssues" :key="index" type="button" :class="issue.severity" @click="issue.nodeId&&openNode(project.nodes.find(item=>item.id===issue.nodeId)!)"><span>{{ issue.severity==='error'?'!':'i' }}</span><p>{{ issue.message }}</p><b v-if="issue.nodeId">›</b></button></section></template>
        </section>

        <section v-else-if="studioTab==='variables'">
          <div class="tg-compose-card"><div class="tg-section-title compact"><div><h3>新建变量</h3><p>数值、开关和文本都能影响选项</p></div></div><div class="tg-inline-form"><input v-model="variableName" maxlength="40" placeholder="例如：信任"><select v-model="variableType"><option value="number">数值</option><option value="boolean">开关</option><option value="string">文本</option></select><button type="button" @click="addVariable">添加</button></div></div>
          <section v-if="project.variables.length" class="tg-setting-card tg-variable-list"><article v-for="item in project.variables" :key="item.id"><div><input v-model="item.name" maxlength="40" @change="game.saveProject(project)"><small>{{ item.id }}</small></div><label><span>初始值</span><input v-if="item.type==='number'" v-model.number="item.initialValue" type="number" @change="game.saveProject(project)"><select v-else-if="item.type==='boolean'" v-model="item.initialValue" @change="game.saveProject(project)"><option :value="true">开启</option><option :value="false">关闭</option></select><input v-else v-model="item.initialValue" maxlength="120" @change="game.saveProject(project)"></label><button type="button" :class="{on:item.visible}" @click="item.visible=!item.visible;game.saveProject(project)">{{ item.visible?'玩家可见':'玩家隐藏' }}</button><button class="danger-text" type="button" @click="game.deleteVariable(item.id)">删除</button></article></section>
          <section v-else class="tg-empty compact"><span>值</span><strong>还没有变量</strong><p>建立好感、金钱、体力、线索或任意故事状态。</p></section>
        </section>

        <section v-else-if="studioTab==='characters'">
          <div class="tg-compose-card"><div class="tg-section-title compact"><div><h3>邀请现有角色</h3><p>导入的是当前快照，不会修改原角色</p></div></div><div class="tg-inline-form"><select v-model="selectedCharacterId"><option value="">选择角色</option><option v-for="item in game.characters.value" :key="item.id" :value="String(item.id)">{{ item.name }}</option></select><button type="button" @click="importCharacter">邀请</button></div></div>
          <section v-if="project.characters.length" class="tg-character-grid"><article v-for="item in project.characters" :key="item.id"><span :style="item.avatar?{backgroundImage:`url(${item.avatar})`}:{}">{{ item.name.slice(0,1) }}</span><div><input v-model="item.name" maxlength="40" @change="game.saveProject(project)"><input v-model="item.role" maxlength="60" placeholder="剧情身份" @change="game.saveProject(project)"><textarea v-model="item.description" maxlength="3000" placeholder="角色在本作品中的设定" @change="game.saveProject(project)"></textarea></div><button type="button" aria-label="移除角色" @click="project.characters=project.characters.filter(role=>role.id!==item.id);game.saveProject(project)">×</button></article></section>
          <div class="tg-section-title"><div><h3>世界书</h3><p>内容复制进作品，之后可独立编辑</p></div></div>
          <div class="tg-compose-card"><div class="tg-inline-form"><select v-model="selectedWorldBookId"><option value="">选择世界书</option><option v-for="item in game.worldBooks.value" :key="item.id" :value="item.id">{{ item.title }}</option></select><button type="button" @click="importWorldBook">加入</button></div></div>
          <section v-if="project.worldReferences.length" class="tg-world-list"><details v-for="item in project.worldReferences" :key="item.id"><summary>{{ item.title }}<button type="button" @click.prevent="project.worldReferences=project.worldReferences.filter(book=>book.id!==item.id);game.saveProject(project)">移除</button></summary><textarea v-model="item.content" @change="game.saveProject(project)"></textarea></details></section>
        </section>

        <section v-else-if="studioTab==='assets'">
          <section class="tg-upload-card"><span>媒</span><div><strong>导入作品素材</strong><p>支持图片、音频与视频。图片/音频单个 40MB，视频单个 200MB。</p></div><button type="button" @click="assetInput?.click()">选择文件</button></section>
          <input ref="assetInput" class="tg-hidden" type="file" multiple accept="image/*,audio/*,video/*" @change="uploadAsset">
          <section v-if="assets.length" class="tg-asset-grid"><article v-for="item in assets" :key="item.id"><div class="tg-asset-preview"><img v-if="item.kind==='image'" :src="assetUrls[item.id]" alt=""><video v-else-if="item.kind==='video'" :src="assetUrls[item.id]" muted preload="metadata"></video><span v-else>音</span></div><div><strong>{{ item.name }}</strong><small>{{ item.kind==='image'?'图片':item.kind==='video'?'视频':'音频' }} · {{ formatSize(item.size) }}</small></div><button type="button" @click="deleteAssetTarget=item">删除</button></article></section>
          <section v-else class="tg-empty compact"><span>媒</span><strong>素材库还是空的</strong><p>导入后可以在任意剧情节点选择背景、立绘、视频和声音。</p></section>
        </section>

        <section v-else-if="studioTab==='ai'">
          <section class="tg-ai-card"><span>写</span><small>AI 编剧室</small><h2>把灵感整理成可编辑的剧情节点</h2><p>AI 只会追加草稿，不会覆盖现有剧本、变量、角色或存档。生成后仍需由你检查选项连接。</p><textarea v-model="aiIdea" maxlength="3000" placeholder="例如：为第二章写一段雨夜重逢。角色先隐瞒来意，玩家随后面对两个不同选择……"></textarea><button type="button" :disabled="game.busy.value" @click="runAi">{{ game.busy.value?'正在构思…':'生成剧本草稿' }}</button><button class="secondary" type="button" @click="$emit('open-api')">打开 API 设置</button></section>
          <section class="tg-privacy-note"><strong>发送范围</strong><p>只发送作品名称、简介、作品内角色名称/身份和上方创作要求；不会发送聊天记录、存档、素材文件或 API 密钥。</p></section>
        </section>

        <section v-else class="tg-settings">
          <section class="tg-setting-card"><label><span><strong>作品名称</strong><small>显示在首页和作品包中</small></span><input v-model="project.title" maxlength="80" @change="game.saveProject(project)"></label><label><span><strong>作者</strong><small>可留空</small></span><input v-model="project.author" maxlength="50" @change="game.saveProject(project)"></label><label class="vertical"><span><strong>简介</strong><small>帮助玩家了解作品</small></span><textarea v-model="project.summary" maxlength="1000" @change="game.saveProject(project)"></textarea></label><label><span><strong>强调色</strong><small>播放器与按钮颜色</small></span><input v-model="project.accentColor" class="color-input" type="color" @change="game.saveProject(project)"></label><label><span><strong>开始节点</strong><small>新游戏从这里开始</small></span><select v-model="project.startNodeId" @change="game.saveProject(project)"><option v-for="item in project.nodes" :key="item.id" :value="item.id">{{ item.title }}</option></select></label></section>
          <div class="tg-section-title"><div><h3>游玩规则</h3><p>这些设置只影响本作品</p></div></div>
          <section class="tg-setting-card"><button type="button" @click="project.settings.autoSave=!project.settings.autoSave;game.saveProject(project)"><span><strong>自动存档</strong><small>每次推进剧情后覆盖自动存档</small></span><i :class="{on:project.settings.autoSave}"><b></b></i></button><button type="button" @click="project.settings.allowRollback=!project.settings.allowRollback;game.saveProject(project)"><span><strong>允许回退</strong><small>玩家可返回上一个剧情检查点</small></span><i :class="{on:project.settings.allowRollback}"><b></b></i></button><button type="button" @click="project.settings.showVariableChanges=!project.settings.showVariableChanges;game.saveProject(project)"><span><strong>显示变量面板</strong><small>仅显示标记为玩家可见的变量</small></span><i :class="{on:project.settings.showVariableChanges}"><b></b></i></button><button type="button" @click="project.settings.reduceMotion=!project.settings.reduceMotion;game.saveProject(project)"><span><strong>减少动态效果</strong><small>关闭不必要的位移与淡入动画</small></span><i :class="{on:project.settings.reduceMotion}"><b></b></i></button></section>
          <div class="tg-section-title"><div><h3>影响聊天</h3><p>全部默认关闭，只对已邀请进作品的聊天角色生效</p></div></div>
          <section class="tg-setting-card tg-chat-integration"><button class="master" type="button" @click="project.settings.chatIntegration.enabled=!project.settings.chatIntegration.enabled;game.saveProject(project)"><span><strong>允许本作品影响聊天提示词</strong><small>总开关关闭时，下面所有内容都不会进入聊天</small></span><i :class="{on:project.settings.chatIntegration.enabled}"><b></b></i></button><button type="button" :disabled="!project.settings.chatIntegration.enabled" @click="project.settings.chatIntegration.includeProjectSummary=!project.settings.chatIntegration.includeProjectSummary;game.saveProject(project)"><span><strong>作品简介</strong><small>让角色知道这部作品的基本背景</small></span><i :class="{on:project.settings.chatIntegration.includeProjectSummary}"><b></b></i></button><button type="button" :disabled="!project.settings.chatIntegration.enabled" @click="project.settings.chatIntegration.includeCurrentScene=!project.settings.chatIntegration.includeCurrentScene;game.saveProject(project)"><span><strong>当前存档场景</strong><small>发送最近存档的章节、节点和正文</small></span><i :class="{on:project.settings.chatIntegration.includeCurrentScene}"><b></b></i></button><button type="button" :disabled="!project.settings.chatIntegration.enabled" @click="project.settings.chatIntegration.includeVisibleVariables=!project.settings.chatIntegration.includeVisibleVariables;game.saveProject(project)"><span><strong>玩家可见变量</strong><small>只发送标记为玩家可见的当前数值</small></span><i :class="{on:project.settings.chatIntegration.includeVisibleVariables}"><b></b></i></button><button type="button" :disabled="!project.settings.chatIntegration.enabled" @click="project.settings.chatIntegration.includeUnlockedEndings=!project.settings.chatIntegration.includeUnlockedEndings;game.saveProject(project)"><span><strong>已解锁结局</strong><small>让角色知道玩家已经抵达的结局</small></span><i :class="{on:project.settings.chatIntegration.includeUnlockedEndings}"><b></b></i></button><button type="button" :disabled="!project.settings.chatIntegration.enabled" @click="project.settings.chatIntegration.includeCharacterProfile=!project.settings.chatIntegration.includeCharacterProfile;game.saveProject(project)"><span><strong>作品内角色设定</strong><small>发送该角色在本作品中的身份与设定</small></span><i :class="{on:project.settings.chatIntegration.includeCharacterProfile}"><b></b></i></button></section>
          <p class="tg-setting-footnote">文游不会把内容写入角色长期记忆、修改聊天关系或代替用户发送消息。关闭总开关后，派生的聊天上下文会立即移除。</p>
          <div class="tg-section-title"><div><h3>数据</h3><p>作品包包含剧本和本地素材，不包含存档与密钥</p></div></div>
          <section class="tg-setting-card"><button type="button" @click="downloadProject"><span><strong>导出 .nrjstory</strong><small>用于迁移、分享或额外备份</small></span><em>导出</em></button><button class="danger-row" type="button" @click="deleteProjectTarget=project.id"><span><strong>删除作品</strong><small>同时删除本作品素材和存档</small></span><em>删除</em></button></section>
        </section>
      </main>
      <nav class="tg-tabs" aria-label="文游创作导航"><button v-for="item in [{id:'script',glyph:'稿',name:'剧本'},{id:'variables',glyph:'值',name:'变量'},{id:'characters',glyph:'角',name:'角色'},{id:'assets',glyph:'媒',name:'素材'},{id:'ai',glyph:'写',name:'AI'},{id:'project',glyph:'设',name:'设置'}]" :key="item.id" type="button" :class="{active:studioTab===item.id}" @click="studioTab=item.id as StudioTab"><span>{{ item.glyph }}</span><small>{{ item.name }}</small></button></nav>
    </template>

    <main v-else-if="view==='player' && project && node && game.runtime.value" class="tg-player" :class="{reduced:project.settings.reduceMotion}" :style="playerStyle">
      <video v-if="currentVideoUrl" class="tg-stage-video" :src="currentVideoUrl" playsinline controls preload="metadata"></video>
      <img v-if="currentPortraitUrl" class="tg-stage-portrait" :src="currentPortraitUrl" :alt="node.speaker || '角色立绘'">
      <header class="tg-player-head"><button type="button" @click="leavePlayer">‹</button><div><strong>{{ project.title }}</strong><small>{{ node.chapter }} · {{ node.title }}</small></div><button type="button" @click="savesSheet=true">存读档</button></header>
      <aside v-if="project.settings.showVariableChanges && visibleVariables.length" class="tg-player-stats"><span v-for="item in visibleVariables" :key="item.id"><small>{{ item.name }}</small><b>{{ game.runtime.value.variables[item.id] }}</b></span></aside>
      <section class="tg-player-panel">
        <audio v-if="currentAudioUrl" :key="currentAudioUrl" :src="currentAudioUrl" controls preload="metadata"></audio>
        <div class="tg-dialogue"><small v-if="node.speaker">{{ node.speaker }}</small><p>{{ node.text }}</p></div>
        <div v-if="node.kind==='choice'" class="tg-player-choices"><button v-for="entry in game.availableChoices.value" :key="entry.choice.id" type="button" :disabled="!entry.available" @click="choose(entry.choice)"><strong>{{ entry.choice.text }}</strong><small v-if="entry.choice.hint">{{ entry.choice.hint }}</small><em v-if="!entry.available">条件不足</em></button></div>
        <section v-else-if="node.kind==='ending'" class="tg-ending"><small>{{ node.endingTone==='good'?'圆满结局':node.endingTone==='bad'?'遗憾结局':node.endingTone==='hidden'?'隐藏结局':'故事结局' }}</small><h2>{{ node.endingTitle || node.title }}</h2><p>{{ node.endingDescription }}</p><div><button type="button" @click="enterPlayer(true)">重新开始</button><button type="button" @click="leavePlayer">回到创作台</button></div></section>
        <button v-else class="tg-continue" type="button" @click="next">继续 <span>›</span></button>
        <div class="tg-player-tools"><button type="button" :disabled="!project.settings.allowRollback" @click="rollback">回退</button><button type="button" @click="game.makeSave('quick').then(()=>notify('快速存档已保存'))">快存</button><button type="button" @click="savesSheet=true">读取</button><span>{{ unlockedEndingCount }}/{{ endings.length }} 结局</span></div>
      </section>
    </main>

    <div v-if="createSheet" class="tg-layer" @click.self="createSheet=false"><section class="tg-sheet"><header><button type="button" @click="createSheet=false">取消</button><strong>创建文游</strong><button type="button" @click="createProject">创建</button></header><div class="tg-sheet-body"><label><span>作品名称</span><input v-model="newTitle" maxlength="80" placeholder="给故事取一个名字"></label><label><span>作者（可选）</span><input v-model="newAuthor" maxlength="50" placeholder="署名"></label><label><span>作品简介（可选）</span><textarea v-model="newSummary" maxlength="1000" placeholder="故事发生在哪里，玩家将经历什么……"></textarea></label><p>创建后会准备一段可直接试玩的示例分支。它只是普通剧情节点，可以全部改写或删除。</p></div></section></div>

    <div v-if="nodeSheet && nodeDraft && project" class="tg-layer" @click.self="nodeSheet=false"><section class="tg-sheet node-sheet"><header><button type="button" @click="nodeSheet=false">取消</button><strong>编辑{{ nodeDraft.kind==='scene'?'场景':nodeDraft.kind==='choice'?'选择':'结局' }}</strong><button type="button" @click="saveNode">保存</button></header><div class="tg-sheet-body"><div class="tg-form-grid"><label><span>节点标题</span><input v-model="nodeDraft.title" maxlength="80"></label><label><span>章节</span><input v-model="nodeDraft.chapter" maxlength="50"></label></div><label><span>说话人</span><input v-model="nodeDraft.speaker" maxlength="40" placeholder="旁白或角色名"></label><label><span>正文</span><textarea v-model="nodeDraft.text" rows="5" maxlength="10000" placeholder="写下这一幕发生的事……"></textarea></label><div v-if="nodeDraft.kind==='scene'" class="tg-form-grid"><label><span>下一个节点</span><select v-model="nodeDraft.nextNodeId"><option value="">未连接</option><option v-for="item in project.nodes.filter(item=>item.id!==nodeDraft!.id)" :key="item.id" :value="item.id">{{ item.title }}</option></select></label></div><template v-if="nodeDraft.kind==='choice'"><div class="tg-subheading"><div><strong>玩家选项</strong><small>每个选项都需要连接目标节点</small></div><button type="button" @click="appendChoice">添加选项</button></div><article v-for="(choice,index) in nodeDraft.choices" :key="choice.id" class="tg-choice-editor"><header><strong>选项 {{ index+1 }}</strong><button type="button" @click="removeChoice(choice.id)">删除</button></header><input v-model="choice.text" maxlength="120" placeholder="选项文字"><input v-model="choice.hint" maxlength="120" placeholder="影响提示（可选）"><select v-model="choice.targetNodeId"><option value="">选择目标节点</option><option v-for="item in project.nodes.filter(item=>item.id!==nodeDraft!.id)" :key="item.id" :value="item.id">{{ item.title }}</option></select><div class="tg-rule-buttons"><button type="button" @click="addChoiceCondition(choice)">＋ 条件</button><button type="button" @click="addChoiceEffect(choice)">＋ 变量变化</button></div><div v-for="(condition,conditionIndex) in choice.conditions" :key="`c${conditionIndex}`" class="tg-rule-row"><small>当</small><select v-model="condition.variableId"><option v-for="item in project.variables" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-model="condition.operator"><option value="eq">等于</option><option value="neq">不等于</option><option value="gte">大于等于</option><option value="lte">小于等于</option><option value="gt">大于</option><option value="lt">小于</option><option value="includes">包含</option></select><input v-model="condition.value" placeholder="值"><button type="button" @click="choice.conditions.splice(conditionIndex,1)">×</button></div><div v-for="(effect,effectIndex) in choice.effects" :key="`e${effectIndex}`" class="tg-rule-row"><small>则</small><select v-model="effect.variableId"><option v-for="item in project.variables" :key="item.id" :value="item.id">{{ item.name }}</option></select><select v-model="effect.operator"><option value="set">设为</option><option value="add">增加</option><option value="subtract">减少</option><option value="toggle">切换</option></select><input v-model="effect.value" placeholder="值"><button type="button" @click="choice.effects.splice(effectIndex,1)">×</button></div></article></template><template v-if="nodeDraft.kind==='ending'"><label><span>结局名称</span><input v-model="nodeDraft.endingTitle" maxlength="80"></label><label><span>结局说明</span><textarea v-model="nodeDraft.endingDescription" maxlength="1000"></textarea></label><label><span>结局类型</span><select v-model="nodeDraft.endingTone"><option value="good">圆满</option><option value="normal">普通</option><option value="bad">遗憾</option><option value="hidden">隐藏</option></select></label></template><div class="tg-subheading"><div><strong>演出素材</strong><small>素材不存在时自动显示纯文字场景</small></div></div><label><span>背景图片</span><select v-model="nodeDraft.backgroundAssetId"><option value="">未设置</option><option v-for="item in assets.filter(asset=>asset.kind==='image')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>角色立绘 / CG</span><select v-model="nodeDraft.portraitAssetId"><option value="">未设置</option><option v-for="item in assets.filter(asset=>asset.kind==='image')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>视频</span><select v-model="nodeDraft.videoAssetId"><option value="">未设置</option><option v-for="item in assets.filter(asset=>asset.kind==='video')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><label><span>配音 / 音乐</span><select v-model="nodeDraft.audioAssetId"><option value="">未设置</option><option v-for="item in assets.filter(asset=>asset.kind==='audio')" :key="item.id" :value="item.id">{{ item.name }}</option></select></label><button v-if="nodeDraft.id!==project.startNodeId" class="tg-delete-node" type="button" @click="deleteNodeTarget=nodeDraft!.id;nodeSheet=false">删除这个节点</button></div></section></div>

    <div v-if="savesSheet && project" class="tg-layer" @click.self="savesSheet=false"><section class="tg-sheet"><header><button type="button" @click="savesSheet=false">关闭</button><strong>存档与读取</strong><button type="button" @click="saveManual">保存</button></header><div class="tg-sheet-body"><label><span>存档名称（可选）</span><input v-model="manualSaveName" maxlength="60" placeholder="例如：进入第二章前"></label><section v-if="game.projectSaves.value.length" class="tg-save-list"><article v-for="save in game.projectSaves.value" :key="save.id"><button type="button" @click="loadSave(save)"><span>{{ save.kind==='auto'?'自':save.kind==='quick'?'快':'存' }}</span><div><strong>{{ save.name }}</strong><p>{{ save.nodeTitle }} · {{ formatTime(save.updatedAt) }}</p></div><b>读取</b></button><button v-if="save.kind==='manual'" type="button" aria-label="删除存档" @click="game.deleteSave(save.id)">×</button></article></section><section v-else class="tg-empty compact"><span>存</span><strong>还没有存档</strong><p>填写名称后点击右上角保存，或在游玩界面使用快速存档。</p></section></div></section></div>

    <div v-if="deleteProjectTarget" class="tg-dialog-layer"><section class="tg-dialog"><span>删</span><h2>删除这部作品？</h2><p>作品剧本、素材和全部存档都会从当前设备删除，其他应用不受影响。此操作无法撤销。</p><div><button type="button" @click="deleteProjectTarget=null">取消</button><button class="danger" type="button" @click="game.deleteProject(deleteProjectTarget!).then(()=>{deleteProjectTarget=null;view='home';notify('作品已删除')})">删除</button></div></section></div>
    <div v-if="deleteNodeTarget" class="tg-dialog-layer"><section class="tg-dialog"><span>删</span><h2>删除这个节点？</h2><p>指向它的跳转和选项会一并断开，其他节点内容不会改变。</p><div><button type="button" @click="deleteNodeTarget=null">取消</button><button class="danger" type="button" @click="game.deleteNode(deleteNodeTarget!).then(()=>{deleteNodeTarget=null;notify('节点已删除')})">删除</button></div></section></div>
    <div v-if="deleteAssetTarget" class="tg-dialog-layer"><section class="tg-dialog"><span>删</span><h2>删除“{{ deleteAssetTarget.name }}”？</h2><p>使用这个素材的场景会恢复为无素材状态，剧本文字不会被删除。</p><div><button type="button" @click="deleteAssetTarget=null">取消</button><button class="danger" type="button" @click="confirmDeleteAsset">删除</button></div></section></div>
  </div>
</template>
