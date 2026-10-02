/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { WalletBankCard, WalletState } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  state: WalletState
  availableCreditCents: number
  cardCovers: Record<string, { front?: string; back?: string }>
}>()

const emit = defineEmits<{
  (e: 'open-card-modal', card?: WalletBankCard): void
  (e: 'remove-card', id: string): void
  (e: 'open-credit-modal'): void
  (e: 'open-receipt-modal'): void
  (e: 'open-password-modal'): void
  (e: 'reset-wallet'): void
}>()

const flippedCardId = ref<string | null>(null)

const toggleFlip = (id: string) => {
  flippedCardId.value = flippedCardId.value === id ? null : id
}
</script>

<template>
  <div class="editorial-services">
    <!-- 刊头：金库底册总目 -->
    <section class="services-hero">
      <header class="hero-top-meta">
        <span class="meta-label">VAULT REPOSITORY · 专属金融档案与授权</span>
      </header>

      <div class="hero-val-display">
        <span class="val-currency">§</span>
        <h1 class="val-headline">{{ state.bankCards.length }} <small class="val-subtext">ACCOUNTS</small></h1>
      </div>

      <p class="hero-summary-text">
        涵盖多机构借记储蓄卡册、私人授信额度结余及资产转移屏障。
      </p>
    </section>

    <!-- 01 银行卡册 (Card Folio) - 开放式文学排版，拒绝厚重塑料卡片 -->
    <section class="card-folio-section">
      <div class="folio-head">
        <span class="folio-title">I. 银行卡册 · BANK REGISTRY</span>
        <button class="folio-add-btn" @click="emit('open-card-modal')">
          + 录入新卡
        </button>
      </div>

      <div v-if="!state.bankCards.length" class="folio-empty">
        <span>金库底册未录入银行卡席位</span>
      </div>

      <div v-else class="folio-card-list">
        <div 
          v-for="card in state.bankCards" 
          :key="card.id" 
          class="folio-card-row"
          :class="{ flipped: flippedCardId === card.id }"
          @click="toggleFlip(card.id)"
        >
          <!-- 正面：极简金属条带与活字排版 -->
          <template v-if="flippedCardId !== card.id">
            <div class="card-lead">
              <span class="c-bank">{{ card.name }}</span>
              <span class="c-number">•••• •••• •••• {{ card.lastFour }}</span>
            </div>
            <div class="card-tail">
              <span class="c-type">{{ card.type === 'credit' ? 'CREDIT 贷记' : 'DEBIT 借记' }}</span>
              <span class="c-balance">
                {{ card.type === 'credit' ? '授信额度 ¥' + formatWalletMoney(card.limitCents || 0) : '结存余额 ¥' + formatWalletMoney(card.balanceCents || 0) }}
              </span>
            </div>
          </template>

          <!-- 背面：安全码与操作落款 -->
          <template v-else>
            <div class="card-lead">
              <span class="c-bank">{{ card.name }} · 安全验证</span>
              <span class="c-cvv">CVV: {{ card.virtualCvv || '888' }}</span>
            </div>
            <div class="card-actions">
              <button class="act-link" @click.stop="emit('open-card-modal', card)">修改设定</button>
              <button class="act-link danger" @click.stop="emit('remove-card', card.id)">解绑移除</button>
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- 02 私享金融服务与授权 (Executive Facilities) - 开放式条目排版 -->
    <section class="facilities-section">
      <div class="folio-head">
        <span class="folio-title">II. 授信与安全 · FACILITIES</span>
      </div>

      <div class="facilities-list">
        <!-- 花呗信用借贷 -->
        <div class="facility-row" @click="emit('open-credit-modal')">
          <div class="f-col-main">
            <span class="f-idx">A.</span>
            <div class="f-texts">
              <span class="f-title">花呗信用借贷账户</span>
              <span class="f-desc">
                {{ state.credit.enabled ? `可用授信 ¥${formatWalletMoney(availableCreditCents)} · 账单日每月${state.credit.billingDay || 1}日` : '未激活私享授信额度，点击开启测算' }}
              </span>
            </div>
          </div>
          <span class="f-arrow">›</span>
        </div>

        <!-- 收款票券凭证 -->
        <div class="facility-row" @click="emit('open-receipt-modal')">
          <div class="f-col-main">
            <span class="f-idx">B.</span>
            <div class="f-texts">
              <span class="f-title">私享收款票券凭据</span>
              <span class="f-desc">生成专属收款二维码凭证，支持投送朋友圈资金归集</span>
            </div>
          </div>
          <span class="f-arrow">›</span>
        </div>

        <!-- 独立支付密码 -->
        <div class="facility-row" @click="emit('open-password-modal')">
          <div class="f-col-main">
            <span class="f-idx">C.</span>
            <div class="f-texts">
              <span class="f-title">资金出账安全屏障</span>
              <span class="f-desc">
                {{ state.paymentPassword ? state.paymentPasswordType === 'gesture' ? '九宫格暗码验证已布防' : '4位独立数字PIN码已布防' : '未设独立密码，资金出账即刻通行' }}
              </span>
            </div>
          </div>
          <span class="f-arrow">›</span>
        </div>

        <!-- 重置账册 -->
        <div class="facility-row danger-item" @click="emit('reset-wallet')">
          <div class="f-col-main">
            <span class="f-idx danger">D.</span>
            <div class="f-texts">
              <span class="f-title danger">出清并重置底册数据</span>
              <span class="f-desc">清空交易流水历史记录、出清模拟持仓和未决债务</span>
            </div>
          </div>
          <span class="f-arrow danger">›</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.editorial-services {
  display: flex;
  flex-direction: column;
}

