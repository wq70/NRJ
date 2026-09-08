/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import { chatSettings } from '../../store'
const emit = defineEmits<{
  (e: 'back'): void
}>()

const currentUrl = ref('edge://chat-appearance')

const handleBack = () => {
  emit('back')
}

const handleRefresh = () => {
  // 模拟刷新动画或不做实际操作
}
</script>

<template>
  <div class="chat-appearance-container">
    <!-- Safari 胶囊药丸风格顶栏 -->
    <header class="safari-header">
      <div class="safari-address-bar">
        <button class="safari-action-btn aa-btn" @click="handleBack" title="返回">
          <span class="aa-text"><sub>A</sub>A</span>
        </button>
        <div class="safari-url-display">
          {{ currentUrl }}
        </div>
        <button class="safari-action-btn refresh-btn" @click="handleRefresh" title="刷新">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- 主体区域：留白、好看 -->
    <main class="appearance-main">
      <div class="appearance-settings-list">
        <div class="setting-item">
          <div class="setting-info">
            <div class="setting-title">顶栏右键菜单</div>
            <div class="setting-desc">开启后，在聊天页顶部导航栏右键可唤出快捷菜单。</div>
          </div>
          <label class="switch">
            <input type="checkbox" v-model="chatSettings.showTopBarContextMenu" />
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-appearance-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--sys-bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  z-index: 100;
  overflow: hidden;
}

/* Safari 胶囊药丸风格顶栏 */
.safari-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: #ffffff;
  padding-top: calc(10px + env(safe-area-inset-top, 20px));
}

.safari-address-bar {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f1f2f4;
  border-radius: 14px;
  height: 42px;
  padding: 0 10px;
  position: relative;
  transition: background-color 0.2s;
}

.safari-action-btn {
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3c3c43;
  cursor: pointer;
  height: 32px;
  min-width: 32px;
  padding: 0 4px;
  border-radius: 8px;
  user-select: none;
  transition: opacity 0.15s;
}

.safari-action-btn:active {
  opacity: 0.5;
}

.aa-btn {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
  font-weight: 500;
  letter-spacing: -0.5px;
}

.aa-text {
  font-size: 15px;
  line-height: 1;
  display: inline-flex;
  align-items: baseline;
}

.aa-text sub {
  font-size: 11px;
  bottom: 0;
  margin-right: 1px;
}

.safari-url-display {
  flex: 1;
  text-align: center;
  font-size: 14px;
  color: #1c1c1e;
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 8px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif;
}

.refresh-btn {
  color: #8e8e93;
}

/* 主体区域 */
.appearance-main {
  flex: 1;
  background: #ffffff;
  padding: 24px 16px;
}

.appearance-settings-list {
  background: #ffffff;
  border-radius: 12px;
  padding: 0 16px;
  border: 1px solid #f0f0f0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid #f5f5f5;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-item.clickable {
  cursor: pointer;
}

.setting-item.clickable:active {
  opacity: 0.7;
}

.setting-arrow {
  color: var(--text-tertiary, #999999);
  display: flex;
  align-items: center;
}

.setting-info {
  flex: 1;
  padding-right: 16px;
}

.setting-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #333333);
  margin-bottom: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-tertiary, #999999);
  line-height: 1.4;
}

/* Switch 样式 */
.switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #e5e5e5;
  transition: .3s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .3s;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.bm-select {
  padding: 6px 10px;
  border: 1px solid var(--border-color, #e5e5e5);
  border-radius: 8px;
  background: var(--sys-bg-secondary, #f8f9fa);
  color: var(--text-primary, #333333);
  font-size: 14px;
  outline: none;
}

input:checked + .slider {
  background-color: #007aff;
}

input:checked + .slider:before {
  transform: translateX(20px);
}
</style>
