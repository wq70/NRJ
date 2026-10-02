<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { danmakuStyleNames } from '../../types/danmaku'
import type { DanmakuSettings, DanmakuViewer } from '../../types/danmaku'
defineProps<{ settings: DanmakuSettings; viewers: DanmakuViewer[]; canShare: boolean; requests: number; manager?: boolean }>()
const emit = defineEmits<{ update: [patch: Partial<DanmakuSettings>]; reset: []; savePreset: [target: 'scene' | 'global']; resetBudget: [] }>()
const numberValue = (event: Event) => Number((event.target as HTMLInputElement).value)
const textValue = (event: Event) => (event.target as HTMLInputElement).value
</script>
<template>
  <div class="dm-settings">
    <label><span>观众模式</span><button type="button" class="dm-toggle" :aria-pressed="settings.enabled" @click="emit('update',{enabled:!settings.enabled})">{{ settings.enabled?'开启':'关闭' }}</button></label>
    <p class="dm-help">开启后仍需选择生成方式。本地短句不调用模型；AI 评论会发送当前允许观看的内容到所配置的 API。</p>
    <label><span>生成方式</span><select :value="settings.generation" @change="emit('update',{generation:textValue($event) as any})"><option value="manual">手动生成</option><option value="auto">自动 · 按完整事件</option><option value="local">本地气氛短句</option></select></label>
    <label><span>显示方式</span><select :value="settings.display" @change="emit('update',{display:textValue($event) as any})"><option value="strip">静态评论条</option><option value="scroll">滚动弹幕</option><option value="list">只在观众席查看</option></select></label>
    <label><span>互动方式</span><select :value="settings.interaction" @change="emit('update',{interaction:textValue($event) as any})"><option value="watch">围观 · 角色不知情</option><option value="share" :disabled="!canShare && !manager">分享 · 手动给 TA 看</option><option value="program" :disabled="!canShare && !manager">节目 · 选择问题让角色回应</option></select></label>
    <p class="dm-help">节目模式在你选中评论后交给角色，不连续自动追问。文游和无角色共赏只支持围观。虚拟投票不改变游戏结果。</p>
    <label><span>评论风格</span><select :value="settings.style" @change="emit('update',{style:textValue($event) as any})"><option v-for="(name,id) in danmakuStyleNames" :key="id" :value="id">{{ name }}</option></select></label>
    <label class="dm-stacked"><span>你的气氛要求</span><textarea :value="settings.instruction" maxlength="500" rows="2" placeholder="例如：像恋综观众，不要全员磕，偶尔理性分析" @change="emit('update',{instruction:textValue($event)})"></textarea></label>
    <label v-for="item in [{key:'visible',name:'显示弹幕（隐藏仍可生成）'},{key:'paused',name:'暂停动画（仍可生成）'},{key:'reduceMotion',name:'减少动态效果'},{key:'showNames',name:'显示昵称'},{key:'remember',name:'参考本分支已有评论接梗'},{key:'randomCast',name:'每批随机观众阵容'}]" :key="item.key"><span>{{ item.name }}</span><button type="button" class="dm-toggle" :aria-pressed="Boolean((settings as any)[item.key])" @click="emit('update',{[item.key]:!(settings as any)[item.key]})">{{ (settings as any)[item.key]?'开启':'关闭' }}</button></label>
    <label v-for="item in [{key:'count',name:'每批条数',min:1,max:8},{key:'maxLength',name:'每条字数上限',min:8,max:80},{key:'maxOnScreen',name:'同屏条数',min:1,max:3},{key:'speed',name:'显示秒数',min:3,max:20},{key:'fontSize',name:'弹幕字号',min:9,max:16},{key:'cooldownSeconds',name:'调用间隔（秒）',min:5,max:300},{key:'everyTurns',name:'每几次事件生成',min:1,max:20},{key:'maxRequests',name:'本场调用上限',min:1,max:200},{key:'maxInputChars',name:'公开正文字符预算',min:500,max:8000},{key:'retentionDays',name:'保留天数（0 为不限）',min:0,max:365}]" :key="item.key"><span>{{ item.name }}</span><input type="number" :min="item.min" :max="item.max" :value="(settings as any)[item.key]" @change="emit('update',{[item.key]:numberValue($event)})"></label>
    <label><span>弹幕透明度</span><input type="range" min="0.3" max="1" step="0.05" :value="settings.opacity" @change="emit('update',{opacity:numberValue($event)})"></label>
    <label><span>统一文字颜色</span><input type="color" :value="settings.color || '#888888'" @input="emit('update',{color:textValue($event)})"><button type="button" @click="emit('update',{color:''})">用观众颜色</button></label>
    <p class="dm-help">观众勾选为空时使用全部未屏蔽观众；随机阵容按活跃度抽选。固定观众仅参考本分支可见内容。</p>
    <div class="dm-chips"><button v-for="viewer in viewers" :key="viewer.id" type="button" :disabled="viewer.blocked" :aria-pressed="settings.viewerIds.includes(viewer.id)" @click="emit('update',{viewerIds:settings.viewerIds.includes(viewer.id)?settings.viewerIds.filter(id=>id!==viewer.id):[...settings.viewerIds,viewer.id]})">{{ viewer.name }}{{ viewer.blocked?'（屏蔽）':'' }}</button></div>
    <label><span>屏蔽预测评论</span><button type="button" class="dm-toggle" :aria-pressed="settings.blockedKinds.includes('prediction')" @click="emit('update',{blockedKinds:settings.blockedKinds.includes('prediction')?settings.blockedKinds.filter(k=>k!=='prediction'):[...settings.blockedKinds,'prediction']})">{{ settings.blockedKinds.includes('prediction')?'开启':'关闭' }}</button></label>
    <p class="dm-help">点选要屏蔽的其他评论类型：</p><div class="dm-chips"><button v-for="item in [{id:'reaction',name:'普通反应'},{id:'question',name:'提问'},{id:'analysis',name:'分析'},{id:'vote',name:'站队'}]" :key="item.id" type="button" :aria-pressed="settings.blockedKinds.includes(item.id)" @click="emit('update',{blockedKinds:settings.blockedKinds.includes(item.id)?settings.blockedKinds.filter(k=>k!==item.id):[...settings.blockedKinds,item.id]})">{{item.name}}</button></div>
    <div class="dm-actions"><button type="button" @click="emit('savePreset','scene')">设为场景默认</button><button type="button" @click="emit('savePreset','global')">设为全局默认</button><button v-if="!manager" type="button" @click="emit('reset')">恢复继承设置</button></div>
    <p class="dm-help">全局默认 → 场景默认 → 当前会话覆盖。保存默认不会覆盖其他会话已单独设置的选项。关闭观众模式会同时停止请求和显示。</p>
    <p class="dm-help" v-if="!manager">本场已调用 {{ requests }} 次。重试和取消已发出的请求也计入限额。</p>
    <button v-if="!manager" type="button" @click="emit('resetBudget')">手动重置本场计数</button>
  </div>
</template>
