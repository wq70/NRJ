/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { computed, reactive, ref } from 'vue'
import { mockChats } from './chatState/state'
import { worldBooks } from '../store/worldBook'
import { sendCapabilityMessage } from '../services/api'
import {
  applyTextGameEffects, createTextGameRuntime, enterTextGameNode, isTextGameChoiceAvailable,
  rollbackTextGame, validateTextGameProject
} from '../services/textGameEngine'
import {
  getTextGameAssetBlob, listTextGameAssets, loadTextGameSnapshot, putTextGameAsset, removeTextGameAsset,
  removeTextGameProjectAssets, replaceTextGameProject, replaceTextGameSave, saveTextGameSnapshot
} from '../services/textGameRepository'
import { createTextGamePackage, readTextGamePackage } from '../services/textGamePackage'
import {
  createTextGameNode, createTextGameProject, makeTextGameId,
  type TextGameAsset, type TextGameChoice, type TextGameNode, type TextGameProject,
  type TextGameRuntimeState, type TextGameSave, type TextGameSnapshot, type TextGameVariableDefinition
} from '../types/textGame'

const state = reactive<TextGameSnapshot>({ version: 1, projects: [], saves: [], lastProjectId: '', updatedAt: 0 })
const initialized = ref(false)
const busy = ref(false)
const runtime = ref<TextGameRuntimeState | null>(null)
const activeProjectId = ref('')
let playSessionStartedAt = 0

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const activeProject = computed(() => state.projects.find(item => item.id === activeProjectId.value) || null)
const currentNode = computed(() => activeProject.value?.nodes.find(item => item.id === runtime.value?.currentNodeId) || null)
const projectSaves = computed(() => state.saves.filter(item => item.projectId === activeProjectId.value).sort((a, b) => b.updatedAt - a.updatedAt))
const availableChoices = computed(() => currentNode.value?.choices.map(choice => ({
  choice, available: runtime.value ? isTextGameChoiceAvailable(choice, runtime.value.variables) : false
})) || [])

const persist = async () => saveTextGameSnapshot(state)

const initialize = async () => {
  if (initialized.value) return
  Object.assign(state, await loadTextGameSnapshot())
  initialized.value = true
}

const makeStarterProject = (title: string, summary: string, author: string) => {
  const project = createTextGameProject({ title, summary, author })
  const opening = project.nodes[0]
  opening.text = '夜色落在安静的站台上。远处传来列车的鸣笛，而你手里那封没有署名的信，正等着被打开。'
  const choice = createTextGameNode('choice')
  choice.title = '站台上的决定'; choice.chapter = '第一章'; choice.speaker = '旁白'; choice.text = '你准备怎么做？'
  const openEnding = createTextGameNode('ending')
  openEnding.title = '拆开信封'; openEnding.chapter = '第一章'; openEnding.speaker = '旁白'; openEnding.text = '纸页上只有一行字：不要登上今晚的最后一班车。'
  openEnding.endingTitle = '命运的来信'; openEnding.endingDescription = '你决定直面信中的秘密。'; openEnding.endingTone = 'hidden'
  const leaveEnding = createTextGameNode('ending')
  leaveEnding.title = '转身离开'; leaveEnding.chapter = '第一章'; leaveEnding.speaker = '旁白'; leaveEnding.text = '你把信留在长椅上。列车驶过时，车窗里却映出了另一个自己。'
  leaveEnding.endingTitle = '错身而过'; leaveEnding.endingDescription = '有些答案会追上离开的人。'; leaveEnding.endingTone = 'normal'
  opening.nextNodeId = choice.id
  choice.choices = [
    { id: makeTextGameId('choice'), text: '拆开这封信', targetNodeId: openEnding.id, hint: '看看信里写了什么', conditionMode: 'all', conditions: [], effects: [] },
    { id: makeTextGameId('choice'), text: '把信留在原处', targetNodeId: leaveEnding.id, hint: '不介入陌生人的秘密', conditionMode: 'all', conditions: [], effects: [] }
  ]
  project.nodes.push(choice, openEnding, leaveEnding)
  return project
}

const createProject = async (title: string, summary = '', author = '') => {
  const project = makeStarterProject(title, summary, author)
  state.projects.unshift(project)
  activeProjectId.value = project.id
  state.lastProjectId = project.id
  await persist()
  return project
}

const saveProject = async (project: TextGameProject = activeProject.value!) => {
  if (!project) return
  project.updatedAt = Date.now()
  replaceTextGameProject(state.projects, project)
  state.lastProjectId = project.id
  await persist()
}

