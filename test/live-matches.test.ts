import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	mergeLiveFixturePlayers,
	transformCoreFixturesToMatches
} from '../lib/live-matches'

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

	it('keeps the official player price when fixture details are hydrated', () => {
		const matches = transformCoreFixturesToMatches(2, [
			{
				id: 101,
				finished: false,
				started: true,
				kickoffTime: '2026-08-29T15:00:00.000Z',
				homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
				awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
				homeScore: 1,
				awayScore: 0
			}
		])
		const [match] = mergeLiveFixturePlayers(matches, [
			{
				season: '2627',
				eventId: 2,
				scoreCoreRevision: 'score-core-v2',
				fixtureId: 101,
				players: [
					{
						player: {
							id: 7,
							webName: 'Saka',
							position: 'MIDFIELDER',
							price: 101,
							team: { id: 1, name: 'Arsenal', shortName: 'ARS' }
						},
						minutes: 45,
						totalPoints: 6
					}
				]
			}
		] as never)

		assert.equal(match?.homeTeam.players[0]?.player, 'Saka')
		assert.equal(match?.homeTeam.players[0]?.price, 101)
	})
})
