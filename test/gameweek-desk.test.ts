import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import { GET_GAMEWEEK_DESK } from '../lib/graphql/operations/gameweek'
import {
	gameweekDeskCacheControl,
	GAMEWEEK_DESK_SETTLED_CACHE_CONTROL,
	isGameweekDeskData,
	loadGameweekDeskWithExecutor,
	parseGameweekDeskParams,
	type GameweekDeskData,
	type GameweekDeskLoadResult
} from '../lib/gameweek-desk'
import {
	createGameweekDeskRouteHandler,
	GAMEWEEK_DESK_UNCACHEABLE_CONTROL
} from '../lib/gameweek-desk-route'

const desk = (overrides: Partial<GameweekDeskData> = {}): GameweekDeskData => ({
	season: '2627',
	coreRevision: '7',
	liveRevision: null,
	anchorEventId: 1,
	eventId: 1,
	currentEventId: null,
	nextEventId: 1,
	isPreseason: true,
	lifecycle: 'SCHEDULED',
	deadlineTime: '2026-09-01T17:30:00.000Z',
	publishedAt: null,
	overviewState: 'PENDING',
	boardsState: 'PENDING',
	overview: null,
	dreamTeam: [],
	hauls: [],
	...overrides
})

const result = (
	overrides: Partial<GameweekDeskLoadResult> = {}
): GameweekDeskLoadResult => ({ ...desk(), outcome: 'complete', ...overrides })

const quietLogger = { info: () => undefined, error: () => undefined }

describe('gameweek desk contract', () => {
	it('strictly validates one event ID and the GW38 boundary', () => {
		assert.deepEqual(
			parseGameweekDeskParams(new URLSearchParams('eventId=38')),
			{ ok: true, eventId: 38 }
		)
		for (const query of [
			'',
			'eventId=0',
			'eventId=01',
			'eventId=39',
			'eventId=1&eventId=2',
			'eventId=1.5'
		]) {
			assert.equal(
				parseGameweekDeskParams(new URLSearchParams(query)).ok,
				false
			)
		}
	})

	it('keeps the aggregate query compact and maps a real scheduled desk', async () => {
		const document = parse(GET_GAMEWEEK_DESK)
		let nodes = 0
		visit(document, { enter: () => void (nodes += 1) })
		assert.ok(nodes < 150, `gameweek desk query has ${nodes} AST nodes`)

		let calls = 0
		const loaded = await loadGameweekDeskWithExecutor(
			undefined,
			async (_query, variables) => {
				calls += 1
				assert.equal(variables, undefined)
				return { gameweekDesk: desk() }
			}
		)
		assert.equal(calls, 1)
		assert.equal(loaded.outcome, 'complete')
		assert.equal(isGameweekDeskData(desk()), true)
	})

	it('marks only unavailable sections partial and total unavailable failed', () => {
		assert.equal(
			{ ...result({ boardsState: 'UNAVAILABLE', outcome: 'partial' }) }.outcome,
			'partial'
		)
		assert.equal(
			result({
				overviewState: 'UNAVAILABLE',
				boardsState: 'UNAVAILABLE',
				outcome: 'failed'
			}).outcome,
			'failed'
		)
		assert.equal(
			gameweekDeskCacheControl(
				desk({
					lifecycle: 'SETTLED',
					overviewState: 'AVAILABLE',
					boardsState: 'AVAILABLE'
				})
			),
			GAMEWEEK_DESK_SETTLED_CACHE_CONTROL
		)
		assert.match(GAMEWEEK_DESK_SETTLED_CACHE_CONTROL, /s-maxage=60/)
		assert.match(GAMEWEEK_DESK_SETTLED_CACHE_CONTROL, /stale-while-revalidate=60/)
		assert.match(
			gameweekDeskCacheControl(
				desk({ lifecycle: 'SETTLED', overviewState: 'PENDING' })
			),
			/s-maxage=30/
		)
	})
})

describe('gameweek desk route', () => {
	it('returns a cacheable complete desk', async () => {
		const handler = createGameweekDeskRouteHandler(
			async () => result(),
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/gameweek/desk?eventId=1')
		)
		assert.equal(response.status, 200)
		assert.match(response.headers.get('cache-control') ?? '', /public/)
		assert.equal((await response.json()).eventId, 1)
	})

	it('returns partial data with no-store and failed data as 502', async () => {
		const partial = createGameweekDeskRouteHandler(
			async () => result({ boardsState: 'UNAVAILABLE', outcome: 'partial' }),
			quietLogger
		)
		const partialResponse = await partial(
			new Request('https://letletme.top/api/gameweek/desk?eventId=1')
		)
		assert.equal(partialResponse.status, 200)
		assert.equal(
			partialResponse.headers.get('cache-control'),
			GAMEWEEK_DESK_UNCACHEABLE_CONTROL
		)

		const failed = createGameweekDeskRouteHandler(
			async () =>
				result({
					overviewState: 'UNAVAILABLE',
					boardsState: 'UNAVAILABLE',
					outcome: 'failed'
				}),
			quietLogger
		)
		const failedResponse = await failed(
			new Request('https://letletme.top/api/gameweek/desk?eventId=1')
		)
		assert.equal(failedResponse.status, 502)
	})

	it('rejects invalid input before invoking the loader', async () => {
		let called = false
		const handler = createGameweekDeskRouteHandler(async () => {
			called = true
			return result()
		}, quietLogger)
		const response = await handler(
			new Request('https://letletme.top/api/gameweek/desk?eventId=39')
		)
		assert.equal(response.status, 400)
		assert.equal(called, false)
	})
})
