import assert from 'node:assert/strict'
import type { MusicSourceConfig, MusicTrack } from '../src/types/music'
import { findMusicVideoCandidates, resolveMusicVideoUrl } from '../src/services/musicVideos'

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    location: { origin: 'https://nrj.example' },
    setTimeout,
    clearTimeout
  }
})

const calls: string[] = []
Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: async (input: string | URL | Request) => {
    const url = String(input)
    calls.push(url)
    if (url.includes('/search?')) return new Response(JSON.stringify({ result: { mvs: [
      { id: 1001, name: '稻香', artistName: '周杰伦', duration: 223000, cover: 'http://img.example/mv.jpg' },
      { id: 1002, name: '稻香 reaction 片段', artistName: '其他用户', duration: 30000, cover: '' }
    ] }, code: 200 }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    if (url.includes('/mv/url?')) return new Response(JSON.stringify({ code: 200, data: { id: 1001, url: 'http://video.example/full.mp4?expires=1', r: 480 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    return new Response('{}', { status: 404 })
  }
})

const config: MusicSourceConfig = { id: 'hf-netease', name: 'MV 测试源', kind: 'netease', enabled: true, apiBase: 'https://mock.example', capabilities: [] }
const track: MusicTrack = { id: 'song:1', sourceId: 'hf-netease', sourceTrackId: '1', title: '稻香', artist: '周杰伦', album: '魔杰座', duration: 223, playbackType: 'full' }

const candidates = await findMusicVideoCandidates(track, [config])
assert.equal(candidates.length, 1, '应过滤低可信、时长异常的视频')
assert.equal(candidates[0].id, '1001')
assert.equal(candidates[0].coverUrl, 'https://img.example/mv.jpg')

const playback = await resolveMusicVideoUrl(candidates[0], '720', true, [config])
assert.equal(playback?.url, 'https://video.example/full.mp4?expires=1', '应把可升级的视频地址转换为 HTTPS')
assert.equal(playback?.actualQuality, 480, '应保留平台实际返回清晰度')
assert.ok(calls.some(url => url.includes('type=1004')), '应使用 MV 搜索类型')
assert.ok(calls.some(url => url.includes('r=480')), '省流模式应请求 480P')

console.log('music video tests passed')
