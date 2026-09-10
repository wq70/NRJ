/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
  initialText?: string
  userAvatar?: string
  userName?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', text: string): void
}>()

const text = ref('')
const normalizedInitial = computed(() => String(props.initialText || '').trim())
const hasChanged = computed(() => text.value.trim() !== normalizedInitial.value)

watch(() => props.visible, visible => {
  if (visible) text.value = props.initialText || ''
})

const handleSave = () => emit('save', text.value.trim())
const handleClear = () => {
  text.value = ''
  emit('save', '')
}

const displayName = computed(() => props.userName || '我')
const avatarFallbackText = computed(() => displayName.value.charAt(0) || '我')
</script>

<template>
  <transition name="thought-modal-fade">
    <div v-if="visible" class="thought-modal-overlay" @click="emit('close')" @touchmove.self.prevent>
      <div class="thought-modal-shell" @click.stop>
        
        <!-- 右上角毛玻璃关闭按钮 -->
        <button class="top-close-btn" @click="emit('close')" aria-label="关闭">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <!-- 镜像右侧悬浮邮票头像与曲别针 (代表用户自己) -->
        <div class="user-avatar-wrapper-outer">
          <svg class="paperclip-svg-mirrored" viewBox="0 0 1280 1280" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="metal-grad-user" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#b3b3b3" />
                <stop offset="30%" stop-color="#eeeeee" />
                <stop offset="70%" stop-color="#888888" />
                <stop offset="100%" stop-color="#555555" />
              </linearGradient>
            </defs>
            <g transform="translate(0,1280) scale(0.1,-0.1)" fill="url(#metal-grad-user)" stroke="none">
              <path d="M2800 12679 c-282 -20 -586 -121 -833 -277 -380 -238 -672 -558 -857 -937 -111 -225 -159 -393 -181 -624 -26 -272 40 -576 179 -821 48 -85 5566 -8598 5733 -8845 271 -400 570 -673 934 -852 584 -286 1260 -251 1968 103 169 85 240 128 382 234 621 461 981 960 1103 1530 24 115 26 144 27 355 0 248 -7 299 -66 522 -54 206 -165 461 -292 669 -30 49 -391 607 -803 1239 -413 633 -1395 2142 -2183 3355 -1045 1607 -1447 2218 -1483 2252 -189 182 -538 23 -540 -246 0 -42 6 -78 20 -108 18 -41 1534 -2376 3684 -5676 406 -623 758 -1168 783 -1211 105 -183 195 -407 232 -581 14 -66 18 -128 17 -280 0 -177 -3 -204 -26 -290 -49 -181 -135 -350 -268 -528 -129 -174 -415 -434 -640 -584 -165 -109 -437 -233 -630 -287 -207 -57 -465 -72 -643 -37 -361 70 -687 301 -969 686 -94 128 -5754 8862 -5792 8938 -20 39 -48 111 -63 159 -23 78 -26 104 -26 233 0 188 25 289 118 475 177 354 508 655 846 769 222 74 491 75 708 1 167 -56 342 -177 451 -310 77 -93 4329 -6652 4396 -6780 163 -310 158 -541 -16 -715 -98 -98 -320 -237 -450 -282 -218 -75 -444 16 -625 252 -23 30 -644 987 -1380 2125 -1519 2350 -1500 2322 -1551 2363 -111 92 -296 81 -411 -23 -96 -86 -137 -220 -101 -327 16 -44 2808 -4374 2907 -4508 201 -269 455 -442 731 -497 98 -19 301 -19 411 1 257 46 571 203 801 400 265 226 418 544 418 864 0 229 -81 515 -210 744 -70 123 -4301 6647 -4371 6738 -229 302 -568 512 -950 590 -89 18 -311 42 -364 38 -11 0 -67 -4 -125 -9z"/>
            </g>
          </svg>
          <div class="user-stamp-bg">
            <div class="user-stamp-inner">
              <img v-if="userAvatar" :src="userAvatar" class="avatar-img" />
              <div v-else class="avatar-text-fallback">{{ avatarFallbackText }}</div>
            </div>
          </div>
        </div>

        <!-- 便签信纸卡片 -->
        <article class="user-thought-card">
          <div class="scrollable-content">
            <!-- 头部信息：左对齐，避让右上角邮票头像 -->
            <header class="thought-note-header">
              <div class="header-titles">
                <div class="title-primary">我的心声</div>
                <div class="title-secondary">随下一次回复请求发送给角色</div>
              </div>
            </header>

            <!-- 便签横线书写区 -->
            <main class="thought-edit-main">
              <textarea
                v-model="text"
                class="lined-textarea"
                maxlength="500"
                placeholder="写下本轮没有直接说出口的想法…"
                spellcheck="false"
              ></textarea>
            </main>

            <!-- 便签底部字数统计 -->
            <footer class="thought-note-footer">
              <span class="count-badge">{{ text.length }} / 500</span>
            </footer>
          </div>
        </article>

        <!-- 外部悬浮操作按钮 -->
        <nav class="external-controls" aria-label="心声编辑操作">
          <div class="action-group">
            <button
              type="button"
              class="external-button text-button"
              @click="emit('close')"
            >
              取消
            </button>
            <button
              type="button"
              class="external-button text-button reset-text-btn"
              :disabled="!text && !normalizedInitial"
              @click="handleClear"
            >
              重置
            </button>
          </div>

          <div class="action-group">
            <button
              type="button"
              class="external-button text-button primary-text-btn"
              :disabled="!hasChanged"
              @click="handleSave"
            >
              保存到本轮
            </button>
          </div>
        </nav>

      </div>
    </div>
  </transition>
</template>

