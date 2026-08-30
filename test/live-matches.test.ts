import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { transformCoreFixturesToMatches } from '../lib/live-matches'

describe('live match core fallback', () => {
	it('projects the next event schedule without inventing live details', () => {
		const [match] = transformCoreFixturesToMatches(2, [
			{
				id: 101,
				finished: false,
				started: false,
				kickoffTime: '2026-08-29T15:00:00.000Z',
				homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
				awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
				homeScore: null,
				awayScore: null
			}
		])

		assert.equal(match?.eventId, 2)
		assert.equal(match?.status, 'NOT_STARTED')
		assert.equal(match?.kickoff, '2026-08-29T15:00:00.000Z')
		assert.deepEqual(match?.homeTeam.players, [])
		assert.equal(match?.homeTeam.shortName, 'ARS')
	})
})
