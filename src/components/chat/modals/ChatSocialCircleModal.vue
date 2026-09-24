/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import ChatSocialCircleEditModal, { type SocialContactItem } from './ChatSocialCircleEditModal.vue'
import DualAestheticWidget from '../../DualAestheticWidget.vue'
import { useMusicPlayer } from '../../../composables/useMusicPlayer'
import { generateSocialCircleDraft, normalizeSocialCircleSettings, type SocialCircleSettings } from '../../../services/socialGraph'
import { generateSocialThemeSong, socialThemeContext, socialThemeTrackKey } from '../../../services/socialThemeMusic'
import { syncSocialCircleToDirectory } from '../../../services/characterDirectory'
import { removeSocialAvatarIfUnused, resolveSocialAvatarSource, saveSocialAvatarAsset } from '../../../services/socialAvatar'

const props = defineProps<{
  visible: boolean
  selectedChat: any
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'save'): void
}>()

const activeTab = ref<'all' | 'family' | 'friend' | 'work' | 'other'>('all')
const showEditModal = ref(false)
const editingContact = ref<SocialContactItem | null>(null)
const searchQuery = ref('')
const generating = ref(false)
const generationError = ref('')
const themeGenerating = ref(false)
const themeError = ref('')
let themeRequestId = 0
const avatarSources = ref<Record<string, string>>({})
let avatarLoadToken = 0
const avatarObjectUrls = new Set<string>()
const musicPlayer = useMusicPlayer()

const settings = computed<SocialCircleSettings>(() => normalizeSocialCircleSettings(props.selectedChat))
const themeSong = computed(() => settings.value.themeSong)
const themeStale = computed(() => Boolean(themeSong.value && props.selectedChat && themeSong.value.contextKey !== socialThemeContext(props.selectedChat)))
const selectedThemeOption = computed(() => themeSong.value?.options[themeSong.value.selectedIndex] || null)
const themeIsPlayingTrack = computed(() => Boolean(selectedThemeOption.value && musicPlayer.currentTrack.value &&
  selectedThemeOption.value.track.sourceId === musicPlayer.currentTrack.value.sourceId &&
  selectedThemeOption.value.track.sourceTrackId === musicPlayer.currentTrack.value.sourceTrackId))
const persist = () => {
  if (!props.selectedChat) return
  settings.value.updatedAt = Date.now()
  syncSocialCircleToDirectory(props.selectedChat)
  emit('save')
}

const socialList = computed<SocialContactItem[]>({
  get: () => {
    if (!props.selectedChat) return []
    if (!Array.isArray(props.selectedChat.socialCircle)) {
      props.selectedChat.socialCircle = []
    }
    return props.selectedChat.socialCircle
  },
  set: (val) => {
    if (props.selectedChat) {
      props.selectedChat.socialCircle = val
    }
  }
})

const stats = computed(() => {
  const list = socialList.value
  return {
    total: list.length,
    family: list.filter((i) => i.category === 'family').length,
    friend: list.filter((i) => i.category === 'friend').length,
    work: list.filter((i) => i.category === 'work').length,
    other: list.filter((i) => i.category === 'other').length
  }
})

const topFourAvatars = computed(() => {
  const result: string[] = []
  for (const item of socialList.value) {
    const src = avatarSources.value[item.id] || item.avatarUrl || ''
    if (src) result.push(src)
    if (result.length >= 4) break
  }
  return result
})

const filteredList = computed(() => {
  let list = socialList.value
  if (activeTab.value !== 'all') {
    list = list.filter((item) => item.category === activeTab.value)
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    list = list.filter(
      (item) =>
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.relation && item.relation.toLowerCase().includes(q)) ||
        (item.persona && item.persona.toLowerCase().includes(q))
    )
  }
  return list
})

const revokeAvatarObjectUrls = () => {
  avatarObjectUrls.forEach(url => URL.revokeObjectURL(url))
  avatarObjectUrls.clear()
}

