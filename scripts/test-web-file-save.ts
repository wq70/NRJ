import assert from 'node:assert/strict'
import { canShareWebFile, downloadWebFile, isAndroidWebEnvironment, preferredWebFileAction, releasePreparedWebFile, shareWebFile, webDownloadSubmittedMessage, type PreparedWebFile } from '../src/services/webFileSave'

const defineGlobal = (name: string, value: unknown) => Object.defineProperty(globalThis, name, { configurable: true, value })
const originalNavigator = globalThis.navigator
const originalDocument = globalThis.document
const originalWindow = globalThis.window
const originalRevoke = URL.revokeObjectURL

try {
  const file = new File(['backup'], '粘人精-完整备份.nrtbackup', { type: 'application/octet-stream' })
  const prepared: PreparedWebFile = { file, objectUrl: 'blob:test-backup' }
  let clicked = false
  let appended = false
  let removed = false
  const anchor = { href: '', download: '', rel: '', click: () => { clicked = true }, remove: () => { removed = true } }
  defineGlobal('document', { createElement: () => anchor, body: { appendChild: () => { appended = true } } })
  defineGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 15)', share: async () => undefined, canShare: () => true })

  downloadWebFile(prepared)
  assert.equal(anchor.href, prepared.objectUrl)
  assert.equal(anchor.download, file.name)
  assert.equal(anchor.rel, 'noopener noreferrer')
  assert.equal(appended && clicked && removed, true)
  assert.equal(isAndroidWebEnvironment(), true)
  assert.match(webDownloadSubmittedMessage(), /“下载”目录/)
  assert.equal(canShareWebFile(file), true)
  assert.equal(preferredWebFileAction(file), 'download')

  defineGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5, share: async () => undefined, canShare: () => true })
  assert.equal(preferredWebFileAction(file), 'share')
  assert.match(webDownloadSubmittedMessage(), /Safari/)
  assert.equal(await shareWebFile(file, '备份'), 'shared')

  defineGlobal('navigator', { userAgent: 'iPhone', platform: 'iPhone', maxTouchPoints: 5, share: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }) }, canShare: () => true })
  assert.equal(await shareWebFile(file, '备份'), 'cancelled')

  let releaseDelay = 0
  let revoked = ''
  defineGlobal('window', { setTimeout: (callback: () => void, delay: number) => { releaseDelay = delay; callback(); return 1 } })
  URL.revokeObjectURL = value => { revoked = value }
  releasePreparedWebFile(prepared)
  assert.equal(releaseDelay, 60_000)
  assert.equal(revoked, prepared.objectUrl)

  console.log('web file save tests passed')
} finally {
  defineGlobal('navigator', originalNavigator)
  defineGlobal('document', originalDocument)
  defineGlobal('window', originalWindow)
  URL.revokeObjectURL = originalRevoke
}
