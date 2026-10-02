/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<template>
  <transition name="modal-fade">
    <div v-if="visible" class="payment-password-overlay" :class="{ 'wallet-payment-style': theme === 'wallet' }" @click.self="handleClose">
      <div class="payment-password-container">
        <div class="modal-header">
          <h3 class="modal-title">验证支付密码</h3>
          <div class="close-btn" @click="handleClose">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
        </div>

        <div class="modal-body">
          <div v-if="intent" class="payment-summary">
            <span>付款 USER：{{ accountName }}</span>
            <strong>{{ intent.title }} · ¥{{ formatWalletMoney(intent.amountCents) }}</strong>
            <span>付款方式：{{ fundingLabel }}</span>
          </div>
          <label class="form-label">{{ mode === 'gesture' ? '绘制支付手势' : '输入4位支付密码' }}</label>
          <WalletGestureInput v-if="mode === 'gesture'" v-model="paymentPasswordInput" @drawing="drawing = $event" />
          <input
            v-else
            type="password"
            class="text-input password-input"
            v-model="paymentPasswordInput"
            maxlength="4"
            inputmode="numeric"
            autocomplete="one-time-code"
            placeholder="请输入密码"
            @input="paymentPasswordInput = paymentPasswordInput.replace(/\D/g, '').slice(0, 4); passwordError = ''"
          />
          <div v-if="passwordError" class="error-text">{{ passwordError }}</div>
        </div>

        <div class="modal-footer">
          <button class="cancel-btn" @click="handleClose">取消</button>
          <p v-if="invalidCredential" class="error-text">原支付密码格式异常，请到此 USER 的钱包支付安全中重新设置。</p>
          <button class="verify-btn" :disabled="drawing || !validInput" @click="verifyPassword">确认支付</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatWalletMoney, isValidWalletCredential, loadWalletState, verifyWalletCredential, walletPaymentMode, type WalletPaymentIntent } from '../../../services/walletService'
import { useChatAuth } from '../../../composables/useChatAuth'
import WalletGestureInput from '../../wallet/WalletGestureInput.vue'

const props = defineProps<{
  visible: boolean
  accountId: string
  intent?: WalletPaymentIntent
  theme?: 'wallet' | 'chat' | 'mall'
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', credential: string): void
}>()

const paymentPasswordInput = ref('')
const passwordError = ref('')
const drawing = ref(false)
const state = ref(loadWalletState(props.accountId || 'guest'))
const { chatAccounts } = useChatAuth()
const accountName = computed(() => chatAccounts.value.find(item => item.id === props.accountId)?.name || state.value.accountName)
const mode = computed(() => walletPaymentMode(state.value))
const validInput = computed(() => mode.value !== 'off' && isValidWalletCredential(mode.value, paymentPasswordInput.value))
const invalidCredential = computed(() => mode.value !== 'off' && !isValidWalletCredential(mode.value, state.value.paymentPassword || ''))
const fundingLabel = computed(() => props.intent?.fundingSource === 'credit' ? '花呗' : props.intent?.fundingSource === 'bank_card' ? state.value.bankCards.find(item => item.id === props.intent?.fundingSourceId)?.name || '银行卡' : '钱包余额')

watch(() => [props.visible, props.accountId], () => {
  if (props.visible) {
    state.value = loadWalletState(props.accountId || 'guest')
    paymentPasswordInput.value = ''
    passwordError.value = ''
    drawing.value = false
  }
}, { immediate: true })
watch(paymentPasswordInput, () => { passwordError.value = '' }, { flush: 'sync' })

const handleClose = () => {
  emit('close')
}

const verifyPassword = () => {
  const state = loadWalletState(props.accountId || 'guest')
  if (!verifyWalletCredential(state, paymentPasswordInput.value)) {
    paymentPasswordInput.value = ''
    passwordError.value = '支付密码错误'
    return
  }
  emit('success', paymentPasswordInput.value)
}
</script>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-active .payment-password-container {
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.payment-password-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 12000;
  backdrop-filter: blur(2px);
}

.payment-password-container {
  width: 85%;
  max-width: 320px;
  background: var(--sys-bg-primary, #ffffff);
  border-radius: 16px;
  overflow: hidden;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}
.is-dark .payment-password-container {
  background: var(--sys-bg-primary, #2a2826);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
}

.modal-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
}

.modal-body {
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
}

.text-input {
  box-sizing: border-box;
  width: 100%;
  font-family: inherit;
  background: var(--sys-bg-secondary, rgba(0,0,0,0.03));
  border: none;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
}
.text-input::placeholder {
  color: var(--text-tertiary);
}

.password-input {
  text-align: center;
  letter-spacing: 8px;
  font-size: 24px;
  font-weight: bold;
}

.error-text {
  color: #f44336;
  font-size: 13px;
  text-align: center;
}

.modal-footer {
  display: flex;
  padding: 16px 20px 20px;
  gap: 12px;
}

.cancel-btn, .verify-btn {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 12px 0;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.cancel-btn {
  background: var(--sys-bg-secondary, rgba(0,0,0,0.05));
  color: var(--text-secondary);
}

.verify-btn {
  background: #f44336;
  color: white;
}
.verify-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.verify-btn:not(:disabled):active {
  opacity: 0.9;
}
.payment-summary{width:100%;min-width:0;display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--text-secondary,#4b5563)}.payment-summary>*{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.payment-summary strong{font-size:13px;font-weight:500}.wallet-payment-style{--w-text-secondary:#4b5563;--w-border:#e8ecef;--w-accent-gold:#c59b27}.wallet-payment-style .payment-password-container{border-radius:0;background:#fff;color:#111827}.wallet-payment-style .modal-title{font-family:'Noto Serif SC',serif;font-size:15px;color:#111827}.wallet-payment-style .text-input,.wallet-payment-style button{border-radius:0}.wallet-payment-style .verify-btn{background:#111827}.wallet-payment-style .form-label{font-size:12px;color:#4b5563}.modal-footer{flex-wrap:wrap}.modal-footer .error-text{flex:0 0 100%;margin:0;font-size:11px}.verify-btn:disabled{opacity:.4;cursor:not-allowed}
</style>
