/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  visible: boolean
  moment: any
  formatTime: (time: number | string) => string
  currentActor: { id: string, name: string }
  resolveEmojiUrl: (comment: any) => string
  isReceiptActive: (moment: any) => boolean
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'preview', url: string): void
  (e: 'submit-comment', momentId: string, content: string, target?: { id: string, author: string }): void
  (e: 'toggle-like', comment: any): void
  (e: 'play-voice', item: any): void
  (e: 'request-media', kind: 'voice' | 'emoji', moment: any, target?: { id: string, author: string }): void
}>()

const commentDraft = ref('')
const replyTarget = ref<{ id: string, author: string } | null>(null)

const prepareDetailComment = (target: any = null) => {
  replyTarget.value = target ? { id: target.id, author: target.author } : null
  commentDraft.value = ''
}

const handleSubmit = () => {
  if (!commentDraft.value.trim()) return
  emit('submit-comment', props.moment.id, commentDraft.value.trim(), replyTarget.value || undefined)
  commentDraft.value = ''
  replyTarget.value = null
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible && moment" class="moment-modal-overlay" @click.self="emit('update:visible', false)">
      <div class="moment-detail-modal">
        <header>
          <button @click="emit('update:visible', false)">‹</button>
          <strong>详情</strong>
          <span></span>
        </header>
        <section>
          <div class="detail-author">{{ moment.author }}</div>
          <p>{{ moment.content }}</p>
          <div class="detail-meta-row">
            <span>{{ formatTime(moment.time) }}</span>
            <span>{{ moment.visibility || '公开' }}</span>
            <span v-if="moment.updatedAt">已编辑</span>
          </div>
          <div v-if="moment.location" class="moment-meta">⌖ {{ moment.location }}</div>
          <div v-if="moment.mentions?.length" class="moment-meta">
            @{{ moment.mentions.map((person: any) => person.name).join(' @') }}
          </div>

          <button v-if="moment.voice" class="moment-voice-bubble detail-voice" @click="emit('play-voice', moment)"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg><span>{{ moment.voice.seconds || 1 }}″</span><small>{{ moment.voice.text || '语音动态' }}</small></button>

          <div v-if="moment.receiptCode" class="moment-receipt-card detail-receipt">
            <img :src="moment.receiptCode.posterDataUrl" alt="朋友圈收款码" @click="emit('preview', moment.receiptCode.posterDataUrl)" />
            <div><strong>收款码</strong><span>{{ isReceiptActive(moment) ? (moment.receiptCode.amountCents ? `¥${(moment.receiptCode.amountCents / 100).toFixed(2)}` : '金额由好友填写') : '已失效' }}</span><small v-if="moment.receiptCode.remark">{{ moment.receiptCode.remark }}</small><small v-if="moment.receiptPayments?.length">已收到 {{ moment.receiptPayments.length }} 笔</small></div>
          </div>
          
          <div class="detail-grid" :class="`count-${Math.min(moment.images?.length || 0, 9)}`">
            <img v-for="(img, index) in moment.images || []" :key="index" :src="img" @click="emit('preview', img)" />
          </div>
          
          <div class="detail-like-list" v-if="moment.likes?.length">
            ♡ {{ moment.likes.join('、') }}
          </div>
          <div class="detail-like-list" v-if="moment.views?.length">
            浏览：{{ moment.views.map((person: any) => person.name).join('、') }}
          </div>
          
          <div class="detail-comment-list">
            <div v-for="comment in moment.comments || []" :key="comment.id" @click="prepareDetailComment(comment)">
              <b>{{ comment.author }}</b>
              <span v-if="comment.replyToAuthor"> 回复 <b>{{ comment.replyToAuthor }}</b></span>：
              <button v-if="comment.kind === 'voice'" class="inline-voice" @click.stop="emit('play-voice', comment)">▶ {{ comment.voice?.seconds || 1 }}″</button>
              <img v-else-if="comment.kind === 'emoji' && resolveEmojiUrl(comment)" :src="resolveEmojiUrl(comment)" :alt="comment.emojiName || '表情包'" class="comment-emoji" />
              <template v-else>{{ comment.content }}</template>
              <button @click.stop="emit('toggle-like', comment)">
                ♡{{ comment.likes?.length || '' }}
              </button>
            </div>
          </div>
          
          <div class="detail-composer">
            <span v-if="replyTarget">回复 {{ replyTarget.author }}</span>
            <input 
              v-model="commentDraft" 
              :placeholder="replyTarget ? `回复 ${replyTarget.author}` : '写评论…'" 
              @keyup.enter="handleSubmit"
            />
            <button class="detail-media-btn" @click="emit('request-media', 'voice', moment, replyTarget || undefined)">语音</button>
            <button class="detail-media-btn" @click="emit('request-media', 'emoji', moment, replyTarget || undefined)">表情</button>
            <button :disabled="!commentDraft.trim()" @click="handleSubmit">发送</button>
          </div>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@import '../../app_ChatDiscover.css';
</style>
