import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { deriveLiveAutoSubProjection } from '../app/live/points/_lib/live-auto-subs'
import { mapLiveDataToPlayers } from '../app/live/points/_lib/live-points-model'
import type {
	LiveCalcData,
	LiveManagerScore,
	LivePick
} from '../lib/graphql/operations/live'

const makePick = (
	seed: Pick<
		LivePick,
		| 'element'
		| 'elementType'
		| 'position'
		| 'webName'
		| 'minutes'
		| 'totalPoints'
		| 'multiplier'
	> &
		Partial<LivePick>
): LivePick => ({
	teamName: 'Test',
	teamShortName: 'TST',
	goalsScored: 0,
	assists: 0,
	cleanSheets: 0,
	goalsConceded: 0,
	defensiveContribution: 0,
	ownGoals: 0,
	penaltiesSaved: 0,
	penaltiesMissed: 0,
	yellowCards: 0,
	redCards: 0,
	saves: 0,
	bonus: 0,
	bps: 0,
	starts: seed.minutes > 0,
	isGwStarted: true,
	isGwFinished: true,
	isPlayed: seed.minutes > 0,
	isCaptain: false,
	isViceCaptain: false,
	multiplier: seed.multiplier,
	pickActive: (seed.multiplier ?? 0) > 0,
	autoSub: false,
	bgw: false,
	expectedGoals: null,
	expectedAssists: null,
	expectedGoalInvolvements: null,
	expectedGoalsConceded: null,
	inDreamTeam: false,
	...seed
})

const liveScore = (
	eventPoints: number,
	state: LiveManagerScore['state'] = 'FRESH'
): LiveManagerScore => ({
	eventPoints,
	netEventPoints: eventPoints,
	totalPoints: eventPoints,
	totalScope: 'OVERALL',
	eventRank: null,
	overallRank: 1,
	leagueRank: null,
	transferCost: 0,
	source: state === 'FINAL' ? 'FPL_FINAL_RESULT' : 'FPL_EVENT_LIVE',
	state,
	eventPointSemantics: 'GROSS',
	revision: 'live:test',
	checkedAt: '2026-08-25T00:00:00.000Z',
	upstreamUpdatedAt: null,
	staleAt: null,
	nextRefreshAt: null,
	reconciliation: 'MATCHED',
	reasonCodes: []
})

const samplePicks = (): LivePick[] => [
	makePick({
		element: 1,
		elementType: 1,
		position: 1,
		webName: 'Raya',
		minutes: 90,
		totalPoints: 6,
		multiplier: 1,
		isViceCaptain: true
	}),
	makePick({
		element: 2,
		elementType: 2,
		position: 2,
		webName: 'Pedro Porro',
		minutes: 0,
		totalPoints: 0,
		multiplier: 1
	}),
	makePick({
		element: 3,
		elementType: 2,
		position: 3,
		webName: 'Mosquera',
		minutes: 90,
		totalPoints: 6,
		multiplier: 1
	}),
	makePick({
		element: 4,
		elementType: 2,
		position: 4,
		webName: 'Virgil',
		minutes: 90,
		totalPoints: 2,
		multiplier: 1
	}),
	makePick({
		element: 5,
		elementType: 3,
		position: 5,
		webName: 'Sarr',
		minutes: 0,
		totalPoints: 0,
		multiplier: 1
	}),
	makePick({
		element: 6,
		elementType: 3,
		position: 6,
		webName: 'Mbeumo',
		minutes: 90,
		totalPoints: 2,
		multiplier: 1
	}),
	makePick({
		element: 7,
		elementType: 3,
		position: 7,
		webName: 'Wirtz',
		minutes: 62,
		totalPoints: 2,
		multiplier: 1
	}),
	makePick({
		element: 8,
		elementType: 3,
		position: 8,
		webName: 'Tzolis',
		minutes: 75,
		totalPoints: 6,
		multiplier: 1
	}),
	makePick({
		element: 9,
		elementType: 4,
		position: 9,
		webName: 'Haaland',
		minutes: 90,
		totalPoints: 2,
		multiplier: 2,
		isCaptain: true
	}),
	makePick({
		element: 10,
		elementType: 4,
		position: 10,
		webName: 'Joao Pedro',
		minutes: 45,
		totalPoints: 7,
		multiplier: 1
	}),
	makePick({
		element: 11,
		elementType: 4,
		position: 11,
		webName: 'Brobbey',
		minutes: 66,
		totalPoints: 2,
		multiplier: 1
	}),
	makePick({
		element: 12,
		elementType: 1,
		position: 12,
		webName: 'Palmer',
		minutes: 0,
		totalPoints: 0,
		multiplier: 0
	}),
	makePick({
		element: 13,
		elementType: 3,
		position: 13,
		webName: 'Wilson',
		minutes: 65,
		totalPoints: 3,
		multiplier: 0
	}),
	makePick({
		element: 14,
		elementType: 2,
		position: 14,
		webName: 'Diop',
		minutes: 90,
		totalPoints: 2,
		multiplier: 0
	}),
	makePick({
		element: 15,
		elementType: 2,
		position: 15,
		webName: 'van Ewijk',
		minutes: 90,
		totalPoints: 1,
		multiplier: 0
	})
]

