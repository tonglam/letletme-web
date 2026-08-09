import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildMarketShareUrl,
	formatPriceMovementShareText,
	formatShareChangeDate,
} from '../app/data/market/_lib/market-price-share'
import type { MarketPriceChange } from '../lib/graphql/operations/market'

const palmer: MarketPriceChange = {
	player: {
		playerId: 131,
		playerCode: 1310,
		webName: 'Palmer',
		teamId: 8,
		teamName: 'Chelsea',
		teamShortName: 'CHE',
		position: 'MIDFIELDER',
		price: 108,
		selectedByPercent: 48,
	},
	changeDate: '2026-03-05',
	oldPrice: 107,
	newPrice: 108,
	change: 1,
	direction: 'RISE',
}

const watkins: MarketPriceChange = {
	player: {
		playerId: 20,
		playerCode: 200,
		webName: 'Watkins',
		teamId: 7,
		teamName: 'Aston Villa',
		teamShortName: 'AVL',
		position: 'FORWARD',
		price: 89,
		selectedByPercent: 18,
	},
	changeDate: '2026-03-05',
	oldPrice: 90,
	newPrice: 89,
	change: -1,
	direction: 'FALL',
}

describe('formatShareChangeDate', () => {
	it('formats YYYY-MM-DD as DD/MM/yyyy for share paste', () => {
		assert.equal(formatShareChangeDate('2026-03-05'), '05/03/2026')
		assert.equal(
			formatShareChangeDate('2026-03-05T00:00:00.000Z'),
			'05/03/2026',
		)
	})
})

describe('formatPriceMovementShareText', () => {
	it('formats a single-day board with date in the header only', () => {
		const text = formatPriceMovementShareText({
			changes: [palmer, watkins],
			changeDate: '2026-03-05',
			labels: {
				title: 'Price changes',
				rises: 'Rises',
				falls: 'Falls',
				none: 'None',
				footer: 'https://letletme.top/data/market',
			},
		})
		assert.match(text, /^Price changes · 05\/03\/2026/)
		assert.doesNotMatch(text, /20 Feb/)
		assert.match(text, /Rises \(1\)/)
		assert.match(text, /^- Palmer MID CHE · £10\.7m → £10\.8m$/m)
		assert.doesNotMatch(text, /\(\+£|\(-£/)
		assert.match(text, /Falls \(1\)/)
		assert.match(text, /^- Watkins FWD AVL · £9\.0m → £8\.9m$/m)
		assert.match(text, /\nhttps:\/\/letletme\.top\/data\/market$/)
	})

	it('handles empty columns', () => {
		const text = formatPriceMovementShareText({
			changes: [],
			changeDate: '2026-03-05',
			labels: {
				title: 'Price changes',
				rises: 'Rises',
				falls: 'Falls',
				none: 'None',
			},
		})
		assert.match(text, /^Price changes · 05\/03\/2026/)
		assert.match(text, /Rises \(0\)\nNone/)
		assert.match(text, /Falls \(0\)\nNone/)
	})
})

describe('buildMarketShareUrl', () => {
	it('builds locale-aware market URL', () => {
		assert.equal(
			buildMarketShareUrl('https://letletme.top', ''),
			'https://letletme.top/data/market',
		)
		assert.equal(
			buildMarketShareUrl('https://letletme.top/', '/zh-CN'),
			'https://letletme.top/zh-CN/data/market',
		)
	})
})
