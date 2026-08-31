import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'
import {
	buildFixtureWindowQuery,
	fixtureWindowEventIds,
	isFixtureWindowResponse,
	loadFixtureWindowWithExecutor,
	mapFixturePlanningFixture,
	parseFixtureWindowParams,
	rateFixtureWindowReady,
	type FixturePlanningFixture,
	type FixtureWindowLoadResult
} from '../lib/fixture-window'
import { mergeFixtureWindowSchedules } from '../lib/fixture-window-schedule'
import {
	createFixtureWindowRouteHandler,
	FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL,
	FIXTURE_WINDOW_UNCACHEABLE_CONTROL,
	fixtureWindowCacheHeaders
} from '../lib/fixture-window-route'

const backendFixture = (id = 101) => ({
	id,
	code: 9_999,
	event: { id: 1, name: 'Gameweek 1' },
	kickoffTime: '2026-08-13T12:00:00.000Z',
	finished: false,
	started: false,
	homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
	awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
	homeScore: null,
	awayScore: null,
	homeTeamDifficulty: 2,
	awayTeamDifficulty: 4
})

const planningFixture = (eventId: number): FixturePlanningFixture => ({
	id: eventId * 100,
	eventId,
	finished: false,
	homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
	awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
	homeTeamDifficulty: 2,
	awayTeamDifficulty: 4
})

const result = (
	overrides: Partial<FixtureWindowLoadResult> = {}
): FixtureWindowLoadResult => ({
	fromGw: 10,
	toGw: 11,
	fixturesByEvent: {
		'10': [planningFixture(10)],
		'11': []
	},
	unknownEventIds: [],
	outcome: 'complete',
	path: 'batch',
	...overrides
})

const quietLogger = {
	info: () => undefined,
	error: () => undefined
}

function assertCacheHeaders(response: Response, expected: string) {
	for (const name of [
		'cache-control',
		'cdn-cache-control',
		'vercel-cdn-cache-control'
	]) {
		assert.equal(response.headers.get(name), expected, name)
	}
}

describe('fixture window input and query', () => {
	it('strictly validates parameters and the GW38 boundary', () => {
		assert.deepEqual(
			parseFixtureWindowParams(new URLSearchParams('fromGw=38&count=1')),
			{ ok: true, fromGw: 38, count: 1 }
		)
		for (const query of [
			'',
			'fromGw=0&count=1',
			'fromGw=01&count=1',
			'fromGw=38&count=2',
			'fromGw=1&count=0',
			'fromGw=1&count=6',
			'fromGw=1.5&count=1',
			'fromGw=1&fromGw=2&count=1'
		]) {
			assert.equal(
				parseFixtureWindowParams(new URLSearchParams(query)).ok,
				false
			)
		}
		assert.deepEqual(fixtureWindowEventIds(34, 5), [34, 35, 36, 37, 38])
		assert.throws(() => fixtureWindowEventIds(35, 5), RangeError)
	})

	it('builds one shared-fragment alias query for every supported count', () => {
		for (let count = 1; count <= 5; count += 1) {
			const query = buildFixtureWindowQuery(count)
			const document = parse(query)
			const operation = document.definitions.find(
				definition => definition.kind === 'OperationDefinition'
			)
			assert.ok(operation?.kind === 'OperationDefinition')
			assert.equal(operation.selectionSet.selections.length, count)
			assert.equal(operation.variableDefinitions?.length, count)
			assert.equal(
				document.definitions.filter(
					definition => definition.kind === 'FragmentDefinition'
				).length,
				1
			)
			let astNodes = 0
			visit(document, { enter: () => void (astNodes += 1) })
			assert.ok(astNodes < 200, `${count}-GW query has ${astNodes} AST nodes`)
		}
	})

	it('maps only the compact planning DTO and injects its event id', () => {
		assert.deepEqual(mapFixturePlanningFixture(backendFixture(), 12), {
			id: 101,
			eventId: 12,
			finished: false,
			started: false,
			homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
			awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
			homeScore: null,
			awayScore: null,
			homeTeamDifficulty: 2,
			awayTeamDifficulty: 4
		})
	})

	it('keeps finished scores in the planning DTO', () => {
		const fixture = mapFixturePlanningFixture(
			{
				...backendFixture(),
				finished: true,
				started: true,
				homeScore: 2,
				awayScore: 1
			},
			12
		)

		assert.equal(fixture.finished, true)
		assert.equal(fixture.started, true)
		assert.equal(fixture.homeScore, 2)
		assert.equal(fixture.awayScore, 1)
	})

	it('rates the window-ready metric at the 1s and 1.5s thresholds', () => {
		assert.equal(rateFixtureWindowReady(1_000), 'good')
		assert.equal(rateFixtureWindowReady(1_000.01), 'needs-improvement')
		assert.equal(rateFixtureWindowReady(1_500), 'needs-improvement')
		assert.equal(rateFixtureWindowReady(1_500.01), 'poor')
	})
})