/* 刊头：大留白呼吸 */
.services-hero {
  padding: 12px 0 36px 0;
  border-bottom: 1px solid var(--w-hairline);
  margin-bottom: 40px;
}
.hero-top-meta {
  margin-bottom: 20px;
}
.meta-label {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  letter-spacing: 2px;
  color: var(--w-text-muted);
}
.hero-val-display {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 16px;
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
.val-subtext {
  font-family: var(--w-serif-en);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--w-text-muted);
}
.hero-summary-text {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  color: var(--w-text-muted);
  line-height: 1.8;
  margin: 0;
}

/* 银行卡册段落：舒展排版 */
.card-folio-section {
  display: flex;
  flex-direction: column;
  margin-bottom: 44px;
  border-bottom: 1px solid var(--w-hairline);
  padding-bottom: 32px;
}
.folio-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 20px;
}
.folio-title {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  letter-spacing: 1.5px;
  color: var(--w-text-muted);
}
.folio-add-btn {
  background: transparent;
  border: none;
  font-family: var(--w-serif-cn);
  font-size: 11px;
  color: var(--w-accent-gold);
  cursor: pointer;
  padding: 0;
}
.folio-empty {
  padding: 32px 0;
  text-align: center;
  font-family: var(--w-serif-cn);
  font-size: 12px;
  color: var(--w-text-muted);
}
.folio-card-list {
  display: flex;
  flex-direction: column;
}
.folio-card-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 20px 0;
  border-bottom: 1px solid var(--w-hairline-light);
  cursor: pointer;
  transition: opacity 0.15s;
}
.folio-card-row:hover {
  opacity: 0.85;
}
.card-lead {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.c-bank {
  font-family: var(--w-serif-cn);
  font-size: 13px;
  font-weight: 500;
  color: var(--w-text-main);
}
.c-number {
  font-family: var(--w-num-font);
  font-size: 11px;
  color: var(--w-text-muted);
}
.c-cvv {
  font-family: var(--w-num-font);
  font-size: 11px;
  color: var(--w-accent-gold);
}
.card-tail {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}
.c-type {
  font-family: var(--w-serif-cn);
  font-size: 10px;
  color: var(--w-accent-gold);
}
.c-balance {
  font-family: var(--w-num-font);
  font-size: 12px;
  color: var(--w-text-silver);
}
.card-actions {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.act-link {
  background: transparent;
  border: none;
  font-family: var(--w-serif-cn);
  font-size: 11px;
  color: var(--w-text-secondary);
  cursor: pointer;
  padding: 0;
}
.act-link:hover {
  color: var(--w-accent-gold);
}
.act-link.danger {
  color: var(--w-accent-red);
}

/* 专属设施段落 */
.facilities-section {
  display: flex;
  flex-direction: column;
}
.facilities-list {
  display: flex;
  flex-direction: column;
}
.facility-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 22px 0;
  border-bottom: 1px solid var(--w-hairline-light);
  cursor: pointer;
  transition: opacity 0.15s;
}
.facility-row:hover {
  opacity: 0.85;
}
.f-col-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.f-idx {
  font-family: var(--w-serif-en);
  font-size: 10px;
  font-style: italic;
  color: var(--w-accent-gold);
  width: 14px;
}
.f-idx.danger {
  color: var(--w-accent-red);
}
.f-texts {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.f-title {
  font-family: var(--w-serif-cn);
  font-size: 13px;
  font-weight: 500;
  color: var(--w-text-main);
  letter-spacing: 0.5px;
}
.f-title.danger {
  color: var(--w-accent-red);
}
.f-desc {
  font-family: var(--w-serif-cn);
  font-size: 10px;
  color: var(--w-text-muted);
}
.f-arrow {
  color: var(--w-accent-gold);
  font-size: 14px;
}
.f-arrow.danger {
  color: var(--w-accent-red);
}
</style>
