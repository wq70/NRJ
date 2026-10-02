import assert from 'node:assert/strict'
import { CommerceGateway, CommerceGatewayError, commercePointer, normalizeCommerceEndpoint, saveCommerceEndpoint } from '../src/services/commerceGateway'

const storage = new Map<string, string>()
Object.assign(globalThis, { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) } })
assert.equal(normalizeCommerceEndpoint(''), '/commerce-api')
assert.equal(normalizeCommerceEndpoint('https://commerce.example/commerce-api/'), 'https://commerce.example/commerce-api')
assert.equal(normalizeCommerceEndpoint('http://localhost:8790'), 'http://localhost:8790')
for (const endpoint of ['http://public.example', 'https://user:password@public.example', 'https://public.example/?token=secret', 'javascript:alert(1)']) assert.throws(() => normalizeCommerceEndpoint(endpoint))
saveCommerceEndpoint('a', 'https://commerce.example'); saveCommerceEndpoint('b', 'https://another.example')
assert.equal(storage.get('clingy_commerce_endpoint_a'), 'https://commerce.example')
assert.equal(storage.get('clingy_commerce_endpoint_b'), 'https://another.example')
for (const width of [320, 375, 390]) {
  const p = commercePointer({ left: 10, top: 20, width, height: width / 375 * 640 }, 10 + width / 2, 20 + width / 375 * 320)!
  assert.ok(Math.abs(p.x - 187.5) < 0.001); assert.ok(Math.abs(p.y - 320) < 0.001)
}
assert.equal(commercePointer({ left: 0, top: 0, width: 375, height: 800 }, 187, 10), null, 'letterbox cannot click a different platform target')
assert.equal(commercePointer({ left: 0, top: 0, width: 0, height: 0 }, 0, 0), null)

const originalFetch = globalThis.fetch
const requests: Array<{ url: string; init: RequestInit }> = []
let failMutation = false, returnHtml = false, expire = false
globalThis.fetch = (async (url, init) => {
  requests.push({ url: String(url), init: init || {} })
  if (expire) return new Response(JSON.stringify({ error: '登录过期', code: 'login_required' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  if (returnHtml) return new Response('<html>Vite page</html>', { headers: { 'Content-Type': 'text/html' } })
  if (failMutation && String(url).endsWith('/actions')) throw new TypeError('lost response')
  const body = String(url).includes('/auth/') ? { user: { id: 'trusted-owner', name: '用户' }, csrf: 'in-memory-csrf' } : { ok: true, verified: false, message: '请核对平台结果' }
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch
try {
  const client = new CommerceGateway('https://commerce.example')
  await client.login('service-user', 'service-secret')
  assert.equal(client.user?.id, 'trusted-owner')
  assert.equal(requests.length, 2, 'login verifies that its cookie session actually works')
  await client.action('session-a', { actor: 'user', type: 'click', x: 1, y: 2, frameId: 'f' })
  const action = requests.at(-1)!
  assert.equal(action.init.credentials, 'include'); assert.equal(action.init.redirect, 'error')
  assert.equal((action.init.headers as Record<string, string>)['X-Commerce-CSRF'], 'in-memory-csrf')
  assert.ok(JSON.parse(String(action.init.body)).requestId)
  assert.doesNotMatch([...storage.values()].join(), /service-secret|in-memory-csrf/)
  failMutation = true; const count = requests.length
  await assert.rejects(client.action('session-a', { actor: 'user', type: 'click' }), /不要重复提交/)
  assert.equal(requests.length, count + 1, 'uncertain mutation is never automatically retried')
  failMutation = false; returnHtml = true
  await assert.rejects(client.restore(), /没有运行共逛服务/)
  returnHtml = false; expire = true
  await assert.rejects(client.restore(), (error: unknown) => error instanceof CommerceGatewayError && error.status === 401)
  assert.equal(client.user, null)
} finally { globalThis.fetch = originalFetch }
console.log('commerce-web: trusted session, endpoint isolation, mobile coordinates, cookie verification, no credential backup and no mutation replay passed')
