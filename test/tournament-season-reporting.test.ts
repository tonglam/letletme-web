import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildTournamentSeasonField,
	compareTournamentSeasonRows,
} from '../app/me/tournament/_lib/tournament-stats-model'
import type { TournamentEventResultItem } from '../lib/graphql/operations/tournaments'

function result(
	entryId: number,
	eventGroupRank: number,
	overallPoints: number | null,
	overallRank: number,
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
		bank: 0,
	}
}

describe('tournament season cumulative standings', () => {
	it('orders and ranks by cumulative points instead of per-group rank', () => {
		const rows = [
			result(1, 1, 100, 300),
			result(2, 1, 120, 100),
			result(3, 2, 110, 200),
		]

		assert.deepEqual(
			[...rows].sort(compareTournamentSeasonRows).map(row => row.entryId),
			[2, 3, 1],
		)
		const field = buildTournamentSeasonField(rows, 1, 3)
		assert.ok(field)
		assert.deepEqual(
			field.standings.map(row => ({ entryId: row.entryId, rank: row.rank })),
			[
				{ entryId: 2, rank: 1 },
				{ entryId: 3, rank: 2 },
				{ entryId: 1, rank: 3 },
			],
		)
		assert.equal(field.leaderPoints, 120)
		assert.equal(field.gapFirstSecond, 10)
	})
})
