/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */

export type TimeboxMode = 'countdown' | 'pomodoro' | 'stopwatch' | 'flowtime'
export type TimeboxTaskStatus = 'inbox' | 'planned' | 'doing' | 'completed' | 'cancelled'
export type TimeboxSessionStatus = 'running' | 'paused' | 'awaiting_review' | 'completed' | 'cancelled'
export type TimeboxOutcome = 'completed' | 'partial' | 'unfinished' | 'cancelled'
export type TimeboxEnergy = 'low' | 'medium' | 'high'

export interface TimeboxTask {
  id: string
  title: string
  note: string
  project: string
  tags: string[]
  status: TimeboxTaskStatus
  priority: 0 | 1 | 2 | 3
  energy: TimeboxEnergy
  estimateMinutes: number
  scheduledStart: number | null
  scheduledEnd: number | null
  deadline: number | null
  definitionOfDone: string
  checklist: Array<{ id: string; text: string; done: boolean }>
  allowSplit: boolean
  companionOverride: boolean | null
  createdAt: number
  updatedAt: number
  completedAt: number | null
}

export interface TimeboxCompanionMessage {
  id: string
  phase: 'start' | 'manual' | 'finish'
  text: string
  createdAt: number
  source: 'local' | 'ai'
}

export interface TimeboxSession {
  id: string
  taskId: string | null
  taskTitle: string
  mode: TimeboxMode
  status: TimeboxSessionStatus
  plannedMinutes: number
  startedAt: number
  endAt: number | null
  pausedAt: number | null
  remainingMsAtPause: number | null
  totalPausedMs: number
  finishedAt: number | null
  actualFocusMs: number
  outcome: TimeboxOutcome | null
  reviewNote: string
  interruptionCount: number
  interruptionReasons: string[]
  companionCharacterId: string | number | null
  companionMessages: TimeboxCompanionMessage[]
  createdAt: number
  updatedAt: number
}

export interface TimeboxSettings {
  defaultMode: TimeboxMode
  defaultFocusMinutes: number
  shortBreakMinutes: number
  longBreakMinutes: number
  pomodoroRounds: number
  autoStartFocus: boolean
  autoStartBreak: boolean
  autoRollover: boolean
  autoSchedule: boolean
  completionSound: boolean
  vibration: boolean
  browserNotifications: boolean
  earlyReminder: boolean
  overtimeReminder: boolean
  keepScreenAwake: boolean
  fullscreenOnStart: boolean
  leaveDetection: boolean
  recordInterruptions: boolean
  recordHistory: boolean
  analytics: boolean
  companionEnabled: boolean
  companionSilentPresence: boolean
  companionStartMessage: boolean
  companionFinishMessage: boolean
  companionCheckpoints: boolean
  companionManualCall: boolean
  companionStrictMode: boolean
  companionRomanceMode: boolean
  companionAi: boolean
  companionReadTaskNote: boolean
  companionReadStats: boolean
  companionWriteToChat: boolean
  companionWriteMemory: boolean
  companionCharacterId: string | number | null
  dailyAiMessageLimit: number
  webdavSync: boolean
  calendarSync: boolean
  cloudPush: boolean
  crossDeviceTimer: boolean
}

export interface TimeboxSnapshot {
  version: 1
  tasks: TimeboxTask[]
  sessions: TimeboxSession[]
  activeSessionId: string | null
  settings: TimeboxSettings
  updatedAt: number
}

