import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	isPreseasonReviewAnchor,
	maxEventIdFromHistory,
	resolveFixturePlanningGameweek,
	resolveReviewGameweekAnchor,
} from '@/lib/review-gameweek'

describe('resolveReviewGameweekAnchor', () => {
	it('distinguishes preseason GW1 from a later between-GW anchor', () => {
		assert.equal(
			isPreseasonReviewAnchor({
				currentGw: null,
				anchorGw: 1,
				source: 'next-derived',
			}),
			true,
		)
		assert.equal(
			isPreseasonReviewAnchor({
				currentGw: null,
				anchorGw: 4,
				source: 'next-derived',
			}),
			false,
		)
	})
	it('prefers isCurrent when present', () => {
		const result = resolveReviewGameweekAnchor({
			current: [{ id: 28 }],
			next: [{ id: 29, deadlineTime: '2026-01-01T00:00:00Z' }],
		})
		assert.deepEqual(result, {
			currentGw: 28,
			anchorGw: 28,
			source: 'current',
		})
	})

	it('derives from next when current is empty', () => {
		const result = resolveReviewGameweekAnchor({
			current: [],
			next: [{ id: 29, deadlineTime: '2026-01-01T00:00:00Z' }],
		})
		assert.equal(result.currentGw, null)
		assert.equal(result.anchorGw, 28)
		assert.equal(result.source, 'next-derived')
	})

	it('uses history max when events empty', () => {
		const result = resolveReviewGameweekAnchor(
			{ current: [], next: [] },
			{ historyMaxEventId: 22 },
		)
		assert.deepEqual(result, {
			currentGw: null,
			anchorGw: 22,
			source: 'history',
		})
	})

	it('returns none when no signal', () => {
		const result = resolveReviewGameweekAnchor(null)
		assert.deepEqual(result, {
			currentGw: null,
			anchorGw: null,
			source: 'none',
		})
	})
})

describe('resolveFixturePlanningGameweek', () => {
	it('uses the active event and otherwise starts at the upcoming event', () => {
		assert.equal(
			resolveFixturePlanningGameweek({
				current: [{ id: 28 }],
				next: [{ id: 29, deadlineTime: '2026-01-01T00:00:00Z' }],
			}),
			28,
		)
		assert.equal(
			resolveFixturePlanningGameweek({
				current: [],
				next: [{ id: 29, deadlineTime: '2026-01-01T00:00:00Z' }],
			}),
			29,
		)
	})
})

describe('maxEventIdFromHistory', () => {
	it('returns max positive eventId', () => {
		assert.equal(
			maxEventIdFromHistory([{ eventId: 3 }, { eventId: 12 }, { eventId: 7 }]),
			12,
		)
	})

	it('returns null for empty', () => {
		assert.equal(maxEventIdFromHistory([]), null)
		assert.equal(maxEventIdFromHistory(null), null)
	})
})
