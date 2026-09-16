/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useChatAuth } from '../../../composables/useChatAuth'
import { defaultMomentPaymentSettings, getCharacterMomentPaymentOverride, loadMomentPaymentSettings, saveMomentPaymentSettings, type MomentPaymentOverride } from '../../../services/momentPayments'

const props = defineProps<{
  visible: boolean
  availableCharacters: any[]
  groups: { id: string, name: string }[]
  getMomentBehavior: (chat: any) => any
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'contacts-updated'): void
}>()

const showBehaviorEditor = ref(false)
const behaviorSection = ref<'schedule' | 'interaction' | 'content'>('schedule')
const showAudienceGroupPicker = ref(false)
const selectedBehaviorChatId = ref<string | number | null>(null)
const behaviorDraft = ref<any>({})
const paymentOverrideDraft = ref<MomentPaymentOverride>('inherit')
const globalPaymentSettings = ref(defaultMomentPaymentSettings())
const { currentChatUserId } = useChatAuth()

const loadPaymentSettings = () => { globalPaymentSettings.value = loadMomentPaymentSettings(currentChatUserId.value || 'guest') }
watch(() => props.visible, visible => { if (visible) loadPaymentSettings() })
watch(currentChatUserId, loadPaymentSettings)

const toggleGlobalPayments = () => {
  globalPaymentSettings.value.enabled = !globalPaymentSettings.value.enabled
  saveMomentPaymentSettings(currentChatUserId.value || 'guest', globalPaymentSettings.value)
}

watch(() => behaviorDraft.value.audience, value => { 
  if (['部分可见', '不给谁看'].includes(value)) showAudienceGroupPicker.value = true 
})

const openBehavior = (chat: any) => {
  selectedBehaviorChatId.value = chat.id
  behaviorDraft.value = JSON.parse(JSON.stringify(props.getMomentBehavior(chat)))
  paymentOverrideDraft.value = getCharacterMomentPaymentOverride(chat)
  behaviorSection.value = 'schedule'
  showBehaviorEditor.value = true
}

const closeBehaviorEditor = () => {
  showBehaviorEditor.value = false
  selectedBehaviorChatId.value = null
}

const adjustBehaviorNumber = (field: string, delta: number, min = 0, max = 999) => {
  behaviorDraft.value[field] = Math.min(max, Math.max(min, Number(behaviorDraft.value[field] || 0) + delta))
}

const saveBehavior = () => {
  const chat = props.availableCharacters.find((item: any) => item.id === selectedBehaviorChatId.value)
  if (!chat) return
  chat.momentBehavior = JSON.parse(JSON.stringify(behaviorDraft.value))
  chat.momentPaymentOverride = paymentOverrideDraft.value
  
  const key = localStorage.getItem('clingy_legacy_owner') ? `clingy_custom_contacts_${localStorage.getItem('clingy_legacy_owner')}` : 'clingy_custom_contacts'
  const saved = JSON.parse(localStorage.getItem(key) || '[]')
  const target = saved.find((item: any) => item.id === chat.id)
  if (target) {
    target.momentBehavior = chat.momentBehavior
    target.momentPaymentOverride = chat.momentPaymentOverride
  }
  localStorage.setItem(key, JSON.stringify(saved))
  
  emit('contacts-updated')
  closeBehaviorEditor()
}
</script>

