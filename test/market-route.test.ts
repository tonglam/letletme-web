import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	parseMarketAvailabilityParams,
	parseMarketHistoryParams,
	parseMarketPlayersParams
} from '../lib/market-route'

describe('market route parameter validation', () => {
	it('normalizes search and rejects duplicates or non-canonical integers', () => {
		assert.deepEqual(
			parseMarketPlayersParams(
				new URLSearchParams('search=%E2%84%AB%20%20haaland&limit=20&revision=3')
			),
			{ search: 'Å haaland', limit: 20, revision: 3 }
		)
		assert.ok(
			'error' in
				parseMarketPlayersParams(
					new URLSearchParams('search=haaland&search=salah&revision=3')
				)
		)
		assert.ok(
			'error' in
				parseMarketPlayersParams(
					new URLSearchParams('search=haaland&revision=03')
				)
		)
		assert.ok(
			'error' in
				parseMarketPlayersParams(
					new URLSearchParams('search=haaland&revision=3&cookie=secret')
				)
		)
		assert.ok(
			'error' in
				parseMarketPlayersParams(
					new URLSearchParams('search=haaland&revision=3')
				)
		)
	})

	it('enforces bounded IDs and day windows', () => {
		assert.deepEqual(
			parseMarketHistoryParams(new URLSearchParams('playerId=13&revision=0')),
			{ playerId: 13, revision: 0 }
		)
		assert.deepEqual(
			parseMarketAvailabilityParams(new URLSearchParams('days=30&revision=2')),
			{ days: 30, offset: 0, revision: 2 }
		)
		assert.deepEqual(
			parseMarketAvailabilityParams(
				new URLSearchParams('days=7&offset=20&revision=2')
			),
			{ days: 7, offset: 20, revision: 2 }
		)
		assert.ok(
			'error' in
				parseMarketHistoryParams(new URLSearchParams('playerId=0&revision=1'))
		)
		assert.ok(
			'error' in
				parseMarketAvailabilityParams(new URLSearchParams('days=31&revision=1'))
		)
		assert.ok(
			'error' in
				parseMarketAvailabilityParams(new URLSearchParams('revision=1'))
		)
		for (const value of ['-1', '1.5', '5001', 'NaN']) {
			assert.ok(
				'error' in
					parseMarketAvailabilityParams(
						new URLSearchParams(`days=7&offset=${value}&revision=1`)
					)
			)
		}
		assert.ok(
			'error' in
				parseMarketAvailabilityParams(
					new URLSearchParams('days=7&offset=1&offset=2&revision=1')
				)
		)
	})
})
