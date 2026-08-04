import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	breakdownLookupForRequest,
	mapLiveDataToPlayers,
	normalizeLiveExplainElementIds,
	rollupBreakdownStats
} from '../app/live/points/_lib/live-points-model'
import type { LiveCalcData } from '../lib/graphql/operations/live'

describe('live-points model', () => {
	it('rolls fixture breakdown rows up by identifier', () => {
		assert.deepEqual(
			rollupBreakdownStats([
				{ identifier: 'goals_scored', value: 1, points: 5 },
				{ identifier: 'goals_scored', value: 1, points: 5 },
				{ identifier: 'goals_scored', value: null, points: -1 },
				{ identifier: 'minutes', value: 90, points: 2 }
			]),
			[
				{ identifier: 'goals_scored', value: 2, points: 9 },
				{ identifier: 'minutes', value: 90, points: 2 }
			]
		)
	})

	it('deduplicates and bounds the live explanation player batch', () => {
		const elementIds = normalizeLiveExplainElementIds([
			1,
			1,
			-2,
			Number.NaN,
			...Array.from({ length: 30 }, (_, index) => index + 2)
		])
		assert.equal(elementIds.length, 15)
		assert.equal(elementIds[0], 1)
		assert.equal(new Set(elementIds).size, 15)
		assert.equal(elementIds.includes(-2), false)
	})

	it('returns no player IDs when every batch input is invalid', () => {
		assert.deepEqual(normalizeLiveExplainElementIds([0, -1, Number.NaN]), [])
	})

	it('keeps the current entry snapshot authoritative over older explanation values', () => {
		const live: LiveCalcData = {
			entry: 101,
			event: 33,
			entryName: 'Current XI',
			playerName: 'Manager',
			livePoints: 19,
			transferCost: 0,
			liveNetPoints: 19,
			liveTotalPoints: 1019,
			captainName: 'Current Player',
			pickList: [
				{
					element: 10,
					elementType: 2,
					position: 1,
					webName: 'Current Player',
					teamName: 'Arsenal',
					teamShortName: 'ARS',
					minutes: 70,
					goalsScored: 2,
					assists: 1,
					cleanSheets: 1,
					goalsConceded: 2,
					defensiveContribution: 10,
					ownGoals: 0,
					penaltiesSaved: 0,
					penaltiesMissed: 0,
					yellowCards: 1,
					redCards: 0,
					saves: 0,
					bonus: 2,
					bps: 30,
					totalPoints: 19,
					starts: true,
					isGwStarted: true,
					isGwFinished: false,
					isPlayed: true,
					expectedGoals: null,
					expectedAssists: null,
					expectedGoalInvolvements: null,
					expectedGoalsConceded: null,
					inDreamTeam: false
				}
			]
		}
		const olderExplanation = new Map([
			[
				'10',
				{
					stats: [
						{ identifier: 'minutes', value: 5, points: 1 },
						{ identifier: 'goals_scored', value: 0, points: 0 },
						{ identifier: 'total_points', value: -99, points: -99 }
					]
				}
			]
		])

		const [player] = mapLiveDataToPlayers(live, olderExplanation)

		assert.equal(player.team, 'Arsenal')
		assert.equal(player.teamShort, 'ARS')
		assert.equal(player.stats.minutes, 70)
		assert.equal(player.stats.goals, 2)
		assert.equal(player.stats.points, 19)
		assert.equal(player.breakdownStats?.length, 3)
		assert.equal(player.playingStatus, 'PLAYING')

		const [settledPlayer] = mapLiveDataToPlayers(
			{
				...live,
				pickList: live.pickList.map(pick => ({
					...pick,
					minutes: 20,
					isGwFinished: true
				}))
			},
			olderExplanation
		)
		assert.equal(settledPlayer.playingStatus, 'FINISHED')
	})

	it('reuses explain enrichment only for the same entry and gameweek', () => {
		const lookup = new Map([
			[
				'10',
				{
					stats: [{ identifier: 'clean_sheets', value: 1, points: 4 }]
				}
			]
		])
		const cached = { requestKey: '101:33', lookup }

		assert.equal(breakdownLookupForRequest(cached, '101:33'), lookup)
		assert.equal(breakdownLookupForRequest(cached, '101:34').size, 0)
	})
})
