import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	isPublishedMarketOwnershipDate,
	normalizeMarketOwnershipDate
} from '../lib/market-ownership-date'

describe('market ownership dates', () => {
	it('accepts only canonical calendar dates', () => {
		assert.equal(normalizeMarketOwnershipDate('2026-08-20'), '2026-08-20')
		assert.equal(normalizeMarketOwnershipDate('2026-02-29'), null)
		assert.equal(normalizeMarketOwnershipDate('2026-13-01'), null)
		assert.equal(normalizeMarketOwnershipDate('2026-8-1'), null)
	})

	it('bounds durable day-cache fills to published daily coverage', () => {
		const coverage = {
			firstDate: '2026-08-10',
			latestDate: '2026-08-20',
			missingDates: ['2026-08-15']
		}
		assert.equal(isPublishedMarketOwnershipDate('2026-08-10', coverage), true)
		assert.equal(isPublishedMarketOwnershipDate('2026-08-20', coverage), true)
		assert.equal(isPublishedMarketOwnershipDate('2026-08-09', coverage), false)
		assert.equal(isPublishedMarketOwnershipDate('2026-08-21', coverage), false)
		assert.equal(isPublishedMarketOwnershipDate('2026-08-15', coverage), false)
	})
})
