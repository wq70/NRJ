export const PLUGIN_PERMISSIONS = ['chat.read', 'chat.draft', 'files.download'] as const
export type PluginPermission = typeof PLUGIN_PERMISSIONS[number]

export const pluginPermissionLabels: Record<PluginPermission, string> = {
  'chat.read': '读取当前聊天的文字消息',
  'chat.draft': '向当前聊天输入框添加文字（由你发送）',
  'files.download': '导出文件到本机'
}

export interface PluginManifest {
  format: 'nrj-plugin'
  apiVersion: 1
  id: string
  name: string
  version: string
  description: string
  entry: string
  icon?: string
  app: boolean
  extensions: Array<{ target: 'chat'; label: string }>
  permissions: PluginPermission[]
}
export interface PluginFile { mime: string; base64: string }
export interface PluginPackage { manifest: PluginManifest; files: Record<string, PluginFile> }
export interface InstalledPlugin extends PluginPackage {
  enabled: boolean
  grants: PluginPermission[]
  installedAt: number
  updatedAt: number
  previous?: PluginPackage
}
export interface PluginChatContext {
  id?: string | number
  name?: string
  messages?: Array<{ id?: string | number; sender?: string; role?: string; type?: string; messageType?: string; content?: string; text?: string; time?: string | number; timestamp?: number }>
}
export const pluginAppId = (id: string) => `plugin:${id}`
