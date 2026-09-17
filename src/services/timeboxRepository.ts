/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import localforage from 'localforage'
import type { TimeboxSettings, TimeboxSnapshot } from '../types/timebox'

const store = localforage.createInstance({ name: 'nrt-app', storeName: 'timebox' })
const SNAPSHOT_KEY = 'snapshot_v1'

export const createDefaultTimeboxSettings = (): TimeboxSettings => ({
  defaultMode: 'countdown',
  defaultFocusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  pomodoroRounds: 4,
  autoStartFocus: false,
  autoStartBreak: false,
  autoRollover: false,
  autoSchedule: false,
  completionSound: false,
  vibration: false,
  browserNotifications: false,
  earlyReminder: false,
  overtimeReminder: false,
  keepScreenAwake: false,
  fullscreenOnStart: false,
  leaveDetection: false,
  recordInterruptions: false,
  recordHistory: false,
  analytics: false,
  companionEnabled: false,
  companionSilentPresence: false,
  companionStartMessage: false,
  companionFinishMessage: false,
  companionCheckpoints: false,
  companionManualCall: false,
  companionStrictMode: false,
  companionRomanceMode: false,
  companionAi: false,
  companionReadTaskNote: false,
  companionReadStats: false,
  companionWriteToChat: false,
  companionWriteMemory: false,
  companionCharacterId: null,
  dailyAiMessageLimit: 3,
  webdavSync: false,
  calendarSync: false,
  cloudPush: false,
  crossDeviceTimer: false
})

export const createDefaultTimeboxSnapshot = (): TimeboxSnapshot => ({
  version: 1,
  tasks: [],
  sessions: [],
  activeSessionId: null,
  settings: createDefaultTimeboxSettings(),
  updatedAt: Date.now()
})

export const normalizeTimeboxSnapshot = (raw?: Partial<TimeboxSnapshot> | null): TimeboxSnapshot => {
  const base = createDefaultTimeboxSnapshot()
  if (!raw || Number(raw.version) !== 1) return base
  return {
    ...base,
    ...raw,
    version: 1,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(-2000) : [],
    activeSessionId: typeof raw.activeSessionId === 'string' ? raw.activeSessionId : null,
    settings: { ...base.settings, ...(raw.settings || {}) },
    updatedAt: Number(raw.updatedAt || Date.now())
  }
}

export const loadTimeboxSnapshot = async () => normalizeTimeboxSnapshot(await store.getItem<TimeboxSnapshot>(SNAPSHOT_KEY))

export const saveTimeboxSnapshot = async (snapshot: TimeboxSnapshot) => {
  snapshot.updatedAt = Date.now()
  await store.setItem(SNAPSHOT_KEY, JSON.parse(JSON.stringify(snapshot)))
}

export const replaceTimeboxSnapshot = async (snapshot: TimeboxSnapshot) => {
  const normalized = normalizeTimeboxSnapshot(snapshot)
  await saveTimeboxSnapshot(normalized)
  return normalized
}

export const clearTimeboxSnapshot = async () => store.removeItem(SNAPSHOT_KEY)

