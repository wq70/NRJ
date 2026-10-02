/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import localforage from 'localforage'
import { useWallet } from '../composables/useWallet'
import {
  adjustWalletBalance,
  runWalletPayment,
  saveWalletMarketResult,
  walletMarketRequestKey,
  setWalletPaymentSecurity,
  type WalletPaymentIntent,
  cancelWalletOrder,
  getWalletOrders,
  getWalletWatchlist,
  placeWalletOrder,
  repayWalletCredit,
  resetWalletFinance,
  setWalletBalance,
  refreshCreditLimitIfNeeded,
  type WalletFundingSource,
  type WalletOrder
} from '../services/walletService'
import { sendCapabilityMessage } from '../services/api'
import { refreshWalletLiveMarket, setWalletMarketMode, shouldRefreshWalletLiveMarket } from '../services/walletMarketService'
import {
  createMomentReceiptCode,
  createMomentReceiptPoster,
  getActiveMomentReceiptCode,
  savePendingReceiptShare,
  saveReceiptPoster,
  type MomentReceiptCode
} from '../services/momentPayments'

import WalletOverviewTab from './wallet/tabs/WalletOverviewTab.vue'
import WalletMarketTab from './wallet/tabs/WalletMarketTab.vue'
import WalletServicesTab from './wallet/tabs/WalletServicesTab.vue'

import WalletDepositWithdrawModal from './wallet/modals/WalletDepositWithdrawModal.vue'
import WalletLedgerModal from './wallet/modals/WalletLedgerModal.vue'
import WalletTradeModal from './wallet/modals/WalletTradeModal.vue'
import WalletCardModal from './wallet/modals/WalletCardModal.vue'
import WalletCreditModal from './wallet/modals/WalletCreditModal.vue'
import WalletReceiptModal from './wallet/modals/WalletReceiptModal.vue'
import WalletMarketSettingsModal from './wallet/modals/WalletMarketSettingsModal.vue'
import WalletPasswordModal from './wallet/modals/WalletPasswordModal.vue'
import WalletAccountModal from './wallet/modals/WalletAccountModal.vue'
import { useChatAuth } from '../composables/useChatAuth'
import { globalSettings } from '../store/global'

import './wallet/walletTheme.css'

const emit = defineEmits<{ (event: 'close'): void; (event: 'open-moments'): void }>()
const { accountId, state, currentAccount, chatAccounts, selectAccount, reload, activeQuotes, activePositions, stockMarketValueCents, stockCostCents, bankAssetCents, liabilityCents, totalAssetCents, netAssetCents, persist } = useWallet()

type MainTab = 'wallet' | 'stocks' | 'services'
type DialogType = '' | 'deposit' | 'withdraw' | 'balance' | 'ledger' | 'trade' | 'card' | 'credit' | 'receipt' | 'marketSettings' | 'password' | 'account'

const currentTab = ref<MainTab>('wallet')
const activeDialog = ref<DialogType>('')
const paymentBusy = ref(false)
const { currentChatUserId } = useChatAuth()
const pay = async (intent: Omit<WalletPaymentIntent, 'accountId' | 'theme'>, execute: () => void) => {
  if (paymentBusy.value) return false
  const ownerId = accountId.value
  const dialog = activeDialog.value
  paymentBusy.value = true
  try {
    return await runWalletPayment({ ...intent, accountId: ownerId, theme: 'wallet' }, () => { reload(); execute(); return true }, () => accountId.value === ownerId && activeDialog.value === dialog) || false
  } finally { paymentBusy.value = false }
}


const tradeSide = ref<'buy' | 'sell'>('buy')
const selectedTradeCode = ref('CLY001')
const editingCard = ref<any>(null)
const marketRefreshing = ref(false)
let marketRefreshTimer: number | undefined
const toast = ref<{ text: string; error: boolean } | null>(null)

// 银行卡封面存储
const cardStore = localforage.createInstance({ name: 'nrt-app', storeName: 'wallet-cards' })
const cardCovers = ref<Record<string, { front?: string; back?: string }>>({})

// 收款码相关
const receiptCode = ref<MomentReceiptCode | null>(null)
const receiptPoster = ref('')
const receiptGenerating = ref(false)
const isActivatingCredit = ref(false)

const availableCreditCents = computed(() => Math.max(0, state.value.credit.limitCents - state.value.credit.usedCents))
const activeOrders = computed(() => getWalletOrders(state.value))
const activeWatchlist = computed(() => getWalletWatchlist(state.value))
const recentLedger = computed(() => state.value.ledger.slice(0, 5))

