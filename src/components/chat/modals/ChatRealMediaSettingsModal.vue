/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { computed, ref } from 'vue'
import { chatSettings } from '../../../store'
import { getBrowserMediaSupport } from '../../../services/browserMedia'
import { isSpeechRecognitionReady } from '../../../services/speechRecognition'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const showKey = ref(false)
const support = computed(getBrowserMediaSupport)
const sttReady = computed(() => isSpeechRecognitionReady({
  url: chatSettings.speechRecognitionUrl,
  key: chatSettings.speechRecognitionKey,
  model: chatSettings.speechRecognitionModel,
  language: chatSettings.speechRecognitionLanguage
}))
const clampVisionInterval = () => {
  const value = Number(chatSettings.realVideoVisionInterval)
  chatSettings.realVideoVisionInterval = Math.min(60, Math.max(8, Number.isFinite(value) ? Math.round(value) : 12))
}
</script>

<template>
  <transition name="real-media-sheet">
    <div v-if="visible" class="real-media-overlay" @click.self="emit('close')">
      <section class="real-media-sheet" role="dialog" aria-modal="true" aria-labelledby="real-media-title">
        <header>
          <button type="button" class="header-action" @click="emit('close')">取消</button>
          <div><h2 id="real-media-title">真实音视频</h2><p>浏览器与 PWA</p></div>
          <button type="button" class="header-action primary" @click="emit('close')">完成</button>
        </header>

        <div class="sheet-scroll">
          <div class="support-note" :class="{ warning: !support.secureContext || !support.mediaDevices || !support.mediaRecorder }">
            <span class="support-dot"></span>
            <div><b>{{ support.secureContext && support.mediaDevices && support.mediaRecorder ? '当前环境支持真实音视频' : '当前环境能力不完整' }}</b><small>摄像头和麦克风只会在你主动点击时申请权限；切到后台会暂停。</small></div>
          </div>

          <section class="settings-card">
            <label class="setting-row master-row">
              <span><b>真实音视频总开关</b><small>关闭后完全使用原来的模拟语音和通话</small></span>
              <span class="switch"><input v-model="chatSettings.enableRealMedia" type="checkbox"><i></i></span>
            </label>
          </section>

          <section class="settings-card" :class="{ disabled: !chatSettings.enableRealMedia }">
            <div class="section-title">可用范围</div>
            <label class="setting-row"><span><b>真实语音消息</b><small>录制并播放你的原声</small></span><span class="switch"><input v-model="chatSettings.enableRealVoiceMessage" :disabled="!chatSettings.enableRealMedia" type="checkbox"><i></i></span></label>
            <label class="setting-row"><span><b>语音通话麦克风</b><small>通话中按键录音并发送给 AI</small></span><span class="switch"><input v-model="chatSettings.enableRealVoiceCall" :disabled="!chatSettings.enableRealMedia" type="checkbox"><i></i></span></label>
            <label class="setting-row"><span><b>视频通话摄像头</b><small>显示真实前后摄像头画面</small></span><span class="switch"><input v-model="chatSettings.enableRealVideoCall" :disabled="!chatSettings.enableRealMedia" type="checkbox"><i></i></span></label>
            <label class="setting-row"><span><b>AI 分析视频画面</b><small>单独开启后才会发送压缩画面</small></span><span class="switch"><input v-model="chatSettings.enableRealVideoVision" :disabled="!chatSettings.enableRealMedia || !chatSettings.enableRealVideoCall" type="checkbox"><i></i></span></label>
            <label class="setting-row"><span><b>通话自动播放角色声音</b><small>使用该角色现有 TTS 配置</small></span><span class="switch"><input v-model="chatSettings.enableRealCallTts" :disabled="!chatSettings.enableRealMedia" type="checkbox"><i></i></span></label>
            <label class="setting-row"><span><b>页面隐藏时释放设备</b><small>防止切后台后继续占用摄像头或麦克风</small></span><span class="switch"><input v-model="chatSettings.realMediaStopWhenHidden" :disabled="!chatSettings.enableRealMedia" type="checkbox"><i></i></span></label>
            <label class="setting-row interval-row"><span><b>自动识图间隔</b><small>画面无明显变化时不会重复识别</small></span><span class="compact-field"><input v-model.number="chatSettings.realVideoVisionInterval" :disabled="!chatSettings.enableRealMedia || !chatSettings.enableRealVideoVision" inputmode="numeric" type="number" min="8" max="60" @change="clampVisionInterval"><em>秒</em></span></label>
          </section>

          <section class="settings-card" :class="{ disabled: !chatSettings.enableRealMedia }">
            <div class="section-title"><span>语音识别 STT</span><em :class="{ ready: sttReady }">{{ sttReady ? '已配置' : '未配置' }}</em></div>
            <label class="field-row"><span>接口地址</span><input v-model.trim="chatSettings.speechRecognitionUrl" :disabled="!chatSettings.enableRealMedia" type="url" placeholder="https://api.example.com/v1"></label>
            <label class="field-row"><span>API Key</span><div class="secret-field"><input v-model="chatSettings.speechRecognitionKey" :disabled="!chatSettings.enableRealMedia" :type="showKey ? 'text' : 'password'" autocomplete="off" placeholder="用于语音转文字"><button type="button" :disabled="!chatSettings.enableRealMedia" @click="showKey = !showKey">{{ showKey ? '隐藏' : '显示' }}</button></div></label>
            <label class="field-row split"><span><i>模型<input v-model.trim="chatSettings.speechRecognitionModel" :disabled="!chatSettings.enableRealMedia" type="text" placeholder="whisper-1"></i><i>语言<input v-model.trim="chatSettings.speechRecognitionLanguage" :disabled="!chatSettings.enableRealMedia" type="text" placeholder="zh"></i></span></label>
            <label class="setting-row"><span><b>语音消息自动转写</b><small>发送前生成文字，失败时仍可保留录音</small></span><span class="switch"><input v-model="chatSettings.realMediaAutoTranscribeMessage" :disabled="!chatSettings.enableRealMedia || !chatSettings.enableRealVoiceMessage" type="checkbox"><i></i></span></label>
            <label class="setting-row"><span><b>通话录音自动转写</b><small>停止说话后把转写加入当前通话</small></span><span class="switch"><input v-model="chatSettings.realMediaAutoTranscribeCall" :disabled="!chatSettings.enableRealMedia || (!chatSettings.enableRealVoiceCall && !chatSettings.enableRealVideoCall)" type="checkbox"><i></i></span></label>
          </section>

          <p class="privacy-copy">真实语音保存在本机 IndexedDB。摄像头原始画面默认不保存；只有通话中再次打开“AI 看画面”后，压缩帧才会发送给已配置的视觉接口。</p>
        </div>
      </section>
    </div>
  </transition>
