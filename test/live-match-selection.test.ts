import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { selectLiveMatchEvent } from '../lib/live-match-selection'
import type { Match } from '../types/match'

const match = (
	eventId: number,
	kickoff: string,
	status: Match['status']
): Match => ({
	id: `${eventId}-${kickoff}`,
	eventId,
	kickoff,
	status,
	minute: 0,
	viewers: 0,
	homeTeam: {
		name: 'A',
		shortName: 'A',
		score: 0,
		possession: 0,
		shots: 0,
		shotsOnTarget: 0,
		corners: 0,
		players: []
	},
	awayTeam: {
		name: 'B',
		shortName: 'B',
		score: 0,
		possession: 0,
		shots: 0,
		shotsOnTarget: 0,
		corners: 0,
		players: []
	}
})

describe('selectLiveMatchEvent', () => {
	it('keeps today active even when the FPL current event is stale', () => {
		assert.equal(
			selectLiveMatchEvent(
				[
					match(1, '2026-08-26T08:00:00Z', 'NOT_STARTED'),
					match(2, '2026-08-29T08:00:00Z', 'NOT_STARTED')
				],
				1,
				new Date('2026-08-26T07:00:00Z')
			),
			1
		)
	})

	it('moves to the nearest future event after today finishes', () => {
		assert.equal(
			selectLiveMatchEvent(
				[
					match(1, '2026-08-26T06:00:00Z', 'FT'),
					match(2, '2026-08-29T08:00:00Z', 'NOT_STARTED')
				],
				1,
				new Date('2026-08-26T12:00:00Z')
			),
			2
		)
	})

	it('keeps the lifecycle anchor separate from the displayed future event', () => {
		const matches = [
			match(1, '2026-08-26T06:00:00Z', 'FT'),
			match(2, '2026-08-29T08:00:00Z', 'NOT_STARTED')
		]
		const lifecycleAnchor = 1
		const selectedEventId = selectLiveMatchEvent(
			matches,
			lifecycleAnchor,
			new Date('2026-08-26T12:00:00Z')
		)

		assert.equal(selectedEventId, 2)
		assert.deepEqual(
			matches
				.filter(item => item.eventId === selectedEventId)
				.map(item => item.eventId),
			[2]
		)
		assert.equal(lifecycleAnchor, 1)
	})
})
