import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
	LiveMatchdayResponse,
	LiveMatchdaySnapshot
} from '../lib/graphql/operations/live'
import {
	GET_LIVE_MATCHDAY,
	GET_LIVE_MATCHDAY_HEAD
} from '../lib/graphql/operations/live'
import {
	canReplaceLiveMatchesLkg,
	getLiveMatchesHead,
	getLiveMatchesSnapshot,
	parseLiveMatchesRequestParams,
	retainLiveMatchdayDetailRevision,
	retainLiveMatchPlayerDetails,
	shouldRetainAcceptedLiveMatchDetails,
	type QueryExecutor,
	type QueryExecutorOptions,
	transformLiveMatchdayV3,
	validateLiveMatchdayV3
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
						price: 55,
						totalPoints: 3,
						stats: [
							{
								identifier: 'minutes',
								value: 33,
								awardedPoints: 1
							},
							{
								identifier: 'bonus',
								value: 2,
								awardedPoints: 2
							}
						]
					},
					{
						id: 20,
						webName: 'Away Player',
						position: 'FORWARD',
						teamId: 2,
						price: 50,
						totalPoints: 0,
						stats: [
							{
								identifier: 'bps',
								value: 45,
								awardedPoints: 0
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

describe('live matchday V3 publication', () => {
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
		assert.doesNotMatch(calls[0] ?? '', /awardedPoints|pointsModification/)
		assert.doesNotMatch(calls[0] ?? '', /nextEventId/)
		assert.deepEqual(timeouts, [5_000])
		assert.equal(data.matches.length, 1)
		assert.equal(data.matches[0]?.homeTeam.players[0]?.player, 'Home Player')
		assert.equal(data.matches[0]?.homeTeam.players[0]?.price, 55)
		assert.equal(data.matches[0]?.homeTeam.players[0]?.minutes, 33)
		assert.equal(data.matches[0]?.bonusPoints?.[0]?.points, 2)
		assert.equal(data.snapshot?.delivery?.servedFrom, 'REDIS_CURRENT')
		assert.equal(data.snapshot?.revisions.scoreState, 'score-1')
		assert.equal('scoreCoreRevision' in (data.snapshot ?? {}), false)
		assert.equal('checkpointedAt' in (data.snapshot?.times ?? {}), false)
	})

	it('uses a metadata-only HEAD without reading match or player fields', async () => {
		const calls: string[] = []
		const head = response()
		const { matches: _matches, ...headSnapshot } = head.liveMatchday.snapshot!
		const executor: QueryExecutor = async <T>(query: string): Promise<T> => {
			calls.push(query)
			return {
				liveMatchday: {
					...head.liveMatchday,
					snapshot: headSnapshot
				}
			} as T
		}

		const data = await getLiveMatchesHead(executor, 33)

		assert.equal(calls.length, 1)
		assert.match(calls[0] ?? '', /GetLiveMatchdayHeadV3/)
		assert.doesNotMatch(calls[0] ?? '', /\bmatches\b|\bplayers\b|\bstats\b/)
		assert.equal(data.snapshot?.eventId, 33)
		assert.equal(data.snapshot?.revisions.scoreState, 'score-1')
	})

	it('keeps the V3 full and HEAD documents on separate read contracts', () => {
		assert.match(GET_LIVE_MATCHDAY, /query GetLiveMatchdayV3/)
		assert.match(GET_LIVE_MATCHDAY, /matches\s*\{/)
		assert.doesNotMatch(GET_LIVE_MATCHDAY, /awardedPoints|pointsModification/)
		assert.match(GET_LIVE_MATCHDAY_HEAD, /query GetLiveMatchdayHeadV3/)
		assert.doesNotMatch(
			GET_LIVE_MATCHDAY_HEAD,
			/\bmatches\b|\bplayers\b|\bstats\b/
		)
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

	it('uses the V3 HTTP active pointer without legacy season or revision parameters', async () => {
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
			const active = await getLiveMatchesSnapshot(undefined, null, {
				preferHttp: true
			})
			await getLiveMatchesSnapshot(undefined, 33, { preferHttp: true })
			assert.equal(active.currentEventId, 33)
		} finally {
			globalThis.fetch = originalFetch
		}
		assert.deepEqual(requests, [
			{ url: '/api/live/matches', contract: 'live-matches-v3' },
			{
				url: '/api/live/matches?eventId=33',
				contract: 'live-matches-v3'
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
			() => validateLiveMatchdayV3(response({ snapshot: mixedEvent })),
			/LIVE_MATCHDAY_INCOHERENT/
		)

		const base = snapshot().matches[0]!
		const duplicatePlayers = snapshot({
			matches: [{ ...base, players: [...base.players, base.players[0]!] }]
		})
		assert.throws(
			() => validateLiveMatchdayV3(response({ snapshot: duplicatePlayers })),
			/LIVE_MATCHDAY_INCOHERENT/
		)

		const playerWithDuplicateStat = base.players[0]!
		const duplicateStats = snapshot({
			matches: [
				{
					...base,
					players: [
						{
							...playerWithDuplicateStat,
							stats: [
								...playerWithDuplicateStat.stats,
								{ identifier: 'MINUTES', value: 33 }
							]
						}
					]
				}
			]
		})
		assert.throws(
			() => validateLiveMatchdayV3(response({ snapshot: duplicateStats })),
			/LIVE_MATCHDAY_INCOHERENT/
		)

		const partialDetail = snapshot()
		partialDetail.revisions.detailGeneration = null
		assert.throws(
			() => validateLiveMatchdayV3(response({ snapshot: partialDetail })),
			/LIVE_MATCHDAY_INCOHERENT/
		)
		assert.throws(
			() =>
				validateLiveMatchdayV3(
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

	it('rejects a V3 payload without the required canonical player price', async () => {
		const data = response()
		const player = data.liveMatchday.snapshot!.matches[0]!.players[0]!
		delete (player as Partial<typeof player>).price

		assert.throws(
			() => validateLiveMatchdayV3(data),
			/LIVE_MATCHDAY_INCOHERENT/
		)
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

	it('does not replace the browser LKG with an older same-event publication', async () => {
		const accepted = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							deskGeneration: 2,
							deskPublicationId: 'desk-2',
							detailGeneration: 2,
							detailPublicationId: 'detail-2'
						}
					})
				}) as T,
			33
		)
		const older = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							deskGeneration: 1,
							deskPublicationId: 'desk-1'
						}
					})
				}) as T,
			33
		)
		const newer = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							deskGeneration: 3,
							deskPublicationId: 'desk-3'
						}
					})
				}) as T,
			33
		)
		const olderDetail = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							deskGeneration: 2,
							deskPublicationId: 'desk-2',
							detailGeneration: 1,
							detailPublicationId: 'detail-1'
						}
					})
				}) as T,
			33
		)

		assert.equal(canReplaceLiveMatchesLkg(older, accepted.snapshot), false)
		assert.equal(canReplaceLiveMatchesLkg(newer, accepted.snapshot), true)
		assert.equal(
			canReplaceLiveMatchesLkg(olderDetail, accepted.snapshot),
			false
		)
		assert.equal(
			canReplaceLiveMatchesLkg(
				{ ...older, snapshot: { ...older.snapshot!, eventId: 34 } },
				accepted.snapshot
			),
			true
		)
		assert.equal(
			canReplaceLiveMatchesLkg(
				{ ...older, snapshot: { ...older.snapshot!, eventId: 32 } },
				accepted.snapshot
			),
			false
		)
		assert.equal(
			canReplaceLiveMatchesLkg(
				{
					...older,
					snapshot: { ...older.snapshot!, season: '2728', eventId: 1 }
				},
				accepted.snapshot
			),
			true
		)
		assert.equal(
			canReplaceLiveMatchesLkg(
				{
					...older,
					snapshot: {
						...older.snapshot!,
						season: '2627',
						eventId: 38
					}
				},
				{
					...accepted.snapshot!,
					season: '2728',
					eventId: 1
				}
			),
			false
		)
		assert.equal(
			canReplaceLiveMatchesLkg(
				{
					...newer,
					snapshot: {
						...newer.snapshot!,
						season: '2829',
						eventId: 1
					}
				},
				{
					...accepted.snapshot!,
					season: '2728',
					eventId: 38
				}
			),
			true
		)
	})

	it('requires canonical player prices in every published player row', () => {
		const data = response()
		const player = data.liveMatchday.snapshot!.matches[0]!.players[0]!
		delete (player as Partial<typeof player>).price

		assert.throws(
			() => validateLiveMatchdayV3(data),
			/LIVE_MATCHDAY_INCOHERENT/
		)
	})

	it('keeps an empty newer detail publication authoritative', async () => {
		const accepted = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => response() as T,
			33
		)
		const candidateSnapshot = snapshot({
			revisions: {
				...snapshot().revisions,
				deskGeneration: 2,
				deskPublicationId: 'desk-2',
				detailGeneration: 2,
				detailPublicationId: 'detail-2',
				playerDetail: 'players-2'
			},
			matches: [
				{
					...snapshot().matches[0]!,
					homeScore: 2,
					players: []
				}
			]
		})
		const candidate = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => response({ snapshot: candidateSnapshot }) as T,
			33
		)

		const retained = retainLiveMatchPlayerDetails(
			candidate.matches,
			accepted.matches,
			{ detailFallback: 'candidate' }
		)
		assert.equal(retained[0]?.homeTeam.score, 2)
		assert.deepEqual(retained[0]?.homeTeam.players, [])
		assert.deepEqual(retained[0]?.awayTeam.players, [])
		assert.deepEqual(retained[0]?.bonusPoints, [])
		assert.deepEqual(retained[0]?.bps, [])
	})

	it('fences retained details so an older publication cannot overwrite them', async () => {
		const accepted = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							detailGeneration: 10,
							detailPublicationId: 'detail-10',
							playerDetail: 'players-10'
						}
					})
				}) as T,
			33
		)
		const deskOnly = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							deskGeneration: 2,
							deskPublicationId: 'desk-2',
							detailGeneration: null,
							detailPublicationId: null,
							playerDetail: null
						},
						times: {
							...snapshot().times,
							detailSourceCheckedAt: null,
							detailContentUpdatedAt: null,
							detailPublishedAt: null,
							detailStaleAt: null
						},
						detailDelivery: {
							state: 'PENDING',
							servedFrom: null,
							reasonCodes: ['DETAIL_PENDING']
						},
						matches: [
							{
								...snapshot().matches[0]!,
								homeScore: 2,
								players: [
									{
										...snapshot().matches[0]!.players[0]!,
										webName: 'Older detail candidate'
									}
								]
							}
						]
					})
				}) as T,
			33
		)

		assert.equal(canReplaceLiveMatchesLkg(deskOnly, accepted.snapshot), true)
		assert.equal(
			shouldRetainAcceptedLiveMatchDetails(
				deskOnly.snapshot!,
				accepted.snapshot!
			),
			true
		)
		const retained = retainLiveMatchPlayerDetails(
			deskOnly.matches,
			accepted.matches,
			{ detailFallback: 'accepted' }
		)
		const retainedSnapshot = retainLiveMatchdayDetailRevision(
			deskOnly.snapshot!,
			accepted.snapshot!
		)
		assert.equal(retained[0]?.homeTeam.players[0]?.player, 'Home Player')
		assert.equal(retainedSnapshot.revisions.detailGeneration, 10)
		assert.equal(retainedSnapshot.detailDelivery.state, 'STALE')

		const olderDetail = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						revisions: {
							...snapshot().revisions,
							deskGeneration: 2,
							deskPublicationId: 'desk-2',
							detailGeneration: 8,
							detailPublicationId: 'detail-8',
							playerDetail: 'players-8'
						}
					})
				}) as T,
			33
		)
		assert.equal(canReplaceLiveMatchesLkg(olderDetail, retainedSnapshot), false)
	})

	it('keeps an accepted empty detail publication authoritative', async () => {
		const accepted = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> =>
				response({
					snapshot: snapshot({
						matches: [
							{
								...snapshot().matches[0]!,
								players: []
							}
						]
					})
				}) as T,
			33
		)
		const candidate = await getLiveMatchesSnapshot(
			async <T>(): Promise<T> => response() as T,
			33
		)

		const retained = retainLiveMatchPlayerDetails(
			candidate.matches,
			accepted.matches,
			{ detailFallback: 'accepted' }
		)
		assert.deepEqual(retained[0]?.homeTeam.players, [])
		assert.deepEqual(retained[0]?.awayTeam.players, [])
		assert.deepEqual(retained[0]?.bonusPoints, [])
		assert.deepEqual(retained[0]?.bps, [])
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
		assert.equal(
			liveMatchdayNeedsRefresh(accepted, {
				...heartbeat,
				revisions: {
					...heartbeat.revisions,
					detailPublicationId: null,
					detailGeneration: null,
					playerDetail: null
				},
				times: {
					...heartbeat.times,
					detailSourceCheckedAt: null,
					detailContentUpdatedAt: null,
					detailPublishedAt: null,
					detailStaleAt: null
				}
			}),
			false
		)
		assert.equal(
			liveMatchdayNeedsRefresh(accepted, {
				...heartbeat,
				revisions: {
					...heartbeat.revisions,
					detailPublicationId: 'detail-0',
					detailGeneration: 0,
					playerDetail: 'players-0'
				}
			}),
			false
		)
		assert.equal(
			liveMatchdayNeedsRefresh(accepted, {
				...heartbeat,
				revisions: {
					...heartbeat.revisions,
					detailPublicationId: 'detail-2',
					detailGeneration: 2,
					playerDetail: 'players-2'
				}
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

	it('transforms a V3 snapshot directly', () => {
		const [match] = transformLiveMatchdayV3(snapshot())
		assert.equal(match?.homeTeam.shortName, 'ARS')
		assert.equal(match?.awayTeam.players[0]?.element, 20)
		assert.equal(match?.status, 'LIVE')
	})
})
