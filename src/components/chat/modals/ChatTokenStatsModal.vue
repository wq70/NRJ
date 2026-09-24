/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useChatTokenStats, type TokenDetailItem } from '../../../composables/useChatTokenStats'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()
const { tokenStats, isCalculating, refreshTokenStats } = useChatTokenStats()

const activeTab = ref<'details' | 'ranking' | 'optimize' | 'compare'>('details')
const searchQuery = ref('')
const expandedCategories = ref(new Set<string>(['system', 'history']))
const expandedGroups = ref(new Set<string>())
const previewItem = ref<TokenDetailItem | null>(null)

watch(() => props.visible, visible => {
  if (visible) {
    activeTab.value = 'details'
    searchQuery.value = ''
    refreshTokenStats()
  }
})

const filteredCategories = computed(() => {
  if (!tokenStats.value) return []
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return tokenStats.value.categories
  return tokenStats.value.categories.map(category => ({
    ...category,
    groups: category.groups.map(group => ({
      ...group,
      details: group.details.filter(detail => `${detail.label} ${detail.group} ${detail.reason || ''}`.toLowerCase().includes(query))
    })).filter(group => group.details.length)
  })).filter(category => category.groups.length)
})

const toggleSet = (target: typeof expandedCategories, key: string) => {
  const next = new Set(target.value)
  next.has(key) ? next.delete(key) : next.add(key)
  target.value = next
}
const toggleCategory = (key: string) => toggleSet(expandedCategories, key)
const toggleGroup = (key: string) => toggleSet(expandedGroups, key)