<template>
  <Teleport to="body">
    <!-- 主列表 -->
    <div v-if="visible && !showBehaviorEditor" class="moment-modal-overlay behavior-modal-overlay" @click.self="emit('update:visible', false)">
      <div class="custom-modal behavior-picker-modal">
        <div class="behavior-picker-header">
          <h3>选择要设置的角色</h3>
          <p class="behavior-picker-tip">默认由角色像真人一样自主决定；需要时也可为单个角色启用手动规则。</p>
        </div>
        <button class="behavior-global-payment" @click="toggleGlobalPayments">
          <span><strong>朋友圈收款互动</strong><small>所有角色的默认设置；角色独立设置优先</small></span>
          <i :class="{ on: globalPaymentSettings.enabled }"><b></b></i>
        </button>
        <div class="behavior-role-list">
          <button v-for="chat in availableCharacters" :key="chat.id" class="behavior-role-item" @click="openBehavior(chat)">
            <span>{{ chat.name }}</span><span class="behavior-role-state">{{ getCharacterMomentPaymentOverride(chat) === 'inherit' ? '跟随默认' : getCharacterMomentPaymentOverride(chat) === 'enabled' ? '独立开启' : '独立关闭' }}</span><span class="behavior-role-arrow">›</span>
          </button>
          <div v-if="!availableCharacters.length" class="empty-note">暂无可设置的角色</div>
        </div>
        <div class="behavior-picker-footer">
          <button class="behavior-picker-cancel" @click="emit('update:visible', false)">取消</button>
        </div>
      </div>
    </div>

    <!-- 编辑器 -->
    <div v-if="showBehaviorEditor" class="moment-modal-overlay behavior-modal-overlay" @click.self="closeBehaviorEditor">
      <div class="behavior-panel">
        <header>
          <button @click="closeBehaviorEditor">‹</button>
          <strong>{{ availableCharacters.find((chat: any) => chat.id === selectedBehaviorChatId)?.name }} 的朋友圈</strong>
          <span></span>
        </header>
        <div class="behavior-form">
          <div class="behavior-payment-override">
            <div><b>收款码互动</b><small>独立设置优先于全局默认</small></div>
            <div class="behavior-tristate">
              <button :class="{ active: paymentOverrideDraft === 'inherit' }" @click="paymentOverrideDraft = 'inherit'">跟随</button>
              <button :class="{ active: paymentOverrideDraft === 'enabled' }" @click="paymentOverrideDraft = 'enabled'">开启</button>
              <button :class="{ active: paymentOverrideDraft === 'disabled' }" @click="paymentOverrideDraft = 'disabled'">关闭</button>
            </div>
          </div>
          <div class="behavior-row behavior-mode-row">
            <span><b>真人自主模式</b><small>由角色按人设、情境和关系自由决定，不使用下面的概率、冷却或预设文风</small></span>
            <label class="behavior-switch">
              <input type="checkbox" :checked="behaviorDraft.mode !== 'custom'" @change="behaviorDraft.mode = ($event.target as HTMLInputElement).checked ? 'autonomous' : 'custom'"><i></i>
            </label>
          </div>
          
          <div v-if="behaviorDraft.mode !== 'custom'" class="behavior-autonomous-note">
            已关闭全部行为参数。角色想不想发、发不发图、要不要点赞评论以及怎么说，都由角色自己决定。
          </div>
          <template v-else>
            <div class="behavior-manual-label">高级手动规则</div>
            <div class="behavior-section-nav">
              <button :class="{ active: behaviorSection === 'schedule' }" @click="behaviorSection = 'schedule'">频率</button>
              <button :class="{ active: behaviorSection === 'interaction' }" @click="behaviorSection = 'interaction'">互动</button>
              <button :class="{ active: behaviorSection === 'content' }" @click="behaviorSection = 'content'">内容</button>
            </div>
            
            <template v-if="behaviorSection === 'schedule'">
              <div class="behavior-row"><span>活跃开始</span><div class="stepper"><button @click="adjustBehaviorNumber('activeStart', -1, 0, 23)">−</button><b>{{ behaviorDraft.activeStart }}:00</b><button @click="adjustBehaviorNumber('activeStart', 1, 0, 23)">＋</button></div></div>
              <div class="behavior-row"><span>活跃结束</span><div class="stepper"><button @click="adjustBehaviorNumber('activeEnd', -1, 0, 23)">−</button><b>{{ behaviorDraft.activeEnd }}:00</b><button @click="adjustBehaviorNumber('activeEnd', 1, 0, 23)">＋</button></div></div>
              <div class="behavior-row"><span>发帖冷却</span><div class="stepper"><button @click="adjustBehaviorNumber('postCooldownMinutes', -10)">−</button><b>{{ behaviorDraft.postCooldownMinutes }} 分钟</b><button @click="adjustBehaviorNumber('postCooldownMinutes', 10)">＋</button></div></div>
            </template>
            
            <template v-else-if="behaviorSection === 'interaction'">
              <div class="behavior-row"><span>互动冷却</span><div class="stepper"><button @click="adjustBehaviorNumber('interactCooldownMinutes', -5)">−</button><b>{{ behaviorDraft.interactCooldownMinutes }} 分钟</b><button @click="adjustBehaviorNumber('interactCooldownMinutes', 5)">＋</button></div></div>
              <div class="behavior-slider"><div><span>点赞概率</span><b>{{ behaviorDraft.likeProbability }}%</b></div><input type="range" min="0" max="100" v-model.number="behaviorDraft.likeProbability" /></div>
              <div class="behavior-slider"><div><span>评论概率</span><b>{{ behaviorDraft.commentProbability }}%</b></div><input type="range" min="0" max="100" v-model.number="behaviorDraft.commentProbability" /></div>
            </template>
            
            <template v-else>
              <div class="behavior-slider"><div><span>发图概率</span><b>{{ behaviorDraft.imageProbability }}%</b></div><input type="range" min="0" max="100" v-model.number="behaviorDraft.imageProbability" /></div>
              <div class="behavior-text"><span>额外表达偏好（可留空）</span><textarea v-model="behaviorDraft.style" placeholder="留空时完全遵循角色自己的人设"></textarea></div>
              <button class="behavior-choice" @click="showAudienceGroupPicker = true"><span>默认受众</span><b>{{ behaviorDraft.audience }} <i>›</i></b></button>
            </template>
          </template>
          <button class="behavior-save" @click="saveBehavior">保存设置</button>
        </div>
      </div>
    </div>

    <!-- 受众分组选择 -->
    <div v-if="showAudienceGroupPicker" class="moment-modal-overlay audience-picker-overlay" @click.self="showAudienceGroupPicker = false">
      <div class="moment-sheet">
        <h3>默认受众</h3>
        <button v-for="audience in ['公开', '私密', '部分可见', '不给谁看']" :key="audience" class="audience-option" :class="{ active: behaviorDraft.audience === audience }" @click="behaviorDraft.audience = audience">
          <span>{{ audience }}</span><span v-if="behaviorDraft.audience === audience">✓</span>
        </button>
        <template v-if="['部分可见', '不给谁看'].includes(behaviorDraft.audience)">
          <h3 class="audience-group-title">选择分组</h3>
          <label v-for="group in groups" :key="group.id" class="audience-check">
            <span>{{ group.name }}</span>
            <input type="checkbox" :value="group.id" v-model="behaviorDraft.audienceGroupIds" />
          </label>
          <div v-if="!groups.length" class="empty-note">请先在联系人中创建分组</div>
        </template>
        <button @click="showAudienceGroupPicker = false">确定</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../../app_ChatDiscover.css';
