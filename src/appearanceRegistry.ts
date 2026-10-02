/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type AppearanceCategoryId = 'characterProfile' | 'chatRoom' | 'chatList'

export interface AppearanceStyleDefinition {
  id: string
  name: string
  keywords: string
  description: string
}

export interface AppearanceCategoryDefinition {
  id: AppearanceCategoryId
  name: string
  description: string
  styles: AppearanceStyleDefinition[]
}

export const appearanceCategories: AppearanceCategoryDefinition[] = [
  {
    id: 'chatList',
    name: '聊天列表',
    description: '消息首页、置顶会话与列表导航的呈现方式',
    styles: [
      { id: 'default', name: '原版列表', keywords: '完整 · 熟悉', description: '保留当前聊天列表的布局、侧边栏与操作方式。' },
      { id: 'editorial', name: '纯净通透', keywords: '留白 · 诗签', description: '以账号诗签、轻量搜索和无框消息流整理真实会话。' }
    ]
  },
  {
    id: 'characterProfile',
    name: '角色主页',
    description: '角色资料、近况与公开关系的呈现方式',
    styles: [
      { id: 'default', name: '原版主页', keywords: '编辑感 · 留白', description: '保留当前角色主页的完整结构与交互。' },
      { id: 'magazine', name: '私人杂志', keywords: '摄影集 · 冷白', description: '让封面与近况照片成为主页的主要视觉。' },
      { id: 'letter', name: '私人信笺', keywords: '纸页 · 档案', description: '以照片纸、细线和记录感整理角色资料。' }
    ]
  },
  {
    id: 'chatRoom',
    name: '聊天界面',
    description: '单聊、群聊、消息气泡与输入区域的呈现方式',
    styles: [
      { id: 'default', name: '原版聊天', keywords: '沉浸 · 完整', description: '保留当前聊天界面的完整结构、快捷入口与交互。' },
      { id: 'softPink', name: '浅粉简讯', keywords: '留白 · 浅粉', description: '白色画布、浅粉气泡与轻量顶栏，适配单聊、群聊及深色模式。' }
    ]
  }
]

export const appearanceCategoryMap = Object.fromEntries(appearanceCategories.map(category => [category.id, category])) as Record<AppearanceCategoryId, AppearanceCategoryDefinition>

export const getAppearanceStyle = (categoryId: AppearanceCategoryId, styleId: string) => (
  appearanceCategoryMap[categoryId].styles.find(style => style.id === styleId) || appearanceCategoryMap[categoryId].styles[0]
)
