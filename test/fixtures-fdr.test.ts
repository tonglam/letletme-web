import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildFdrReviewBuckets,
	buildSquadFdrRows,
	buildTeamFdrRows,
	classifySquadFixtureBand,
	collectMarketSignals,
	FDR_ACTION_THRESHOLDS,
	getTeamTierIds,
	sortSquadForPlanning,
	squadMatchKey
} from '../lib/fixtures-fdr'
import { buildMarketCompareCandidates } from '../lib/market-compare'
import type { Fixture } from '../lib/graphql/operations/events'
import type {
	FixturePlanningMarketSignals,
	MarketOwnershipChange,
	MarketOwnershipOverview,
	MarketPlayer
} from '../lib/graphql/operations/market'

function fx(partial: {
	eventId: number
	homeId: number
	home: string
	awayId: number
	away: string
	hFdr: number
	aFdr: number
	finished?: boolean
	fixtureId?: number
}): Fixture {
	return {
		id: partial.fixtureId ?? partial.eventId * 100 + partial.homeId,
		code: 1,
		event: { id: partial.eventId, name: `GW${partial.eventId}` },
		kickoffTime: '2026-03-08T15:00:00.000Z',
		finished: partial.finished ?? false,
		started: false,
		homeTeam: {
			id: partial.homeId,
			name: partial.home,
			shortName: partial.home
		},
		awayTeam: {
			id: partial.awayId,
			name: partial.away,
			shortName: partial.away
		},
		homeScore: null,
		awayScore: null,
		homeTeamDifficulty: partial.hFdr,
		awayTeamDifficulty: partial.aFdr
	}
}

function mp(
	partial: Partial<MarketPlayer> & {
		playerId: number
		teamId: number
		webName: string
	}
): MarketPlayer {
	return {
		playerCode: partial.playerId,
		teamName: 'Team',
		teamShortName: partial.teamShortName ?? 'TMA',
		position: 'MIDFIELDER',
		price: 70,
		selectedByPercent: 10,
		...partial
	}
}

function ownershipOverview(
	period: 'GAMEWEEK' | 'ROLLING_7D',
	risers: MarketOwnershipChange[] = [],
	fallers: MarketOwnershipChange[] = []
): MarketOwnershipOverview {
	return {
		period,
		gameweek: null,
		coverage: {
			status: 'READY',
			requestedDays: period === 'ROLLING_7D' ? 7 : 2,
			observedDays: period === 'ROLLING_7D' ? 7 : 2,
			firstDate: '2026-08-01',
			latestDate: '2026-08-08',
			fromDate: '2026-08-01',
			toDate: '2026-08-08',
			missingDates: [],
			capturedAt: '2026-08-08T12:00:00.000Z',
			complete: true,
			stale: false
		},
		risers,
		fallers
	}
}

function marketSignals(
	mostSelected: FixturePlanningMarketSignals['mostSelected'] = [],
	risers: MarketOwnershipChange[] = [],
	fallers: MarketOwnershipChange[] = []
): FixturePlanningMarketSignals {
	return {
		mostSelected,
		transferMovers: [],
		gameweekOwnership: ownershipOverview('GAMEWEEK', risers, fallers),
		rollingOwnership: ownershipOverview('ROLLING_7D')
	}
}