describe('fixture window loader', () => {
	it('uses one batch query and preserves a real empty gameweek as BGW data', async () => {
		let calls = 0
		const loaded = await loadFixtureWindowWithExecutor(
			10,
			3,
			async (_query, variables) => {
				calls += 1
				assert.deepEqual(variables, { event0: 10, event1: 11, event2: 12 })
				return {
					event0: [backendFixture(1_001)],
					event1: [],
					event2: [backendFixture(1_201)]
				}
			}
		)

		assert.equal(calls, 1)
		assert.equal(loaded.outcome, 'complete')
		assert.equal(loaded.path, 'batch')
		assert.deepEqual(loaded.unknownEventIds, [])
		assert.deepEqual(loaded.fixturesByEvent['11'], [])
		assert.equal(loaded.fixturesByEvent['12']?.[0]?.eventId, 12)
	})

	it('falls back per GW and marks only rejected events unavailable', async () => {
		let calls = 0
		const loaded = await loadFixtureWindowWithExecutor(
			20,
			3,
			async (query, variables) => {
				calls += 1
				if (query.includes('$event1')) throw new Error('batch failed')
				if (variables.event0 === 21) throw new Error('GW21 failed')
				return {
					event0:
						variables.event0 === 20 ? [] : [backendFixture(variables.event0)]
				}
			}
		)

		assert.equal(calls, 4)
		assert.equal(loaded.outcome, 'partial')
		assert.equal(loaded.path, 'fallback')
		assert.deepEqual(loaded.fixturesByEvent['20'], [])
		assert.deepEqual(loaded.unknownEventIds, [21])
		assert.equal(loaded.fixturesByEvent['22']?.[0]?.eventId, 22)
	})

	it('returns failed only when every fallback event rejects', async () => {
		const loaded = await loadFixtureWindowWithExecutor(37, 2, async () => {
			throw new Error('upstream unavailable')
		})
		assert.equal(loaded.outcome, 'failed')
		assert.deepEqual(loaded.unknownEventIds, [37, 38])
		assert.deepEqual(loaded.fixturesByEvent, {})
	})

	it('rejects responses that omit a GW or overlap data with unknown ids', () => {
		assert.equal(
			isFixtureWindowResponse({
				fromGw: 10,
				toGw: 11,
				fixturesByEvent: { '10': [] },
				unknownEventIds: []
			}),
			false
		)
		assert.equal(
			isFixtureWindowResponse({
				fromGw: 10,
				toGw: 11,
				fixturesByEvent: { '10': [], '11': [] },
				unknownEventIds: [11]
			}),
			false
		)
	})

	it('keeps fulfilled partial windows retryable', () => {
		const merged = mergeFixtureWindowSchedules(
			[
				{
					status: 'fulfilled',
					value: {
						fromGw: 10,
						toGw: 11,
						fixturesByEvent: { '10': [planningFixture(10)] },
						unknownEventIds: [11]
					}
				}
			],
			[{ fromGw: 10, count: 2 }],
			fixtures => fixtures
		)

		assert.equal(merged.failedWindowCount, 1)
		assert.deepEqual(Array.from(merged.unavailableEventIds), [11])
		assert.deepEqual(merged.fixturesByEvent.get(10), [planningFixture(10)])
	})
})

describe('fixture window route handler', () => {
	it('returns a cacheable 200 only for complete windows', async () => {
		const handler = createFixtureWindowRouteHandler(
			async () => result(),
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/fixtures/window?fromGw=10&count=2')
		)
		assert.equal(response.status, 200)
		assertCacheHeaders(response, FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL)
		assert.deepEqual(
			fixtureWindowCacheHeaders(FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL),
			{
				'Cache-Control': FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL,
				'CDN-Cache-Control': FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL,
				'Vercel-CDN-Cache-Control': FIXTURE_WINDOW_PUBLIC_CACHE_CONTROL
			}
		)
		assert.deepEqual(await response.json(), {
			fromGw: 10,
			toGw: 11,
			fixturesByEvent: {
				'10': [planningFixture(10)],
				'11': []
			},
			unknownEventIds: []
		})
	})

	it('returns partial data with no-store', async () => {
		const handler = createFixtureWindowRouteHandler(
			async () =>
				result({
					fixturesByEvent: { '10': [planningFixture(10)] },
					unknownEventIds: [11],
					outcome: 'partial',
					path: 'fallback'
				}),
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/fixtures/window?fromGw=10&count=2')
		)
		assert.equal(response.status, 200)
		assertCacheHeaders(response, FIXTURE_WINDOW_UNCACHEABLE_CONTROL)
	})

	it('returns 400 before loading invalid parameters', async () => {
		let called = false
		const handler = createFixtureWindowRouteHandler(async () => {
			called = true
			return result()
		}, quietLogger)
		const response = await handler(
			new Request('https://letletme.top/api/fixtures/window?fromGw=38&count=2')
		)
		assert.equal(response.status, 400)
		assert.equal(called, false)
		assertCacheHeaders(response, FIXTURE_WINDOW_UNCACHEABLE_CONTROL)
	})

	it('returns an uncacheable 502 when every event fails', async () => {
		const handler = createFixtureWindowRouteHandler(
			async () =>
				result({
					fixturesByEvent: {},
					unknownEventIds: [10, 11],
					outcome: 'failed',
					path: 'fallback'
				}),
			quietLogger
		)
		const response = await handler(
			new Request('https://letletme.top/api/fixtures/window?fromGw=10&count=2')
		)
		assert.equal(response.status, 502)
		assertCacheHeaders(response, FIXTURE_WINDOW_UNCACHEABLE_CONTROL)
	})
})
