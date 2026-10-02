<script setup lang="ts">
import { ref } from 'vue'
import type { CharacterPhoneAppKind, CharacterPhoneDevice, CharacterPhoneRecord } from '../../types/characterPhone'
import PhoneIcon from './PhoneIcon.vue'
defineProps<{ record: CharacterPhoneRecord; device: CharacterPhoneDevice }>()
const emit = defineEmits<{ save: []; add: [name: string, kind: CharacterPhoneAppKind]; wallpaper: [file: File]; lock: []; devices: [] }>()
const name = ref(''), kind = ref<CharacterPhoneAppKind>('list')
const switches = [
  ['enabled', '启用角色手机', '保留手机资料，并允许相关联动功能读取。'],
  ['allowUseDuringChat', '单聊中允许使用', '角色可以在聊天时使用手机。'],
  ['allowBackgroundUse', '后台活动允许使用', '允许角色在后台活动中使用设备。'],
  ['bridgeToChat', '手机事件影响单聊', '已符合知情条件的事件可以进入聊天。'],
  ['chatToPhone', '聊天同步到手机记录', '将关联单聊同步到角色手机记录。'],
  ['allowDeepReadFollowup', '允许主动深读 APP', '可能产生额外模型调用。'],
  ['userOperationsDiscoverable', '用户操作可被发现', '编辑、代发等行为可以在角色查看时被发现。'],
  ['allowHighImpactActions', '允许高影响操作', '沿用角色手机现有的操作权限规则。'],
] as const
const add = () => { if (name.value.trim()) { emit('add', name.value.trim(), kind.value); name.value = '' } }
const upload = (event: Event) => { const input = event.target as HTMLInputElement; if (input.files?.[0]) emit('wallpaper', input.files[0]); input.value = '' }
</script>
<template>
  <div class="phone-scroll phone-settings">
    <div class="phone-device-summary"><PhoneIcon name="device"/><div><h2>{{ device.name }}</h2><p>{{ device.purpose }} · {{ device.battery }}%</p></div></div>
    <h3>设备与外观</h3><section>
      <label>设备名称<input v-model="device.name" maxlength="40" @change="emit('save')"></label>
      <label>用途<input v-model="device.purpose" maxlength="120" @change="emit('save')"></label>
      <label>壁纸地址<input v-model="device.wallpaper" placeholder="https://…" @change="emit('save')"></label>
      <label class="phone-upload">选择本地壁纸<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="upload"></label>
      <label>静音<input v-model="device.silent" class="phone-switch" type="checkbox" @change="emit('save')"></label>
      <label>勿扰模式<input v-model="device.doNotDisturb" class="phone-switch" type="checkbox" @change="emit('save')"></label>
      <label>设备参与角色活动<input v-model="device.active" class="phone-switch" type="checkbox" @change="emit('save')"></label>
      <div class="phone-actions"><button @click="emit('devices')">切换与管理设备</button><button @click="emit('lock')">立即锁屏</button></div>
    </section>
    <h3>锁屏</h3><section>
      <label>解锁方式<select v-model="device.lockType" @change="emit('save')"><option value="none">无</option><option value="pin">数字</option><option value="password">英文／混合</option><option value="pattern">图案序列</option><option value="biometric">生物识别</option></select></label>
      <label v-if="device.lockType !== 'none'">{{ device.lockType === 'biometric' ? '备用凭据' : '凭据' }}<input v-model="device.lockCredential" @change="emit('save')"></label>
      <p v-if="device.lockType==='pattern'" class="phone-hint">九个点从左到右、从上到下编号 1–9，例如 12369。旧图案凭据仍可通过文本输入使用。</p>
      <p v-if="device.lockType==='biometric'" class="phone-hint">这是虚构设备设定，使用备用凭据解锁，不调用真实生物识别。</p>
      <label v-if="device.lockType !== 'none'">设置原因<textarea v-model="device.lockReason" rows="2" @change="emit('save')"></textarea></label>
    </section>
    <h3>角色与手机联动</h3><section>
      <label v-for="[key,title,description] in switches" :key="key"><span>{{ title }}<small>{{ description }}</small></span><input v-model="record.settings[key]" class="phone-switch" type="checkbox" @change="emit('save')"></label>
    </section>
    <details><summary>高级设置</summary><section>
      <label>上下文预算<input v-model.number="record.settings.contextTokenBudget" type="number" min="100" max="3000" @change="emit('save')"></label>
      <label>每次操作上限<input v-model.number="record.settings.maxActionsPerRun" type="number" min="1" max="20" @change="emit('save')"></label>
      <label>每日后台操作上限<input v-model.number="record.settings.dailyBackgroundLimit" type="number" min="0" max="200" @change="emit('save')"></label>
      <p class="phone-hint">今日后台操作：{{ record.settings.backgroundActionsToday }}</p>
    </section></details>
    <h3>应用管理</h3><section>
      <details v-for="a in device.apps" :key="a.id"><summary>{{ a.name }}</summary>
        <label>排列与隐藏<span class="phone-app-order"><button :disabled="device.apps.indexOf(a)===0" :aria-label="`前移${a.name}`" @click="device.apps.splice(device.apps.indexOf(a)-1,0,device.apps.splice(device.apps.indexOf(a),1)[0]!);emit('save')">↑</button><button :disabled="device.apps.indexOf(a)===device.apps.length-1" :aria-label="`后移${a.name}`" @click="device.apps.splice(device.apps.indexOf(a)+1,0,device.apps.splice(device.apps.indexOf(a),1)[0]!);emit('save')">↓</button><input v-model="a.hidden" type="checkbox" :aria-label="`隐藏${a.name}`" class="phone-switch" @change="emit('save')"></span></label>
        <label>桌面文件夹<input v-model="a.folder" maxlength="20" placeholder="留空则在桌面显示" @change="emit('save')"></label>
        <label>常用栏<input :checked="a.dock ?? ['chat','calls','photos','browser'].includes(a.kind)" class="phone-switch" type="checkbox" @change="a.dock=($event.target as HTMLInputElement).checked;emit('save')"></label>
      </details>
      <p class="phone-hint">右侧开关开启表示从桌面隐藏；这里始终可以恢复。</p>
      <label>自定义 APP<input v-model="name" maxlength="30" placeholder="应用名称" @keyup.enter="add"></label>
      <label>内容类型<select v-model="kind"><option value="list">清单</option><option value="feed">信息流</option><option value="gallery">图库</option><option value="records">记录</option><option value="dashboard">看板</option><option value="page">文档</option></select></label>
      <button :disabled="!name.trim()" @click="add">添加应用</button>
    </section>
  </div>
</template>
