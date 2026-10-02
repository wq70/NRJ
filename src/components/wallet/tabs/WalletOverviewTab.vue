/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { computed } from 'vue'
import type { WalletState } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  state: WalletState
  totalAssetCents: number
  bankAssetCents: number
  stockMarketValueCents: number
  liabilityCents: number
  netAssetCents: number
  recentLedger: Array<{ id: string; title: string; amountCents: number; createdAt: number; note?: string }>
}>()

const emit = defineEmits<{
  (e: 'open-action', action: 'deposit' | 'withdraw' | 'ledger' | 'balance' | 'receipt'): void
  (e: 'switch-tab', tab: 'wallet' | 'stocks' | 'services'): void
}>()

const money = (cents: number) => {
  return props.state.hideAmounts ? '••••••' : formatWalletMoney(cents)
}

const formatDate = (val: number) => {
  const d = new Date(val)
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const cashPct = computed(() => {
  if (props.totalAssetCents <= 0) return 0
  return Math.round((props.state.cashCents / props.totalAssetCents) * 100)
})

const bankPct = computed(() => {
  if (props.totalAssetCents <= 0) return 0
  return Math.round((props.bankAssetCents / props.totalAssetCents) * 100)
})

const stockPct = computed(() => {
  if (props.totalAssetCents <= 0) return 0
  return Math.round((props.stockMarketValueCents / props.totalAssetCents) * 100)
})
</script>

<template>
  <div class="editorial-overview">
    <!-- 主视觉区：极大留白，呼吸感十足的净资产 -->
    <section class="editorial-hero">
      <div class="hero-meta-row">
        <span class="hero-label">NET ASSET VALUE · 净资产</span>
        <button class="hero-calibrate-btn" @click="emit('open-action', 'balance')">
          <span>校准账目</span>
          <span class="btn-arrow">›</span>
        </button>
      </div>

      <div class="hero-amount-stage">
        <span class="stage-currency">¥</span>
        <h1 class="stage-amount">{{ money(netAssetCents) }}</h1>
      </div>

      <!-- 纯净留白下的极简资产比例条 -->
      <div class="hero-allocation">
        <div class="alloc-track">
          <div class="alloc-bar cash" :style="{ width: `${cashPct}%` }"></div>
          <div class="alloc-bar bank" :style="{ width: `${bankPct}%` }"></div>
          <div class="alloc-bar stock" :style="{ width: `${stockPct}%` }"></div>
        </div>
        <div class="alloc-legend">
          <span class="legend-item"><i class="w-alloc-dot gold"></i> 现金 {{ cashPct }}%</span>
          <span class="legend-item"><i class="w-alloc-dot gray"></i> 银行 {{ bankPct }}%</span>
          <span class="legend-item"><i class="w-alloc-dot dim"></i> 证券 {{ stockPct }}%</span>
        </div>
      </div>
    </section>

    <!-- 资产分类总账：大行高、彻底去噪，纯粹清爽 -->
    <section class="editorial-spine">
      <!-- 01 现钞 -->
      <div class="spine-row">
        <div class="spine-left">
          <span class="spine-idx">01</span>
          <span class="spine-name">流动现金储备</span>
        </div>
        <div class="spine-val">
          ¥{{ money(state.cashCents) }}
        </div>
      </div>

      <!-- 02 银行存款 -->
      <div class="spine-row offset-row">
        <div class="spine-left">
          <span class="spine-idx">02</span>
          <span class="spine-name">银行储蓄结存</span>
        </div>
        <div class="spine-val">
          ¥{{ money(bankAssetCents) }}
        </div>
      </div>

      <!-- 03 证券持仓 -->
      <div class="spine-row clickable-row" @click="emit('switch-tab', 'stocks')">
        <div class="spine-left">
          <span class="spine-idx">03</span>
          <span class="spine-name">二级证券持仓</span>
        </div>
        <div class="spine-val actionable">
          <span>¥{{ money(stockMarketValueCents) }}</span>
          <span class="spine-arrow">→</span>
        </div>
      </div>

      <!-- 04 未决负债 -->
      <div class="spine-row liability-row">
        <div class="spine-left">
          <span class="spine-idx liability">04</span>
          <span class="spine-name liability">未决应偿负债</span>
        </div>
        <div class="spine-val liability">
          ¥{{ money(liabilityCents) }}
        </div>
      </div>
    </section>

    <!-- 资金调度指令：空灵从容的目录式排版 -->
    <section class="editorial-actions">
      <div class="actions-header">
        <span class="actions-title">DIRECTIVES · 资金指令</span>
      </div>

      <div class="actions-stagger-grid">
        <button class="action-card pos-a" @click="emit('open-action', 'deposit')">
          <span class="act-roman">A /</span>
          <span class="act-cn">注资注入</span>
          <span class="act-arrow">→</span>
        </button>

        <button class="action-card pos-b" @click="emit('open-action', 'withdraw')">
          <span class="act-roman">B /</span>
          <span class="act-cn">资产调拨</span>
          <span class="act-arrow">→</span>
        </button>

        <button class="action-card pos-c" @click="emit('open-action', 'receipt')">
          <span class="act-roman">C /</span>
          <span class="act-cn">收款票券</span>
          <span class="act-arrow">→</span>
        </button>

        <button class="action-card pos-d" @click="emit('open-action', 'ledger')">
          <span class="act-roman">D /</span>
          <span class="act-cn">对账底册</span>
          <span class="act-arrow">→</span>
        </button>
      </div>
    </section>

    <!-- 流转流水：纯粹清透的对账记录 -->
    <section class="editorial-chronicle">
      <div class="chronicle-head">
        <span class="chronicle-title">RECENT ACTIVITY · 近期流转</span>
        <button class="chronicle-more-btn" @click="emit('open-action', 'ledger')">
          明细 ›
        </button>
      </div>

      <div v-if="!recentLedger.length" class="chronicle-empty">
        暂无往来记账记录
      </div>

      <div v-else class="chronicle-list">
        <div v-for="entry in recentLedger" :key="entry.id" class="chronicle-entry">
          <div class="entry-meta">
            <span class="entry-time">{{ formatDate(entry.createdAt) }}</span>
            <span class="entry-title">{{ entry.title }}</span>
          </div>
          <div class="entry-sum">
            <span :class="entry.amountCents > 0 ? 'sum-inc' : 'sum-exp'">
              {{ entry.amountCents > 0 ? '+' : '' }}{{ money(entry.amountCents) }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.editorial-overview {
  display: flex;
  flex-direction: column;
}

/* 净资产主视觉：极大留白，通透开阔 */
.editorial-hero {
  padding: 12px 0 40px 0;
  border-bottom: 1px solid var(--w-hairline);
  margin-bottom: 44px;
}

.hero-meta-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 24px;
}
.hero-label {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--w-text-muted);
}
.hero-calibrate-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 4px;
  color: var(--w-text-secondary);
  font-family: var(--w-serif-cn);
  font-size: 11px;
  padding: 0;
  transition: color 0.2s;
}
.hero-calibrate-btn:hover {
  color: var(--w-accent-gold);
}
.btn-arrow {
  font-size: 12px;
}