const marketStatusText = computed(() => {
  if (state.value.marketSettings.mode === 'simulation') return '本地离线模拟行情'
  if (state.value.marketSettings.status === 'loading') return '真实行情更新中...'
  if (state.value.marketSettings.status === 'stale') return '已过期 · 显示缓存'
  if (state.value.marketSettings.status === 'error') return '真实行情暂不可用'
  return state.value.marketSettings.providerLabel || '内置A股网络行情'
})

const marketUpdatedText = computed(() => state.value.marketSettings.lastUpdatedAt 
  ? new Date(state.value.marketSettings.lastUpdatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) 
  : '尚未更新'
)

const notify = (text: string, error = false) => {
  toast.value = { text, error }
  window.setTimeout(() => { if (toast.value?.text === text) toast.value = null }, 2400)
}

onMounted(async () => {
  try {
    const keys = await cardStore.keys()
    for (const key of keys) {
      const data = await cardStore.getItem<any>(key)
      if (data) {
        cardCovers.value[key] = typeof data === 'string' ? { front: data } : data
      }
    }
  } catch (e) {
    console.error('Failed to load card covers', e)
  }

  marketRefreshTimer = window.setInterval(() => {
    if (shouldRefreshWalletLiveMarket(state.value)) void refreshLiveMarket(false)
  }, 5000)
})

onBeforeUnmount(() => {
  if (marketRefreshTimer !== undefined) window.clearInterval(marketRefreshTimer)
})

const refreshLiveMarket = async (showResult = true) => {
  if (state.value.marketSettings.mode !== 'live' || marketRefreshing.value) return false
  marketRefreshing.value = true
  const target = state.value
  const requestKey = walletMarketRequestKey(target)
  try {
    await refreshWalletLiveMarket(target)
    if (!saveWalletMarketResult(target, requestKey) || target.accountId !== accountId.value) return false
    if (!activeQuotes.value.some(quote => quote.code === selectedTradeCode.value)) {
      selectedTradeCode.value = activeQuotes.value[0]?.code || ''
    }
    if (showResult) notify('实时行情已同步')
    return true
  } catch (error) {
    if (!saveWalletMarketResult(target, requestKey) || target.accountId !== accountId.value) return false
    if (showResult) notify(error instanceof Error ? error.message : '行情刷新失败', true)
    return false
  } finally {
    marketRefreshing.value = false
  }
}

// 资金操作
const handleMoneySubmit = async ({ cents, note, cardId }: { cents: number; note: string; cardId?: string }) => {
  if (paymentBusy.value) return
  const action = activeDialog.value
  try {
    const execute = () => {
      if (action === 'balance') setWalletBalance(state.value, cents, note || '用户自定余额调整')
      if (action === 'deposit') adjustWalletBalance(state.value, cents, '资金注资', 'deposit', note, cardId)
      if (action === 'withdraw') adjustWalletBalance(state.value, -cents, '资金调拨', 'withdraw', note, cardId)
      persist()
    }
    if (action === 'withdraw' || (action === 'deposit' && cardId)) {
      if (!await pay({ operation: action, title: action === 'withdraw' ? '钱包提现' : '银行卡充值', amountCents: cents, fundingSource: action === 'withdraw' ? 'balance' : 'bank_card', fundingSourceId: action === 'withdraw' ? undefined : cardId }, execute)) return
    } else execute()
    activeDialog.value = ''
    notify('资金操作执行成功')
  } catch (err) { notify(err instanceof Error ? err.message : '操作失败', true) }
}

// 证券下单
const handleTradeSubmit = async (order: { code: string; side: 'buy' | 'sell'; orderType: 'market' | 'limit'; quantity: number; limitPriceCents?: number; fundingSource: WalletFundingSource }) => {
  if (paymentBusy.value) return
  try {
    const execute = () => { placeWalletOrder(state.value, order); persist() }
    if (order.side === 'buy') {
      const quote = activeQuotes.value.find(item => item.code === order.code)
      const amount = (order.orderType === 'limit' ? order.limitPriceCents || 0 : quote?.priceCents || 0) * order.quantity
      if (!await pay({ operation: 'stock', title: `买入${quote?.name || order.code}`, amountCents: amount, fundingSource: order.fundingSource }, execute)) return
    } else execute()
    activeDialog.value = ''
    notify(order.orderType === 'market' ? '交易已立即成交' : '挂单委托已提交')
  } catch (err) { notify(err instanceof Error ? err.message : '下单失败', true) }
}

