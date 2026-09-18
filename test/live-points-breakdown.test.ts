import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildProvisionalBreakdownFromPlayer,
	breakdownSum,
	resolvePointsBreakdown
} from '../app/live/points/_lib/live-points-breakdown'
import { buildLivePlayerDetailWithPayload } from '../components/live/player-detail-model'
import type {
	EventLiveExplainItem,
	PlayerLiveStats
} from '../lib/graphql/operations/live'
import type { Player } from '../types/player'

function basePlayer(
	overrides: {
		position?: Player['position']
		playingStatus?: Player['playingStatus']
		stats?: Partial<Player['stats']>
	} = {}
): Player {
	return {
		id: '1',
		name: 'Test',
		team: 'Arsenal',
		teamShort: 'ARS',
		position: overrides.position ?? 'MID',
		playingStatus: overrides.playingStatus ?? 'PLAYING',
		stats: {
			minutes: 0,
			goals: 0,
			expectedGoals: 0,
			expectedAssists: 0,
			expectedGoalInvolvements: 0,
			expectedGoalsConceded: 0,
			assists: 0,
			saves: 0,
			savePenalty: 0,
			cleanSheets: 0,
			yellowCards: 0,
			redCards: 0,
			points: 0,
			bonusPoints: 0,
			...overrides.stats
		}
	}
}

describe('buildProvisionalBreakdownFromPlayer', () => {
	it('scores a midfielder goal + assist + appearance', () => {
		const player = basePlayer({
			position: 'MID',
			stats: {
				minutes: 90,
				goals: 1,
				assists: 1,
				points: 10, // 2 + 5 + 3
				bonusPoints: 0
			}
		})
		const lines = buildProvisionalBreakdownFromPlayer(player)
		assert.equal(breakdownSum(lines), 10)
		assert.ok(lines.some(l => l.category === 'Goals' && l.points === 5))
		assert.ok(lines.some(l => l.category === 'Assists' && l.points === 3))
	})

	it('scores GKP saves and clean sheet', () => {
		const player = basePlayer({
			position: 'GKP',
			stats: {
				minutes: 90,
				saves: 4,
				cleanSheets: 1,
				bonusPoints: 1,
				points: 8 // 2 + 1 + 4 + 1
			}
		})
		const lines = buildProvisionalBreakdownFromPlayer(player)
		assert.equal(breakdownSum(lines), 8)
	})

	it('includes defensive-contribution points in the provisional total', () => {
		const player = basePlayer({
			position: 'MID',
			stats: {
				minutes: 90,
				goals: 1,
				assists: 1,
				defensiveContribution: 12,
				bonusPoints: 1,
				points: 13 // 2 + 5 + 3 + 2 DC + 1 bonus
			}
		})
		const lines = buildProvisionalBreakdownFromPlayer(player)
		assert.equal(breakdownSum(lines), 13)
		assert.deepEqual(
			lines.find(line => line.category === 'Defensive Contribution'),
			{ category: 'Defensive Contribution', points: 2, value: 12 }
		)
	})
})

describe('resolvePointsBreakdown', () => {
	it('prefers official explain when totals match', () => {
		const player = basePlayer({
			stats: { minutes: 90, goals: 1, points: 7, bonusPoints: 0 }
		})
		const official = [
			{ category: 'Appearance', points: 2, value: 90 },
			{ category: 'Goals', points: 5, value: 1 }
		]
		const resolved = resolvePointsBreakdown({
			official,
			officialMatchesTotal: true,
			player
		})
		assert.equal(resolved.source, 'official')
		assert.equal(resolved.lines.length, 2)
		assert.equal(resolved.pending, false)
	})

	it('falls back to provisional when official is empty', () => {
		const player = basePlayer({
			position: 'FWD',
			stats: {
				minutes: 90,
				goals: 2,
				bonusPoints: 3,
				points: 13 // 2 + 8 + 3
			}
		})
		const resolved = resolvePointsBreakdown({
			official: [],
			officialMatchesTotal: false,
			player
		})
		assert.equal(resolved.source, 'provisional')
		assert.equal(breakdownSum(resolved.lines), 13)
		assert.equal(resolved.pending, false)
	})

	it('scales provisional lines for captain double', () => {
		const player = basePlayer({
			position: 'FWD',
			stats: {
				minutes: 90,
				goals: 2,
				bonusPoints: 3,
				points: 26 // double of 13
			}
		})
		const resolved = resolvePointsBreakdown({
			official: [],
			officialMatchesTotal: false,
			player
		})
		assert.equal(resolved.source, 'provisional')
		assert.equal(breakdownSum(resolved.lines), 26)
	})
	it('scales provisional lines for a triple-captain contribution without mutating the source', () => {
		const player = basePlayer({ position: 'FWD', stats: { minutes: 90, goals: 2, bonusPoints: 3, points: 39 } })
		const before = structuredClone(player)
		const resolved = resolvePointsBreakdown({ official: [], officialMatchesTotal: false, player })
		assert.equal(resolved.source, 'provisional')
		assert.equal(breakdownSum(resolved.lines), 39)
		assert.deepEqual(player, before)
	})

})

