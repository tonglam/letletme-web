import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	computeTimeLeft,
	homeDeadlineRefreshDelayMs
} from '../lib/home-deadline'

describe('Home deadline initial state', () => {
	it('computes the server-rendered countdown from explicit timestamps', () => {
		const now = Date.UTC(2026, 7, 14, 0, 0, 0)
		assert.deepEqual(computeTimeLeft(now + 90_061_000, now), {
			days: 1,
			hours: 1,
			minutes: 1,
			seconds: 1
		})
	})

	it('returns zeros for absent or elapsed deadlines', () => {
		assert.deepEqual(computeTimeLeft(null, 100), {
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0
		})
		assert.deepEqual(computeTimeLeft(99, 100), {
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0
		})
	})

	it('keeps post-deadline retries alive with a bounded backoff', () => {
		assert.deepEqual(
			[1, 2, 3, 5, 9, 20].map(homeDeadlineRefreshDelayMs),
			[30_000, 30_000, 60_000, 120_000, 300_000, 300_000]
		)
	})
})
