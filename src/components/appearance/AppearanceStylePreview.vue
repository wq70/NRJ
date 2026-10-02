<!-- WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ -->
<script setup lang="ts">
import type { AppearanceCategoryId } from '../../appearanceRegistry'

withDefaults(defineProps<{
  categoryId: AppearanceCategoryId
  styleId: string
  dark?: boolean
  compact?: boolean
}>(), { dark: false, compact: false })
</script>

<template>
  <div class="appearance-style-preview" :class="[`category-${categoryId}`, `style-${styleId}`, { 'is-dark': dark, compact }]">
    <div v-if="categoryId === 'chatList'" class="preview-chat-list" :class="{ 'is-editorial': styleId === 'editorial', 'is-original': styleId === 'default' }">
      <!-- 纯净通透风格预览：突出诗签卡片、轻盈通透的气质 -->
      <template v-if="styleId === 'editorial'">
        <div class="prev-editorial-header">
          <div class="prev-editorial-user">
            <span class="prev-user-avatar"></span>
            <div class="prev-user-text">
              <strong>我的消息</strong>
              <small>切换账号 ›</small>
            </div>
          </div>
          <span class="prev-header-dot"></span>
        </div>
        <div class="prev-editorial-card">
          <div class="prev-card-top">
            <small>25 / 09</small>
            <span class="prev-card-tag">心情</span>
          </div>
          <p class="prev-card-quote">在这里收藏今天的心情。</p>
        </div>
        <div class="prev-editorial-pins">
          <span class="prev-pin-item active"></span>
          <span class="prev-pin-item"></span>
          <span class="prev-pin-item"></span>
          <span class="prev-pin-item"></span>
        </div>
        <div class="prev-editorial-list">
          <div class="prev-row-item">
            <span class="prev-avatar circle"></span>
            <div class="prev-row-lines">
              <span class="line-title w-40"></span>
              <span class="line-sub w-70"></span>
            </div>
          </div>
          <div class="prev-row-item">
            <span class="prev-avatar circle"></span>
            <div class="prev-row-lines">
              <span class="line-title w-50"></span>
              <span class="line-sub w-60"></span>
            </div>
          </div>
        </div>
      </template>

      <!-- 原版经典风格预览：突出经典Messages大标题、整齐规整的条目 -->
      <template v-else>
        <div class="prev-original-header">
          <strong>Messages</strong>
          <span class="prev-header-plus">+</span>
        </div>
        <div class="prev-original-chips">
          <span class="chip-item active">全部</span>
          <span class="chip-item">好友</span>
          <span class="chip-item">群聊</span>
        </div>
        <div class="prev-original-list">
          <div class="prev-row-item">
            <span class="prev-avatar square"></span>
            <div class="prev-row-lines">
              <div class="line-meta">
                <span class="line-title w-45"></span>
                <span class="line-time"></span>
              </div>
              <span class="line-sub w-75"></span>
            </div>
          </div>
          <div class="prev-row-item">
            <span class="prev-avatar square"></span>
            <div class="prev-row-lines">
              <div class="line-meta">
                <span class="line-title w-35"></span>
                <span class="line-time"></span>
              </div>
              <span class="line-sub w-65"></span>
            </div>
          </div>
          <div class="prev-row-item">
            <span class="prev-avatar square"></span>
            <div class="prev-row-lines">
              <div class="line-meta">
                <span class="line-title w-50"></span>
                <span class="line-time"></span>
              </div>
              <span class="line-sub w-55"></span>
            </div>
          </div>
        </div>
      </template>

      <footer class="prev-bottom-bar">
        <span class="prev-tab-dot active"></span>
        <span class="prev-tab-dot"></span>
        <span class="prev-tab-dot"></span>
        <span class="prev-tab-dot"></span>
      </footer>
    </div>
    <div v-else-if="categoryId === 'chatRoom'" class="preview-chat-room" :class="{ 'is-original': styleId === 'default' }">
      <header><i></i><strong>小梨</strong><span></span><b></b></header>
      <main>
        <div class="preview-chat-time">20:54</div>
        <div class="preview-chat-message other"><em>梨</em><span>给你打电话</span></div>
        <div class="preview-chat-message other grouped"><span>外面有点冷</span></div>
        <div class="preview-chat-message mine"><span>OK</span><em>我</em></div>
        <div class="preview-chat-message mine grouped"><span>到了给你发消息</span></div>
      </main>
      <footer><i></i><span>输入消息...</span><b></b></footer>
    </div>
    <!-- 角色主页风格预览：通透冷白、层次分明、精致微缩 -->
    <div v-else-if="styleId === 'default'" class="preview-char-profile default-scheme">
      <div class="char-prev-hero">
        <div class="char-prev-cover"></div>
        <div class="char-prev-fog"></div>
        <div class="char-prev-status">
          <span class="status-dot"></span>
          <small>在线</small>
        </div>
      </div>
      <div class="char-prev-content">
        <div class="char-prev-name-row">
          <strong>角色名字</strong>
          <span class="char-prev-id">@id_sample</span>
        </div>
        <p class="char-prev-quote">“在这里留下一句属于自己的话。”</p>
        <div class="char-prev-moments">
          <div class="char-moments-head">
            <small>随笔手记</small>
            <span class="count-tag">03</span>
          </div>
          <div class="char-moments-grid">
            <span class="grid-img"></span>
            <span class="grid-img"></span>
            <span class="grid-img"></span>
          </div>
          <div class="char-moments-line"></div>
        </div>
      </div>
    </div>

    <div v-else-if="styleId === 'magazine'" class="preview-char-profile magazine-scheme">
      <div class="mag-prev-cover">
        <div class="mag-avatar-tag">
          <span class="mag-avatar-inner"></span>
        </div>
      </div>
      <div class="mag-prev-body">
        <span class="mag-kicker">PROFILE</span>
        <strong class="mag-name">角色名字</strong>
        <p class="mag-quote">在这里留下一句属于自己的话。</p>
        <div class="mag-divider"></div>
        <div class="mag-moments-head">
          <small>近况</small>
          <span>/ 03</span>
        </div>
        <div class="mag-triptych">
          <span class="mag-slot active"></span>
          <span class="mag-slot"></span>
          <span class="mag-slot"></span>
        </div>
      </div>
    </div>

    <div v-else class="preview-char-profile letter-scheme">
      <div class="letter-sheet">
        <div class="letter-polaroid">
          <div class="polaroid-photo"></div>
          <div class="polaroid-caption"></div>
        </div>
        <div class="letter-note-body">
          <span class="letter-tag">PRIVATE NOTE</span>
          <strong class="letter-title">角色名字</strong>
          <div class="letter-rule"></div>
          <p class="letter-text">她留下的话</p>
          <div class="letter-stamps">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.appearance-style-preview{position:relative;width:100%;height:100%;overflow:hidden;background:#ffffff;color:#202124;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;box-sizing:border-box}.appearance-style-preview.is-dark{background:#161718;color:#efefec}

/* 通用角色主页预览骨架 */
.preview-char-profile {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  background: #ffffff;
  color: #1e2022;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  user-select: none;
  overflow: hidden;
}

/* 1. 原版主页：封面景深雾化、在线状态光点、手记三联相册 */
.preview-char-profile.default-scheme {
  background: #ffffff;
}
.char-prev-hero {
  position: relative;
  height: 42%;
  background: linear-gradient(150deg, #dde3ea 0%, #c5d0db 100%);
  overflow: hidden;
}
.char-prev-cover {
  width: 100%;
  height: 100%;
  background: radial-gradient(circle at 75% 25%, rgba(255, 255, 255, 0.65) 0%, transparent 60%);
}
.char-prev-fog {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 35%, rgba(255, 255, 255, 0.95) 100%);
}
.char-prev-status {
  position: absolute;
  right: 8px;
  top: 8px;
  display: flex;
  align-items: center;
  gap: 3.5px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
  border: 0.5px solid rgba(0, 0, 0, 0.05);
}
.status-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #10b981;
}
.char-prev-status small {
  font-size: 6px;
  color: #334155;
  font-weight: 500;
  transform: scale(0.9);
}
.char-prev-content {
  flex: 1;
  padding: 4px 10px 8px;
  display: flex;
  flex-direction: column;
}
.char-prev-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 2px;
}
.char-prev-name-row strong {
  font-family: Georgia, "Songti SC", serif;
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
}
.char-prev-id {
  font-size: 6px;
  padding: 1px 4px;
  border-radius: 3px;
  background: #f1f5f9;
  color: #64748b;
  font-family: monospace;
  transform: scale(0.9);
  transform-origin: left center;
}
.char-prev-quote {
  margin: 1px 0 6px;
  font-size: 7px;
  color: #64748b;
  font-family: Georgia, "Songti SC", serif;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.char-prev-moments {
  margin-top: auto;
  padding: 5px 6px;
  border-radius: 6px;
  background: #f8fafc;
  border: 1px solid #eef2f6;
}
.char-moments-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.char-moments-head small {
  font-size: 6.5px;
  font-weight: 600;
  color: #334155;
}
.count-tag {
  font-size: 6px;
  color: #94a3b8;
  transform: scale(0.85);
}
.char-moments-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.grid-img {
  aspect-ratio: 1;
  border-radius: 3px;
  background: #e2e8f0;
}
.char-moments-line {
  width: 65%;
  height: 2px;
  border-radius: 1px;
  background: #e2e8f0;
  margin-top: 4px;
}

/* 2. 私人杂志：高冷纯白摄影集、悬浮头像、三联胶片卡 */
.preview-char-profile.magazine-scheme {
  background: #ffffff;
}
.mag-prev-cover {
  position: relative;
  height: 44%;
  background: linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 100%);
  border-bottom: 1px solid #e2e8f0;
}
.mag-avatar-tag {
  position: absolute;
  left: 10px;
  bottom: -11px;
  width: 25px;
  height: 25px;
  padding: 2px;
  border-radius: 7px;
  background: #ffffff;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.07);
}
.mag-avatar-inner {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 5px;
  background: #cbd5e1;
}
.mag-prev-body {
  flex: 1;
  padding: 14px 10px 8px;
  display: flex;
  flex-direction: column;
}
.mag-kicker {
  font-size: 5.5px;
  letter-spacing: 0.16em;
  color: #94a3b8;
  font-weight: 600;
}
.mag-name {
  font-family: Georgia, "Songti SC", serif;
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 1px;
}
.mag-quote {
  margin: 2px 0 0;
  font-size: 6.5px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mag-divider {
  width: 100%;
  height: 1px;
  background: #f1f5f9;
  margin: 5px 0 4px;
}
.mag-moments-head {
  display: flex;
  align-items: baseline;
  gap: 3px;
  margin-bottom: 4px;
}
.mag-moments-head small {
  font-size: 7px;
  font-weight: 600;
  color: #1e293b;
}
.mag-moments-head span {
  font-size: 6px;
  color: #94a3b8;
  transform: scale(0.9);
}
.mag-triptych {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.mag-slot {
  aspect-ratio: 0.78;
  border-radius: 2px;
  background: #e2e8f0;
}
.mag-slot.active {
  background: #cbd5e1;
}

/* 3. 私人信笺：极简冷白手作纸、纯白立体拍立得 */
.preview-char-profile.letter-scheme {
  background: #f8fafc;
}
.letter-sheet {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 8px 9px 8px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.letter-polaroid {
  width: 76%;
  margin: 0 auto 6px;
  padding: 4px 4px 5px;
  background: #ffffff;
  border-radius: 4px;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
  border: 1px solid #eef2f6;
  transform: rotate(-1deg);
}
.polaroid-photo {
  width: 100%;
  aspect-ratio: 1.6;
  border-radius: 2px;
  background: #cbd5e1;
}
.polaroid-caption {
  width: 42%;
  height: 2px;
  border-radius: 1px;
  background: #e2e8f0;
  margin: 3.5px auto 0;
}
.letter-note-body {
  flex: 1;
  padding: 6px 7px;
  background: #ffffff;
  border-radius: 6px;
  border: 1px solid #eef2f6;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
  display: flex;
  flex-direction: column;
}
.letter-tag {
  font-size: 5px;
  letter-spacing: 0.15em;
  color: #94a3b8;
  font-weight: 600;
}
.letter-title {
  font-family: Georgia, "Songti SC", serif;
  font-size: 10px;
  font-weight: 700;
  color: #0f172a;
  margin-top: 1px;
}
.letter-rule {
  width: 20px;
  height: 1px;
  background: #e2e8f0;
  margin: 3px 0;
}
.letter-text {
  margin: 0 0 5px;
  font-size: 6.5px;
  color: #64748b;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.letter-stamps {
  display: flex;
  gap: 4px;
  margin-top: auto;
}
.letter-stamps span {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
}

/* 角色主页夜间模式暗调适配 */
.appearance-style-preview.is-dark .preview-char-profile {
  background: #18191b;
  color: #efefec;
}
.appearance-style-preview.is-dark .char-prev-hero {
  background: linear-gradient(150deg, #2a2d32 0%, #1f2124 100%);
}
.appearance-style-preview.is-dark .char-prev-cover {
  background: radial-gradient(circle at 75% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 60%);
}
.appearance-style-preview.is-dark .char-prev-fog {
  background: linear-gradient(to bottom, transparent 35%, rgba(24, 25, 27, 0.95) 100%);
}
.appearance-style-preview.is-dark .char-prev-status {
  background: rgba(35, 37, 40, 0.9);
  border-color: rgba(255, 255, 255, 0.08);
}
.appearance-style-preview.is-dark .char-prev-status small {
  color: #cbd5e1;
}
.appearance-style-preview.is-dark .char-prev-name-row strong,
.appearance-style-preview.is-dark .mag-name,
.appearance-style-preview.is-dark .letter-title {
  color: #f8fafc;
}
.appearance-style-preview.is-dark .char-prev-id {
  background: #25282d;
  color: #94a3b8;
}
.appearance-style-preview.is-dark .char-prev-quote,
.appearance-style-preview.is-dark .mag-quote,
.appearance-style-preview.is-dark .letter-text {
  color: #94a3b8;
}
.appearance-style-preview.is-dark .char-prev-moments {
  background: #202226;
  border-color: #2b2f35;
}
.appearance-style-preview.is-dark .char-moments-head small,
.appearance-style-preview.is-dark .mag-moments-head small {
  color: #e2e8f0;
}
.appearance-style-preview.is-dark .grid-img,
.appearance-style-preview.is-dark .char-moments-line,
.appearance-style-preview.is-dark .mag-slot {
  background: #2c3036;
}
.appearance-style-preview.is-dark .mag-prev-cover {
  background: linear-gradient(160deg, #26292e 0%, #1e2023 100%);
  border-color: #2b2f35;
}
.appearance-style-preview.is-dark .mag-avatar-tag {
  background: #202226;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
}
.appearance-style-preview.is-dark .mag-avatar-inner {
  background: #3a3f47;
}
.appearance-style-preview.is-dark .mag-divider {
  background: #26292e;
}
.appearance-style-preview.is-dark .mag-slot.active {
  background: #3d4450;
}
.appearance-style-preview.is-dark .preview-char-profile.letter-scheme {
  background: #141517;
}
.appearance-style-preview.is-dark .letter-polaroid,
.appearance-style-preview.is-dark .letter-note-body {
  background: #1e2024;
  border-color: #2a2e34;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}
.appearance-style-preview.is-dark .polaroid-photo {
  background: #333842;
}
.appearance-style-preview.is-dark .polaroid-caption,
.appearance-style-preview.is-dark .letter-rule {
  background: #2c313a;
}
.appearance-style-preview.is-dark .letter-stamps span {
  border-color: #3b424e;
  background: #191b1e;
}

/* 紧凑缩放模式 (用于衣橱首页面板等) */
.appearance-style-preview.compact .char-prev-hero {
  height: 38%;
}
.appearance-style-preview.compact .char-prev-content {
  padding: 3px 6px;
}
.appearance-style-preview.compact .char-prev-moments {
  display: none;
}
.appearance-style-preview.compact .mag-prev-cover {
  height: 40%;
}
.appearance-style-preview.compact .mag-prev-body {
  padding: 10px 6px 4px;
}
.appearance-style-preview.compact .mag-triptych,
.appearance-style-preview.compact .mag-moments-head {
  display: none;
}
.appearance-style-preview.compact .letter-sheet {
  padding: 4px;
}
.appearance-style-preview.compact .letter-stamps {
  display: none;
}
.preview-chat-room{display:flex;height:100%;flex-direction:column;background:#fff}.is-dark .preview-chat-room{background:#181719}.preview-chat-room header{display:grid;height:18%;grid-template-columns:15% 1fr 11% 11%;align-items:center;padding:0 6%;border-bottom:1px solid #f0eeee}.preview-chat-room header strong{text-align:center;font-size:clamp(6px,2vw,11px)}.preview-chat-room header i{width:45%;aspect-ratio:1;border-width:0 0 1px 1px;border-style:solid;transform:rotate(45deg)}.preview-chat-room header span{width:48%;aspect-ratio:1;margin:auto;border:1px solid currentColor;border-radius:50%}.preview-chat-room header b{width:65%;height:2px;border-radius:2px;background:currentColor;box-shadow:0 4px currentColor,-0 -4px currentColor}.preview-chat-room main{position:relative;display:flex;flex:1;flex-direction:column;gap:5%;padding:9% 5%}.preview-chat-time{position:absolute;top:47%;left:0;width:100%;color:#aaa;font-size:clamp(4px,1.5vw,8px);text-align:center}.preview-chat-message{display:flex;align-items:flex-start;gap:3%;font-size:clamp(5px,1.8vw,9px)}.preview-chat-message em{display:grid;width:13%;aspect-ratio:1;flex:none;border-radius:16%;background:#efefec;color:#777;font-size:clamp(4px,1.4vw,7px);font-style:normal;place-items:center}.preview-chat-message span{position:relative;padding:3.5% 5%;border:1px solid #e7e3e1;border-radius:7px;background:#fff}.preview-chat-message.other span:before{position:absolute;top:27%;left:-5px;width:8px;height:8px;border-width:0 0 1px 1px;border-style:solid;border-color:#e7e3e1;background:inherit;content:'';transform:rotate(45deg)}.preview-chat-message.grouped{padding-left:16%}.preview-chat-message.mine{justify-content:flex-end;margin-top:auto}.preview-chat-message.mine span{border-color:#efd5dd;background:#fff1f5}.preview-chat-message.mine span:after{position:absolute;top:27%;right:-5px;width:8px;height:8px;border-width:1px 1px 0 0;border-style:solid;border-color:#efd5dd;background:inherit;content:'';transform:rotate(45deg)}.preview-chat-message.mine.grouped{margin-top:0;padding-right:16%}.is-dark .preview-chat-message span{border-color:#454045;background:#29272a}.is-dark .preview-chat-message.mine span{border-color:#664854;background:#402d35}.preview-chat-room footer{display:grid;height:15%;grid-template-columns:11% 1fr 11%;align-items:center;gap:5%;padding:0 6%;border-top:1px solid #f0eeee}.preview-chat-room footer i,.preview-chat-room footer b{width:70%;aspect-ratio:1;border:1px solid currentColor;border-radius:50%}.preview-chat-room footer span{padding:4% 6%;border:1px solid #eee;border-radius:999px;color:#aaa;font-size:clamp(4px,1.5vw,8px)}.is-dark .preview-chat-room header,.is-dark .preview-chat-room footer{border-color:#302e31}.is-dark .preview-chat-room footer span{border-color:#403d41}
.preview-chat-room.is-original{background:#f5f5f7}.preview-chat-room.is-original header{height:25%;border:0;background:rgba(255,255,255,.7)}.preview-chat-room.is-original .preview-chat-message span{border-style:dashed;border-color:#bbb;background:transparent}.preview-chat-room.is-original .preview-chat-message span:before,.preview-chat-room.is-original .preview-chat-message span:after{display:none}.preview-chat-room.is-original .preview-chat-message em{border-radius:50%}.preview-chat-room.is-original footer{background:rgba(255,255,255,.7)}.is-dark .preview-chat-room.is-original{background:#111}.is-dark .preview-chat-room.is-original header,.is-dark .preview-chat-room.is-original footer{background:rgba(35,35,37,.8)}
/* 聊天列表全新精炼预览 */
.preview-chat-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 10px;
  background: #ffffff;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  user-select: none;
}

/* 顶部通用微条目 */
.prev-editorial-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.prev-editorial-user {
  display: flex;
  align-items: center;
  gap: 5px;
}
.prev-user-avatar {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  background: #dfe3e6;
  flex-shrink: 0;
}
.prev-user-text strong {
  display: block;
  font-size: 8px;
  line-height: 1.1;
  font-weight: 600;
}
.prev-user-text small {
  display: block;
  font-size: 6px;
  color: #9da2a7;
  transform: scale(0.9);
  transform-origin: left center;
}
.prev-header-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #cbd0d4;
}

/* 诗签卡片 */
.prev-editorial-card {
  padding: 5px 7px;
  border-radius: 6px;
  background: #fafaf9;
  border: 1px solid #ebece9;
  margin-bottom: 6px;
}
.prev-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}
.prev-card-top small {
  font-size: 6px;
  color: #a0a4a8;
  transform: scale(0.85);
  transform-origin: left center;
}
.prev-card-tag {
  font-size: 6px;
  padding: 1px 3px;
  border-radius: 3px;
  background: #f0f0ee;
  color: #888;
  transform: scale(0.8);
  transform-origin: right center;
}
.prev-card-quote {
  margin: 0;
  font-size: 7px;
  color: #4a4d52;
  font-family: Georgia, "Songti SC", serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 置顶圆形头像条 */
.prev-editorial-pins {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 7px;
}
.prev-pin-item {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e6eaec;
  border: 1.5px solid transparent;
}
.prev-pin-item.active {
  border-color: #abb3b8;
}

/* 原版导航头 */
.prev-original-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.prev-original-header strong {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: -0.2px;
}
.prev-header-plus {
  font-size: 11px;
  color: #888;
  line-height: 1;
}

/* 分类标签微缩条 */
.prev-original-chips {
  display: flex;
  gap: 5px;
  margin-bottom: 8px;
}
.chip-item {
  font-size: 7px;
  padding: 1px 5px;
  border-radius: 8px;
  background: #f1f2f4;
  color: #83878b;
  transform: scale(0.9);
  transform-origin: left center;
}
.chip-item.active {
  background: #202124;
  color: #fff;
}

/* 会话行骨架 */
.prev-editorial-list,
.prev-original-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  flex: 1;
}
.prev-row-item {
  display: flex;
  align-items: center;
  gap: 6px;
}
.prev-avatar {
  width: 17px;
  height: 17px;
  background: #e2e5e8;
  flex-shrink: 0;
}
.prev-avatar.circle {
  border-radius: 50%;
}
.prev-avatar.square {
  border-radius: 4px;
}
.prev-row-lines {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.line-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.line-time {
  width: 14px;
  height: 3px;
  border-radius: 2px;
  background: #e5e8ea;
}
.line-title {
  height: 4px;
  border-radius: 2px;
  background: #b5bbc0;
}
.line-sub {
  height: 3px;
  border-radius: 2px;
  background: #e3e6e8;
}
.w-35 { width: 35%; }
.w-40 { width: 40%; }
.w-45 { width: 45%; }
.w-50 { width: 50%; }
.w-55 { width: 55%; }
.w-60 { width: 60%; }
.w-65 { width: 65%; }
.w-70 { width: 70%; }
.w-75 { width: 75%; }

/* 底部精炼栏 */
.prev-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding-top: 6px;
  margin-top: auto;
  border-top: 1px solid #f1f2f4;
}
.prev-tab-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d6d9dc;
}
.prev-tab-dot.active {
  background: #242527;
}

/* 夜间模式 */
.appearance-style-preview.is-dark .preview-chat-list {
  background: #191a1b;
  color: #efefec;
}
.appearance-style-preview.is-dark .prev-user-avatar {
  background: #393c40;
}
.appearance-style-preview.is-dark .prev-editorial-card {
  background: #222325;
  border-color: #2e3033;
}
.appearance-style-preview.is-dark .prev-card-tag {
  background: #2e3034;
  color: #aaa;
}
.appearance-style-preview.is-dark .prev-card-quote {
  color: #d1d4d8;
}
.appearance-style-preview.is-dark .prev-pin-item {
  background: #303337;
}
.appearance-style-preview.is-dark .prev-pin-item.active {
  border-color: #5b6066;
}
.appearance-style-preview.is-dark .chip-item {
  background: #292b2e;
  color: #999ea3;
}
.appearance-style-preview.is-dark .chip-item.active {
  background: #ffffff;
  color: #191a1b;
}
.appearance-style-preview.is-dark .prev-avatar {
  background: #36393e;
}
.appearance-style-preview.is-dark .line-title {
  background: #5b6066;
}
.appearance-style-preview.is-dark .line-sub,
.appearance-style-preview.is-dark .line-time {
  background: #2e3034;
}
.appearance-style-preview.is-dark .prev-bottom-bar {
  border-color: #26282b;
}
.appearance-style-preview.is-dark .prev-tab-dot {
  background: #3c3f44;
}
.appearance-style-preview.is-dark .prev-tab-dot.active {
  background: #ffffff;
}
</style>
