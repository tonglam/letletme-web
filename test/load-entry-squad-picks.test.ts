import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EventsResponse } from '../lib/graphql/operations/events'
import { squadPickEventCandidates } from '../lib/squad-picks'

describe('squadPickEventCandidates', () => {
	it('orders candidates by descending GW (latest first)', () => {
		const events: EventsResponse = {
			current: [{ id: 28 }],
			next: [{ id: 29, deadlineTime: '2026-08-14T11:00:00Z' }],
		}
		assert.deepEqual(squadPickEventCandidates(events), [29, 28])
	})

	it('includes history GWs and upcoming next, sorted high to low', () => {
		const events: EventsResponse = {
			current: [],
			next: [{ id: 30, deadlineTime: '2026-08-07T11:00:00Z' }],
		}
		assert.deepEqual(
			squadPickEventCandidates(events, [26, 27, 28]),
			[30, 29, 28, 27, 26],
		)
	})

	it('dedupes repeated ids', () => {
		const events: EventsResponse = {
			current: [{ id: 28 }],
			next: [{ id: 28, deadlineTime: '2026-08-07T11:00:00Z' }],
		}
		assert.deepEqual(squadPickEventCandidates(events), [28])
	})
})
