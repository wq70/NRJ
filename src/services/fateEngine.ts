/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import { Solar } from 'lunar-typescript'
import { astro } from 'iztro'
import type { CreateFateReadingInput, FateDrawItem, FateMethod, FateReading } from '../types/fate'

export const FATE_ENGINE_VERSION = 1

export const fateCategories = [
  { id: 'daily', name: '今日', glyph: '今' },
  { id: 'cards', name: '卡牌', glyph: '牌' },
  { id: 'eastern', name: '东方', glyph: '易' },
  { id: 'astrology', name: '星命', glyph: '星' },
  { id: 'folk', name: '民俗', glyph: '签' },
  { id: 'choice', name: '决策', glyph: '择' }
] as const

export const fateMethods: FateMethod[] = [
  { id: 'daily-almanac', name: '今日黄历', shortName: '黄历', category: 'daily', kind: 'calendar', glyph: '历', accent: '#a85f57', description: '节气、干支、宜忌与今日行动提示', questionHint: '今天适合关注什么？', tags: ['每日', '宜忌', '节气'] },
  { id: 'daily-oracle', name: '每日一言', shortName: '日签', category: 'daily', kind: 'draw', glyph: '今', accent: '#8c6a9e', description: '抽取一枚温和的今日主题', questionHint: '今天需要记住什么？', tags: ['每日', '轻量'], drawCount: 1 },
  { id: 'tarot', name: '塔罗牌', shortName: '塔罗', category: 'cards', kind: 'draw', glyph: '塔', accent: '#765b98', description: '完整 78 张牌，支持正逆位与多张牌阵', questionHint: '把问题写具体一些，例如：我该如何理解这段关系？', tags: ['感情', '选择', '成长'], drawCount: 3 },
  { id: 'lenormand', name: '雷诺曼', shortName: '雷诺曼', category: 'cards', kind: 'draw', glyph: '雷', accent: '#527c81', description: '36 张生活象征牌，偏向具体事件与组合', questionHint: '接下来这件事可能如何展开？', tags: ['事件', '趋势'], drawCount: 3 },
  { id: 'runes', name: '卢恩符文', shortName: '符文', category: 'cards', kind: 'draw', glyph: 'ᚱ', accent: '#657384', description: '24 枚古弗萨克符文，观察力量与阻力', questionHint: '此刻我可以依靠什么力量？', tags: ['力量', '行动'], drawCount: 3 },
  { id: 'oracle', name: '意象神谕', shortName: '神谕', category: 'cards', kind: 'draw', glyph: '谕', accent: '#a06f7a', description: '以自然意象获得开放式联想', questionHint: '此刻有什么信息值得留意？', tags: ['直觉', '疗愈'], drawCount: 1 },
  { id: 'iching', name: '周易六爻', shortName: '周易', category: 'eastern', kind: 'hexagram', glyph: '易', accent: '#846846', description: '三枚铜钱起卦，显示本卦、动爻与变卦', questionHint: '针对一件具体事情发问，不建议同时问多件事', tags: ['卦象', '变化'] },
  { id: 'meihua', name: '梅花易数', shortName: '梅花', category: 'eastern', kind: 'hexagram', glyph: '梅', accent: '#a45f68', description: '以时间与数字取象，观察体用变化', questionHint: '这件事目前呈现怎样的趋势？', tags: ['时间', '取象'] },
  { id: 'liuyao', name: '六爻问事', shortName: '六爻', category: 'eastern', kind: 'hexagram', glyph: '爻', accent: '#716549', description: '记录六次投掷，查看动静与变卦', questionHint: '请聚焦一件有明确边界的事', tags: ['问事', '动爻'] },
  { id: 'qimen', name: '奇门时盘', shortName: '奇门', category: 'eastern', kind: 'calendar', glyph: '门', accent: '#4f7770', description: '以当前时刻呈现九宫行动象意', questionHint: '我在什么方向或行动上更值得投入？', tags: ['时机', '方向'] },
  { id: 'bazi', name: '八字命盘', shortName: '八字', category: 'eastern', kind: 'bazi', glyph: '命', accent: '#9b634c', description: '四柱、藏干、十神、五行与纳音基础盘', questionHint: '查看我的基础命盘', tags: ['四柱', '五行', '十神'] },
  { id: 'ziwei', name: '紫微斗数', shortName: '紫微', category: 'eastern', kind: 'ziwei', glyph: '紫', accent: '#745787', description: '十二宫、主星、命主身主与五行局', questionHint: '查看我的紫微命盘', tags: ['十二宫', '主星'] },
  { id: 'lots', name: '灵签', shortName: '抽签', category: 'folk', kind: 'draw', glyph: '签', accent: '#ad7048', description: '原创签诗与解释，不复制商业签文', questionHint: '请在心里默念想问的事情', tags: ['签诗', '民俗'], drawCount: 1 },
  { id: 'dream', name: '梦境意象', shortName: '梦境', category: 'folk', kind: 'draw', glyph: '梦', accent: '#60739b', description: '从梦境关键词进入自我联想，不作医学判断', questionHint: '写下梦里最清晰的画面或感受', tags: ['梦', '象征'], drawCount: 3 },
  { id: 'zodiac', name: '星座画像', shortName: '星座', category: 'astrology', kind: 'zodiac', glyph: '座', accent: '#526b9f', description: '太阳星座与当日反思主题', questionHint: '查看我的星座主题', tags: ['星座', '生日'] },
  { id: 'numerology', name: '生命数字', shortName: '数字', category: 'astrology', kind: 'numerology', glyph: '数', accent: '#6b76a7', description: '生命路径数、生日数与个人年', questionHint: '查看数字中的性格与年度主题', tags: ['生日', '周期'] },
  { id: 'moon', name: '月相手记', shortName: '月相', category: 'astrology', kind: 'calendar', glyph: '月', accent: '#65708f', description: '当前月相、农历日期与书写提示', questionHint: '此刻适合释放还是积累？', tags: ['月亮', '周期'] },
  { id: 'relationship', name: '缘分合看', shortName: '合缘', category: 'astrology', kind: 'draw', glyph: '缘', accent: '#b06d7b', description: '以连接、沟通、边界、行动四个维度观察关系', questionHint: '我和TA目前最需要看见什么？', tags: ['关系', '角色'], drawCount: 4 },
  { id: 'astrology-dice', name: '占星骰子', shortName: '星骰', category: 'choice', kind: 'choice', glyph: '骰', accent: '#6c6594', description: '行星、星座、宫位三枚骰子的组合提示', questionHint: '这件事的能量落在哪里？', tags: ['快速', '组合'] },
  { id: 'pendulum', name: '灵摆问答', shortName: '灵摆', category: 'choice', kind: 'choice', glyph: '摆', accent: '#588083', description: '是、否、暂缓与换个问法的轻量回应', questionHint: '请输入一个可以用是或否回答的问题', tags: ['是非', '快速'] },
  { id: 'choice', name: '两难之间', shortName: '抉择', category: 'choice', kind: 'choice', glyph: '择', accent: '#7b6f9b', description: '不替你决定，而是照亮两种选择的关注点', questionHint: '例如：留在原处，还是尝试新的方向？', tags: ['选择', '行动'] }
]