const duplicateProject = async (project: TextGameProject) => {
  const copy = clone(project)
  copy.id = makeTextGameId('story'); copy.title = `${project.title} 副本`; copy.createdAt = Date.now(); copy.updatedAt = Date.now()
  const assetIdMap = new Map<string, string>()
  for (const asset of await listTextGameAssets(project.id)) {
    const blob = await getTextGameAssetBlob(asset.id)
    if (!blob) continue
    const nextId = makeTextGameId('asset')
    assetIdMap.set(asset.id, nextId)
    await putTextGameAsset({ ...asset, id: nextId, projectId: copy.id, createdAt: Date.now() }, blob)
  }
  const remapAsset = (assetId: string) => assetIdMap.get(assetId) || ''
  copy.coverAssetId = remapAsset(copy.coverAssetId)
  copy.nodes.forEach(node => {
    node.backgroundAssetId = remapAsset(node.backgroundAssetId)
    node.portraitAssetId = remapAsset(node.portraitAssetId)
    node.audioAssetId = remapAsset(node.audioAssetId)
    node.videoAssetId = remapAsset(node.videoAssetId)
  })
  state.projects.unshift(copy)
  await persist()
  return copy
}

const deleteProject = async (projectId: string) => {
  state.projects = state.projects.filter(item => item.id !== projectId)
  state.saves = state.saves.filter(item => item.projectId !== projectId)
  await removeTextGameProjectAssets(projectId)
  if (activeProjectId.value === projectId) { activeProjectId.value = ''; runtime.value = null }
  await persist()
}

const addNode = async (kind: TextGameNode['kind']) => {
  if (!activeProject.value) throw new Error('请先打开作品')
  const node = createTextGameNode(kind)
  const last = activeProject.value.nodes[activeProject.value.nodes.length - 1]
  node.chapter = last?.chapter || '第一章'
  activeProject.value.nodes.push(node)
  await saveProject()
  return node
}

const deleteNode = async (nodeId: string) => {
  const project = activeProject.value
  if (!project) return false
  if (project.startNodeId === nodeId) throw new Error('开始节点不能删除，请先设置其他开始节点')
  project.nodes = project.nodes.filter(item => item.id !== nodeId)
  for (const node of project.nodes) {
    if (node.nextNodeId === nodeId) node.nextNodeId = ''
    node.choices = node.choices.filter(choice => choice.targetNodeId !== nodeId)
  }
  await saveProject(project)
  return true
}

const addChoice = (node: TextGameNode): TextGameChoice => {
  const choice: TextGameChoice = { id: makeTextGameId('choice'), text: '新的选项', targetNodeId: '', hint: '', conditionMode: 'all', conditions: [], effects: [] }
  node.choices.push(choice); node.updatedAt = Date.now()
  return choice
}

const addVariable = async (name: string, type: TextGameVariableDefinition['type']) => {
  if (!activeProject.value) return
  const variable: TextGameVariableDefinition = {
    id: makeTextGameId('variable'), name: name.trim() || '新变量', type,
    initialValue: type === 'number' ? 0 : type === 'boolean' ? false : '', visible: true,
    ...(type === 'number' ? { min: 0, max: 100 } : {})
  }
  activeProject.value.variables.push(variable)
  await saveProject()
  return variable
}

const deleteVariable = async (variableId: string) => {
  const project = activeProject.value
  if (!project) return
  project.variables = project.variables.filter(item => item.id !== variableId)
  for (const node of project.nodes) {
    node.effects = node.effects.filter(item => item.variableId !== variableId)
    for (const choice of node.choices) {
      choice.conditions = choice.conditions.filter(item => item.variableId !== variableId)
      choice.effects = choice.effects.filter(item => item.variableId !== variableId)
    }
  }
  await saveProject()
}

const importCharacter = async (sourceId: string) => {
  const project = activeProject.value
  const chat = mockChats.value.find(item => String(item.id) === sourceId)
  if (!project || !chat) return
  if (project.characters.some(item => item.source === 'chat' && item.sourceId === sourceId)) throw new Error('这个角色已经加入作品')
  project.characters.push({
    id: makeTextGameId('character'), name: String(chat.name || '未命名角色'), role: '',
    description: String(chat.persona || chat.description || ''), avatar: String(chat.avatarUrl || chat.avatar || ''), source: 'chat', sourceId
  })
  await saveProject()
}

