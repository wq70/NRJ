/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import localforage from 'localforage'
import type { DanmakuSnapshot } from '../types/danmaku'
import { normalizeDanmakuSnapshot, pruneDanmakuSnapshot } from './danmakuRuntime'
const store = localforage.createInstance({ name: 'nrt-danmaku', storeName: 'danmakuState' })
export const loadDanmakuSnapshot = async (accountId: string) => pruneDanmakuSnapshot(normalizeDanmakuSnapshot(await store.getItem(accountId)))
export const saveDanmakuSnapshot = (accountId: string, snapshot: DanmakuSnapshot) => store.setItem(accountId, JSON.parse(JSON.stringify(pruneDanmakuSnapshot(snapshot))))
