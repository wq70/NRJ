/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed } from 'vue'
import { chatSettings } from '../../store'

const emit = defineEmits<{
  (e: 'back'): void
}>()

const currentUrl = ref('edge://notification-settings')
const showStyleModal = ref(false)

const handleBack = () => {
  emit('back')
}

const handleRefresh = () => {}

const currentStyleName = computed(() => {
  const style = chatSettings.notificationStyle
  if (style === 'queue') return '排队 (等上一条消失后显示)'
  if (style === 'stack') return '叠放 (消息堆叠在一起)'
  return '列表 (多条消息上下展开)'
})

const selectStyle = (style: 'queue' | 'list' | 'stack') => {
  chatSettings.notificationStyle = style
  setTimeout(() => {
    showStyleModal.value = false
  }, 200)
}
</script>

<template>
  <div class="notification-settings-container">
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

    <!-- 主体区域 -->
    <main class="appearance-main">
      <div class="settings-scroll-view">
        <!-- 分组 1: 消息通知偏好 -->
        <div class="settings-group-card">
          <div class="group-header">
            <span class="group-title">消息通知</span>
            <span class="group-tag">聊天消息</span>
          </div>

          <div class="appearance-settings-list">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-title">消息弹窗通知</div>
                <div class="setting-desc">当不在聊天室内时，收到新消息会在屏幕顶部弹出通知</div>
              </div>
              <label class="switch">
                <input type="checkbox" v-model="chatSettings.enableGlobalNotification" />
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-item clickable" v-if="chatSettings.enableGlobalNotification" @click="showStyleModal = true">
              <div class="setting-info">
                <div class="setting-title">通知展示方式</div>
                <div class="setting-desc">{{ currentStyleName }}</div>
              </div>
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-tertiary, #999);"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            <div class="setting-item" v-if="chatSettings.enableGlobalNotification">
              <div class="setting-info">
                <div class="setting-title">聊天室内通知</div>
                <div class="setting-desc">当停留在当前聊天室内时，收到该聊天对象的新消息也弹出通知</div>
              </div>
              <label class="switch">
                <input type="checkbox" v-model="chatSettings.enableNotificationInChat" />
                <span class="slider"></span>
              </label>
            </div>
          </div>
        </div>

        <!-- 分组 2: 好友申请通知偏好（新增独立模块） -->
        <div class="settings-group-card">
          <div class="group-header">
            <span class="group-title">好友申请通知</span>
            <span class="group-tag primary">角色关系</span>
          </div>

          <div class="appearance-settings-list">
            <div class="setting-item">
              <div class="setting-info">
                <div class="setting-title">开启好友申请通知</div>
                <div class="setting-desc">当角色主动向你发起好友申请时，弹出即时提醒</div>
              </div>
              <label class="switch">
                <input type="checkbox" v-model="chatSettings.enableFriendRequestNotification" />
                <span class="slider"></span>
              </label>
            </div>

            <div class="setting-item radio-group-item" v-if="chatSettings.enableFriendRequestNotification">
              <div class="setting-info">
                <div class="setting-title">申请提醒形式</div>
                <div class="setting-desc">选择收到角色好友申请时的弹窗交互风格</div>
              </div>

              <div class="radio-options">
                <!-- 方案 A: 顶部横幅 -->
                <label
                  class="radio-card"
                  :class="{ active: chatSettings.friendRequestNotificationStyle === 'banner' }"
                  @click="chatSettings.friendRequestNotificationStyle = 'banner'"
                >
                  <div class="radio-card-left">
                    <div class="radio-circle"></div>
                    <div class="radio-card-text">
                      <strong>方案 A：顶部横幅通知</strong>
                      <p>从屏幕顶部轻量滑出通知，点击直接跳转至好友申请页面</p>
                    </div>
                  </div>
                  <span class="scheme-pill">轻量</span>
                </label>

                <!-- 方案 B: 居中美化弹窗 -->
                <label
                  class="radio-card"
                  :class="{ active: chatSettings.friendRequestNotificationStyle === 'modal' }"
                  @click="chatSettings.friendRequestNotificationStyle = 'modal'"
                >
                  <div class="radio-card-left">
                    <div class="radio-circle"></div>
                    <div class="radio-card-text">
                      <strong>方案 B：居中美化弹窗</strong>
                      <p>居中弹出申请卡片，展示角色头像与留言，可直接快速同意或拒绝</p>
                    </div>
                  </div>
                  <span class="scheme-pill highlight">推荐</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 通知展示方式选择弹窗 -->
    <div class="modal-overlay" v-if="showStyleModal" @click="showStyleModal = false">
      <div class="style-modal" @click.stop>
        <div class="style-modal-header">
          <h3>显示为</h3>
          <button class="close-btn" @click="showStyleModal = false">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <div class="style-options-container" style="justify-content: center; gap: 20px;">
          <!-- 排队 -->
          <div class="style-option" :class="{ active: chatSettings.notificationStyle === 'queue' }" @click="selectStyle('queue')">
            <div class="phone-mockup">
              <div class="mockup-time">09:41</div>
              <div class="mockup-notch"></div>
              <div class="mockup-content count">
                <div class="mockup-block"></div>
              </div>
            </div>
            <div class="style-name">排队</div>
          </div>

          <!-- 叠放 -->
          <div class="style-option" :class="{ active: chatSettings.notificationStyle === 'stack' }" @click="selectStyle('stack')">
            <div class="phone-mockup">
              <div class="mockup-time">09:41</div>
              <div class="mockup-notch"></div>
              <div class="mockup-content stack">
                <div class="mockup-block block-3"></div>
                <div class="mockup-block block-2"></div>
                <div class="mockup-block block-1"></div>
              </div>
            </div>
            <div class="style-name">叠放</div>
          </div>
          
          <!-- 列表 -->
          <div class="style-option" :class="{ active: chatSettings.notificationStyle === 'list' }" @click="selectStyle('list')">
            <div class="phone-mockup">
              <div class="mockup-time">09:41</div>
              <div class="mockup-notch"></div>
              <div class="mockup-content list">
                <div class="mockup-block"></div>
                <div class="mockup-block"></div>
                <div class="mockup-block"></div>
              </div>
            </div>
            <div class="style-name">列表</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-settings-container {
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
  color: var(--text-primary, #1c1c1e);
}

.is-dark .notification-settings-container {
  background: #000000;
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
  overflow-y: auto;
  padding: 24px 16px;
}

.is-dark .appearance-main {
  background: #000000;
}

.settings-scroll-view {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-bottom: 40px;
}

/* 卡片分组 */
.settings-group-card {
  background: #ffffff;
  border: 1px solid #f0f0f0;
  border-radius: 14px;
  padding: 16px 18px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}

.is-dark .settings-group-card {
  background: #1c1c1e;
  border-color: #2c2c2e;
}

.group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 10px;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border-color, #f0f0f2);
}