const importWorldBook = async (sourceId: string) => {
  const project = activeProject.value
  const book = worldBooks.find(item => item.id === sourceId && item.type === 'book')
  if (!project || !book) return
  if (project.worldReferences.some(item => item.sourceId === sourceId)) throw new Error('这本世界书已经加入作品')
  project.worldReferences.push({ id: makeTextGameId('world'), title: book.title, content: book.entries.filter(item => item.enabled).map(item => `${item.title}\n${item.content}`).join('\n\n'), sourceId })
  await saveProject()
}

const addAsset = async (file: File) => {
  const project = activeProject.value
  if (!project) throw new Error('请先打开作品')
  const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : null
  if (!kind) throw new Error('仅支持图片、音频和视频文件')
  const limit = kind === 'video' ? 200 * 1024 * 1024 : 40 * 1024 * 1024
  if (file.size > limit) throw new Error(kind === 'video' ? '单个视频不能超过 200MB' : '单个素材不能超过 40MB')
  const asset: TextGameAsset = { id: makeTextGameId('asset'), projectId: project.id, name: file.name, kind, mimeType: file.type, size: file.size, createdAt: Date.now() }
  await putTextGameAsset(asset, file)
  return asset
}

const removeAsset = async (assetId: string) => {
  const project = activeProject.value
  if (project) {
    if (project.coverAssetId === assetId) project.coverAssetId = ''
    for (const node of project.nodes) {
      if (node.backgroundAssetId === assetId) node.backgroundAssetId = ''
      if (node.portraitAssetId === assetId) node.portraitAssetId = ''
      if (node.audioAssetId === assetId) node.audioAssetId = ''
      if (node.videoAssetId === assetId) node.videoAssetId = ''
    }
    await saveProject(project)
  }
  await removeTextGameAsset(assetId)
}

const startGame = async (project: TextGameProject, fromBeginning = false) => {
  activeProjectId.value = project.id
  state.lastProjectId = project.id
  const auto = !fromBeginning ? state.saves.find(item => item.projectId === project.id && item.kind === 'auto') : null
  runtime.value = auto ? clone(auto.state) : createTextGameRuntime(project)
  playSessionStartedAt = Date.now()
  const node = project.nodes.find(item => item.id === runtime.value!.currentNodeId)
  if (node && !runtime.value.visitedNodeIds.length) {
    runtime.value.visitedNodeIds.push(node.id)
    applyTextGameEffects(runtime.value.variables, node.effects, project)
  }
  await persist()
}

const accountPlayTime = () => {
  if (!runtime.value || !playSessionStartedAt) return
  runtime.value.playTimeMs += Date.now() - playSessionStartedAt
  playSessionStartedAt = Date.now()
}

const makeSave = async (kind: TextGameSave['kind'], name?: string) => {
  const project = activeProject.value
  if (!project || !runtime.value) throw new Error('当前没有进行中的故事')
  accountPlayTime()
  const node = currentNode.value
  const existing = kind === 'manual' ? null : state.saves.find(item => item.projectId === project.id && item.kind === kind)
  const now = Date.now()
  const save: TextGameSave = {
    id: existing?.id || makeTextGameId('save'), projectId: project.id,
    name: name?.trim() || (kind === 'auto' ? '自动存档' : kind === 'quick' ? '快速存档' : `存档 ${new Date(now).toLocaleString('zh-CN')}`),
    nodeTitle: node?.title || '未知位置', kind, state: clone(runtime.value), createdAt: existing?.createdAt || now, updatedAt: now
  }
  replaceTextGameSave(state.saves, save)
  await persist()
  return save
}

const autoSave = async () => { if (activeProject.value?.settings.autoSave && runtime.value) await makeSave('auto') }

const goNext = async () => {
  const project = activeProject.value; const node = currentNode.value; const run = runtime.value
  if (!project || !node || !run || !node.nextNodeId) return false
  enterTextGameNode(project, run, node.nextNodeId)
  await autoSave(); return true
}

const choose = async (choice: TextGameChoice) => {
  const project = activeProject.value; const run = runtime.value
  if (!project || !run || !isTextGameChoiceAvailable(choice, run.variables)) return false
  applyTextGameEffects(run.variables, choice.effects, project)
  enterTextGameNode(project, run, choice.targetNodeId, choice.text)
  await autoSave(); return true
}

const rollback = async () => {
  const project = activeProject.value; const run = runtime.value
  if (!project || !run || !project.settings.allowRollback) return false
  const changed = rollbackTextGame(project, run)
  if (changed) await autoSave()
  return changed
}

const loadSave = async (save: TextGameSave) => {
  const project = state.projects.find(item => item.id === save.projectId)
  if (!project) throw new Error('存档对应的作品不存在')
  if (!project.nodes.some(item => item.id === save.state.currentNodeId)) throw new Error('作品已修改，这个存档的位置不再存在')
  activeProjectId.value = project.id; runtime.value = clone(save.state); playSessionStartedAt = Date.now()
}