// 银行卡操作
const handleCardSubmit = async (payload: any) => {
  const ownerId = accountId.value
  const id = payload.id || `card_${Date.now()}`
  const covers: { front?: string; back?: string } = {}
  if (payload.coverFront) covers.front = payload.coverFront
  if (payload.coverBack) covers.back = payload.coverBack

  if (Object.keys(covers).length > 0) {
    await cardStore.setItem(id, covers)
    cardCovers.value[id] = covers
  } else {
    await cardStore.removeItem(id)
    delete cardCovers.value[id]
  }

  if (ownerId !== accountId.value) return
  const isCredit = payload.type === 'credit'
  let parsedBalance = payload.limitOrBalance
  if (parsedBalance === null || isNaN(parsedBalance)) {
    parsedBalance = isCredit ? 5000000 : 2000000
  }

  const existingIdx = state.value.bankCards.findIndex(c => c.id === id)
  const cardData = {
    id,
    name: payload.name,
    type: payload.type,
    fullNumber: payload.digits,
    lastFour: payload.digits.slice(-4),
    expiryDate: payload.expiryDate,
    virtualCvv: String(Math.floor(Math.random() * 900) + 100),
    hasCover: !!payload.coverFront,
    hasBackCover: !!payload.coverBack,
    coverBlur: payload.coverBlur,
    backCoverBlur: payload.backCoverBlur,
    isFavorite: payload.isFavorite,
    enabled: true
  }

  if (existingIdx !== -1) {
    const existing = state.value.bankCards[existingIdx]
    if (isCredit) existing.limitCents = parsedBalance
    else existing.balanceCents = parsedBalance
    state.value.bankCards[existingIdx] = { ...existing, ...cardData }
  } else {
    state.value.bankCards.push({
      ...cardData,
      createdAt: Date.now(),
      balanceCents: isCredit ? undefined : parsedBalance,
      limitCents: isCredit ? parsedBalance : undefined,
      usedCents: isCredit ? 0 : undefined
    })
  }

  persist()
  activeDialog.value = ''
  notify('银行卡底册已保存')
}

const handleRemoveCard = (id: string) => {
  if (state.value.payments.some(p => p.status === 'pending' && p.fundingSource === 'bank_card' && p.fundingSourceId === id)) {
    return notify('该卡存在未决流转款项，暂时无法解绑', true)
  }
  state.value.bankCards = state.value.bankCards.filter(c => c.id !== id)
  persist()
  void cardStore.removeItem(id)
  delete cardCovers.value[id]
  notify('银行卡已解除绑定')
}

// 花呗还款与开通
const handleRepayCredit = async (amount: number) => {
  if (paymentBusy.value) return
  try {
    if (!await pay({ operation: 'repay', title: '花呗还款', amountCents: Math.min(amount, state.value.credit.usedCents), fundingSource: 'balance' }, () => { repayWalletCredit(state.value, amount); persist() })) return
    notify('还款结清成功')
  } catch (err) {
    notify(err instanceof Error ? err.message : '还款失败', true)
  }
}

const handleActivateCredit = async ({ method, customAmount, repaymentDay }: any) => {
  if (isActivatingCredit.value) return
  const ownerId = accountId.value
  isActivatingCredit.value = true
  try {
    let finalLimit = 0
    if (method === 'random') {
      finalLimit = (Math.floor(Math.random() * 500) + 100) * 10000
      state.value.credit.evaluationSummary = '系统随机分配的私享信用额度'
    } else if (method === 'ai') {
      const accountName = currentAccount.value?.name || state.value.accountName || '用户'
      const prompt = `评估用户虚拟信用额度。名称：${accountName}。当前可用现金：${state.value.cashCents/100}元。仅返回一个人民币元整数。`
      const res = await sendCapabilityMessage('chat-auxiliary', [{ role: 'user', content: prompt }])
      if (ownerId !== accountId.value) return
      const match = res.content.match(/\d+/)
      finalLimit = match ? parseInt(match[0]) * 100 : 3000000
      state.value.credit.evaluationSummary = '根据用户身份设定AI核定'
    } else if (method === 'local') {
      finalLimit = Math.max(1000000, Math.round((state.value.cashCents + bankAssetCents.value) * 0.15))
      state.value.credit.evaluationSummary = '根据本地资金与往来流水底册综合测算'
    } else {
      finalLimit = Math.round(Number(customAmount) * 100) || 5000000
      state.value.credit.evaluationSummary = '私享定制核准额度'
    }

    state.value.credit.enabled = true
    state.value.credit.evaluationMethod = method
    state.value.credit.repaymentDay = repaymentDay
    state.value.credit.billingDay = repaymentDay - 10 > 0 ? repaymentDay - 10 : 28 + (repaymentDay - 10)
    state.value.credit.baseLimitCents = finalLimit
    state.value.credit.limitCents = finalLimit
    refreshCreditLimitIfNeeded(state.value)
    persist()
    notify('信用账户授信开通成功')
  } catch (err) {
    notify('开通失败: ' + (err instanceof Error ? err.message : '未知异常'), true)
  } finally {
    isActivatingCredit.value = false
  }
}

