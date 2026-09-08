<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Capacitor } from '@capacitor/core'
import type { CharacterAssetMeta } from '../../../types/chatAssets'
import { downloadCharacterAsset } from '../../../services/chatAssetOpen'
import { getChatFilePreviewCapability, loadChatFilePreview, revokeChatFilePreview, type ChatFilePreviewResult } from '../../../services/chatFilePreview'

const props = defineProps<{ visible: boolean; asset: CharacterAssetMeta | null }>()
const emit = defineEmits<{ (event: 'close'): void }>()
const preview = ref<ChatFilePreviewResult | null>(null)
const loading = ref(false)
const saving = ref(false)
const copied = ref(false)
const error = ref('')
const forceLargePreview = ref(false)
const LARGE_FILE_BYTES = 20 * 1024 * 1024
const nativePlatform = Capacitor.isNativePlatform()
const capability = computed(() => props.asset ? getChatFilePreviewCapability(props.asset) : { supported: false, label: '文件' })
const needsLargeConfirmation = computed(() => Boolean(props.asset && props.asset.size > LARGE_FILE_BYTES && !forceLargePreview.value))

const sizeText = computed(() => {
  const size = Number(props.asset?.size || 0)
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
})

const fileExt = computed(() => {
  const name = props.asset?.name || ''
  const dotIndex = name.lastIndexOf('.')
  return dotIndex > -1 ? name.slice(dotIndex + 1).toUpperCase() : 'DOC'
})


const textStats = computed(() => {
  if (preview.value?.text === undefined) return null
  const str = preview.value.text
  const lines = str.length ? str.split('\n').length : 0
  const chars = str.length
  return { lines, chars }
})

const clearPreview = () => { revokeChatFilePreview(preview.value); preview.value = null }
const load = async (sheetIndex = 0) => {
  clearPreview(); error.value = ''
  if (!props.visible || !props.asset || needsLargeConfirmation.value || !capability.value.supported) return
  loading.value = true
  try { preview.value = await loadChatFilePreview(props.asset, sheetIndex) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '文件预览失败' }
  finally { loading.value = false }
}
const confirmLargePreview = () => { forceLargePreview.value = true; void load() }
const switchSheet = (index: number) => { if (index !== preview.value?.activeSheetIndex) void load(index) }

const copyText = async () => {
  if (preview.value?.text === undefined || copied.value) return
  try {
    await navigator.clipboard.writeText(preview.value.text)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback
  }
}

const save = async () => {
  if (!props.asset || saving.value) return
  saving.value = true
  try { await downloadCharacterAsset(props.asset) }
  catch (reason) { error.value = reason instanceof Error ? reason.message : '文件无法保存' }
  finally { saving.value = false }
}
const close = () => emit('close')
const onKeydown = (event: KeyboardEvent) => { if (props.visible && event.key === 'Escape') close() }

