import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'

import { GET_LIVE_FIXTURE_PLAYERS_BATCH } from '../lib/graphql/operations/live'
import {
	getLiveMatchesSnapshot,
	liveFixturePlayerFailureCode,
	loadLiveMatchdayDesk,
	type LiveFixturePlayerLoadFailure,
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

const singlePlayers = (revision = '8', fixtureId = 1) => ({
	liveFixturePlayers: {
		...players(revision).fixture0,
		fixtureId
	}
})

describe('live match desk player sections', () => {
	it('keeps the five-fixture operation inside the production AST limit', () => {
		let astNodes = 0
		visit(parse(GET_LIVE_FIXTURE_PLAYERS_BATCH), {
			enter: () => void (astNodes += 1)
		})
		assert.ok(astNodes <= 200, `operation has ${astNodes} AST nodes`)
	})

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

	it('can return the score desk without serialising fixture players', async () => {
		let requests = 0
		const executor: QueryExecutor = async query => {
			requests += 1
			return (
				query.includes('GetLiveFixturePlayersBatch') ? players() : desk()
			) as never
		}

		const result = await loadLiveMatchdayDesk(
			executor,
			{ season: '2627', eventId: 1, revision: '8' },
			{ includeFixturePlayers: false }
		)
		assert.equal(requests, 1)
		assert.deepEqual(result.fixturePlayers, [])
		assert.equal(result.liveMatchdayDesk.matches[0]?.homeScore, 3)
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

	it('refreshes the desk without single-fixture fanout when a player batch expires', async () => {
		let deskRequests = 0
		let batchRequests = 0
		let singleRequests = 0
		const executor: QueryExecutor = async query => {
			if (query.includes('GetLiveFixturePlayersBatch')) {
				batchRequests += 1
				if (batchRequests === 1) {
					throw Object.assign(new Error('expired'), {
						code: 'LIVE_REVISION_GONE'
					})
				}
				return players('9') as never
			}
			if (query.includes('GetLiveFixturePlayers')) {
				singleRequests += 1
				return singlePlayers('9') as never
			}
			deskRequests += 1
			return desk(deskRequests === 1 ? '8' : '9') as never
		}

		const result = await loadLiveMatchdayDesk(executor, {
			season: '2627',
			eventId: 1,
			revision: '8'
		})

		assert.equal(deskRequests, 2)
		assert.equal(batchRequests, 2)
		assert.equal(singleRequests, 0)
		assert.equal(result.fixturePlayers?.[0]?.revision, '9')
	})

	it('falls back to a single-fixture query when the batch operation fails', async () => {
		let requests = 0
		const failures: LiveFixturePlayerLoadFailure[] = []
		const executor: QueryExecutor = async query => {
			requests += 1
			if (query.includes('GetLiveFixturePlayersBatch'))
				throw Object.assign(new Error('batch field failed'), {
					code: 'UPSTREAM_GRAPHQL_ERROR'
				})
			if (query.includes('GetLiveFixturePlayers'))
				return singlePlayers() as never
			return desk() as never
		}

		const result = await loadLiveMatchdayDesk(executor, null, {
			onFixturePlayerFailure: failure => failures.push(failure)
		})

		assert.equal(requests, 3)
		assert.equal(result.fixturePlayers?.[0]?.fixtureId, 1)
		assert.deepEqual(failures, [
			{
				season: '2627',
				eventId: 1,
				revision: '8',
				stage: 'batch',
				fixtureIds: [1],
				code: 'DETAIL_UNAVAILABLE'
			}
		])
	})

	it('preserves successful fixtures when a single-fixture fallback is partial', async () => {
		const payload = desk()
		payload.liveMatchdayDesk.matches.push({
			...payload.liveMatchdayDesk.matches[0]!,
			fixtureId: 2
		})
		const failures: LiveFixturePlayerLoadFailure[] = []
		const executor: QueryExecutor = async (query, variables) => {
			if (query.includes('GetLiveFixturePlayersBatch'))
				throw Object.assign(new Error('batch field failed'), {
					code: 'UPSTREAM_GRAPHQL_ERROR'
				})
			if (query.includes('GetLiveFixturePlayers')) {
				const fixtureId = Number(variables?.fixtureId)
				if (fixtureId === 2) throw new Error('fixture unavailable')
				return singlePlayers('8', fixtureId) as never
			}
			return payload as never
		}

		const result = await loadLiveMatchdayDesk(executor, null, {
			onFixturePlayerFailure: failure => failures.push(failure)
		})

		assert.deepEqual(
			result.fixturePlayers?.map(detail => detail.fixtureId),
			[1]
		)
		assert.deepEqual(
			failures.map(failure => ({
				stage: failure.stage,
				fixtureIds: failure.fixtureIds,
				code: failure.code
			})),
			[
				{ stage: 'batch', fixtureIds: [1, 2], code: 'DETAIL_UNAVAILABLE' },
				{ stage: 'fixture', fixtureIds: [2], code: 'DETAIL_UNAVAILABLE' }
			]
		)
	})

	it('stops a single-fixture fallback after a non-recoverable failure', async () => {
		const terminalFailures = [
			Object.assign(new Error('publication unavailable'), {
				code: 'LIVE_PUBLICATION_UNAVAILABLE'
			}),
			Object.assign(new Error('rate limited'), {
				code: 'RATE_LIMITED',
				status: 429
			}),
			Object.assign(new Error('unauthenticated'), {
				code: 'UNAUTHENTICATED',
				status: 401
			}),
			Object.assign(new Error('forbidden'), {
				code: 'FORBIDDEN',
				status: 403
			}),
			Object.assign(new Error('timed out'), { code: 'REQUEST_TIMEOUT' }),
			Object.assign(new Error('cancelled'), { name: 'AbortError' }),
			Object.assign(new Error('network unavailable'), { code: 'NETWORK_ERROR' })
		]

		for (const fixtureFailure of terminalFailures) {
			const payload = desk()
			payload.liveMatchdayDesk.matches.push(
				{
					...payload.liveMatchdayDesk.matches[0]!,
					fixtureId: 2
				},
				{
					...payload.liveMatchdayDesk.matches[0]!,
					fixtureId: 3
				}
			)
			const singleFixtureIds: number[] = []
			const executor: QueryExecutor = async (query, variables) => {
				if (query.includes('GetLiveFixturePlayersBatch')) {
					throw Object.assign(new Error('batch field failed'), {
						code: 'UPSTREAM_GRAPHQL_ERROR'
					})
				}
				if (query.includes('GetLiveFixturePlayers')) {
					singleFixtureIds.push(Number(variables?.fixtureId))
					throw fixtureFailure
				}
				return payload as never
			}

			const result = await loadLiveMatchdayDesk(executor)

			assert.deepEqual(singleFixtureIds, [1])
			assert.deepEqual(result.fixturePlayers, [])
		}
	})

	it('cancels sibling fallback workers after a terminal failure', async () => {
		const payload = desk()
		for (let fixtureId = 2; fixtureId <= 10; fixtureId += 1) {
			payload.liveMatchdayDesk.matches.push({
				...payload.liveMatchdayDesk.matches[0]!,
				fixtureId
			})
		}
		let markSiblingStarted: () => void = () => undefined
		const siblingStarted = new Promise<void>(
			resolve => void (markSiblingStarted = resolve)
		)
		const singleFixtureIds: number[] = []
		let siblingSignalAborted = false
		const executor: QueryExecutor = async (query, variables, options) => {
			if (query.includes('GetLiveFixturePlayersBatch')) {
				throw Object.assign(new Error('batch field failed'), {
					code: 'UPSTREAM_GRAPHQL_ERROR'
				})
			}
			if (query.includes('GetLiveFixturePlayers')) {
				const fixtureId = Number(variables?.fixtureId)
				singleFixtureIds.push(fixtureId)
				if (fixtureId === 1) {
					await siblingStarted
					throw Object.assign(new Error('rate limited'), {
						code: 'RATE_LIMITED',
						status: 429
					})
				}
				if (fixtureId === 6) {
					markSiblingStarted()
					await new Promise<void>(resolve => {
						const timeout = setTimeout(resolve, 50)
						options?.signal?.addEventListener(
							'abort',
							() => {
								siblingSignalAborted = true
								clearTimeout(timeout)
								resolve()
							},
							{ once: true }
						)
					})
					return singlePlayers('8', fixtureId) as never
				}
				throw new Error(`unexpected fallback for fixture ${fixtureId}`)
			}
			return payload as never
		}

		const result = await loadLiveMatchdayDesk(executor)

		assert.deepEqual(singleFixtureIds, [1, 6])
		assert.equal(siblingSignalAborted, true)
		assert.deepEqual(result.fixturePlayers, [])
	})

	it('does not fan out when the shared live publication is unavailable', async () => {
		let requests = 0
		const failures: LiveFixturePlayerLoadFailure[] = []
		const executor: QueryExecutor = async query => {
			requests += 1
			if (query.includes('GetLiveFixturePlayersBatch')) {
				throw Object.assign(new Error('publication unavailable'), {
					code: 'LIVE_PUBLICATION_UNAVAILABLE'
				})
			}
			if (query.includes('GetLiveFixturePlayers'))
				throw new Error('single fixture query should not run')
			return desk() as never
		}

		const result = await loadLiveMatchdayDesk(executor, null, {
			onFixturePlayerFailure: failure => failures.push(failure)
		})

		assert.equal(requests, 2)
		assert.deepEqual(result.fixturePlayers, [])
		assert.equal(failures[0]?.code, 'LIVE_PUBLICATION_UNAVAILABLE')
	})

	it('does not fan out rate-limit, auth, timeout, cancellation, or network failures', async () => {
		const failures = [
			Object.assign(new Error('rate limited'), {
				code: 'RATE_LIMITED',
				status: 429
			}),
			Object.assign(new Error('unauthenticated'), {
				code: 'UNAUTHENTICATED',
				status: 401
			}),
			Object.assign(new Error('timed out'), { code: 'REQUEST_TIMEOUT' }),
			Object.assign(new Error('cancelled'), { name: 'AbortError' }),
			Object.assign(new Error('network unavailable'), { code: 'NETWORK_ERROR' })
		]

		for (const batchFailure of failures) {
			let requests = 0
			const executor: QueryExecutor = async query => {
				requests += 1
				if (query.includes('GetLiveFixturePlayersBatch')) throw batchFailure
				if (query.includes('GetLiveFixturePlayers'))
					throw new Error('single fixture query should not run')
				return desk() as never
			}

			const result = await loadLiveMatchdayDesk(executor)
			assert.equal(requests, 2)
			assert.deepEqual(result.fixturePlayers, [])
		}
	})

	it('keeps score and status when the optional player section fails', async () => {
		const executor: QueryExecutor = async query => {
			if (query.includes('GetLiveFixturePlayers'))
				throw new Error('detail unavailable')
			return desk() as never
		}
		const result = await loadLiveMatchdayDesk(executor)
		assert.equal(result.liveMatchdayDesk.matches[0]?.homeScore, 3)
		assert.deepEqual(result.fixturePlayers, [])
	})

	it('classifies only bounded fixture-player failure codes', () => {
		assert.equal(
			liveFixturePlayerFailureCode({ code: 'LIVE_PUBLICATION_UNAVAILABLE' }),
			'LIVE_PUBLICATION_UNAVAILABLE'
		)
		assert.equal(
			liveFixturePlayerFailureCode(
				new Error('database password=secret; relation is missing')
			),
			'DETAIL_UNAVAILABLE'
		)
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
