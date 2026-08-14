import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
	findElementPaintTime,
	markRouteNavigationStart,
	markRouteReadyStart,
	measureRouteReadyDuration,
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
			6_900
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
})
