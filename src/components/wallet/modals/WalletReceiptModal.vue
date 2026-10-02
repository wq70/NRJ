/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { MomentReceiptCode } from '../../../services/momentPayments'

defineProps<{
  receiptCode: MomentReceiptCode | null
  receiptPoster: string
  generating: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'generate', payload: { amount: string; remark: string }): void
  (e: 'save-poster'): void
  (e: 'share-moments'): void
}>()

const amountInput = ref('')
const remarkInput = ref('')

const handleGenerate = () => {
  emit('generate', {
    amount: amountInput.value.trim(),
    remark: remarkInput.value.trim()
  })
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">私享收款凭证码</span>
          <span class="w-modal-en-sub">RECEIPT QR CODE</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <div class="poster-container">
          <div v-if="generating" class="poster-loading">生成凭证海报中...</div>
          <img v-else-if="receiptPoster" :src="receiptPoster" alt="收款海报" class="receipt-img" />
          <div v-else class="poster-placeholder">点击下方生成收款二维码</div>
        </div>

        <div class="w-form-group">
          <label class="w-form-label">指定固定受款金额 CNY (可选 / OPTIONAL)</label>
          <input v-model="amountInput" type="text" inputmode="decimal" placeholder="留空则由对方自定转账金额" class="w-line-input" />
        </div>

        <div class="w-form-group">
          <label class="w-form-label">收款附言备注 (MEMO / OPTIONAL)</label>
          <input v-model="remarkInput" type="text" maxlength="40" placeholder="例如：请我喝一杯咖啡" class="w-line-input" />
        </div>

        <div class="btn-grid">
          <button class="w-btn-secondary" :disabled="generating" @click="handleGenerate">
            更新收款凭证
          </button>
          <button class="w-btn-secondary" :disabled="!receiptPoster || generating" @click="emit('save-poster')">
            保存海报图像
          </button>
        </div>

        <div class="publish-wrap">
          <button class="w-btn-primary full-width" :disabled="!receiptPoster || generating" @click="emit('share-moments')">
            立即投送至朋友圈流转 (SHARE TO MOMENTS)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.poster-container {
  width: 100%;
  height: 240px;
  border: 1px solid var(--w-border);
  background-color: var(--w-bg-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  overflow: hidden;
}
.receipt-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.poster-loading, .poster-placeholder {
  font-size: 11px;
  color: var(--w-text-muted);
}
.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 14px;
}
.publish-wrap {
  margin-top: 10px;
}
.full-width {
  width: 100%;
}
</style>
