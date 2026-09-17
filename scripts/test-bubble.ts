/* WARNING: 本项目专属“粘人精”，严禁出现无关角色命名！ */
import assert from 'node:assert/strict'
import { bubbleStudioState, buildBubbleChatContext, createDefaultBubbleSnapshot, simulateFanReplies } from '../src/services/bubbleStudio'
import type { BubblePost } from '../src/types/bubble'

const snapshot = createDefaultBubbleSnapshot(1_800_000_000_000)
assert.equal(snapshot.schemaVersion, 1)
assert.ok(snapshot.fans.length >= 16, 'creator experience should start with a varied fan base')
assert.ok(new Set(snapshot.fans.map(item => item.archetype)).size >= 8, 'fan archetypes should not collapse into one generic audience')
assert.ok(snapshot.fans.every(item => item.id && item.name && item.note), 'every fan needs usable identity and context')
assert.equal(snapshot.settings.allowCharacterSubscribers, false, 'character data access must be opt-in')
assert.equal(snapshot.settings.chatBridgeEnabled, false, 'chat prompt bridge must be opt-in')
assert.equal(snapshot.settings.sharePublishedPostsToChat, false, 'post sharing must be opt-in')
assert.equal(snapshot.settings.shareFanFeedbackToChat, false, 'fan feedback sharing must be opt-in')
assert.equal(snapshot.settings.shareCharacterSubscriptionEventsToChat, false, 'subscription event sharing must be opt-in')
assert.equal(buildBubbleChatContext('any-character'), '', 'disabled bridge must add zero chat prompt content')

const post: BubblePost = {
  id: 'test-post', kind: 'photo', content: '今天结束得比想象中早，给你们看看回去路上的晚霞。', createdAt: 1_800_000_000_000, publishAt: 1_800_000_000_000,
  status: 'published', mediaAssetId: '', mediaName: '', mediaMimeType: '', pollOptions: [], replyCount: 0, heartCount: 0, readCount: 0, subscriberDelta: 0
}

const repliesA = simulateFanReplies(post, snapshot.fans, 'balanced')
const repliesB = simulateFanReplies(post, snapshot.fans, 'balanced')
assert.deepEqual(repliesA, repliesB, 'same post should produce stable fan feedback instead of changing on every render')
assert.ok(repliesA.length >= 8 && repliesA.length <= 12, 'balanced density should remain readable on mobile')
assert.equal(new Set(repliesA.map(item => item.fanId)).size, repliesA.length, 'one fan should not flood a single post')
assert.ok(new Set(repliesA.map(item => item.content)).size >= Math.ceil(repliesA.length * .65), 'fan feedback should remain meaningfully varied')
assert.ok(repliesA.every(item => item.createdAt > post.createdAt), 'replies should arrive after the creator post')

const quiet = simulateFanReplies({ ...post, id: 'quiet-post' }, snapshot.fans, 'quiet')
const busy = simulateFanReplies({ ...post, id: 'busy-post' }, snapshot.fans, 'busy')
assert.ok(quiet.length < repliesA.length && busy.length > repliesA.length, 'reply density setting should visibly affect the experience')

Object.assign(bubbleStudioState, snapshot)
bubbleStudioState.posts.unshift(post)
bubbleStudioState.settings.chatBridgeEnabled = true
bubbleStudioState.settings.sharePublishedPostsToChat = true
assert.match(buildBubbleChatContext('any-character'), /用户最近公开发布的泡泡/)
bubbleStudioState.settings.chatBridgeEnabled = false
assert.equal(buildBubbleChatContext('any-character'), '', 'master switch must override every enabled detail switch')

console.log(`bubble tests passed: ${snapshot.fans.length} varied fans, deterministic feedback, density and anti-flood checks`)
