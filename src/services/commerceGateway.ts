import { redactCommerceText } from './commerce'
import type { CommercePlatform } from '../types/commerce'
import type { CommerceActionResult, CommerceCandidate, CommerceRealOrder, CommerceServiceUser, CommerceWebPage, CommerceWebSession } from '../types/commerceWeb'

export class CommerceGatewayError extends Error {
  readonly status: number
  readonly code: string
  constructor(message: string, status: number, code = '') { super(message); this.status = status; this.code = code }
}
export function normalizeCommerceEndpoint(value: string) {
  const text = value.trim().replace(/\/+$/, '') || '/commerce-api'
  if (text === '/commerce-api') return text
  const url = new URL(text)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('服务地址需要使用 HTTPS，不能包含用户名、密码或查询参数。')
  return url.href.replace(/\/+$/, '')
}
export function loadCommerceEndpoint(account: string) {
  try { return normalizeCommerceEndpoint(localStorage.getItem(`clingy_commerce_endpoint_${encodeURIComponent(account)}`) || import.meta.env.VITE_COMMERCE_API_URL || '/commerce-api') }
  catch { return '/commerce-api' }
}
export function saveCommerceEndpoint(account: string, value: string) {
  const endpoint = normalizeCommerceEndpoint(value)
  localStorage.setItem(`clingy_commerce_endpoint_${encodeURIComponent(account)}`, endpoint)
  return endpoint
}
export function commercePointer(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number) {
  const scale = Math.min(rect.width / 375, rect.height / 640)
  if (!(scale > 0)) return null
  const x = (clientX - rect.left - (rect.width - 375 * scale) / 2) / scale
  const y = (clientY - rect.top - (rect.height - 640 * scale) / 2) / scale
  return x < 0 || x >= 375 || y < 0 || y >= 640 ? null : { x, y }
}

// CSRF token and service identity stay in memory. Platform cookies remain in the gateway's isolated browser.
export class CommerceGateway {
  private csrf = ''
  user: CommerceServiceUser | null = null
  readonly endpoint: string
  constructor(endpoint: string) { this.endpoint = endpoint }
  private async response(path: string, method = 'GET', body?: unknown, signal?: AbortSignal) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const abort = () => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) controller.abort()
    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', signal: controller.signal,
        headers: { 'X-Commerce-Client': 'web', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && this.csrf ? { 'X-Commerce-CSRF': this.csrf } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body)
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '共逛服务返回了异常响应' }))
        if (response.status === 401) { this.user = null; this.csrf = '' }
        throw new CommerceGatewayError(error.error || '共逛请求失败', response.status, error.code)
      }
      return response
    } catch (error) {
      if (error instanceof CommerceGatewayError) throw error
      if (signal?.aborted) throw new Error('本次读取已取消')
      throw new Error(method === 'GET' ? '无法连接共逛服务，请检查服务地址、部署状态和浏览器连接权限。' : '请求未得到明确结果。请核对平台页面，不要重复提交购买。')
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort) }
  }
  private async json<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
    const response = await this.response(path, method, body, signal)
    if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('此地址没有运行共逛服务，请在连接设置中填写已部署的服务地址。')
    return response.json()
  }
  async restore() {
    const result = await this.json<{ user: CommerceServiceUser; csrf: string }>('/auth/session')
    this.user = result.user; this.csrf = result.csrf
    return result.user
  }
  async login(username: string, password: string) {
    const result = await this.json<{ user: CommerceServiceUser; csrf: string }>('/auth/login', 'POST', { username, password })
    this.user = result.user; this.csrf = result.csrf
    // Confirm cookies are accepted; otherwise the next browser operation would fail silently.
    await this.restore()
    return result.user
  }
  async logout() { await this.json('/auth/logout', 'POST', {}); this.user = null; this.csrf = '' }
  open(platform: CommercePlatform, url: string, remember: boolean) { return this.json<CommerceWebSession>('/sessions', 'POST', { platform, url, remember }) }
  close(id: string, forget = false) { return this.json(`/sessions/${id}`, 'DELETE', { forget }) }
  info(id: string) { return this.json<CommerceWebSession>(`/sessions/${id}`) }
  async frame(id: string, signal?: AbortSignal) {
    const response = await this.response(`/sessions/${id}/frame`, 'GET', undefined, signal)
    if (!response.headers.get('content-type')?.startsWith('image/')) throw new Error('平台画面暂不可用')
    return { blob: await response.blob(), frameId: response.headers.get('X-Commerce-Frame') || '', notice: decodeURIComponent(response.headers.get('X-Commerce-Notice') || '') }
  }
  capture(id: string, signal?: AbortSignal) { return this.json<CommerceWebPage>(`/sessions/${id}/capture`, 'POST', {}, signal) }
  action(id: string, action: Record<string, unknown>) {
    // Do not retry mutations. Re-use returned operation evidence rather than dispatching a second click.
    return this.json<CommerceActionResult>(`/sessions/${id}/actions`, 'POST', { ...action, requestId: crypto.randomUUID() })
  }
  candidates() { return this.json<{ items: CommerceCandidate[] }>('/candidates') }
  saveCandidate(id: string, productId: string, characterId: string, note: string) { return this.json<CommerceCandidate>('/candidates', 'POST', { sessionId: id, productId, characterId, note: redactCommerceText(note) }) }
  updateCandidate(id: string, changes: Partial<Pick<CommerceCandidate, 'quantity' | 'wished' | 'note'>>) { return this.json<CommerceCandidate>(`/candidates/${id}`, 'POST', changes) }
  removeCandidate(id: string) { return this.json(`/candidates/${id}`, 'DELETE', {}) }
  orders() { return this.json<{ items: CommerceRealOrder[] }>('/orders') }
  recordOrder(id: string) { return this.json<CommerceRealOrder>(`/sessions/${id}/order`, 'POST', {}) }
  exportRecords() { return this.json('/export') }
}