const refreshAvatarSources = async () => {
  const token = ++avatarLoadToken
  let migratedLegacyAvatar = false
  for (const item of socialList.value) {
    if (item.avatarKey || !item.avatarUrl?.startsWith('data:image/')) continue
    try {
      item.avatarKey = await saveSocialAvatarAsset(item.entityId, item.avatarUrl)
      item.avatarUrl = ''
      item.updatedAt = Date.now()
      migratedLegacyAvatar = true
    } catch {
      // 旧头像迁移失败时保留原数据，避免影响现有显示和人物资料。
    }
  }
  if (migratedLegacyAvatar) persist()
  const entries = await Promise.all(socialList.value.map(async item => {
    const resolved = await resolveSocialAvatarSource(item.avatarKey, item.avatarUrl)
    return { id: item.id, ...resolved }
  }))
  if (token !== avatarLoadToken) {
    entries.filter(item => item.objectUrl).forEach(item => URL.revokeObjectURL(item.url))
    return
  }
  revokeAvatarObjectUrls()
  const next: Record<string, string> = {}
  entries.forEach(item => {
    next[item.id] = item.url
    if (item.objectUrl) avatarObjectUrls.add(item.url)
  })
  avatarSources.value = next
}

watch(
  () => [props.visible, socialList.value.map(item => `${item.id}:${item.avatarKey || ''}:${item.avatarUrl || ''}`).join('|')],
  () => {
    if (props.visible) void refreshAvatarSources()
    else {
      avatarLoadToken += 1
      revokeAvatarObjectUrls()
      avatarSources.value = {}
    }
  },
  { immediate: true }
)

watch(() => props.selectedChat?.id, () => {
  themeRequestId += 1
  themeGenerating.value = false
  themeError.value = ''
})

onBeforeUnmount(() => {
  avatarLoadToken += 1
  revokeAvatarObjectUrls()
})

const handleClose = () => {
  emit('update:visible', false)
}

const openCreateModal = () => {
  editingContact.value = null
  showEditModal.value = true
}

const openEditModal = (item: SocialContactItem) => {
  editingContact.value = item
  showEditModal.value = true
}

const handleSaveContact = (item: SocialContactItem) => {
  const list = [...socialList.value]
  const idx = list.findIndex((c) => c.id === item.id)
  const previousAvatarKey = idx !== -1 ? list[idx].avatarKey : ''
  if (idx !== -1) {
    list[idx] = item
  } else {
    list.unshift(item)
  }
  socialList.value = list
  persist()
  if (previousAvatarKey && previousAvatarKey !== item.avatarKey) void removeSocialAvatarIfUnused(previousAvatarKey)
}

const handleDeleteContact = (id: string) => {
  const previousAvatarKey = socialList.value.find(item => item.id === id)?.avatarKey
  socialList.value = socialList.value.filter((item) => item.id !== id)
  persist()
  if (previousAvatarKey) void removeSocialAvatarIfUnused(previousAvatarKey)
}

// 快速生成预设示例
const generatePresets = async () => {
  if (!props.selectedChat || generating.value) return
  generating.value = true
  generationError.value = ''
  try {
    const draft = await generateSocialCircleDraft(props.selectedChat, settings.value.generationCount)
    const existingNames = new Set(socialList.value.map(item => item.name.trim().toLowerCase()))
    socialList.value = [...draft.filter(item => !existingNames.has(item.name.trim().toLowerCase())), ...socialList.value]
    persist()
  } catch (error: any) {
    generationError.value = error?.message || '人脉生成失败，请检查 API 设置后重试'
  } finally {
    generating.value = false
  }
}

const generateTheme = async (excludeCurrent = false) => {
  const chat = props.selectedChat
  if (!chat || themeGenerating.value || settings.value.themeSong?.pinned || !settings.value.enabled || !settings.value.themeMusicEnabled) return
  const chatId = chat.id
  const contextKey = socialThemeContext(chat)
  const requestId = ++themeRequestId
  themeGenerating.value = true
  themeError.value = ''
  try {
    const excluded = excludeCurrent ? (settings.value.themeSong?.options || []).map(item => socialThemeTrackKey(item.track)) : []
    const result = await generateSocialThemeSong(chat, excluded)
    if (requestId !== themeRequestId || props.selectedChat?.id !== chatId || !settings.value.enabled || !settings.value.themeMusicEnabled || socialThemeContext(chat) !== contextKey) return
    settings.value.themeSong = result
    persist()
  } catch (error: any) {
    if (requestId === themeRequestId && props.selectedChat?.id === chatId) themeError.value = error?.message || '选曲失败，请稍后重试'
  } finally {
    if (requestId === themeRequestId) themeGenerating.value = false
  }
}

