import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	comparisonPositionLabel,
	mapComparisonPick
} from '@/lib/tournament/entry-comparison'

describe('live tournament entry comparison', () => {
	it('uses the squad pick role flags even without an entry-level captain name', () => {
		const pick = mapComparisonPick(
			{
				webName: 'Captain',
				totalPoints: 12,
				minutes: 90,
				starts: true,
				isCaptain: true,
				isViceCaptain: false
			},
			true
		)

		assert.equal(pick?.isCaptain, true)
		assert.equal(pick?.isViceCaptain, false)
		assert.equal(pick?.totalPoints, 12)
	})

	it('keeps role flags but suppresses unavailable fallback scores', () => {
		const pick = mapComparisonPick(
			{ webName: 'Vice', totalPoints: 8, isViceCaptain: true },
			false
		)

		assert.equal(pick?.isViceCaptain, true)
		assert.equal(pick?.totalPoints, 0)
	})

	it('normalizes full GraphQL position names for the lineup columns', () => {
		assert.equal(
			comparisonPositionLabel({ elementTypeName: 'GOALKEEPER' }, 1),
			'GKP'
		)
		assert.equal(
			comparisonPositionLabel({ elementTypeName: 'FORWARD' }, 11),
			'FWD'
		)
		assert.equal(
			comparisonPositionLabel({ elementTypeName: 'FORWARD' }, 12),
			'SUB'
		)
	})
})
