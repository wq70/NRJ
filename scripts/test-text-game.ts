import assert from 'node:assert/strict'
import { applyTextGameEffects, createTextGameRuntime, enterTextGameNode, isTextGameChoiceAvailable, rollbackTextGame, validateTextGameProject } from '../src/services/textGameEngine'
import { createTextGameNode, createTextGameProject, makeTextGameId, type TextGameChoice } from '../src/types/textGame'
import { buildTextGameChatContext, syncTextGameChatContext } from '../src/services/textGameChatContext'

const project = createTextGameProject({ title: '测试作品' })
const opening = project.nodes[0]
const choiceNode = createTextGameNode('choice')
const ending = createTextGameNode('ending')
project.variables.push({ id: 'trust', name: '信任', type: 'number', initialValue: 10, visible: true, min: 0, max: 100 })
opening.nextNodeId = choiceNode.id
choiceNode.choices.push({
  id: makeTextGameId('choice'), text: '相信对方', targetNodeId: ending.id, hint: '', conditionMode: 'all',
  conditions: [{ variableId: 'trust', operator: 'gte', value: 10 }], effects: [{ variableId: 'trust', operator: 'add', value: 95 }]
})
ending.endingId = 'ending_test'; ending.endingTitle = '抵达结局'
project.nodes.push(choiceNode, ending)

assert.deepEqual(validateTextGameProject(project).filter(item => item.severity === 'error'), [])
const runtime = createTextGameRuntime(project)
assert.equal(runtime.variables.trust, 10)
enterTextGameNode(project, runtime, choiceNode.id)
const choice = choiceNode.choices[0] as TextGameChoice
assert.equal(isTextGameChoiceAvailable(choice, runtime.variables), true)
applyTextGameEffects(runtime.variables, choice.effects, project)
assert.equal(runtime.variables.trust, 100, '数值应遵守变量上限')
enterTextGameNode(project, runtime, ending.id, choice.text)
assert.deepEqual(runtime.unlockedEndingIds, ['ending_test'])
assert.equal(rollbackTextGame(project, runtime), true)
assert.equal(runtime.currentNodeId, choiceNode.id)
assert.equal(runtime.variables.trust, 100, '回退应恢复进入结局前的变量状态')

const broken = createTextGameProject({ title: '损坏作品' })
broken.nodes[0].nextNodeId = 'missing'
assert.equal(validateTextGameProject(broken).some(item => item.severity === 'error' && item.message.includes('不存在')), true)

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { memory.set(key, value) },
  removeItem: (key: string) => { memory.delete(key) }
}, configurable: true })
project.characters.push({ id: 'character_test', name: '测试角色', role: '同行者', description: '只属于作品的设定', avatar: '', source: 'chat', sourceId: 'chat_7' })
syncTextGameChatContext({ version: 1, projects: [project], saves: [], lastProjectId: project.id, updatedAt: Date.now() })
assert.equal(buildTextGameChatContext({ id: 'chat_7' }), '', '默认关闭时不得注入聊天提示词')
project.settings.chatIntegration.enabled = true
syncTextGameChatContext({ version: 1, projects: [project], saves: [], lastProjectId: project.id, updatedAt: Date.now() })
assert.equal(buildTextGameChatContext({ id: 'chat_7' }), '', '只开总开关但未选字段时不得注入空上下文')
project.settings.chatIntegration.includeCharacterProfile = true
syncTextGameChatContext({ version: 1, projects: [project], saves: [], lastProjectId: project.id, updatedAt: Date.now() })
assert.match(buildTextGameChatContext({ id: 'chat_7' }), /同行者/)
assert.equal(buildTextGameChatContext({ id: 'other_chat' }), '', '未加入作品的聊天角色不得收到文游上下文')
project.settings.chatIntegration.enabled = false
syncTextGameChatContext({ version: 1, projects: [project], saves: [], lastProjectId: project.id, updatedAt: Date.now() })
assert.equal(buildTextGameChatContext({ id: 'chat_7' }), '', '关闭总开关后应立即移除聊天上下文')

console.log('text-game tests passed')
