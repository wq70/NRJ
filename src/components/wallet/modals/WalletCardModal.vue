/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { WalletBankCard } from '../../../services/walletService'

const props = defineProps<{
  card?: WalletBankCard | null
  coverData?: { front?: string; back?: string }
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: {
    id?: string
    name: string
    type: 'debit' | 'credit'
    digits: string
    expiryDate: string
    limitOrBalance: number | null
    isFavorite: boolean
    coverFront?: string
    coverBack?: string
    coverBlur: number
    backCoverBlur: number
  }): void
}>()

const cardType = ref<'debit' | 'credit'>(props.card?.type || 'debit')
const cardName = ref(props.card?.name || '')
const cardNumber = ref(props.card?.fullNumber || props.card?.lastFour || '')
const cardExpiry = ref(props.card?.expiryDate || '')
const cardBalance = ref(
  props.card 
    ? (props.card.type === 'credit' ? (props.card.limitCents || 0) / 100 : (props.card.balanceCents || 0) / 100).toString()
    : ''
)
const isFavorite = ref(Boolean(props.card?.isFavorite))
const coverFront = ref(props.coverData?.front || '')
const coverBack = ref(props.coverData?.back || '')
const coverBlur = ref(props.card?.coverBlur || 0)
const backCoverBlur = ref(props.card?.backCoverBlur || 0)

const triggerUpload = (isBack: boolean) => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (ev.target?.result) {
        if (isBack) coverBack.value = ev.target.result as string
        else coverFront.value = ev.target.result as string
      }
    }
    reader.readAsDataURL(file)
  }
  input.click()
}

const generateRandom = () => {
  cardType.value = Math.random() > 0.5 ? 'debit' : 'credit'
  const banks = ['瑞士信贷', '摩根士丹利', '汇丰私行', '花旗金库', '高盛资产', '招商私行', '渣打财富']
  cardName.value = banks[Math.floor(Math.random() * banks.length)]
  let num = ''
  const len = cardType.value === 'debit' ? 19 : 16
  for (let i = 0; i < len; i++) num += Math.floor(Math.random() * 10)
  cardNumber.value = num
  const now = new Date()
  const year = now.getFullYear() + Math.floor(Math.random() * 5) + 3
  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
  cardExpiry.value = `${month}/${String(year).slice(-2)}`
}

const handleSubmit = () => {
  const digits = cardNumber.value.replace(/\D/g, '')
  if (!cardName.value.trim() || digits.length < 4) return
  const parsed = cardBalance.value.trim() !== '' ? Math.max(0, Math.round(Number(cardBalance.value) * 100)) : null

  emit('submit', {
    id: props.card?.id,
    name: cardName.value.trim(),
    type: cardType.value,
    digits,
    expiryDate: cardExpiry.value,
    limitOrBalance: parsed,
    isFavorite: isFavorite.value,
    coverFront: coverFront.value,
    coverBack: coverBack.value,
    coverBlur: coverBlur.value,
    backCoverBlur: backCoverBlur.value
  })
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">{{ card ? '修改银行卡底册' : '绑定新金融卡' }}</span>
          <span class="w-modal-en-sub">{{ card ? 'EDIT CARD' : 'REGISTER CARD' }}</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <div class="cover-settings-row">
          <div class="cover-box">
            <span class="box-lbl">正面卡面 (FRONT)</span>
            <div 
              class="cover-preview" 
              :style="coverFront ? { backgroundImage: `url(${coverFront})` } : {}"
              @click="triggerUpload(false)"
            >
              <span v-if="!coverFront" class="up-hint">+ 上传</span>
              <button v-else class="del-btn" @click.stop="coverFront = ''">✕</button>
            </div>
          </div>
          <div class="cover-box">
            <span class="box-lbl">背面卡面 (BACK)</span>
            <div 
              class="cover-preview" 
              :style="coverBack ? { backgroundImage: `url(${coverBack})` } : {}"
              @click="triggerUpload(true)"
            >
              <span v-if="!coverBack" class="up-hint">+ 上传</span>
              <button v-else class="del-btn" @click.stop="coverBack = ''">✕</button>
            </div>
          </div>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">卡片性质 (CATEGORY)</label>
          <select v-model="cardType" class="w-select">
            <option value="debit">储蓄结算卡 (DEBIT CARD)</option>
            <option value="credit">信用消费卡 (CREDIT CARD)</option>
          </select>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">发行机构 / 银行名称 (INSTITUTION)</label>
          <input v-model="cardName" type="text" placeholder="例如：瑞士信贷" class="w-line-input" />
        </div>

        <div class="w-form-group">
          <label class="w-form-label">卡号 (ACCOUNT NUMBER)</label>
          <input v-model="cardNumber" type="text" inputmode="numeric" placeholder="16或19位数字" class="w-line-input" />
        </div>

        <div class="w-form-group">
          <label class="w-form-label">有效期与安全标记 (EXPIRY / MM/YY)</label>
          <input v-model="cardExpiry" type="text" placeholder="例如：12/28" class="w-line-input" />
        </div>

        <div class="w-form-group">
          <label class="w-form-label">{{ cardType === 'credit' ? '信用额度 CNY (LIMIT)' : '卡内可用余额 CNY (BALANCE)' }}</label>
          <input v-model="cardBalance" type="text" inputmode="decimal" placeholder="留空则随机匹配额度" class="w-line-input" />
        </div>

        <div class="switch-row">
          <span class="lbl">设为优先常用卡 (FAVORITE)</span>
          <input type="checkbox" v-model="isFavorite" class="w-check" />
        </div>
      </div>

      <footer class="w-modal-footer space-between">
        <button class="w-btn-secondary" @click="generateRandom">一键生成随机卡</button>
        <div class="right-btns">
          <button class="w-btn-secondary" @click="emit('close')">取消</button>
          <button class="w-btn-primary" @click="handleSubmit">确认提交</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.cover-settings-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.cover-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.box-lbl {
  font-size: 10px;
  color: var(--w-text-muted);
}
.cover-preview {
  height: 60px;
  border: 1px dashed var(--w-border);
  background-color: var(--w-bg-alt);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
}
.up-hint {
  font-size: 11px;
  color: var(--w-text-muted);
}
.del-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: none;
  font-size: 10px;
  padding: 2px 4px;
  cursor: pointer;
}
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-top: 1px solid var(--w-border-light);
  margin-top: 8px;
}
.switch-row .lbl {
  font-size: 11px;
  color: var(--w-text-secondary);
}
.w-check {
  width: 16px;
  height: 16px;
  accent-color: var(--w-accent-gold);
}
.right-btns {
  display: flex;
  gap: 8px;
}
.space-between {
  justify-content: space-between !important;
}
</style>
