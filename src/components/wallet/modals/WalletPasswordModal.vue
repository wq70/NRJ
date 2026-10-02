<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { isValidWalletCredential } from '../../../services/walletService'
import WalletGestureInput from '../WalletGestureInput.vue'
const props = defineProps<{ currentPassword?: string; currentPasswordType?: 'pin' | 'gesture'; accountName?: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'save', password: string | undefined, type: 'pin' | 'gesture'): void }>()
const mode = ref<'off' | 'pin' | 'gesture'>(props.currentPassword ? props.currentPasswordType || 'pin' : 'off')
const unlocked = ref(!props.currentPassword)
const input = ref('')
const first = ref('')
const confirming = ref(false)
const resetting = ref(false)
const drawing = ref(false)
const error = ref('')
const inputMode = computed(() => unlocked.value ? mode.value : props.currentPasswordType || 'pin')
const valid = computed(() => inputMode.value !== 'off' && isValidWalletCredential(inputMode.value, input.value))
const invalidOld = computed(() => !!props.currentPassword && !isValidWalletCredential(props.currentPasswordType || 'pin', props.currentPassword))
watch(mode, () => { input.value = ''; first.value = ''; confirming.value = false; error.value = '' })
watch(() => [props.currentPassword, props.currentPasswordType], () => { unlocked.value = !props.currentPassword; input.value = ''; first.value = ''; confirming.value = false })
watch(input, () => { error.value = '' }, { flush: 'sync' })
const submit = () => {
  if (!unlocked.value) {
    if (!valid.value || input.value !== props.currentPassword) { input.value = ''; error.value = '当前支付密码错误'; return }
    unlocked.value = true; input.value = ''; return
  }
  if (mode.value === 'off') { emit('save', undefined, 'pin'); return }
  if (!valid.value || drawing.value) return
  if (!confirming.value) { first.value = input.value; input.value = ''; confirming.value = true; return }
  if (input.value !== first.value) { input.value = ''; error.value = '两次输入不一致，请再次确认'; return }
  emit('save', input.value, mode.value)
}
</script>
<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container password-settings">
      <header class="w-modal-header"><div class="w-modal-title-group"><span class="w-modal-cn-title">支付安全与独立密码</span><span class="w-modal-en-sub">PAYMENT SECURITY</span></div><button class="w-modal-close-btn" @click="emit('close')">✕</button></header>
      <div class="w-modal-body">
        <p class="desc-text">当前 USER：{{ accountName || '未登录钱包' }}。设置仅用于此账号，所有主动扣款统一验证。</p>
        <template v-if="resetting">
          <p class="desc-text">确认重置此 USER 的本地支付验证？只清除密码，余额、银行卡和流水均保留。</p>
          <button type="button" class="w-btn-secondary" @click="resetting = false">返回</button>
          <button type="button" class="w-btn-primary" @click="emit('save', undefined, 'pin')">确认重置支付验证</button>
        </template>
        <template v-else>
          <div v-if="unlocked" class="password-modes" aria-label="支付验证方式"><button v-for="option in (['off', 'pin', 'gesture'] as const)" :key="option" type="button" :class="{ active: mode === option }" @click="mode = option">{{ { off: '关闭', pin: '数字密码', gesture: '九宫格手势' }[option] }}</button></div>
          <p v-if="invalidOld && !unlocked" class="setting-error">原支付密码格式异常，请使用下方本地重置后重新设置。</p>
          <div v-if="!unlocked || mode !== 'off'" class="w-form-group">
            <label class="w-form-label">{{ !unlocked ? '先验证当前支付密码' : confirming ? '再次确认新密码' : mode === 'gesture' ? '绘制新手势，至少连接四个点' : '输入新的四位数字密码' }}</label>
            <WalletGestureInput v-if="inputMode === 'gesture'" v-model="input" @drawing="drawing = $event" />
            <input v-else v-model="input" type="password" maxlength="4" inputmode="numeric" autocomplete="new-password" class="w-line-input" placeholder="四位数字" @input="input = input.replace(/\D/g, '').slice(0, 4)" @keyup.enter="submit" />
          </div>
          <p v-else class="desc-text">关闭后保留付款确认，无需输入密码。</p>
          <p v-if="error" class="setting-error">{{ error }}</p>
          <button v-if="currentPassword" type="button" class="reset-link" @click="resetting = true">忘记密码？本地重置</button>
          <button v-if="confirming" type="button" class="reset-link" @click="confirming = false; input = ''; first = ''">重新设置</button>
        </template>
      </div>
      <footer v-if="!resetting" class="w-modal-footer"><button class="w-btn-secondary" @click="emit('close')">取消</button><button class="w-btn-primary" :disabled="drawing || ((!unlocked || mode !== 'off') && !valid)" @click="submit">{{ !unlocked ? '验证当前密码' : confirming || mode === 'off' ? '保存设置' : '再次确认' }}</button></footer>
    </div>
  </div>
</template>
<style scoped>
.password-settings{max-height:calc(100dvh - 36px);overflow-y:auto}.desc-text{font-size:11px;color:var(--w-text-muted);line-height:1.7;margin:0 0 16px;overflow-wrap:anywhere}.password-modes{display:flex;gap:6px;margin-bottom:18px}.password-modes button{min-width:0;flex:1;padding:9px 4px;background:transparent;border:1px solid var(--w-border);color:var(--w-text-secondary);font:inherit;font-size:11px;cursor:pointer}.password-modes .active{border-color:var(--w-text-main);color:var(--w-text-main);background:var(--w-panel-bg)}.setting-error{color:var(--w-accent-red);font-size:11px;line-height:1.6}.reset-link{padding:6px 0;border:0;background:transparent;color:var(--w-text-muted);font:inherit;font-size:10px;cursor:pointer;display:block}.w-btn-primary:disabled{opacity:.4;cursor:not-allowed}
.w-modal-title-group{min-width:0}.w-modal-cn-title{white-space:nowrap}.w-modal-close-btn{flex-shrink:0}.w-modal-footer{flex-shrink:0}@media(max-width:400px){.w-modal-en-sub{display:none}}
</style>
