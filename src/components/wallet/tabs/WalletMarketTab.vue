/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WalletQuote, WalletState, WalletOrder } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  state: WalletState
  activeQuotes: WalletQuote[]
  activePositions: Array<{ code: string; quantity: number; averageCostCents: number }>
  activeOrders: WalletOrder[]
  stockMarketValueCents: number
  stockCostCents: number
  marketRefreshing: boolean
  marketStatusText: string
  marketUpdatedText: string
}>()

const emit = defineEmits<{
  (e: 'open-trade', side: 'buy' | 'sell', code?: string): void
  (e: 'toggle-watchlist', code: string): void
  (e: 'refresh-market'): void
  (e: 'cancel-order', order: WalletOrder): void
  (e: 'open-settings'): void
}>()

const activeSection = ref<'quotes' | 'positions' | 'orders'>('quotes')
const searchQuery = ref('')

const stockProfitCents = computed(() => props.stockMarketValueCents - props.stockCostCents)
const stockRate = computed(() => props.stockCostCents ? (stockProfitCents.value / props.stockCostCents * 100) : 0)

const filteredQuotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return props.activeQuotes
  return props.activeQuotes.filter(item => item.name.toLowerCase().includes(q) || item.code.includes(q))
})

const positionRows = computed(() => props.activePositions.map(pos => {
  const quote = props.activeQuotes.find(item => item.code === pos.code)
  const price = quote?.priceCents || 0
  const profit = (price - pos.averageCostCents) * pos.quantity
  const rate = pos.averageCostCents ? (price - pos.averageCostCents) / pos.averageCostCents * 100 : 0
  return {
    ...pos,
    quote,
    value: price * pos.quantity,
    profit,
    rate
  }
}))
</script>

