import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
	routeReadyNavigationId,
	findElementPaintTime,
	markRouteNavigationStart,
	markBackgroundResumeStart,
	markRouteReadyStart,
	measureRouteReadyDuration,
	routeReadyMeasurementKind,
	routeReadyStartTime,
	resetRouteNavigationStartForTests
} from '@/lib/analytics/route-navigation'

afterEach(() => resetRouteNavigationStartForTests())

describe('route ready navigation clock', () => {
	it('uses a buffered element render time for streamed RSC paint readiness', () => {
		assert.equal(
			findElementPaintTime('home-league-ranks', [
				{
					identifier: 'home-league-ranks',
					startTime: 820,
					renderTime: 790
				}
			]),
			790
		)
		assert.equal(
			findElementPaintTime('home-team-desk', [
				{ identifier: 'home-team-desk', startTime: 810 }
			]),
			810
		)
		assert.equal(findElementPaintTime('missing', []), null)
		assert.equal(
			findElementPaintTime('home-team-desk', [
				{ identifier: 'home-team-desk', startTime: 500 },
				{ identifier: 'home-team-desk', startTime: 900 }
			]),
			900
		)
		assert.equal(
			findElementPaintTime(
				'home-team-desk',
				[
					{ identifier: 'home-team-desk', startTime: 500 },
					{ identifier: 'home-team-desk', startTime: 900 }
				],
				700
			),
			900
		)
		assert.equal(
			findElementPaintTime(
				'home-team-desk',
				[{ identifier: 'home-team-desk', startTime: 500 }],
				700
			),
			null
		)
	})

	it('uses the current App Router transition rather than the age of the tab', () => {
		markRouteNavigationStart(
			'/explore/market?source=nav',
			5_000,
			'https://letletme.top/'
		)
		assert.equal(measureRouteReadyDuration('/explore/market', 5_640, 0), 640)
	})

	it('uses document navigation start for a hard load', () => {
		assert.equal(
			measureRouteReadyDuration('/explore/player-stats', 1_250, 0),
			1_250
		)
	})

	it('does not reuse a transition timestamp for a different route', () => {
		markRouteNavigationStart('/explore/market', 5_000, 'https://letletme.top/')
		assert.equal(
			measureRouteReadyDuration('/profile/sessions', 7_000, 100),
			null
		)
	})

	it('marks a missing browser start instead of using the document lifetime', () => {
		assert.equal(
			measureRouteReadyDuration('/profile/sessions', 7_000, null),
			null
		)
	})

	it('starts a fresh clock for an in-page content interaction', () => {
		markRouteReadyStart('/explore/player-stats', 900)
		assert.equal(
			measureRouteReadyDuration('/explore/player-stats', 1_140, 0),
			240
		)
	})

	it('keeps overlapping in-page interaction clocks independent', () => {
		markRouteReadyStart('/explore/market', 1_000, 'search:sal')
		markRouteReadyStart('/explore/market', 1_100, 'history:13')
		assert.equal(
			measureRouteReadyDuration('/explore/market', 1_350, 0, 'search:sal'),
			350
		)
		assert.equal(
			measureRouteReadyDuration('/explore/market', 1_350, 0, 'history:13'),
			250
		)
	})

	it('does not fall back to a navigation clock for a missing interaction start', () => {
		markRouteNavigationStart('/explore/market', 5_000, 'https://letletme.top/')
		assert.equal(
			measureRouteReadyDuration(
				'/explore/market',
				5_500,
				0,
				'search:missing',
				'interaction'
			),
			null
		)
		assert.equal(
			routeReadyMeasurementKind(
				'/explore/market',
				0,
				'search:missing',
				'interaction'
			),
			'missing_start'
		)
	})

	it('uses navigation timing for an identity-only ready key', () => {
		markRouteNavigationStart('/explore/market', 5_000, 'https://letletme.top/')
		assert.equal(
			measureRouteReadyDuration('/explore/market', 5_640, 0, 'revision-1'),
			640
		)
		assert.equal(
			routeReadyMeasurementKind('/explore/market', 0, 'revision-1'),
			'in_page_navigation'
		)
	})

	it('retains a keyed interaction clock for sibling readiness markers', () => {
		markRouteReadyStart('/explore/player-stats', 900, 'detail:42')
		assert.equal(
			measureRouteReadyDuration(
				'/explore/player-stats',
				1_140,
				0,
				'detail:42',
				'interaction'
			),
			240
		)
		assert.equal(
			measureRouteReadyDuration(
				'/explore/player-stats',
				1_200,
				0,
				'detail:42',
				'interaction'
			),
			300
		)
	})

	it('keeps a background resume separate from navigation timing', () => {
		markBackgroundResumeStart('/explore/market', 3_000)
		assert.equal(
			routeReadyMeasurementKind('/explore/market', 0),
			'background_resume'
		)
		assert.equal(measureRouteReadyDuration('/explore/market', 3_450, 0), 450)
		assert.equal(
			routeReadyMeasurementKind('/explore/market', 0),
			'missing_start'
		)
	})

	it('consumes a background resume clock for identity-keyed readiness', () => {
		const startedAt = performance.now()
		markBackgroundResumeStart('/explore/fixtures', startedAt)
		assert.equal(
			Math.round(
				measureRouteReadyDuration(
					'/explore/fixtures',
					startedAt + 450,
					0,
					'revision-1'
				) ?? Number.NaN
			),
			450
		)
		assert.equal(
			routeReadyMeasurementKind('/explore/fixtures', 0, 'revision-2'),
			'missing_start'
		)
	})

	it('preserves a claimed resume clock for an overlapping marker', () => {
		const startedAt = performance.now()
		markBackgroundResumeStart('/explore/fixtures', startedAt)
		const claimedStart = routeReadyStartTime(
			'/explore/fixtures',
			0,
			'revision-1'
		)
		assert.equal(claimedStart, startedAt)
		assert.equal(
			routeReadyMeasurementKind('/explore/fixtures', 0, 'revision-1'),
			'background_resume'
		)
		assert.equal(
			Math.round(
				measureRouteReadyDuration('/explore/fixtures', startedAt + 100, 0) ??
					Number.NaN
			),
			100
		)
		assert.equal(
			Math.round(
				measureRouteReadyDuration(
					'/explore/fixtures',
					startedAt + 450,
					0,
					'revision-1',
					'identity',
					claimedStart ?? undefined
				) ?? Number.NaN
			),
			450
		)
	})
})