const handleDisableCredit = () => {
  if (state.value.credit.usedCents > 0) return notify('请先结清欠款再关闭', true)
  state.value.credit.enabled = false
  state.value.credit.limitCents = 0
  persist()
  activeDialog.value = ''
  notify('信用功能已注销')
}

// 收款码
const handleGenerateReceipt = async ({ amount, remark }: { amount: string; remark: string }) => {
  if (receiptGenerating.value) return
  receiptGenerating.value = true
  try {
    const amt = amount ? Math.round(Number(amount) * 100) : undefined
    const code = createMomentReceiptCode({
      accountId: accountId.value,
      ownerName: currentAccount.value?.name || state.value.accountName || '我',
      paymentHandle: state.value.paymentHandle,
      amountCents: amt,
      remark: remark || ''
    })
    receiptCode.value = code
    const poster = await createMomentReceiptPoster(code)
    if (code.accountId !== accountId.value || receiptCode.value?.id !== code.id) return
    receiptPoster.value = poster
    notify('收款码凭据已重新生成')
  } catch (err) {
    notify('生成失败', true)
  } finally {
    receiptGenerating.value = false
  }
}

const handleSaveReceiptPoster = async () => {
  if (!receiptPoster.value) return
  try {
    await saveReceiptPoster(receiptPoster.value)
    notify('凭证图片已存入设备')
  } catch (err) {
    notify('保存失败', true)
  }
}

const handleShareMoments = () => {
  if (!receiptCode.value || !receiptPoster.value) return
  if (accountId.value !== (currentChatUserId.value || 'guest')) return notify('钱包 USER 与朋友圈账号不同，请切回对应钱包后分享', true)
  savePendingReceiptShare(accountId.value, { code: receiptCode.value, posterDataUrl: receiptPoster.value })
  window.dispatchEvent(new CustomEvent('clingy:open-receipt-share'))
  emit('open-moments')
}

// 账单批量移除
const handleDeleteBills = (ids: string[]) => {
  state.value.ledger = state.value.ledger.filter(b => !ids.includes(b.id))
  persist()
  notify('选定账单已从底册移除')
}

const toggleWatchlist = (code: string) => {
  const list = activeWatchlist.value
  const idx = list.indexOf(code)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(code)
  persist()
}

watch(accountId, () => {
  activeDialog.value = ''; editingCard.value = null; receiptCode.value = null; receiptPoster.value = ''
}, { flush: 'sync' })
const handleSelectAccount = (id: string) => {
  if (paymentBusy.value) return
  selectAccount(id); activeDialog.value = ''; notify('钱包 USER 已切换')
}
const savePassword = (password: string | undefined, type: 'pin' | 'gesture') => {
  setWalletPaymentSecurity(state.value, password, type)
  activeDialog.value = ''; notify(password ? '支付验证已启用' : '支付验证已关闭')
}
const toggleAmountHide = () => {
  state.value.hideAmounts = !state.value.hideAmounts
  persist()
}
</script>

