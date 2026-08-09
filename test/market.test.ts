import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { MarketPulse } from '../lib/graphql/operations/market'
import {
	getMarketCoverageMode,
	getMarketTeaserMode,
	getMarketViewMode,
	rankOwnershipMovers,
	shortMarketPosition,
} from '../lib/market'

const pulse = (): MarketPulse => ({
	coverage: {
		requestedDays: 14,
		observedDays: 0,
		firstDate: null,
		latestDate: null,
		capturedAt: null,
		complete: false,
		stale: false,
	},
	mostSelected: [],
	ownershipMovers: { risers: [], fallers: [] },
	transferMovers: [],
	availabilityUpdates: [],
	availabilityHighlights: [],
	newPlayers: [],
	priceChanges: [],
})

describe('Market presentation rules', () => {
	it('uses honest coverage labels before fourteen observations', () => {
		const data = pulse()
		assert.equal(getMarketCoverageMode(data.coverage), 'empty')
		data.coverage = { ...data.coverage, observedDays: 1, latestDate: '2026-08-03' }
		assert.equal(getMarketCoverageMode(data.coverage), 'one-day')
		data.coverage = { ...data.coverage, observedDays: 13 }
		assert.equal(getMarketCoverageMode(data.coverage), 'tracking')
		data.coverage = { ...data.coverage, observedDays: 14 }
		assert.equal(getMarketCoverageMode(data.coverage), 'last-14-days')
	})

	it('prioritises price, then ownership, then most-selected content', () => {
		const data = pulse()
		assert.equal(getMarketTeaserMode(data), 'empty')
		data.mostSelected = [{
			playerId: 1, playerCode: 1, webName: 'Player', teamId: 1,
			teamName: 'Club', teamShortName: 'CLU', position: 'MIDFIELDER',
			price: 75, selectedByPercent: 20,
		}]
		assert.equal(getMarketTeaserMode(data), 'selected')
		data.ownershipMovers.risers = [{
			player: data.mostSelected[0], previousSelectedByPercent: 19,
			selectedByPercent: 20, change: 1,
		}]
		assert.equal(getMarketTeaserMode(data), 'ownership')
		data.priceChanges = [{
			player: data.mostSelected[0], changeDate: '2026-08-03',
			oldPrice: 74, newPrice: 75, change: 1, direction: 'RISE',
		}]
		assert.equal(getMarketTeaserMode(data), 'price')
	})

	it('selects price, availability, ownership, then baseline as the page lead', () => {
		const data = pulse()
		assert.equal(getMarketViewMode(data), 'baseline')
		const player = {
			playerId: 1, playerCode: 1, webName: 'Player', teamId: 1,
			teamName: 'Club', teamShortName: 'CLU', position: 'MIDFIELDER' as const,
			price: 75, selectedByPercent: 20,
		}
		data.ownershipMovers.risers = [{
			player, previousSelectedByPercent: 19, selectedByPercent: 20, change: 1,
		}]
		assert.equal(getMarketViewMode(data), 'ownership-led')
		data.availabilityHighlights = [{
			player, status: 'i', previousStatus: 'a', news: 'Injured',
			newsAdded: null, observedDate: '2026-08-08',
			chanceOfPlayingThisRound: 0, chanceOfPlayingNextRound: 0,
		}]
		assert.equal(getMarketViewMode(data), 'availability-led')
		data.priceChanges = [{
			player, changeDate: '2026-08-08', oldPrice: 74, newPrice: 75,
			change: 1, direction: 'RISE',
		}]
		assert.equal(getMarketViewMode(data), 'price-led')
	})

	it('ranks ownership swings by magnitude and maps position labels', () => {
		const data = pulse()
		const player = {
			playerId: 1, playerCode: 1, webName: 'A', teamId: 1, teamName: 'Club',
			teamShortName: 'CLU', position: 'DEFENDER' as const, price: 50,
			selectedByPercent: 10,
		}
		const ranked = rankOwnershipMovers(
			[{ player, previousSelectedByPercent: 8, selectedByPercent: 10, change: 2 }],
			[{ player: { ...player, playerId: 2, webName: 'B' }, previousSelectedByPercent: 14, selectedByPercent: 10, change: -4 }],
		)
		assert.deepEqual(ranked.map(item => item.change), [-4, 2])
		assert.equal(shortMarketPosition('GOALKEEPER'), 'GKP')
		assert.equal(shortMarketPosition('DEFENDER'), 'DEF')
		assert.equal(shortMarketPosition('MIDFIELDER'), 'MID')
		assert.equal(shortMarketPosition('FORWARD'), 'FWD')
	})
})
