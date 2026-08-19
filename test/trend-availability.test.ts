import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	normalizeTrendAvailabilityState,
	resolveTrendAvailabilityState,
	trendAvailabilityMessageKey,
} from '@/app/data/selections/_lib/trend-availability'

describe('trend availability presentation mapping', () => {
	it('maps NOT_READY to the user-facing not-yet-captured state', () => {
		assert.equal(normalizeTrendAvailabilityState('NOT_READY'), 'NOT_YET_CAPTURED')
		assert.equal(
			resolveTrendAvailabilityState({
				state: 'NOT_READY',
				evidenceContext: { availabilityState: 'NOT_YET_CAPTURED' },
				rows: null,
			}),
			'NOT_YET_CAPTURED',
		)
	})

	it('prefers evidence availability over a stale upstream section state', () => {
		assert.equal(
			resolveTrendAvailabilityState({
				state: 'NOT_READY',
				evidenceContext: { availabilityState: 'CONFIRMED_EMPTY' },
				rows: [],
			}),
			'CONFIRMED_EMPTY',
		)
		assert.equal(trendAvailabilityMessageKey('CONFIRMED_EMPTY'), 'confirmedEmpty')
	})

	it('uses unavailable only for a real missing/error section', () => {
		assert.equal(
			resolveTrendAvailabilityState({
				state: 'FAILED',
				evidenceContext: { availabilityState: 'UNAVAILABLE' },
				rows: null,
			}),
			'UNAVAILABLE',
		)
		assert.equal(trendAvailabilityMessageKey('UNAVAILABLE'), 'sectionUnavailable')
	})
})
