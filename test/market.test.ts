import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
	MarketOwnershipChange,
	MarketPlayer,
	MarketPulse
} from '../lib/graphql/operations/market'
import {
	filterMarketPlayersByPosition,
	getMarketCoverageMode,
	getMarketTeaserMode,
	getMarketViewMode,
	rankOwnershipChanges,
	shortMarketPosition
} from '../lib/market'

const player = (overrides: Partial<MarketPlayer> = {}): MarketPlayer => ({
	playerId: 1,
	playerCode: 1,
	webName: 'Player',
	teamId: 1,
	teamName: 'Club',
	teamShortName: 'CLU',
	position: 'MIDFIELDER',
	price: 75,
	selectedByPercent: 20,
	...overrides
})

const pulse = (): MarketPulse => ({
	coverage: {
		requestedDays: 7,
		observedDays: 0,
		firstDate: null,
		latestDate: null,
		capturedAt: null,
		complete: false,
		stale: false,
		missingDates: []
	},
	mostSelected: [],
	transferMovers: [],
	availabilityUpdates: [],
	availabilityHighlights: [],
	newPlayers: [],
	priceChanges: []
})

const change = (
	changePercentagePoints: number,
	playerOverrides: Partial<MarketPlayer> = {}
): MarketOwnershipChange => ({
	player: player(playerOverrides),
	fromSelectedByPercent: 20,
	toSelectedByPercent: 20 + changePercentagePoints,
	changePercentagePoints,
	fromDate: '2026-08-07',
	toDate: '2026-08-08'
})

describe('Market presentation rules', () => {
	it('uses explicit observed-day coverage labels without a legacy long-window mode', () => {
		const data = pulse()
		assert.equal(getMarketCoverageMode(data.coverage), 'empty')
		data.coverage = {
			...data.coverage,
			observedDays: 1,
			latestDate: '2026-08-03'
		}
		assert.equal(getMarketCoverageMode(data.coverage), 'one-day')
		data.coverage = { ...data.coverage, observedDays: 2 }
		assert.equal(getMarketCoverageMode(data.coverage), 'tracking')
	})

	it('keeps the non-ownership teaser modes independent from ownership periods', () => {
		const data = pulse()
		assert.equal(getMarketTeaserMode(data), 'empty')
		data.mostSelected = [player()]
		assert.equal(getMarketTeaserMode(data), 'selected')
		data.priceChanges = [
			{
				player: player(),
				changeDate: '2026-08-03',
				oldPrice: 74,
				newPrice: 75,
				change: 1,
				direction: 'RISE'
			}
		]
		assert.equal(getMarketTeaserMode(data), 'price')
	})

	it('shows ownership as the page lead only when the selected period has evidence', () => {
		const data = pulse()
		assert.equal(getMarketViewMode(data), 'baseline')
		assert.equal(getMarketViewMode(data, true), 'ownership-led')
		data.availabilityHighlights = [
			{
				player: player(),
				status: 'i',
				previousStatus: 'a',
				news: 'Injured',
				newsAdded: null,
				observedDate: '2026-08-08',
				chanceOfPlayingThisRound: 0,
				chanceOfPlayingNextRound: 0
			}
		]
		assert.equal(getMarketViewMode(data, true), 'availability-led')
	})

	it('ranks ownership swings by percentage-point magnitude and maps position labels', () => {
		const ranked = rankOwnershipChanges(
			[change(2)],
			[change(-4, { playerId: 2, webName: 'B' })]
		)
		assert.deepEqual(
			ranked.map(item => item.changePercentagePoints),
			[-4, 2]
		)
		assert.equal(shortMarketPosition('GOALKEEPER'), 'GKP')
		assert.equal(shortMarketPosition('DEFENDER'), 'DEF')
		assert.equal(shortMarketPosition('MIDFIELDER'), 'MID')
		assert.equal(shortMarketPosition('FORWARD'), 'FWD')
		assert.equal(shortMarketPosition('GKP'), 'GKP')
		assert.equal(shortMarketPosition('DEF'), 'DEF')
		assert.equal(shortMarketPosition('MID'), 'MID')
		assert.equal(shortMarketPosition('FWD'), 'FWD')
	})

	it('filters the most-selected list by one position without changing source order', () => {
		const players = [
			player({ playerId: 1, position: 'MIDFIELDER' }),
			player({ playerId: 2, position: 'DEFENDER' }),
			player({ playerId: 3, position: 'MIDFIELDER' })
		]
		assert.deepEqual(
			filterMarketPlayersByPosition(players, 'MIDFIELDER').map(
				item => item.playerId
			),
			[1, 3]
		)
		assert.deepEqual(
			filterMarketPlayersByPosition(players, 'ALL').map(item => item.playerId),
			[1, 2, 3]
		)
	})
})
