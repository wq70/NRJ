import assert from 'node:assert/strict'
import vm from 'node:vm'
import { commercePlatformForUrl, loadCommerceSession, normalizeCommercePage, redactCommerceText, safeCommerceUrl, saveCommerceSession } from '../src/services/commerce'
import { commerceCaptureScript, commerceClickScript } from '../src/services/commercePageScript'

const storage = new Map<string, string>()
Object.assign(globalThis, { localStorage: { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) } })
assert.equal(commercePlatformForUrl('https://item.taobao.com/item.htm?id=123')?.id, 'taobao')
for (const url of ['javascript:alert(1)', 'https://taobao.com.evil.test/', 'https://taobao.com@evil.test/', 'http://m.jd.com/']) assert.equal(commercePlatformForUrl(url), undefined)
assert.equal(safeCommerceUrl('https://item.taobao.com/item.htm?id=123&token=secret&code=123456'), 'https://item.taobao.com/item.htm?id=123')
assert.doesNotMatch(redactCommerceText('电话13812345678\n收货地址：某市某路101号\n花费25元'), /13812345678|某市/)
const session = loadCommerceSession('account-a', 'role-a', 'taobao')
session.url = 'https://login.taobao.com/?token=secret'
session.messages.push({ role: 'user', content: '不加香菜' })
saveCommerceSession('account-a', session)
assert.equal(loadCommerceSession('account-a', 'role-a', 'taobao').messages[0]?.content, '不加香菜')
assert.equal(loadCommerceSession('account-a', 'role-a', 'taobao').url, '')
for (const [account, role, platform] of [['account-b', 'role-a', 'taobao'], ['account-a', 'role-b', 'taobao'], ['account-a', 'role-a', 'jd']] as const) assert.equal(loadCommerceSession(account, role, platform).messages.length, 0)
assert.doesNotMatch([...storage.values()].join(''), /secret/)
const sensitive = normalizeCommercePage({ url: 'https://login.taobao.com/', text: 'secret', sensitive: true, targets: [{ id: '1', label: '付款' }] })
assert.equal(sensitive.text, '')
assert.equal(sensitive.targets.length, 0)

// Exercise the actual WebView scripts against a small DOM fixture, including stale and duplicate actions.
let clicks = 0
const button = (label: string, rect = { width: 90, height: 30, left: 0, right: 90, top: 10, bottom: 40 }) => ({
  tagName: 'BUTTON', type: 'button', innerText: label, textContent: label, isConnected: true, disabled: false,
  getBoundingClientRect: () => rect, getAttribute: () => null, closest: () => null, contains: () => false, click: () => { clicks++ }
})
const add = button('加入购物车')
const pay = button('立即付款')
const submit = button('提交订单')
const hidden = button('隐藏商品', { width: 90, height: 30, left: 0, right: 90, top: 1200, bottom: 1230 })
const elements = [add, pay, submit, hidden]
let hit: unknown = add
const document = {
  title: '真实商品', body: {},
  querySelectorAll: (q: string) => q === 'input' || q.startsWith('h1') ? [] : elements,
  createTreeWalker: () => { let i = 0; return { nextNode: () => i++ === 0 ? { parentElement: add, textContent: '商品 ¥25' } : null } },
  elementFromPoint: () => hit
}
const context = vm.createContext({ window: {}, document, location: { href: 'https://m.jd.com/' }, URL, NodeFilter: { SHOW_TEXT: 4 }, innerHeight: 700, innerWidth: 375, getComputedStyle: () => ({ visibility: 'visible', display: 'block' }) })
const capture = () => JSON.parse(vm.runInContext(commerceCaptureScript, context))
const click = (token: string) => JSON.parse(vm.runInContext(commerceClickScript(token, '0'), context))
let snapshot = capture()
assert.deepEqual(snapshot.targets.map((t: any) => t.label), ['加入购物车'])
assert.equal(click('outdated').ok, false)
assert.equal(click(snapshot.token).ok, true)
assert.equal(click(snapshot.token).ok, false)
assert.equal(clicks, 1)
snapshot = capture(); add.innerText = '立即购买'; assert.equal(click(snapshot.token).ok, false)
add.innerText = '加入购物车'; snapshot = capture(); hit = pay; assert.equal(click(snapshot.token).ok, false)
hit = add; snapshot = capture(); context.location.href = 'https://m.jd.com/other'; assert.equal(click(snapshot.token).ok, false)
context.location.href = 'https://passport.jd.com/login'; snapshot = capture(); assert.equal(snapshot.sensitive, true); assert.equal(snapshot.text, ''); assert.equal(snapshot.targets.length, 0)
console.log('commerce: platform URLs, session isolation, redaction, sensitive pages, stale/duplicate/covered actions passed')
