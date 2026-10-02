/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WalletState } from '../../../services/walletService'
import { formatWalletMoney } from '../../../services/walletService'

const props = defineProps<{
  state: WalletState
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'delete-selected', ids: string[]): void
}>()

const filterType = ref<'all' | 'income' | 'expense'>('all')
const filterMonth = ref<string>('')
const searchQuery = ref<string>('')
const isManaging = ref(false)
const selectedIds = ref<string[]>([])

const availableMonths = computed(() => {
  const months = new Set<string>()
  props.state.ledger.forEach(entry => {
    const d = new Date(entry.createdAt)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.add(m)
  })
  return Array.from(months).sort((a, b) => b.localeCompare(a))
})

const filteredBills = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return props.state.ledger.filter(entry => {
    if (filterType.value === 'income' && entry.amountCents <= 0) return false
    if (filterType.value === 'expense' && entry.amountCents >= 0) return false
    if (filterMonth.value) {
      const d = new Date(entry.createdAt)
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (m !== filterMonth.value) return false
    }
    if (q) {
      const amtStr = (Math.abs(entry.amountCents) / 100).toString()
      return entry.title.toLowerCase().includes(q) || (entry.note && entry.note.toLowerCase().includes(q)) || amtStr.includes(q)
    }
    return true
  })
})

const billStats = computed(() => {
  let income = 0
  let expense = 0
  filteredBills.value.forEach(entry => {
    if (entry.amountCents > 0) income += entry.amountCents
    else expense += entry.amountCents
  })
  return { income, expense: Math.abs(expense) }
})

