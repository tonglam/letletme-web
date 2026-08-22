import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildTournamentSeasonField,
	compareTournamentSeasonRows
} from '../app/me/tournament/_lib/tournament-stats-model'
import { aggregateToSeasonSnapshot } from '../app/me/tournament/_lib/my-fpl-adapters'
import type {
	MyFplCompetitionAggregate,
	MyFplCompetitionBoardPage
} from '../lib/graphql/operations/my-fpl'
import type { TournamentEventResultItem } from '../lib/graphql/operations/tournaments'

function result(
	entryId: number,
	eventGroupRank: number,
	overallPoints: number | null,
	overallRank: number
): TournamentEventResultItem {
	return {
		event: { id: 3, name: 'Gameweek 3' },
		groupId: 1,
		entryId,
		entryName: `Entry ${entryId}`,
		playerName: `Manager ${entryId}`,
		eventGroupRank,
		eventPoints: 70,
		eventCost: 0,
		eventNetPoints: 70,
		eventRank: 100,
		overallPoints,
		overallRank,
		eventChip: null,
		captainId: null,
		captainPoints: null,
		teamValue: 1000 + entryId,
		bank: 0
	}
}

describe('tournament season cumulative standings', () => {
	it('orders and ranks by cumulative points instead of per-group rank', () => {
		const rows = [
			result(1, 1, 100, 300),
			result(2, 1, 120, 100),
			result(3, 2, 110, 200)
		]

		assert.deepEqual(
			[...rows].sort(compareTournamentSeasonRows).map(row => row.entryId),
			[2, 3, 1]
		)
		const field = buildTournamentSeasonField(rows, 1, 3)
		assert.ok(field)
		assert.deepEqual(
			field.standings.map(row => ({ entryId: row.entryId, rank: row.rank })),
			[
				{ entryId: 2, rank: 1 },
				{ entryId: 3, rank: 2 },
				{ entryId: 1, rank: 3 }
			]
		)
		assert.equal(field.leaderPoints, 120)
		assert.equal(field.gapFirstSecond, 10)
	})

	it('derives Season field ranks from cumulative points, not group rank', () => {
		const row = (
			entryId: number,
			groupRank: number,
			overallPoints: number
		) => ({
			eventId: 3,
			groupId: entryId === 3 ? 2 : 1,
			entryId,
			entryName: `Entry ${entryId}`,
			playerName: `Manager ${entryId}`,
			rank: groupRank,
			previousRank: null,
			eventPoints: 70,
			eventCost: 0,
			eventNetPoints: 70,
			eventRank: 100,
			overallPoints,
			overallRank: 100 + entryId,
			eventChip: null,
			captainId: null,
			captainWebName: null,
			captainTeamShortName: null,
			captainPoints: null,
			teamValue: 1000,
			bank: 0
		})
		const board = {
			state: 'READY',
			eventId: 3,
			page: 1,
			pageSize: 100,
			totalRows: 3,
			totalPages: 1,
			fieldSize: 3,
			rows: [row(1, 1, 100), row(2, 1, 120), row(3, 1, 110)],
			viewerRow: null
		} satisfies MyFplCompetitionBoardPage
		const aggregate = {
			eventId: 3,
			entryCount: 3,
			leaderOverallPoints: 120,
			secondOverallPoints: 110,
			gapFirstSecond: 10,
			averageOverallPoints: 110,
			metrics: [],
			viewer: null,
			topPerformers: [],
			risers: [],
			fallers: [],
			captainDistribution: [],
			chipDistribution: []
		} as MyFplCompetitionAggregate
		const snapshot = aggregateToSeasonSnapshot(aggregate, board)
		assert.ok(snapshot)
		assert.deepEqual(
			snapshot.standings.map(row => ({ entryId: row.entryId, rank: row.rank })),
			[
				{ entryId: 2, rank: 1 },
				{ entryId: 3, rank: 2 },
				{ entryId: 1, rank: 3 }
			]
		)
	})
})
