import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
	LiveMatchdayResponse,
	LiveMatchdaySnapshot
} from '../lib/graphql/operations/live'
import {
	getLiveMatchesSnapshot,
	transformCoreFixturesToMatches,
	transformLiveMatchdayV2,
	validateLiveMatchdayV2
} from '../lib/live-matches'

const snapshot = (overrides: Partial<LiveMatchdaySnapshot> = {}) =>
	({
		season: '2627',
		eventId: 33,
		nextEventId: 34,
		state: 'LIVE_ACTIVE',
		revisions: {
			deskPublicationId: 'desk-1',
			deskGeneration: 1,
			lifecycle: 'life-1',
			fixtureIdentity: 'fixture-1',
			scoreState: 'score-1',
			detailPublicationId: 'detail-1',
			detailGeneration: 1,
			playerDetail: 'players-1'
		},
		times: {
			deskSourceCheckedAt: '2026-08-04T18:30:30.000Z',
			deskContentUpdatedAt: '2026-08-04T18:30:20.000Z',
			deskPublishedAt: '2026-08-04T18:30:21.000Z',
			deskStaleAt: '2026-08-04T18:31:07.500Z',
			detailSourceCheckedAt: '2026-08-04T18:30:30.000Z',
			detailContentUpdatedAt: '2026-08-04T18:30:20.000Z',
			detailPublishedAt: '2026-08-04T18:30:21.000Z',
			detailStaleAt: '2026-08-04T18:31:07.500Z',
			servedAt: '2026-08-04T18:30:31.000Z',
			nextRefreshAt: '2026-08-04T18:31:00.000Z'
		},
		detailDelivery: {
			state: 'FRESH',
			servedFrom: 'REDIS_CURRENT',
			reasonCodes: []
		},
		matches: [
			{
				fixtureId: 101,
				eventId: 33,
				homeTeamId: 1,
				homeTeamName: 'Arsenal',
				homeTeamShortName: 'ARS',
				awayTeamId: 2,
				awayTeamName: 'Chelsea',
				awayTeamShortName: 'CHE',
				homeScore: 1,
				awayScore: 0,
				kickoffTime: '2026-08-04T18:00:00.000Z',
				minutes: 33,
				started: true,
				finished: false,
				finishedProvisional: false,
				players: [
					{
						id: 10,
						webName: 'Home Player',
						position: 'MIDFIELDER',
						teamId: 1,
						totalPoints: 8,
						stats: [
							{
								identifier: 'minutes',
								value: 33,
								points: 1,
								pointsModification: null
							},
							{
								identifier: 'bonus',
								value: 2,
								points: 2,
								pointsModification: null
							}
						]
					},
					{
						id: 20,
						webName: 'Away Player',
						position: 'FORWARD',
						teamId: 2,
						totalPoints: 2,
						stats: [
							{
								identifier: 'bps',
								value: 45,
								points: 0,
								pointsModification: null
							}
						]
					}
				]
			}
		],
		...overrides
	}) as LiveMatchdaySnapshot

const response = (
	overrides: Partial<LiveMatchdayResponse['liveMatchday']> = {}
) =>
	({
		liveMatchday: {
			availability: 'READY',
			delivery: {
				state: 'FRESH',
				servedFrom: 'REDIS_CURRENT',
				reasonCodes: []
			},
			snapshot: snapshot(),
			...overrides
		}
	}) as LiveMatchdayResponse

describe('live matchday V2 publication', () => {
	it('projects embedded players without a fixture detail fan-out', async () => {
		const calls: string[] = []
		const data = await getLiveMatchesSnapshot(
			null,
			async <T>(query: string): Promise<T> => {
				calls.push(query)
				return response() as T
			}
		)

		assert.equal(calls.length, 1)
		assert.match(calls[0] ?? '', /liveMatchday\(eventId:/)
		assert.doesNotMatch(calls[0] ?? '', /liveFixturePlayers|eventLive\(/)
		assert.equal(data.matches.length, 1)
		assert.equal(data.matches[0]?.homeTeam.players[0]?.player, 'Home Player')
		assert.equal(data.matches[0]?.homeTeam.players[0]?.minutes, 33)
		assert.equal(data.matches[0]?.bonusPoints?.[0]?.points, 2)
		assert.equal(data.snapshot?.delivery?.servedFrom, 'REDIS_CURRENT')
	})

	it('rejects mixed-event fixtures and duplicate player rows', () => {
		const mixedEvent = snapshot({
			matches: [
				{
					...snapshot().matches[0]!,
					eventId: 34
				}
			]
		})
		assert.throws(
			() => validateLiveMatchdayV2(response({ snapshot: mixedEvent })),
			/LIVE_MATCHDAY_INCOHERENT/
		)

		const base = snapshot().matches[0]!
		const duplicatePlayers = snapshot({
			matches: [{ ...base, players: [...base.players, base.players[0]!] }]
		})
		assert.throws(
			() => validateLiveMatchdayV2(response({ snapshot: duplicatePlayers })),
			/LIVE_MATCHDAY_INCOHERENT/
		)
	})

	it('keeps an unavailable publication explicit instead of fabricating an empty success', async () => {
		const data = await getLiveMatchesSnapshot(
			33,
			async <T>(): Promise<T> =>
				response({ availability: 'UNAVAILABLE', snapshot: null }) as T,
			33
		)

		assert.equal(data.matches.length, 0)
		assert.equal(data.currentEventId, 33)
		assert.equal(data.dataAvailability, 'UNAVAILABLE')
		assert.equal(data.snapshot, null)
	})

	it('transforms a V2 snapshot directly', () => {
		const [match] = transformLiveMatchdayV2(snapshot())
		assert.equal(match?.homeTeam.shortName, 'ARS')
		assert.equal(match?.awayTeam.players[0]?.element, 20)
		assert.equal(match?.status, 'LIVE')
	})
})

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
		const [match] = mergeLiveFixturePlayers(
			matches,
			[
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
			] as never
		)

		assert.equal(match?.homeTeam.players[0]?.player, 'Saka')
		assert.equal(match?.homeTeam.players[0]?.price, 101)
	})
})
