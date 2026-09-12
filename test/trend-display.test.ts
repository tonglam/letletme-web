import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { TrendDeskRow } from '../lib/graphql/operations/trends'
import { getTrendDisplayRows } from '../app/data/selections/_lib/trend-display'

const row = (elementId: number, count: number): TrendDeskRow => ({
	elementId,
	playerName: `Player ${elementId}`,
	playerPosition: 3,
	teamShortName: 'ARS',
	count,
	percentage: count
})

describe('trend display rows', () => {
	it('hides zero-count captaincy and vice-captaincy rows', () => {
		const captaincy = getTrendDisplayRows({
			capability: 'CAPTAINCY',
			rows: [row(1, 3), row(2, 0), row(3, 1)]
		})
		const viceCaptaincy = getTrendDisplayRows({
			capability: 'VICE_CAPTAINCY',
			rows: [row(4, 0), row(5, 2)]
		})

		assert.deepEqual(
			captaincy?.map(item => item.elementId),
			[1, 3]
		)
		assert.deepEqual(
			viceCaptaincy?.map(item => item.elementId),
			[5]
		)
	})

	it('keeps zero rows for other ranked capabilities and preserves unavailable state', () => {
		const ownership = getTrendDisplayRows({
			capability: 'OWNERSHIP',
			rows: [row(1, 0), row(2, 1)]
		})

		assert.deepEqual(
			ownership?.map(item => item.elementId),
			[1, 2]
		)
		assert.equal(
			getTrendDisplayRows({ capability: 'CAPTAINCY', rows: null }),
			null
		)
	})
})