.is-dark .group-header {
  border-bottom-color: #2c2c2e;
}

.group-title {
  font-size: 15px;
  font-weight: 650;
  color: var(--text-primary, #1c1c1e);
}

.group-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--sys-bg-tertiary, #e5e5ea);
  color: var(--text-secondary, #8e8e93);
}

.group-tag.primary {
  background: rgba(0, 122, 255, 0.12);
  color: #007aff;
}

.appearance-settings-list {
  display: flex;
  flex-direction: column;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-color, #f0f0f2);
}

.is-dark .setting-item {
  border-bottom-color: #2c2c2e;
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
  padding-right: 16px;
}

.setting-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #333333);
  margin-bottom: 3px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-tertiary, #999999);
  line-height: 1.4;
}

/* 单选方案卡片 */
.radio-group-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.radio-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.radio-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #fbfbfc;
  border: 1.5px solid #eaeaea;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.is-dark .radio-card {
  background: #242426;
  border-color: #333336;
}

.radio-card.active {
  background: rgba(0, 122, 255, 0.05);
  border-color: #007aff;
}

.radio-card-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
}

.radio-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #ccc;
  position: relative;
  flex-shrink: 0;
  margin-top: 2px;
  transition: all 0.2s;
}

.radio-card.active .radio-circle {
  border-color: #007aff;
}

