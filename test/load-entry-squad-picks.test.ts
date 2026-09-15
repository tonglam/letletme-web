import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EventsResponse } from '../lib/graphql/operations/events'
import {
	classifyEntrySquadPicks,
	runSquadReadWithinBudget,
	squadReadOptions,
	squadPickEventCandidates,
	type SquadPickSeed
} from '../lib/squad-picks'

describe('squadPickEventCandidates', () => {
	it('prefers the current GW and does not probe an unpublished upcoming GW first', () => {
		const events: EventsResponse = {
			current: [{ id: 28 }],
			next: [{ id: 29, deadlineTime: '2026-08-14T11:00:00Z' }],
		}
		assert.deepEqual(squadPickEventCandidates(events), [28])
	})

	it('uses history before an upcoming GW when no current event exists', () => {
		const events: EventsResponse = {
			current: [],
			next: [{ id: 30, deadlineTime: '2026-08-07T11:00:00Z' }],
		}
		assert.deepEqual(
			squadPickEventCandidates(events, [26, 27, 28]),
			[28, 27, 26, 30]
		)
	})

	it('falls back to the latest finished GW when history is unavailable', () => {
		const events: EventsResponse = {
			current: [{ id: 3 }],
			next: [{ id: 4, deadlineTime: '2026-08-21T11:00:00Z' }],
			latestFinishedEventId: 2,
		}
		assert.deepEqual(squadPickEventCandidates(events), [3, 2])
	})

	it('dedupes repeated ids', () => {
		const events: EventsResponse = {
			current: [{ id: 28 }],
			next: [{ id: 28, deadlineTime: '2026-08-07T11:00:00Z' }],
		}
		assert.deepEqual(squadPickEventCandidates(events), [28])
	})
})

describe('classifyEntrySquadPicks', () => {
	it('distinguishes unpublished picks from a failed backend request', () => {
		assert.deepEqual(classifyEntrySquadPicks([], false), {
			picks: [],
			state: 'not-published'
		})
		assert.deepEqual(classifyEntrySquadPicks([], true), {
			picks: [],
			state: 'unavailable'
		})
	})

	it('keeps successfully recovered picks ready after an earlier request failed', () => {
		const picks = [{ elementId: 1 }] as SquadPickSeed[]
		assert.deepEqual(classifyEntrySquadPicks(picks, true), {
			picks,
			state: 'ready'
		})
	})
})


describe('personal squad total deadline', () => {
	it('aborts an in-flight HTTP read and returns unavailable rather than unpublished', async () => {
		let signal: AbortSignal | undefined
		const result = await runSquadReadWithinBudget(async budget => {
			signal = squadReadOptions(budget).signal
			await new Promise((_, reject) => signal!.addEventListener('abort', () => reject(signal!.reason)))
			return { picks: [], state: 'not-published' }
		}, 25)
		assert.equal(signal?.aborted, true)
		assert.deepEqual(result, { picks: [], state: 'unavailable' })
	})
	it('lets an uncancellable identity finish but prevents subsequent candidate and pagination requests', async () => {
		let releaseIdentity!: () => void
		let followUpRequests = 0
		const identity = new Promise<void>(resolve => { releaseIdentity = resolve })
		const result = await runSquadReadWithinBudget(async budget => {
			await identity
			squadReadOptions(budget)
			followUpRequests++
			return { picks: [], state: 'ready' }
		}, 25)
		releaseIdentity()
		await new Promise(resolve => setImmediate(resolve))
		assert.equal(result.state, 'unavailable')
		assert.equal(followUpRequests, 0)
	})
	it('shrinks the remaining request timeout across serial reads and preserves domain success', async () => {
		const result = await runSquadReadWithinBudget(async budget => {
			const first = squadReadOptions(budget).timeoutMs
			await new Promise(resolve => setTimeout(resolve, 15))
			assert.ok(squadReadOptions(budget).timeoutMs < first)
			return { picks: [], state: 'unbound' }
		})
		assert.equal(result.state, 'unbound')
	})
})

it('rejects a completed result if synchronous work exhausted the deadline before timers could run', async () => {
	const result = await runSquadReadWithinBudget(async () => {
		const end = Date.now() + 15
		while (Date.now() < end) { /* model a blocked event loop before completion */ }
		return { picks: [], state: 'ready' }
	}, 5)
	assert.equal(result.state, 'unavailable')
})