const exportReport = () => {
  if (!tokenStats.value) return
  const safeReport = {
    ...tokenStats.value,
    categories: tokenStats.value.categories.map(category => ({
      ...category,
      groups: category.groups.map(group => ({
        ...group,
        details: group.details.map(({ text: _text, ...detail }) => detail)
      }))
    }))
  }
  const blob = new Blob([JSON.stringify(safeReport, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `上下文用量诊断-${new Date().toISOString().slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

const formatNumber = (value: number) => Math.round(value).toLocaleString()
const formatTime = (value: number) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
const closeModal = () => emit('update:visible', false)
</script>

<template>
  <div v-if="visible" class="wb-modal-overlay token-overlay" @click.self="closeModal">
    <div class="custom-confirm-modal wb-modal-content token-stats-modal">
      <div class="wb-modal-header token-modal-header">
        <div>
          <div class="wb-modal-title">上下文用量估算</div>
          <div class="token-header-sub">查看本轮每一部分为什么被注入</div>
        </div>
        <div class="wb-modal-close" @click="closeModal">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>

      <div class="wb-modal-body token-modal-body">
        <div v-if="isCalculating && !tokenStats" class="token-stats-loading">正在整理本轮上下文…</div>
        <template v-else-if="tokenStats">
          <div class="token-total-card">
            <div class="token-total-label">预计输入 Tokens</div>
            <div class="token-total-value">{{ formatNumber(tokenStats.totalTokens) }}</div>
            <div class="token-message-count">本轮有效 {{ tokenStats.activeMsgCount }} 条 · 当前共 {{ tokenStats.totalMsgCount }} 条 · {{ formatNumber(tokenStats.totalCharacters) }} 字符</div>
            <div class="token-meta-row">
              <span>{{ tokenStats.presetLabel }}</span><span>{{ tokenStats.model }}</span><span>{{ tokenStats.methodLabel }}</span>
            </div>
          </div>

          <div class="token-budget-card">
            <div class="token-budget-heading"><span>128K 参考窗口</span><b>剩余约 {{ formatNumber(tokenStats.remainingReference) }}</b></div>
            <div class="token-category-track"><div class="token-category-fill token-budget-fill" :style="{ width: Math.min(100, (tokenStats.totalTokens + tokenStats.outputReserve) / tokenStats.referenceWindow * 100) + '%' }"/></div>
            <div class="token-budget-note">输入 {{ formatNumber(tokenStats.totalTokens) }} + 输出预留 {{ formatNumber(tokenStats.outputReserve) }}。这是统一参考值，模型平台上限仍以 API 文档为准。</div>
          </div>

          <div v-if="tokenStats.actualUsage" class="token-actual-card">
            <div><span>平台最近一次实际返回</span><small>{{ formatTime(tokenStats.actualUsage.createdAt) }} · {{ tokenStats.actualUsage.model }}</small></div>
            <strong>{{ formatNumber(tokenStats.actualUsage.inputTokens || tokenStats.actualUsage.totalTokens) }}<small>{{ tokenStats.actualUsage.inputTokens ? '输入' : '总计' }}</small></strong>
          </div>

          <div class="token-tabs">
            <div v-for="tab in [{id:'details',label:'明细'},{id:'ranking',label:'排行'},{id:'optimize',label:'优化'},{id:'compare',label:'对比'}]" :key="tab.id" class="token-tab" :class="{ active: activeTab === tab.id }" @click="activeTab = tab.id as any">{{ tab.label }}</div>
          </div>

          <template v-if="activeTab === 'details'">
            <div class="token-search-wrap">
              <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="21" y2="21"/></svg>
              <input v-model="searchQuery" class="token-search-input" placeholder="搜索人设、规则、世界书或消息" />
              <div v-if="searchQuery" class="token-search-clear" @click="searchQuery = ''">×</div>
            </div>

            <div class="token-category-list">
              <div v-for="category in filteredCategories" :key="category.key" class="token-category-card">
                <div class="token-category-heading token-clickable" @click="toggleCategory(category.key)">
                  <div class="token-category-name"><span class="token-color-dot" :style="{ background: category.color }"/><span>{{ category.label }}</span><small>{{ category.groups.reduce((sum, group) => sum + group.details.length, 0) }} 项</small></div>
                  <div class="token-category-value">{{ formatNumber(category.tokens) }} <span>{{ category.percentage }}%</span><i :class="{ open: expandedCategories.has(category.key) }">›</i></div>
                </div>
                <div class="token-category-track"><div class="token-category-fill" :style="{ width: Math.max(0, category.percentage) + '%', background: category.color }"/></div>

                <div v-if="expandedCategories.has(category.key) || searchQuery" class="token-group-list">
                  <div v-if="!category.groups.length" class="token-empty">本轮没有注入此类内容</div>
                  <div v-for="group in category.groups" :key="`${category.key}:${group.label}`" class="token-group">
                    <div class="token-group-heading" @click="toggleGroup(`${category.key}:${group.label}`)">
                      <span>{{ group.label }}</span><span>{{ formatNumber(group.tokens) }} · {{ group.percentage }}% <i :class="{ open: expandedGroups.has(`${category.key}:${group.label}`) || searchQuery }">›</i></span>
                    </div>
                    <div v-if="expandedGroups.has(`${category.key}:${group.label}`) || searchQuery" class="token-detail-list">
                      <div v-for="detail in group.details" :key="detail.id" class="token-detail-item" @click="previewItem = detail">
                        <div><b>{{ detail.label }}</b><small>{{ detail.reason || '来自本轮实际组装内容' }}</small></div>
                        <span>{{ detail.counted ? formatNumber(detail.tokens) : `子项 ${formatNumber(detail.tokens)}` }}<i>›</i></span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <div v-else-if="activeTab === 'ranking'" class="token-section-list">
            <div class="token-section-title">本轮占用最高的 10 个片段</div>
            <div v-for="(item, index) in tokenStats.topItems" :key="item.id" class="token-ranking-item" @click="previewItem = item">
              <span class="token-rank">{{ index + 1 }}</span><div><b>{{ item.label }}</b><small>{{ item.group }} · {{ item.percentage }}%</small></div><strong>{{ formatNumber(item.tokens) }}</strong>
            </div>
          </div>

          <div v-else-if="activeTab === 'optimize'" class="token-section-list">
            <div class="token-section-title">基于当前请求的优化建议</div>
            <div v-for="item in tokenStats.suggestions" :key="item.title" class="token-advice-card">
              <div class="token-advice-icon">✓</div><div><b>{{ item.title }}</b><p>{{ item.desc }}</p><small v-if="item.savings">预计最多可减少约 {{ formatNumber(item.savings) }} Tokens</small></div>
            </div>
            <div class="token-stats-note">建议只提供诊断，不会自动删除人设、记忆或修改功能开关。</div>
          </div>

          <div v-else class="token-section-list">
            <div class="token-section-title">默认底层提示词体积对比</div>
            <div v-for="item in tokenStats.comparisons" :key="item.label" class="token-compare-item" :class="{ active: item.active }">
              <div><b>{{ item.label }}</b><small>{{ item.active ? '当前使用' : '仅供比较，不会切换' }}</small></div><strong>{{ formatNumber(item.tokens) }}</strong>
            </div>
            <div class="token-stats-note">这里比较默认提示词原文，不含角色资料、动态规则和历史消息。英文不再按“字符 × 1.2”错误放大。</div>
          </div>
        </template>
      </div>

      <div class="confirm-actions token-footer">
        <div class="confirm-btn cancel" @click="exportReport">导出诊断</div>
        <div class="confirm-btn token-confirm-btn" @click="closeModal">完成</div>
      </div>
    </div>

    <div v-if="previewItem" class="wb-modal-overlay token-preview-overlay" @click.self="previewItem = null">
      <div class="custom-confirm-modal token-preview-modal">
        <div class="confirm-title">{{ previewItem.label }}</div>
        <div class="token-preview-meta">{{ previewItem.group }} · {{ formatNumber(previewItem.tokens) }} Tokens · {{ formatNumber(previewItem.characters) }} 字符</div>
        <div class="token-preview-reason">{{ previewItem.reason || '来自本轮实际组装内容' }}</div>
        <pre class="token-preview-text">{{ previewItem.text || '该片段没有可预览文本' }}</pre>
        <div class="confirm-actions"><div class="confirm-btn token-confirm-btn" @click="previewItem = null">知道了</div></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import '../settings/ChatSettingsStyles.css';
.token-overlay { z-index: 10000; }
.token-stats-modal {
  width: min(92%, 460px);
  max-width: 460px;
  max-height: 88vh;
  background: #ffffff !important;
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.token-modal-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  background: #ffffff;
  border-bottom: 1px solid #f0f1f4;
}
.token-modal-header .wb-modal-title {
  color: #1a1a1a;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.2px;
}
.token-modal-header .wb-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: #8c8c8c;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.token-modal-header .wb-modal-close:hover {
  background: #f5f6f8;
  color: #333333;
}
.token-modal-header .wb-modal-close:active {
  background: #eef0f3;
}
.token-header-sub {
  margin-top: 3px;
  color: #8c8c8c;
  font-size: 11px;
}
.token-modal-body {
  min-height: 0;
  flex: 1;
  padding: 16px 18px 20px;
  overflow-y: auto;
  background: #ffffff;
}
.token-stats-loading {
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  font-size: 13px;
}
.token-total-card {
  padding: 18px 16px;
  text-align: center;
  background: #ffffff;
  border: 1px solid #eeeff2;
  border-radius: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
}
.token-total-label {
  color: #8c8c8c;
  font-size: 12px;
}
.token-total-value {
  margin: 6px 0;
  color: #111111;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.5px;
}
.token-message-count {
  color: #666666;
  font-size: 11px;
}
.token-meta-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}
.token-meta-row span {
  padding: 3px 9px;
  color: #666666;
  background: #f7f8fa;
  border: 1px solid #eeeff2;
  border-radius: 999px;
  font-size: 10px;
}
.token-budget-card {
  margin-top: 12px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #eeeff2;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
}
.token-budget-heading {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #666666;
  font-size: 11px;
}
.token-budget-heading b {
  color: #111111;
}
.token-budget-note {
  margin-top: 8px;
  color: #8c8c8c;
  font-size: 10px;
  line-height: 1.5;
}
.token-actual-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #eeeff2;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
}
.token-actual-card span {
  display: block;
  color: #666666;
  font-size: 11px;
}
.token-actual-card small {
  display: block;
  margin-top: 3px;
  color: #8c8c8c;
  font-size: 9px;
  font-weight: normal;
}
.token-actual-card strong {
  color: #111111;
  font: 600 14px monospace;
  text-align: right;
}
.token-budget-fill {
  background: #111111;
}
.token-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  margin: 14px 0 12px;
  padding: 4px;
  background: #f4f5f7;
  border-radius: 10px;
}
.token-tab {
  padding: 7px 2px;
  color: #777777;
  border-radius: 8px;
  text-align: center;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.token-tab.active {
  color: #111111;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.05);
  font-weight: 600;
}
.token-search-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  color: #8c8c8c;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.token-search-wrap:focus-within {
  border-color: #bbbec7;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.03);
}
.token-search-input {
  min-width: 0;
  flex: 1;
  padding: 0;
  color: #111111;
  background: transparent;
  border: 0;
  outline: 0;
  font: inherit;
  font-size: 12px;
}
.token-search-input::placeholder {
  color: #a0a0a5;
}
.token-search-clear {
  padding: 0 2px;
  font-size: 17px;
  cursor: pointer;
  color: #999999;
}
.token-search-clear:hover {
  color: #333333;
}
.token-category-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.token-category-card {
  padding: 13px 14px;
  background: #ffffff;
  border: 1px solid #eeeff2;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
}
.token-category-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 7px;
  font-size: 13px;
}
.token-clickable, .token-group-heading, .token-detail-item, .token-ranking-item {
  cursor: pointer;
}
.token-category-name {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #333333;
}
.token-category-name small {
  color: #8c8c8c;
  font-size: 9px;
}
.token-color-dot {
  width: 9px;
  height: 9px;
  flex: 0 0 auto;
  border-radius: 3px;
}
.token-category-value {
  color: #111111;
  font-family: monospace;
  font-weight: 600;
  white-space: nowrap;
}
.token-category-value span {
  color: #8c8c8c;
  font-size: 10px;
  font-weight: normal;
}
.token-category-value i, .token-group-heading i, .token-detail-item i {
  display: inline-block;
  margin-left: 5px;
  color: #a0a0a5;
  font-style: normal;
  transition: transform .2s;
}
i.open {
  transform: rotate(90deg);
}
.token-category-track {
  height: 4px;
  overflow: hidden;
  background: #f0f1f4;
  border-radius: 2px;
}
.is-dark .token-category-track {
  background: rgba(255,255,255,.08);
}
.token-category-fill {
  height: 100%;
  min-width: 0;
  border-radius: 2px;
}
.token-group-list {
  margin-top: 10px;
  border-top: 1px solid #f0f1f4;
}
.token-group {
  border-bottom: 1px solid #f0f1f4;
}
.token-group:last-child {
  border-bottom: 0;
}
.token-group-heading {
  display: flex;
  justify-content: space-between;
  padding: 10px 2px;
  color: #555555;
  font-size: 11px;
}
.token-group-heading span:last-child {
  color: #8c8c8c;
  font-family: monospace;
}
.token-detail-list {
  padding: 0 0 7px 8px;
}
.token-detail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.15s;
}
.token-detail-item:hover {
  background: #f7f8fa;
}
.token-detail-item:active, .token-ranking-item:active {
  background: #f0f2f5;
}
.token-detail-item div {
  min-width: 0;
}
.token-detail-item b {
  display: block;
  overflow: hidden;
  color: #222222;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.token-detail-item small {
  display: block;
  margin-top: 3px;
  overflow: hidden;
  color: #8c8c8c;
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.token-detail-item > span {
  flex: 0 0 auto;
  color: #666666;
  font: 10px monospace;
}
.token-empty {
  padding: 12px 2px 2px;
  color: #8c8c8c;
  font-size: 11px;
}
.token-section-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.token-section-title {
  margin-bottom: 2px;
  color: #555555;
  font-size: 12px;
  font-weight: 600;
}
.token-ranking-item, .token-compare-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: #ffffff;
  border: 1px solid #eeeff2;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
  transition: background 0.15s;
}
.token-ranking-item:hover, .token-compare-item:hover {
  background: #f9fafb;
}
.token-rank {
  width: 22px;
  color: #8c8c8c;
  font: 600 12px monospace;
  text-align: center;
}
.token-ranking-item div, .token-compare-item div {
  min-width: 0;
  flex: 1;
}
.token-ranking-item b, .token-compare-item b {
  display: block;
  overflow: hidden;
  color: #111111;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.token-ranking-item small, .token-compare-item small {
  display: block;
  margin-top: 3px;
  color: #8c8c8c;
  font-size: 9px;
}
.token-ranking-item strong, .token-compare-item strong {
  color: #111111;
  font: 600 12px monospace;
}
.token-compare-item.active {
  box-shadow: inset 3px 0 #111111, 0 2px 8px rgba(0, 0, 0, 0.015);
  border-color: #d8dade;
}
.token-advice-card {
  display: flex;
  gap: 10px;
  padding: 14px;
  background: #ffffff;
  border: 1px solid #eeeff2;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.015);
}
.token-advice-icon {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  color: #ffffff;
  background: #111111;
  border-radius: 50%;
  font-size: 11px;
  line-height: 20px;
  text-align: center;
}
.token-advice-card b {
  color: #111111;
  font-size: 12px;
}
.token-advice-card p {
  margin: 5px 0 0;
  color: #555555;
  font-size: 10px;
  line-height: 1.55;
}
.token-advice-card small {
  display: block;
  margin-top: 6px;
  color: #8c8c8c;
  font-size: 9px;
}
.token-stats-note {
  padding: 11px 13px;
  color: #8c8c8c;
  background: #f7f8fa;
  border: 1px solid #eeeff2;
  border-radius: 9px;
  font-size: 10px;
  line-height: 1.55;
}
.token-footer {
  flex: 0 0 auto;
  background: #ffffff;
  border-top: 1px solid #f0f1f4;
}
.confirm-btn.cancel {
  background: #ffffff;
  color: #444444;
}
.confirm-btn.cancel:active {
  background: #f5f6f8;
}
.token-confirm-btn {
  background: #ffffff;
  color: var(--theme-color, #1890ff);
  font-weight: 600;
}
.token-confirm-btn:active {
  background: #f5f6f8;
}
.token-preview-overlay {
  z-index: 10001;
}
.token-preview-modal {
  width: min(84%, 380px);
  max-width: 380px;
  max-height: 76vh;
  background: #ffffff !important;
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
}
.token-preview-meta {
  padding: 8px 20px 0;
  color: #8c8c8c;
  text-align: center;
  font-size: 10px;
}
.token-preview-reason {
  margin: 12px 16px 0;
  padding: 10px 12px;
  color: #555555;
  background: #f7f8fa;
  border: 1px solid #eeeff2;
  border-radius: 8px;
  font-size: 10px;
  line-height: 1.5;
}
.token-preview-text {
  margin: 10px 16px 16px;
  padding: 12px;
  overflow: auto;
  color: #111111;
  background: #fafbfc;
  border: 1px solid #eef0f3;
  border-radius: 8px;
  font-family: inherit;
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
@media (max-width: 380px) {
  .token-stats-modal { width: 95%; }
  .token-modal-body { padding-left: 12px; padding-right: 12px; }
}
</style>
