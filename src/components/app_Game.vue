<!-- WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useGameHall } from '../composables/useGameHall'
import { gameHallCatalog } from '../services/gameHallEngine'
import type { GameHallGameDefinition, GameHallGameId, GameHallView } from '../types/gameHall'
import './app_Game.css'

const emit = defineEmits<{ (event: 'close'): void }>()
const hall = useGameHall()
const view = ref<GameHallView>('home')
const draft = reactive({ gameId: 'truth-dare' as GameHallGameId, selectedCharacterIds: [] as string[], strangerCount: 1 })
const answer = ref('')
const toast = ref('')
const skipConfirm = ref(false)
const deleteTarget = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const activeSession = computed(() => hall.state.activeSession)
const selectedGame = computed(() => gameHallCatalog.find(item => item.id === draft.gameId)!)
const isPartyGame = computed(() => activeSession.value && !['undercover', 'twenty-one'].includes(activeSession.value.gameId))
const current = computed(() => hall.currentParticipant.value)
const activeUndercoverPlayers = computed(() => activeSession.value?.undercover
  ? activeSession.value.participants.filter(item => !activeSession.value!.undercover!.eliminatedIds.includes(item.id)) : [])
const userUndercoverWord = computed(() => {
  const session = activeSession.value
  const user = session?.participants.find(item => item.kind === 'user')
  return session?.undercover && user ? hall.undercoverWordFor(session.undercover, user.id) : ''
})
const canCreate = computed(() => 1 + draft.selectedCharacterIds.length + draft.strangerCount >= selectedGame.value.minPlayers)
const bridgeHasFields = computed(() => {
  const settings = hall.state.settings.chatBridge
  return [settings.chatReadsGameSummary, settings.chatReadsResults, settings.chatReadsHighlights, settings.chatReadsRoomDialogue].some(Boolean)
})

const notify = (message: string) => {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2400)
}

const openRoom = (game: GameHallGameDefinition) => {
  if (activeSession.value && activeSession.value.status !== 'finished') {
    if (activeSession.value.gameId === game.id) resume()
    else notify(`请先结束或解散正在进行的${gameName(activeSession.value.gameId)}`)
    return
  }
  draft.gameId = game.id; draft.selectedCharacterIds = []; draft.strangerCount = Math.max(1, game.minPlayers - 1)
  view.value = 'room'
}

const toggleCharacter = (id: string) => {
  const index = draft.selectedCharacterIds.indexOf(id)
  if (index >= 0) draft.selectedCharacterIds.splice(index, 1)
  else if (1 + draft.selectedCharacterIds.length + draft.strangerCount < selectedGame.value.maxPlayers) draft.selectedCharacterIds.push(id)
  else notify(`最多 ${selectedGame.value.maxPlayers} 位玩家`)
}

const changeStrangers = (delta: number) => {
  const next = Math.max(0, draft.strangerCount + delta)
  if (1 + draft.selectedCharacterIds.length + next > selectedGame.value.maxPlayers) { notify(`最多 ${selectedGame.value.maxPlayers} 位玩家`); return }
  draft.strangerCount = next
}

const createRoom = async () => {
  try { await hall.createRoom({ ...draft, selectedCharacterIds: [...draft.selectedCharacterIds] }); notify('玩家已经到齐') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '创建房间失败') }
}

const start = () => { hall.startGame(); view.value = 'play' }
const resume = () => { view.value = activeSession.value?.status === 'room' ? 'room' : 'play' }

const submitParty = async () => {
  await hall.answerPartyTurn(answer.value)
  if (!hall.error.value) answer.value = ''
  else notify(hall.error.value)
}

const requestSkip = () => {
  if (hall.state.settings.confirmBeforeSkip) skipConfirm.value = true
  else hall.skipPartyTurn()
}
const confirmSkip = () => { skipConfirm.value = false; hall.skipPartyTurn() }

