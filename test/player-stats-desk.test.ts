import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import { PLAYER_STATS_DESK_QUERIES } from '../lib/graphql/operations/players'
import {
	normalizePlayerStatsDeskResult,
	parsePlayerStatsDeskParams,
	type PlayerStatsDeskLoadResult
} from '../lib/player-stats-desk'
import {
	createPlayerStatsDeskRouteHandler,
	PLAYER_STATS_DESK_PUBLIC_CACHE_CONTROL,
	PLAYER_STATS_DESK_UNCACHEABLE_CONTROL
} from '../lib/player-stats-desk-route'

const overviewEntry = (playerId: number) => ({
	playerId,
	overview: { id: playerId } as never,
	state: { playerId, trend: 'STABLE', dimensions: [] } as never
})

const result = (
	overrides: Partial<PlayerStatsDeskLoadResult> = {}
): PlayerStatsDeskLoadResult => ({
	eventId: 1,
	horizon: 5,
	section: 'overview',
	entries: [overviewEntry(13), overviewEntry(27)],
	unavailablePlayerIds: [],
	outcome: 'complete',
	...overrides
})

const quietLogger = { info: () => undefined, error: () => undefined }

describe('player stats desk contract', () => {
	it('strictly validates one or two unique players and bounded inputs', () => {
		assert.deepEqual(
			parsePlayerStatsDeskParams(
				new URLSearchParams(
					'playerIds=13,27&eventId=38&horizon=8&section=overview'
				)
			),
			{
				ok: true,
				playerIds: [13, 27],
				eventId: 38,
				horizon: 8,
				section: 'overview'
			}
		)
		for (const query of [
			'',
			'playerIds=13,13&eventId=1&section=overview',
			'playerIds=0&eventId=1&section=overview',
			'playerIds=1,2,3&eventId=1&section=overview',
			'playerIds=1&eventId=39&section=overview',
			'playerIds=1&eventId=1&horizon=9&section=overview',
			'playerIds=1&eventId=1&section=fixtures'
		]) {
			assert.equal(
				parsePlayerStatsDeskParams(new URLSearchParams(query)).ok,
				false
			)
		}
	})

	it('keeps every section query below the backend AST budget', () => {
		for (const [section, query] of Object.entries(PLAYER_STATS_DESK_QUERIES)) {
			const document = parse(query)
			let nodes = 0
			visit(document, { enter: () => void (nodes += 1) })
			assert.ok(nodes <= 200, `${section} desk query has ${nodes} AST nodes`)
		}
	})

	it('preserves requested order and distinguishes partial from total failure', () => {
		const partial = normalizePlayerStatsDeskResult(
			{
				eventId: 4,
				horizon: 5,
				entries: [
					overviewEntry(27),
					{ playerId: 13, overview: null, state: null }
				]
			},
			[13, 27],
			'overview'
		)
		assert.deepEqual(
			partial.entries.map(entry => entry.playerId),
			[13, 27]
		)
		assert.equal(partial.outcome, 'partial')
		assert.deepEqual(partial.unavailablePlayerIds, [13])

		const failed = normalizePlayerStatsDeskResult(
			{ eventId: 4, horizon: 5, entries: [] },
			[13],
			'recent'
		)
		assert.equal(failed.outcome, 'not-found')
	})

	it('does not cache a process section when either evidence or state is unavailable', () => {
		const result = normalizePlayerStatsDeskResult(
			{
				eventId: 4,
				horizon: 5,
				entries: [
					{
						playerId: 13,
						evidence: { id: 13 } as never,
						state: null
					}
				]
			},
			[13],
			'process'
		)
		assert.equal(result.outcome, 'partial')
		assert.deepEqual(result.unavailablePlayerIds, [13])
	})

	it('distinguishes valid empty values, missing players, and temporary field failures', () => {
		const available = normalizePlayerStatsDeskResult(
			{
				eventId: 4,
				horizon: 5,
				entries: [
					{
						playerId: 13,
						overview: { status: 'AVAILABLE', value: { id: 13 } } as never,
						state: {
							status: 'AVAILABLE',
							value: { playerId: 13, trend: 'UNKNOWN', dimensions: [] }
						} as never
					}
				]
			},
			[13],
			'overview'
		)
		assert.equal(available.outcome, 'complete')

		const missing = normalizePlayerStatsDeskResult(
			{
				eventId: 4,
				horizon: 5,
				entries: [
					{
						playerId: 13,
						overview: { status: 'NOT_FOUND', value: null },
						state: { status: 'NOT_FOUND', value: null }
					}
				]
			},
			[13],
			'overview'
		)
		assert.equal(missing.outcome, 'not-found')

		const temporary = normalizePlayerStatsDeskResult(
			{
				eventId: 4,
				horizon: 5,
				entries: [
					{
						playerId: 13,
						overview: { status: 'TEMPORARILY_UNAVAILABLE', value: null },
						state: { status: 'TEMPORARILY_UNAVAILABLE', value: null }
					}
				]
			},
			[13],
			'overview'
		)
		assert.equal(temporary.outcome, 'failed')
	})
})

