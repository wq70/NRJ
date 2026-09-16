/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import { isIosWebEnvironment } from '../utils/iosWeb'

export type WebFileShareResult = 'shared' | 'cancelled'

export interface PreparedWebFile {
  file: File
  objectUrl: string
}

const URL_RELEASE_DELAY = 60_000

export const isAndroidWebEnvironment = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '')

export const prepareWebFile = (content: BlobPart, fileName: string, type = 'application/octet-stream'): PreparedWebFile => {
  const file = content instanceof File && content.name === fileName && content.type === type
    ? content
    : new File([content], fileName, { type })
  return { file, objectUrl: URL.createObjectURL(file) }
}

export const releasePreparedWebFile = (prepared: PreparedWebFile | null, delay = URL_RELEASE_DELAY) => {
  if (!prepared?.objectUrl) return
  window.setTimeout(() => URL.revokeObjectURL(prepared.objectUrl), Math.max(0, delay))
}

export const canShareWebFile = (file: File) => {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  try {
    return typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

export const shareWebFile = async (file: File, title: string, text?: string): Promise<WebFileShareResult> => {
  try {
    await navigator.share({ title, text, files: [file] })
    return 'shared'
  } catch (error: any) {
    if (error?.name === 'AbortError') return 'cancelled'
    throw error
  }
}

export const downloadWebFile = (prepared: PreparedWebFile) => {
  const anchor = document.createElement('a')
  anchor.href = prepared.objectUrl
  anchor.download = prepared.file.name
  anchor.rel = 'noopener noreferrer'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

export const preferredWebFileAction = (file: File): 'share' | 'download' => {
  if (isIosWebEnvironment() && canShareWebFile(file)) return 'share'
  return 'download'
}

export const webDownloadSubmittedMessage = () => isIosWebEnvironment()
  ? '已提交给 Safari 下载，请在下载列表或“文件”App 中确认。'
  : isAndroidWebEnvironment()
    ? '已提交给系统下载，请在通知栏或“下载”目录中确认。'
    : '已提交给浏览器下载，请在下载列表中确认。'
