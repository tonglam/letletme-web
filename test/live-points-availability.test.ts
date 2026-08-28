import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { resolveLivePointsPayloadState } from '../app/live/points/_lib/live-points-availability'
import type { LiveCalcData } from '../lib/graphql/operations/live'

const emptyLive = (overrides: Partial<LiveCalcData> = {}): LiveCalcData => ({
	entry: 6953,
	event: 1,
	entryName: 'letletredarrow',
	transferCost: 0,
	captainName: '',
	pickList: [],
	...overrides
})

describe('live points payload availability', () => {
	it('fails closed when an older server marks an empty lineup READY', () => {
		assert.equal(
			resolveLivePointsPayloadState(emptyLive({ availability: 'READY' })),
			'LINEUP_UNAVAILABLE'
		)
	})

	it('surfaces the explicit unavailable-lineup contract without retrying', () => {
		assert.equal(
			resolveLivePointsPayloadState(
				emptyLive({ availability: 'LINEUP_UNAVAILABLE' })
			),
			'LINEUP_UNAVAILABLE'
		)
	})

	it('keeps retrying a genuine no-picks synchronization placeholder', () => {
		assert.equal(
			resolveLivePointsPayloadState(
				emptyLive({ availability: 'NO_PICKS', entryName: '' })
			),
			'PENDING_SYNC'
		)
	})

	it('does not retry a finalized score that legitimately has no rich lineup', () => {
		assert.equal(
			resolveLivePointsPayloadState(
				emptyLive({
					availability: 'NO_PICKS',
					score: {
						eventPoints: 71,
						netEventPoints: 71,
						totalPoints: 71,
						totalScope: 'OVERALL',
						eventRank: null,
						overallRank: null,
						leagueRank: null,
						transferCost: 0,
						source: 'FPL_FINAL_RESULT',
						state: 'FINAL',
						eventPointSemantics: 'ZERO_COST_EQUIVALENT',
						revision: 'final:1:6953',
						checkedAt: '2026-08-28T00:00:00.000Z',
						upstreamUpdatedAt: null,
						staleAt: null,
						nextRefreshAt: null,
						reconciliation: 'NO_LINEUP',
						reasonCodes: ['MISSING_LINEUP']
					}
				})
			),
			'NO_DATA'
		)
	})

	it('recognizes the previous upstream-unavailable payload shape', () => {
		assert.equal(
			resolveLivePointsPayloadState(
				emptyLive({
					score: {
						eventPoints: null,
						netEventPoints: null,
						totalPoints: null,
						totalScope: 'UNKNOWN',
						eventRank: null,
						overallRank: null,
						leagueRank: null,
						transferCost: 0,
						source: 'UNAVAILABLE',
						state: 'UNAVAILABLE',
						eventPointSemantics: 'UNKNOWN',
						revision: null,
						checkedAt: null,
						upstreamUpdatedAt: null,
						staleAt: null,
						nextRefreshAt: null,
						reconciliation: 'NO_LINEUP',
						reasonCodes: ['UPSTREAM_UNAVAILABLE', 'MISSING_LINEUP']
					}
				})
			),
			'LINEUP_UNAVAILABLE'
		)
	})
})
