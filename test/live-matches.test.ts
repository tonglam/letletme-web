import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
	LiveMatchdayResponse,
	LiveMatchdaySnapshot
} from '../lib/graphql/operations/live'
import {
	canReplaceLiveMatchesLkg,
	getLiveMatchesSnapshot,
	parseLiveMatchesRequestParams,
	type QueryExecutor,
	type QueryExecutorOptions,
	transformLiveMatchdayV2,
	validateLiveMatchdayV2
} from '../lib/live-matches'
import {
	liveMatchdayNeedsRefresh,
	shouldPollLiveMatchday
} from '../lib/live-refresh'

const snapshot = (overrides: Partial<LiveMatchdaySnapshot> = {}) =>
	({
		season: '2627',
		eventId: 33,
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

const unavailableResponse = () =>
	response({
		availability: 'UNAVAILABLE',
		delivery: {
			state: 'UNAVAILABLE',
			servedFrom: null,
			reasonCodes: ['DESK_UNAVAILABLE']
		},
		snapshot: null
	})

describe('live matchday V2 publication', () => {
	it('projects embedded players without a fixture detail fan-out', async () => {
		const calls: string[] = []
		const timeouts: Array<number | undefined> = []
		const executor: QueryExecutor = async <T>(
			query: string,
			_variables?: Record<string, unknown>,
			options?: QueryExecutorOptions
		): Promise<T> => {
			calls.push(query)
			timeouts.push(options?.timeoutMs)
			return response() as T
		}
		const data = await getLiveMatchesSnapshot(executor)

		assert.equal(calls.length, 1)
		assert.match(calls[0] ?? '', /liveMatchday\(eventId:/)
		assert.doesNotMatch(calls[0] ?? '', /liveFixturePlayers|eventLive\(/)
		assert.doesNotMatch(calls[0] ?? '', /nextEventId/)
		assert.deepEqual(timeouts, [5_000])
		assert.equal(data.matches.length, 1)
		assert.equal(data.matches[0]?.homeTeam.players[0]?.player, 'Home Player')
		assert.equal(data.matches[0]?.homeTeam.players[0]?.minutes, 33)
		assert.equal(data.matches[0]?.bonusPoints?.[0]?.points, 2)
		assert.equal(data.snapshot?.delivery?.servedFrom, 'REDIS_CURRENT')
		assert.equal(data.snapshot?.revisions.scoreState, 'score-1')
		assert.equal('scoreCoreRevision' in (data.snapshot ?? {}), false)
		assert.equal('checkpointedAt' in (data.snapshot?.times ?? {}), false)
	})

	it('accepts the active pointer or one event and hard-rejects legacy API parameters', () => {
		assert.deepEqual(parseLiveMatchesRequestParams(new URLSearchParams()), {
			ok: true,
			eventId: undefined
		})
		assert.deepEqual(
			parseLiveMatchesRequestParams(new URLSearchParams('eventId=33')),
			{ ok: true, eventId: 33 }
		)
		for (const query of [
			'season=2627',
			'revision=1',
			'scoreCoreRevision=score-1',
			'includePlayers=true'
		]) {
			assert.deepEqual(
				parseLiveMatchesRequestParams(new URLSearchParams(query)),
				{ ok: false, status: 426, error: 'CLIENT_UPGRADE_REQUIRED' }
			)
		}
		assert.equal(
			parseLiveMatchesRequestParams(
				new URLSearchParams('eventId=33&eventId=34')
			).ok,
			false
		)
	})

	it('uses the V2 HTTP active pointer without legacy season or revision parameters', async () => {
		const originalFetch = globalThis.fetch
		const requests: Array<{ url: string; contract: string | null }> = []
		globalThis.fetch = (async (input, init) => {
			const headers = new Headers(init?.headers)
			requests.push({
				url: String(input),
				contract: headers.get('X-LetLetMe-Contract')
			})
			return new Response(JSON.stringify(response()), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		}) as typeof fetch
		try {
			await getLiveMatchesSnapshot(undefined, null, { preferHttp: true })
			await getLiveMatchesSnapshot(undefined, 33, { preferHttp: true })
		} finally {
			globalThis.fetch = originalFetch
		}
		assert.deepEqual(requests, [
			{ url: '/api/live/matches', contract: 'live-matches-v2' },
			{
				url: '/api/live/matches?eventId=33',
				contract: 'live-matches-v2'
			}
		])
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

		const partialDetail = snapshot()
		partialDetail.revisions.detailGeneration = null
		assert.throws(
			() => validateLiveMatchdayV2(response({ snapshot: partialDetail })),
			/LIVE_MATCHDAY_INCOHERENT/
		)
		assert.throws(
			() =>
				validateLiveMatchdayV2(
					response({
						availability: 'UNAVAILABLE',
						delivery: {
							state: 'UNAVAILABLE',
							servedFrom: null,
							reasonCodes: ['DESK_UNAVAILABLE']
						}
					})
				),
			/LIVE_MATCHDAY_INCOHERENT/
		)
	})

	it('keeps an unavailable publication explicit instead of fabricating an empty success', async () => {
		const data = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => unavailableResponse() as T,
			33
		)

		assert.equal(data.matches.length, 0)
		assert.equal(data.currentEventId, 33)
		assert.equal(data.availability, 'UNAVAILABLE')
		assert.equal(data.snapshot, null)
		assert.equal(canReplaceLiveMatchesLkg(data), false)
	})

	it('allows only a complete publication to replace the same-event browser LKG', async () => {
		const ready = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => response() as T,
			33
		)
		const unavailable = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => unavailableResponse() as T,
			33
		)

		assert.equal(canReplaceLiveMatchesLkg(ready), true)
		assert.equal(canReplaceLiveMatchesLkg(unavailable), false)
	})

	it('adopts heartbeat metadata without rebuilding fixtures and reloads only Match revisions', async () => {
		const ready = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => response() as T
		)
		const accepted = ready.snapshot!
		const heartbeat = {
			...accepted,
			times: {
				...accepted.times,
				deskSourceCheckedAt: '2026-08-04T18:31:00.000Z',
				servedAt: '2026-08-04T18:31:01.000Z'
			}
		}
		assert.equal(liveMatchdayNeedsRefresh(accepted, heartbeat), false)
		assert.equal(
			liveMatchdayNeedsRefresh(accepted, {
				...heartbeat,
				revisions: { ...heartbeat.revisions, scoreState: 'score-2' }
			}),
			true
		)
		assert.equal(
			liveMatchdayNeedsRefresh(accepted, {
				...heartbeat,
				revisions: { ...heartbeat.revisions, playerDetail: 'players-2' }
			}),
			true
		)
	})

	it('stops Match polling for terminal state even with a residual refresh timestamp', () => {
		const terminal = snapshot({
			state: 'FINALIZED',
			times: {
				...snapshot().times,
				nextRefreshAt: '2026-08-04T18:31:00.000Z'
			}
		})
		const shouldPoll = shouldPollLiveMatchday({
			isPageActive: true,
			currentEventId: 33,
			selectedEventId: 33,
			snapshot: {
				...terminal,
				availability: 'READY',
				delivery: {
					state: 'FINAL',
					servedFrom: 'REDIS_CURRENT',
					reasonCodes: []
				}
			}
		})
		assert.equal(shouldPoll, false)
	})

	it('keeps bounded polling enabled for a known event without a desk snapshot', () => {
		assert.equal(
			shouldPollLiveMatchday({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: null
			}),
			true
		)
	})

	it('transforms a V2 snapshot directly', () => {
		const [match] = transformLiveMatchdayV2(snapshot())
		assert.equal(match?.homeTeam.shortName, 'ARS')
		assert.equal(match?.awayTeam.players[0]?.element, 20)
		assert.equal(match?.status, 'LIVE')
	})
})
