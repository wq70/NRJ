<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { DeliveryItem } from '../../../types/delivery'
import {
  createDelivery,
  formatDeliverySize,
  shareDelivery,
  validateDeliveryFiles
} from '../../../services/deliveryService'
import DeliveryExpiresModal from './DeliveryExpiresModal.vue'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'success', item: DeliveryItem, message: string): void
  (e: 'notify', message: string): void
}>()

const busy = ref(false)
const showExpiresModal = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const draftFiles = ref<File[]>([])
const draft = reactive({
  title: '',
  note: '',
  text: '',
  url: '',
  expires: 'none'
})

const expiresLabel = computed(() => {
  if (draft.expires.startsWith('custom:')) {
    const raw = draft.expires.replace('custom:', '')
    const unit = raw.slice(-1)
    const num = raw.slice(0, -1)
    const unitText = unit === 'm' ? '分钟' : unit === 'h' ? '小时' : unit === 'd' ? '天' : ''
    return `${num} ${unitText}`
  }
  switch (draft.expires) {
    case '10m': return '10 分钟'
    case '1h': return '1 小时'
    case '1d': return '24 小时'
    default: return '永久有效'
  }
})

const canCreate = computed(() => Boolean(draft.text.trim() || draft.url.trim() || draftFiles.value.length))
const composerSize = computed(() => draftFiles.value.reduce((sum, file) => sum + file.size, 0))

const chooseFiles = () => fileInput.value?.click()

const onFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  const added = [...(input.files || [])]
  input.value = ''
  if (!added.length) return
  try {
    validateDeliveryFiles([...draftFiles.value, ...added])
    draftFiles.value.push(...added)
  } catch (error) {
    emit('notify', error instanceof Error ? error.message : '无法添加这些文件')
  }
}

const removeDraftFile = (index: number) => {
  draftFiles.value.splice(index, 1)
}

const expiresAt = () => {
  if (draft.expires.startsWith('custom:')) {
    const raw = draft.expires.replace('custom:', '')
    const unit = raw.slice(-1)
    const num = parseInt(raw.slice(0, -1), 10) || 1
    if (unit === 'm') return Date.now() + num * 60_000
    if (unit === 'h') return Date.now() + num * 3_600_000
    if (unit === 'd') return Date.now() + num * 86_400_000
  }
  if (draft.expires === '10m') return Date.now() + 600_000
  if (draft.expires === '1h') return Date.now() + 3_600_000
  if (draft.expires === '1d') return Date.now() + 86_400_000
  return undefined
}