describe('buildTeamFdrRows', () => {
	it('averages team-perspective FDR and ranks easiest first', () => {
		const map = new Map<number, Fixture[]>()
		// GW28: ARS(home fdr2) vs CHE(away fdr4); LIV(home fdr5) vs EVE(away fdr1)
		map.set(28, [
			fx({
				eventId: 28,
				homeId: 1,
				home: 'ARS',
				awayId: 2,
				away: 'CHE',
				hFdr: 2,
				aFdr: 4
			}),
			fx({
				eventId: 28,
				homeId: 3,
				home: 'LIV',
				awayId: 4,
				away: 'EVE',
				hFdr: 5,
				aFdr: 1
			})
		])
		// GW29: ARS away fdr2, CHE home fdr3, etc.
		map.set(29, [
			fx({
				eventId: 29,
				homeId: 2,
				home: 'CHE',
				awayId: 1,
				away: 'ARS',
				hFdr: 3,
				aFdr: 2
			}),
			fx({
				eventId: 29,
				homeId: 4,
				home: 'EVE',
				awayId: 3,
				away: 'LIV',
				hFdr: 2,
				aFdr: 4
			})
		])

		const rows = buildTeamFdrRows(map, 28, 2)
		assert.ok(rows.length >= 4)
		// EVE: away 1 + home 2 = avg 1.5 — easiest
		const eve = rows.find(r => r.teamShortName === 'EVE')
		assert.ok(eve)
		assert.equal(eve!.avgFdr, 1.5)
		// LIV: home 5 + away 4 = avg 4.5
		const liv = rows.find(r => r.teamShortName === 'LIV')
		assert.ok(liv)
		assert.equal(liv!.avgFdr, 4.5)
		// Sorted easiest first
		assert.ok((rows[0]!.avgFdr ?? 99) <= (rows[rows.length - 1]!.avgFdr ?? 99))
	})

	it('keeps every DGW fixture and models a BGW as an empty gameweek', () => {
		const map = new Map<number, Fixture[]>([
			[
				28,
				[
					fx({
						fixtureId: 2801,
						eventId: 28,
						homeId: 1,
						home: 'ARS',
						awayId: 2,
						away: 'CHE',
						hFdr: 2,
						aFdr: 4
					}),
					fx({
						fixtureId: 2802,
						eventId: 28,
						homeId: 3,
						home: 'LIV',
						awayId: 1,
						away: 'ARS',
						hFdr: 3,
						aFdr: 4
					})
				]
			],
			[29, []]
		])
		const rows = buildTeamFdrRows(map, 28, 2, [
			{ id: 1, name: 'Arsenal', shortName: 'ARS' },
			{ id: 2, name: 'Chelsea', shortName: 'CHE' },
			{ id: 3, name: 'Liverpool', shortName: 'LIV' }
		])
		const arsenal = rows.find(row => row.teamId === 1)
		assert.ok(arsenal)
		assert.equal(arsenal.gameweeks.length, 2)
		assert.equal(arsenal.gameweeks[0]!.dgw, true)
		assert.equal(arsenal.gameweeks[0]!.fixtures.length, 2)
		assert.equal(arsenal.gameweeks[1]!.bgw, true)
		assert.equal(arsenal.run.length, 2)
		assert.equal(arsenal.avgFdr, 3)
	})

	it('does not turn an unavailable GW response into a blank gameweek', () => {
		const rows = buildTeamFdrRows(
			new Map<number, Fixture[]>([
				[28, []],
				[29, []]
			]),
			28,
			2,
			[{ id: 1, name: 'Arsenal', shortName: 'ARS' }],
			new Set([29])
		)
		const arsenal = rows.find(row => row.teamId === 1)
		assert.ok(arsenal)
		assert.equal(arsenal!.gameweeks[0]!.bgw, true)
		assert.equal(arsenal!.gameweeks[1]!.unknown, true)
		assert.equal(arsenal!.gameweeks[1]!.bgw, false)
		assert.equal(arsenal!.unknownCount, 1)
	})
})

