<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { normalizeDanmakuSettings } from '../../services/danmakuRuntime'
import { useDanmaku } from '../../composables/useDanmaku'
import type { DanmakuComment, DanmakuSettings as Settings, DanmakuSource } from '../../types/danmaku'
import { danmakuSceneNames, type DanmakuScene } from '../../types/danmaku'
import DanmakuSettings from './DanmakuSettings.vue'
import DanmakuViewers from './DanmakuViewers.vue'
import DanmakuLayer from './DanmakuLayer.vue'
import './danmaku.css'
const props=withDefaults(defineProps<{source:DanmakuSource;manager?:boolean;pause?:boolean;shareAction?:(text:string,targetId?:string)=>Promise<void>|void;shareTargets?:Array<{id:string;name:string}>}>(),{manager:false,pause:false})
const managerScene=ref<DanmakuScene>('chat')
const managerTarget=ref<'global'|'scene'>('global')
const effectiveSource=computed(()=>props.manager?{...props.source,scene:managerScene.value}:props.source)
const dm=useDanmaku(effectiveSource)
const displayedSettings=computed(()=>props.manager?normalizeDanmakuSettings({...dm.state.value.defaults,...(managerTarget.value==='scene'?dm.state.value.scenes[managerScene.value]:{})}):dm.settings.value)
const shareTarget=ref('')
const shareBusy=ref(false)
const hostRef=ref<HTMLElement|null>(null)
const modalStyle=ref<Record<string,string>>({})
const open=ref(props.manager)
watch(open,async active=>{if(!active||!hostRef.value)return;await nextTick();const style=getComputedStyle(hostRef.value);const values:Record<string,string>={fontFamily:style.fontFamily};for(const key of ['--text-primary','--text-secondary','--text-tertiary','--sys-bg-secondary','--sys-bg-tertiary','--border-color']){const value=style.getPropertyValue(key).trim();if(value)values[key]=value}modalStyle.value=values})
const tab=ref<'comments'|'settings'|'viewers'|'records'>(props.manager?'settings':'comments')
const draft=ref('');const clearConfirm=ref(false);const includeExcerpt=ref(true);const latest=ref(true);const focusPaused=ref(false)
const selectionPaused=ref(false)
const otherModal=ref(false)
const canShare=computed(()=>Boolean(props.source.shareAllowed))
const visibleCount=ref(100)
const recordCount=ref<Record<string,number>>({})
const shown=computed(()=>dm.comments.value.slice(-visibleCount.value).reverse())
const voteCounts=computed(()=>{
  const votes=new Map<string,string>()
  dm.comments.value.filter(c=>c.eventId===props.source.triggerId&&c.kind==='vote'&&c.choice).forEach(c=>votes.set(c.viewerId,c.choice!))
  const counts:Record<string,number>={};votes.forEach(choice=>counts[choice]=(counts[choice]||0)+1);return counts
})
const update=(patch:Partial<Settings>)=>dm.update(patch,props.manager?managerTarget.value:'session')
const share=async(comment:DanmakuComment)=>{
  if(!canShare.value||props.source.busy||props.source.scene==='story'||shareBusy.value)return
  if(props.shareTargets?.length&&!props.shareTargets.some(item=>item.id===shareTarget.value)){dm.error.value='请选择一位回应的角色';return}
  const programme=dm.settings.value.interaction==='program'
  const text=programme?`【虚拟综艺观众提问】现在是节目互动环节，虚拟观众「${comment.viewerName}」说：“${comment.text}”。请结合当前公开内容自然回应，不把观众猜测当成事实。`:`我把虚拟观众「${comment.viewerName}」的一条评论给你看：“${comment.text}”`
  const sharingScope=JSON.stringify([props.source.scene,props.source.sessionId,props.source.branchId]);const sharingState=dm.state.value
  shareBusy.value=true;dm.error.value=''
  try{if(!props.shareAction)throw new Error('当前场景没有可回应的角色');await props.shareAction(text,shareTarget.value);if(dm.state.value!==sharingState||JSON.stringify([props.source.scene,props.source.sessionId,props.source.branchId])!==sharingScope)return;dm.editComment(comment,{shared:true});dm.notice.value='已分享给角色';open.value=false}catch(reason){dm.error.value=reason instanceof Error?reason.message:'分享失败，可重试'}finally{shareBusy.value=false}
}
const savePreset=(target:'scene'|'global')=>{dm.update({...displayedSettings.value},target);dm.notice.value=target==='scene'?'已保存为当前场景默认':'已保存为全局默认'}
const submit=()=>{if(dm.addUserComment(draft.value))draft.value=''}
const removeViewer=(id:string)=>{dm.state.value.viewers=dm.state.value.viewers.filter(v=>v.id!==id);void dm.save()}
const exportCards=()=>{
  const comments=(props.manager?Object.values(dm.state.value.sessions).flatMap(s=>s.comments):dm.comments.value).filter(c=>c.favorite)
  if(!comments.length){dm.notice.value='先收藏一条评论，再导出名场面';return}
  const text=comments.map(c=>`${includeExcerpt.value?`${c.excerpt}\n`:''}${c.viewerName}（${c.origin==='ai'?'AI虚拟观众':c.origin==='local'?'本地短句':'用户'}）：${c.text}`).join('\n\n')
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='观众席名场面.txt';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
const clear=()=>{if(props.manager){dm.cancel();for(const s of Object.values(dm.state.value.sessions)){s.comments=s.comments.filter(c=>c.favorite||c.pinned);s.batches=[]};void dm.save()}else dm.clearSession();clearConfirm.value=false}
const recordList=computed(()=>Object.entries(dm.state.value.sessions).map(([key,s])=>({key,...s})).sort((a,b)=>b.updatedAt-a.updatedAt))
const focus=(event:Event)=>{focusPaused.value=Boolean((event.target as HTMLElement)?.matches('input,textarea,[contenteditable=true]'))}
const blur=()=>{focusPaused.value=false}
const selection=()=>{selectionPaused.value=Boolean(document.getSelection()?.toString())}
const checkOtherModal=()=>{otherModal.value=[...document.querySelectorAll('.modal-overlay,.glass-modal-overlay,.canvas-modal-overlay,.live-modal-backdrop,.tg-dialog-layer,.tg-sheet-layer,[role=dialog]')].some(element=>!element.closest('.dm-host,.dm-backdrop')&&element.getClientRects().length>0)}
let modalObserver:MutationObserver|null=null
const scroll=(event:Event)=>{const target=event.target as HTMLElement;if(target?.matches('.message-area,.offline-chat-area'))latest.value=target.scrollHeight-target.scrollTop-target.clientHeight<48}
if(typeof document!=='undefined'){document.addEventListener('focusin',focus);document.addEventListener('focusout',blur);document.addEventListener('scroll',scroll,true);document.addEventListener('selectionchange',selection);modalObserver=new MutationObserver(checkOtherModal);modalObserver.observe(document.body,{childList:true,subtree:true});checkOtherModal()}
onBeforeUnmount(()=>{document.removeEventListener('focusin',focus);document.removeEventListener('focusout',blur);document.removeEventListener('scroll',scroll,true);document.removeEventListener('selectionchange',selection);modalObserver?.disconnect()})
watch(()=>props.shareTargets,targets=>{if(!targets?.some(item=>item.id===shareTarget.value))shareTarget.value=targets?.[0]?.id||''},{immediate:true})
watch(()=>[props.source.sessionId,props.source.branchId],()=>{if(!props.manager)open.value=false;draft.value='';latest.value=true;visibleCount.value=100})
watch(()=>props.source.ready,active=>{if(!active&&!props.manager)open.value=false})
</script>
<template>
  <section class="dm-host" ref="hostRef" :style="{'--dm-lines':Math.min(3,dm.settings.value.maxOnScreen)}" :class="{'dm-manager':manager,'dm-active':!manager&&dm.settings.value.enabled&&dm.settings.value.visible&&dm.settings.value.display!=='list'}" aria-label="虚拟观众">
    <button v-if="!manager" type="button" class="dm-entry" :aria-expanded="open" @click="open=!open">{{dm.settings.value.enabled?'弹 · ':' '}}观众席</button>
    <DanmakuLayer v-if="!manager" :comments="dm.comments.value.filter(c=>c.eventId===source.triggerId||c.pinned)" :settings="dm.settings.value" :playback="dm.playback.value" :pause="pause||open||focusPaused||selectionPaused||otherModal||!latest||source.busy" />
    <Teleport to="body" :disabled="manager">
    <div v-if="open" class="dm-backdrop" :style="modalStyle" @keydown.esc="open=false" :class="{'dm-inline':manager}" @click.self="open=false">
      <section class="dm-sheet" role="dialog" :aria-modal="!manager" aria-label="弹幕与观众">
        <header><div><b>{{manager?'弹幕与观众':source.title||'观众席'}}</b><small>虚拟观众 · {{danmakuSceneNames[source.scene]}}</small></div><button v-if="!manager" type="button" @click="open=false">完成</button></header>
        <nav class="dm-tabs"><button v-for="item in [{id:'comments',name:'观众席'},{id:'settings',name:'设置'},{id:'viewers',name:'观众'},{id:'records',name:'记录'}]" :key="item.id" type="button" :aria-pressed="tab===item.id" @click="tab=item.id as any">{{item.name}}</button></nav>
        <div class="dm-sheet-body">
          <p v-if="!dm.ready.value" class="dm-help">{{dm.loadError.value||'正在读取观众数据…'}}</p><button v-if="dm.loadError.value" type="button" @click="dm.retryLoad()">重新读取</button>
          <div :inert="!dm.ready.value">
          <label v-if="manager" class="dm-row"><span>编辑范围</span><select v-model="managerTarget"><option value="global">全局默认</option><option value="scene">场景默认</option></select></label>
          <label v-if="manager && managerTarget==='scene'" class="dm-row"><span>选择场景</span><select v-model="managerScene"><option v-for="(name,id) in danmakuSceneNames" :key="id" :value="id">{{name}}</option></select></label>
          <template v-if="tab==='comments'">
            <p class="dm-help">{{dm.settings.value.enabled?'评论只保留在观众席；围观模式不会交给角色。':'当前观众模式关闭。开启后，可以手动生成或选择自动生成。'}} {{source.scene==='watch'?'没有可读取字幕或片段时，请在原共赏聊天中描述你看到的内容。':''}}</p>
            <div class="dm-actions"><button type="button" :disabled="!dm.ready.value" @click="update({enabled:!displayedSettings.enabled})">{{displayedSettings.enabled?'关闭观众模式':'开启观众模式'}}</button><button v-if="!manager" type="button" :disabled="!dm.settings.value.enabled||!source.ready||source.busy||dm.busy.value" @click="dm.generate()">{{dm.busy.value?'生成中…':'生成弹幕'}}</button><button v-if="!manager" type="button" :disabled="!dm.settings.value.enabled||!source.ready||source.busy||dm.busy.value" @click="dm.generate(true)">重写本段</button><button v-if="!manager && dm.settings.value.generation!=='manual'" type="button" @click="update({generation:'manual'})">停止自动生成</button><button v-if="dm.busy.value" type="button" @click="dm.stopRequest()">取消请求</button></div>
            <label v-if="shareTargets?.length && dm.settings.value.interaction!=='watch'" class="dm-row"><span>回应角色</span><select v-model="shareTarget"><option v-for="target in shareTargets" :key="target.id" :value="target.id">{{target.name}}</option></select></label>
            <div v-if="Object.keys(voteCounts).length" class="dm-votes"><small>虚拟观众站队（只统计已生成评论，不代表真人）</small><span v-for="(count,choice) in voteCounts" :key="choice">{{choice}} · {{count}}票</span></div>
            <p v-if="!shown.length" class="dm-help">还没有评论。等待完整对话或剧情后，点击“生成弹幕”。也可到设置选择本地气氛短句。</p>
            <article v-for="comment in shown" :key="comment.id" class="dm-comment">
              <div class="dm-comment-head"><span :style="{color:comment.color}">{{comment.viewerName}}</span><small>{{comment.origin==='ai'?'AI虚拟观众':comment.origin==='local'?'本地短句':'用户'}}{{comment.shared?' · 已分享':''}}{{comment.pinned?' · 置顶':''}}</small></div>
              <small v-if="comment.replyToId" class="dm-help">回应：{{dm.comments.value.find(c=>c.id===comment.replyToId)?.text||'一条较早的评论'}}</small><p>{{comment.text}}</p>
              <div class="dm-actions"><button type="button" @click="dm.editComment(comment,{favorite:!comment.favorite})">{{comment.favorite?'取消收藏':'收藏'}}</button><button type="button" @click="dm.editComment(comment,{pinned:!comment.pinned})">{{comment.pinned?'取消置顶':'置顶'}}</button><button v-if="canShare&&dm.settings.value.interaction!=='watch'" type="button" :disabled="source.busy||!source.ready||shareBusy" @click="share(comment)">{{dm.settings.value.interaction==='program'?'请角色回应':'给 TA 看'}}</button><button v-if="comment.origin!=='user'" type="button" @click="dm.state.value.viewers.find(v=>v.id===comment.viewerId) && (dm.state.value.viewers.find(v=>v.id===comment.viewerId)!.blocked=true);dm.save()">屏蔽观众</button></div>
              <div v-if="comment.kind==='prediction'" class="dm-actions"><span>预测核对：</span><button type="button" @click="dm.editComment(comment,{outcome:'correct'})">{{comment.outcome==='correct'?'✓ ':''}}猜中</button><button type="button" @click="dm.editComment(comment,{outcome:'wrong'})">{{comment.outcome==='wrong'?'✓ ':''}}未猜中</button><button v-if="comment.outcome" type="button" @click="dm.editComment(comment,{outcome:undefined})">撤销核对</button></div>
            </article>
            <button v-if="dm.comments.value.length>visibleCount" type="button" @click="visibleCount+=100">查看更早评论</button>
            <form v-if="!manager" class="dm-compose" @submit.prevent="submit"><input v-model="draft" :maxlength="dm.settings.value.maxLength" placeholder="我也发一条观众评论" aria-label="我的观众评论"><button type="submit" :disabled="!draft.trim()||!dm.settings.value.enabled||!source.ready">发送</button></form>
          </template>
          <DanmakuSettings v-else-if="tab==='settings'" :settings="displayedSettings" :viewers="dm.state.value.viewers" :can-share="canShare" :requests="dm.session.value?.requests||0" :manager="manager" @update="update" @reset="dm.resetOverride" @save-preset="savePreset" @reset-budget="dm.session.value && (dm.session.value.requests=0);dm.save()" />
          <DanmakuViewers v-else-if="tab==='viewers'" :viewers="dm.state.value.viewers" @save="dm.save" @remove="removeViewer" />
          <template v-else>
            <p class="dm-help">名场面包含收藏评论，可选择是否带原文。清理保留收藏与置顶；完整备份在高级设置的数据备份中。</p>
            <label class="dm-row"><span>导出包含原文</span><button type="button" :aria-pressed="includeExcerpt" @click="includeExcerpt=!includeExcerpt">{{includeExcerpt?'是':'否'}}</button></label><div class="dm-actions"><button type="button" @click="exportCards">导出名场面</button><button type="button" @click="clearConfirm=true">清理{{manager?'所有':'本场'}}普通评论</button></div>
            <div v-if="clearConfirm" class="dm-actions"><span>保留收藏与置顶，清理其他评论？</span><button type="button" @click="clear">确定</button><button type="button" @click="clearConfirm=false">取消</button></div>
            <template v-if="manager"><details v-for="record in recordList" :key="record.key"><summary>{{record.title}} · {{record.comments.length}}条</summary><article v-for="comment in record.comments.slice(-(recordCount[record.key]||100)).reverse()" :key="comment.id" class="dm-comment"><small>{{comment.origin==='ai'?'AI虚拟观众':comment.origin==='local'?'本地短句':'用户'}}</small><p>{{comment.viewerName}}：{{comment.text}}</p><details><summary>对应原文</summary><p>{{comment.excerpt}}</p></details><button type="button" @click="comment.favorite=!comment.favorite;dm.save()">{{comment.favorite?'取消收藏':'收藏'}}</button></article><button v-if="record.comments.length>(recordCount[record.key]||100)" type="button" @click="recordCount[record.key]=(recordCount[record.key]||100)+100">查看更多</button></details></template>
            <details v-for="comment in dm.comments.value.filter(c=>c.favorite)" :key="comment.id"><summary>{{comment.viewerName}}：{{comment.text}}</summary><p>{{comment.excerpt}}</p></details>
          </template>
          </div>
          <p v-if="dm.error.value" class="dm-error" role="alert">{{dm.error.value}}</p><p v-if="dm.notice.value" class="dm-help" role="status">{{dm.notice.value}}</p>
        </div>
      </section>
    </div>
    </Teleport>
  </section>
</template>