const toggleSelect = (id: string) => {
  const idx = selectedIds.value.indexOf(id)
  if (idx > -1) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

const toggleSelectAll = () => {
  if (selectedIds.value.length === filteredBills.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = filteredBills.value.map(b => b.id)
  }
}

const formatDateTime = (val: number) => {
  const d = new Date(val)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <div class="w-modal-container full-height-modal">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">对账明细底册</span>
          <span class="w-modal-en-sub">AUDIT LEDGER & STATS</span>
        </div>
        <div class="header-action-wrap">
          <button class="w-mini-btn" @click="isManaging = !isManaging">
            {{ isManaging ? '完成' : '编辑底册' }}
          </button>
          <button class="w-modal-close-btn" @click="emit('close')">✕</button>
        </div>
      </header>

      <div class="w-modal-body no-padding">
        <!-- 统计面板 -->
        <div class="w-ledger-stats-banner">
          <div class="w-stat-col">
            <span class="lbl">支出核计 (EXPENSE)</span>
            <strong class="val">¥{{ formatWalletMoney(billStats.expense) }}</strong>
          </div>
          <div class="w-stat-col">
            <span class="lbl">收入核计 (INCOME)</span>
            <strong class="val inc">¥{{ formatWalletMoney(billStats.income) }}</strong>
          </div>
        </div>

        <!-- 过滤工具条 -->
        <div class="w-ledger-filter-bar">
          <div class="filter-type-group">
            <button :class="{ active: filterType === 'all' }" @click="filterType = 'all'">全部</button>
            <button :class="{ active: filterType === 'expense' }" @click="filterType = 'expense'">支出</button>
            <button :class="{ active: filterType === 'income' }" @click="filterType = 'income'">收入</button>
          </div>
          <select v-model="filterMonth" class="w-mini-select">
            <option value="">全部月份</option>
            <option v-for="m in availableMonths" :key="m" :value="m">{{ m.replace('-', '年') + '月' }}</option>
          </select>
        </div>

        <div class="w-ledger-search-wrap">
          <input v-model="searchQuery" type="text" placeholder="检索交易事项、凭证备注或精确金额..." class="w-search-input" />
        </div>

        <!-- 流水列表 -->
        <div class="w-ledger-stream">
          <div v-if="!filteredBills.length" class="w-empty-hint">
            <span>暂无对账明细</span>
          </div>
          <div 
            v-for="entry in filteredBills" 
            :key="entry.id" 
            class="w-ledger-item-row"
            :class="{ selected: selectedIds.includes(entry.id) }"
            @click="isManaging && toggleSelect(entry.id)"
          >
            <div v-if="isManaging" class="w-select-checkbox">
              <span v-if="selectedIds.includes(entry.id)" class="checked-mark">■</span>
            </div>
            <div class="w-item-info">
              <span class="w-item-title">{{ entry.title }}</span>
              <span class="w-item-meta">{{ formatDateTime(entry.createdAt) }} <span v-if="entry.note">· {{ entry.note }}</span></span>
            </div>
            <div class="w-item-amount" :class="{ inc: entry.amountCents > 0 }">
              {{ entry.amountCents > 0 ? '+' : '' }}{{ formatWalletMoney(entry.amountCents) }}
            </div>
          </div>
        </div>
      </div>

      <footer v-if="isManaging" class="w-modal-footer space-between">
        <button class="w-btn-secondary" @click="toggleSelectAll">
          {{ selectedIds.length === filteredBills.length ? '取消全选' : '全选' }} ({{ selectedIds.length }})
        </button>
        <button 
          class="w-btn-danger" 
          :disabled="!selectedIds.length" 
          @click="emit('delete-selected', selectedIds)"
        >
          移除所选账单
        </button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.full-height-modal {
  max-width: 480px;
  height: 85vh;
}
.header-action-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}
.w-mini-btn {
  background: transparent;
  border: 1px solid var(--w-border);
  font-size: 11px;
  padding: 3px 8px;
  cursor: pointer;
  color: var(--w-text-secondary);
}
.no-padding {
  padding: 0 !important;
  display: flex;
  flex-direction: column;
}
.w-ledger-stats-banner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background-color: var(--w-bg-alt);
  border-bottom: 1px solid var(--w-border);
  padding: 14px 18px;
}
.w-stat-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.w-stat-col .lbl {
  font-size: 10px;
  color: var(--w-text-muted);
  letter-spacing: 0.5px;
}
.w-stat-col .val {
  font-family: var(--w-num-font);
  font-size: 16px;
  font-weight: 600;
  color: var(--w-text-main);
}
.w-stat-col .val.inc {
  color: var(--w-accent-red);
}
.w-ledger-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  border-bottom: 1px solid var(--w-border-light);
}
.filter-type-group {
  display: flex;
  gap: 8px;
}
.filter-type-group button {
  background: none;
  border: none;
  font-size: 12px;
  color: var(--w-text-muted);
  padding: 4px 0;
  cursor: pointer;
  position: relative;
}
.filter-type-group button.active {
  color: var(--w-text-main);
  font-weight: 600;
}
.w-mini-select {
  border: 1px solid var(--w-border);
  background: transparent;
  font-size: 11px;
  padding: 3px 6px;
  outline: none;
}
.w-ledger-search-wrap {
  padding: 8px 18px;
  border-bottom: 1px solid var(--w-border);
}
.w-search-input {
  width: 100%;
  border: none;
  font-size: 12px;
  outline: none;
  padding: 4px 0;
  color: var(--w-text-main);
}
.w-ledger-stream {
  flex: 1;
  overflow-y: auto;
}
.w-ledger-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid var(--w-border-light);
  cursor: pointer;
  transition: background-color 0.15s;
}
.w-ledger-item-row:hover {
  background-color: var(--w-bg-alt);
}
.w-ledger-item-row.selected {
  background-color: var(--w-accent-gold-light);
}
.w-select-checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid var(--w-border);
  margin-right: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.checked-mark {
  font-size: 10px;
  color: var(--w-accent-gold);
}
.w-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}
.w-item-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--w-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.w-item-meta {
  font-size: 10px;
  color: var(--w-text-muted);
}
.w-item-amount {
  font-family: var(--w-num-font);
  font-size: 13px;
  font-weight: 600;
  color: var(--w-text-main);
  margin-left: 12px;
}
.w-item-amount.inc {
  color: var(--w-accent-red);
}
.w-empty-hint {
  padding: 40px;
  text-align: center;
  font-size: 12px;
  color: var(--w-text-muted);
}
.space-between {
  justify-content: space-between !important;
}
</style>