const toggleTheme = () => {
  persist()
  if (settings.value.themeMusicEnabled && !settings.value.themeSong) void generateTheme()
  if (!settings.value.themeMusicEnabled) {
    themeRequestId += 1
    themeGenerating.value = false
    themeError.value = ''
  }
}

const changeTheme = () => {
  const song = themeSong.value
  if (!song || song.pinned || themeGenerating.value) return
  if (song.selectedIndex + 1 < song.options.length) {
    song.selectedIndex += 1
    song.pinned = false
    persist()
  } else {
    void generateTheme(true)
  }
}

const toggleThemePinned = () => {
  if (!themeSong.value) return
  themeSong.value.pinned = !themeSong.value.pinned
  persist()
}

const playTheme = () => {
  if (selectedThemeOption.value) void musicPlayer.playTrack(selectedThemeOption.value.track)
}

const useCurrentAsTheme = () => {
  const track = musicPlayer.currentTrack.value
  if (!track || !props.selectedChat) return
  themeRequestId += 1
  themeGenerating.value = false
  settings.value.themeSong = {
    options: [{ track: { ...track, sourceCandidates: undefined }, reason: '你手动选定的主题曲' }],
    selectedIndex: 0,
    contextKey: socialThemeContext(props.selectedChat),
    pinned: true,
    generatedAt: Date.now()
  }
  themeError.value = ''
  persist()
}
</script>

