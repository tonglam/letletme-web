import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildBreakdownFromPlayerLive,
	buildMatchHighlights,
	createBasePlayerDetail,
	formatMatchKickoff,
	getPlayerMetrics,
	getPlayersWithPoints,
} from '../components/live/match-card/match-card-model'
import type { PlayerLiveStats } from '../lib/graphql/operations/live'
import type { Match } from '../types/match'

describe('formatMatchKickoff', () => {
	it('uses UTC until the client has hydrated', () => {
		assert.equal(
			formatMatchKickoff('2026-08-21T19:00:00.000Z', 'en-US'),
			'August 21, 2026 at 19:00',
		)
	})

	it('returns null for an invalid kickoff', () => {
		assert.equal(formatMatchKickoff('not-a-date', 'en-US'), null)
	})
})

describe('getPlayersWithPoints', () => {
	it('keeps a player visible when a match event reduces the total to zero', () => {
		const thiago = {
			player: 'Thiago',
			elementType: 4,
			minutes: 60,
			cleanSheets: 1,
			penalties_missed: 1,
			totalPoints: 0,
		} as const

		assert.deepEqual(getPlayersWithPoints([thiago]), [thiago])
		assert.deepEqual(getPlayerMetrics(thiago), [
			{ label: 'MIN', value: 60, tone: 'neutral' },
			{ label: 'CS', value: 1, tone: 'info' },
			{ label: 'PM', value: 1, tone: 'destructive' },
		])
	})

	it('keeps negative-point players visible', () => {
		const player = {
			player: 'Player',
			totalPoints: -2,
		} as const

		assert.deepEqual(getPlayersWithPoints([player]), [player])
	})
})

describe('buildMatchHighlights', () => {
	it('sorts bonus points from highest to lowest', () => {
		const match = {
			id: 'fixture-1',
			status: 'LIVE',
			minute: 72,
			kickoff: '2026-08-23T00:30:00.000Z',
			viewers: 0,
			bonusPoints: [
				{ player: 'Player +1', team: 'BRE', points: 1 },
				{ player: 'Player +3', team: 'BRE', points: 3 },
				{ player: 'Player +2', team: 'BRE', points: 2 },
			],
			homeTeam: {
				name: 'Brentford',
				shortName: 'BRE',
				score: 3,
				possession: 0,
				shots: 0,
				shotsOnTarget: 0,
				corners: 0,
				players: [],
			},
			awayTeam: {
				name: 'Spurs',
				shortName: 'TOT',
				score: 0,
				possession: 0,
				shots: 0,
				shotsOnTarget: 0,
				corners: 0,
				players: [],
			},
		} satisfies Match

		const bonus = buildMatchHighlights(match).find(group => group.kind === 'bonus')
		assert.deepEqual(bonus?.items.map(item => item.value), [3, 2, 1])
	})
})

describe('live player detail mapping', () => {
	it('maps defensive and deduction stats into the detail card', () => {
		const detail = createBasePlayerDetail(
			{
				player: 'Senesi',
				elementType: 2,
				minutes: 72,
				goalsConceded: 3,
				defensiveContribution: 12,
				ownGoals: 0,
				penalties_missed: 0,
				totalPoints: 3,
			},
			'Tottenham Hotspur',
			'TOT',
		)

		assert.equal(detail.stats.goalsConceded, 3)
		assert.equal(detail.stats.defensiveContribution, 12)
		assert.equal(detail.stats.ownGoals, 0)
		assert.equal(detail.stats.penaltiesMissed, 0)
	})

	it('includes official defensive contribution points in the breakdown', () => {
		const stats: PlayerLiveStats = {
			minutes: 72,
			goalsScored: 0,
			assists: 0,
			cleanSheets: 0,
			goalsConceded: 3,
			ownGoals: 0,
			penaltiesSaved: 0,
			penaltiesMissed: 0,
			yellowCards: 0,
			redCards: 0,
			saves: 0,
			defensiveContribution: 12,
			bonus: 0,
			bps: 8,
			totalPoints: 3,
		}

		assert.deepEqual(
			buildBreakdownFromPlayerLive(stats, 2, [
				{ identifier: 'defensive_contribution', value: 12, points: 2 },
			]),
			[
				{ category: 'Minutes Played', points: 2, value: 72 },
				{ category: 'Goals Conceded', points: -1, value: 3 },
				{ category: 'Defensive Contribution', points: 2, value: 12 },
			],
		)
	})
})
