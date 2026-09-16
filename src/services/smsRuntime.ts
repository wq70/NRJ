/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { appendWalletSms, ensureCharacterSmsThread, findSmsThread, loadSmsContacts, loadSmsSettings, receiveRandomStrangerSms } from './smsService'
import { formatWalletMoney, loadWalletState, type WalletLedgerEntry } from './walletService'
import { generateCharacterProactiveSms } from './smsCharacterService'

const CHECKPOINT_PREFIX = 'clingy_sms_wallet_checkpoint_v1_'
const AUTO_STRANGER_PREFIX = 'clingy_sms_stranger_last_v1_'
const PROACTIVE_PREFIX = 'clingy_sms_character_proactive_v1_'
let started = false

const currentAccountId = () => localStorage.getItem('clingy_chat_auth_state') || 'guest'
const checkpointKey = (accountId: string) => `${CHECKPOINT_PREFIX}${accountId}`
const rememberLedger = (accountId: string, entries: WalletLedgerEntry[]) => {
  localStorage.setItem(checkpointKey(accountId), JSON.stringify(entries.slice(0, 250).map(item => item.id)))
}

const walletMessage = (entry: WalletLedgerEntry) => {
  const direction = entry.amountCents >= 0 ? '入账' : '支出'
  const amount = formatWalletMoney(Math.abs(entry.amountCents))
  const balance = formatWalletMoney(entry.balanceAfterCents)
  return `【钱包服务】${direction} ¥${amount}，${entry.title}${entry.note ? `，备注：${entry.note}` : ''}。当前钱包余额 ¥${balance}。`
}

const syncWallet = (accountId: string, initialize = false) => {
  const state = loadWalletState(accountId)
  let seen: string[] = []
  try { seen = JSON.parse(localStorage.getItem(checkpointKey(accountId)) || '[]') }
  catch { seen = [] }
  if (initialize && !localStorage.getItem(checkpointKey(accountId))) { rememberLedger(accountId, state.ledger); return }
  const known = new Set(seen)
  const fresh = state.ledger.filter(item => !known.has(item.id)).slice(0, 10).reverse()
  for (const entry of fresh) appendWalletSms(accountId, { text: walletMessage(entry), relatedId: entry.relatedId || `ledger:${entry.id}`, createdAt: entry.createdAt })
  rememberLedger(accountId, state.ledger)
}

const maybeReceiveStranger = (accountId: string) => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled || !settings.strangerEnabled || !settings.strangerAutoReceive) return
  const key = `${AUTO_STRANGER_PREFIX}${accountId}`
  const last = Number(localStorage.getItem(key) || 0)
  if (Date.now() - last < 6 * 60 * 60 * 1000) return
  const result = receiveRandomStrangerSms(accountId)
  if (result.ok || result.reason === 'daily_limit') localStorage.setItem(key, String(Date.now()))
}

const maybeReceiveCharacterSms = async (accountId: string) => {
  const settings = loadSmsSettings(accountId)
  if (!settings.enabled || !settings.allowCharacterProactive) return
  const key = `${PROACTIVE_PREFIX}${accountId}`
  const last = Number(localStorage.getItem(key) || 0)
  if (Date.now() - last < 12 * 60 * 60 * 1000) return
  const contacts = loadSmsContacts(accountId)
  if (!contacts.length) return
  const daySeed = Number(new Date().toLocaleDateString('en-CA').replace(/-/g, '')) || 0
  const contact = contacts[daySeed % contacts.length]
  const ensured = ensureCharacterSmsThread(accountId, contact)
  const thread = findSmsThread(accountId, ensured.id) || ensured
  localStorage.setItem(key, String(Date.now()))
  try { await generateCharacterProactiveSms({ accountId, contact, thread }) }
  catch (error) { console.warn('[短信] 角色主动短信生成失败', error) }
}

const onWalletUpdated = (event: Event) => {
  const accountId = String((event as CustomEvent).detail?.accountId || currentAccountId())
  syncWallet(accountId)
}
const onVisibility = () => { if (!document.hidden) { maybeReceiveStranger(currentAccountId()); void maybeReceiveCharacterSms(currentAccountId()) } }

export const startSmsRuntime = () => {
  if (started || typeof window === 'undefined') return
  started = true
  syncWallet(currentAccountId(), true)
  maybeReceiveStranger(currentAccountId())
  void maybeReceiveCharacterSms(currentAccountId())
  window.addEventListener('clingy-wallet-updated', onWalletUpdated)
  document.addEventListener('visibilitychange', onVisibility)
}

export const stopSmsRuntime = () => {
  if (!started || typeof window === 'undefined') return
  started = false
  window.removeEventListener('clingy-wallet-updated', onWalletUpdated)
  document.removeEventListener('visibilitychange', onVisibility)
}
