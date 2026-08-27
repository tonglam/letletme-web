import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
	PriceChangeBoard,
	PriceChangePlayer
} from '../lib/graphql/operations/price-changes'
import { buildHomePriceChangePredictionState } from '../lib/home-price-change'

function player(
	id: number,
	{
		status = 'UNLIKELY',
		progressPercent = 0,
		webName = `Player ${id}`
	}: Partial<PriceChangePlayer> = {}
): PriceChangePlayer {
	return {
		playerId: id,
		playerCode: id,
		webName,
		teamId: id,
		teamName: `Team ${id}`,
		teamShortName: `T${id}`,
		position: 'MID',
		currentPrice: 50,
		selectedByPercent: 0,
		progressPercent,
		hourlyRate: 0,
		status,
		ownershipTrend: 'FLAT',
		transfersInEvent: 0,
		transfersOutEvent: 0,
		lockedUntil: null,
		calibrating: false
	}
}

function board(
	players: PriceChangePlayer[],
	status: PriceChangeBoard['status'] = 'READY'
): PriceChangeBoard {
	return {
		status,
		source: 'FPL_BOOTSTRAP',
		deadline: '2026-08-29T10:00:00.000Z',
		nextDeadlines: [],
		fetchedAt: '2026-08-28T07:00:00.000Z',
		staleAt: '2026-08-28T07:10:00.000Z',
		revision: 'revision-1',
		expectedPlayerCount: players.length,
		observedPlayerCount: players.length,
		players
	}
}

describe('homepage price-change projection', () => {
	it('keeps the five strongest likely rises and falls from a live board', () => {
		const players = [
			player(1, { status: 'LIKELY_RISE', progressPercent: 10 }),
			player(2, { status: 'VERY_LIKELY_RISE', progressPercent: 60 }),
			player(3, { status: 'LIKELY_RISE', progressPercent: 20 }),
			player(4, { status: 'LIKELY_RISE', progressPercent: 50 }),
			player(5, { status: 'LIKELY_RISE', progressPercent: 40 }),
			player(6, { status: 'LIKELY_RISE', progressPercent: 30 }),
			player(7, { status: 'LIKELY_FALL', progressPercent: -10 }),
			player(8, { status: 'VERY_LIKELY_FALL', progressPercent: -60 }),
			player(9, { status: 'LIKELY_FALL', progressPercent: -20 }),
			player(10, { status: 'LIKELY_FALL', progressPercent: -50 }),
			player(11, { status: 'LIKELY_FALL', progressPercent: -40 }),
			player(12, { status: 'LIKELY_FALL', progressPercent: -30 }),
			player(13, { status: 'UNLIKELY', progressPercent: 99 })
		]

		const projection = buildHomePriceChangePredictionState(
			board(players),
			'en'
		)

		assert.equal(projection.state, 'AVAILABLE')
		assert.equal(projection.capturedAt, '2026-08-28T07:00:00.000Z')
		assert.deepEqual(
			projection.rises.map(item => item.playerId),
			[2, 4, 5, 6, 3]
		)
		assert.deepEqual(
			projection.falls.map(item => item.playerId),
			[8, 10, 11, 12, 9]
		)
		assert.deepEqual(
			players.map(item => item.playerId),
			[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
		)
	})

	it('preserves unavailable and empty board semantics', () => {
		assert.equal(
			buildHomePriceChangePredictionState(board([], 'UNAVAILABLE'), 'en')
				.state,
			'UNAVAILABLE'
		)
		assert.equal(
			buildHomePriceChangePredictionState(
				board([player(1, { status: 'UNLIKELY', progressPercent: 99 })]),
				'en'
			).state,
			'EMPTY'
		)
	})
})