.hero-amount-stage {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 32px;
}
.stage-currency {
  font-family: var(--w-serif-en);
  font-size: 22px;
  font-weight: 300;
  color: var(--w-accent-gold);
  line-height: 1;
}
.stage-amount {
  margin: 0;
  font-family: var(--w-num-font);
  font-size: 46px;
  font-weight: 400;
  letter-spacing: -1.5px;
  color: var(--w-text-main);
  line-height: 1;
}

/* 资产比例指示：轻盈开阔 */
.hero-allocation {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.alloc-track {
  width: 100%;
  height: 1px;
  background-color: var(--w-hairline);
  display: flex;
}
.alloc-bar.cash {
  background-color: var(--w-accent-gold);
  height: 1px;
}
.alloc-bar.bank {
  background-color: var(--w-text-secondary);
  height: 1px;
}
.alloc-bar.stock {
  background-color: var(--w-text-dim);
  height: 1px;
}
.alloc-legend {
  display: flex;
  gap: 24px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--w-serif-cn);
  font-size: 11px;
  color: var(--w-text-muted);
  letter-spacing: 0.5px;
}
.legend-item i.w-alloc-dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 0;
  animation: none !important;
  flex-shrink: 0;
}
.legend-item i.gold { background-color: var(--w-accent-gold); }
.legend-item i.gray { background-color: var(--w-text-secondary); }
.legend-item i.dim { background-color: var(--w-text-dim); }

