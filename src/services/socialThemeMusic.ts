import { sendCapabilityMessage } from './api'
import type { SocialCircleItem, SocialThemeSong } from './socialGraph'
import { createMusicProviders } from './musicProviders'
import { loadMusicPrivacyPreferences } from './musicPrivacy'
import { probeMusicUrl } from './musicPlaybackValidation'
import { initializeMusicRuntime, musicPreferredQuality, musicSourceConfigs } from './musicRuntime'
import type { MusicTrack } from '../types/music'

type SongIdea = { title: string; artist: string; reason: string }

const clean = (value: unknown, limit: number) => String(value || '').trim().slice(0, limit)
const identity = (value: string) => value.toLowerCase().replace(/[\s·・\-—_()（）【】\[\]]/g, '')
export const socialThemeTrackKey = (track: Pick<MusicTrack, 'title' | 'artist'>) => `${identity(track.title)}|${identity(track.artist)}`
const peopleOf = (chat: any): SocialCircleItem[] => Array.isArray(chat?.socialCircle) ? chat.socialCircle : []

export const socialThemeContext = (chat: any) => {
  const source = JSON.stringify({
    name: clean(chat?.realName || chat?.name, 60),
    persona: clean(chat?.persona, 9000),
    people: peopleOf(chat).map(item => ({
      id: item.entityId,
      relation: item.relation,
      category: item.category,
      persona: item.persona,
      privacy: item.privacy,
      updatedAt: item.updatedAt
    }))
  })
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619)
  return `${source.length}:${(hash >>> 0).toString(36)}`
}

const promptContext = (chat: any) => {
  const people = peopleOf(chat).slice(0, 20).map(item => {
    if (item.privacy === 'private' || item.privacy === 'hidden') {
      return `${item.category}关系一位；具体身份与资料保密`
    }
    return `${item.category}：${clean(item.relation, 30)}；${clean(item.persona, 300)}`
  })
  return `角色：${clean(chat?.realName || chat?.name, 60)}\n人设：${clean(chat?.persona, 6000)}\n人脉：${people.join('；') || '尚无人脉，依据角色人设选曲'}`
}

const parseIdeas = (raw: string): SongIdea[] => {
  const source = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || raw
  const start = source.indexOf('[')
  const end = source.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('AI 未返回可读取的歌曲建议')
  const parsed: unknown = JSON.parse(source.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('AI 未返回歌曲列表')
  return parsed.slice(0, 6).map(item => ({
    title: clean(item?.title, 100),
    artist: clean(item?.artist, 100),
    reason: clean(item?.reason, 160)
  })).filter(item => item.title && item.artist && item.reason)
}

export async function generateSocialThemeSong(chat: any, excludedSongs: string[] = []): Promise<SocialThemeSong> {
  await initializeMusicRuntime()
  const privacy = await loadMusicPrivacyPreferences()
  const configs = musicSourceConfigs.value.filter(item => item.enabled && (!item.anonymousPublic || privacy.allowAnonymousPublicSources))
  const providers = createMusicProviders(configs).filter(item => item.getStreamUrl)
  if (!providers.length) throw new Error('没有已启用的可播放音乐来源，请先在音乐来源中启用')

  const contextKey = socialThemeContext(chat)
  const response = await sendCapabilityMessage('social-generation', [
    { role: 'system', content: '你是角色生活手账的音乐编辑。根据人设及社会关系推荐真实存在的歌曲，情绪与关系要贴切，避免机械化和重复。只返回 JSON 数组，包含 5 项，每项为 title、artist、reason（中文，简短具体）。不要虚构曲目、歌手、歌词或角色经历。' },
    { role: 'user', content: promptContext(chat) }
  ])
  const ideas = parseIdeas(typeof response === 'string' ? response : response.content)
  if (!ideas.length) throw new Error('AI 没有给出有效的歌曲建议')

  const options: SocialThemeSong['options'] = []
  const seen = new Set<string>(excludedSongs)
  for (const idea of ideas) {
    if (options.length >= 3) break
    const query = `${idea.title} ${idea.artist}`
    for (const provider of providers) {
      try {
        const results = await provider.search(query)
        const candidates = results.tracks.filter(track =>
          track.available !== false && track.playbackType === 'full' && !track.requiresVip &&
          identity(track.title) === identity(idea.title) && identity(track.artist).includes(identity(idea.artist)) &&
          !seen.has(socialThemeTrackKey(track))
        )
        for (const candidate of candidates.slice(0, 2)) {
          const url = await provider.getStreamUrl!(candidate, musicPreferredQuality.value)
          if (!url) continue
          const probe = await probeMusicUrl(url, 8000)
          if (!probe.valid) continue
          const track: MusicTrack = { ...candidate, duration: candidate.duration || probe.duration, validationStatus: 'verified', sourceCandidates: undefined }
          options.push({ track, reason: idea.reason })
          seen.add(socialThemeTrackKey(track))
          break
        }
        if (options.some(item => identity(item.track.title) === identity(idea.title))) break
      } catch {
        // 当前来源不可用时继续尝试已启用的其他来源。
      }
    }
  }
  if (!options.length) throw new Error('暂时找不到可完整播放的匹配歌曲，请稍后重试或检查音乐来源')
  return { options, selectedIndex: 0, contextKey, pinned: false, generatedAt: Date.now() }
}