watch(() => [props.visible, props.asset?.id] as const, ([visible]) => {
  forceLargePreview.value = false
  copied.value = false
  window.removeEventListener('keydown', onKeydown)
  if (visible) { window.addEventListener('keydown', onKeydown); void load() }
  else clearPreview()
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKeydown); clearPreview() })
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="file-preview-overlay" role="presentation" @click.self="close">
      <section class="file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="file-preview-title">
        <!-- 顶栏 -->
        <header class="file-preview-header">
          <button class="file-preview-back" type="button" aria-label="关闭预览" @click="close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>

          <div class="file-preview-title-wrap">
            <div class="file-title-row">
              <h3 id="file-preview-title" :title="asset?.name">{{ asset?.name || '文件预览' }}</h3>
              <span class="file-type-pill">{{ fileExt }}</span>
            </div>
            <p class="file-meta-sub">{{ capability.label }} · {{ sizeText }}</p>
          </div>

          <div class="header-actions">
            <button
              v-if="preview?.text !== undefined"
              class="file-preview-btn-ghost"
              type="button"
              :class="{ 'is-copied': copied }"
              @click="copyText"
              title="复制全部内容"
            >
              <svg v-if="!copied" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <svg v-else viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>{{ copied ? '已复制' : '复制' }}</span>
            </button>

            <button class="file-preview-save" type="button" :disabled="!asset || saving" @click="save">
              <svg v-if="!saving" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>{{ saving ? '处理中…' : (nativePlatform ? '保存' : '下载') }}</span>
            </button>
          </div>
        </header>

        <!-- 表格工作表切换 -->
        <nav v-if="preview?.kind === 'xlsx' && (preview.sheetNames?.length || 0) > 1" class="file-preview-sheets" aria-label="工作表">
          <button v-for="(name, index) in preview.sheetNames" :key="`${index}-${name}`" type="button" :class="{ active: index === preview.activeSheetIndex }" @click="switchSheet(index)">
            {{ name }}
          </button>
        </nav>

        <!-- 主预览内容体 -->
        <main class="file-preview-body" :class="preview ? `kind-${preview.kind}` : ''">
          <div v-if="needsLargeConfirmation" class="file-preview-state card-state">
            <div class="state-icon warning-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <strong>文件较大需确认</strong>
            <p>文件大小为 {{ sizeText }}，完整渲染可能需要一定内存。你也可以直接下载原文件。</p>
            <div class="state-actions">
              <button class="action-btn primary" type="button" @click="confirmLargePreview">继续预览</button>
              <button class="action-btn ghost" type="button" @click="save">直接下载</button>
            </div>
          </div>

          <div v-else-if="!capability.supported" class="file-preview-state card-state">
            <div class="state-icon info-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </div>
            <strong>暂不支持直接预览</strong>
            <p>{{ capability.reason }}</p>
            <button class="action-btn primary" type="button" @click="save">{{ saving ? '处理中' : (nativePlatform ? '打开或保存' : '下载原文件') }}</button>
          </div>

          <div v-else-if="loading" class="file-preview-state">
            <span class="file-preview-spinner"></span>
            <p>正在读取与排版文件内容…</p>
          </div>

          <div v-else-if="error" class="file-preview-state error card-state">
            <div class="state-icon error-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            </div>
            <strong>预览加载失败</strong>
            <p>{{ error }}</p>
            <button class="action-btn ghost" type="button" @click="load(preview?.activeSheetIndex || 0)">重新加载</button>
          </div>

          <!-- 文本预览阅读器 -->
          <div v-else-if="preview?.text !== undefined" class="text-reader-container">
            <div class="text-paper-card">
              <pre class="file-preview-text">{{ preview.text }}</pre>
            </div>
            <div v-if="textStats" class="text-meta-footer">
              <span>{{ textStats.lines }} 行</span>
              <span class="meta-dot">·</span>
              <span>{{ textStats.chars }} 字符</span>
              <span class="meta-dot">·</span>
              <span>UTF-8</span>
            </div>
          </div>

          <!-- 表格预览 -->
          <div v-else-if="preview?.rows" class="file-preview-table-wrap">
            <div class="table-card">
              <table class="file-preview-table">
                <tbody>
                  <tr v-for="(row, rowIndex) in preview.rows" :key="rowIndex" :class="{ 'row-header': rowIndex === 0 }">
                    <component :is="rowIndex === 0 ? 'th' : 'td'" v-for="(cell, cellIndex) in row" :key="cellIndex" :title="cell">
                      {{ cell }}
                    </component>
                  </tr>
                </tbody>
              </table>
            </div>
            <p v-if="preview.truncated" class="file-preview-limit">仅展示前 300 行、60 列；下载原文件可查看完整内容。</p>
          </div>

          <iframe v-else-if="preview?.kind === 'pdf' && preview.objectUrl" class="file-preview-frame" :src="preview.objectUrl" title="PDF 文件预览"></iframe>
          <div v-else-if="preview?.kind === 'image' && preview.objectUrl" class="file-preview-media-box">
            <img class="file-preview-image" :src="preview.objectUrl" :alt="asset?.name || '图片预览'">
          </div>
          <div v-else-if="preview?.kind === 'audio' && preview.objectUrl" class="file-preview-media-box">
            <div class="audio-player-card">
              <audio class="file-preview-audio" :src="preview.objectUrl" controls preload="metadata"></audio>
            </div>
          </div>
          <div v-else-if="preview?.kind === 'video' && preview.objectUrl" class="file-preview-media-box video-box">
            <video class="file-preview-video" :src="preview.objectUrl" controls playsinline preload="metadata"></video>
          </div>
        </main>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.file-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 13020;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-sizing: border-box;
}

