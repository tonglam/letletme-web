import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { LiveMatchdayDeskRow } from '../lib/graphql/operations/live'
import { mergeLiveFixturesIntoHomeFixtures } from '../lib/home-fixtures-merge'

const liveRow = (partial: Partial<LiveMatchdayDeskRow> = {}) =>
	({
		fixtureId: 1,
		eventId: 1,
		homeTeamId: 1,
		homeTeamName: 'Arsenal',
		homeTeamShortName: undefined,
		awayTeamId: 7,
		awayTeamName: 'Coventry City',
		awayTeamShortName: undefined,
		homeScore: 3,
		awayScore: 0,
		kickoffTime: '2026-08-21T19:00:00.000Z',
		minutes: 90,
		started: true,
		finished: false,
		finishedProvisional: false,
		...partial
	}) as LiveMatchdayDeskRow

describe('mergeLiveFixturesIntoHomeFixtures', () => {
	it('keeps core team identity and kickoff data when live rows omit abbreviations', () => {
		const [fixture] = mergeLiveFixturesIntoHomeFixtures(
			[liveRow()],
			[
				{
					id: 1,
					finished: false,
					started: false,
					kickoffTime: '2026-08-21T19:00:00.000Z',
					homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
					awayTeam: { id: 7, name: 'Coventry City', shortName: 'COV' },
					homeScore: null,
					awayScore: null
				}
			]
		)

		assert.deepEqual(fixture.homeTeam, {
			id: 1,
			name: 'Arsenal',
			shortName: 'ARS'
		})
		assert.deepEqual(fixture.awayTeam, {
			id: 7,
			name: 'Coventry City',
			shortName: 'COV'
		})
		assert.equal(fixture.homeScore, 3)
		assert.equal(fixture.awayScore, 0)
		assert.equal(fixture.started, true)
	})

	it('returns safe empty identity fields when no core fixture exists', () => {
		const [fixture] = mergeLiveFixturesIntoHomeFixtures([liveRow()], [])

		assert.equal(fixture.homeTeam.shortName, '')
		assert.equal(fixture.awayTeam.shortName, '')
		assert.equal(fixture.homeTeam.name, 'Arsenal')
	})

	it('presents a provisional completion while preserving core identity', () => {
		const [fixture] = mergeLiveFixturesIntoHomeFixtures(
			[liveRow({ finishedProvisional: true })],
			[]
		)

		assert.equal(fixture.finished, true)
	})
})
