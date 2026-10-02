/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WalletQuote, WalletState } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  side: 'buy' | 'sell'
  selectedCode: string
  activeQuotes: WalletQuote[]
  state: WalletState
  availableCreditCents: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: {
    code: string
    side: 'buy' | 'sell'
    orderType: 'market' | 'limit'
    quantity: number
    limitPriceCents?: number
    fundingSource: 'balance' | 'credit'
  }): void
}>()

const currentCode = ref(props.selectedCode || props.activeQuotes[0]?.code || '')
const orderType = ref<'market' | 'limit'>('market')
const quantity = ref('100')
const limitPrice = ref('')
const fundingSource = ref<'balance' | 'credit'>('balance')

const quote = computed(() => {
  return props.activeQuotes.find(q => q.code === currentCode.value) || props.activeQuotes[0]
})

const estimatedCents = computed(() => {
  const p = orderType.value === 'limit' && Number(limitPrice.value) > 0 
    ? Math.round(Number(limitPrice.value) * 100) 
    : (quote.value?.priceCents || 0)
  const q = Math.max(0, parseInt(quantity.value) || 0)
  return p * q
})

const canSubmit = computed(() => {
  if (!quote.value || quote.value.priceCents <= 0) return false
  const q = parseInt(quantity.value)
  if (!Number.isInteger(q) || q <= 0) return false
  if (orderType.value === 'limit') {
    const lp = Number(limitPrice.value)
    if (!Number.isFinite(lp) || lp <= 0) return false
  }
  return true
})

const handleSubmit = () => {
  emit('submit', {
    code: quote.value.code,
    side: props.side,
    orderType: orderType.value,
    quantity: parseInt(quantity.value),
    limitPriceCents: orderType.value === 'limit' ? Math.round(Number(limitPrice.value) * 100) : undefined,
    fundingSource: fundingSource.value
  })
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">{{ side === 'buy' ? '证券建仓买入' : '证券平仓卖出' }}</span>
          <span class="w-modal-en-sub">{{ side === 'buy' ? 'BUY ORDER' : 'SELL ORDER' }}</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <div class="w-form-group">
          <label class="w-form-label">交易标的 (SYMBOL)</label>
          <select v-model="currentCode" class="w-select">
            <option 
              v-for="q in activeQuotes" 
              :key="q.code" 
              :value="q.code"
              :disabled="q.priceCents <= 0"
            >
              {{ q.name }} ({{ q.code }}) · {{ q.priceCents > 0 ? '¥' + formatWalletMoney(q.priceCents) : '无有效报价' }}
            </option>
          </select>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">委托类型 (ORDER TYPE)</label>
          <div class="w-toggle-flat">
            <button 
              :class="{ active: orderType === 'market' }" 
              @click="orderType = 'market'"
            >
              市价立即撮合 (MARKET)
            </button>
            <button 
              :class="{ active: orderType === 'limit' }" 
              @click="orderType = 'limit'"
            >
              限价挂单委托 (LIMIT)
            </button>
          </div>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">交易数量 股 (SHARES)</label>
          <input 
            v-model="quantity" 
            type="number" 
            step="100" 
            min="100" 
            placeholder="100" 
            class="w-line-input" 
          />
        </div>

        <div v-if="orderType === 'limit'" class="w-form-group">
          <label class="w-form-label">指定委托买卖单价 CNY (TARGET PRICE)</label>
          <input 
            v-model="limitPrice" 
            type="text" 
            inputmode="decimal" 
            :placeholder="quote?.priceCents ? formatWalletMoney(quote.priceCents) : '0.00'" 
            class="w-line-input" 
          />
        </div>

        <div v-if="side === 'buy'" class="w-form-group">
          <label class="w-form-label">结算出资渠道 (PAYMENT CHANNEL)</label>
          <select v-model="fundingSource" class="w-select">
            <option value="balance">可用现金余额 (¥{{ formatWalletMoney(state.cashCents) }})</option>
            <option value="credit" :disabled="!state.credit.enabled">
              花呗信用额度{{ state.credit.enabled ? ` (可用 ¥${formatWalletMoney(availableCreditCents)})` : ' (未开通)' }}
            </option>
          </select>
        </div>

        <div class="w-order-estimate-bar">
          <span class="lbl">预计资金变动</span>
          <strong class="val">¥{{ formatWalletMoney(estimatedCents) }}</strong>
        </div>
      </div>

      <footer class="w-modal-footer">
        <button class="w-btn-secondary" @click="emit('close')">取消</button>
        <button 
          class="w-btn-primary" 
          :class="{ 'sell-theme': side === 'sell' }"
          :disabled="!canSubmit" 
          @click="handleSubmit"
        >
          确认{{ side === 'buy' ? '买入建仓' : '卖出平仓' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.w-toggle-flat {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--w-border);
}
.w-toggle-flat button {
  background: transparent;
  border: none;
  padding: 8px 0;
  font-size: 11px;
  color: var(--w-text-muted);
  cursor: pointer;
  border-right: 1px solid var(--w-border);
}
.w-toggle-flat button:last-child {
  border-right: none;
}
.w-toggle-flat button.active {
  background-color: var(--w-bg-alt);
  color: var(--w-text-main);
  font-weight: 600;
}
.w-order-estimate-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background-color: var(--w-bg-alt);
  border: 1px solid var(--w-border-light);
  margin-top: 8px;
}
.w-order-estimate-bar .lbl {
  font-size: 11px;
  color: var(--w-text-muted);
}
.w-order-estimate-bar .val {
  font-family: var(--w-num-font);
  font-size: 15px;
  font-weight: 600;
  color: var(--w-text-main);
}
.sell-theme {
  background-color: #111827 !important;
}
</style>
