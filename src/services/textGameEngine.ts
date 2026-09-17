/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type {
  TextGameChoice, TextGameCondition, TextGameEffect, TextGameProject, TextGameRuntimeState, TextGameValidationIssue
} from '../types/textGame'

type Value = string | number | boolean

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const coerce = (value: Value, sample: Value): Value => {
  if (typeof sample === 'number') return Number(value) || 0
  if (typeof sample === 'boolean') return value === true || value === 'true' || value === 1
  return String(value ?? '')
}

export const evaluateTextGameCondition = (condition: TextGameCondition, variables: Record<string, Value>) => {
  const left = variables[condition.variableId]
  const right = coerce(condition.value, left ?? condition.value)
  if (condition.operator === 'eq') return left === right
  if (condition.operator === 'neq') return left !== right
  if (condition.operator === 'includes') return String(left ?? '').includes(String(right))
  const a = Number(left)
  const b = Number(right)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  if (condition.operator === 'gt') return a > b
  if (condition.operator === 'gte') return a >= b
  if (condition.operator === 'lt') return a < b
  return a <= b
}

export const isTextGameChoiceAvailable = (choice: TextGameChoice, variables: Record<string, Value>) => {
  if (!choice.conditions.length) return true
  const results = choice.conditions.map(item => evaluateTextGameCondition(item, variables))
  return choice.conditionMode === 'any' ? results.some(Boolean) : results.every(Boolean)
}

export const applyTextGameEffects = (variables: Record<string, Value>, effects: TextGameEffect[], project: TextGameProject) => {
  for (const effect of effects) {
    const definition = project.variables.find(item => item.id === effect.variableId)
    if (!definition) continue
    const current = variables[effect.variableId] ?? definition.initialValue
    if (effect.operator === 'toggle') variables[effect.variableId] = !Boolean(current)
    else if (effect.operator === 'set') variables[effect.variableId] = coerce(effect.value, definition.initialValue)
    else {
      const delta = Number(effect.value) || 0
      let next = Number(current) + (effect.operator === 'subtract' ? -delta : delta)
      if (definition.min !== undefined) next = Math.max(definition.min, next)
      if (definition.max !== undefined) next = Math.min(definition.max, next)
      variables[effect.variableId] = next
    }
  }
}

export const createTextGameRuntime = (project: TextGameProject): TextGameRuntimeState => ({
  projectId: project.id,
  currentNodeId: project.startNodeId || project.nodes[0]?.id || '',
  variables: Object.fromEntries(project.variables.map(item => [item.id, clone(item.initialValue)])),
  visitedNodeIds: [], history: [], unlockedEndingIds: [], startedAt: Date.now(), updatedAt: Date.now(), playTimeMs: 0
})

export const enterTextGameNode = (project: TextGameProject, state: TextGameRuntimeState, nodeId: string, choiceText?: string) => {
  const node = project.nodes.find(item => item.id === nodeId)
  if (!node) throw new Error('剧情节点不存在，作品可能已被修改')
  state.history.push({ nodeId: state.currentNodeId, variables: clone(state.variables), choiceText, visitedAt: Date.now() })
  state.currentNodeId = node.id
  state.visitedNodeIds.push(node.id)
  applyTextGameEffects(state.variables, node.effects, project)
  if (node.kind === 'ending' && node.endingId && !state.unlockedEndingIds.includes(node.endingId)) state.unlockedEndingIds.push(node.endingId)
  state.updatedAt = Date.now()
  return node
}

export const rollbackTextGame = (project: TextGameProject, state: TextGameRuntimeState) => {
  const previous = state.history.pop()
  if (!previous) return false
  if (!project.nodes.some(item => item.id === previous.nodeId)) return false
  state.currentNodeId = previous.nodeId
  state.variables = clone(previous.variables)
  state.visitedNodeIds.pop()
  state.updatedAt = Date.now()
  return true
}

export const validateTextGameProject = (project: TextGameProject): TextGameValidationIssue[] => {
  const issues: TextGameValidationIssue[] = []
  const ids = new Set(project.nodes.map(item => item.id))
  const variableIds = new Set(project.variables.map(item => item.id))
  if (!project.title.trim()) issues.push({ severity: 'error', message: '作品名称不能为空' })
  if (!project.nodes.length) issues.push({ severity: 'error', message: '作品还没有剧情节点' })
  if (!ids.has(project.startNodeId)) issues.push({ severity: 'error', message: '开始节点不存在' })
  const referenced = new Set<string>()
  for (const node of project.nodes) {
    if (!node.title.trim()) issues.push({ severity: 'warning', nodeId: node.id, message: '节点没有标题' })
    if (node.kind === 'scene' && !node.text.trim()) issues.push({ severity: 'warning', nodeId: node.id, message: `“${node.title}”没有正文` })
    if (node.kind !== 'ending' && node.kind !== 'choice' && !node.nextNodeId) issues.push({ severity: 'warning', nodeId: node.id, message: `“${node.title}”没有后续节点` })
    if (node.nextNodeId) { referenced.add(node.nextNodeId); if (!ids.has(node.nextNodeId)) issues.push({ severity: 'error', nodeId: node.id, message: `“${node.title}”指向不存在的节点` }) }
    if (node.kind === 'choice' && !node.choices.length) issues.push({ severity: 'error', nodeId: node.id, message: `“${node.title}”没有选项` })
    for (const choice of node.choices) {
      if (!choice.text.trim()) issues.push({ severity: 'warning', nodeId: node.id, message: `“${node.title}”存在空选项` })
      if (choice.targetNodeId) referenced.add(choice.targetNodeId)
      if (!choice.targetNodeId || !ids.has(choice.targetNodeId)) issues.push({ severity: 'error', nodeId: node.id, message: `选项“${choice.text || '未命名'}”没有有效目标` })
      for (const condition of choice.conditions) if (!variableIds.has(condition.variableId)) issues.push({ severity: 'error', nodeId: node.id, message: `选项“${choice.text || '未命名'}”引用了不存在的变量` })
      for (const effect of choice.effects) if (!variableIds.has(effect.variableId)) issues.push({ severity: 'error', nodeId: node.id, message: `选项“${choice.text || '未命名'}”修改了不存在的变量` })
    }
    for (const effect of node.effects) if (!variableIds.has(effect.variableId)) issues.push({ severity: 'error', nodeId: node.id, message: `“${node.title}”修改了不存在的变量` })
  }
  for (const node of project.nodes) if (node.id !== project.startNodeId && !referenced.has(node.id)) issues.push({ severity: 'warning', nodeId: node.id, message: `“${node.title}”可能无法到达` })
  return issues
}

