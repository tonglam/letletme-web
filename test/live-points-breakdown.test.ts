import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildProvisionalBreakdownFromPlayer,
	breakdownSum,
	resolvePointsBreakdown,
} from '../app/live/points/_lib/live-points-breakdown'
import type { Player } from '../types/player'

function basePlayer(
	overrides: {
		position?: Player['position']
		playingStatus?: Player['playingStatus']
		stats?: Partial<Player['stats']>
	} = {},
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
			...overrides.stats,
		},
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
				bonusPoints: 0,
			},
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
				points: 8, // 2 + 1 + 4 + 1
			},
		})
		const lines = buildProvisionalBreakdownFromPlayer(player)
		assert.equal(breakdownSum(lines), 8)
	})
})

describe('resolvePointsBreakdown', () => {
	it('prefers official explain when totals match', () => {
		const player = basePlayer({
			stats: { minutes: 90, goals: 1, points: 7, bonusPoints: 0 },
		})
		const official = [
			{ category: 'Appearance', points: 2, value: 90 },
			{ category: 'Goals', points: 5, value: 1 },
		]
		const resolved = resolvePointsBreakdown({
			official,
			officialMatchesTotal: true,
			player,
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
				points: 13, // 2 + 8 + 3
			},
		})
		const resolved = resolvePointsBreakdown({
			official: [],
			officialMatchesTotal: false,
			player,
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
				points: 26, // double of 13
			},
		})
		const resolved = resolvePointsBreakdown({
			official: [],
			officialMatchesTotal: false,
			player,
		})
		assert.equal(resolved.source, 'provisional')
		assert.equal(breakdownSum(resolved.lines), 26)
	})
})