<template>
  <div v-if="visible" class="journal-overlay" @click.self="handleClose">
    <div class="journal-container">
      <!-- 手账顶栏 -->
      <div class="journal-header">
        <button class="journal-nav-btn" title="关闭" @click="handleClose">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.2" fill="none">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div class="journal-header-title">
          <span class="main-title">生活手账 · 人脉漫游</span>
          <span class="sub-title">MEMORIES & CONNECTIONS</span>
        </div>
        <button class="journal-add-btn" title="添加便签" @click="openCreateModal">
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>添加</span>
        </button>
      </div>

      <!-- 主体内页（纯白极简风格） -->
      <div class="journal-page-body">
        <!-- 扉页：1:1 纯白随身听双联卡片（无背景纯白精致） -->
        <div class="journal-hero-aesthetic-wrap">
          <DualAestheticWidget
            :standalone="true"
            :owner-chat="selectedChat"
            :sub-avatars="topFourAvatars"
            :theme-song="selectedThemeOption?.track || null"
          />

          <div v-if="settings.enabled && settings.themeMusicEnabled" class="theme-music-strip">
            <div class="theme-music-copy">
              <strong>{{ themeGenerating ? '正在寻找适配的歌…' : selectedThemeOption ? '人脉主题曲' : '尚未选出主题曲' }}</strong>
              <span v-if="selectedThemeOption">{{ selectedThemeOption.track.title }} · {{ selectedThemeOption.track.artist }}</span>
              <span v-if="selectedThemeOption?.reason" class="theme-music-reason">{{ selectedThemeOption.reason }}</span>
              <span v-if="selectedThemeOption && musicPlayer.currentTrack.value && !themeIsPlayingTrack" class="theme-music-note">当前播放的是其他歌曲</span>
              <span v-if="themeIsPlayingTrack && musicPlayer.playbackError.value" class="theme-music-error">{{ musicPlayer.playbackError.value }}</span>
              <span v-if="themeStale && !themeSong?.pinned" class="theme-music-note">人设或人脉已变化，可重新匹配</span>
              <span v-if="themeError" class="theme-music-error">{{ themeError }}</span>
            </div>
            <div class="theme-music-actions">
              <button v-if="selectedThemeOption && !themeIsPlayingTrack" type="button" @click="playTheme">播放主题曲</button>
              <button v-if="!selectedThemeOption && musicPlayer.currentTrack.value" type="button" @click="useCurrentAsTheme">设当前歌</button>
              <button v-if="selectedThemeOption" type="button" :disabled="themeGenerating || themeSong?.pinned" @click="changeTheme">换一首</button>
              <button v-if="selectedThemeOption" type="button" :disabled="themeGenerating" @click="toggleThemePinned">{{ themeSong?.pinned ? '已固定' : '固定' }}</button>
              <button v-if="!selectedThemeOption || themeStale" type="button" :disabled="themeGenerating || themeSong?.pinned" @click="generateTheme()">{{ selectedThemeOption ? '重新匹配' : '匹配歌曲' }}</button>
            </div>
          </div>

          <!-- 统计与空状态生成条 -->
          <div class="hero-sub-stats-bar">
            <div class="hero-stats-chips">
              <span class="stats-chip">全部 <b>{{ stats.total }}</b></span>
              <span class="stats-chip">亲人 <b>{{ stats.family }}</b></span>
              <span class="stats-chip">好友 <b>{{ stats.friend }}</b></span>
              <span class="stats-chip">工作 <b>{{ stats.work }}</b></span>
            </div>
            <button v-if="socialList.length === 0" class="hero-ai-gen-link" :disabled="generating" @click="generatePresets">
              {{ generating ? '生成中…' : '一键生成人脉' }}
            </button>
          </div>
        </div>

        <!-- 角色人脉圈核心控制区（去卡片化平铺布局，融入整体页面） -->
        <section class="social-settings-section">
          <!-- 核心开关项 -->
          <div class="section-master-bar">
            <div class="master-info">
              <div class="master-title-line">
                <span class="master-status-indicator" :class="{ active: settings.enabled }"></span>
                <span class="master-title">启用角色人脉圈</span>
                <span class="master-badge">{{ settings.enabled ? '已激活' : '已停用' }}</span>
              </div>
              <span class="master-desc">角色认知、主页好友与朋友圈动态联动</span>
            </div>
            <label class="journal-switch">
              <input v-model="settings.enabled" type="checkbox" @change="persist">
              <span></span>
            </label>
          </div>

          <!-- 功能微胶囊选项矩阵 -->
          <div class="control-capsules-grid" :class="{ disabled: !settings.enabled }">
            <label class="capsule-toggle" :class="{ active: settings.awarenessEnabled && settings.enabled }">
              <input v-model="settings.awarenessEnabled" type="checkbox" :disabled="!settings.enabled" @change="persist">
              <span class="capsule-dot"></span>
              <span class="capsule-text">知晓人脉关系</span>
            </label>
            <label class="capsule-toggle" :class="{ active: settings.allowMentionInChat && settings.enabled }">
              <input v-model="settings.allowMentionInChat" type="checkbox" :disabled="!settings.enabled" @change="persist">
              <span class="capsule-dot"></span>
              <span class="capsule-text">对话自然提及</span>
            </label>
            <label class="capsule-toggle" :class="{ active: settings.allowViewMoments && settings.enabled }">
              <input v-model="settings.allowViewMoments" type="checkbox" :disabled="!settings.enabled" @change="persist">
              <span class="capsule-dot"></span>
              <span class="capsule-text">浏览人脉动态</span>
            </label>
            <label class="capsule-toggle" :class="{ active: settings.allowInteractMoments && settings.enabled }">
              <input v-model="settings.allowInteractMoments" type="checkbox" :disabled="!settings.enabled" @change="persist">
              <span class="capsule-dot"></span>
              <span class="capsule-text">动态点赞评论</span>
            </label>
            <label class="capsule-toggle" :class="{ active: settings.allowPublishAboutCircle && settings.enabled }">
              <input v-model="settings.allowPublishAboutCircle" type="checkbox" :disabled="!settings.enabled" @change="persist">
              <span class="capsule-dot"></span>
              <span class="capsule-text">发布人脉圈事</span>
            </label>
            <label class="capsule-toggle" :class="{ active: settings.allowIncomingRequests && settings.enabled }">
              <input v-model="settings.allowIncomingRequests" type="checkbox" :disabled="!settings.enabled" @change="persist">
              <span class="capsule-dot"></span>
              <span class="capsule-text">人脉主动加友</span>
            </label>
            <label class="capsule-toggle theme-capsule" :class="{ active: settings.themeMusicEnabled && settings.enabled }" title="结合角色与当前人脉，挑选适配的可播放歌曲">
              <input v-model="settings.themeMusicEnabled" type="checkbox" :disabled="!settings.enabled" @change="toggleTheme">
              <span class="capsule-dot"></span>
              <span class="capsule-text">AI人脉主题曲</span>
            </label>
          </div>

          <!-- 精致配置行：关系管理与自动补充（分两行排版，空间充足不挤压） -->
          <div class="sub-config-strip" :class="{ disabled: !settings.enabled }">
            <div class="config-row">
              <span class="cell-label">关系变动策略</span>
              <div class="segment-tabs">
                <button
                  v-for="mode in [{id:'readonly',label:'只读'},{id:'confirm',label:'需确认'},{id:'autonomous',label:'自主'}]"
                  :key="mode.id"
                  type="button"
                  :disabled="!settings.enabled"
                  :class="{ active: settings.managementMode === mode.id }"
                  @click="settings.managementMode = mode.id as any; persist()"
                >
                  {{ mode.label }}
                </button>
              </div>
            </div>

            <div class="config-divider"></div>

            <div class="config-row">
              <div class="stepper-bundle">
                <span class="cell-label">按人设补全</span>
                <div class="count-stepper">
                  <button type="button" :disabled="settings.generationCount <= 2" @click="settings.generationCount--; persist()">−</button>
                  <b>{{ settings.generationCount }}人</b>
                  <button type="button" :disabled="settings.generationCount >= 10" @click="settings.generationCount++; persist()">＋</button>
                </div>
              </div>
              <button class="generate-pill-btn" type="button" :disabled="generating" @click="generatePresets">
                <svg v-if="!generating" viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.4" fill="none">
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.636 5.636l2.122 2.122m8.484 8.484l2.122 2.122M5.636 18.364l2.122-2.122m8.484-8.484l2.122-2.122" />
                </svg>
                <span>{{ generating ? '生成中…' : '生成' }}</span>
              </button>
            </div>
          </div>
          <p v-if="generationError" class="generation-error">{{ generationError }}</p>
        </section>

        <!-- 搜索与索引切换 -->
        <div class="journal-controls-section">
          <div class="journal-search-input-wrap">
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              v-model="searchQuery"
              class="journal-search-input"
              type="text"
              placeholder="搜索姓名、称谓或性格..."
            />
          </div>

          <!-- 分类标签 -->
          <div class="journal-index-tabs">
            <button
              class="index-tab tab-all"
              :class="{ active: activeTab === 'all' }"
              @click="activeTab = 'all'"
            >
              全部 ({{ stats.total }})
            </button>
            <button
              class="index-tab tab-family"
              :class="{ active: activeTab === 'family' }"
              @click="activeTab = 'family'"
            >
              亲人 ({{ stats.family }})
            </button>
            <button
              class="index-tab tab-friend"
              :class="{ active: activeTab === 'friend' }"
              @click="activeTab = 'friend'"
            >
              好友 ({{ stats.friend }})
            </button>
            <button
              class="index-tab tab-work"
              :class="{ active: activeTab === 'work' }"
              @click="activeTab = 'work'"
            >
              工作 ({{ stats.work }})
            </button>
            <button
              class="index-tab tab-other"
              :class="{ active: activeTab === 'other' }"
              @click="activeTab = 'other'"
            >
              其他 ({{ stats.other }})
            </button>
          </div>
        </div>

        <!-- 便签列表区 -->
        <div class="journal-notes-list">
          <!-- 空状态 -->
          <div v-if="filteredList.length === 0" class="journal-empty-box">
            <div class="empty-icon-box">
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" stroke-width="1.5" fill="none">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <div class="empty-text-desc">
              {{ searchQuery ? '未找到匹配的人脉便签' : '当前暂无人脉便签，点击右上角添加' }}
            </div>
            <button v-if="!searchQuery" class="empty-btn-create" @click="openCreateModal">
              立即添加便签
            </button>
          </div>

          <!-- 便签卡片 -->
          <div
            v-for="item in filteredList"
            :key="item.id"
            class="journal-memo-card"
            :class="item.category"
            @click="openEditModal(item)"
          >
            <!-- 左侧：小头像 -->
            <div class="memo-avatar-polaroid">
              <img v-if="avatarSources[item.id] || item.avatarUrl" :src="avatarSources[item.id] || item.avatarUrl" class="memo-avatar-img" />
              <div v-else class="memo-avatar-letter">
                {{ item.name ? item.name.slice(0, 1) : '友' }}
              </div>
            </div>

            <!-- 右侧：文字主体内容 -->
            <div class="memo-text-content">
              <!-- 第一行：姓名 + 关系标签 + 分类标签 + 右侧操作按钮 -->
              <div class="memo-header-row">
                <div class="memo-title-group">
                  <span class="memo-contact-name">{{ item.name }}</span>
                  <span v-if="item.relation" class="memo-relation-badge">
                    {{ item.relation }}
                  </span>
                  <span class="memo-cat-pill" :class="item.category">
                    {{
                      item.category === 'family'
                        ? '亲人'
                        : item.category === 'friend'
                        ? '好友'
                        : item.category === 'work'
                        ? '工作'
                        : '其他'
                    }}
                  </span>
                </div>

                <!-- 右侧操作按钮 -->
                <div class="memo-action-pins" @click.stop>
                  <button class="pin-btn edit" title="编辑便签" @click="openEditModal(item)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button class="pin-btn delete" title="删除便签" @click="handleDeleteContact(item.id)">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>

              <!-- 人物性格 -->
              <div class="memo-persona-text">
                “{{ item.persona || '暂无性格描述...' }}”
              </div>

              <!-- 底部状态与频次标签 -->
              <div class="memo-footer-row">
                <div
                  class="memo-stamp-status"
                  :class="{ active: item.enableMoments }"
                >
                  <span class="stamp-dot"></span>
                  <span>{{ item.enableMoments ? '参与朋友圈' : '不发朋友圈' }}</span>
                </div>

                <span v-if="item.enableMoments" class="memo-freq-tag">
                  {{
                    item.interactionFrequency === 'high'
                      ? '经常互动'
                      : item.interactionFrequency === 'low'
                      ? '很少互动'
                      : '偶尔互动'
                  }}
                </span>
                <span class="memo-privacy-tag">{{ item.privacy === 'public' ? '公开主页' : item.privacy === 'limited' ? '好友可见' : item.privacy === 'private' ? '私密用户' : '隐藏人物' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加 / 编辑弹窗 -->
    <ChatSocialCircleEditModal
      v-model:visible="showEditModal"
      :edit-item="editingContact"
      :owner-chat="selectedChat"
      @save="handleSaveContact"
    />
  </div>
</template>

<style scoped>
/* 纯白精致小组件展示区（彻底去包裹化、平铺通透） */
.journal-hero-aesthetic-wrap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 2px 0 6px;
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.hero-sub-stats-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 2px 0;
  border-top: 1px solid #f1f5f9;
}

.hero-stats-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.stats-chip {
  padding: 3px 8px;
  border-radius: 6px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  font-size: 11px;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.stats-chip b {
  color: #0f172a;
  font-weight: 600;
}

.hero-ai-gen-link {
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
}

.hero-ai-gen-link:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.theme-music-strip {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 2px 3px;
  color: #475569;
  font-size: 10.5px;
}

.theme-music-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.theme-music-copy strong,
.theme-music-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.theme-music-copy strong {
  color: #334155;
  font-size: 11px;
  font-weight: 600;
}

.theme-music-reason,
.theme-music-note {
  color: #64748b;
}

.theme-music-error {
  color: #b45353;
}

.theme-music-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  flex: 0 0 auto;
  max-width: 49%;
}

.theme-music-actions button {
  border: 1px solid #dbe4ef;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  padding: 3px 5px;
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}

.theme-music-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 去卡片化控制区：无外框、无突兀圆角，纯净融合 */
.social-settings-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0 6px;
  background: transparent;
}