const major = ['愚者','魔术师','女祭司','皇后','皇帝','教皇','恋人','战车','力量','隐者','命运之轮','正义','倒吊人','死神','节制','恶魔','高塔','星星','月亮','太阳','审判','世界']
const majorMeanings = [
  ['开始','自由','尝试'],['主动','创造','资源'],['直觉','沉静','未知'],['滋养','丰盛','感受'],['结构','责任','边界'],['传统','学习','信念'],['连接','选择','一致'],['意志','推进','掌控'],['耐心','勇气','温柔'],['独处','寻找','内省'],['周期','转折','机缘'],['平衡','诚实','后果'],['暂停','换位','放下'],['结束','转化','更新'],['调和','节奏','耐心'],['执着','欲望','束缚'],['打破','真相','释放'],['希望','疗愈','方向'],['朦胧','潜意识','不安'],['清晰','生命力','喜悦'],['召唤','复盘','觉醒'],['完成','整合','新的循环']
]
const suitInfo = [
  { id: 'wands', name: '权杖', glyph: '火', theme: ['行动','热情','创造'], court: ['侍从','骑士','王后','国王'] },
  { id: 'cups', name: '圣杯', glyph: '水', theme: ['情感','关系','接纳'], court: ['侍从','骑士','王后','国王'] },
  { id: 'swords', name: '宝剑', glyph: '风', theme: ['思考','沟通','抉择'], court: ['侍从','骑士','王后','国王'] },
  { id: 'pentacles', name: '星币', glyph: '土', theme: ['现实','资源','积累'], court: ['侍从','骑士','王后','国王'] }
]
const numberThemes = [['起点','机会'],['平衡','等待'],['合作','展开'],['稳定','保护'],['变化','摩擦'],['修复','分享'],['评估','坚持'],['推进','熟练'],['成熟','收获'],['完成','过渡']]