const submitClue = async () => {
  await hall.submitUndercoverClue(answer.value)
  if (!hall.error.value) answer.value = ''
  else notify(hall.error.value)
}

const endCurrent = () => { hall.finishGame([], '大家决定在这里结束本局。'); notify('本局已结束') }
const backFromPlay = () => { view.value = 'home' }
const leaveRoom = () => { hall.leaveSession(); view.value = 'home' }

const toggleRecordBridge = (id: string, currentValue: boolean) => {
  try { hall.setRecordBridgeApproval(id, !currentValue); notify(currentValue ? '已与普通聊天隔离' : '已授权相关角色聊天参考') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '暂时无法修改授权') }
}

const addFriend = (participantId: string) => {
  try { hall.addStrangerFriend(participantId); notify('已加入聊天好友') }
  catch (cause) { notify(cause instanceof Error ? cause.message : '暂时无法添加好友') }
}

const formatTime = (timestamp?: number) => timestamp ? new Date(timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const gameName = (id: GameHallGameId) => gameHallCatalog.find(item => item.id === id)?.name || '桌游'

onMounted(() => hall.initialize())
</script>

<template>
  <div class="game-app" :class="{ 'reduce-motion': hall.state.settings.reduceMotion }">
    <header class="game-header">
      <button class="game-icon-button" type="button" :aria-label="view === 'home' ? '关闭' : '返回'" @click="view === 'home' ? emit('close') : (view === 'play' ? backFromPlay() : view = 'home')">‹</button>
      <div><h1>{{ view === 'room' ? selectedGame.name : view === 'play' ? (hall.currentGame.value?.name || '游戏中') : view === 'records' ? '游戏记录' : view === 'settings' ? '大厅设置' : '游戏大厅' }}</h1><p>{{ view === 'play' ? `第 ${activeSession?.round || 1} 轮 · ${activeSession?.participants.length || 0} 位玩家` : '和角色、AI陌生玩家一起坐下来玩' }}</p></div>
      <button v-if="view === 'home'" class="game-head-action" type="button" @click="view = 'records'">记录</button><span v-else></span>
    </header>

    <Transition name="game-toast"><div v-if="toast" class="game-toast">{{ toast }}</div></Transition>

    <main v-if="view === 'home'" class="game-scroll">
      <button v-if="activeSession" class="game-resume" type="button" @click="resume">
        <span>{{ activeSession.status === 'room' ? '房间等待中' : activeSession.status === 'playing' ? '继续游戏' : '查看本局结果' }}</span>
        <strong>{{ gameName(activeSession.gameId) }}</strong><small>{{ activeSession.participants.map(item => item.name).join('、') }}</small><i>›</i>
      </button>

      <section class="game-hero">
        <div><small>AI TABLETOP HALL</small><h2>今晚，想和谁玩一局？</h2><p>角色和AI陌生玩家都拥有自己的选择。游戏经历默认不会进入普通聊天。</p></div>
        <span aria-hidden="true">游</span>
      </section>

      <div class="game-section-title"><div><h3>全部游戏</h3><p>每一张卡片都可以真实开局</p></div><span>{{ gameHallCatalog.length }} 款</span></div>
      <section class="game-grid">
        <button v-for="game in gameHallCatalog" :key="game.id" type="button" class="game-card" :style="{ '--game-accent': game.accent }" @click="openRoom(game)">
          <span class="game-card-icon">{{ game.icon }}</span><div><small>{{ game.category }} · {{ game.duration }}</small><strong>{{ game.name }}</strong><p>{{ game.description }}</p><footer><span>{{ game.minPlayers }}–{{ game.maxPlayers }}人</span><span>{{ game.difficulty }}</span><span v-if="game.hasPrivateInfo">隐藏信息</span></footer></div>
          <i :class="{ active: hall.state.favoriteGameIds.includes(game.id) }" @click.stop="hall.toggleFavorite(game.id)">♡</i>
        </button>
      </section>

      <section class="game-safety-note"><span>界</span><div><strong>AI 陌生玩家</strong><p>大厅中的“陌生人”均为明确标注的虚拟玩家，不会连接或冒充现实真人；赛后加好友也只会创建角色联系人。</p></div></section>
    </main>

    <main v-else-if="view === 'room'" class="game-scroll game-room-scroll">
      <section class="game-room-intro" :style="{ '--game-accent': selectedGame.accent }"><span>{{ selectedGame.icon }}</span><div><small>{{ selectedGame.category }} · {{ selectedGame.duration }}</small><h2>{{ selectedGame.name }}</h2><p>{{ selectedGame.description }}</p></div></section>

      <template v-if="!activeSession || activeSession.gameId !== draft.gameId || activeSession.status !== 'room'">
        <div class="game-section-title"><div><h3>邀请聊天角色</h3><p>不选择也可以全部由AI陌生玩家补位</p></div><span>{{ draft.selectedCharacterIds.length }} 位</span></div>
        <section v-if="hall.characters.value.length" class="game-character-list">
          <button v-for="character in hall.characters.value" :key="character.entityId" type="button" :class="{ selected: draft.selectedCharacterIds.includes(character.entityId) }" @click="toggleCharacter(character.entityId)">
            <span>{{ character.name.slice(0, 2) }}</span><div><strong>{{ character.name }}</strong><small>{{ character.socialProfile.signature || '聊天角色' }}</small></div><i>{{ draft.selectedCharacterIds.includes(character.entityId) ? '✓' : '+' }}</i>
          </button>
        </section>
        <div v-else class="game-empty compact"><strong>还没有可邀请的聊天角色</strong><p>可以先使用AI陌生玩家开局，不影响游戏流程。</p></div>

        <div class="game-section-title"><div><h3>AI 陌生玩家</h3><p>会生成独立昵称、人设和游戏习惯</p></div></div>
        <section class="game-stepper-card"><div><span class="game-ai-badge">AI</span><div><strong>虚拟陌生玩家</strong><small>进入房间后始终显示AI标识</small></div></div><div class="game-stepper"><button type="button" @click="changeStrangers(-1)">−</button><strong>{{ draft.strangerCount }}</strong><button type="button" @click="changeStrangers(1)">＋</button></div></section>
        <p class="game-player-count">当前共 {{ 1 + draft.selectedCharacterIds.length + draft.strangerCount }} 人，需要 {{ selectedGame.minPlayers }}–{{ selectedGame.maxPlayers }} 人</p>
        <button class="game-primary" type="button" :disabled="!canCreate || hall.busy.value" @click="createRoom">{{ hall.busy.value ? '正在邀请玩家…' : '创建房间' }}</button>
      </template>

      <template v-else>
        <div class="game-section-title"><div><h3>玩家已到齐</h3><p>AI身份公开显示，不与现实真人混淆</p></div><span>{{ activeSession.participants.length }} 人</span></div>
        <section class="game-seat-grid">
          <article v-for="participant in activeSession.participants" :key="participant.id"><span>{{ participant.avatarText }}</span><strong>{{ participant.name }}</strong><small>{{ participant.kind === 'user' ? '你' : participant.kind === 'character' ? '聊天角色' : 'AI 陌生玩家' }}</small><i>已准备</i></article>
        </section>
        <section class="game-room-privacy"><strong>本局隐私</strong><p>角色人设读取：{{ hall.state.settings.chatBridge.enabled && hall.state.settings.chatBridge.gameReadsCharacterPersona ? '已授权' : '关闭' }}；近期聊天读取：{{ hall.state.settings.chatBridge.enabled && hall.state.settings.chatBridge.gameReadsRecentChat ? '已授权' : '关闭' }}。可在大厅设置中调整。</p></section>
        <button class="game-primary" type="button" @click="start">全部准备，开始游戏</button>
        <button class="game-secondary" type="button" @click="leaveRoom">解散这个房间</button>
      </template>
    </main>

    <main v-else-if="view === 'play' && activeSession" class="game-play">
      <section class="game-table">
        <div class="game-seat-strip">
          <article v-for="(participant, index) in activeSession.participants" :key="participant.id" :class="{ active: index === activeSession.turnIndex, eliminated: activeSession.undercover?.eliminatedIds.includes(participant.id) }"><span>{{ participant.avatarText }}</span><strong>{{ participant.name }}</strong><small>{{ participant.kind === 'ai-stranger' ? 'AI' : participant.kind === 'character' ? '角色' : '你' }}</small></article>
        </div>

        <template v-if="activeSession.status === 'finished'">
          <section class="game-result"><span>局</span><h2>这一局结束了</h2><p>{{ activeSession.summary }}</p><div v-if="activeSession.highlights.length"><strong>桌上片段</strong><small v-for="line in activeSession.highlights.slice(-4)" :key="line">{{ line }}</small></div></section>
          <section v-if="activeSession.participants.some(item => item.kind === 'ai-stranger')" class="game-friend-list"><button v-for="participant in activeSession.participants.filter(item => item.kind === 'ai-stranger')" :key="participant.id" type="button" :disabled="participant.isFriend" @click="addFriend(participant.id)"><span>{{ participant.avatarText }}</span><div><strong>{{ participant.name }}</strong><small>{{ participant.signature }}</small></div><i>{{ participant.isFriend ? '已是好友' : '加为AI好友' }}</i></button></section>
          <button v-if="activeSession.participants.some(item => item.kind === 'character')" class="game-bridge-button" type="button" :class="{ active: activeSession.chatBridgeApproved }" @click="toggleRecordBridge(activeSession.id, activeSession.chatBridgeApproved)">{{ activeSession.chatBridgeApproved ? '已允许相关角色聊天参考本局' : '本局与普通聊天隔离' }}</button>
          <button class="game-primary" type="button" @click="leaveRoom">返回大厅</button>
        </template>

        <template v-else-if="isPartyGame">
          <section class="game-turn-label"><span>轮到</span><strong>{{ current?.name }}</strong><small>{{ current?.kind === 'user' ? '由你回答' : '让TA按自己的想法回答' }}</small></section>
          <section class="game-prompt-card" :style="{ '--game-accent': hall.currentGame.value?.accent }">
            <small>{{ hall.currentGame.value?.shortName }} · 第 {{ activeSession.round }} 轮</small><h2>{{ activeSession.currentCard?.prompt }}</h2>
            <div v-if="activeSession.gameId === 'truth-dare'" class="game-card-options"><p><b>真</b>{{ activeSession.currentCard?.truth }}</p><p><b>敢</b>{{ activeSession.currentCard?.challenge }}</p></div>
            <div v-else-if="activeSession.gameId === 'would-you-rather'" class="game-card-options"><p><b>A</b>{{ activeSession.currentCard?.optionA }}</p><p><b>B</b>{{ activeSession.currentCard?.optionB }}</p></div>
          </section>
          <section v-if="current?.kind === 'user'" class="game-answer-box"><textarea v-model="answer" rows="3" maxlength="800" placeholder="写下你在桌上会说的话…"></textarea><div><button type="button" @click="requestSkip">跳过</button><button type="button" :disabled="hall.busy.value" @click="submitParty">回答</button></div></section>
          <button v-else class="game-primary game-ai-turn" type="button" :disabled="hall.busy.value" @click="submitParty">{{ hall.busy.value ? `${current?.name}正在想…` : `让 ${current?.name} 回答` }}</button>
        </template>

        <template v-else-if="activeSession.gameId === 'undercover' && activeSession.undercover">
          <section class="game-secret-card"><small>你的秘密词语</small><strong>{{ userUndercoverWord }}</strong><p>描述它，但不要直接说出词语或其中的字。</p></section>
          <section v-if="activeSession.undercover.stage === 'clue'" class="game-turn-label"><span>第 {{ activeSession.undercover.round }} 轮描述</span><strong>{{ current?.name }}</strong><small>{{ current?.kind === 'user' ? '轮到你给线索' : '让TA给出线索' }}</small></section>
          <section v-if="activeSession.undercover.stage === 'clue' && current?.kind === 'user'" class="game-answer-box"><textarea v-model="answer" rows="2" maxlength="80" placeholder="一句不露底的描述…"></textarea><div><span></span><button type="button" :disabled="hall.busy.value" @click="submitClue">提交线索</button></div></section>
          <button v-else-if="activeSession.undercover.stage === 'clue'" class="game-primary game-ai-turn" type="button" :disabled="hall.busy.value" @click="submitClue">{{ hall.busy.value ? `${current?.name}正在想…` : `让 ${current?.name} 描述` }}</button>
          <section v-if="activeSession.undercover.stage === 'vote'" class="game-vote-panel"><h2>你觉得谁是卧底？</h2><p>AI玩家会在你投票后完成自己的选择。</p><button v-for="participant in activeUndercoverPlayers.filter(item => item.kind !== 'user')" :key="participant.id" type="button" @click="hall.voteUndercover(participant.id)"><span>{{ participant.avatarText }}</span><strong>{{ participant.name }}</strong><i>投TA</i></button></section>
        </template>

        <template v-else-if="activeSession.gameId === 'twenty-one' && activeSession.twentyOne">
          <section class="game-turn-label"><span>当前行动</span><strong>{{ current?.name }}</strong><small>接近21点，但不要超过</small></section>
          <section class="game-hand"><article v-for="participant in activeSession.participants" :key="participant.id" :class="{ active: participant.id === current?.id }"><header><span>{{ participant.avatarText }}</span><strong>{{ participant.name }}</strong><i>{{ hall.twentyOneValue(activeSession.twentyOne.hands[participant.id] || []) }} 点</i></header><div><b v-for="(card, index) in activeSession.twentyOne.hands[participant.id]" :key="index" :class="{ red: card.suit === '♥' || card.suit === '♦' }">{{ card.suit }}{{ card.rank }}</b></div><small v-if="activeSession.twentyOne.bustedIds.includes(participant.id)">已爆牌</small><small v-else-if="activeSession.twentyOne.stoodIds.includes(participant.id)">已停牌</small></article></section>
          <div v-if="current?.kind === 'user'" class="game-card-actions"><button type="button" @click="hall.twentyOneAction('stand')">停牌</button><button type="button" @click="hall.twentyOneAction('hit')">再抽一张</button></div>
          <button v-else class="game-primary game-ai-turn" type="button" @click="hall.runAiTwentyOneTurn">让 {{ current?.name }} 行动</button>
        </template>
      </section>

      <section v-if="activeSession.status !== 'finished'" class="game-log"><header><strong>桌上动态</strong><button type="button" @click="endCurrent">结束本局</button></header><div><p v-for="message in activeSession.messages.slice(-8)" :key="message.id" :class="message.kind"><b>{{ message.senderName }}</b>{{ message.content }}</p></div></section>
    </main>

    <main v-else-if="view === 'records'" class="game-scroll">
      <div class="game-section-title first"><div><h3>最近玩过</h3><p>记录、聊天授权与AI好友都保存在本机</p></div><span>{{ hall.state.records.length }} 局</span></div>
      <section v-if="hall.state.records.length" class="game-record-list"><article v-for="record in hall.state.records" :key="record.id"><header><span>{{ gameHallCatalog.find(item => item.id === record.gameId)?.icon }}</span><div><strong>{{ gameName(record.gameId) }}</strong><small>{{ formatTime(record.endedAt || record.createdAt) }} · {{ record.participants.length }}人</small></div><button type="button" @click="deleteTarget = record.id">删除</button></header><p>{{ record.summary }}</p><footer><button v-if="record.participants.some(item => item.kind === 'character')" type="button" :class="{ active: record.chatBridgeApproved }" @click="toggleRecordBridge(record.id, record.chatBridgeApproved)">{{ record.chatBridgeApproved ? '聊天可参考' : '与聊天隔离' }}</button><span>{{ record.highlights.length }} 个片段</span></footer></article></section>
      <div v-else class="game-empty"><span>局</span><strong>还没有游戏记录</strong><p>从大厅选择一款游戏，结束后会在这里看到本局摘要。</p></div>
    </main>

    <main v-else-if="view === 'settings'" class="game-scroll">
      <div class="game-section-title first"><div><h3>游玩设置</h3><p>只影响游戏大厅，不改变其他APP</p></div></div>
      <section class="game-setting-group">
        <button type="button" class="game-switch-row" @click="hall.state.settings.soundEnabled = !hall.state.settings.soundEnabled; hall.saveSettings()"><div><strong>游戏音效</strong><small>按钮、发牌和结算提示音</small></div><i :class="{ on: hall.state.settings.soundEnabled }"><b></b></i></button>
        <button type="button" class="game-switch-row" @click="hall.state.settings.reduceMotion = !hall.state.settings.reduceMotion; hall.saveSettings()"><div><strong>减少动态效果</strong><small>降低卡片与页面切换动画</small></div><i :class="{ on: hall.state.settings.reduceMotion }"><b></b></i></button>
        <button type="button" class="game-switch-row" @click="hall.state.settings.confirmBeforeSkip = !hall.state.settings.confirmBeforeSkip; hall.saveSettings()"><div><strong>跳题前确认</strong><small>防止误触跳过当前题目</small></div><i :class="{ on: hall.state.settings.confirmBeforeSkip }"><b></b></i></button>
        <button type="button" class="game-switch-row" @click="hall.state.settings.keepRecords = !hall.state.settings.keepRecords; hall.saveSettings()"><div><strong>保存本机游戏记录</strong><small>关闭后新对局不会写入记录页</small></div><i :class="{ on: hall.state.settings.keepRecords }"><b></b></i></button>
        <button type="button" class="game-switch-row" @click="hall.state.settings.allowAiFriendConversion = !hall.state.settings.allowAiFriendConversion; hall.saveSettings()"><div><strong>允许赛后加AI玩家为好友</strong><small>仅创建虚拟角色联系人，不涉及真人</small></div><i :class="{ on: hall.state.settings.allowAiFriendConversion }"><b></b></i></button>
      </section>

      <div class="game-section-title"><div><h3>聊天联动</h3><p>所有权限默认关闭；总开关关闭时细项不生效</p></div></div>
      <section class="game-setting-group">
        <button type="button" class="game-switch-row master" @click="hall.state.settings.chatBridge.enabled = !hall.state.settings.chatBridge.enabled; hall.saveSettings()"><div><strong>允许游戏与聊天联动</strong><small>同时受以下细项和每局单独授权控制</small></div><i :class="{ on: hall.state.settings.chatBridge.enabled }"><b></b></i></button>
        <button type="button" class="game-switch-row" :disabled="!hall.state.settings.chatBridge.enabled" @click="hall.state.settings.chatBridge.gameReadsCharacterPersona = !hall.state.settings.chatBridge.gameReadsCharacterPersona; hall.saveSettings()"><div><strong>游戏读取角色人设</strong><small>用于角色在牌桌上的表达与选择</small></div><i :class="{ on: hall.state.settings.chatBridge.gameReadsCharacterPersona }"><b></b></i></button>
        <button type="button" class="game-switch-row" :disabled="!hall.state.settings.chatBridge.enabled" @click="hall.state.settings.chatBridge.gameReadsRecentChat = !hall.state.settings.chatBridge.gameReadsRecentChat; hall.saveSettings()"><div><strong>游戏读取近期聊天</strong><small>最多读取最近8条，不读取长期记忆</small></div><i :class="{ on: hall.state.settings.chatBridge.gameReadsRecentChat }"><b></b></i></button>
        <button type="button" class="game-switch-row" :disabled="!hall.state.settings.chatBridge.enabled" @click="hall.state.settings.chatBridge.chatReadsGameSummary = !hall.state.settings.chatBridge.chatReadsGameSummary; hall.saveSettings()"><div><strong>聊天读取游戏摘要</strong><small>仍需在每局结束后单独授权</small></div><i :class="{ on: hall.state.settings.chatBridge.chatReadsGameSummary }"><b></b></i></button>
        <button type="button" class="game-switch-row" :disabled="!hall.state.settings.chatBridge.enabled" @click="hall.state.settings.chatBridge.chatReadsResults = !hall.state.settings.chatBridge.chatReadsResults; hall.saveSettings()"><div><strong>聊天读取胜负结果</strong><small>只写入胜者，不写入秘密词或身份</small></div><i :class="{ on: hall.state.settings.chatBridge.chatReadsResults }"><b></b></i></button>
        <button type="button" class="game-switch-row" :disabled="!hall.state.settings.chatBridge.enabled" @click="hall.state.settings.chatBridge.chatReadsHighlights = !hall.state.settings.chatBridge.chatReadsHighlights; hall.saveSettings()"><div><strong>聊天读取精彩片段</strong><small>最多保留最近5个桌上片段</small></div><i :class="{ on: hall.state.settings.chatBridge.chatReadsHighlights }"><b></b></i></button>
        <button type="button" class="game-switch-row" :disabled="!hall.state.settings.chatBridge.enabled" @click="hall.state.settings.chatBridge.chatReadsRoomDialogue = !hall.state.settings.chatBridge.chatReadsRoomDialogue; hall.saveSettings()"><div><strong>聊天读取房间对话</strong><small>最多读取最近8句公开发言</small></div><i :class="{ on: hall.state.settings.chatBridge.chatReadsRoomDialogue }"><b></b></i></button>
      </section>
      <p class="game-settings-foot">当前聊天写入范围：{{ hall.state.settings.chatBridge.enabled && bridgeHasFields ? '已开启细项，但仍需逐局授权' : '完全隔离' }}。隐藏身份、秘密词和未公开手牌永不写入普通聊天。</p>
    </main>

    <nav v-if="view === 'home' || view === 'records' || view === 'settings'" class="game-nav"><button type="button" :class="{ active: view === 'home' }" @click="view = 'home'"><span>⌂</span><small>大厅</small></button><button type="button" :class="{ active: view === 'records' }" @click="view = 'records'"><span>◫</span><small>记录</small></button><button type="button" :class="{ active: view === 'settings' }" @click="view = 'settings'"><span>⚙</span><small>设置</small></button></nav>

    <div v-if="skipConfirm" class="game-modal-mask" @click.self="skipConfirm = false"><section class="game-modal"><span>跳</span><h2>跳过这一题？</h2><p>任何让你不舒服或不想回答的题目都可以跳过，不会扣分。</p><div><button type="button" @click="skipConfirm = false">继续回答</button><button type="button" @click="confirmSkip">确认跳过</button></div></section></div>
    <div v-if="deleteTarget" class="game-modal-mask" @click.self="deleteTarget = ''"><section class="game-modal"><span>删</span><h2>删除这条记录？</h2><p>本局摘要和聊天授权会一起移除，无法恢复。</p><div><button type="button" @click="deleteTarget = ''">取消</button><button type="button" class="danger" @click="hall.deleteRecord(deleteTarget); deleteTarget = ''; notify('记录已删除')">删除</button></div></section></div>
  </div>
</template>