.radio-card.active .radio-circle::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #007aff;
}

.radio-card-text strong {
  display: block;
  font-size: 13px;
  color: var(--text-primary, #1c1c1e);
  margin-bottom: 2px;
}

.radio-card-text p {
  margin: 0;
  font-size: 11px;
  color: var(--text-tertiary, #8e8e93);
  line-height: 1.4;
}

.scheme-pill {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 6px;
  background: var(--sys-bg-tertiary, #e5e5ea);
  color: var(--text-tertiary, #8e8e93);
  flex-shrink: 0;
}

.scheme-pill.highlight {
  background: rgba(0, 122, 255, 0.15);
  color: #007aff;
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

input:checked + .slider {
  background-color: #007aff;
}

input:checked + .slider:before {
  transform: translateX(20px);
}

/* 模态弹窗样式 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: fadeIn 0.3s ease;
}

.style-modal {
  width: 100%;
  max-width: 500px;
  background: var(--sys-bg-primary, #1c1c1e);
  border-radius: 20px 20px 0 0;
  padding: 24px;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 20px));
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
}

.is-dark .style-modal {
  background: #1c1c1e;
}

.style-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.style-modal-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #ffffff);
}

.close-btn {
  background: #3a3a3c;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8e8e93;
  cursor: pointer;
}

.style-options-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 10px;
}

.style-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  flex: 1;
}

.phone-mockup {
  width: 70px;
  height: 140px;
  border: 2px solid #48484a;
  border-radius: 12px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.2s;
  box-sizing: border-box;
  padding-top: 24px;
  padding-bottom: 12px;
}

.mockup-notch {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 6px;
  background: #48484a;
  border-radius: 0 0 4px 4px;
  transition: all 0.2s;
}

.mockup-time {
  position: absolute;
  top: 10px;
  font-size: 10px;
  color: #48484a;
  font-weight: 600;
  transition: all 0.2s;
}

.mockup-content {
  width: 100%;
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.mockup-block {
  width: 80%;
  height: 16px;
  background: #48484a;
  border-radius: 4px;
  transition: all 0.2s;
}

.style-option.active .phone-mockup {
  border-color: #0a84ff;
  border-width: 2.5px;
}
.style-option.active .mockup-notch { background: #0a84ff; }
.style-option.active .mockup-time { color: #0a84ff; }
.style-option.active .mockup-block { background: #0a84ff; }

.mockup-content.count {
  justify-content: flex-end;
}
.mockup-content.count .mockup-block {
  height: 18px;
}

.mockup-content.stack {
  position: relative;
  height: 100%;
}
.mockup-content.stack .mockup-block {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}
.mockup-content.stack .block-1 { z-index: 3; width: 80%; bottom: 4px; }
.mockup-content.stack .block-2 { z-index: 2; width: 70%; bottom: 8px; opacity: 0.6; }
.mockup-content.stack .block-3 { z-index: 1; width: 60%; bottom: 12px; opacity: 0.3; }

.mockup-content.list {
  justify-content: flex-end;
  gap: 4px;
}

.style-name {
  font-size: 13px;
  color: #8e8e93;
  padding: 6px 16px;
  border-radius: 16px;
  transition: all 0.2s;
}

.style-option.active .style-name {
  background: #0a84ff;
  color: #fff;
  font-weight: 500;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.clickable {
  cursor: pointer;
}
.clickable:active {
  background: rgba(0,0,0,0.05);
}
.is-dark .clickable:active {
  background: rgba(255,255,255,0.05);
}
</style>
