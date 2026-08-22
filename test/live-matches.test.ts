import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	getLiveMatchesSnapshot,
	loadLiveMatchdayDesk,
	type QueryExecutor
} from '../lib/live-matches'

const desk = (revision = '8') => ({
	liveMatchdayDesk: {
		season: '2627',
		eventId: 1,
		revision,
		state: 'LIVE',
		windowState: 'LIVE_ACTIVE',
		dataAvailability: 'FRESH',
		liveRevision: revision,
		publishedAt: '2026-08-22T14:00:00.000Z',
		sourceCheckedAt: '2026-08-22T14:00:30.000Z',
		source: 'REDIS',
		stale: false,
		nextRefreshAt: '2026-08-22T14:01:00.000Z',
		matches: [
			{
				fixtureId: 1,
				eventId: 1,
				homeTeamId: 1,
				homeTeamName: 'Arsenal',
				homeTeamShortName: 'ARS',
				awayTeamId: 2,
				awayTeamName: 'Coventry City',
				awayTeamShortName: 'COV',
				homeScore: 3,
				awayScore: 0,
				kickoffTime: '2026-08-22T03:00:00.000Z',
				minutes: 90,
				started: true,
				finished: true,
				finishedProvisional: false
			}
		],
		nextFixtures: []
	}
})

const players = (revision = '8') => ({
	fixture0: {
		season: '2627',
		eventId: 1,
		revision,
		fixtureId: 1,
		players: [
			{
				player: {
					id: 101,
					webName: 'Tzolis',
					position: 'MIDFIELDER',
					team: { id: 1, name: 'Arsenal', shortName: 'ARS' }
				},
				minutes: 75,
				goalsScored: 0,
				assists: 1,
				cleanSheets: 1,
				goalsConceded: 0,
				ownGoals: 0,
				penaltiesSaved: 0,
				penaltiesMissed: 0,
				yellowCards: 0,
				redCards: 0,
				saves: 0,
				bonus: 0,
				bps: 30,
				defensiveContribution: 0,
				totalPoints: 6
			}
		]
	}
})

describe('live match desk player sections', () => {
	it('loads fixture players in one bounded follow-up operation', async () => {
		let requests = 0
		const executor: QueryExecutor = async query => {
			requests += 1
			return (
				query.includes('GetLiveFixturePlayersBatch') ? players() : desk()
			) as never
		}

		const snapshot = await getLiveMatchesSnapshot(null, executor, 1)
		assert.equal(requests, 2)
		assert.equal(snapshot.matches[0]?.status, 'FT')
		assert.deepEqual(snapshot.matches[0]?.homeTeam.players[0], {
			player: 'Tzolis',
			element: 101,
			elementType: 3,
			minutes: 75,
			goals: 0,
			assists: 1,
			cleanSheets: 1,
			goalsConceded: 0,
			ownGoals: 0,
			penalties_saved: 0,
			penalties_missed: 0,
			yellow_cards: 0,
			red_cards: 0,
			saves: 0,
			bonus_points: 0,
			bps: 30,
			defensiveContribution: 0,
			totalPoints: 6
		})
	})

	it('refreshes the desk and retries details once when a revision expires', async () => {
		let requests = 0
		const executor: QueryExecutor = async query => {
			requests += 1
			if (requests === 1) {
				throw Object.assign(new Error('expired'), {
					code: 'LIVE_REVISION_GONE'
				})
			}
			return (
				query.includes('GetLiveFixturePlayersBatch') ? players('9') : desk('9')
			) as never
		}

		const result = await loadLiveMatchdayDesk(executor, {
			season: '2627',
			eventId: 1,
			revision: '8'
		})
		assert.equal(requests, 3)
		assert.equal(result.liveMatchdayDesk.liveRevision, '9')
		assert.equal(result.fixturePlayers?.[0]?.revision, '9')
	})

	it('keeps score and status when the optional player section fails', async () => {
		const executor: QueryExecutor = async query => {
			if (query.includes('GetLiveFixturePlayersBatch'))
				throw new Error('detail unavailable')
			return desk() as never
		}
		const result = await loadLiveMatchdayDesk(executor)
		assert.equal(result.liveMatchdayDesk.matches[0]?.homeScore, 3)
		assert.deepEqual(result.fixturePlayers, [])
	})

	it('presents provisional completion without changing the authoritative flag', async () => {
		const payload = desk()
		payload.liveMatchdayDesk.matches[0]!.finished = false
		payload.liveMatchdayDesk.matches[0]!.finishedProvisional = true
		const executor: QueryExecutor = async query =>
			(query.includes('GetLiveFixturePlayersBatch')
				? players()
				: payload) as never

		const snapshot = await getLiveMatchesSnapshot(null, executor, 1)

		assert.equal(payload.liveMatchdayDesk.matches[0]?.finished, false)
		assert.equal(snapshot.matches[0]?.status, 'FT')
	})
})