</template>

<style scoped>
.real-media-overlay{position:fixed;inset:0;z-index:12020;display:flex;align-items:flex-end;justify-content:center;background:rgba(14,18,24,.38);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
.real-media-sheet{box-sizing:border-box;width:min(100%,520px);max-height:min(92dvh,820px);display:flex;flex-direction:column;overflow:hidden;border-radius:18px 18px 0 0;background:var(--sys-bg-primary,#f5f5f7);color:var(--text-primary,#25272a);padding-bottom:env(safe-area-inset-bottom)}
header{height:52px;flex:0 0 52px;display:grid;grid-template-columns:54px minmax(0,1fr) 54px;align-items:center;border-bottom:1px solid var(--border-color,rgba(0,0,0,.07));padding:0 12px;background:var(--sys-bg-secondary,#fff)}
header>div{min-width:0;text-align:center}header h2{margin:0;font-size:15px;font-weight:650;line-height:1.2}header p{margin:2px 0 0;color:var(--text-tertiary,#92959b);font-size:9px}.header-action{height:32px;border:0;background:transparent;color:var(--text-secondary,#6f7379);padding:0;font:inherit;font-size:12px}.header-action:first-child{text-align:left}.header-action:last-child{text-align:right}.header-action.primary{color:#3478c8;font-weight:600}
.sheet-scroll{overflow:auto;padding:12px 13px 18px}.support-note{display:flex;align-items:center;gap:9px;margin-bottom:10px;padding:9px 11px;border:1px solid rgba(57,146,97,.16);border-radius:11px;background:rgba(57,146,97,.07)}.support-note.warning{border-color:rgba(194,116,55,.18);background:rgba(194,116,55,.08)}.support-dot{width:7px;height:7px;flex:0 0 7px;border-radius:50%;background:#3b9a69}.warning .support-dot{background:#c17839}.support-note div{min-width:0}.support-note b,.support-note small{display:block}.support-note b{font-size:11px}.support-note small{margin-top:2px;color:var(--text-tertiary,#888);font-size:9.5px;line-height:1.4}
.settings-card{margin-bottom:10px;overflow:hidden;border:1px solid var(--border-color,rgba(0,0,0,.055));border-radius:13px;background:var(--sys-bg-secondary,#fff)}.settings-card.disabled{opacity:.58}.section-title{min-height:28px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;padding:8px 12px 5px;color:var(--text-tertiary,#8d9197);font-size:9.5px}.section-title em{font-style:normal}.section-title em.ready{color:#3b8e61}
.setting-row{min-height:48px;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 12px;border-top:1px solid var(--border-color,rgba(0,0,0,.055))}.settings-card>.setting-row:first-child,.section-title+.setting-row{border-top:0}.master-row{min-height:54px}.setting-row>span:first-child{min-width:0;flex:1}.setting-row b,.setting-row small{display:block}.setting-row b{overflow:hidden;font-size:12px;font-weight:550;line-height:1.3;text-overflow:ellipsis;white-space:nowrap}.setting-row small{margin-top:3px;color:var(--text-tertiary,#8d9197);font-size:9.5px;line-height:1.35}
.switch{position:relative;width:38px;height:22px;flex:0 0 38px}.switch input{position:absolute;opacity:0;pointer-events:none}.switch i{position:absolute;inset:0;border-radius:12px;background:#c9cbd0;transition:.18s}.switch i:after{content:"";position:absolute;width:18px;height:18px;top:2px;left:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2);transition:.18s}.switch input:checked+i{background:#4f8f75}.switch input:checked+i:after{transform:translateX(16px)}.switch input:focus-visible+i{outline:2px solid #3478c8;outline-offset:2px}
.compact-field{flex:0 0 auto;display:flex;align-items:center;gap:4px}.compact-field input{box-sizing:border-box;width:44px;height:28px;border:1px solid var(--border-color,#ddd);border-radius:7px;background:var(--sys-bg-primary,#f7f7f8);color:var(--text-primary,#222);padding:0 5px;text-align:right;font:inherit;font-size:11px;outline:0}.compact-field em{color:var(--text-tertiary,#888);font-size:10px;font-style:normal}
.field-row{display:block;padding:8px 12px;border-top:1px solid var(--border-color,rgba(0,0,0,.055))}.field-row>span{display:block;margin-bottom:5px;color:var(--text-secondary,#686c72);font-size:10px}.field-row>input,.secret-field input,.split input{box-sizing:border-box;width:100%;height:32px;border:1px solid var(--border-color,#ddd);border-radius:8px;background:var(--sys-bg-primary,#f7f7f8);color:var(--text-primary,#222);padding:0 9px;font:inherit;font-size:11px;outline:0}.field-row input:focus{border-color:#6796c9}.secret-field{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:6px}.secret-field button{height:32px;border:0;border-radius:8px;background:var(--sys-bg-tertiary,#eceef1);color:var(--text-secondary,#666);font:inherit;font-size:10px}.split>span{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(70px,.5fr);gap:7px;margin:0}.split i{font-style:normal;font-size:9.5px}.split input{display:block;margin-top:5px}.privacy-copy{margin:4px 3px 0;color:var(--text-tertiary,#868a90);font-size:9.5px;line-height:1.55}
.real-media-sheet-enter-active,.real-media-sheet-leave-active{transition:opacity .2s}.real-media-sheet-enter-active .real-media-sheet,.real-media-sheet-leave-active .real-media-sheet{transition:transform .22s ease}.real-media-sheet-enter-from,.real-media-sheet-leave-to{opacity:0}.real-media-sheet-enter-from .real-media-sheet,.real-media-sheet-leave-to .real-media-sheet{transform:translateY(24px)}
@media(max-width:340px){.sheet-scroll{padding-left:9px;padding-right:9px}.setting-row{padding-left:10px;padding-right:10px;gap:9px}.setting-row b{font-size:11px}.setting-row small{font-size:9px}.real-media-sheet{border-radius:15px 15px 0 0}}
</style>
