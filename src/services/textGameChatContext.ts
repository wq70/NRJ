/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { TextGameSnapshot } from '../types/textGame'

const STORAGE_KEY = 'clingy_text_game_chat_context_v1'

interface TextGameChatContextRecord {
  characterSourceId: string
  projectTitle: string
  projectSummary?: string
  characterProfile?: string
  currentScene?: string
  variables?: string[]
  endings?: string[]
}

export const syncTextGameChatContext = (snapshot: TextGameSnapshot) => {
  if (typeof localStorage === 'undefined') return
  const records: TextGameChatContextRecord[] = []
  for (const project of snapshot.projects) {
    const settings = project.settings.chatIntegration
    if (!settings?.enabled) continue
    const latestSave = snapshot.saves.filter(item => item.projectId === project.id).sort((a, b) => b.updatedAt - a.updatedAt)[0]
    const currentNode = latestSave ? project.nodes.find(item => item.id === latestSave.state.currentNodeId) : undefined
    const visibleVariables = settings.includeVisibleVariables && latestSave
      ? project.variables.filter(item => item.visible).map(item => `${item.name}=${String(latestSave.state.variables[item.id] ?? item.initialValue)}`)
      : []
    const unlockedEndings = settings.includeUnlockedEndings && latestSave
      ? project.nodes.filter(item => item.kind === 'ending' && latestSave.state.unlockedEndingIds.includes(item.endingId)).map(item => item.endingTitle || item.title)
      : []
    for (const character of project.characters.filter(item => item.source === 'chat' && item.sourceId)) {
      records.push({
        characterSourceId: String(character.sourceId), projectTitle: project.title,
        projectSummary: settings.includeProjectSummary ? project.summary : undefined,
        characterProfile: settings.includeCharacterProfile ? [character.role, character.description].filter(Boolean).join('：') : undefined,
        currentScene: settings.includeCurrentScene && currentNode ? `${currentNode.chapter} · ${currentNode.title}：${currentNode.text}` : undefined,
        variables: visibleVariables.length ? visibleVariables : undefined,
        endings: unlockedEndings.length ? unlockedEndings : undefined
      })
    }
  }
  if (records.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  else localStorage.removeItem(STORAGE_KEY)
}

export const buildTextGameChatContext = (chat: any, english = false) => {
  if (typeof localStorage === 'undefined') return ''
  let records: TextGameChatContextRecord[] = []
  try { records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return '' }
  const characterId = String(chat?.characterEntityId || chat?.id || '')
  const matched = records.filter(item => item.characterSourceId === characterId)
  if (!matched.length) return ''
  const sections = matched.map(item => {
    const details = [
      item.projectSummary ? `${english ? 'Story summary' : '作品简介'}：${item.projectSummary}` : '',
      item.characterProfile ? `${english ? 'Role in this story' : '作品内角色设定'}：${item.characterProfile}` : '',
      item.currentScene ? `${english ? 'Current saved scene' : '当前存档场景'}：${item.currentScene}` : '',
      item.variables?.length ? `${english ? 'Visible story variables' : '玩家可见变量'}：${item.variables.join('；')}` : '',
      item.endings?.length ? `${english ? 'Unlocked endings' : '已解锁结局'}：${item.endings.join('、')}` : ''
    ].filter(Boolean)
    return details.length ? `${english ? 'Interactive story' : '文游作品'}《${item.projectTitle}》\n${details.join('\n')}` : ''
  }).filter(Boolean)
  if (!sections.length) return ''
  return english
    ? `\n\n[User-enabled interactive story context]\nThe user explicitly enabled only the following story fields for this chat. Treat them as story-play context, not as real-life events.\n${sections.join('\n\n')}`
    : `\n\n【用户主动开启的文游上下文】\n用户只允许本次聊天读取以下已勾选的文游字段。它们属于作品游玩经历，不等同于现实经历。\n${sections.join('\n\n')}`
}
