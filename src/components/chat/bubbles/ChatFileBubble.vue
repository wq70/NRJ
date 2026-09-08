/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { CharacterAssetMeta } from '../../../types/chatAssets'
import { downloadCharacterAsset } from '../../../services/chatAssetOpen'
import { getChatFilePreviewCapability } from '../../../services/chatFilePreview'
import ChatFilePreviewModal from '../modals/ChatFilePreviewModal.vue'

const props = defineProps<{
  msg: any
  asset?: CharacterAssetMeta | null
  direction?: 'left' | 'right'
  sender?: any
  selectedChat?: any
  myProfile?: any
}>()

const busy = ref(false)
const error = ref('')
const previewVisible = ref(false)
const actionVisible = ref(false)
const actionDialog = ref<HTMLElement | null>(null)
const file = computed(() => props.asset || null)
const previewCapability = computed(() => file.value ? getChatFilePreviewCapability(file.value) : { supported: false, label: '文件' })
const nativePlatform = Capacitor.isNativePlatform()

// 1. 发送者（传递者）：优先显示备注，无备注显示真名
const senderDisplayName = computed(() => {
  if (props.direction === 'right') {
    return props.myProfile?.remark?.trim() || props.myProfile?.name?.trim() || '我'
  }
  return props.sender?.remark?.trim() || props.sender?.realName?.trim() || props.sender?.name?.trim() || props.selectedChat?.remark?.trim() || props.selectedChat?.realName?.trim() || props.selectedChat?.name?.trim() || '对方'
})

// 2. 接收者（TO 目标）：优先显示备注，无备注显示真名
const targetDisplayName = computed(() => {
  if (props.direction === 'right') {
    return props.selectedChat?.remark?.trim() || props.selectedChat?.realName?.trim() || props.selectedChat?.name?.trim() || '对方'
  }
  return props.myProfile?.remark?.trim() || props.myProfile?.name?.trim() || '我'
})

