// Fetch the curated built-in libraries once; the app uses bundled files at runtime.
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const resourceRoot = resolve(root, 'public/chat-emojis')
const smojiRevision = '38f3c54465091bb7eff3f848a4266a0d4961cbe9'
const smojiRaw = `https://raw.githubusercontent.com/DejavuMoe/Smoji/${smojiRevision}/data`
const hash = value => createHash('sha256').update(value).digest('hex')
const validImage = bytes => bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  || bytes.subarray(0, 3).toString() === 'GIF'
  || (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP')
const fetchBytes = async url => {
  let lastError
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) })
      if (!response.ok) throw new Error(`${response.status}: ${url}`)
      return Buffer.from(await response.arrayBuffer())
    } catch (error) { lastError = error }
  }
  throw lastError
}
const json = async url => JSON.parse((await fetchBytes(url)).toString('utf8'))
const [smoji, assetIndex, hosting, qqIndex, douyin, taobao, trip, miyou] = await Promise.all([
  json(`${smojiRaw}/packs.json`), json(`${smojiRaw}/assets.json`), json(`${smojiRaw}/hosting.json`),
  json('https://raw.githubusercontent.com/koishijs/QFace/master/public/assets/qq_emoji/_index.v2.json'),
  json('https://raw.githubusercontent.com/hnlyzxf/douyin-emoji/main/info.json'),
  json('https://raw.githubusercontent.com/YiJio/emoji-chinese/main/_map/tb.json'),
  json('https://raw.githubusercontent.com/YiJio/emoji-chinese/main/_map/xc.json'),
  json('https://bbs-api-static.miyoushe.com/misc/api/emoticon_set')
])
const packs = []
const jobs = []
const addPack = (id, name, source, items) => {
  const seen = new Set()
  const pack = { id, name, source, items: [] }
  for (const item of items) {
    if (!item.name || seen.has(item.key)) continue
    seen.add(item.key)
    const key = String(item.key).replace(/[^a-zA-Z0-9_-]/g, '') || hash(item.key).slice(0, 16)
    const file = `${id}/${key}.${item.ext}`
    pack.items.push({ id: `builtin:${id}:${key}`, name: item.name, file })
    jobs.push({ ...item, file })
  }
  packs.push(pack)
}
for (const [id, name] of [
  ['wechat', '微信'], ['bilibili', 'B站'], ['bilibili-television', '小电视'],
  ['weibo', '微博'], ['xiaohongshu', '小红书'], ['tieba', '贴吧'],
  ['dingtalk', '钉钉'], ['coolapk', '酷安'], ['xianyu', '闲鱼'], ['it-home', 'IT之家']
]) {
  const pack = smoji.find(item => item.id === id)
  if (!pack) throw new Error(`Missing Smoji pack: ${id}`)
  addPack(id, name, `https://github.com/DejavuMoe/Smoji/tree/${smojiRevision}`, pack.items.map(item => ({
    key: item.file.replace(/\.[^.]+$/, ''), name: item.label, ext: 'webp',
    url: `${hosting.assetBaseUrl}${id}/${item.file}`, sha256: assetIndex[`${id}/${item.file}`]?.sha256
  })))
}
const qqEntries = Array.isArray(qqIndex.emojis) ? qqIndex.emojis : Object.values(qqIndex.emojis)
addPack('qq', 'QQ', 'https://github.com/koishijs/QFace', qqEntries.filter(item => /^\d+$/.test(item.emojiId)).flatMap(item => {
  const asset = item.assets.find(asset => asset.type === 'apng') || item.assets.find(asset => asset.type === 'png')
  return asset && item.describe ? [{ key: item.emojiId, name: item.describe.replace(/^\//, ''), ext: 'png', url: `https://raw.githubusercontent.com/koishijs/QFace/master/public/${asset.path.split('/').map(encodeURIComponent).join('/')}` }] : []
}))
addPack('douyin', '抖音', 'https://github.com/hnlyzxf/douyin-emoji', douyin.stickers.filter(item => !item.hide && !item.time_limited).map(item => ({
  key: hash(item.uri).slice(0, 16), name: item.display_name.replace(/^\[|\]$/g, ''),
  ext: item.uri.split('.').pop().toLowerCase(), url: `https://raw.githubusercontent.com/hnlyzxf/douyin-emoji/main/static/${encodeURIComponent(item.uri)}`
})))
for (const [id, name, map, folder] of [['taobao', '淘宝', taobao, 'tb'], ['trip', '携程', trip, 'xc']]) {
  addPack(id, name, 'https://github.com/YiJio/emoji-chinese', map.map(item => ({
    key: hash(item.url).slice(0, 16), name: String(Array.isArray(item.name) ? item.name[0] : item.name).replace(/^\[|\]$/g, ''),
    ext: 'png', url: `https://raw.githubusercontent.com/YiJio/emoji-chinese/main/${folder}/${item.url}.png`
  })))
}
if (miyou.retcode !== 0) throw new Error('Miyoushe catalogue unavailable')
const bunny = miyou.data.list.find(pack => pack.name === '米游兔' && pack.is_available)
if (!bunny) throw new Error('Miyoushe default pack unavailable')
addPack('miyoushe', '米游社', 'https://bbs-api-static.miyoushe.com/misc/api/emoticon_set', bunny.list.filter(item => item.is_available !== false && item.icon).map(item => ({
  key: String(item.id), name: item.name, ext: new URL(item.icon).pathname.split('.').pop().toLowerCase(), url: item.icon
})))
// Keep the familiar three platforms at the front of the picker.
const order = ['wechat', 'qq', 'douyin', 'bilibili', 'bilibili-television', 'weibo', 'xiaohongshu', 'tieba', 'dingtalk', 'coolapk', 'xianyu', 'it-home', 'taobao', 'trip', 'miyoushe']
packs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
if (packs.some(pack => !pack.items.length)) throw new Error('Empty built-in emoji pack')
await mkdir(resourceRoot, { recursive: true })
let next = 0
let done = 0
await Promise.all(Array.from({ length: 8 }, async () => {
  while (next < jobs.length) {
    const job = jobs[next++]
    const target = resolve(resourceRoot, job.file)
    let bytes
    try {
      const saved = await readFile(target)
      if (validImage(saved) && (!job.sha256 || hash(saved) === job.sha256)) bytes = saved
    } catch { /* First sync. */ }
    bytes ||= await fetchBytes(job.url)
    if (job.sha256 && hash(bytes) !== job.sha256) throw new Error(`Checksum mismatch: ${job.file}`)
    if (!validImage(bytes)) throw new Error(`Invalid image: ${job.file}`)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, bytes)
    if (++done % 100 === 0) console.log(`Bundled ${done}/${jobs.length}`)
  }
}))
await writeFile(resolve(root, 'src/constants/builtInChatEmojis.json'), `${JSON.stringify({ version: 1, packs }, null, 2)}\n`)
await writeFile(resolve(resourceRoot, 'SOURCES.md'), `# 内置聊天表情来源\n\n图片版权归各平台及原权利人所有，资源库的代码许可证不等同于素材授权。\n\n- Smoji: https://github.com/DejavuMoe/Smoji (${smojiRevision})；素材声明仅供个人学习、交流与展示，商业使用需取得许可。\n- QFace: https://github.com/koishijs/QFace；素材版权归腾讯，仅供学习交流，非商业用途。\n- 抖音: https://github.com/hnlyzxf/douyin-emoji；素材版权归抖音及相关权利方，非商业用途。\n- 淘宝、携程: https://github.com/YiJio/emoji-chinese（仓库 GPL-3.0）。\n- 米游社默认米游兔: https://bbs-api-static.miyoushe.com/misc/api/emoticon_set；素材来自米游社。\n\n本应用只使用随应用发布的资源，不在用户打开面板时访问上游图库。\n`)
console.log(JSON.stringify(packs.map(pack => ({ name: pack.name, count: pack.items.length }))))
