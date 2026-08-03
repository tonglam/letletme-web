import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	breakdownLookupForRequest,
	buildEventLiveExplainBatchQuery,
	rollupBreakdownStats,
} from '../app/live/points/_lib/live-points-model'

describe('live-points model', () => {
	it('rolls fixture breakdown rows up by identifier', () => {
		assert.deepEqual(
			rollupBreakdownStats([
				{ identifier: 'goals_scored', value: 1, points: 5 },
				{ identifier: 'goals_scored', value: 1, points: 5 },
				{ identifier: 'minutes', value: 90, points: 2 },
			]),
			[
				{ identifier: 'goals_scored', value: 2, points: 10 },
				{ identifier: 'minutes', value: 90, points: 2 },
			],
		)
	})

	it('deduplicates and bounds element aliases before building GraphQL', () => {
		const query = buildEventLiveExplainBatchQuery([
			1,
			1,
			-2,
			Number.NaN,
			...Array.from({ length: 30 }, (_, index) => index + 2),
		])
		assert.ok(query)
		assert.equal((query.match(/eventLiveExplain/g) ?? []).length, 15)
		assert.equal((query.match(/e1:/g) ?? []).length, 1)
		assert.equal(query.includes('e-2'), false)
	})

	it('returns no query when every element ID is invalid', () => {
		assert.equal(buildEventLiveExplainBatchQuery([0, -1, Number.NaN]), null)
	})

	it('reuses explain enrichment only for the same entry and gameweek', () => {
		const lookup = new Map([
			[
				'10',
				{
					teamShortName: 'ARS',
					stats: [{ identifier: 'clean_sheets', value: 1, points: 4 }]
				}
			]
		])
		const cached = { requestKey: '101:33', lookup }

		assert.equal(breakdownLookupForRequest(cached, '101:33'), lookup)
		assert.equal(breakdownLookupForRequest(cached, '101:34').size, 0)
	})
})