.file-preview-modal {
  width: min(880px, 94vw);
  height: min(780px, 88vh);
  min-height: 420px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 20px;
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  color: var(--text-primary, #1e293b);
  box-shadow: 0 25px 60px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1);
  animation: modal-fade-scale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modal-fade-scale {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

/* 顶栏 */
.file-preview-header {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.file-preview-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 50%;
  background: var(--sys-bg-secondary, #f8fafc);
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.file-preview-back:hover {
  background: var(--border-color, rgba(0, 0, 0, 0.08));
  color: var(--text-primary, #0f172a);
}

.file-preview-title-wrap {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.file-preview-title-wrap h3 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--text-primary, #0f172a);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.file-type-pill {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.4px;
  background: var(--sys-bg-secondary, rgba(0, 0, 0, 0.05));
  color: var(--text-secondary, #64748b);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.file-meta-sub {
  margin: 0;
  color: var(--text-secondary, #8c9ba8);
  font-size: 11px;
  line-height: 1.3;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.file-preview-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--sys-bg-secondary, #f8fafc);
  color: var(--text-secondary, #475569);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.file-preview-btn-ghost:hover {
  background: var(--border-color, rgba(0, 0, 0, 0.06));
  color: var(--text-primary, #0f172a);
}

.file-preview-btn-ghost.is-copied {
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.25);
  color: #059669;
}

/* 低调高级曜石深灰胶囊按钮，不使用刺眼蓝 */
.file-preview-save {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: #1e293b;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 5px rgba(15, 23, 42, 0.12);
  transition: all 0.15s ease;
}

.file-preview-save:hover {
  background: #0f172a;
  box-shadow: 0 3px 8px rgba(15, 23, 42, 0.2);
}

.file-preview-save:disabled {
  opacity: 0.45;
  cursor: default;
  box-shadow: none;
}

/* Sheets 标签页 */
.file-preview-sheets {
  display: flex;
  flex: none;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 16px;
  background: var(--sys-bg-secondary, var(--bg-secondary, #f8fafc));
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  scrollbar-width: thin;
}

.file-preview-sheets button {
  max-width: 180px;
  flex: none;
  overflow: hidden;
  padding: 6px 12px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary, #64748b);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.file-preview-sheets button.active {
  border-color: var(--border-color, rgba(0, 0, 0, 0.08));
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  color: var(--text-primary, #0f172a);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

/* 预览主体容器 */
.file-preview-body {
  min-width: 0;
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  background: var(--sys-bg-secondary, var(--bg-secondary, #f4f6f8));
}

/* 文本阅读器 */
.text-reader-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 16px;
  box-sizing: border-box;
}

.text-paper-card {
  flex: 1;
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  padding: 24px 28px;
  overflow: auto;
  box-sizing: border-box;
}

.file-preview-text {
  margin: 0;
  padding: 0;
  color: var(--text-primary, #1e293b);
  /* 现代舒适的高质量中英文阅读字体栈 */
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
  font-size: 14.5px;
  line-height: 1.85;
  letter-spacing: 0.2px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 4;
  -webkit-font-smoothing: antialiased;
}

.text-meta-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  padding: 10px 8px 2px;
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
}

.meta-dot {
  opacity: 0.5;
}

/* 表格预览 */
.file-preview-table-wrap {
  flex: 1;
  padding: 16px;
  overflow: auto;
  box-sizing: border-box;
}

.table-card {
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.file-preview-table {
  border-spacing: 0;
  border-collapse: separate;
  width: 100%;
  font-size: 12.5px;
}

.file-preview-table th,
.file-preview-table td {
  max-width: 280px;
  padding: 10px 14px;
  border-right: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--sys-bg-secondary, var(--bg-secondary, #f8fafc));
  font-weight: 600;
  color: var(--text-primary, #0f172a);
}

.file-preview-table tr:hover td {
  background: rgba(37, 99, 235, 0.02);
}

.file-preview-limit {
  margin: 10px 0 0;
  color: var(--text-secondary, #94a3b8);
  font-size: 11px;
  text-align: center;
}

/* 状态展示 */
.file-preview-state {
  width: min(420px, 86%);
  margin: auto;
  text-align: center;
  color: var(--text-secondary, #64748b);
  padding: 30px 20px;
}

.card-state {
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  border-radius: 16px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
}

.state-icon {
  margin: 0 auto 12px;
  display: inline-flex;
}

.warning-icon { color: #f59e0b; }
.info-icon { color: #3b82f6; }
.error-icon { color: #ef4444; }

.file-preview-state strong {
  display: block;
  margin-bottom: 8px;
  color: var(--text-primary, #0f172a);
  font-size: 16px;
  font-weight: 600;
}

.file-preview-state p {
  margin: 0 auto 18px;
  font-size: 13px;
  line-height: 1.6;
}

.state-actions {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.action-btn {
  padding: 8px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn.primary {
  background: #1e293b;
  color: #fff;
  border: none;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.15);
}

.action-btn.ghost {
  background: var(--sys-bg-secondary, #f1f5f9);
  color: var(--text-primary, #1e293b);
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.file-preview-spinner {
  display: block;
  width: 28px;
  height: 28px;
  margin: 0 auto 12px;
  border: 3px solid rgba(15, 23, 42, 0.12);
  border-top-color: #1e293b;
  border-radius: 50%;
  animation: file-preview-spin 0.8s linear infinite;
}

@keyframes file-preview-spin {
  to { transform: rotate(360deg); }
}

/* 媒体与 PDF */
.file-preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
  background: #fff;
}

.file-preview-media-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.file-preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.audio-player-card {
  background: var(--sys-bg-primary, var(--bg-primary, #ffffff));
  padding: 24px 32px;
  border-radius: 16px;
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.file-preview-audio {
  width: 320px;
}

.video-box {
  background: #000;
  padding: 0;
}

.file-preview-video {
  width: 100%;
  height: 100%;
  background: #000;
  object-fit: contain;
}

/* 移动端适配 */
@media (max-width: 600px) {
  .file-preview-overlay {
    align-items: end;
    padding: 0;
  }
  .file-preview-modal {
    width: 100%;
    height: 94vh;
    border-radius: 20px 20px 0 0;
    border-bottom: 0;
  }
  .file-preview-header {
    padding: calc(14px + env(safe-area-inset-top, 0px)) 16px 14px;
    gap: 10px;
  }
  .text-reader-container {
    padding: 10px;
  }
  .text-paper-card {
    padding: 18px 16px;
  }
  .file-preview-text {
    font-size: 14px;
    line-height: 1.75;
  }
}
</style>
