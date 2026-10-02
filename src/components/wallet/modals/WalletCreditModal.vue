/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WalletState } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  state: WalletState
  availableCreditCents: number
  isActivating: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'activate', payload: { method: 'random' | 'ai' | 'local' | 'custom'; customAmount: string; repaymentDay: number }): void
  (e: 'repay', amount: number): void
  (e: 'disable'): void
  (e: 'update-days', payload: { billingDay: number; repaymentDay: number }): void
}>()

const mode = ref<'manage' | 'repay' | 'settings'>('manage')
const repayInput = ref('')
const activationMethod = ref<'random' | 'ai' | 'local' | 'custom'>('random')
const customAmount = ref('')
const repaymentDay = ref(props.state.credit.repaymentDay || 15)

const canRepay = computed(() => {
  const num = Number(repayInput.value)
  return Number.isFinite(num) && num > 0
})

const handleRepay = () => {
  const cents = Math.round(Number(repayInput.value) * 100)
  emit('repay', cents)
}

const handleActivate = () => {
  emit('activate', {
    method: activationMethod.value,
    customAmount: customAmount.value,
    repaymentDay: repaymentDay.value
  })
}

const handleSaveSettings = () => {
  const rep = Math.max(1, Math.min(28, repaymentDay.value))
  const bill = rep - 10 > 0 ? rep - 10 : 28 + (rep - 10)
  emit('update-days', { billingDay: bill, repaymentDay: rep })
  mode.value = 'manage'
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">{{ state.credit.enabled ? '花呗信用金库' : '开通信用生活' }}</span>
          <span class="w-modal-en-sub">CREDIT FACILITY</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <!-- 未开通界面 -->
        <div v-if="!state.credit.enabled" class="activate-flow">
          <div class="hero-sub-text">
            <span>尊享按月透支与模拟信用授信额度。</span>
          </div>

          <div class="w-form-group">
            <label class="w-form-label">授信评定模式 (EVALUATION MODEL)</label>
            <select v-model="activationMethod" class="w-select">
              <option value="random">系统随机娱乐分配 (RANDOM)</option>
              <option value="ai">AI 深度评估当前用户人设 (PERSONA AI)</option>
              <option value="local">本地流动性与底册流水评估 (LOCAL ASSET)</option>
              <option value="custom">自定私享信用额度 (CUSTOM)</option>
            </select>
          </div>

          <div v-if="activationMethod === 'custom'" class="w-form-group">
            <label class="w-form-label">指定信用额度 CNY (TARGET LIMIT)</label>
            <input v-model="customAmount" type="text" inputmode="decimal" placeholder="例如：50000" class="w-line-input" />
          </div>

          <div class="w-form-group">
            <label class="w-form-label">每月固定还款日 (REPAYMENT DAY: 1 - 28)</label>
            <input v-model.number="repaymentDay" type="number" min="1" max="28" class="w-line-input" />
          </div>

          <div class="action-wrap">
            <button class="w-btn-primary full-width" :disabled="isActivating" @click="handleActivate">
              {{ isActivating ? '核定测算中...' : '提交授信审批并开通' }}
            </button>
          </div>
        </div>

        <!-- 已开通 - 管理面板 -->
        <div v-else-if="mode === 'manage'" class="manage-flow">
          <div class="credit-banner">
            <span class="lbl">可用信用额度 (AVAILABLE FACILITY)</span>
            <strong class="val">¥{{ formatWalletMoney(availableCreditCents) }}</strong>
            <div class="sub-matrix">
              <div>
                <span>总额度</span>
                <em>¥{{ formatWalletMoney(state.credit.limitCents) }}</em>
              </div>
              <div>
                <span>待偿负债</span>
                <em class="debt">¥{{ formatWalletMoney(state.credit.usedCents) }}</em>
              </div>
            </div>
          </div>

          <div class="info-row-box">
            <div class="info-row">
              <span>出账周期</span>
              <strong>每月 {{ state.credit.billingDay }} 日出账 · {{ state.credit.repaymentDay }} 日还款</strong>
            </div>
            <div v-if="state.credit.evaluationSummary" class="info-row">
              <span>授信依据</span>
              <strong>{{ state.credit.evaluationSummary }}</strong>
            </div>
          </div>

          <div class="ops-grid">
            <button class="w-btn-primary" :disabled="!state.credit.usedCents" @click="mode = 'repay'">
              偿还负债 (REPAY)
            </button>
            <button class="w-btn-secondary" @click="mode = 'settings'">
              信用设置 (SETTINGS)
            </button>
          </div>
        </div>

        <!-- 还款子页面 -->
        <div v-else-if="mode === 'repay'" class="repay-flow">
          <div class="w-form-group">
            <label class="w-form-label">还款金额 CNY (待还: ¥{{ formatWalletMoney(state.credit.usedCents) }})</label>
            <input 
              v-model="repayInput" 
              type="text" 
              inputmode="decimal" 
              :placeholder="formatWalletMoney(state.credit.usedCents)" 
              class="w-line-input" 
            />
          </div>
          <div class="w-form-group">
            <label class="w-form-label">扣款来源：可用现金余额 (¥{{ formatWalletMoney(state.cashCents) }})</label>
          </div>
          <div class="repay-actions">
            <button class="w-btn-secondary" @click="mode = 'manage'">返回</button>
            <button class="w-btn-primary" :disabled="!canRepay" @click="handleRepay">确认结清还款</button>
          </div>
        </div>

        <!-- 设置子页面 -->
        <div v-else-if="mode === 'settings'" class="settings-flow">
          <div class="w-form-group">
            <label class="w-form-label">修改每月还款日 (1 - 28)</label>
            <input v-model.number="repaymentDay" type="number" min="1" max="28" class="w-line-input" />
          </div>
          <div class="settings-actions">
            <button class="w-btn-secondary" @click="mode = 'manage'">取消</button>
            <button class="w-btn-primary" @click="handleSaveSettings">保存日历规则</button>
          </div>
          <div class="close-facility-box">
            <button class="w-btn-danger full-width" :disabled="state.credit.usedCents > 0" @click="emit('disable')">
              关闭并注销信用功能
            </button>
            <span v-if="state.credit.usedCents > 0" class="hint">仍有欠款待偿还，无法注销信用账户。</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hero-sub-text {
  font-size: 11px;
  color: var(--w-text-muted);
  margin-bottom: 16px;
  letter-spacing: 0.5px;
}
.full-width {
  width: 100%;
}
.credit-banner {
  padding: 16px;
  background-color: var(--w-bg-alt);
  border: 1px solid var(--w-border);
  margin-bottom: 16px;
}
.credit-banner .lbl {
  font-size: 10px;
  color: var(--w-text-muted);
  letter-spacing: 1px;
}
.credit-banner .val {
  display: block;
  font-family: var(--w-num-font);
  font-size: 26px;
  font-weight: 600;
  margin: 6px 0 12px 0;
  color: var(--w-text-main);
}
.sub-matrix {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--w-border-light);
  padding-top: 10px;
}
.sub-matrix div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.sub-matrix span {
  font-size: 10px;
  color: var(--w-text-muted);
}
.sub-matrix em {
  font-family: var(--w-num-font);
  font-size: 13px;
  font-style: normal;
  font-weight: 500;
}
.sub-matrix em.debt {
  color: var(--w-accent-red);
}
.info-row-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid var(--w-border-light);
  padding: 12px;
  margin-bottom: 16px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
}
.info-row span {
  color: var(--w-text-muted);
}
.info-row strong {
  font-weight: 400;
  color: var(--w-text-main);
}
.ops-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.repay-actions, .settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}
.close-facility-box {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--w-border-light);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.close-facility-box .hint {
  font-size: 10px;
  color: var(--w-accent-red);
  text-align: center;
}
</style>
