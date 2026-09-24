/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'
import ChatCallRecordsView from '../ChatCallRecordsView.vue'
import { getIdentityClockLabel } from '../../../services/conversationTime'

const props = defineProps<{
  selectedChat: any
  myProfile: any
  userCurrentTime: string
  getTimezoneLabel: (tz: string) => string
  matchSearch: (...keywords: (string | undefined | null)[]) => boolean
}>()

const emit = defineEmits<{
  (e: 'open-avatar-upload', target: 'contact' | 'me'): void
  (e: 'open-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-long-text-modal', title: string, text: string, defaultText: string, placeholder: string, target: string): void
  (e: 'open-timezone-modal', target: 'user'): void
  (e: 'open-persona-select'): void
  (e: 'use-account-persona'): void
  (e: 'create-user-persona'): void
  (e: 'delete-call-records', ids: (string | number)[]): void
  (e: 'resummarize-call-record', id: string | number): void
  (e: 'show-identity-profile-modal', target: 'user'): void
  (e: 'open-user-profile'): void
}>()

const showCallRecordsView = ref(false)
</script>

<template>
  <div class="role-edit-section">
    <!-- 1:1 复刻无背景小组件 (用户版) -->
    <div class="clingy-role-custom-widget" v-show="matchSearch('更换头像', '头像', '签名', '小组件', '我', '人设库', '账号人设', '新建人设', myProfile?.name, myProfile?.remark)">
      <!-- 上方大头像与昵称 -->
      <div class="widget-top-section">
        <div class="widget-main-avatar" @click="emit('open-avatar-upload', 'me')" :style="myProfile?.avatarUrl ? { backgroundImage: `url(${myProfile.avatarUrl})` } : {}" title="点击更换头像">
          <span v-if="!myProfile?.avatarUrl">{{ myProfile?.name?.charAt(0) || '我' }}</span>
          <div class="widget-avatar-edit-badge">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="#fff" stroke-width="2.5" fill="none"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          </div>
        </div>
        <div class="widget-name-row" @click="emit('open-text-modal', '编辑我的昵称', myProfile?.remark || myProfile?.name || '我', '', '请输入备注或昵称', 'myRemark')" title="点击修改昵称">
          <span class="widget-name-text">♡⑅ºʚ՞{{ myProfile?.remark || myProfile?.name || '我' }}՞ɞº⑅♡</span>
        </div>
      </div>

      <!-- 下方小头像(角色头像)与胶囊气泡(自定义文案) -->
      <div class="widget-bottom-section">
        <div class="widget-sub-avatar" @click="emit('open-avatar-upload', 'contact')" :style="selectedChat?.avatarUrl ? { backgroundImage: `url(${selectedChat.avatarUrl})` } : {}" title="点击更换角色头像">
          <span v-if="!selectedChat?.avatarUrl">{{ selectedChat?.avatarText || selectedChat?.name?.charAt(0) || '伴' }}</span>
        </div>
        <div class="widget-bubble-capsule" @click="emit('open-text-modal', '编辑自定义文案', myProfile?.widgetBubbleText || '自定义文案', '自定义文案', '请输入自定义文案', 'myWidgetBubbleText')" title="点击修改自定义文案">
          <span class="widget-bubble-text">{{ myProfile?.widgetBubbleText || '自定义文案' }}</span>
        </div>
      </div>

      <!-- 人设快捷操作入口 -->
      <div class="widget-user-persona-actions">
        <button type="button" class="persona-chip-btn" @click="emit('open-persona-select')">人设库选择</button>
        <button type="button" class="persona-chip-btn" @click="emit('use-account-persona')">账号人设</button>
        <button type="button" class="persona-chip-btn" @click="emit('create-user-persona')">新建人设</button>
      </div>
    </div>

    <div class="profile-source-hint">
      当前使用：{{ selectedChat?.userProfileSource?.name || '账号人设（自动跟随）' }}
      <span v-if="selectedChat?.userProfileSource?.hasLocalChanges">（当前聊天已修改）</span>
      <small>更换这里只会调整当前关系里的展示身份，不会清除聊天与记忆；若要完全重新认识，请创建“全新人设身份”账号。</small>
    </div>

    <div class="glass-panel" v-show="matchSearch('用户主页', '真名', '备注', '用户人设')">
      <div class="glass-list-item" v-show="matchSearch('用户主页')" @click="emit('open-user-profile')">
        <div class="item-label">用户主页</div>
        <div class="item-value"><span class="item-value-text">查看与编辑个人主页资料</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('真名')" @click="emit('open-text-modal', '编辑真名', myProfile.name, '', '请输入真名', 'myRealName')">
        <div class="item-label">真名</div>
        <div class="item-value"><span class="item-value-text">{{ myProfile.name || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('备注')" @click="emit('open-text-modal', '编辑备注', myProfile.remark, '', '请输入备注', 'myRemark')">
        <div class="item-label">备注</div>
        <div class="item-value"><span class="item-value-text">{{ myProfile.remark || '未设置' }}</span><span class="arrow">></span></div>
      </div>
      <div class="glass-list-item" v-show="matchSearch('用户人设')" @click="emit('open-long-text-modal', '编辑用户人设', myProfile.persona, '', '请详细描述用户的性格、背景、身份等设定...', 'myPersona')">
        <div class="item-label">用户人设</div>
        <div class="item-value"><span class="item-value-text">{{ myProfile.persona || '未设置' }}</span><span class="arrow">></span></div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('用户时间', '用户时区', '自定义时间')">
      <div class="glass-list-item" v-show="matchSearch('用户时间', '用户时区', '自定义时间')" :class="{ 'disabled-block': !selectedChat.timePerception }" @click="emit('open-timezone-modal', 'user')">
        <div class="item-label">我的独立时间</div>
        <div class="item-value"><span class="item-value-text">{{ getIdentityClockLabel(myProfile) }}</span><span class="arrow">></span></div>
      </div>
    </div>

    <div class="glass-panel" v-show="matchSearch('我的固定形象', '用户形象', '合照', '情侣照')">
      <div class="glass-list-item" @click="emit('show-identity-profile-modal', 'user')">
        <div class="item-label">我的固定形象</div>
        <div class="item-value"><span class="item-value-text">用于合照、情侣照与约会画面</span><span class="arrow">></span></div>
      </div>
    </div>

    <!-- 通话总结记录入口 -->
    <div class="glass-panel" v-show="matchSearch('通话记录', '通话总结')">
      <div class="glass-list-item" @click="showCallRecordsView = true">
        <div class="item-label" style="display: flex; align-items: center; gap: 8px;">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
          历史通话记录
        </div>
        <div class="item-value">
          <span class="item-value-text" style="color: var(--text-secondary); font-size: 13px;">共 {{ selectedChat.callSummaries?.length || 0 }} 条</span>
          <span class="arrow">></span>
        </div>
      </div>
    </div>

    <!-- 通话总结记录列表全屏视图 -->
    <transition name="fade">
      <ChatCallRecordsView 
        v-if="showCallRecordsView" 
        :records="selectedChat.callSummaries || []" 
        @close="showCallRecordsView = false" 
        @delete="ids => emit('delete-call-records', ids)"
        @resummarize="id => emit('resummarize-call-record', id)"
      />
    </transition>
  </div>
</template>

<style scoped>
@import './ChatSettingsStyles.css';

/* 1:1 复刻无背景小组件样式 (用户版) */
.clingy-role-custom-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 10px 4px 6px;
  box-sizing: border-box;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

.widget-top-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  cursor: pointer;
}

.widget-main-avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  font-weight: 500;
  color: var(--text-secondary, #8e8e93);
  position: relative;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
  border: 2px solid #ffffff;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
  user-select: none;
}

.is-dark .widget-main-avatar {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
}

.widget-main-avatar:active {
  transform: scale(0.96);
}

.widget-avatar-edit-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #fff;
}

