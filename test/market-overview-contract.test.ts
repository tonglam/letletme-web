import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	normalizeMarketOwnershipDay,
	normalizeMarketOwnershipOverview,
	normalizeMarketPulseSummaryResponse
} from '../lib/market-overview-contract'

const coverage = { missingDates: [] }

describe('market overview response contracts', () => {
	it('rejects a null or incomplete pulse instead of manufacturing empty arrays', () => {
		assert.equal(
			normalizeMarketPulseSummaryResponse({
				marketSnapshotContext: { revision: 'market-176' },
				marketPulse: null
			}),
			null
		)
		assert.equal(
			normalizeMarketPulseSummaryResponse({
				marketSnapshotContext: { revision: 'market-176' },
				marketPulse: {
					coverage,
					mostSelected: [],
					transferMovers: [],
					availabilityHighlights: [],
					newPlayers: []
				}
			}),
			null
		)
	})

	it('keeps a complete pulse usable and does not request the full update list', () => {
		const result = normalizeMarketPulseSummaryResponse({
			marketSnapshotContext: { revision: 'market-176' },
			marketPulse: {
				coverage,
				mostSelected: [],
				transferMovers: [],
				availabilityHighlights: [],
				newPlayers: [],
				priceChanges: [],
				availabilityUpdateCount: 137
			}
		})
		assert.ok(result)
		assert.equal(result.marketSnapshotContext.revision, 'market-176')
		assert.deepEqual(result.marketPulse.availabilityUpdates, [])
		assert.equal(result.marketPulse.availabilityUpdateCount, 137)
	})

	it('rejects null ownership responses before date or ranking access', () => {
		assert.equal(
			normalizeMarketOwnershipOverview({ marketOwnershipOverview: null }),
			null
		)
		assert.equal(
			normalizeMarketOwnershipDay({ marketOwnershipDay: null }),
			null
		)
	})

	it('accepts complete overview and day responses', () => {
		const overview = normalizeMarketOwnershipOverview({
			marketOwnershipOverview: {
				period: 'DAILY',
				coverage,
				risers: [],
				fallers: []
			}
		})
		const day = normalizeMarketOwnershipDay({
			marketOwnershipDay: {
				period: 'DAILY',
				coverage,
				risers: [],
				fallers: []
			}
		})
		assert.equal(overview?.period, 'DAILY')
		assert.equal(day?.period, 'DAILY')
	})
})