.section-master-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 2px;
}

.master-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.master-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.master-status-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #cbd5e1;
  transition: all 0.2s ease;
}

.master-status-indicator.active {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.master-title {
  font-size: 14.5px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: -0.2px;
}

.master-badge {
  font-size: 10px;
  font-weight: 500;
  color: #64748b;
  padding: 1px 6px;
  border-radius: 999px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
}

.master-desc {
  font-size: 11px;
  color: #64748b;
  letter-spacing: 0.1px;
}

.journal-switch {
  position: relative;
  width: 42px;
  height: 23px;
  flex: 0 0 auto;
}

.journal-switch input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.journal-switch span {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #e2e8f0;
  transition: 0.2s ease;
}

.journal-switch span:after {
  content: "";
  position: absolute;
  left: 2.5px;
  top: 2.5px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.15);
  transition: 0.2s ease;
}

.journal-switch input:checked + span {
  background: #475569;
}

.journal-switch input:checked + span:after {
  transform: translateX(19px);
}

/* 精致轻盈微胶囊网格 */
.control-capsules-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  transition: opacity 0.2s ease;
}

.control-capsules-grid.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.capsule-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #ffffff;
  border: 1px solid #edf0f2;
  color: #475569;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
}

.capsule-toggle:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.capsule-toggle.active {
  border-color: #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
}