<template>
  <div class="wallet-pure-white" :class="{ 'dark-mode': globalSettings.darkMode }">
    <!-- 开放式编辑排版顶栏 (Editorial Masthead) -->
    <header class="w-top-header">
      <div class="w-top-status-row">
        <!-- 退出落款与防伪标记 -->
        <button class="w-back-btn" @click="emit('close')">
          <span class="back-arrow">‹</span>
          <span class="back-text">PORTFOLIO</span>
        </button>

        <!-- 中部微型水印标记 (Private Banking Archival Mark) -->
        <div class="w-header-stamp">
          <span class="stamp-dot"></span>
          <span class="stamp-text">PRIVATE LEDGER · VERIFIED</span>
        </div>

        <!-- 右侧专属控制：脱敏眼眸 + 优雅私印席位 -->
        <div class="w-top-action-group">
          <!-- 隐私脱敏开关 -->
          <button class="w-header-icon-btn" :title="state.hideAmounts ? '显示明细金额' : '隐去明细金额'" @click="toggleAmountHide">
            <svg v-if="!state.hideAmounts" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>

          <!-- 账号头像入口 (点击切换金库席位) -->
          <button 
            type="button"
            class="w-identity-seal" 
            :disabled="paymentBusy"
            :title="`当前账号：${currentAccount?.name || '私享席位'} (点击切换)`"
            @click="activeDialog = 'account'"
          >
            <img v-if="currentAccount?.avatarUrl" :src="currentAccount.avatarUrl" alt="" class="w-seal-avatar" />
            <div v-else class="w-seal-avatar-blank">{{ (currentAccount?.name || '私').slice(0, 1) }}</div>
          </button>
        </div>
      </div>
    </header>

    <!-- 主展示区 -->
    <main class="w-scrollable-body">
      <!-- 资产总览 Tab -->
      <WalletOverviewTab 
        v-if="currentTab === 'wallet'"
        :state="state"
        :total-asset-cents="totalAssetCents"
        :bank-asset-cents="bankAssetCents"
        :stock-market-value-cents="stockMarketValueCents"
        :liability-cents="liabilityCents"
        :net-asset-cents="netAssetCents"
        :recent-ledger="recentLedger"
        @open-action="(act) => activeDialog = act"
        @switch-tab="(t) => currentTab = t"
      />

      <!-- 证券交易 Tab -->
      <WalletMarketTab 
        v-else-if="currentTab === 'stocks'"
        :state="state"
        :active-quotes="activeQuotes"
        :active-positions="activePositions"
        :active-orders="activeOrders"
        :stock-market-value-cents="stockMarketValueCents"
        :stock-cost-cents="stockCostCents"
        :market-refreshing="marketRefreshing"
        :market-status-text="marketStatusText"
        :market-updated-text="marketUpdatedText"
        @open-trade="(side, code) => { tradeSide = side; if (code) selectedTradeCode = code; activeDialog = 'trade'; }"
        @toggle-watchlist="toggleWatchlist"
        @refresh-market="refreshLiveMarket(true)"
        @cancel-order="(ord) => { cancelWalletOrder(state, ord.id); persist(); notify('委托已撤销'); }"
        @open-settings="activeDialog = 'marketSettings'"
      />

      <!-- 金库服务 Tab -->
      <WalletServicesTab 
        v-else-if="currentTab === 'services'"
        :state="state"
        :available-credit-cents="availableCreditCents"
        :card-covers="cardCovers"
        @open-card-modal="(c) => { editingCard = c || null; activeDialog = 'card'; }"
        @remove-card="handleRemoveCard"
        @open-credit-modal="activeDialog = 'credit'"
        @open-receipt-modal="() => { activeDialog = 'receipt'; handleGenerateReceipt({ amount: '', remark: '' }); }"
        @open-password-modal="activeDialog = 'password'"
        @reset-wallet="() => { resetWalletFinance(state); persist(); notify('钱包金融数据已重置'); }"
      />
    </main>

    <!-- 弹窗子组件体系 -->
    <WalletDepositWithdrawModal 
      v-if="['deposit', 'withdraw', 'balance'].includes(activeDialog)"
      :type="activeDialog as 'deposit' | 'withdraw' | 'balance'"
      :state="state"
      @close="activeDialog = ''"
      @submit="handleMoneySubmit"
    />

    <WalletLedgerModal 
      v-if="activeDialog === 'ledger'"
      :state="state"
      @close="activeDialog = ''"
      @delete-selected="handleDeleteBills"
    />

    <WalletTradeModal 
      v-if="activeDialog === 'trade'"
      :side="tradeSide"
      :selected-code="selectedTradeCode"
      :active-quotes="activeQuotes"
      :state="state"
      :available-credit-cents="availableCreditCents"
      @close="activeDialog = ''"
      @submit="handleTradeSubmit"
    />

    <WalletCardModal 
      v-if="activeDialog === 'card'"
      :card="editingCard"
      :cover-data="editingCard ? cardCovers[editingCard.id] : undefined"
      @close="activeDialog = ''"
      @submit="handleCardSubmit"
    />

    <WalletCreditModal 
      v-if="activeDialog === 'credit'"
      :state="state"
      :available-credit-cents="availableCreditCents"
      :is-activating="isActivatingCredit"
      @close="activeDialog = ''"
      @activate="handleActivateCredit"
      @repay="handleRepayCredit"
      @disable="handleDisableCredit"
      @update-days="({ billingDay, repaymentDay }) => { state.credit.billingDay = billingDay; state.credit.repaymentDay = repaymentDay; persist(); }"
    />

    <WalletReceiptModal 
      v-if="activeDialog === 'receipt'"
      :receipt-code="receiptCode"
      :receipt-poster="receiptPoster"
      :generating="receiptGenerating"
      @close="activeDialog = ''"
      @generate="handleGenerateReceipt"
      @save-poster="handleSaveReceiptPoster"
      @share-moments="handleShareMoments"
    />

    <WalletMarketSettingsModal 
      v-if="activeDialog === 'marketSettings'"
      :state="state"
      :refreshing="marketRefreshing"
      @close="activeDialog = ''"
      @choose-mode="(mode, source) => { setWalletMarketMode(state, mode); if (source) state.marketSettings.source = source; persist(); if (mode === 'live') refreshLiveMarket(false); }"
      @add-symbol="(code) => { state.liveQuotes.push({ code, name: code, sector: '股票', market: code.startsWith('6') ? '沪市' : '深市', marketCode: `${code.startsWith('6') ? 1 : 0}.${code}`, priceCents: 0, previousCloseCents: 0, history: [], source: 'eastmoney' }); persist(); refreshLiveMarket(true); }"
      @remove-symbol="(code) => { state.liveQuotes = state.liveQuotes.filter(item => item.code !== code); persist(); notify('标的已移除'); }"
      @refresh="refreshLiveMarket(true)"
      @save-custom="() => { setWalletMarketMode(state, 'live'); persist(); refreshLiveMarket(true); }"
    />

    <WalletPasswordModal 
      v-if="activeDialog === 'password'"
      :current-password="state.paymentPassword"
      :current-password-type="state.paymentPasswordType"
      :account-name="currentAccount?.name || '未登录钱包'"
      @close="activeDialog = ''"
      @save="savePassword"
    />

    <WalletAccountModal v-if="activeDialog === 'account'" :accounts="currentChatUserId ? chatAccounts : []" :account-id="accountId" @close="activeDialog = ''" @select="handleSelectAccount" />

    <!-- 底部轻盈书签式控制舱 (Editorial Deck) -->
    <nav class="w-editorial-deck">
      <button 
        class="w-deck-nav-btn" 
        :class="{ active: currentTab === 'wallet' }" 
        @click="currentTab = 'wallet'"
      >
        <span class="w-deck-roman">I.</span>
        <span class="w-deck-label">总席资产</span>
      </button>

      <button 
        class="w-deck-nav-btn" 
        :class="{ active: currentTab === 'stocks' }" 
        @click="currentTab = 'stocks'"
      >
        <span class="w-deck-roman">II.</span>
        <span class="w-deck-label">证券市集</span>
      </button>

      <button 
        class="w-deck-nav-btn" 
        :class="{ active: currentTab === 'services' }" 
        @click="currentTab = 'services'"
      >
        <span class="w-deck-roman">III.</span>
        <span class="w-deck-label">金库底册</span>
      </button>
    </nav>

    <!-- 极简 Toast 提示 -->
    <div v-if="toast" class="w-toast" :class="{ error: toast.error }">
      {{ toast.text }}
    </div>
  </div>
</template>

<style scoped>
.w-top-status-row > .w-back-btn,
.w-top-action-group {
  flex-shrink: 0;
}
.w-header-stamp {
  display: flex;
  align-items: center;
  gap: 5px;
  opacity: 0.6;
}
.stamp-dot {
  width: 3px;
  height: 3px;
  background-color: var(--w-accent-gold);
}
.stamp-text {
  font-family: var(--w-serif-en);
  font-size: 8px;
  letter-spacing: 2px;
  color: var(--w-text-muted);
}
@media (max-width: 480px) {
  .w-header-stamp {
    display: none;
  }
}
</style>
