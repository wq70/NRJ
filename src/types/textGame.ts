/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type TextGameNodeKind = 'scene' | 'choice' | 'ending'
export type TextGameVariableType = 'number' | 'boolean' | 'string'
export type TextGameCompareOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes'
export type TextGameEffectOperator = 'set' | 'add' | 'subtract' | 'toggle'

export interface TextGameCondition {
  variableId: string
  operator: TextGameCompareOperator
  value: string | number | boolean
}

export interface TextGameEffect {
  variableId: string
  operator: TextGameEffectOperator
  value: string | number | boolean
}

export interface TextGameChoice {
  id: string
  text: string
  targetNodeId: string
  hint: string
  conditionMode: 'all' | 'any'
  conditions: TextGameCondition[]
  effects: TextGameEffect[]
}

export interface TextGameNode {
  id: string
  kind: TextGameNodeKind
  title: string
  chapter: string
  speaker: string
  text: string
  nextNodeId: string
  choices: TextGameChoice[]
  effects: TextGameEffect[]
  backgroundAssetId: string
  portraitAssetId: string
  audioAssetId: string
  videoAssetId: string
  endingId: string
  endingTitle: string
  endingDescription: string
  endingTone: 'good' | 'normal' | 'bad' | 'hidden'
  createdAt: number
  updatedAt: number
}

export interface TextGameVariableDefinition {
  id: string
  name: string
  type: TextGameVariableType
  initialValue: string | number | boolean
  visible: boolean
  min?: number
  max?: number
}

export interface TextGameCharacter {
  id: string
  name: string
  role: string
  description: string
  avatar: string
  source: 'local' | 'chat'
  sourceId?: string
}

export interface TextGameWorldReference {
  id: string
  title: string
  content: string
  sourceId?: string
}

export interface TextGameAsset {
  id: string
  projectId: string
  name: string
  kind: 'image' | 'audio' | 'video'
  mimeType: string
  size: number
  createdAt: number
}

export interface TextGameProjectSettings {
  textSpeed: number
  autoDelay: number
  allowRollback: boolean
  showVariableChanges: boolean
  autoSave: boolean
  reduceMotion: boolean
  chatIntegration: {
    enabled: boolean
    includeProjectSummary: boolean
    includeCurrentScene: boolean
    includeVisibleVariables: boolean
    includeUnlockedEndings: boolean
    includeCharacterProfile: boolean
  }
}

export interface TextGameProject {
  schemaVersion: 1
  id: string
  title: string
  summary: string
  author: string
  tags: string[]
  coverAssetId: string
  accentColor: string
  startNodeId: string
  nodes: TextGameNode[]
  variables: TextGameVariableDefinition[]
  characters: TextGameCharacter[]
  worldReferences: TextGameWorldReference[]
  settings: TextGameProjectSettings
  createdAt: number
  updatedAt: number
}

export interface TextGameHistoryEntry {
  nodeId: string
  variables: Record<string, string | number | boolean>
  choiceText?: string
  visitedAt: number
}

export interface TextGameRuntimeState {
  projectId: string
  currentNodeId: string
  variables: Record<string, string | number | boolean>
  visitedNodeIds: string[]
  history: TextGameHistoryEntry[]
  unlockedEndingIds: string[]
  startedAt: number
  updatedAt: number
  playTimeMs: number
}

export interface TextGameSave {
  id: string
  projectId: string
  name: string
  nodeTitle: string
  kind: 'auto' | 'quick' | 'manual'
  state: TextGameRuntimeState
  createdAt: number
  updatedAt: number
}

export interface TextGameSnapshot {
  version: 1
  projects: TextGameProject[]
  saves: TextGameSave[]
  lastProjectId: string
  updatedAt: number
}

export interface TextGameValidationIssue {
  severity: 'error' | 'warning'
  nodeId?: string
  message: string
}

export const makeTextGameId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createTextGameNode = (kind: TextGameNodeKind = 'scene'): TextGameNode => {
  const now = Date.now()
  return {
    id: makeTextGameId('node'), kind, title: kind === 'ending' ? '新的结局' : kind === 'choice' ? '新的选择' : '新的场景',
    chapter: '第一章', speaker: '', text: '', nextNodeId: '', choices: [], effects: [], backgroundAssetId: '',
    portraitAssetId: '', audioAssetId: '', videoAssetId: '', endingId: kind === 'ending' ? makeTextGameId('ending') : '',
    endingTitle: kind === 'ending' ? '未命名结局' : '', endingDescription: '', endingTone: 'normal', createdAt: now, updatedAt: now
  }
}

export const createTextGameProject = (input: { title: string; summary?: string; author?: string }): TextGameProject => {
  const now = Date.now()
  const opening = createTextGameNode('scene')
  opening.title = '故事开始'
  opening.speaker = '旁白'
  opening.text = '从这里写下故事的第一句话。'
  return {
    schemaVersion: 1, id: makeTextGameId('story'), title: input.title.trim() || '未命名作品', summary: input.summary?.trim() || '',
    author: input.author?.trim() || '', tags: [], coverAssetId: '', accentColor: '#8b6f91', startNodeId: opening.id,
    nodes: [opening], variables: [], characters: [], worldReferences: [],
    settings: {
      textSpeed: 28, autoDelay: 1400, allowRollback: true, showVariableChanges: true, autoSave: true, reduceMotion: false,
      chatIntegration: {
        enabled: false, includeProjectSummary: false, includeCurrentScene: false, includeVisibleVariables: false,
        includeUnlockedEndings: false, includeCharacterProfile: false
      }
    },
    createdAt: now, updatedAt: now
  }
}