describe('buildFdrReviewBuckets', () => {
	it('builds mutually exclusive favourable and difficult review groups', () => {
		const map = new Map<number, Fixture[]>()
		// 8 teams with graded difficulty so tier top/bottom 6 work
		const teams = [
			{ id: 1, s: 'T1', fdr: 1 },
			{ id: 2, s: 'T2', fdr: 1 },
			{ id: 3, s: 'T3', fdr: 2 },
			{ id: 4, s: 'T4', fdr: 2 },
			{ id: 5, s: 'T5', fdr: 2 },
			{ id: 6, s: 'T6', fdr: 2 },
			{ id: 7, s: 'T7', fdr: 4 },
			{ id: 8, s: 'T8', fdr: 5 },
			{ id: 9, s: 'T9', fdr: 5 },
			{ id: 10, s: 'T10', fdr: 5 },
			{ id: 11, s: 'T11', fdr: 5 },
			{ id: 12, s: 'T12', fdr: 5 }
		]
		// Pair 1-2, 3-4, ... so each has one fixture with matching home fdr
		const fixtures: Fixture[] = []
		for (let i = 0; i < teams.length; i += 2) {
			const h = teams[i]!
			const a = teams[i + 1]!
			fixtures.push(
				fx({
					eventId: 28,
					homeId: h.id,
					home: h.s,
					awayId: a.id,
					away: a.s,
					hFdr: h.fdr,
					aFdr: a.fdr
				})
			)
		}
		map.set(28, fixtures)
		const rows = buildTeamFdrRows(map, 28, 1)

		const signals = [
			// easy team T1, low owned → differential favourable
			{
				playerId: 101,
				webName: 'DiffBoy',
				teamId: 1,
				teamShortName: 'T1',
				position: 'MIDFIELDER',
				price: 55,
				selectedByPercent: 5,
				source: 'riser' as const
			},
			// easy team T1, high owned → popular favourable
			{
				playerId: 102,
				webName: 'Template',
				teamId: 1,
				teamShortName: 'T1',
				position: 'FORWARD',
				price: 90,
				selectedByPercent: 40,
				source: 'most-selected' as const
			},
			// hard team T8, premium → popular difficult
			{
				playerId: 103,
				webName: 'Premium',
				teamId: 8,
				teamShortName: 'T8',
				position: 'MIDFIELDER',
				price: FDR_ACTION_THRESHOLDS.premiumPriceTenths + 10,
				selectedByPercent: 12,
				source: 'most-selected' as const
			}
		]

		const buckets = buildFdrReviewBuckets(rows, signals)
		assert.ok(buckets.differentialFavourable.some(p => p.webName === 'DiffBoy'))
		assert.ok(buckets.popularFavourable.some(p => p.webName === 'Template'))
		assert.ok(buckets.popularDifficult.some(p => p.webName === 'Premium'))
		const allIds = [
			...buckets.differentialFavourable,
			...buckets.popularFavourable,
			...buckets.popularDifficult
		].map(player => player.playerId)
		assert.equal(new Set(allIds).size, allIds.length)
	})
})

describe('collectMarketSignals', () => {
	it('dedupes by player id', () => {
		const selected = mp({
			playerId: 1,
			teamId: 1,
			webName: 'A',
			selectedByPercent: 50
		})
		const signals = collectMarketSignals(
			marketSignals(
				[selected],
				[
					{
						player: selected,
						fromSelectedByPercent: 40,
						toSelectedByPercent: 48,
						changePercentagePoints: 8,
						fromDate: '2026-08-07',
						toDate: '2026-08-08'
					}
				],
				[]
			)
		)
		assert.equal(signals.length, 1)
		assert.equal(signals[0]!.selectedByPercent, 50)
	})
})

describe('squadMatchKey', () => {
	it('normalizes case and whitespace for entry ↔ market matching', () => {
		assert.equal(squadMatchKey(' Salah ', 'LIV'), 'salah|liv')
		assert.equal(squadMatchKey('Salah', 'LIV'), squadMatchKey('salah', 'liv'))
	})
})

