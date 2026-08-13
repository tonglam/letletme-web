import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
	markRouteNavigationStart,
	markRouteReadyStart,
	measureRouteReadyDuration,
	resetRouteNavigationStartForTests
} from '@/lib/analytics/route-navigation'

afterEach(() => resetRouteNavigationStartForTests())

describe('route ready navigation clock', () => {
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
		assert.equal(measureRouteReadyDuration('/explore/player-stats', 1_140, 0), 240)
	})
})