describe('buildLivePlayerDetailWithPayload', () => {
	const completeLive = (overrides: Partial<PlayerLiveStats> = {}): PlayerLiveStats => ({
		minutes: 90,
		goalsScored: 2,
		assists: 0,
		cleanSheets: 0,
		goalsConceded: 0,
		ownGoals: 0,
		penaltiesSaved: 0,
		penaltiesMissed: 0,
		yellowCards: 0,
		redCards: 0,
		saves: 0,
		defensiveContribution: 0,
		bonus: 0,
		bps: 42,
		totalPoints: 12,
		...overrides
	})

	it('uses the targeted official payload for the latest score and breakdown', () => {
		const player = basePlayer({
			position: 'MID',
			stats: { minutes: 90, goals: 1, points: 7 }
		})
		const live = completeLive()
		const explain: EventLiveExplainItem = {
			elementId: 1,
			stats: {
				minutes: 90,
				goalsScored: 2,
				assists: 0,
				cleanSheets: 0,
				goalsConceded: 0,
				ownGoals: 0,
				penaltiesSaved: 0,
				penaltiesMissed: 0,
				yellowCards: 0,
				redCards: 0,
				saves: 0,
				defensiveContribution: 0,
				bonus: 0
			},
			contributions: [
				{ identifier: 'minutes', value: 90, points: 2 },
				{ identifier: 'goals_scored', value: 2, points: 10 }
			]
		}

		const detail = buildLivePlayerDetailWithPayload(player, { explain, live })

		assert.equal(detail.points, 12)
		assert.equal(detail.bps, 42)
		assert.equal(detail.stats.goals, 2)
		assert.equal(detail.breakdownSource, 'official')
		assert.equal(breakdownSum(detail.pointsBreakdown), 12)
	})

	it('keeps an out-of-sync explain response provisional', () => {
		const player = basePlayer({
			position: 'MID',
			stats: { minutes: 90, goals: 1, points: 7 }
		})
		const live = completeLive({ goalsScored: 1, totalPoints: 7 })
		const explain: EventLiveExplainItem = {
			elementId: 1,
			stats: { minutes: 90, goalsScored: 1 },
			contributions: [
				{ identifier: 'minutes', value: 90, points: 2 },
				{ identifier: 'goals_scored', value: 1, points: 4 }
			]
		}

		const detail = buildLivePlayerDetailWithPayload(player, { explain, live })

		assert.equal(detail.points, 7)
		assert.equal(detail.breakdownSource, 'provisional')
		assert.equal(detail.breakdownPending, false)
		assert.equal(breakdownSum(detail.pointsBreakdown), 7)
	})

	it('ignores an explain response for a different player', () => {
		const player = basePlayer({
			stats: { minutes: 90, goals: 1, points: 7 }
		})
		const explain: EventLiveExplainItem = {
			elementId: 99,
			stats: { minutes: 90, goalsScored: 99 },
			contributions: [
				{ identifier: 'minutes', value: 90, points: 2 },
				{ identifier: 'goals_scored', value: 99, points: 495 }
			]
		}

		const detail = buildLivePlayerDetailWithPayload(player, {
			explain,
			live: null
		})

		assert.equal(detail.points, 7)
		assert.equal(detail.stats.goals, 1)
		assert.equal(detail.breakdownSource, 'provisional')
		assert.equal(breakdownSum(detail.pointsBreakdown), 7)
	})
})