const tarotDeck = [
  ...major.map((name, index) => ({ id: `major-${index}`, name, glyph: String(index).padStart(2, '0'), keywords: majorMeanings[index], meaning: `关注${majorMeanings[index].join('、')}之间的关系。` })),
  ...suitInfo.flatMap(suit => [
    ...numberThemes.map((themes, index) => ({ id: `${suit.id}-${index + 1}`, name: `${suit.name}${['一','二','三','四','五','六','七','八','九','十'][index]}`, glyph: suit.glyph, keywords: [suit.theme[index % 3], ...themes], meaning: `${suit.theme.join('、')}的领域正在经历${themes.join('与')}。` })),
    ...suit.court.map((rank, index) => ({ id: `${suit.id}-court-${index}`, name: `${suit.name}${rank}`, glyph: suit.glyph, keywords: [suit.theme[index % 3], ['探索','推进','包容','掌握'][index]], meaning: `用${['好奇','勇气','成熟','责任'][index]}回应${suit.theme[index % 3]}议题。` }))
  ])
]

const lenormandNames = ['骑士','四叶草','船','房屋','树','云','蛇','棺材','花束','镰刀','鞭子','鸟','孩子','狐狸','熊','星星','鹳鸟','狗','高塔','花园','山','岔路','老鼠','心','戒指','书','信','男人','女人','百合','太阳','月亮','钥匙','鱼','锚','十字架']
const lenormandDeck = lenormandNames.map((name, index) => ({ id: `lenormand-${index + 1}`, name, glyph: String(index + 1), keywords: [["消息","到来"],["机会","轻盈"],["远方","移动"],["安全","家庭"],["成长","健康"],["疑惑","变化"]][index % 6], meaning: `“${name}”提醒你观察现实中的线索、互动和时间变化。` }))
const runeNames = ['ᚠ 费胡','ᚢ 乌鲁兹','ᚦ 图里萨兹','ᚨ 安苏兹','ᚱ 赖多','ᚲ 肯纳兹','ᚷ 格博','ᚹ 温乔','ᚺ 哈迦拉兹','ᚾ 纳奥迪兹','ᛁ 伊萨','ᛃ 耶拉','ᛇ 埃瓦兹','ᛈ 佩尔索','ᛉ 阿尔吉兹','ᛋ 索维罗','ᛏ 提瓦兹','ᛒ 贝尔卡诺','ᛖ 埃瓦兹','ᛗ 曼纳兹','ᛚ 拉古兹','ᛜ 英格瓦兹','ᛞ 达格兹','ᛟ 奥塞拉']
const runeDeck = runeNames.map((name, index) => ({ id: `rune-${index}`, name, glyph: name.slice(0, 1), keywords: [['资源','流动'],['力量','恢复'],['边界','保护'],['讯息','表达'],['旅程','节奏'],['照亮','技艺']][index % 6], meaning: `这枚符文邀请你从${[['资源','流动'],['力量','恢复'],['边界','保护'],['讯息','表达'],['旅程','节奏'],['照亮','技艺']][index % 6].join('与')}的角度重新观察问题。` }))
const oracleImages = ['晨雾','潮汐','旧钥匙','候鸟','未寄出的信','山径','灯塔','种子','镜湖','风铃','空椅','火种','雨后窗','树影','月门','桥','贝壳','羽毛','星尘','白纸','回声','花苞','石阶','远帆']
const oracleDeck = oracleImages.map((name, index) => ({ id: `oracle-${index}`, name, glyph: name.slice(0, 1), keywords: [['等待','辨认'],['靠近','退回'],['开启','选择'],['迁徙','方向']][index % 4], meaning: `把“${name}”当作一面镜子：它最先让你想到的，可能比固定答案更重要。` }))
const lotDeck = oracleImages.map((name, index) => ({ id: `lot-${index + 1}`, name: `第${index + 1}签 · ${name}`, glyph: '签', keywords: [['守心','缓行'],['顺势','求实'],['沟通','留白'],['整顿','再启']][index % 4], meaning: [`风来不必急关窗，先看云往哪边行。`,`手中已有一盏灯，莫向远处借微明。`,`旧结宜松不宜扯，话到三分留七分。`,`水静方能照见月，整理之后再出发。`][index % 4] }))
const dreamDeck = ['水','飞行','房屋','门','追赶','坠落','动物','考试','迷路','故人','火','树','镜子','交通工具','手机','黑暗','光','雨'].map((name, index) => ({ id: `dream-${index}`, name, glyph: name.slice(0, 1), keywords: [['情绪流动','适应'],['自由愿望','脱离'],['自我空间','安全感'],['转折','边界'],['压力','回避'],['失控感','放手']][index % 6], meaning: `梦中的“${name}”没有唯一解释，先回想它出现时你的身体感受与情绪。` }))
const hexagramNames = ['乾','坤','屯','蒙','需','讼','师','比','小畜','履','泰','否','同人','大有','谦','豫','随','蛊','临','观','噬嗑','贲','剥','复','无妄','大畜','颐','大过','坎','离','咸','恒','遁','大壮','晋','明夷','家人','睽','蹇','解','损','益','夬','姤','萃','升','困','井','革','鼎','震','艮','渐','归妹','丰','旅','巽','兑','涣','节','中孚','小过','既济','未济']
const hexagramThemes = ['主动开创','承载包容','起步艰难','学习启蒙','等待时机','分歧辨理','组织行动','亲近互助','小有积蓄','谨慎践行','通达协和','阻隔停滞','求同存异','丰盛有为','谦逊收敛','顺势而动']
type EngineResult = { items: FateDrawItem[]; facts: Record<string, string | number | string[]>; summary: string; guidance: string }
// 行列均按乾、兑、离、震、巽、坎、艮、坤排列；行是上卦，列是下卦，值为文王卦序。
const kingWenByTrigram = [
  [1, 10, 13, 25, 44, 6, 33, 12], [43, 58, 49, 17, 28, 47, 31, 45],
  [14, 38, 30, 21, 50, 64, 56, 35], [34, 54, 55, 51, 32, 40, 62, 16],
  [9, 61, 37, 42, 57, 59, 53, 20], [5, 60, 63, 3, 48, 29, 39, 8],
  [26, 41, 22, 27, 18, 4, 52, 23], [11, 19, 36, 24, 46, 7, 15, 2]
]
const trigramOrderByBinary: Record<number, number> = { 7: 0, 3: 1, 5: 2, 1: 3, 6: 4, 2: 5, 4: 6, 0: 7 }

