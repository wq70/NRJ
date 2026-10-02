import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { BrowserManager } from './browser.mjs'
import { CommerceError, normalizeProduct, platforms, redact, verifyPassword } from './policy.mjs'
import { Repository } from './repository.mjs'

const env = process.env
const origins = new Set((env.COMMERCE_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean))
const users = JSON.parse(env.COMMERCE_USERS || '[]')
const encryptionKey = Buffer.from(env.COMMERCE_ENCRYPTION_KEY || '', 'base64')
if (!env.DATABASE_URL || encryptionKey.length !== 32 || !origins.size || !users.length || users.some(u => !/^[\w-]{1,80}$/.test(u.id || '') || !/^[a-f\d]{32}:[a-f\d]{128}$/i.test(u.passwordHash || ''))) throw new Error('请配置 DATABASE_URL、32字节 COMMERCE_ENCRYPTION_KEY、COMMERCE_ALLOWED_ORIGINS 和 COMMERCE_USERS（口令哈希）')
const pool = new Pool({ connectionString: env.DATABASE_URL, max: Number(env.COMMERCE_MAX_SESSIONS || 8) + 5 })
const repository = new Repository(pool, encryptionKey)
await repository.initialize()
const manager = new BrowserManager(repository, pool, { maxSessions: Number(env.COMMERCE_MAX_SESSIONS || 8), idleMs: Number(env.COMMERCE_IDLE_MINUTES || 15) * 60000 })
const cookieName = 'nrj_commerce_session'
const sameSite = env.COMMERCE_COOKIE_SAMESITE === 'None' ? 'None' : 'Lax'
const ttl = 12 * 60 * 60 * 1000
const hashToken = token => createHash('sha256').update(token).digest('hex')
const limits = new Map()
const loginLimits = new Map()
const clearCookie = `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=0`
function json(response, status, value) { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)) }
function rateLimit(map, key, count, windowMs) {
  const now = Date.now(), old = map.get(key)
  const entry = old && old.until > now ? old : { count: 0, until: now + windowMs }
  entry.count++; map.set(key, entry)
  if (map.size > 5000) for (const [k, v] of map) if (v.until < now) map.delete(k)
  if (entry.count > count) throw new CommerceError('操作过于频繁，请稍后再试', 429)
}
async function bodyOf(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] || '')) throw new CommerceError('仅支持 JSON 请求')
  const chunks = []; let size = 0
  for await (const chunk of request) { size += chunk.length; if (size > 32768) throw new CommerceError('请求过大', 413); chunks.push(chunk) }
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { throw new CommerceError('请求格式错误') }
}
async function identity(request) {
  const token = String(request.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
  if (!token || !/^[a-f\d]{64}$/.test(token)) throw new CommerceError('请先连接共逛服务', 401, 'login_required')
  const id = hashToken(token), session = await repository.get('_auth', 'session', id)
  if (!session || session.expiresAt < Date.now() || !users.some(u => u.id === session.owner)) throw new CommerceError('服务登录已过期，请重新连接', 401, 'login_required')
  return { ...session, id }
}
const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  const origin = request.headers.origin
  try {
    if (origin && !origins.has(origin)) throw new CommerceError('当前网页域名未获准连接此共逛服务', 403)
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Credentials', 'true')
      response.setHeader('Access-Control-Expose-Headers', 'X-Commerce-Frame, X-Commerce-Notice')
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Commerce-CSRF,X-Commerce-Client')
      response.writeHead(204); response.end(); return
    }
    const url = new URL(request.url, 'http://gateway.internal')
    const path = url.pathname.replace(/^\/commerce-api/, '')
    if (path === '/health' && request.method === 'GET') {
      json(response, 200, { ok: true, service: 'nrj-commerce', platforms: Object.keys(platforms).map(id => ({ id, name: platforms[id].name, connection: 'browser', purchaseFlow: 'unverified', officialApi: false })) }); return
    }
    // Cookies alone cannot authorize cross-site JSON writes.
    if (!['GET', 'HEAD'].includes(request.method) && (!origin || !origins.has(origin) || request.headers['x-commerce-client'] !== 'web')) throw new CommerceError('请求来源无效', 403)
    if (path === '/auth/login' && request.method === 'POST') {
      rateLimit(loginLimits, request.socket.remoteAddress || 'unknown', 8, 60000)
      const body = await bodyOf(request)
      const user = users.find(u => u.id === body.username)
      if (!verifyPassword(body.password, user?.passwordHash || '00000000000000000000000000000000:' + '0'.repeat(128)) || !user) throw new CommerceError('用户名或连接口令不正确', 401)
      const token = randomBytes(32).toString('hex'), csrf = randomBytes(24).toString('hex')
      const previous = await identity(request).catch(() => null)
      if (previous) { await manager.closeOwner(previous.owner); await repository.remove('_auth', 'session', previous.id) }
      await repository.put('_auth', 'session', hashToken(token), { owner: user.id, csrf, expiresAt: Date.now() + ttl })
      response.setHeader('Set-Cookie', `${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${ttl / 1000}`)
      json(response, 200, { user: { id: user.id, name: user.name || user.id }, csrf }); return
    }
    const auth = await identity(request)
    rateLimit(limits, auth.owner, 480, 60000)
    if (!['GET', 'HEAD'].includes(request.method) && request.headers['x-commerce-csrf'] !== auth.csrf) throw new CommerceError('连接状态已变化，请重新连接', 403, 'csrf_invalid')
    const body = ['POST', 'DELETE'].includes(request.method) ? await bodyOf(request) : {}
    if (path === '/auth/session' && request.method === 'GET') { json(response, 200, { user: { id: auth.owner, name: users.find(u => u.id === auth.owner)?.name || auth.owner }, csrf: auth.csrf }); return }
    if (path === '/auth/logout' && request.method === 'POST') {
      await manager.closeOwner(auth.owner); await repository.remove('_auth', 'session', auth.id); response.setHeader('Set-Cookie', clearCookie); json(response, 200, { ok: true }); return
    }
    if (path === '/sessions' && request.method === 'POST') { json(response, 200, await manager.open(auth.owner, body.platform, body.url, body.remember === true)); return }
    const sessionMatch = path.match(/^\/sessions\/([\w-]+)(?:\/(frame|capture|actions|order))?$/)
    if (sessionMatch) {
      const [, id, operation] = sessionMatch
      if (request.method === 'DELETE' && !operation) { await manager.close(auth.owner, id, body.forget === true); json(response, 200, { ok: true }); return }
      if (request.method === 'GET' && !operation) { json(response, 200, manager.info(manager.get(auth.owner, id, false))); return }
      if (request.method === 'GET' && operation === 'frame') {
        const frame = await manager.frame(auth.owner, id)
        response.setHeader('X-Commerce-Frame', frame.frameId)
        response.setHeader('X-Commerce-Notice', encodeURIComponent(frame.notice || ''))
        response.writeHead(200, { 'Content-Type': 'image/jpeg' }); response.end(frame.buffer); return
      }
      if (request.method === 'POST' && operation === 'capture') { json(response, 200, await manager.capture(auth.owner, id)); return }
      if (request.method === 'POST' && operation === 'actions') { json(response, 200, await manager.action(auth.owner, id, body)); return }
      if (request.method === 'POST' && operation === 'order') { json(response, 200, await manager.recordOrder(auth.owner, id)); return }
    }
    if (path === '/candidates' && request.method === 'GET') { json(response, 200, { items: await repository.list(auth.owner, 'candidate') }); return }
    if (path === '/candidates' && request.method === 'POST') {
      const session = manager.get(auth.owner, body.sessionId)
      const observed = session.observation?.product
      if (!observed || session.observation.sensitive || body.productId !== observed.id) throw new CommerceError('请先读取当前商品，不能把手填数据当成平台商品')
      const product = normalizeProduct({ ...observed, price: observed.priceCents == null ? '' : `¥${(observed.priceCents / 100).toFixed(2)}` }, session.platform, observed.observedAt)
      const roleId = String(body.characterId || 'solo').slice(0, 100)
      const id = createHash('sha256').update(`${roleId}:${product.id}:${product.specification}`).digest('hex')
      const existing = await repository.get(auth.owner, 'candidate', id)
      const item = { ...product, id, productId: product.id, characterId: roleId, note: redact(body.note).slice(0, 500), quantity: existing?.quantity || 1, wished: existing?.wished || false, createdAt: existing?.createdAt || Date.now() }
      json(response, 200, await repository.put(auth.owner, 'candidate', id, item)); return
    }
    const candidateMatch = path.match(/^\/candidates\/([a-f\d]{64})$/)
    if (candidateMatch && ['POST', 'DELETE'].includes(request.method)) {
      const id = candidateMatch[1], item = await repository.get(auth.owner, 'candidate', id)
      if (!item) throw new CommerceError('候选商品不存在', 404)
      if (request.method === 'DELETE') { await repository.remove(auth.owner, 'candidate', id); json(response, 200, { ok: true }); return }
      const quantity = body.quantity ?? item.quantity
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new CommerceError('数量必须在1到99之间')
      json(response, 200, await repository.put(auth.owner, 'candidate', id, { ...item, quantity, wished: body.wished == null ? item.wished : body.wished === true, note: body.note == null ? item.note : redact(body.note).slice(0, 500) })); return
    }
    if (path === '/orders' && request.method === 'GET') { json(response, 200, { items: await repository.list(auth.owner, 'order') }); return }
    if (path === '/export' && request.method === 'GET') { json(response, 200, { format: 'nrj-commerce-records', exportedAt: Date.now(), candidates: await repository.list(auth.owner, 'candidate', true), orders: await repository.list(auth.owner, 'order', true) }); return }
    throw new CommerceError('接口不存在', 404)
  } catch (error) {
    const known = error instanceof CommerceError
    const errorId = randomUUID()
    // Never log request bodies, platform URLs, passwords, cookies, or database errors with connection strings.
    if (!known) console.error(JSON.stringify({ event: 'commerce_error', id: errorId, name: error?.name || 'Error' }))
    if (!response.headersSent) json(response, known ? error.status : 503, { error: known ? error.message : '共逛服务暂不可用；操作结果可能待确认，请查看平台页面。', code: known ? error.code : 'service_unavailable', errorId })
    else response.end()
  }
})
const cleanup = setInterval(() => {
  void manager.cleanup().catch(() => {})
  void pool.query("DELETE FROM nrj_commerce_records WHERE owner='_auth' AND kind='session' AND updated_at < now() - interval '1 day'").catch(() => {})
}, 60000)
cleanup.unref()
server.listen(Number(env.PORT || 8790), env.HOST || '127.0.0.1', () => console.log('NRJ commerce gateway ready'))
async function shutdown() { clearInterval(cleanup); server.close(); await manager.shutdown(); await pool.end(); process.exit(0) }
process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown)
