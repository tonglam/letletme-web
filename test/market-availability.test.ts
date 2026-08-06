import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	availabilityBodyText,
	isUnavailableMarketStatus,
	marketAvailabilityStatusKey,
	selectHomeAvailabilityUpdates,
} from '../lib/market-availability'

const t = (key: 'availabilityRecovered' | `status.${string}`) => key

describe('marketAvailabilityStatusKey', () => {
	it('maps FPL element status codes', () => {
		assert.equal(marketAvailabilityStatusKey('a'), 'available')
		assert.equal(marketAvailabilityStatusKey('i'), 'injured')
		assert.equal(marketAvailabilityStatusKey('d'), 'doubtful')
		assert.equal(marketAvailabilityStatusKey('s'), 'suspended')
		assert.equal(marketAvailabilityStatusKey('u'), 'unavailable')
		assert.equal(marketAvailabilityStatusKey('?'), 'unknown')
	})
})

describe('availabilityBodyText', () => {
	it('prefers official news when present', () => {
		assert.equal(
			availabilityBodyText({ status: 'i', previousStatus: 'a', news: 'Thigh injury' }, t),
			'Thigh injury',
		)
	})

	it('uses recovered copy only for unavailable → available with empty news', () => {
		assert.equal(
			availabilityBodyText({ status: 'a', previousStatus: 'i', news: '' }, t),
			'availabilityRecovered',
		)
	})

	it('does not claim recovery for injured players with empty news', () => {
		assert.equal(
			availabilityBodyText({ status: 'i', previousStatus: 'a', news: '  ' }, t),
			'status.injured',
		)
	})
})

describe('selectHomeAvailabilityUpdates', () => {
	it('prefers higher ownership then fills to the limit', () => {
		const rows = [
			{ player: { selectedByPercent: 0.2 }, id: 'low-new' },
			{ player: { selectedByPercent: 12 }, id: 'high' },
			{ player: { selectedByPercent: 0.5 }, id: 'low-2' },
			{ player: { selectedByPercent: 5 }, id: 'mid' },
		]
		const selected = selectHomeAvailabilityUpdates(rows, 3, 1)
		assert.deepEqual(
			selected.map(r => r.id),
			['high', 'mid', 'low-new'],
		)
	})
})

describe('isUnavailableMarketStatus', () => {
	it('treats available as free and others as unavailable', () => {
		assert.equal(isUnavailableMarketStatus('a'), false)
		assert.equal(isUnavailableMarketStatus('i'), true)
	})
})