.behavior-global-payment{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 16px 10px;padding:11px 12px;border:1px solid var(--border-color,#e9e9e9);border-radius:10px;background:var(--sys-bg-secondary,#f5f6f8);color:var(--text-primary,#333);text-align:left}.behavior-global-payment>span{display:flex;min-width:0;flex:1;flex-direction:column;gap:3px}.behavior-global-payment strong{font-size:14px}.behavior-global-payment small{color:var(--text-secondary,#888);font-size:11px;line-height:1.35}.behavior-global-payment>i{position:relative;width:42px;height:25px;flex:none;border-radius:15px;background:#d6d9df}.behavior-global-payment>i b{position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.18);transition:.2s}.behavior-global-payment>i.on{background:#576b95}.behavior-global-payment>i.on b{transform:translateX(17px)}.behavior-role-item>span:first-child{overflow:hidden;min-width:0;flex:1;text-align:left;text-overflow:ellipsis;white-space:nowrap}.behavior-role-state{flex:none;color:var(--text-secondary,#888);font-size:11px}.behavior-payment-override{display:flex;flex-direction:column;gap:10px;padding:13px 0;border-bottom:1px solid var(--border-color,#eee)}.behavior-payment-override>div:first-child{display:flex;flex-direction:column;gap:3px}.behavior-payment-override b{font-size:14px}.behavior-payment-override small{color:var(--text-secondary,#888);font-size:11px}.behavior-tristate{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:3px;border-radius:8px;background:var(--sys-bg-secondary,#f3f4f6)}.behavior-tristate button{min-width:0;padding:7px 3px;border:0;border-radius:6px;background:transparent;color:var(--text-secondary,#777);font-size:12px}.behavior-tristate button.active{background:var(--sys-bg-primary,#fff);color:#576b95;box-shadow:0 1px 3px rgba(0,0,0,.08)}
</style>
