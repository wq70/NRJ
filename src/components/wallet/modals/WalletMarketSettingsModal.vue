/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import type { WalletState } from '../../../services/walletService'

const props = defineProps<{
  state: WalletState
  refreshing: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'choose-mode', mode: 'simulation' | 'live', source?: 'builtin' | 'custom'): void
  (e: 'add-symbol', code: string): void
  (e: 'remove-symbol', code: string): void
  (e: 'refresh'): void
  (e: 'save-custom'): void
}>()

const symbolInput = ref('')

const handleAddSymbol = () => {
  if (symbolInput.value.trim()) {
    emit('add-symbol', symbolInput.value.trim())
    symbolInput.value = ''
  }
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">行情源与服务配置</span>
          <span class="w-modal-en-sub">MARKET FEED SETTINGS</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <div class="w-form-group">
          <label class="w-form-label">行情引擎模式 (FEED ENGINE)</label>
          <div class="mode-select-grid">
            <button 
              :class="{ active: state.marketSettings.mode === 'simulation' }" 
              @click="emit('choose-mode', 'simulation')"
            >
              <strong>本地离线模拟</strong>
              <small>虚构股票与算法波动</small>
            </button>
            <button 
              :class="{ active: state.marketSettings.mode === 'live' && state.marketSettings.source === 'builtin' }" 
              @click="emit('choose-mode', 'live', 'builtin')"
            >
              <strong>内置免Key实时A股</strong>
              <small>网络实时真实股票报价</small>
            </button>
          </div>
        </div>

        <div v-if="state.marketSettings.mode === 'live'" class="live-manager-section">
          <div class="w-form-group">
            <label class="w-form-label">A股标的添加 (6位股票代码)</label>
            <div class="input-with-btn">
              <input 
                v-model="symbolInput" 
                type="text" 
                maxlength="6" 
                placeholder="例如: 600519" 
                class="w-line-input"
                @keyup.enter="handleAddSymbol"
              />
              <button class="w-btn-secondary mini" @click="handleAddSymbol">添加</button>
            </div>
          </div>

          <div class="symbol-table">
            <div v-for="q in state.liveQuotes" :key="q.code" class="symbol-row">
              <span>{{ q.name }} ({{ q.code }})</span>
              <button class="remove-btn" @click="emit('remove-symbol', q.code)">移除</button>
            </div>
          </div>
        </div>
      </div>

      <footer class="w-modal-footer">
        <button class="w-btn-primary" @click="emit('close')">完成</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mode-select-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.mode-select-grid button {
  background-color: var(--w-bg-alt);
  border: 1px solid var(--w-border);
  padding: 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  cursor: pointer;
  text-align: left;
}
.mode-select-grid button.active {
  border-color: var(--w-accent-gold);
  background-color: var(--w-bg);
}
.mode-select-grid strong {
  font-size: 12px;
  color: var(--w-text-main);
}
.mode-select-grid small {
  font-size: 10px;
  color: var(--w-text-muted);
}
.input-with-btn {
  display: flex;
  align-items: center;
  gap: 8px;
}
.w-btn-secondary.mini {
  padding: 4px 12px;
}
.symbol-table {
  max-height: 180px;
  overflow-y: auto;
  border: 1px solid var(--w-border-light);
  margin-top: 10px;
}
.symbol-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--w-border-light);
  font-size: 12px;
}
.symbol-row:last-child {
  border-bottom: none;
}
.remove-btn {
  background: none;
  border: none;
  font-size: 11px;
  color: var(--w-accent-red);
  cursor: pointer;
}
</style>