const sampleLive = (
	pickList = samplePicks(),
	overrides: Partial<LiveCalcData> = {}
): LiveCalcData => ({
	entry: 3789259,
	event: 1,
	entryName: 'Lord Bendtner',
	playerName: 'Yabo Zhou',
	chip: 'NONE',
	score: liveScore(37),
	livePoints: 37,
	transferCost: 0,
	liveNetPoints: 37,
	liveTotalPoints: 37,
	captainName: 'Haaland',
	pickList,
	...overrides
})

describe('live automatic substitutions', () => {
	it('uses bench order while preserving a legal FPL formation', () => {
		const projection = deriveLiveAutoSubProjection(sampleLive())

		assert.equal(projection.state, 'PREDICTED')
		assert.deepEqual(
			projection.substitutions.map(substitution => [
				substitution.playerInName,
				substitution.playerOutName
			]),
			[
				['Wilson', 'Sarr'],
				['Diop', 'Pedro Porro']
			]
		)
		assert.equal(projection.effectivePositions['13'], 5)
		assert.equal(projection.effectivePositions['5'], 13)
		assert.equal(projection.effectivePositions['14'], 2)
		assert.equal(projection.effectivePositions['2'], 14)
	})

	it('triggers for one confirmed starter without waiting for the other starters or the GW', () => {
		const picks = samplePicks().map(pick =>
			pick.webName === 'Pedro Porro' ? { ...pick, isGwFinished: false } : pick
		)
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.deepEqual(
			projection.substitutions.map(substitution => [
				substitution.playerInName,
				substitution.playerOutName
			]),
			[['Wilson', 'Sarr']]
		)
		assert.equal(projection.activePlayerIds.includes('2'), true)
	})

	it('still replaces a zero-minute no-show whose derived isPlayed flag comes from a card', () => {
		const picks = samplePicks().map(pick =>
			pick.webName === 'Sarr'
				? { ...pick, isPlayed: true, yellowCards: 1 }
				: pick
		)
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.equal(
			projection.substitutions.some(
				substitution =>
					substitution.playerInName === 'Wilson' &&
					substitution.playerOutName === 'Sarr'
			),
			true
		)
	})

	it("does not remove a zero-minute starter before that player's fixtures end", () => {
		const picks = samplePicks().map(pick =>
			pick.position <= 11 && pick.minutes === 0
				? { ...pick, isGwFinished: false }
				: pick
		)
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.equal(projection.state, 'NONE')
		assert.deepEqual(projection.substitutions, [])
	})

	it('puts the first eligible bench player into the XI even before their fixture starts', () => {
		const picks = samplePicks().map(pick => {
			if (pick.webName === 'Pedro Porro') {
				return { ...pick, minutes: 90, totalPoints: 2 }
			}
			if (pick.webName === 'Wilson') {
				return {
					...pick,
					minutes: 0,
					totalPoints: 0,
					isGwStarted: false,
					isGwFinished: false,
					isPlayed: false
				}
			}
			return pick
		})
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.deepEqual(
			projection.substitutions.map(substitution => [
				substitution.playerInName,
				substitution.playerOutName
			]),
			[['Wilson', 'Sarr']]
		)
	})

	it('skips a bench player only after that player is also a confirmed no-show', () => {
		const picks = samplePicks().map(pick => {
			if (pick.webName === 'Pedro Porro') {
				return { ...pick, minutes: 90, totalPoints: 2 }
			}
			if (pick.webName === 'Wilson') {
				return { ...pick, minutes: 0, totalPoints: 0, isGwFinished: true }
			}
			return pick
		})
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.deepEqual(
			projection.substitutions.map(substitution => [
				substitution.playerInName,
				substitution.playerOutName
			]),
			[['Diop', 'Sarr']]
		)
	})

	it('uses the reserve goalkeeper for a confirmed goalkeeper no-show', () => {
		const picks = samplePicks().map(pick => {
			if (pick.webName === 'Raya') {
				return { ...pick, minutes: 0, totalPoints: 0, isGwFinished: true }
			}
			if (pick.webName === 'Palmer') {
				return {
					...pick,
					minutes: 0,
					isGwStarted: false,
					isGwFinished: false
				}
			}
			if (pick.webName === 'Pedro Porro' || pick.webName === 'Sarr') {
				return { ...pick, minutes: 90, totalPoints: 2 }
			}
			return pick
		})
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.deepEqual(
			projection.substitutions.map(substitution => [
				substitution.playerInName,
				substitution.playerOutName
			]),
			[['Palmer', 'Raya']]
		)
	})

	it('does not apply automatic substitutions during Bench Boost', () => {
		const projection = deriveLiveAutoSubProjection(
			sampleLive(samplePicks(), { chip: 'BB' })
		)

		assert.equal(projection.benchBoostActive, true)
		assert.equal(projection.state, 'NONE')
		assert.deepEqual(projection.substitutions, [])
	})

	it('still promotes an appearing vice-captain during Bench Boost', () => {
		const picks = samplePicks().map(pick =>
			pick.webName === 'Haaland'
				? { ...pick, minutes: 0, totalPoints: 0, isGwFinished: true }
				: pick
		)
		const projection = deriveLiveAutoSubProjection(
			sampleLive(picks, { chip: 'BB' })
		)

		assert.deepEqual(projection.substitutions, [])
		assert.equal(projection.captainPromotion?.playerInName, 'Raya')
		assert.equal(projection.state, 'PREDICTED')
	})

	it('promotes the vice-captain as soon as the captain is a confirmed no-show', () => {
		const picks = samplePicks().map(pick =>
			pick.webName === 'Haaland'
				? { ...pick, minutes: 0, totalPoints: 0, isGwFinished: true }
				: pick
		)
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.equal(projection.captainPromotion?.playerInName, 'Raya')
		assert.equal(projection.captainPromotion?.playerOutName, 'Haaland')
	})

	it('waits for the vice-captain to appear before promoting them', () => {
		const picks = samplePicks().map(pick => {
			if (pick.webName === 'Haaland') {
				return { ...pick, minutes: 0, totalPoints: 0, isGwFinished: true }
			}
			if (pick.webName === 'Raya') {
				return { ...pick, minutes: 0, isGwFinished: false }
			}
			return pick
		})
		const projection = deriveLiveAutoSubProjection(sampleLive(picks))

		assert.equal(projection.captainPromotion, null)
	})

	it('marks settled substitutions as official', () => {
		const projection = deriveLiveAutoSubProjection(
			sampleLive(samplePicks(), { score: liveScore(42, 'FINAL') })
		)

		assert.equal(projection.state, 'OFFICIAL')
		assert.equal(
			projection.substitutions.every(
				substitution => substitution.state === 'OFFICIAL'
			),
			true
		)
	})

	it('marks a settled snapshot as official before an entry score becomes final', () => {
		const projection = deriveLiveAutoSubProjection(
			sampleLive(samplePicks(), {
				snapshot: {
					eventId: 1,
					revision: 'a'.repeat(24),
					state: 'SETTLED',
					publishedAt: '2026-08-25T00:00:00.000Z',
					checkedAt: '2026-08-25T00:00:00.000Z'
				}
			})
		)

		assert.equal(projection.state, 'OFFICIAL')
		assert.equal(
			projection.substitutions.every(
				substitution => substitution.state === 'OFFICIAL'
			),
			true
		)
	})

	it('moves incoming players into the existing XI and outgoing players onto the bench', () => {
		const players = mapLiveDataToPlayers(sampleLive(), new Map())
		const starters = players.filter(player => !player.isBench)
		const bench = players.filter(player => player.isBench)

		assert.equal(starters.length, 11)
		assert.deepEqual(
			starters.map(player => player.name),
			[
				'Raya',
				'Diop',
				'Mosquera',
				'Virgil',
				'Wilson',
				'Mbeumo',
				'Wirtz',
				'Tzolis',
				'Haaland',
				'Joao Pedro',
				'Brobbey'
			]
		)
		assert.deepEqual(
			bench.map(player => player.name),
			['Palmer', 'Sarr', 'Pedro Porro', 'van Ewijk']
		)
		assert.equal(
			starters.find(player => player.name === 'Wilson')?.autoSubRole,
			'PREDICTED_IN'
		)
		assert.equal(
			bench.find(player => player.name === 'Sarr')?.autoSubRole,
			'PREDICTED_OUT'
		)
		assert.equal(starters.filter(player => player.position === 'DEF').length, 3)
	})
})