<template>
  <div class="editorial-market">
    <!-- 开放式编辑刊头：证券持仓概况 -->
    <section class="market-hero">
      <header class="hero-top-meta">
        <span class="meta-label">SECURITIES BOURSE · 证券资产头寸</span>
        <button class="meta-action-btn" @click="emit('open-settings')">
          <span>{{ state.marketSettings.mode === 'live' ? '实时源' : '模拟引擎' }} · 配置</span>
          <span class="btn-arrow">›</span>
        </button>
      </header>

      <div class="hero-val-display">
        <span class="val-currency">¥</span>
        <h1 class="val-headline">{{ formatWalletMoney(stockMarketValueCents) }}</h1>
        <span class="val-tag">PORTFOLIO</span>
      </div>

      <!-- 开放式收益微型注解 -->
      <div class="hero-profit-sub">
        <div class="profit-item">
          <span class="sub-lbl">浮动盈亏 P&L</span>
          <span class="sub-val" :class="stockProfitCents >= 0 ? 'profit-up' : 'profit-down'">
            {{ stockProfitCents >= 0 ? '+' : '' }}¥{{ formatWalletMoney(stockProfitCents) }}
          </span>
        </div>
        <div class="profit-item">
          <span class="sub-lbl">整体回报率 ROI</span>
          <span class="sub-val" :class="stockRate >= 0 ? 'profit-up' : 'profit-down'">
            {{ stockRate >= 0 ? '+' : '' }}{{ stockRate.toFixed(2) }}%
          </span>
        </div>
        <div class="profit-item">
          <span class="sub-lbl">行情终端 SOURCE</span>
          <span class="sub-val text-muted">{{ marketStatusText }}</span>
        </div>
      </div>
    </section>

    <!-- 极简开放式子栏目选择 (Sub Sections) -->
    <nav class="market-sections-nav">
      <button :class="{ active: activeSection === 'quotes' }" @click="activeSection = 'quotes'">
        <span class="nav-idx">I.</span>
        <span>行情报价</span>
      </button>
      <button :class="{ active: activeSection === 'positions' }" @click="activeSection = 'positions'">
        <span class="nav-idx">II.</span>
        <span>持仓头寸 ({{ activePositions.length }})</span>
      </button>
      <button :class="{ active: activeSection === 'orders' }" @click="activeSection = 'orders'">
        <span class="nav-idx">III.</span>
        <span>在途委托 ({{ activeOrders.length }})</span>
      </button>
    </nav>

    <!-- 01 行情报价列表（报纸财经版式，纯平发丝线） -->
    <section v-if="activeSection === 'quotes'" class="market-list-section">
      <div class="editorial-search-bar">
        <span class="search-symbol">§</span>
        <input v-model="searchQuery" type="text" placeholder="输入名称或代码快速检索..." class="search-input" />
        <button v-if="state.marketSettings.mode === 'live'" class="refresh-link" :disabled="marketRefreshing" @click="emit('refresh-market')">
          {{ marketRefreshing ? '同步中' : '刷新' }}
        </button>
      </div>

      <div class="editorial-stock-table">
        <div class="table-header-row">
          <span class="col-name">标的</span>
          <span class="col-price">现价</span>
          <span class="col-pct">涨跌幅</span>
        </div>

        <div 
          v-for="quote in filteredQuotes" 
          :key="quote.code" 
          class="table-data-row"
          @click="emit('open-trade', 'buy', quote.code)"
        >
          <div class="col-name">
            <span class="s-name">{{ quote.name }}</span>
            <span class="s-meta">{{ quote.code }} · {{ quote.market || quote.sector }}</span>
          </div>

          <div class="col-price">
            <span class="s-price">{{ quote.priceCents > 0 ? '¥' + formatWalletMoney(quote.priceCents) : '--' }}</span>
          </div>

          <div class="col-pct">
            <span 
              v-if="quote.previousCloseCents > 0" 
              class="s-pct" 
              :class="quote.priceCents >= quote.previousCloseCents ? 'profit-up' : 'profit-down'"
            >
              {{ quote.priceCents >= quote.previousCloseCents ? '+' : '' }}{{ ((quote.priceCents - quote.previousCloseCents) / quote.previousCloseCents * 100).toFixed(2) }}%
            </span>
            <span v-else class="s-pct">--</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 02 持仓头寸列表 -->
    <section v-else-if="activeSection === 'positions'" class="market-list-section">
      <div v-if="!positionRows.length" class="empty-notice">
        <span>当前投资席位无任何证券持仓组合</span>
      </div>

      <div v-else class="editorial-stock-table">
        <div class="table-header-row">
          <span class="col-name">持仓标的 / 头寸</span>
          <span class="col-pct">持仓市值 / 盈亏</span>
        </div>

        <div 
          v-for="pos in positionRows" 
          :key="pos.code" 
          class="table-data-row"
          @click="emit('open-trade', 'sell', pos.code)"
        >
          <div class="col-name">
            <span class="s-name">{{ pos.quote?.name || pos.code }}</span>
            <span class="s-meta">{{ pos.quantity }} 股 · 成本 ¥{{ formatWalletMoney(pos.averageCostCents) }}</span>
          </div>

          <div class="col-pct right-align">
            <span class="s-price">¥{{ formatWalletMoney(pos.value) }}</span>
            <span class="s-profit" :class="pos.profit >= 0 ? 'profit-up' : 'profit-down'">
              {{ pos.profit >= 0 ? '+' : '' }}¥{{ formatWalletMoney(pos.profit) }} ({{ pos.rate.toFixed(1) }}%)
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- 03 委托底册 -->
    <section v-else-if="activeSection === 'orders'" class="market-list-section">
      <div v-if="!activeOrders.length" class="empty-notice">
        <span>暂无交易委托记录</span>
      </div>

      <div v-else class="editorial-stock-table">
        <div v-for="ord in activeOrders" :key="ord.id" class="order-row-item">
          <div class="order-main">
            <span class="order-action-label" :class="ord.side">
              {{ ord.side === 'buy' ? '买入' : '卖出' }} {{ ord.code }}
            </span>
            <span class="order-sub">{{ ord.quantity }} 股 · {{ ord.orderType === 'market' ? '市价单' : '限价单' }} · {{ ord.status }}</span>
          </div>
          <div class="order-side-act">
            <button v-if="ord.status === 'pending'" class="cancel-link" @click="emit('cancel-order', ord)">
              撤单
            </button>
            <span v-else class="done-label">已结算</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.editorial-market {
  display: flex;
  flex-direction: column;
}

/* 刊头资产：大留白呼吸 */
.market-hero {
  padding: 12px 0 36px 0;
  border-bottom: 1px solid var(--w-hairline);
  margin-bottom: 36px;
}
.hero-top-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
}
.meta-label {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--w-text-secondary);
}
.meta-action-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 3px;
  color: var(--w-accent-gold);
  font-family: var(--w-serif-cn);
  font-size: 11px;
  padding: 0;
}
.hero-val-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 24px;
}
.val-currency {
  font-family: var(--w-serif-en);
  font-size: 22px;
  font-weight: 300;
  color: var(--w-accent-gold);
}
.val-headline {
  margin: 0;
  font-family: var(--w-num-font);
  font-size: 42px;
  font-weight: 400;
  letter-spacing: -1px;
  color: var(--w-text-main);
  line-height: 1;
}
.val-tag {
  font-family: var(--w-serif-en);
  font-size: 8px;
  letter-spacing: 1.5px;
  color: var(--w-text-dim);
  border: 1px solid var(--w-hairline);
  padding: 1px 4px;
}