/* 资产分类总账 (The Spine) - 极其舒展大行距 */
.editorial-spine {
  display: flex;
  flex-direction: column;
  margin-bottom: 48px;
  border-bottom: 1px solid var(--w-hairline);
}
.spine-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 22px 0;
  border-top: 1px solid var(--w-hairline);
  transition: opacity 0.2s ease;
}
.spine-row:first-child {
  border-top: none;
}
.spine-row.offset-row {
  padding-left: 14px;
}
.spine-row.clickable-row {
  cursor: pointer;
}
.spine-row.clickable-row:hover {
  opacity: 0.8;
}
.spine-row.liability-row {
  padding-top: 26px;
  padding-bottom: 26px;
  border-top: 1px dashed var(--w-hairline);
}

.spine-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.spine-idx {
  font-family: var(--w-serif-en);
  font-size: 11px;
  font-style: italic;
  color: var(--w-accent-gold);
}
.spine-idx.liability {
  color: var(--w-accent-red);
}
.spine-name {
  font-family: var(--w-serif-cn);
  font-size: 14px;
  font-weight: 500;
  color: var(--w-text-main);
  letter-spacing: 0.5px;
}
.spine-name.liability {
  color: var(--w-accent-red);
}

.spine-val {
  font-family: var(--w-num-font);
  font-size: 15px;
  color: var(--w-text-silver);
  font-weight: 400;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.spine-val.liability {
  color: var(--w-accent-red);
}
.spine-arrow {
  color: var(--w-accent-gold);
  font-size: 12px;
}

/* 资金指令目录：舒展错位 */
.editorial-actions {
  display: flex;
  flex-direction: column;
  margin-bottom: 48px;
  padding-bottom: 36px;
  border-bottom: 1px solid var(--w-hairline);
}
.actions-header {
  margin-bottom: 22px;
}
.actions-title {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--w-text-muted);
}

.actions-stagger-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px 28px;
}
.action-card {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--w-hairline);
  padding: 14px 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s ease;
}
.action-card:hover {
  border-bottom-color: var(--w-accent-gold);
}
.action-card:hover .act-arrow {
  color: var(--w-accent-gold);
  transform: translateX(4px);
}
.act-roman {
  font-family: var(--w-serif-en);
  font-size: 10px;
  color: var(--w-accent-gold);
  margin-right: 6px;
}
.act-cn {
  font-family: var(--w-serif-cn);
  font-size: 13px;
  color: var(--w-text-main);
  letter-spacing: 1px;
}
.act-arrow {
  font-family: var(--w-serif-en);
  font-size: 12px;
  color: var(--w-text-dim);
  transition: transform 0.2s, color 0.2s;
}

/* 流水纪实：舒适行高 */
.editorial-chronicle {
  display: flex;
  flex-direction: column;
}
.chronicle-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
}
.chronicle-title {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  color: var(--w-text-muted);
  letter-spacing: 1.5px;
}
.chronicle-more-btn {
  background: transparent;
  border: none;
  color: var(--w-text-secondary);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  transition: color 0.2s;
}
.chronicle-more-btn:hover {
  color: var(--w-accent-gold);
}
.chronicle-empty {
  padding: 32px 0;
  text-align: center;
  font-family: var(--w-serif-cn);
  font-size: 12px;
  color: var(--w-text-muted);
}
.chronicle-list {
  display: flex;
  flex-direction: column;
}
.chronicle-entry {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 16px 0;
  border-bottom: 1px solid var(--w-hairline);
}
.entry-meta {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.entry-time {
  font-family: var(--w-num-font);
  font-size: 10px;
  color: var(--w-text-dim);
}
.entry-title {
  font-family: var(--w-serif-cn);
  font-size: 13px;
  color: var(--w-text-main);
}
.entry-sum {
  font-family: var(--w-num-font);
  font-size: 14px;
}
.sum-inc {
  color: var(--w-accent-red);
}
.sum-exp {
  color: var(--w-text-silver);
}
</style>
