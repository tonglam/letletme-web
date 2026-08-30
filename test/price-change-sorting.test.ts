import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PriceChangePlayer } from '../lib/graphql/operations/price-changes'
import {
	DEFAULT_PRICE_CHANGE_SORT,
	matchesPriceChangePlayer,
	selectPriceChangePlayers,
	sortPriceChangePlayers,
} from '../lib/price-change-sorting'

function player(
	id: number,
	{
		status = 'UNLIKELY',
		progressPercent = 0,
		currentPrice = 50,
		transfersInEvent = 0,
		transfersOutEvent = 0,
		webName = `Player ${id}`,
	}: Partial<PriceChangePlayer> = {},
): PriceChangePlayer {
	return {
		playerId: id,
		playerCode: id,
		webName,
		teamId: id,
		teamName: `Team ${id}`,
		teamShortName: `T${id}`,
		position: 'MID',
		currentPrice,
		selectedByPercent: 0,
		progressPercent,
		hourlyRate: 0,
		status,
		ownershipTrend: 'FLAT',
		transfersInEvent,
		transfersOutEvent,
		lockedUntil: null,
		calibrating: status === 'CALIBRATING',
	}
}

describe('sortPriceChangePlayers', () => {
	it('uses one likely-rise/fall scope for the homepage and detail board', () => {
		const players = [
			player(1, { status: 'LIKELY_RISE', progressPercent: 35 }),
			player(2, { status: 'VERY_LIKELY_RISE', progressPercent: 80 }),
			player(3, { status: 'LIKELY_FALL', progressPercent: -70 }),
			player(4, { status: 'UNLIKELY', progressPercent: 99 }),
			player(5, { status: 'LOCKED', progressPercent: 100 }),
		]

		assert.deepEqual(
			selectPriceChangePlayers(players, {
				scope: 'likely',
				movement: 'rise',
				locale: 'en',
			}).map(item => item.playerId),
			[2, 1],
		)
		assert.equal(
			matchesPriceChangePlayer(players[3]!, { scope: 'likely' }),
			false,
		)
		assert.equal(
			matchesPriceChangePlayer(players[4]!, { scope: 'all', movement: 'locked' }),
			true,
		)
	})

	it('puts likely-to-change squad players first in the default view', () => {
		const players = [
			player(4, { status: 'UNLIKELY', progressPercent: 95 }),
			player(3, { status: 'LIKELY_RISE', progressPercent: 30 }),
			player(2, { status: 'LIKELY_FALL', progressPercent: -80 }),
			player(1, { status: 'VERY_LIKELY_RISE', progressPercent: 20 }),
		]

		assert.deepEqual(
			sortPriceChangePlayers(players, {
				sort: DEFAULT_PRICE_CHANGE_SORT,
				squadElementIds: new Set([3]),
			}).map(item => item.playerId),
			[3, 2, 1, 4],
		)
	})

	it('sorts the table columns without mutating the source list', () => {
		const players = [
			player(1, { currentPrice: 80, transfersInEvent: 10 }),
			player(2, { currentPrice: 100, transfersInEvent: 50 }),
		]
		const sorted = sortPriceChangePlayers(players, {
			sort: { column: 'price', direction: 'desc' },
		})

		assert.deepEqual(sorted.map(item => item.playerId), [2, 1])
		assert.deepEqual(players.map(item => item.playerId), [1, 2])
	})

	it('sorts selling prices using the FPL half-profit rule', () => {
		const players = [
			player(1, { currentPrice: 80 }),
			player(2, { currentPrice: 80 }),
		]
		const sorted = sortPriceChangePlayers(players, {
			sort: { column: 'sellingPrice', direction: 'desc' },
			purchasePrices: { '1': 60, '2': 70 },
		})

		assert.deepEqual(sorted.map(item => item.playerId), [2, 1])
	})
})