<style scoped>
.thought-modal-fade-enter-active, .thought-modal-fade-leave-active {
  transition: opacity .25s ease;
}
.thought-modal-fade-enter-from, .thought-modal-fade-leave-to {
  opacity: 0;
}

.thought-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(26, 26, 28, .54);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}

.thought-modal-shell {
  position: relative;
  height: 82vh;
  max-height: 800px;
  aspect-ratio: 9 / 16;
  max-width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-right: 10px; /* 稍微往左靠一点，留出右侧空间给悬空头像 */
}

.user-thought-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 16px 42px rgba(0, 0, 0, .22), inset 0 0 1px 1px rgba(0, 0, 0, 0.05);
}

/* 镜像右侧悬浮头像 */
.user-avatar-wrapper-outer {
  position: absolute;
  right: -25px;
  top: 15px;
  width: 90px;
  height: 90px;
  display: grid;
  place-items: center;
  transform: rotate(-10deg);
  z-index: 100;
}

.user-stamp-bg {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0) 3px, #fff 3.5px);
  background-size: 10px 10px;
  background-position: -5px -5px;
  display: grid;
  place-items: center;
  filter: drop-shadow(2px 4px 6px rgba(0, 0, 0, .2));
}

.user-stamp-inner {
  width: 80px;
  height: 80px;
  background: #fff;
  display: grid;
  place-items: center;
  padding: 4px;
  box-sizing: border-box;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-text-fallback {
  color: #999;
  font: 28px "STKaiti", "KaiTi", serif;
}

.paperclip-svg-mirrored {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%) rotate(-20deg);
  width: 32px;
  height: 32px;
  z-index: 2;
  filter: drop-shadow(-2px 3px 4px rgba(0,0,0,0.35)) drop-shadow(0px 1px 1px rgba(255,255,255,0.4));
  pointer-events: none;
}

.scrollable-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: visible;
  scrollbar-width: none;
  padding: 24px 24px;
  background-image: repeating-linear-gradient(
    transparent,
    transparent 31px,
    #e4e4e4 31px,
    #e4e4e4 32px
  );
  background-attachment: local;
  background-position: 0 -2px;
}
.scrollable-content::-webkit-scrollbar {
  display: none;
}

/* 顶部信息区域 (左侧文字，右侧避让头像) */
.thought-note-header {
  display: flex;
  align-items: flex-start;
  margin-bottom: 28px;
}

.header-titles {
  display: grid;
  gap: 6px;
  margin-right: 68px; /* 右侧避让头像 */
  flex: 1;
  min-width: 0;
}

.title-primary {
  color: #333;
  font: 600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-secondary {
  color: #888;
  font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  letter-spacing: .3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 输入主体区域 */
.thought-edit-main {
  flex: 1;
  display: flex;
  min-height: 220px;
}

.lined-textarea {
  width: 100%;
  height: 100%;
  min-height: 220px;
  border: none;
  outline: none;
  background: transparent;
  color: #404040;
  padding: 0;
  margin: 0;
  resize: none;
  box-sizing: border-box;
  letter-spacing: 1px;
  font: 15px/32px "STKaiti", "KaiTi", "Songti SC", Georgia, serif;
}

.lined-textarea::placeholder {
  color: #bbb;
  font-style: italic;
}

.thought-note-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 12px;
}

.count-badge {
  font: 12px Georgia, serif;
  color: #aaa;
  letter-spacing: .5px;
}

/* 外部控制区 */
.external-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 38px;
  padding: 0 2px;
}

.action-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.external-button {
  display: grid;
  place-items: center;
  border: 0;
  color: #fff;
  background: rgba(255, 255, 255, .14);
  cursor: pointer;
  transition: background .18s ease, transform .18s ease;
}

.external-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, .25);
}

.external-button:active:not(:disabled) {
  transform: scale(.95);
}

.external-button:disabled {
  opacity: .35;
  cursor: default;
}

.text-button {
  padding: 0 16px;
  height: 34px;
  border-radius: 17px;
  font-size: 13px;
  letter-spacing: 1px;
}

.primary-text-btn {
  background: rgba(255, 255, 255, 0.28);
  font-weight: 600;
}

.danger-text-btn {
  color: #ff9e9e;
}

/* 右上角关闭按钮 */
.top-close-btn {
  position: absolute;
  top: -38px;
  right: 0;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: background 0.18s ease, transform 0.18s ease;
  z-index: 100;
}

.top-close-btn:hover {
  background: rgba(255, 255, 255, 0.25);
}

.top-close-btn:active {
  transform: scale(0.95);
}

@media (max-width: 480px) {
  .thought-modal-overlay {
    padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
  }
  .thought-modal-shell {
    width: min(calc(100vw - 32px), 360px);
    height: min(76dvh, calc(var(--app-height, 100dvh) - 88px));
    max-height: none;
    max-width: none;
    margin-right: 0;
    gap: 10px;
  }
  .user-avatar-wrapper-outer {
    right: -16px;
    top: 12px;
    width: 70px;
    height: 70px;
  }
  .user-stamp-inner { width: 62px; height: 62px; }
  .paperclip-svg-mirrored { top: -19px; width: 27px; height: 27px; }
  .scrollable-content { padding: 20px 18px; }
  .thought-note-header { margin-bottom: 20px; }
  .header-titles { margin-right: 48px; }
  .thought-edit-main,
  .lined-textarea { min-height: 160px; }
  .external-controls { min-height: 34px; }
  .text-button { padding-inline: 13px; }
  .top-close-btn { top: -36px; right: 0; }
}

@media (max-height: 620px) and (max-width: 480px) {
  .thought-modal-shell { height: min(70dvh, calc(var(--app-height, 100dvh) - 72px)); }
  .thought-note-header { margin-bottom: 12px; }
  .thought-edit-main,
  .lined-textarea { min-height: 120px; }
}
</style>
