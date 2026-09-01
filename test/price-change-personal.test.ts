import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildPersonalPurchasePrices,
	calculateSellingPrice,
	type PersonalPriceReview,
} from '../lib/price-change-personal'
import type { SquadPickSeed } from '../lib/squad-picks'

const pick: SquadPickSeed = {
	elementId: 101,
	webName: 'Example',
	teamShortName: 'TST',
	elementTypeName: 'MIDFIELDER',
	position: 1,
	multiplier: 1,
	isCaptain: false,
	isViceCaptain: false,
}

const review = (freeHitEvents: number[] = []): PersonalPriceReview => ({
	timeline: [1, 2].map(eventId => ({
		eventId,
		eventChip: freeHitEvents.includes(eventId) ? 'FREE_HIT' : 'NONE',
	})),
	transfers: [
		{
			eventId: 1,
			transfers: [
				{
					elementIn: 101,
					elementInCost: 70,
					time: '2026-08-01T10:00:00.000Z',
				},
			],
		},
		{
			eventId: 2,
			transfers: [
				{
					elementIn: 101,
					elementInCost: 75,
					time: '2026-08-08T10:00:00.000Z',
				},
			],
		},
	],
})

describe('calculateSellingPrice', () => {
	it('passes through losses and shares gains rounded down', () => {
		assert.equal(calculateSellingPrice(60, 58), 58)
		assert.equal(calculateSellingPrice(60, 64), 62)
		assert.equal(calculateSellingPrice(60, 63), 61)
	})
})

describe('buildPersonalPurchasePrices', () => {
	it('uses the latest mapped transfer cost and falls back to start price', () => {
		const result = buildPersonalPurchasePrices({
			picks: [pick],
			startPrices: [{ elementId: 101, startPrice: 60 }],
			review: review(),
		})
		assert.equal(result.state, 'READY')
		assert.equal(result.purchasePrices['101'], 75)
	})

	it('does not let a Free Hit replace a permanent purchase price', () => {
		const result = buildPersonalPurchasePrices({
			picks: [pick],
			startPrices: [{ elementId: 101, startPrice: 60 }],
			review: review([1]),
		})
		assert.equal(result.purchasePrices['101'], 75)
	})

	it('uses the start price when no transfer is available', () => {
		const result = buildPersonalPurchasePrices({
			picks: [pick],
			startPrices: [{ elementId: 101, startPrice: 60 }],
			review: null,
		})
		assert.equal(result.state, 'READY')
		assert.equal(result.purchasePrices['101'], 60)
	})
})
