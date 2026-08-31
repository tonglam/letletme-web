import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPriceChangeUnlockDays } from '../lib/price-change-status'

describe('price-change lock presentation', () => {
	it('rounds a partial remaining day up like the official unlock label', () => {
		const now = Date.parse('2026-08-28T00:00:00.000Z')

		assert.equal(getPriceChangeUnlockDays('2026-08-31T01:00:00.000Z', now), 4)
		assert.equal(getPriceChangeUnlockDays('2026-08-28T00:00:01.000Z', now), 1)
	})

	it('falls back to the locked label when the upstream unlock time is unusable', () => {
		const now = Date.parse('2026-08-28T00:00:00.000Z')

		assert.equal(getPriceChangeUnlockDays(null, now), null)
		assert.equal(getPriceChangeUnlockDays('not-a-date', now), null)
		assert.equal(
			getPriceChangeUnlockDays('2026-08-27T23:59:59.000Z', now),
			null
		)
	})
})
