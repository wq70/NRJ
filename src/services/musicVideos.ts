/* WARNING: 本项目专属“粘人精”，严禁出现 Kiro、Krio、周棋洛等任何相关英文或拼音命名！ */
import type { MusicSourceConfig, MusicTrack, MusicVideoCandidate, MusicVideoQuality } from '../types/music'
import { createMusicProviders } from './musicProviders'

const normalized = (value: string) => value.toLowerCase().replace(/\b(?:official|music|video|mv)\b/gi, '').replace(/[\s·・\-—_()（）【】\[\]《》]/g, '')
const unwanted = /翻唱|reaction|片段|采访|饭制|伴奏|教学|解析/i

const candidateScore = (track: MusicTrack, video: MusicVideoCandidate) => {
  const trackTitle = normalized(track.title)
  const videoTitle = normalized(video.title)
  const trackArtist = normalized(track.artist)
  const videoArtist = normalized(video.artist)
  let score = 0
  if (trackTitle && videoTitle === trackTitle) score += 55
  else if (trackTitle && (videoTitle.includes(trackTitle) || trackTitle.includes(videoTitle))) score += 38
  if (trackArtist && videoArtist && (videoArtist.includes(trackArtist) || trackArtist.includes(videoArtist))) score += 28
  if (video.official) score += 10
  if (track.duration > 0 && video.duration > 0) {
    const difference = Math.abs(track.duration - video.duration)
    if (difference <= 8 || difference / track.duration <= .05) score += 12
    else if (difference > 45) score -= 12
  }
  if (unwanted.test(video.title)) score -= 30
  return score
}

export const findMusicVideoCandidates = async (track: MusicTrack, configs: MusicSourceConfig[]) => {
  const providers = createMusicProviders(configs)
    .filter(provider => provider.getRelatedMusicVideos)
    .sort((a, b) => {
      const rank = (id: string) => id === 'hf-netease' ? 0 : id === 'public-video' ? 1 : id === 'official-video' ? 2 : 3
      return rank(a.id) - rank(b.id)
    })
  const settled = await Promise.allSettled(providers.map(async provider => {
    const videos = await provider.getRelatedMusicVideos!(track)
    return videos.map(video => ({ ...video, matchScore: candidateScore(track, video) }))
  }))
  const seen = new Set<string>()
  return settled.flatMap(result => result.status === 'fulfilled' ? result.value : [])
    .filter(video => (video.matchScore || 0) >= 48)
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .filter(video => {
      const key = `${video.sourceId}:${video.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export const resolveMusicVideoUrl = async (video: MusicVideoCandidate, quality: MusicVideoQuality, dataSaver: boolean, configs: MusicSourceConfig[]) => {
  if (video.playbackType === 'embed') return null
  const provider = createMusicProviders(configs).find(item => item.id === video.sourceId)
  if (!provider?.getMusicVideoUrl) throw new Error('当前 MV 来源暂时无法获取播放地址')
  const requestedQuality: MusicVideoQuality = dataSaver && (quality === 'auto' || Number(quality) > 480) ? '480' : quality
  return provider.getMusicVideoUrl(video, requestedQuality)
}
