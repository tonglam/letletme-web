import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
	PriceChangeBoard,
	PriceChangePlayer
} from '../lib/graphql/operations/price-changes'
import type { MarketPriceChange } from '../lib/graphql/operations/market'
import { buildHomePriceChangePredictionState } from '../lib/home-price-change'
import {
	isPriceChangeObservedEventAtLeastAsNew,
	mapLatestPriceChangeEvent
} from '../lib/price-change-observed'

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
	it('maps the same observed event with complete counts for both consumers', () => {
		const players = Array.from({ length: 7 }, (_, index) => player(index + 1))
		const marketPlayer = (id: number) => ({
			playerId: id,
			playerCode: id,
			webName: `Player ${id}`,
			teamId: id,
			teamName: `Team ${id}`,
			teamShortName: `T${id}`,
			position: 'MIDFIELDER' as const,
			price: 50,
			selectedByPercent: 0
		})
		const change = (
			id: number,
			direction: MarketPriceChange['direction']
		): MarketPriceChange => ({
			player: marketPlayer(id),
			changeDate: '2026-08-29',
			oldPrice: 50,
			newPrice: direction === 'RISE' ? 51 : 49,
			change: direction === 'RISE' ? 1 : -1,
			direction
		})
		const observed = mapLatestPriceChangeEvent({
			...board(players),
			revision: 'event-revision',
			latestEvent: {
				deadline: '2026-08-29T00:00:00.000Z',
				changeDate: '2026-08-29',
				observedAt: '2026-08-29T00:00:03.000Z',
				outcome: 'CHANGED',
				changedPlayerCount: 7,
				changes: [
					change(1, 'RISE'),
					change(2, 'FALL'),
					change(3, 'FALL'),
					change(4, 'FALL'),
					change(5, 'FALL'),
					change(6, 'FALL'),
					change(7, 'FALL')
				]
			}
		})

		assert.ok(observed)
		assert.equal(observed.riseCount, 1)
		assert.equal(observed.fallCount, 6)
		assert.equal(observed.rises.length, 1)
		assert.equal(observed.falls.length, 6)
		assert.equal(observed.eventRevision, 'event-revision')
	})

	it('turns a NO_CHANGE event into an explicit empty state', () => {
		const observed = mapLatestPriceChangeEvent({
			...board([player(1)]),
			latestEvent: {
				deadline: '2026-08-29T00:00:00.000Z',
				changeDate: '2026-08-29',
				observedAt: '2026-08-29T00:00:03.000Z',
				outcome: 'NO_CHANGE',
				changedPlayerCount: 0,
				changes: []
			}
		})

		assert.deepEqual(
			observed && {
				state: observed.state,
				riseCount: observed.riseCount,
				fallCount: observed.fallCount,
				changeDate: observed.changeDate
			},
			{
				state: 'EMPTY',
				riseCount: 0,
				fallCount: 0,
				changeDate: '2026-08-29'
			}
		)
	})

	it('keeps a changed event available when prediction freshness is unavailable', () => {
		const observed = mapLatestPriceChangeEvent({
			...board([], 'UNAVAILABLE'),
			latestEvent: {
				deadline: '2026-08-29T00:00:00.000Z',
				changeDate: '2026-08-29',
				observedAt: '2026-08-29T00:00:03.000Z',
				outcome: 'CHANGED',
				changedPlayerCount: 1,
				changes: [
					{
						player: {
							playerId: 1,
							playerCode: 1,
							webName: 'Player 1',
							teamId: 1,
							teamName: 'Team 1',
							teamShortName: 'T1',
							position: 'MIDFIELDER',
							price: 50,
							selectedByPercent: 0
						},
						changeDate: '2026-08-29',
						oldPrice: 50,
						newPrice: 51,
						change: 1,
						direction: 'RISE'
					}
				]
			}
		})

		assert.equal(observed?.state, 'AVAILABLE')
		assert.deepEqual(
			observed?.rises.map(item => item.player.playerId),
			[1]
		)
	})

	it('rejects an older observed event during a refreshed render', () => {
		const current = {
			deadline: '2026-08-29T00:00:00.000Z',
			changeDate: '2026-08-29',
			observedAt: '2026-08-29T00:00:03.000Z',
			outcome: 'CHANGED' as const,
			changedPlayerCount: 1,
			changes: []
		}
		const older = { ...current, observedAt: '2026-08-29T00:00:02.000Z' }

		assert.equal(isPriceChangeObservedEventAtLeastAsNew(older, current), false)
		assert.equal(isPriceChangeObservedEventAtLeastAsNew(current, older), true)
	})

	it('keeps complete sorted likely rises and falls for home preview and full-list views', () => {
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

		const projection = buildHomePriceChangePredictionState(board(players), 'en')

		assert.equal(projection.state, 'AVAILABLE')
		assert.equal(projection.capturedAt, '2026-08-28T07:00:00.000Z')
		assert.equal(projection.riseTotal, 6)
		assert.equal(projection.fallTotal, 6)
		assert.deepEqual(
			projection.rises.map(item => item.playerId),
			[2, 4, 5, 6, 3, 1]
		)
		assert.deepEqual(
			projection.falls.map(item => item.playerId),
			[8, 10, 11, 12, 9, 7]
		)
		assert.deepEqual(
			players.map(item => item.playerId),
			[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
		)
	})

	it('preserves unavailable and empty board semantics', () => {
		assert.equal(
			buildHomePriceChangePredictionState(board([], 'UNAVAILABLE'), 'en').state,
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
