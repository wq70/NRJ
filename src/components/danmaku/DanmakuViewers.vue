<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { ref } from 'vue'
import type { DanmakuViewer } from '../../types/danmaku'
const props = defineProps<{ viewers: DanmakuViewer[] }>()
const emit = defineEmits<{ save: []; remove: [id: string] }>()
const removing = ref('')
const add = () => { if(props.viewers.length>=40)return; props.viewers.push({id:crypto.randomUUID(),name:'新观众',persona:'根据公开内容自然评论，保持独立观点。',color:'#888888',activity:2,blocked:false});emit('save') }
</script>
<template>
  <div class="dm-viewers">
    <p class="dm-help">这里的观众均为虚拟角色。昵称、性格和活跃度影响评论；头像用昵称首字与代表色表示。</p>
    <article v-for="viewer in viewers" :key="viewer.id">
      <div class="dm-row"><i class="dm-avatar" :style="{color:viewer.color}">{{ viewer.name.slice(0,1) }}</i><input v-model="viewer.name" maxlength="30" aria-label="观众昵称" @change="emit('save')"><input v-model="viewer.color" type="color" aria-label="观众代表色" @input="emit('save')"></div>
      <textarea v-model="viewer.persona" maxlength="500" rows="2" aria-label="观众性格与口吻" @change="emit('save')"></textarea>
      <div class="dm-row"><span>活跃度</span><select v-model.number="viewer.activity" @change="emit('save')"><option :value="1">偶尔</option><option :value="2">适中</option><option :value="3">活跃</option></select><button type="button" :aria-pressed="viewer.blocked" @click="viewer.blocked=!viewer.blocked;emit('save')">{{viewer.blocked?'解除屏蔽':'屏蔽'}}</button><button type="button" @click="removing=viewer.id">删除</button></div>
      <div v-if="removing===viewer.id" class="dm-row"><span>删除观众？历史评论保留。</span><button type="button" @click="emit('remove',viewer.id);removing=''">确定</button><button type="button" @click="removing=''">取消</button></div>
    </article>
    <button type="button" :disabled="viewers.length>=40" @click="add">＋添加观众</button>
  </div>
</template>
