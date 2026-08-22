import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildPersonalPurchasePrices,
	calculateSellingPrice,
} from '../lib/price-change-personal'
import type { MyFplTeamTransfers } from '../lib/graphql/operations/my-fpl'
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

const transfers: MyFplTeamTransfers = {
	state: 'READY',
	context: {
		season: '2026/27',
		coreRevision: 'test',
		currentEventId: 2,
		nextEventId: 3,
		latestFinalizedEventId: 2,
	},
	gameweeks: [
		{
			eventId: 1,
			eventTransfers: 1,
			eventTransfersCost: 0,
			transfers: [
				{
					eventId: 1,
					elementInWebName: 'Example',
					elementInTypeName: 'MIDFIELDER',
					elementInTeamShortName: 'TST',
					elementInCost: 70,
					elementOutWebName: 'Other',
					elementOutTypeName: 'MIDFIELDER',
					elementOutTeamShortName: 'OTH',
					elementOutCost: 60,
					time: '2026-08-01T10:00:00.000Z',
				},
			],
		},
		{
			eventId: 2,
			eventTransfers: 1,
			eventTransfersCost: 0,
			transfers: [
				{
					eventId: 2,
					elementInWebName: 'Example',
					elementInTypeName: 'MIDFIELDER',
					elementInTeamShortName: 'TST',
					elementInCost: 75,
					elementOutWebName: 'Other',
					elementOutTypeName: 'MIDFIELDER',
					elementOutTeamShortName: 'OTH',
					elementOutCost: 60,
					time: '2026-08-08T10:00:00.000Z',
				},
			],
		},
	],
}

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
			transfers,
			historyChips: new Map(),
		})
		assert.equal(result.state, 'READY')
		assert.equal(result.purchasePrices['101'], 75)
	})

	it('does not let a Free Hit replace a permanent purchase price', () => {
		const result = buildPersonalPurchasePrices({
			picks: [pick],
			startPrices: [{ elementId: 101, startPrice: 60 }],
			transfers,
			historyChips: new Map([[1, 'FREE_HIT']]),
		})
		assert.equal(result.purchasePrices['101'], 75)
	})

	it('uses the start price when no transfer is available', () => {
		const result = buildPersonalPurchasePrices({
			picks: [pick],
			startPrices: [{ elementId: 101, startPrice: 60 }],
		})
		assert.equal(result.state, 'READY')
		assert.equal(result.purchasePrices['101'], 60)
	})
})