.hero-profit-sub {
  display: flex;
  gap: 36px;
}
.profit-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sub-lbl {
  font-family: var(--w-serif-cn);
  font-size: 10px;
  color: var(--w-text-muted);
}
.sub-val {
  font-family: var(--w-num-font);
  font-size: 13px;
  font-weight: 500;
}
.profit-up {
  color: var(--w-accent-red) !important;
}
.profit-down {
  color: var(--w-accent-green) !important;
}
.text-muted {
  color: var(--w-text-secondary) !important;
}

/* 子导航栏 */
.market-sections-nav {
  display: flex;
  gap: 32px;
  border-bottom: 1px solid var(--w-hairline);
  margin-bottom: 24px;
}
.market-sections-nav button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 10px 0 14px 0;
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--w-text-muted);
  font-family: var(--w-serif-cn);
  font-size: 13px;
  letter-spacing: 1px;
  position: relative;
  transition: color 0.2s;
}
.market-sections-nav button.active {
  color: #FFFFFF;
}
.market-sections-nav button.active::after {
  content: "";
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  height: 1px;
  background-color: var(--w-accent-gold);
}
.nav-idx {
  font-family: var(--w-serif-en);
  font-size: 10px;
  font-style: italic;
  color: var(--w-accent-gold);
}

/* 搜索条 */
.editorial-search-bar {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--w-hairline-light);
  margin-bottom: 12px;
}
.search-symbol {
  font-family: var(--w-serif-en);
  font-size: 12px;
  color: var(--w-accent-gold);
}
.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: var(--w-serif-cn);
  font-size: 12px;
  color: #FFFFFF;
}
.search-input::placeholder {
  color: var(--w-text-muted);
}
.refresh-link {
  background: transparent;
  border: none;
  color: var(--w-accent-gold);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}

/* 报纸金融版式列表 */
.editorial-stock-table {
  display: flex;
  flex-direction: column;
}
.table-header-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-family: var(--w-serif-cn);
  font-size: 10px;
  color: var(--w-text-muted);
  letter-spacing: 1px;
  border-bottom: 1px solid var(--w-hairline-light);
}
.table-data-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 20px 0;
  border-bottom: 1px solid var(--w-hairline-light);
  cursor: pointer;
  transition: opacity 0.15s;
}
.table-data-row:hover {
  opacity: 0.85;
}
.col-name {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.col-price {
  min-width: 90px;
  text-align: right;
  padding-right: 18px;
}
.col-pct {
  min-width: 70px;
  text-align: right;
}
.col-pct.right-align {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}
.s-name {
  font-family: var(--w-serif-cn);
  font-size: 13px;
  font-weight: 500;
  color: var(--w-text-main);
}
.s-meta {
  font-family: var(--w-num-font);
  font-size: 10px;
  color: var(--w-text-muted);
}
.s-price {
  font-family: var(--w-num-font);
  font-size: 14px;
  color: var(--w-text-silver);
}
.s-pct {
  font-family: var(--w-num-font);
  font-size: 12px;
  font-weight: 500;
}
.s-profit {
  font-family: var(--w-num-font);
  font-size: 10px;
}
.empty-notice {
  padding: 28px 0;
  text-align: center;
  font-family: var(--w-serif-cn);
  font-size: 11px;
  color: var(--w-text-muted);
}

.order-row-item {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 12px 0;
  border-bottom: 1px solid var(--w-hairline-light);
}
.order-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.order-action-label {
  font-family: var(--w-serif-cn);
  font-size: 12px;
  font-weight: 500;
}
.order-action-label.buy {
  color: var(--w-accent-red);
}
.order-action-label.sell {
  color: var(--w-accent-green);
}
.order-sub {
  font-family: var(--w-num-font);
  font-size: 10px;
  color: var(--w-text-muted);
}
.cancel-link {
  background: transparent;
  border: 1px solid var(--w-accent-red);
  color: var(--w-accent-red);
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
}
.done-label {
  font-family: var(--w-serif-cn);
  font-size: 10px;
  color: var(--w-text-muted);
}
</style>
