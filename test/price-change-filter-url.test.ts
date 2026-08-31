import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildPriceChangeFilterUrl } from '@/lib/price-change-filter-url'

describe('price-change filter URL', () => {
	it('preserves unrelated parameters while syncing scope and movement', () => {
		assert.equal(
			buildPriceChangeFilterUrl(
				'https://letletme.top/zh-CN/explore/price-predictions?scope=all&movement=fall&share=1#board',
				'likely',
				'rise'
			),
			'/zh-CN/explore/price-predictions?movement=rise&share=1#board'
		)
	})

	it('removes default filters and forces the locked view to all players', () => {
		assert.equal(
			buildPriceChangeFilterUrl(
				'/explore/price-predictions?scope=all&movement=rise',
				'likely',
				'locked'
			),
			'/explore/price-predictions?movement=locked'
		)
		assert.equal(
			buildPriceChangeFilterUrl(
				'/explore/price-predictions?scope=all&movement=locked',
				'likely',
				'all'
			),
			'/explore/price-predictions'
		)
	})
})