it('shares clock identity across markers and changes it on repeat navigation', () => {
 const hard = routeReadyNavigationId('/market', 0)
 assert.match(hard!, /^nav-/)
 assert.equal(routeReadyNavigationId('/market', 0), hard)
 markRouteNavigationStart('/market', 10, 'https://example.test')
 const first = routeReadyNavigationId('/market', 0)
 assert.notEqual(first, hard)
 assert.equal(routeReadyNavigationId('/market', 0), first)
 assert.equal(routeReadyNavigationId('/other', 0), undefined)
 markRouteNavigationStart('/market', 20, 'https://example.test')
 assert.notEqual(routeReadyNavigationId('/market', 0), first)
})
it('does not manufacture a navigation identity without a clock', () => {
 assert.equal(routeReadyNavigationId('/market', null), undefined)
})

it('does not resurrect the document clock after an SPA background resume is consumed', () => {
 const original = routeReadyNavigationId('/initial', 0)
 assert.ok(original)
 markRouteNavigationStart('/market', 100, 'https://example.test')
 markBackgroundResumeStart('/market', 200)
 assert.equal(measureRouteReadyDuration('/market', 250, 0), 50)
 assert.equal(routeReadyNavigationId('/market', 0), undefined)
 assert.equal(routeReadyStartTime('/market', 0), null)
 assert.equal(routeReadyMeasurementKind('/market', 0), 'missing_start')
})

it('retains an explicitly missing claimed clock when a new navigation starts', () => {
 markRouteNavigationStart('/market', 100, 'https://example.test')
 assert.equal(measureRouteReadyDuration('/market', 200, 0, undefined, 'identity', null), null)
 assert.equal(measureRouteReadyDuration('/market', 200, 0, undefined, 'identity', 50), 150)
})

it('finishing an old claimed navigation does not consume a newer background resume', () => {
 markRouteNavigationStart('/market', 10, 'https://example.test')
 markBackgroundResumeStart('/market', 80)
 assert.equal(measureRouteReadyDuration('/market', 120, 0, undefined, 'identity', 10), 110)
 assert.equal(routeReadyMeasurementKind('/market', 0), 'background_resume')
 assert.equal(measureRouteReadyDuration('/market', 130, 0), 50)
})