describe('player stats desk route', () => {
	it('caches only complete success', async () => {
		const handler = createPlayerStatsDeskRouteHandler(
			async () => result(),
			quietLogger
		)
		const response = await handler(
			new Request(
				'https://letletme.top/api/player-stats/desk?playerIds=13,27&eventId=1&horizon=5&section=overview'
			)
		)
		assert.equal(response.status, 200)
		assert.equal(
			response.headers.get('cache-control'),
			PLAYER_STATS_DESK_PUBLIC_CACHE_CONTROL
		)
	})

	it('returns partial data as no-store and total failure as 502', async () => {
		const partialHandler = createPlayerStatsDeskRouteHandler(
			async () =>
				result({
					entries: [overviewEntry(13), { playerId: 27 }],
					unavailablePlayerIds: [27],
					outcome: 'partial'
				}),
			quietLogger
		)
		const partial = await partialHandler(
			new Request(
				'https://letletme.top/api/player-stats/desk?playerIds=13,27&eventId=1&section=overview'
			)
		)
		assert.equal(partial.status, 200)
		assert.equal(
			partial.headers.get('cache-control'),
			PLAYER_STATS_DESK_UNCACHEABLE_CONTROL
		)

		const failedHandler = createPlayerStatsDeskRouteHandler(
			async () =>
				result({
					entries: [{ playerId: 13 }, { playerId: 27 }],
					unavailablePlayerIds: [13, 27],
					outcome: 'failed'
				}),
			quietLogger
		)
		const failed = await failedHandler(
			new Request(
				'https://letletme.top/api/player-stats/desk?playerIds=13,27&eventId=1&section=overview'
			)
		)
		assert.equal(failed.status, 502)
		assert.equal(
			failed.headers.get('cache-control'),
			PLAYER_STATS_DESK_UNCACHEABLE_CONTROL
		)
	})

	it('rejects invalid parameters before loading', async () => {
		let called = false
		const handler = createPlayerStatsDeskRouteHandler(async () => {
			called = true
			return result()
		}, quietLogger)
		const response = await handler(
			new Request(
				'https://letletme.top/api/player-stats/desk?playerIds=13,13&eventId=1&section=overview'
			)
		)
		assert.equal(response.status, 400)
		assert.equal(called, false)
	})

	it('maps all-not-found desk results to 404 without caching them', async () => {
		const handler = createPlayerStatsDeskRouteHandler(
			async () =>
				result({
					entries: [{ playerId: 13 }],
					unavailablePlayerIds: [13],
					outcome: 'not-found'
				}),
			quietLogger
		)
		const response = await handler(
			new Request(
				'https://letletme.top/api/player-stats/desk?playerIds=13&eventId=1&section=overview'
			)
		)
		assert.equal(response.status, 404)
		assert.equal(
			response.headers.get('cache-control'),
			PLAYER_STATS_DESK_UNCACHEABLE_CONTROL
		)
	})
})
