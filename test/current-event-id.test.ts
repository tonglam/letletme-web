import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickCurrentEventId } from '../lib/events-current'
import type { EventsResponse } from '../lib/graphql/operations/events'

describe('pickCurrentEventId', () => {
	it('returns null when current is empty (no next/snapshot fallback)', () => {
		const events: EventsResponse = {
			current: [],
			next: [{ id: 1, deadlineTime: '2026-01-01T00:00:00Z' }],
		}
		assert.equal(pickCurrentEventId(events), null)
		assert.equal(pickCurrentEventId(null), null)
		assert.equal(pickCurrentEventId(undefined), null)
	})

	it('returns the isCurrent event id when present', () => {
		const events: EventsResponse = {
			current: [{ id: 28 }],
			next: [{ id: 29, deadlineTime: '2026-01-01T00:00:00Z' }],
		}
		assert.equal(pickCurrentEventId(events), 28)
	})

	it('rejects non-positive ids', () => {
		assert.equal(
			pickCurrentEventId({ current: [{ id: 0 }], next: [] }),
			null,
		)
	})
})