.widget-name-row {
  margin-top: 10px;
  text-align: center;
  cursor: pointer;
  padding: 2px 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.widget-name-row:active {
  background-color: rgba(0, 0, 0, 0.05);
}

.widget-name-text {
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary, #737373);
  letter-spacing: 0.3px;
  user-select: none;
}

.widget-bottom-section {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  margin-top: 18px;
  padding: 0 10px;
  gap: 12px;
  box-sizing: border-box;
}

.widget-sub-avatar {
  width: 44px;
  height: 44px;
  min-width: 44px;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  background-color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary, #8e8e93);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1.5px solid #ffffff;
  cursor: pointer;
  transition: transform 0.2s ease;
  user-select: none;
}

.is-dark .widget-sub-avatar {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.widget-sub-avatar:active {
  transform: scale(0.95);
}

.widget-bubble-capsule {
  flex: 1;
  max-width: 82%;
  display: inline-flex;
  align-items: center;
  padding: 9px 18px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
  cursor: pointer;
  transition: transform 0.2s ease, background-color 0.2s, border-color 0.2s;
  box-sizing: border-box;
}

.is-dark .widget-bubble-capsule {
  background: rgba(40, 40, 42, 0.85);
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.widget-bubble-capsule:active {
  transform: scale(0.98);
  background-color: #f7f7f8;
}

.is-dark .widget-bubble-capsule:active {
  background-color: rgba(55, 55, 58, 0.95);
}

.widget-bubble-text {
  font-size: 13px;
  color: var(--text-secondary, #5c5c60);
  line-height: 1.4;
  letter-spacing: 0.2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}

/* 人设快捷操作胶囊栏 */
.widget-user-persona-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 14px;
  width: 100%;
}

.persona-chip-btn {
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.65);
  color: var(--text-secondary, #666);
  font-size: 11.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.is-dark .persona-chip-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--text-primary);
}

.persona-chip-btn:active {
  transform: scale(0.96);
  background: rgba(0, 0, 0, 0.05);
}

.role-edit-section {
  display: flex;
  width: 100%;
  margin-top: 12px;
  flex-direction: column;
  gap: 20px;
}

.profile-source-hint {
  margin: -10px 4px 0;
  color: var(--text-tertiary);
  font-size: 12px;
  text-align: center;
}
.profile-source-hint small{display:block;max-width:430px;margin:6px auto 0;font-size:10px;line-height:1.55}
</style>
