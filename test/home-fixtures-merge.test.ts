import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { LiveMatchdayFixtureSummary } from '../lib/graphql/operations/live'
import {
	buildHomeLiveFixtureRevision,
	buildLiveCoreFixtureFallback,
	homeFixtureStateFromLiveState,
	mergeLiveFixturesIntoHomeFixtures
} from '../lib/home-fixtures-merge'

const liveRow = (partial: Partial<LiveMatchdayFixtureSummary> = {}) =>
	({
		fixtureId: 1,
		eventId: 1,
		homeTeamId: 1,
		homeTeamName: 'Arsenal',
		homeTeamShortName: '',
		awayTeamId: 7,
		awayTeamName: 'Coventry City',
		awayTeamShortName: '',
		homeScore: 3,
		awayScore: 0,
		kickoffTime: '2026-08-21T19:00:00.000Z',
		minutes: 90,
		started: true,
		finished: false,
		finishedProvisional: false,
		...partial
	}) as LiveMatchdayFixtureSummary

describe('mergeLiveFixturesIntoHomeFixtures', () => {
	it('uses every live fixture revision that can change the home projection', () => {
		const base = {
			revisions: {
				deskPublicationId: 'desk-1',
				deskGeneration: 1,
				lifecycle: 'LIVE_ACTIVE',
				fixtureIdentity: 'fixtures-1',
				scoreState: 'scores-1'
			}
		}
		const revision = buildHomeLiveFixtureRevision(base)
		assert.equal(
			revision,
			'live:desk-1:1:LIVE_ACTIVE:fixtures-1:scores-1'
		)
		for (const key of [
			'deskPublicationId',
			'deskGeneration',
			'lifecycle',
			'fixtureIdentity',
			'scoreState'
		] as const) {
			const changed = {
				...base,
				revisions: {
					...base.revisions,
					[key]: key === 'deskGeneration' ? 2 : `${key}-2`
				}
			}
			assert.notEqual(buildHomeLiveFixtureRevision(changed), revision)
		}
	})

	it('treats the V2 GW review lifecycle as settled for home fixtures', () => {
		assert.equal(homeFixtureStateFromLiveState('GW_REVIEW'), 'SETTLED')
		assert.equal(homeFixtureStateFromLiveState('LIVE_ACTIVE'), 'LIVE')
	})

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

	it('keeps core fixtures visible when the live overlay is unavailable', () => {
		const fallback = buildLiveCoreFixtureFallback(
			{
				season: '2026',
				revision: 'core-7',
				sourceCheckedAt: '2026-08-24T00:00:00.000Z'
			},
			1,
			[
				{
					id: 1,
					finished: false,
					started: false,
					kickoffTime: '2026-08-24T12:00:00.000Z',
					homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
					awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
					homeScore: null,
					awayScore: null
				}
			]
		)

		assert.equal(fallback.source, 'LIVE')
		assert.equal(fallback.state, 'CORE')
		assert.equal(fallback.stale, true)
		assert.equal(fallback.revision, 'core-fallback:core-7')
		assert.equal(fallback.fixtures.length, 1)
		assert.equal(fallback.fixtures[0]?.eventId, 1)
	})
})
