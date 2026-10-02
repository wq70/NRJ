import { lookup } from 'node:dns/promises'
import { randomUUID } from 'node:crypto'
import { CommerceError, clickTarget, normalizeProduct, platformUrl, publicAddress, readPage, redact, requirePlatform, safeUrl, validateAction } from './policy.mjs'

export class BrowserManager {
  constructor(repository, pool, options = {}) {
    this.repository = repository; this.pool = pool; this.options = options
    this.sessions = new Map(); this.browser = null; this.starting = null
    this.networkCache = new Map()
  }
  async engine() {
    if (this.browser?.isConnected()) return this.browser
    if (!this.starting) this.starting = import('playwright').then(async ({ chromium }) => {
      this.browser = await chromium.launch({ headless: true, chromiumSandbox: true })
      return this.browser
    }).finally(() => { this.starting = null })
    return this.starting
  }
  async allowedNetwork(url, session, topLevel) {
    if (!/^https:\/\//.test(url)) return false
    if (topLevel) { try { platformUrl(url, session.platform) } catch { return false } }
    const host = new URL(url).hostname
    const cached = this.networkCache.get(host)
    if (cached && cached.expires > Date.now()) return cached.allowed
    const addresses = await lookup(host, { all: true }).catch(() => [])
    const allowed = addresses.length > 0 && addresses.every(entry => publicAddress(entry.address))
    if (this.networkCache.size > 500) this.networkCache.clear()
    this.networkCache.set(host, { allowed, expires: Date.now() + 30000 })
    return allowed
  }
  get(owner, id, touch = true) {
    const session = this.sessions.get(id)
    if (!session || session.owner !== owner || session.closed) throw new CommerceError('共逛会话已结束，请重新打开平台', 404, 'session_expired')
    if (touch) session.lastUsed = Date.now()
    return session
  }
  async open(owner, platform, url, remember = false) {
    requirePlatform(platform)
    const address = platformUrl(url || requirePlatform(platform).home, platform)
    const existing = [...this.sessions.values()].find(s => s.owner === owner && s.platform === platform && !s.closed)
    if (existing) return this.info(existing)
    if (this.sessions.size >= (this.options.maxSessions || 8)) throw new CommerceError('共逛服务正在忙，请稍后连接', 503)
    const lease = await this.pool.connect()
    const lockName = `nrj-commerce:${owner}:${platform}`
    const locked = (await lease.query('SELECT pg_try_advisory_lock(hashtextextended($1,0)) AS locked', [lockName])).rows[0].locked
    if (!locked) { lease.release(); throw new CommerceError('该平台已有活动会话，请先在原窗口结束共逛', 409, 'session_in_use') }
    let context, createdSession
    try {
      const browser = await this.engine()
      const saved = await this.repository.get(owner, 'profile', platform)
      context = await browser.newContext({ viewport: { width: 375, height: 640 }, deviceScaleFactor: 1, locale: 'zh-CN', acceptDownloads: false, storageState: saved?.state })
      const session = { id: randomUUID(), owner, platform, remember, context, page: null, lastUsed: Date.now(), lease, lockName, chain: Promise.resolve(), permission: 'observe', revision: 0, frame: null, observation: null, closed: false, blocked: '', dialog: null }
      createdSession = session
      lease.on('error', () => { session.closed = true; this.sessions.delete(session.id); void context.close().catch(() => {}) })
      await context.route('**/*', async route => {
        const request = route.request()
        let topLevel = false
        try { topLevel = request.isNavigationRequest() && !request.frame().parentFrame() } catch { /* service worker */ }
        if (await this.allowedNetwork(request.url(), session, topLevel)) await route.continue().catch(() => {})
        else {
          if (topLevel) session.blocked = '平台跳转到尚未支持的地址，已停止。可在外部查看，但不会共享登录状态。'
          await route.abort('blockedbyclient').catch(() => {})
        }
      })
      await context.routeWebSocket('**/*', async route => {
        const url = route.url().replace(/^wss:/, 'https:')
        if (await this.allowedNetwork(url, session, false)) route.connectToServer()
        else route.close()
      })
      context.on('page', page => {
        session.page = page; session.frame = null; session.observation = null; session.revision++
        page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(20000)
        page.on('dialog', dialog => { session.dialog = dialog; session.frame = null; session.observation = null })
        page.on('framenavigated', frame => { if (frame === page.mainFrame()) { session.frame = null; session.observation = null; session.revision++ } })
        page.on('close', () => {
          if (session.page === page) { session.page = context.pages().find(p => !p.isClosed()) || null; session.frame = null; session.observation = null; session.revision++ }
        })
      })
      this.sessions.set(session.id, session)
      await context.newPage()
      try { await session.page.goto(address, { waitUntil: 'domcontentloaded' }) } catch { session.blocked ||= '页面加载暂未完成，请查看页面或刷新；没有自动重试交易。' }
      return this.info(session)
    } catch (error) {
      if (createdSession) { createdSession.closed = true; this.sessions.delete(createdSession.id) }
      await context?.close().catch(() => {})
      await lease.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [lockName]).catch(() => {})
      lease.release()
      throw error
    }
  }
  info(session) {
    let url = requirePlatform(session.platform).home
    try { url = safeUrl(platformUrl(session.page?.url(), session.platform)) } catch { /* empty tab */ }
    return { id: session.id, platform: session.platform, url, permission: session.permission, remember: session.remember, notice: session.blocked, width: 375, height: 640, connection: 'browser', orderVerification: 'page-observation', dialog: session.dialog ? { type: session.dialog.type(), message: redact(session.dialog.message()) } : undefined }
  }
  async serial(session, run) {
    const next = session.chain.catch(() => {}).then(() => {
      if (session.closed || !session.page || session.page.isClosed()) throw new CommerceError('平台页面已关闭，请重新连接', 409)
      return run()
    })
    session.chain = next.catch(() => {})
    return next
  }
  async saveProfile(session) {
    if (session.remember && !session.closed) await this.repository.put(session.owner, 'profile', session.platform, { state: await session.context.storageState({ indexedDB: true }), savedAt: Date.now() })
  }
  async frame(owner, id) {
    const session = this.get(owner, id, false)
    return this.serial(session, async () => {
      if (session.dialog) throw new CommerceError('请先处理平台提示', 409, 'dialog_pending')
      const buffer = await session.page.screenshot({ type: 'jpeg', quality: 65, timeout: 8000 })
      const frameId = randomUUID()
      session.frame = { id: frameId, at: Date.now(), revision: session.revision, url: session.page.url() }
      return { buffer, frameId, notice: session.blocked }
    })
  }
  async capture(owner, id) {
    const session = this.get(owner, id)
    return this.serial(session, async () => {
      platformUrl(session.page.url(), session.platform)
      const raw = await session.page.evaluate(readPage)
      const page = { url: safeUrl(raw.url), title: redact(raw.title), text: raw.sensitive ? '' : redact(raw.text), token: raw.token, sensitive: raw.sensitive, capturedAt: Date.now(), targets: raw.sensitive ? [] : raw.targets.map(t => ({ ...t, label: redact(t.label) })) }
      if (raw.product) page.product = normalizeProduct(raw.product, session.platform)
      session.observation = page
      await this.saveProfile(session)
      return page
    })
  }
  async action(owner, id, body) {
    const session = this.get(owner, id)
    if (body.type === 'dialog') {
      return this.repository.operation(owner, body.requestId, id, async () => {
        if (body.actor !== 'user' || !session.dialog || typeof body.accept !== 'boolean') throw new CommerceError('没有待处理的平台对话框')
        const dialog = session.dialog; session.dialog = null
        if (body.accept) await dialog.accept(typeof body.text === 'string' ? body.text.slice(0, 1000) : undefined)
        else await dialog.dismiss()
        return { ok: true, verified: false, message: '已处理平台提示，请核对平台结果。' }
      })
    }
    return this.repository.operation(owner, body.requestId, id, () => this.serial(session, async () => {
      if (body.type === 'suggestion') {
        if (body.actor !== 'role') throw new CommerceError('无效的角色操作')
        validateAction(body, session.observation, session.permission)
        const result = await session.page.evaluate(clickTarget, { token: body.token, id: body.targetId })
        if (!result.ok) throw new CommerceError(result.reason, 409, 'stale_action')
        session.observation = null; session.frame = null
        return { ok: true, verified: false, message: `已点击「${redact(result.label)}」，请核对平台结果。` }
      }
      if (body.actor !== 'user') throw new CommerceError('平台直接操作仅允许用户执行', 403)
      if (body.type === 'takeover') { session.observation = null; session.frame = null; return { ok: true, message: '已暂停角色建议，由你操作。' } }
      if (body.type === 'permission') {
        if (!['observe', 'select', 'cart'].includes(body.permission)) throw new CommerceError('无效权限')
        session.permission = body.permission; session.observation = null
        return { ok: true, message: '角色权限已更新' }
      }
      if (body.type === 'navigate') await session.page.goto(platformUrl(body.url, session.platform), { waitUntil: 'domcontentloaded' })
      else if (body.type === 'back') { if (!await session.page.goBack({ waitUntil: 'domcontentloaded' })) return { ok: true, message: '已到最前一页' } }
      else if (body.type === 'reload') await session.page.reload({ waitUntil: 'domcontentloaded' })
      else {
        const frame = session.frame
        if (!frame || frame.id !== body.frameId || Date.now() - frame.at > 10000 || frame.revision !== session.revision || frame.url !== session.page.url()) throw new CommerceError('画面已变化，请等待新画面再操作', 409, 'stale_frame')
        // Consumed before dispatch. A timed-out click is never sent again.
        session.frame = null; session.observation = null
        if (body.type === 'click') {
          if (!Number.isFinite(body.x) || !Number.isFinite(body.y) || body.x < 0 || body.x >= 375 || body.y < 0 || body.y >= 640) throw new CommerceError('点击位置超出页面')
          await session.page.mouse.click(body.x, body.y)
        } else if (body.type === 'scroll') {
          if (!Number.isFinite(body.delta) || Math.abs(body.delta) > 1000) throw new CommerceError('无效滚动距离')
          await session.page.mouse.wheel(0, body.delta)
        } else if (body.type === 'text') {
          if (typeof body.text !== 'string' || body.text.length > 1000) throw new CommerceError('输入过长')
          await session.page.keyboard.insertText(body.text)
        } else if (body.type === 'key') {
          if (!['Enter', 'Tab', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown', 'Control+A'].includes(body.key)) throw new CommerceError('不支持的按键')
          await session.page.keyboard.press(body.key)
        } else throw new CommerceError('不支持的操作')
      }
      session.blocked = ''; session.frame = null; session.observation = null
      await this.saveProfile(session)
      return { ok: true, verified: false, message: '操作已发送，请以平台页面结果为准。' }
    }))
  }
  async recordOrder(owner, id) {
    const session = this.get(owner, id)
    return this.serial(session, async () => {
      const url = platformUrl(session.page.url(), session.platform)
      if (!/order|trade|dingdan/i.test(new URL(url).hostname + new URL(url).pathname)) throw new CommerceError('请先打开平台订单详情；商品页面不能作为订单证明')
      const raw = await session.page.evaluate(() => {
        const text = document.body.innerText
        const ids = [...text.matchAll(/(?:订单编号|订单号|订单ID)\s*[:：]?\s*(\d{8,30})/g)].map(m => m[1])
        const status = document.querySelector('.order-state .state-txt,.order-status,[data-testid="order-status"]')?.textContent?.trim() || ''
        return { ids: [...new Set(ids)], status }
      })
      if (raw.ids.length !== 1) throw new CommerceError('无法明确识别一个订单号。请打开单笔订单详情；不会猜测订单或付款状态。')
      const order = { id: `${session.platform}:${raw.ids[0]}`, platform: session.platform, orderNumber: raw.ids[0], source: 'page-observation', status: redact(raw.status).slice(0, 100) || '状态未识别', paymentStatus: 'unknown', url: safeUrl(url), observedAt: Date.now() }
      await this.repository.put(owner, 'order', order.id, order)
      return order
    })
  }
  async close(owner, id, forget = false) {
    const session = this.get(owner, id)
    if (session.dialog) { await session.dialog.dismiss().catch(() => {}); session.dialog = null }
    await session.chain.catch(() => {})
    if (!forget) await this.saveProfile(session).catch(() => {})
    session.closed = true
    try { await session.context.close() } finally {
      this.sessions.delete(id)
      await session.lease.query('SELECT pg_advisory_unlock(hashtextextended($1,0))', [session.lockName]).catch(() => {})
      session.lease.release()
      if (forget) await this.repository.remove(owner, 'profile', session.platform)
    }
  }
  async closeOwner(owner) { for (const s of [...this.sessions.values()]) if (s.owner === owner) await this.close(owner, s.id).catch(() => {}) }
  async cleanup() {
    for (const s of [...this.sessions.values()]) if (Date.now() - s.lastUsed > (this.options.idleMs || 900000)) await this.close(s.owner, s.id).catch(() => {})
  }
  async shutdown() { for (const s of [...this.sessions.values()]) await this.close(s.owner, s.id).catch(() => {}); await this.browser?.close() }
}
