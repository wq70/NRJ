/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WalletState } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  type: 'balance' | 'deposit' | 'withdraw'
  state: WalletState
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: { cents: number; note: string; cardId?: string }): void
}>()

const amountInput = ref(props.type === 'balance' ? formatWalletMoney(props.state.cashCents) : '')
const noteInput = ref('')
const selectedBankCardId = ref<string>('')

const titleMap = {
  balance: { cn: '设定账户余额', en: 'DIRECT BALANCE ADJUSTMENT' },
  deposit: { cn: '资金注资', en: 'CAPITAL INFLOW / DEPOSIT' },
  withdraw: { cn: '资金调拨', en: 'CAPITAL OUTFLOW / WITHDRAW' }
}

const canSubmit = computed(() => {
  const num = Number(amountInput.value)
  if (!Number.isFinite(num) || num < 0) return false
  if (props.type !== 'balance' && num <= 0) return false
  if (props.type === 'withdraw' && (!props.state.bankCards.length || !selectedBankCardId.value)) return false
  return true
})

const handleSubmit = () => {
  const cents = Math.round(Number(amountInput.value) * 100)
  emit('submit', {
    cents,
    note: noteInput.value.trim(),
    cardId: selectedBankCardId.value || undefined
  })
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">{{ titleMap[type].cn }}</span>
          <span class="w-modal-en-sub">{{ titleMap[type].en }}</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <div v-if="type === 'deposit'" class="w-form-group">
          <label class="w-form-label">资金来源渠道 (FUNDING CHANNEL)</label>
          <select v-model="selectedBankCardId" class="w-select">
            <option value="">[系统凭空注资] 不扣减银行卡</option>
            <option 
              v-for="card in state.bankCards" 
              :key="card.id" 
              :value="card.id" 
              :disabled="!card.enabled"
            >
              {{ card.name }} (•••• {{ card.lastFour }}){{ card.enabled ? '' : ' [已停用]' }}
            </option>
          </select>
        </div>

        <div v-if="type === 'withdraw'" class="w-form-group">
          <label class="w-form-label">调拨转入银行卡 (DESTINATION ACCOUNT)</label>
          <select v-model="selectedBankCardId" class="w-select">
            <option value="" disabled selected>请选择转入银行卡...</option>
            <option 
              v-for="card in state.bankCards" 
              :key="card.id" 
              :value="card.id" 
              :disabled="!card.enabled"
            >
              {{ card.name }} (•••• {{ card.lastFour }}){{ card.enabled ? '' : ' [已停用]' }}
            </option>
          </select>
          <span v-if="!state.bankCards.length" class="w-field-hint error">当前未绑定任何银行卡，请先添加银行卡。</span>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">交易金额 CNY (AMOUNT)</label>
          <div class="w-input-wrap">
            <span class="w-curr-symbol">¥</span>
            <input 
              v-model="amountInput" 
              type="text" 
              inputmode="decimal" 
              placeholder="0.00" 
              class="w-line-input large-amount" 
              @keyup.enter="canSubmit && handleSubmit()"
            />
          </div>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">流转说明与凭据备注 (MEMORANDUM / OPTIONAL)</label>
          <input 
            v-model="noteInput" 
            type="text" 
            maxlength="40" 
            placeholder="填写款项说明（可选）" 
            class="w-line-input" 
          />
        </div>

        <div class="w-info-notice">
          <span class="notice-bullet"></span>
          <p v-if="type === 'balance'">直接重置当前可用余额，未决冻结资金不会被篡改。</p>
          <p v-else-if="type === 'deposit'">若选择特定银行卡，充值后将自动扣减对应卡内余额并生成对账底册。</p>
          <p v-else>提现操作将从可用余额中划转至选定银行卡内。</p>
        </div>
      </div>

      <footer class="w-modal-footer">
        <button class="w-btn-secondary" @click="emit('close')">取消</button>
        <button class="w-btn-primary" :disabled="!canSubmit" @click="handleSubmit">
          确认执行
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.w-input-wrap {
  display: flex;
  align-items: baseline;
  gap: 8px;
  border-bottom: 1px solid var(--w-border);
}
.w-curr-symbol {
  font-family: var(--w-num-font);
  font-size: 18px;
  color: var(--w-accent-gold);
}
.large-amount {
  border-bottom: none !important;
  font-size: 22px !important;
  font-weight: 600;
}
.w-field-hint {
  font-size: 11px;
  margin-top: 4px;
}
.w-field-hint.error {
  color: var(--w-accent-red);
}
.w-info-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background-color: var(--w-bg-alt);
  border: 1px solid var(--w-border-light);
  margin-top: 10px;
}
.w-info-notice .notice-bullet {
  width: 5px;
  height: 5px;
  background-color: var(--w-accent-gold);
  margin-top: 5px;
  flex-shrink: 0;
  animation: none !important;
}
.w-info-notice p {
  margin: 0;
  font-size: 11px;
  color: var(--w-text-muted);
  line-height: 1.5;
}
</style>