const deleteSave = async (saveId: string) => { state.saves = state.saves.filter(item => item.id !== saveId); await persist() }

const exportProject = async (project: TextGameProject) => createTextGamePackage(project, await listTextGameAssets(project.id))

const importProject = async (file: File) => {
  const { project, files } = await readTextGamePackage(file)
  const existing = state.projects.find(item => item.id === project.id)
  const assetIdMap = new Map<string, string>()
  if (existing) {
    project.id = makeTextGameId('story')
    project.title = `${project.title}（导入）`
  }
  for (const { asset, blob } of files) {
    const nextId = existing ? makeTextGameId('asset') : asset.id
    assetIdMap.set(asset.id, nextId)
    await putTextGameAsset({ ...asset, id: nextId, projectId: project.id }, blob)
  }
  if (existing) {
    const remapAsset = (assetId: string) => assetIdMap.get(assetId) || ''
    project.coverAssetId = remapAsset(project.coverAssetId)
    project.nodes.forEach(node => {
      node.backgroundAssetId = remapAsset(node.backgroundAssetId)
      node.portraitAssetId = remapAsset(node.portraitAssetId)
      node.audioAssetId = remapAsset(node.audioAssetId)
      node.videoAssetId = remapAsset(node.videoAssetId)
    })
  }
  replaceTextGameProject(state.projects, project)
  await persist()
  return project
}

const generateOutline = async (idea: string) => {
  const project = activeProject.value
  if (!project || !idea.trim()) throw new Error('请先填写创作要求')
  busy.value = true
  try {
    const result = await sendCapabilityMessage('text-game-writing', [
      { role: 'system', content: '你是互动叙事编剧。根据要求输出严格 JSON，不要 Markdown。结构为 {"nodes":[{"title":"场景标题","speaker":"说话人或旁白","text":"正文","choices":["选项一","选项二"]}]}。生成 3 到 8 个连续场景；只有需要玩家决定的场景才写 choices。不要写变量、代码或解释。' },
      { role: 'user', content: `作品：${project.title}\n简介：${project.summary || '未填写'}\n角色：${project.characters.map(item => `${item.name}（${item.role || '角色'}）`).join('、') || '未设置'}\n创作要求：${idea.trim()}` }
    ])
    const raw = typeof result === 'string' ? result : result.content
    const json = String(raw || '').match(/\{[\s\S]*\}/)?.[0]
    if (!json) throw new Error('AI 没有返回可识别的剧本结构')
    const parsed = JSON.parse(json)
    if (!Array.isArray(parsed.nodes) || !parsed.nodes.length) throw new Error('AI 返回的剧本没有场景')
    const created = parsed.nodes.slice(0, 12).map((item: any) => {
      const hasChoices = Array.isArray(item.choices) && item.choices.length > 0
      const node = createTextGameNode(hasChoices ? 'choice' : 'scene')
      node.title = String(item.title || 'AI 场景').slice(0, 80); node.speaker = String(item.speaker || '旁白').slice(0, 40); node.text = String(item.text || '').slice(0, 6000)
      if (hasChoices) node.choices = item.choices.slice(0, 6).map((text: unknown) => ({ id: makeTextGameId('choice'), text: String(text).slice(0, 120), targetNodeId: '', hint: '', conditionMode: 'all' as const, conditions: [], effects: [] }))
      return node
    })
    for (let index = 0; index < created.length - 1; index++) if (created[index].kind === 'scene') created[index].nextNodeId = created[index + 1].id
    project.nodes.push(...created)
    await saveProject(project)
    return created
  } finally { busy.value = false }
}

export const useTextGame = () => ({
  state, initialized, busy, runtime, activeProjectId, activeProject, currentNode, projectSaves, availableChoices,
  characters: computed(() => mockChats.value.filter(item => item.id !== 1 && item.chatType !== 'group' && !item.isCreate && item.contactState !== 'candidate')),
  worldBooks: computed(() => worldBooks.filter(item => item.type === 'book')),
  initialize, createProject, saveProject, duplicateProject, deleteProject, addNode, deleteNode, addChoice,
  addVariable, deleteVariable, importCharacter, importWorldBook, addAsset, removeAsset, listAssets: listTextGameAssets,
  getAssetBlob: getTextGameAssetBlob, startGame, goNext, choose, rollback, makeSave, loadSave, deleteSave,
  exportProject, importProject, generateOutline, validateProject: validateTextGameProject
})
