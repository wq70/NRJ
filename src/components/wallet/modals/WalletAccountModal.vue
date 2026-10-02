/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
<script setup lang="ts">
import type { ChatAccount } from '../../../composables/useChatAuth'
defineProps<{ accounts: ChatAccount[]; accountId: string }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'select', id: string): void }>()
</script>

<template>
  <div class="w-modal-backdrop" @click.self="emit('close')">
    <section class="w-modal-container wallet-account-modal" aria-label="切换金库账户席位">
      <header class="w-modal-header">
        <div class="w-modal-title-group">
          <span class="w-modal-cn-title">金库席位密钥切换</span>
          <span class="w-modal-en-sub">SEAT SELECTION</span>
        </div>
        <button class="w-modal-close-btn" @click="emit('close')">✕</button>
      </header>

      <div class="w-modal-body">
        <p class="account-note">❖ 切换金库私享席位仅变更资金账册与证券持仓，聊天与社交身份保持不变。</p>
        
        <div class="account-list-wrap">
          <button 
            v-for="account in accounts" 
            :key="account.id" 
            type="button" 
            class="wallet-account-row" 
            :class="{ active: account.id === accountId }" 
            @click="emit('select', account.id)"
          >
            <div class="account-avatar-frame">
              <img v-if="account.avatarUrl" :src="account.avatarUrl" alt="" class="account-avatar-img" />
              <span v-else class="account-avatar-text">{{ account.name?.slice(0, 1) || 'V' }}</span>
            </div>

            <div class="account-label">
              <div class="account-name-row">
                <strong class="account-name">{{ account.name || '未命名私享客户' }}</strong>
                <span v-if="account.id === accountId" class="active-badge">CURRENT SEAT</span>
              </div>
              <small class="account-id-tag">SEAT IDENTIFIER: #{{ account.accountId || account.id }}</small>
            </div>

            <div class="account-chevron-col">
              <span class="account-chevron">{{ account.id === accountId ? '◆' : '›' }}</span>
            </div>
          </button>
        </div>

        <p v-if="!accounts.length" class="account-note empty-note">金库尚未检测到其他席位档案，请先在终端建立用户。</p>
      </div>

      <div class="w-modal-footer">
        <button class="w-btn-secondary" @click="emit('close')">关闭</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.wallet-account-modal {
  max-height: calc(100dvh - 40px);
}
.account-note {
  font-family: var(--w-serif-cn);
  font-size: 11px;
  line-height: 1.6;
  color: var(--w-text-muted);
  margin: 0 0 16px 0;
  padding: 8px 10px;
  background: rgba(223, 184, 108, 0.05);
  border-left: 2px solid var(--w-accent-gold);
}
.empty-note {
  border-left-color: var(--w-text-muted);
  text-align: center;
}
.account-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border: 1px solid var(--w-border);
  background-color: var(--w-border-light);
}
.wallet-account-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: none;
  background-color: var(--w-surface);
  cursor: pointer;
  color: var(--w-text-main);
  text-align: left;
  transition: all 0.2s ease;
}
.wallet-account-row:hover {
  background-color: var(--w-surface-active);
}
.wallet-account-row.active {
  background: linear-gradient(90deg, rgba(223, 184, 108, 0.12) 0%, var(--w-surface) 100%);
  border-left: 2px solid var(--w-accent-gold);
}
.account-avatar-frame {
  width: 32px;
  height: 32px;
  border: 1px solid var(--w-border);
  background: #0A0B0E;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.wallet-account-row.active .account-avatar-frame {
  border-color: var(--w-accent-gold);
}
.account-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.account-avatar-text {
  font-family: var(--w-serif-en);
  font-size: 12px;
  font-weight: 700;
  color: var(--w-accent-gold);
}
.account-label {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.account-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.account-name {
  font-family: var(--w-serif-cn);
  font-size: 13px;
  font-weight: 600;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.active-badge {
  font-family: var(--w-num-font);
  font-size: 8px;
  color: var(--w-accent-gold);
  border: 1px solid var(--w-border);
  padding: 1px 4px;
}
.account-id-tag {
  font-family: var(--w-num-font);
  font-size: 9px;
  color: var(--w-text-muted);
  letter-spacing: 0.5px;
}
.account-chevron-col {
  flex-shrink: 0;
}
.account-chevron {
  font-size: 14px;
  color: var(--w-accent-gold);
}
</style>