.capsule-toggle input {
  display: none;
}

.capsule-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e2e8f0;
  flex-shrink: 0;
  transition: all 0.18s ease;
}

.capsule-toggle.active .capsule-dot {
  background: #64748b;
  box-shadow: 0 0 0 2px rgba(100, 116, 139, 0.18);
}

.capsule-text {
  letter-spacing: 0.1px;
}

.theme-capsule,
.theme-capsule .capsule-text {
  min-width: 0;
}

.theme-capsule .capsule-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 底部配置通透行（改用两行排列） */
.sub-config-strip {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px 12px;
  background: #f8fafc;
  border: 1px solid #edf0f2;
  border-radius: 12px;
  transition: opacity 0.2s ease;
}

.sub-config-strip.disabled {
  opacity: 0.4;
  pointer-events: none;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
}

.config-divider {
  width: 100%;
  height: 1px;
  background: #edf0f2;
}

.cell-label {
  font-size: 11.5px;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
}

.segment-tabs {
  display: flex;
  padding: 2px;
  border-radius: 7px;
  background: #e2e8f0;
  gap: 2px;
  flex-shrink: 0;
}

.segment-tabs button {
  height: 25px;
  padding: 0 10px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s ease;
}

.segment-tabs button.active {
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.stepper-bundle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-stepper {
  display: flex;
  align-items: center;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
  padding: 1px 3px;
  height: 25px;
  box-sizing: border-box;
}

.count-stepper button {
  width: 20px;
  height: 21px;
  border: none;
  background: transparent;
  color: #475569;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
}

.count-stepper button:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}