const sizeText = computed(() => {
  const size = Number(props.msg?.fileData?.size || file.value?.size || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
})

const extension = computed(() => {
  const name = String(props.msg?.fileData?.name || file.value?.name || 'FILE')
  const ext = name.split('.').pop()?.slice(0, 5).toUpperCase()
  return ext && ext !== name.toUpperCase() ? ext : 'FILE'
})

const extColorTheme = computed(() => {
  const ext = extension.value.toLowerCase()
  if (['pdf'].includes(ext)) return { bg: '#fff1f2', text: '#e11d48', darkBg: '#4c0519', darkText: '#fb7185' }
  if (['doc', 'docx', 'wps'].includes(ext)) return { bg: '#eff6ff', text: '#2563eb', darkBg: '#172554', darkText: '#60a5fa' }
  if (['xls', 'xlsx', 'csv'].includes(ext)) return { bg: '#f0fdf4', text: '#16a34a', darkBg: '#14532d', darkText: '#4ade80' }
  if (['ppt', 'pptx'].includes(ext)) return { bg: '#fff7ed', text: '#ea580c', darkBg: '#431407', darkText: '#fb923c' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { bg: '#fffbeb', text: '#d97706', darkBg: '#451a03', darkText: '#fbbf24' }
  if (['txt', 'md', 'json', 'log'].includes(ext)) return { bg: '#f8fafc', text: '#64748b', darkBg: '#1e293b', darkText: '#94a3b8' }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return { bg: '#faf5ff', text: '#9333ea', darkBg: '#3b0764', darkText: '#c084fc' }
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return { bg: '#eef2ff', text: '#4f46e5', darkBg: '#1e1b4b', darkText: '#818cf8' }
  return { bg: '#f8fafc', text: '#64748b', darkBg: '#1e293b', darkText: '#94a3b8' }
})

const saveFile = async () => {
  if (!file.value || busy.value) return
  busy.value = true; error.value = ''
  try { await downloadCharacterAsset(file.value); actionVisible.value = false } catch (reason) { error.value = reason instanceof Error ? reason.message : '文件无法保存' }
  finally { busy.value = false }
}

const openActions = () => {
  if (!file.value) return
  error.value = ''; actionVisible.value = true
  void nextTick(() => actionDialog.value?.focus())
}

const previewFile = () => {
  if (!file.value || !previewCapability.value.supported) return
  actionVisible.value = false; previewVisible.value = true
}
</script>

<template>
  <div class="chat-file-card" :class="[direction || 'left', { unavailable: !file }]">
    <!-- 顶部传输信息栏 -->
    <div class="chat-file-header">
      <div class="chat-file-to">
        <span class="to-label">TO:</span>
        <span class="to-name">{{ targetDisplayName }}</span>
      </div>
      <div class="chat-file-transfer-desc">
        <svg class="transfer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
          <polyline points="13 2 13 9 20 9"></polyline>
        </svg>
        <span>{{ senderDisplayName }} 传递了一个文件</span>
      </div>
    </div>

    <div class="chat-file-divider"></div>

    <!-- 文件主体内容 -->
    <div class="chat-file-body" @click.stop="openActions">
      <div
        class="chat-file-badge"
        :style="{
          '--ext-bg': extColorTheme.bg,
          '--ext-color': extColorTheme.text,
          '--ext-dark-bg': extColorTheme.darkBg,
          '--ext-dark-color': extColorTheme.darkText
        }"
      >
        <span class="badge-fold"></span>
        <span class="badge-text">{{ extension }}</span>
      </div>

      <div class="chat-file-info">
        <div class="chat-file-name" :title="msg.fileData?.name">{{ msg.fileData?.name || '未命名文件' }}</div>
        <div class="chat-file-meta">
          <span class="meta-size">{{ sizeText }}</span>
          <span v-if="msg.fileData?.source === 'generated'" class="meta-tag">角色生成</span>
        </div>
        <div v-if="error" class="chat-file-error">{{ error }}</div>
      </div>

      <button class="chat-file-action-btn" type="button" :disabled="!file" @click.stop="openActions">
        <span>{{ file ? '查看' : '已失效' }}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="actionVisible" class="chat-file-action-overlay" @click.self="actionVisible = false">
      <section ref="actionDialog" class="chat-file-action-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-file-action-title" tabindex="-1" @keydown.esc="actionVisible = false">
        <header>
          <div class="dialog-icon" :style="{ '--ext-bg': extColorTheme.bg, '--ext-color': extColorTheme.text, '--ext-dark-bg': extColorTheme.darkBg, '--ext-dark-color': extColorTheme.darkText }">
            {{ extension }}
          </div>
          <div class="dialog-header-text">
            <h3 id="chat-file-action-title" :title="msg.fileData?.name">{{ msg.fileData?.name || '文件' }}</h3>
            <p>{{ sizeText }}<span v-if="msg.fileData?.source === 'generated'"> · 角色生成</span></p>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭" @click="actionVisible = false">×</button>
        </header>
        <div class="chat-file-action-choices">
          <button type="button" class="choice-card" :disabled="!previewCapability.supported" @click="previewFile">
            <div class="choice-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <strong>应用内预览</strong>
            </div>
            <span>{{ previewCapability.supported ? `在应用内直接查看 ${previewCapability.label}` : previewCapability.reason }}</span>
          </button>
          <button type="button" class="choice-card" :disabled="busy" @click="saveFile">
            <div class="choice-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <strong>{{ busy ? '处理中…' : (nativePlatform ? '打开或保存' : '下载原文件') }}</strong>
            </div>
            <span>{{ nativePlatform ? '使用系统面板保存、分享或用其他应用打开' : '保存真实原文件到当前设备' }}</span>
          </button>
        </div>
        <p v-if="error" class="chat-file-action-error">{{ error }}</p>
      </section>
    </div>
  </Teleport>
  <ChatFilePreviewModal :visible="previewVisible" :asset="file" @close="previewVisible = false" />
</template>

<style scoped>
.chat-file-card {
  width: min(242px, 68vw);
  border-radius: 12px;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
  color: var(--text-primary, #1e293b);
  box-sizing: border-box;
  overflow: hidden;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  user-select: none;
}

:global(.dark-theme) .chat-file-card,
:global([data-theme="dark"]) .chat-file-card {
  background: var(--bg-secondary, #1e222d);
  border-color: rgba(255, 255, 255, 0.08);
}

.chat-file-card.unavailable {
  opacity: 0.65;
}

/* 顶部传输元信息 */
.chat-file-header {
  padding: 7px 11px 6px;
  display: flex;
  flex-direction: column;
  gap: 2.5px;
  background: transparent;
}

.chat-file-to {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 1.25;
}

.to-label {
  font-weight: 750;
  letter-spacing: 0.4px;
  color: var(--theme-color, #3b82f6);
  font-size: 10px;
}

.to-name {
  font-weight: 600;
  color: var(--text-primary, #334155);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 155px;
}

.chat-file-transfer-desc {
  display: flex;
  align-items: center;
  gap: 3.5px;
  font-size: 10px;
  color: var(--text-tertiary, #94a3b8);
  line-height: 1.2;
}

.transfer-icon {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  opacity: 0.8;
}

.chat-file-transfer-desc span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-file-divider {
  height: 1px;
  background: var(--border-color, rgba(0, 0, 0, 0.05));
  margin: 0 8px;
}

:global(.dark-theme) .chat-file-divider,
:global([data-theme="dark"]) .chat-file-divider {
  background: rgba(255, 255, 255, 0.06);
}

/* 主体内容 */
.chat-file-body {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.chat-file-body:hover {
  background: rgba(0, 0, 0, 0.015);
}

/* 文件微标 Badge */
.chat-file-badge {
  position: relative;
  width: 32px;
  height: 38px;
  flex: 0 0 32px;
  border-radius: 5px 9px 5px 5px;
  background: var(--ext-bg, #f8fafc);
  color: var(--ext-color, #64748b);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 5px;
  box-sizing: border-box;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

:global(.dark-theme) .chat-file-badge,
:global([data-theme="dark"]) .chat-file-badge {
  background: var(--ext-dark-bg, #1e293b);
  color: var(--ext-dark-color, #94a3b8);
  border-color: rgba(255, 255, 255, 0.06);
}

.badge-fold {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 8px;
  background: rgba(0, 0, 0, 0.06);
  border-bottom-left-radius: 3px;
  border-top-right-radius: 8px;
}

:global(.dark-theme) .badge-fold,
:global([data-theme="dark"]) .badge-fold {
  background: rgba(255, 255, 255, 0.1);
}

.badge-text {
  font-size: 8.5px;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
}

/* 文件信息 */
.chat-file-info {
  flex: 1;
  min-width: 0;
}

.chat-file-name {
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-primary, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-file-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--text-tertiary, #94a3b8);
  margin-top: 2.5px;
}

.meta-size {
  line-height: 1;
}

.meta-tag {
  font-size: 9px;
  padding: 0.5px 4px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.04);
  color: var(--text-secondary, #64748b);
  line-height: 1.2;
}

:global(.dark-theme) .meta-tag,
:global([data-theme="dark"]) .meta-tag {
  background: rgba(255, 255, 255, 0.07);
}

.chat-file-error {
  font-size: 9.5px;
  color: #ef4444;
  margin-top: 2px;
}

/* 查看按钮 */
.chat-file-action-btn {
  display: flex;
  align-items: center;
  gap: 1.5px;
  padding: 4px 7px;
  border-radius: 6px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-secondary, #f8fafc);
  color: var(--text-primary, #334155);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

:global(.dark-theme) .chat-file-action-btn,
:global([data-theme="dark"]) .chat-file-action-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

.chat-file-action-btn svg {
  width: 10px;
  height: 10px;
  opacity: 0.65;
  transition: transform 0.15s ease;
}

.chat-file-action-btn:hover:not(:disabled) {
  background: var(--sys-bg-secondary, #f1f5f9);
  transform: translateX(1px);
}

.chat-file-action-btn:hover:not(:disabled) svg {
  transform: translateX(1px);
}

.chat-file-action-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* 弹窗样式 */
.chat-file-action-overlay {
  position: fixed;
  inset: 0;
  z-index: 13015;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(12, 12, 14, 0.45);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-sizing: border-box;
  animation: modal-fade-in 0.18s ease-out;
}

@keyframes modal-fade-in {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}

.chat-file-action-dialog {
  box-sizing: border-box;
  width: min(320px, calc(100vw - 32px));
  outline: 0;
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
  border-radius: 16px;
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  color: var(--text-primary, #1e293b);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.22);
}

.chat-file-action-dialog header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.dialog-icon {
  width: 32px;
  height: 38px;
  flex: 0 0 32px;
  border-radius: 5px;
  background: var(--ext-bg, #f8fafc);
  color: var(--ext-color, #64748b);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 800;
}

:global(.dark-theme) .dialog-icon,
:global([data-theme="dark"]) .dialog-icon {
  background: var(--ext-dark-bg, #1e293b);
  color: var(--ext-dark-color, #94a3b8);
}

.dialog-header-text {
  flex: 1;
  min-width: 0;
}

.dialog-header-text h3 {
  margin: 0;
  font-size: 13.5px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dialog-header-text p {
  margin: 2px 0 0;
  font-size: 10.5px;
  color: var(--text-secondary, #64748b);
}

.dialog-close {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 50%;
  font-size: 18px;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-close:hover {
  background: var(--bg-secondary, rgba(0, 0, 0, 0.05));
}

.chat-file-action-choices {
  display: grid;
  gap: 8px;
  padding: 12px;
}

.choice-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
  color: var(--text-primary, #1e293b);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.choice-card:hover:not(:disabled) {
  background: var(--sys-bg-secondary, rgba(0, 0, 0, 0.04));
  border-color: var(--theme-color, #3b82f6);
}

.choice-card:disabled {
  opacity: 0.45;
  cursor: default;
}

.choice-title {
  display: flex;
  align-items: center;
  gap: 5px;
}

.choice-title svg {
  width: 13px;
  height: 13px;
  color: var(--theme-color, #3b82f6);
}

.choice-title strong {
  font-size: 12.5px;
  font-weight: 650;
}

.choice-card span {
  font-size: 10.5px;
  color: var(--text-secondary, #64748b);
  line-height: 1.35;
}

.chat-file-action-error {
  margin: 0;
  padding: 0 12px 10px;
  color: #ef4444;
  font-size: 10.5px;
}

@media (max-width: 360px) {
  .chat-file-card {
    width: min(220px, 66vw);
  }
}
</style>
