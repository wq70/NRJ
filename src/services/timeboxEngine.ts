/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import type { TimeboxSession } from '../types/timebox'

export const clampTimeboxMinutes = (value: number, fallback = 25) => {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(1, Math.min(1440, Math.round(numeric))) : fallback
}

export const sessionElapsedMs = (session: TimeboxSession, now = Date.now()) => {
  const stoppedAt = session.finishedAt || session.pausedAt || now
  return Math.max(0, stoppedAt - session.startedAt - session.totalPausedMs)
}

export const sessionRemainingMs = (session: TimeboxSession, now = Date.now()) => {
  if (session.mode === 'stopwatch' || session.mode === 'flowtime') return 0
  if (session.status === 'paused' && session.remainingMsAtPause !== null) return Math.max(0, session.remainingMsAtPause)
  if (session.endAt === null) return 0
  return Math.max(0, session.endAt - now)
}

export const isSessionDue = (session: TimeboxSession, now = Date.now()) => (
  session.status === 'running' && session.endAt !== null && session.endAt <= now
)

export const formatClockMs = (milliseconds: number) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export const localDateKey = (time: number) => {
  const date = new Date(time)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

