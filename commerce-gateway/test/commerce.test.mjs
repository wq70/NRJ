import assert from 'node:assert/strict'
import { test } from 'node:test'
import { randomBytes } from 'node:crypto'
import vm from 'node:vm'
import { BrowserManager } from '../src/browser.mjs'
import { Repository } from '../src/repository.mjs'
import { clickTarget, decrypt, encrypt, moneyCents, normalizeProduct, passwordHash, platformUrl, publicAddress, readPage, redact, safeUrl, validateAction, verifyPassword } from '../src/policy.mjs'

test('only HTTPS URLs belonging to the selected platform can navigate', () => {
  assert.equal(platformUrl('https://item.jd.com/123.html', 'jd'), 'https://item.jd.com/123.html')
  for (const url of ['http://m.jd.com/', 'https://jd.com.evil.test/', 'https://jd.com@evil.test/', 'https://m.jd.com:444/', 'https://127.0.0.1/', 'file:///etc/passwd', 'https://www.taobao.com/']) assert.throws(() => platformUrl(url, 'jd'))
  assert.throws(() => platformUrl('https://m.jd.com/', '__proto__'))
  assert.equal(platformUrl('https://www.alipay.com/', 'taobao'), 'https://www.alipay.com/')
})
test('private, loopback, metadata and mapped private IPs are denied', () => {
  for (const ip of ['127.0.0.1', '10.2.3.4', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '198.19.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'not-an-ip']) assert.equal(publicAddress(ip), false, ip)
  assert.equal(publicAddress('8.8.8.8'), true)
  assert.equal(publicAddress('2606:4700:4700::1111'), true)
})
test('credentials and URLs are not retained in product observations', () => {
  assert.equal(safeUrl('https://item.taobao.com/item.htm?id=100&token=secret&code=1234'), 'https://item.taobao.com/item.htm?id=100')
  assert.doesNotMatch(redact('13812345678\n收货地址：某市某路\naccess_token=secret\n商品价格25元'), /13812345678|某市|secret/)
  const p = normalizeProduct({ url: 'https://item.jd.com/123.html?token=secret', title: '真实商品', price: '￥129.90', specification: '蓝色', imageUrl: 'https://cdn.example/image.jpg?token=secret' }, 'jd', 123)
  assert.equal(p.priceCents, 12990); assert.equal(p.id, 'jd:123'); assert.equal(p.observedAt, 123)
  assert.equal(p.source, 'page-observation'); assert.equal(p.stock, undefined)
  assert.doesNotMatch(JSON.stringify(p), /secret/)
})
test('unknown, ranges and conditional prices do not become zero or checkout totals', () => {
  assert.equal(moneyCents('129.90'), 12990)
  assert.equal(moneyCents('¥0'), 0)
  for (const value of ['', '未知', '¥12-20', '¥12起', '券后¥9', '¥12.345']) assert.equal(moneyCents(value), undefined)
})
test('encrypted records cannot be read with another key or a modified tag', () => {
  const key = randomBytes(32), value = encrypt({ cookies: ['private'], order: '10000001' }, key)
  assert.doesNotMatch(value, /private|10000001/)
  assert.deepEqual(decrypt(value, key), { cookies: ['private'], order: '10000001' })
  assert.throws(() => decrypt(value, randomBytes(32)))
  const [iv, tag, bytes] = value.split('.'); const modified = Buffer.from(tag, 'base64'); modified[0] ^= 1
  assert.throws(() => decrypt(`${iv}.${modified.toString('base64')}.${bytes}`, key))
})
test('service password hashes are salted, verified, and fail closed', () => {
  const hash = passwordHash('a-long-connection-password')
  assert.equal(verifyPassword('a-long-connection-password', hash), true)
  assert.equal(verifyPassword('wrong-password', hash), false)
  assert.equal(verifyPassword('anything', 'invalid'), false)
  assert.equal(verifyPassword('x'.repeat(257), hash), false)
  assert.notEqual(passwordHash('a-long-connection-password'), hash)
})
test('role selection never grants checkout, payment, or stale-page access', () => {
  const page = { token: 'current', targets: [{ id: 'a', label: '查看规格' }, { id: 'b', label: '加入购物车' }, { id: 'c', label: '立即付款' }] }
  assert.throws(() => validateAction({ token: 'current', targetId: 'a' }, page, 'observe'))
  assert.equal(validateAction({ token: 'current', targetId: 'a' }, page, 'select').id, 'a')
  assert.throws(() => validateAction({ token: 'current', targetId: 'b' }, page, 'select'))
  assert.equal(validateAction({ token: 'current', targetId: 'b' }, page, 'cart').id, 'b')
  assert.throws(() => validateAction({ token: 'current', targetId: 'c' }, page, 'cart'))
  assert.throws(() => validateAction({ token: 'old', targetId: 'a' }, page, 'cart'))
  assert.throws(() => validateAction({ token: 'current', targetId: 'a' }, { ...page, sensitive: true }, 'cart'))
})

function fakePool() {
  const records = new Map(), operations = new Map()
  return {
    records, operations,
    async query(sql, args = []) {
      const key = args.slice(0, 3).join(':'), opKey = args.slice(0, 2).join(':')
      if (sql.startsWith('INSERT INTO nrj_commerce_records')) { records.set(key, args[3]); return { rowCount: 1 } }
      if (sql.startsWith('SELECT payload')) { const payload = records.get(key); return { rows: payload ? [{ payload }] : [] } }
      if (sql.startsWith('DELETE FROM nrj_commerce_records')) { records.delete(key); return { rowCount: 1 } }
      if (sql.startsWith('INSERT INTO nrj_commerce_operations')) {
        if (operations.has(opKey)) return { rowCount: 0 }
        operations.set(opKey, { session_id: args[2], status: args[3] }); return { rowCount: 1 }
      }
      if (sql.startsWith('SELECT * FROM nrj_commerce_operations')) return { rows: [operations.get(opKey)] }
      if (sql.startsWith('UPDATE nrj_commerce_operations')) { Object.assign(operations.get(opKey), { status: args[2], result: args[3] }); return { rowCount: 1 } }
      throw new Error(`Unexpected fixture query: ${sql}`)
    }
  }
}
test('same candidate and credentials remain isolated by trusted owner', async () => {
  const repo = new Repository(fakePool(), randomBytes(32))
  await repo.put('owner-a', 'profile', 'jd', { cookies: 'a-private-cookie' })
  assert.equal(await repo.get('owner-b', 'profile', 'jd'), null)
  assert.deepEqual(await repo.get('owner-a', 'profile', 'jd'), { cookies: 'a-private-cookie' })
  await repo.remove('owner-b', 'profile', 'jd')
  assert.ok(await repo.get('owner-a', 'profile', 'jd'))
})
test('completed mutation is returned rather than dispatched twice', async () => {
  const repo = new Repository(fakePool(), randomBytes(32)); let clicks = 0
  const run = async () => ({ ok: true, value: ++clicks })
  assert.deepEqual(await repo.operation('a', 'request-000000000001', 'session-a', run), { ok: true, value: 1 })
  assert.deepEqual(await repo.operation('a', 'request-000000000001', 'session-a', run), { ok: true, value: 1 })
  assert.equal(clicks, 1)
  await assert.rejects(repo.operation('a', 'request-000000000001', 'session-b', run), /跨会话/)
})
test('lost result and concurrent duplicate are not replayed', async () => {
  const repo = new Repository(fakePool(), randomBytes(32)); let purchases = 0
  const run = async () => { purchases++; throw new Error('lost after platform accepted') }
  await assert.rejects(repo.operation('a', 'request-000000000002', 's', run), /lost/)
  await assert.rejects(repo.operation('a', 'request-000000000002', 's', run), /尚未确认/)
  assert.equal(purchases, 1)
  let resolve
  const pending = repo.operation('a', 'request-000000000003', 's', () => new Promise(r => { resolve = r }))
  await new Promise(r => setImmediate(r))
  await assert.rejects(repo.operation('a', 'request-000000000003', 's', run), /尚未确认/)
  resolve({ ok: true }); await pending
})
test('browser ownership cannot be selected with a client account ID', () => {
  const manager = new BrowserManager({}, {})
  manager.sessions.set('s', { owner: 'a', lastUsed: 1 })
  assert.throws(() => manager.get('b', 's'), /已结束/)
  assert.equal(manager.get('a', 's', false).lastUsed, 1)
  assert.ok(manager.get('a', 's').lastUsed > 1)
})
test('queued actions remain sequential and cannot execute after closing', async () => {
  const manager = new BrowserManager({}, {}), events = []
  const session = { chain: Promise.resolve(), page: { isClosed: () => false }, closed: false }
  await Promise.all([manager.serial(session, async () => { events.push(1); await Promise.resolve(); events.push(2) }), manager.serial(session, () => events.push(3))])
  assert.deepEqual(events, [1, 2, 3])
  session.closed = true
  await assert.rejects(manager.serial(session, () => events.push(4)), /已关闭/)
  assert.deepEqual(events, [1, 2, 3])
})
test('platform DOM attempts exclude sensitive and purchase actions, stale targets and duplicates', () => {
  let clicks = 0
  const button = label => ({ tagName: 'BUTTON', type: 'button', innerText: label, textContent: label, isConnected: true, disabled: false, getBoundingClientRect: () => ({ width: 80, height: 20, left: 0, right: 80, top: 10, bottom: 30 }), getAttribute: () => null, closest: () => null, contains: () => false, click: () => clicks++ })
  const add = button('加入购物车'), pay = button('立即付款'), submit = button('提交订单')
  let hit = add
  const document = { title: '商品', body: {}, querySelectorAll: q => /^(input|iframe|h1)/.test(q) ? [] : [add, pay, submit], querySelector: () => null, createTreeWalker: () => { let i = 0; return { nextNode: () => i++ === 0 ? { parentElement: add, textContent: '商品¥25' } : null } }, elementFromPoint: () => hit }
  const context = vm.createContext({ window: {}, document, location: { href: 'https://item.jd.com/123.html' }, innerHeight: 640, innerWidth: 375, getComputedStyle: () => ({ visibility: 'visible', display: 'block' }), NodeFilter: { SHOW_TEXT: 4 } })
  const capture = () => vm.runInContext(`(${readPage.toString()})()`, context)
  const click = token => vm.runInContext(`(${clickTarget.toString()})(${JSON.stringify({ token, id: '0' })})`, context)
  let page = capture(); assert.deepEqual(Array.from(page.targets, t => t.label), ['加入购物车'])
  assert.equal(click('stale').ok, false); assert.equal(click(page.token).ok, true); assert.equal(click(page.token).ok, false); assert.equal(clicks, 1)
  page = capture(); hit = pay; assert.equal(click(page.token).ok, false)
  hit = add; page = capture(); add.innerText = '立即付款'; assert.equal(click(page.token).ok, false)
  context.location.href = 'https://passport.jd.com/login'; page = capture(); assert.equal(page.sensitive, true); assert.equal(page.text, ''); assert.equal(page.targets.length, 0)
})
test('order reads require a single order detail, never create a paid status', async () => {
  const saved = [], manager = new BrowserManager({ put: async (...args) => saved.push(args) }, {})
  let url = 'https://item.jd.com/123.html', ids = ['100000001']
  const session = { id: 's', owner: 'a', platform: 'jd', lastUsed: 0, chain: Promise.resolve(), page: { isClosed: () => false, url: () => url, evaluate: async () => ({ ids, status: '待付款' }) } }
  manager.sessions.set('s', session)
  await assert.rejects(manager.recordOrder('a', 's'), /订单详情/)
  url = 'https://order.jd.com/orderdetail.action?id=100000001'; ids = ['100000001', '100000002']
  await assert.rejects(manager.recordOrder('a', 's'), /一个订单/)
  ids = ['100000001']; const order = await manager.recordOrder('a', 's')
  assert.equal(order.paymentStatus, 'unknown'); assert.equal(order.source, 'page-observation'); assert.equal(saved.length, 1)
})