describe('buildSquadFdrRows', () => {
	it('maps picks to neutral team fixture bands', () => {
		const map = new Map<number, Fixture[]>()
		map.set(28, [
			fx({
				eventId: 28,
				homeId: 1,
				home: 'ARS',
				awayId: 2,
				away: 'CHE',
				hFdr: 2,
				aFdr: 4
			}),
			fx({
				eventId: 28,
				homeId: 3,
				home: 'LIV',
				awayId: 4,
				away: 'EVE',
				hFdr: 5,
				aFdr: 1
			})
		])
		const teams = buildTeamFdrRows(map, 28, 1)
		const rows = buildSquadFdrRows(
			[
				{
					elementId: 10,
					webName: 'Salah',
					teamShortName: 'LIV',
					elementTypeName: 'MIDFIELDER',
					position: 8,
					multiplier: 2,
					isCaptain: true,
					isViceCaptain: false
				},
				{
					elementId: 11,
					webName: 'Saka',
					teamShortName: 'ARS',
					elementTypeName: 'MIDFIELDER',
					position: 12,
					multiplier: 0,
					isCaptain: false,
					isViceCaptain: false
				}
			],
			teams
		)
		assert.equal(rows.length, 2)
		const salah = rows.find(r => r.webName === 'Salah')
		assert.ok(salah)
		assert.equal(salah!.fixtureBand, 'difficult')
		assert.equal(salah!.isStarter, true)
		const saka = rows.find(r => r.webName === 'Saka')
		assert.ok(saka)
		assert.equal(saka!.fixtureBand, 'favourable')
	})

	it('sorts by FPL position 1–15', () => {
		const rows = sortSquadForPlanning([
			{
				elementId: 1,
				teamId: 1,
				webName: 'A',
				teamShortName: 'AAA',
				elementTypeName: 'MIDFIELDER',
				positionCode: 'MID',
				position: 12,
				isStarter: false,
				isCaptain: false,
				isViceCaptain: false,
				avgFdr: 2,
				easyCount: 1,
				hardCount: 0,
				blankCount: 0,
				nextFdr: 2,
				nextOpponent: 'X',
				nextHome: true,
				gameweeks: [],
				run: [],
				fixtureBand: 'mixed'
			},
			{
				elementId: 2,
				teamId: 2,
				webName: 'B',
				teamShortName: 'BBB',
				elementTypeName: 'MIDFIELDER',
				positionCode: 'MID',
				position: 3,
				isStarter: true,
				isCaptain: false,
				isViceCaptain: false,
				avgFdr: 4,
				easyCount: 0,
				hardCount: 1,
				blankCount: 0,
				nextFdr: 4,
				nextOpponent: 'Y',
				nextHome: false,
				gameweeks: [],
				run: [],
				fixtureBand: 'difficult'
			}
		])
		assert.equal(rows[0]!.webName, 'B')
		assert.equal(rows[0]!.position, 3)
		assert.equal(rows[1]!.webName, 'A')
		assert.equal(rows[1]!.position, 12)
	})
})

describe('classifySquadFixtureBand', () => {
	it('labels easy and hard runs neutrally and gives blanks precedence', () => {
		const map = new Map<number, Fixture[]>([
			[
				28,
				[
					fx({
						eventId: 28,
						homeId: 1,
						home: 'ARS',
						awayId: 2,
						away: 'LIV',
						hFdr: 2,
						aFdr: 5
					})
				]
			]
		])
		const teams = buildTeamFdrRows(map, 28, 1)
		const tiers = getTeamTierIds(teams)
		assert.equal(
			classifySquadFixtureBand({ teamId: 1, blankCount: 0 }, tiers),
			'favourable'
		)
		assert.equal(
			classifySquadFixtureBand({ teamId: 2, blankCount: 0 }, tiers),
			'difficult'
		)
		assert.equal(
			classifySquadFixtureBand({ teamId: 1, blankCount: 1 }, tiers),
			'blank'
		)
	})
})

describe('buildMarketCompareCandidates', () => {
	it('includes favourable review candidates with position codes', () => {
		const map = new Map<number, Fixture[]>()
		map.set(28, [
			fx({
				eventId: 28,
				homeId: 1,
				home: 'ARS',
				awayId: 2,
				away: 'CHE',
				hFdr: 1,
				aFdr: 5
			})
		])
		const teams = buildTeamFdrRows(map, 28, 1)
		const signals = collectMarketSignals(
			marketSignals([
				mp({
					playerId: 99,
					teamId: 1,
					webName: 'Saka',
					teamShortName: 'ARS',
					position: 'MIDFIELDER',
					selectedByPercent: 30
				})
			])
		)
		const buckets = buildFdrReviewBuckets(teams, signals)
		const candidates = buildMarketCompareCandidates({
			fromGw: 28,
			horizon: 3,
			teams,
			easiest: teams,
			hardest: teams,
			candidates: buckets
		})
		assert.ok(
			candidates.some(c => c.playerId === 99 && c.positionCode === 'MID')
		)
	})
})
