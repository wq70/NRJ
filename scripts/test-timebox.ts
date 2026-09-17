/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { createDefaultTimeboxSettings, createDefaultTimeboxSnapshot, normalizeTimeboxSnapshot } from '../src/services/timeboxRepository'
import { clampTimeboxMinutes, formatClockMs, isSessionDue, sessionElapsedMs, sessionRemainingMs } from '../src/services/timeboxEngine'
import type { TimeboxSession } from '../src/types/timebox'

const session = (patch: Partial<TimeboxSession> = {}): TimeboxSession => ({
  id: 'session_test', taskId: 'task_test', taskTitle: '测试任务', mode: 'countdown', status: 'running', plannedMinutes: 25,
  startedAt: 1_000, endAt: 1_501_000, pausedAt: null, remainingMsAtPause: null, totalPausedMs: 0, finishedAt: null,
  actualFocusMs: 0, outcome: null, reviewNote: '', interruptionCount: 0, interruptionReasons: [], companionCharacterId: null,
  companionMessages: [], createdAt: 1_000, updatedAt: 1_000, ...patch
})

assert.equal(clampTimeboxMinutes(0), 1)
assert.equal(clampTimeboxMinutes(2000), 1440)
assert.equal(formatClockMs(65_000), '01:05')
assert.equal(sessionRemainingMs(session(), 501_000), 1_000_000)
assert.equal(sessionElapsedMs(session({ totalPausedMs: 100_000 }), 501_000), 400_000)
assert.equal(isSessionDue(session(), 1_501_000), true)
assert.equal(isSessionDue(session({ status: 'paused' }), 2_000_000), false)
assert.equal(sessionRemainingMs(session({ status: 'paused', pausedAt: 500_000, remainingMsAtPause: 900_000 }), 2_000_000), 900_000)

const settings = createDefaultTimeboxSettings()
const booleanSettings = Object.entries(settings).filter(([, value]) => typeof value === 'boolean')
assert.ok(booleanSettings.length > 20)
assert.deepEqual(booleanSettings.filter(([, value]) => value !== false), [], '所有主动能力必须默认关闭')

const snapshot = createDefaultTimeboxSnapshot()
assert.equal(snapshot.tasks.length, 0)
assert.equal(snapshot.sessions.length, 0)
assert.equal(snapshot.activeSessionId, null)

const normalized = normalizeTimeboxSnapshot({ ...snapshot, settings: { ...settings, completionSound: true } })
assert.equal(normalized.settings.completionSound, true)
assert.equal(normalized.settings.companionAi, false)

console.log('timebox tests passed')