export const getKingWenHexagram = (bits: number[]) => {
  if (bits.length !== 6 || bits.some(value => value !== 0 && value !== 1)) throw new Error('卦象必须包含六条阴阳爻')
  const lowerBinary = bits[0] + bits[1] * 2 + bits[2] * 4
  const upperBinary = bits[3] + bits[4] * 2 + bits[5] * 4
  const number = kingWenByTrigram[trigramOrderByBinary[upperBinary]][trigramOrderByBinary[lowerBinary]]
  return { number, name: hexagramNames[number - 1] }
}

const createSeed = () => {
  const values = new Uint32Array(4)
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(values)
  else values.forEach((_, index) => { values[index] = Math.floor(Math.random() * 0xffffffff) })
  return Array.from(values, value => value.toString(36)).join('-')
}
const hashSeed = (seed: string) => { let hash = 2166136261; for (const char of seed) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619) } return hash >>> 0 }
const rngFromSeed = (seed: string) => { let state = hashSeed(seed) || 1; return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const pickUnique = <T>(items: T[], count: number, random: () => number) => { const pool = [...items], selected: T[] = []; while (selected.length < Math.min(count, pool.length)) selected.push(pool.splice(Math.floor(random() * pool.length), 1)[0]); return selected }
const formatDateParts = (birthday: string, birthTime = '12:00') => { const [year, month, day] = birthday.split('-').map(Number); const [hour, minute] = birthTime.split(':').map(Number); return { year, month, day, hour: Number.isFinite(hour) ? hour : 12, minute: Number.isFinite(minute) ? minute : 0 } }
const defaultQuestion = (method: FateMethod) => method.questionHint.replace(/[？?]$/, '')
const positionNames = (count: number, methodId: string) => methodId === 'relationship' ? ['连接','沟通','边界','行动'] : count === 1 ? ['此刻'] : count === 3 ? ['看见','理解','行动'] : Array.from({ length: count }, (_, index) => `位置 ${index + 1}`)

const createDrawItems = (input: CreateFateReadingInput, seed: string, random: () => number): FateDrawItem[] => {
  const decks: Record<string, typeof oracleDeck> = { tarot: tarotDeck, lenormand: lenormandDeck, runes: runeDeck, oracle: oracleDeck, 'daily-oracle': oracleDeck, lots: lotDeck, dream: dreamDeck, relationship: tarotDeck }
  const deck = decks[input.method.id] || oracleDeck
  const count = input.method.drawCount || 1
  const positions = positionNames(count, input.method.id)
  return pickUnique(deck, count, random).map((card, index) => {
    const reversed = input.allowReversed && ['tarot', 'runes', 'relationship'].includes(input.method.id) && random() < .28
    return { ...card, position: positions[index], reversed, meaning: reversed ? `逆位并不等于坏结果；${card.meaning} 现在更需要向内检查或放慢处理。` : card.meaning, detail: `抽取记录 ${seed.slice(0, 8)} · ${index + 1}` }
  })
}

const createHexagramItems = (methodId: string, random: () => number) => {
  const lines = Array.from({ length: 6 }, () => { const coins = [random(), random(), random()].filter(value => value >= .5).length; return coins + 6 })
  const bits: number[] = lines.map(value => value % 2 === 1 ? 1 : 0)
  const moving = lines.map((value, index) => value === 6 || value === 9 ? index + 1 : 0).filter(Boolean)
  const changedBits: number[] = bits.map((value, bit) => moving.includes(bit + 1) ? 1 - value : value)
  const primaryHexagram = getKingWenHexagram(bits)
  const changedHexagram = getKingWenHexagram(changedBits)
  const primary = primaryHexagram.name
  const changed = changedHexagram.name
  const methodText = methodId === 'meihua' ? '时间取象' : methodId === 'liuyao' ? '六次投掷' : '三枚铜钱'
  return {
    items: [
      { id: `hex-${primaryHexagram.number}`, name: `${primary}卦`, glyph: bits.slice().reverse().map(value => value ? '━━' : '━ ━').join('\n'), position: '本卦', keywords: [hexagramThemes[(primaryHexagram.number - 1) % hexagramThemes.length], moving.length ? '有变' : '守成'], meaning: `本卦呈现“${hexagramThemes[(primaryHexagram.number - 1) % hexagramThemes.length]}”的主要情境。` },
      ...(moving.length ? [{ id: `hex-${changedHexagram.number}`, name: `${changed}卦`, glyph: changedBits.slice().reverse().map(value => value ? '━━' : '━ ━').join('\n'), position: '变卦', keywords: [hexagramThemes[(changedHexagram.number - 1) % hexagramThemes.length], '变化方向'], meaning: `变化之后更接近“${hexagramThemes[(changedHexagram.number - 1) % hexagramThemes.length]}”。` }] : [])
    ],
    facts: { 起卦方式: methodText, 六爻: lines.join('、'), 动爻: moving.length ? moving.map(value => `第${value}爻`).join('、') : '无动爻', 本卦: primary, 变卦: moving.length ? changed : '不变' }
  }
}

const createCalendarResult = (methodId: string, date = new Date()) => {
  const lunar = Solar.fromDate(date).getLunar()
  const phaseIndex = Math.max(0, Math.min(29, lunar.getDay() - 1))
  const phases = phaseIndex < 2 ? '新月期' : phaseIndex < 8 ? '盈月期' : phaseIndex < 16 ? '满月期' : phaseIndex < 23 ? '亏月期' : '残月期'
  const facts: Record<string, string | number | string[]> = {
    农历: lunar.toString(), 年柱: lunar.getYearInGanZhiExact(), 月柱: lunar.getMonthInGanZhiExact(), 日柱: lunar.getDayInGanZhiExact2(), 时柱: lunar.getTimeInGanZhi(), 节气: lunar.getJieQi() || '节气之间', 月相: phases
  }
  if (methodId === 'daily-almanac') { facts.宜 = lunar.getDayYi().slice(0, 8); facts.忌 = lunar.getDayJi().slice(0, 8) }
  if (methodId === 'qimen') { facts.时盘提示 = ['先定目标再行动','从可控的小处进入','先沟通再推进','观察环境反馈'][date.getHours() % 4]; facts.说明 = '此处为时辰与九宫象意提示，不替代专业奇门定局' }
  return { facts, summary: methodId === 'moon' ? `${phases} · 适合记录情绪与精力的变化` : methodId === 'qimen' ? `当前时盘更强调：${facts.时盘提示}` : `今日${lunar.getDayInGanZhiExact2()}，宜${lunar.getDayYi().slice(0, 3).join('、') || '从容安排'}`, guidance: methodId === 'moon' ? '写下正在增长、正在圆满和准备放下的各一件事。' : '把宜忌当作文化参考，真正的安排仍以现实条件为准。' }
}

const createBaziResult = (input: CreateFateReadingInput) => {
  if (!input.profile?.birthday) throw new Error('八字命盘需要先选择或建立出生档案')
  const p = formatDateParts(input.profile.birthday, input.profile.birthTime)
  const lunar = Solar.fromYmdHms(p.year, p.month, p.day, p.hour, p.minute, 0).getLunar()
  const eight = lunar.getEightChar()
  const columns = [
    ['年柱', eight.getYear(), eight.getYearWuXing(), eight.getYearNaYin(), eight.getYearHideGan().join('、')],
    ['月柱', eight.getMonth(), eight.getMonthWuXing(), eight.getMonthNaYin(), eight.getMonthHideGan().join('、')],
    ['日柱', eight.getDay(), eight.getDayWuXing(), eight.getDayNaYin(), eight.getDayHideGan().join('、')],
    ['时柱', eight.getTime(), eight.getTimeWuXing(), eight.getTimeNaYin(), eight.getTimeHideGan().join('、')]
  ]
  return {
    items: columns.map(([position, name, wuxing, nayin, hidden], index) => ({ id: `bazi-${index}`, name, glyph: name, position, keywords: [wuxing, nayin], meaning: `藏干：${hidden || '—'}；纳音：${nayin}。` })),
    facts: { 公历: `${input.profile.birthday} ${input.profile.birthTime || '12:00'}`, 农历: lunar.toString(), 四柱: eight.toString(), 日主: eight.getDayGan(), 胎元: eight.getTaiYuan(), 命宫: eight.getMingGong(), 身宫: eight.getShenGong() },
    summary: `${input.profile.name}的日主为${eight.getDayGan()}，四柱为${eight.toString()}。`,
    guidance: '命盘展示的是传统历法结构。完整强弱、格局和用神判断存在流派差异，不以单一标签下结论。'
  }
}

const createZiweiResult = (input: CreateFateReadingInput) => {
  if (!input.profile?.birthday) throw new Error('紫微命盘需要先选择或建立出生档案')
  const p = formatDateParts(input.profile.birthday, input.profile.birthTime)
  const timeIndex = p.hour === 23 ? 12 : Math.floor((p.hour + 1) / 2)
  const chart: any = astro.bySolar(input.profile.birthday, timeIndex, input.profile.gender, true, 'zh-CN')
  const items = chart.palaces.map((palace: any, index: number) => ({
    id: `ziwei-${index}`,
    name: String(palace.name),
    glyph: String(palace.earthlyBranch),
    position: `${palace.heavenlyStem}${palace.earthlyBranch}`,
    keywords: palace.majorStars.length ? palace.majorStars.map((star: any) => String(star.name)).slice(0, 4) : ['空宫'],
    meaning: palace.majorStars.length ? `主星：${palace.majorStars.map((star: any) => `${star.name}${star.mutagen ? `化${star.mutagen}` : ''}`).join('、')}` : '此宫无主星，传统解读通常会参考对宫与三方四正。'
  }))
  return { items, facts: { 公历: chart.solarDate, 农历: chart.lunarDate, 干支: chart.chineseDate, 时辰: `${chart.time}（${chart.timeRange}）`, 生肖: chart.zodiac, 星座: chart.sign, 命主: chart.soul, 身主: chart.body, 五行局: chart.fiveElementsClass }, summary: `${input.profile.name}的命主为${chart.soul}、身主为${chart.body}，属${chart.fiveElementsClass}。`, guidance: '点击各宫查看主星。不同流派的四化、亮度与运限规则可能不同，本盘采用库的通行配置。' }
}

const zodiacData = [
  ['摩羯座',1,19,'结构与长期目标'],['水瓶座',2,18,'独立与新视角'],['双鱼座',3,20,'感受与想象'],['白羊座',4,19,'行动与开始'],['金牛座',5,20,'稳定与价值'],['双子座',6,20,'沟通与连接'],['巨蟹座',7,22,'照顾与归属'],['狮子座',8,22,'表达与创造'],['处女座',9,22,'整理与完善'],['天秤座',10,22,'平衡与关系'],['天蝎座',11,21,'深度与转化'],['射手座',12,21,'探索与信念'],['摩羯座',12,31,'结构与长期目标']
] as const
const zodiacFor = (birthday: string) => { const [, month, day] = birthday.split('-').map(Number); return zodiacData.find(([, endMonth, endDay], index) => month < endMonth || (month === endMonth && day <= endDay) || index === zodiacData.length - 1) || zodiacData[0] }
const reduceNumber = (value: number) => { while (value > 9 && ![11, 22, 33].includes(value)) value = String(value).split('').reduce((sum, digit) => sum + Number(digit), 0); return value }

const createProfileSimpleResult = (input: CreateFateReadingInput): EngineResult => {
  if (!input.profile?.birthday) throw new Error('这个工具需要先选择或建立出生档案')
  if (input.method.kind === 'zodiac') {
    const [name,,, theme] = zodiacFor(input.profile.birthday)
    return { items: [{ id: 'zodiac', name, glyph: name.slice(0, 1), position: '太阳星座', keywords: theme.split('与'), meaning: `今天可从“${theme}”的张力里观察自己。` }], facts: { 生日: input.profile.birthday, 太阳星座: name, 今日主题: theme }, summary: `${input.profile.name}的太阳星座是${name}。`, guidance: '太阳星座只是完整星盘的一部分，此处不替代包含时间和地点的本命盘。' }
  }
  const digits = input.profile.birthday.replace(/\D/g, '').split('').map(Number)
  const life = reduceNumber(digits.reduce((sum, value) => sum + value, 0))
  const birth = reduceNumber(Number(input.profile.birthday.slice(-2)))
  const year = reduceNumber(new Date().getFullYear() + Number(input.profile.birthday.slice(5, 7)) + Number(input.profile.birthday.slice(8, 10)))
  const meanings: Record<number, string> = { 1:'自主与开创',2:'合作与感受',3:'表达与创造',4:'秩序与建设',5:'变化与自由',6:'照顾与责任',7:'思考与探索',8:'资源与实现',9:'理解与完成',11:'直觉与启发',22:'愿景与建造',33:'关怀与传递' }
  return { items: [{ id: 'life', name: `生命路径 ${life}`, glyph: String(life), position: '核心', keywords: (meanings[life] || '整合与成长').split('与'), meaning: `主要主题：${meanings[life] || '整合与成长'}。` }, { id: 'personal-year', name: `个人年 ${year}`, glyph: String(year), position: '今年', keywords: (meanings[year] || '调整与前进').split('与'), meaning: `年度练习：${meanings[year] || '调整与前进'}。` }], facts: { 生命路径数: life, 生日数: birth, 个人年: year }, summary: `${input.profile.name}的生命路径数为 ${life}，今年个人年为 ${year}。`, guidance: '数字学用于组织自我观察主题，不用于预测必然事件。' }
}

const createChoiceResult = (methodId: string, random: () => number): EngineResult => {
  if (methodId === 'astrology-dice') {
    const planets = ['太阳','月亮','水星','金星','火星','木星','土星','天王星','海王星','冥王星','北交点','南交点']
    const signs = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼']
    const planet = planets[Math.floor(random() * planets.length)], sign = signs[Math.floor(random() * signs.length)], house = Math.floor(random() * 12) + 1
    return { items: [{ id: 'planet', name: planet, glyph: '星', position: '动力', keywords: ['核心力量'], meaning: `${planet}描述事情由什么力量推动。` }, { id: 'sign', name: sign, glyph: '座', position: '方式', keywords: ['表达方式'], meaning: `${sign}提示这股力量如何表达。` }, { id: 'house', name: `第${house}宫`, glyph: String(house), position: '领域', keywords: ['现实落点'], meaning: `第${house}宫指向最值得观察的生活领域。` }], facts: { 行星: planet, 星座: sign, 宫位: house }, summary: `${planet}落在${sign}与第${house}宫的组合主题。`, guidance: '先分别理解动力、方式和领域，再把三者连成一句与现实有关的话。' }
  }
  if (methodId === 'pendulum') {
    const answers = [['倾向是','现实条件正在支持'],['倾向否','先处理阻力与边界'],['暂缓','信息还不完整'],['换个问法','问题里可能混合了多个决定']]
    const answer = answers[Math.floor(random() * answers.length)]
    return { items: [{ id: 'pendulum', name: answer[0], glyph: '◇', position: '回应', keywords: [answer[1]], meaning: answer[1] }], facts: { 回应: answer[0] }, summary: `${answer[0]}：${answer[1]}。`, guidance: '把它当作梳理直觉的起点，不要替代现实证据与重要决定。' }
  }
  const prompts = ['哪种选择更符合长期价值？','哪个选项的代价是你愿意承担的？','如果不担心别人评价，你会靠近哪边？','哪个选项保留了更多调整空间？']
  const selected = pickUnique(prompts, 2, random)
  return { items: selected.map((text, index) => ({ id: `choice-${index}`, name: index ? '另一条路' : '这条路', glyph: index ? '乙' : '甲', position: index ? '选项 B' : '选项 A', keywords: ['代价','价值'], meaning: text })), facts: { 说明: '此工具不随机替你决定，只提供两组审视问题' }, summary: '真正的差异不只在结果，也在你愿意承受哪一种过程。', guidance: '分别写下两个选项最坏、最好和最可能的结果，再看哪组代价更可接受。' }
}

export const createFateReading = (input: CreateFateReadingInput): FateReading => {
  const seed = input.seed || createSeed()
  const random = rngFromSeed(seed)
  let items: FateDrawItem[] = [], facts: Record<string, string | number | string[]> = {}, summary = '', guidance = ''
  if (input.method.kind === 'draw') {
    items = createDrawItems(input, seed, random)
    summary = items.map(item => `${item.position}是${item.name}${item.reversed ? '（逆位）' : ''}`).join('；') + '。'
    guidance = items.map(item => item.keywords[0]).filter(Boolean).join('、') + '是这次可以继续观察的主题。'
    facts = { 抽取数量: items.length, 是否启用逆位: input.allowReversed ? '是' : '否' }
  } else if (input.method.kind === 'hexagram') {
    const result = createHexagramItems(input.method.id, random); items = result.items; facts = result.facts; summary = `${result.facts.本卦}${result.facts.变卦 !== '不变' ? `之${result.facts.变卦}` : '静卦'}。`; guidance = items.map(item => item.meaning).join(' ')
  } else if (input.method.kind === 'calendar') {
    const result = createCalendarResult(input.method.id); facts = result.facts; summary = result.summary; guidance = result.guidance
    items = [{ id: input.method.id, name: String(facts.月相 || facts.日柱 || input.method.name), glyph: input.method.glyph, position: '此刻', keywords: [String(facts.节气 || '当下'), String(facts.日柱 || '')].filter(Boolean), meaning: guidance }]
  } else if (input.method.kind === 'bazi') {
    const result = createBaziResult(input); ({ items, facts, summary, guidance } = result)
  } else if (input.method.kind === 'ziwei') {
    const result = createZiweiResult(input); ({ items, facts, summary, guidance } = result)
  } else if (input.method.kind === 'zodiac' || input.method.kind === 'numerology') {
    const result = createProfileSimpleResult(input); ({ items, facts, summary, guidance } = result)
  } else {
    const result = createChoiceResult(input.method.id, random); ({ items, facts, summary, guidance } = result)
  }
  return {
    id: `fate_${Date.now()}_${seed.slice(0, 6)}`,
    methodId: input.method.id,
    methodName: input.method.name,
    methodKind: input.method.kind,
    question: input.question.trim() || defaultQuestion(input.method),
    targetKind: input.targetKind,
    targetId: input.targetId,
    targetName: input.targetName,
    profileId: input.profile?.id,
    profileName: input.profile?.name,
    createdAt: Date.now(), seed, summary, guidance,
    caution: '结果用于娱乐与自我反思，不替代医疗、法律、财务或其他专业判断。',
    items, facts, favorite: false, chatInfluence: false, engineVersion: FATE_ENGINE_VERSION
  }
}

export const todayFatePreview = () => createCalendarResult('daily-almanac')

export const serializeReadingForAi = (reading: FateReading, options: { includeTargetName?: boolean } = {}) => JSON.stringify({
    method: reading.methodName,
    question: reading.question,
    target: options.includeTargetName ? (reading.targetName || reading.targetKind) : reading.targetKind,
  rawFacts: reading.facts,
  draws: reading.items.map(item => ({ position: item.position, name: item.name, reversed: item.reversed, keywords: item.keywords, baseMeaning: item.meaning }))
}, null, 2)