.count-stepper b {
  min-width: 28px;
  font-size: 11.5px;
  color: #0f172a;
  text-align: center;
  font-weight: 600;
}

.generate-pill-btn {
  height: 25px;
  padding: 0 11px;
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s ease;
}

.generate-pill-btn:hover:not(:disabled) {
  background: #334155;
}

.generate-pill-btn:disabled,
.count-stepper button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.generation-error {
  margin: 0;
  padding: 6px 10px;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fee2e2;
  color: #dc2626;
  font-size: 11px;
}

/* 遮罩 */
.journal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(8px);
  z-index: 10040;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 纯白容器 */
.journal-container {
  width: 100%;
  max-width: 480px;
  height: 90vh;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
  position: relative;
}

@media (max-width: 480px) {
  .journal-container {
    height: var(--app-height, 100vh);
    border-radius: 0;
    border: none;
  }
}

/* 顶栏 */
.journal-header {
  height: calc(54px + var(--app-safe-top, 0px));
  padding: var(--app-safe-top, 0px) 16px 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  flex-shrink: 0;
}

.journal-nav-btn {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #334155;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.journal-nav-btn:hover {
  border-color: #cbd5e1;
  color: #0f172a;
}

.journal-header-title {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.main-title {
  font-size: 15px;
  font-weight: 600;
  color: #0f172a;
  letter-spacing: 0.5px;
}

.sub-title {
  font-size: 8.5px;
  color: #94a3b8;
  letter-spacing: 1.2px;
  font-weight: 600;
}

.journal-add-btn {
  background: #0f172a;
  border: none;
  color: #ffffff;
  height: 30px;
  padding: 0 12px;
  border-radius: 15px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.journal-add-btn:hover {
  background: #1e293b;
}

/* 页面主体（纯白） */
.journal-page-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 16px calc(16px + var(--app-safe-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 14px;
  background-color: #ffffff;
}

/* 搜索与选项卡 */
.journal-controls-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.journal-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #edf0f2;
  border-radius: 11px;
  height: 36px;
  padding: 0 12px;
  color: #94a3b8;
  transition: all 0.18s ease;
}

.journal-search-input-wrap:focus-within {
  border-color: #cbd5e1;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.journal-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 13px;
  color: #0f172a;
}

.journal-search-input::placeholder {
  color: #94a3b8;
}

/* 纯白风格标签切换 */
.journal-index-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.journal-index-tabs::-webkit-scrollbar {
  display: none;
}

.index-tab {
  flex-shrink: 0;
  height: 28px;
  padding: 0 11px;
  border-radius: 8px;
  border: 1px solid #edf0f2;
  background: #ffffff;
  color: #64748b;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.index-tab:hover {
  border-color: #cbd5e1;
  color: #0f172a;
}

.index-tab.active {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
  font-weight: 600;
}

/* 便签列表 */
.journal-notes-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.journal-empty-box {
  background: #ffffff;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  padding: 36px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}

.empty-icon-box {
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-text-desc {
  font-size: 12.5px;
  color: #64748b;
}

.empty-btn-create {
  margin-top: 4px;
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}

/* 便签卡片：精致卡片风，左头像右内容，紧凑通透 */
.journal-memo-card {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 14px;
  padding: 12px 12px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  position: relative;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.03);
  cursor: pointer;
  transition: all 0.18s ease;
}

.journal-memo-card:hover {
  border-color: #e2e8f0;
  background: #fafbfc;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
}

/* 便签内头像：纯正圆形 */
.memo-avatar-polaroid {
  width: 44px;
  height: 44px;
  background: #ffffff;
  border: 1.5px solid #e2e8f0;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
  margin-top: 2px;
}

.memo-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.memo-avatar-letter {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
}

/* 文字手记与内容区 */
.memo-text-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 第一行：左侧姓名、关系、分类，右侧操作按钮 */
.memo-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.memo-title-group {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: wrap;
}

.memo-contact-name {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
}

/* 关系称谓标签：精致小胶囊 */
.memo-relation-badge {
  font-size: 10.5px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
  letter-spacing: -0.1px;
}

.memo-cat-pill {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 500;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  color: #64748b;
  flex-shrink: 0;
  white-space: nowrap;
}

.memo-cat-pill.family {
  background: #fff7ed;
  border-color: #ffedd5;
  color: #ea580c;
}

.memo-cat-pill.friend {
  background: #eff6ff;
  border-color: #dbeafe;
  color: #2563eb;
}

.memo-cat-pill.work {
  background: #f0fdf4;
  border-color: #dcfce7;
  color: #16a34a;
}

.memo-cat-pill.other {
  background: #f8fafc;
  border-color: #e2e8f0;
  color: #64748b;
}

/* 右上角操作按钮区 */
.memo-action-pins {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.pin-btn {
  background: transparent;
  border: none;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
}

.pin-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.pin-btn.delete:hover {
  color: #ef4444;
  background: #fef2f2;
}

/* 人物性格描述 */
.memo-persona-text {
  font-size: 12px;
  color: #475569;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-all;
}

/* 底部状态与频次标签 */
.memo-footer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 1px;
  flex-wrap: wrap;
}

.memo-stamp-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10.5px;
  color: #94a3b8;
}

.memo-stamp-status.active {
  color: #10b981;
}

.stamp-dot {
  width: 5.5px;
  height: 5.5px;
  border-radius: 50%;
  background: currentColor;
}

.memo-freq-tag {
  font-size: 10.5px;
  color: #64748b;
}

.memo-privacy-tag {
  padding: 1px 7px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  color: #64748b;
  font-size: 9.5px;
  white-space: nowrap;
}
</style>