const saveDraft = async (action: 'save' | 'share') => {
  if (!canCreate.value || busy.value) return
  busy.value = true
  try {
    const item = await createDelivery({
      title: draft.title,
      note: draft.note,
      text: draft.text,
      url: draft.url,
      files: draftFiles.value,
      direction: 'saved',
      expiresAt: expiresAt()
    })

    let message = '已保存到投递箱'
    if (action === 'share') {
      const result = await shareDelivery(item)
      message = result === 'shared'
        ? '已交给系统分享'
        : result === 'downloaded'
          ? '当前环境不支持文件分享，已下载投递包'
          : '已取消分享'
    }

    emit('success', item, message)
  } catch (error) {
    emit('notify', error instanceof Error ? error.message : '投递创建失败')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="delivery-modal-layer" @click.self="emit('close')">
    <div class="delivery-compose-dialog" role="dialog" aria-modal="true" aria-labelledby="compose-modal-title">
      <!-- 弹窗顶栏 -->
      <header class="compose-header">
        <div class="header-info">
          <h2 id="compose-modal-title">新建投递</h2>
          <p>文字、链接与文件</p>
        </div>
        <button class="close-btn" type="button" aria-label="关闭" @click="emit('close')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </header>

      <!-- 弹窗主体内容滚动区 -->
      <div class="compose-body">
        <section class="compose-form-card">
          <label>
            <span>投递名称</span>
            <input v-model="draft.title" maxlength="100" placeholder="可不填，将自动使用文件名">
          </label>
          <label>
            <span>文字内容</span>
            <textarea v-model="draft.text" maxlength="100000" rows="4" placeholder="写下要接力或分享的内容"></textarea>
          </label>
          <label>
            <span>网址</span>
            <input v-model="draft.url" type="url" inputmode="url" placeholder="https://">
          </label>
          <label>
            <span>附言</span>
            <textarea v-model="draft.note" maxlength="2000" rows="2" placeholder="接收方拆开前可看到"></textarea>
          </label>
        </section>

        <!-- 文件清单 -->
        <section class="compose-form-card">
          <div class="card-action-title">
            <div class="title-meta">
              <b>文件清单</b>
              <small>{{ draftFiles.length ? `${draftFiles.length} 个，共 ${formatDeliverySize(composerSize)}` : '单个不超过 80MB，合计不超过 200MB' }}</small>
            </div>
            <button class="add-file-btn" type="button" @click="chooseFiles">添加文件</button>
          </div>
          <div v-if="draftFiles.length" class="modal-file-list">
            <div v-for="(file, index) in draftFiles" :key="`${file.name}-${index}`" class="modal-file-item">
              <span class="file-info">
                <b>{{ file.name }}</b>
                <small>{{ file.type || '未知类型' }} · {{ formatDeliverySize(file.size) }}</small>
              </span>
              <button class="remove-file-btn" type="button" aria-label="移除文件" @click="removeDraftFile(index)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6L6 18M6 6l12 12" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
            </div>
          </div>
        </section>

        <!-- 有效时间 -->
        <section class="compose-form-card compact-card">
          <div class="modal-select-row" @click="showExpiresModal = true">
            <span class="select-label-wrap">
              <b>有效时间</b>
              <small>过期时间会写入投递包和口令</small>
            </span>
            <button class="custom-select-trigger" type="button" aria-haspopup="dialog">
              <span>{{ expiresLabel }}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
        </section>
      </div>

      <!-- 弹窗底栏操作 -->
      <footer class="compose-footer">
        <button class="secondary-btn" type="button" :disabled="!canCreate || busy" @click="saveDraft('save')">
          存入投递箱
        </button>
        <button class="primary-btn" type="button" :disabled="!canCreate || busy" @click="saveDraft('share')">
          {{ busy ? '处理中…' : '系统分享' }}
        </button>
      </footer>
    </div>

    <!-- 隐藏文件输入框 -->
    <input ref="fileInput" type="file" multiple hidden @change="onFiles">

    <!-- 居中有效时间选择弹窗 -->
    <DeliveryExpiresModal
      v-if="showExpiresModal"
      v-model="draft.expires"
      @close="showExpiresModal = false"
    />
  </div>
</template>

<style scoped>
/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
.delivery-modal-layer {
  position: absolute;
  inset: 0;
  z-index: 125;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  padding: 16px;
  animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.delivery-compose-dialog {
  width: min(520px, calc(100% - 16px));
  max-height: min(780px, calc(100% - 32px));
  display: flex;
  flex-direction: column;
  background: var(--surface-card, #ffffff);
  border-radius: var(--radius-lg, 24px);
  box-shadow: var(--shadow-float, 0 16px 40px -6px rgba(0, 0, 0, 0.18));
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  overflow: hidden;
  animation: scaleIn 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes scaleIn {
  from { transform: scale(0.94); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* 顶栏 */
.compose-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  flex-shrink: 0;
  background: var(--surface-card, #ffffff);
}

.header-info h2 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 600;
  letter-spacing: -0.3px;
  color: var(--text-main, #1d1d1f);
}

.header-info p {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--text-secondary, #86868b);
}

.close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--surface-subtle, #f5f5f7);
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-secondary, #86868b);
  transition: all 0.15s ease;
  padding: 0;
}

.close-btn:hover {
  color: var(--text-main, #1d1d1f);
}

.close-btn:active {
  transform: scale(0.92);
}

.close-btn svg {
  width: 16px;
  height: 16px;
}

/* 滚动区 */
.compose-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  scrollbar-width: thin;
}

.compose-body::-webkit-scrollbar {
  width: 5px;
}

.compose-body::-webkit-scrollbar-thumb {
  background: var(--border-hairline, rgba(0, 0, 0, 0.15));
  border-radius: 4px;
}

.compose-form-card {
  overflow: visible;
  border-top: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  border-bottom: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  padding: 0 4px;
}

.compose-form-card > label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 11px 0;
  border-bottom: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
}

.compose-form-card > label:last-child {
  border-bottom: 0;
}

.compose-form-card label > span {
  color: var(--text-secondary, #86868b);
  font-size: 11.5px;
  font-weight: 500;
}

.compose-form-card input,
.compose-form-card textarea {
  width: 100%;
  resize: none;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-main, #1d1d1f);
  font-size: 14px;
  line-height: 1.5;
  font-family: inherit;
}

.compose-form-card input::placeholder,
.compose-form-card textarea::placeholder {
  color: var(--text-tertiary, #aeaeb2);
}

.card-action-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
}

.title-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.title-meta b {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main, #1d1d1f);
}

.title-meta small {
  overflow: hidden;
  color: var(--text-secondary, #86868b);
  font-size: 10.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-file-btn {
  padding: 6px 14px;
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-pill, 9999px);
  background: var(--surface-subtle, #f5f5f7);
  color: var(--text-main, #1d1d1f);
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-file-btn:active {
  transform: scale(0.95);
}

.modal-file-list {
  border-top: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
}

.modal-file-item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
}

.modal-file-item:last-child {
  border-bottom: 0;
}

.file-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.file-info b {
  overflow: hidden;
  font-size: 12px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-main, #1d1d1f);
}

.file-info small {
  overflow: hidden;
  color: var(--text-secondary, #86868b);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-file-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-subtle, #f5f5f7);
  color: var(--text-secondary, #86868b);
  border: none;
  cursor: pointer;
}

.remove-file-btn svg {
  width: 14px;
  height: 14px;
}

.compact-card {
  overflow: visible;
}

.modal-select-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0;
  border: 0;
}

.select-label-wrap {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.select-label-wrap b {
  color: var(--text-main, #1d1d1f);
  font-size: 13px;
  font-weight: 550;
}

.select-label-wrap small {
  color: var(--text-secondary, #86868b);
  font-size: 10.5px;
}

.custom-select-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-sm, 10px);
  outline: 0;
  background: var(--surface-subtle, #f5f5f7);
  color: var(--text-main, #1d1d1f);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.custom-select-trigger:active {
  transform: scale(0.96);
}

.custom-select-trigger svg {
  width: 13px;
  height: 13px;
  color: var(--text-secondary, #86868b);
}

/* 底栏 */
.compose-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.06));
  background: var(--surface-card, #ffffff);
  flex-shrink: 0;
}

.compose-footer button {
  min-height: 42px;
  border: 1px solid var(--border-hairline, rgba(0, 0, 0, 0.08));
  border-radius: var(--radius-pill, 9999px);
  background: var(--surface-subtle, #f5f5f7);
  color: var(--text-main, #1d1d1f);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.compose-footer button:active:not(:disabled) {
  transform: scale(0.98);
}

.compose-footer .primary-btn {
  background: #1d1d1f;
  color: #ffffff;
  border: none;
}

.dark-mode .compose-footer .primary-btn {
  background: #ffffff;
  color: #000000;
}

.compose-footer button:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
