import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
	MyTournamentReviewPoints,
	MyTournamentReviewPointsRow
} from '../lib/graphql/operations/my-fpl'
import {
	mergeTournamentReviewEventIds,
	selectTournamentReviewEventId,
	tournamentReviewPointsRow,
	tournamentReviewPointsSummary
} from '../app/me/tournament/_lib/tournament-review-v2'
import { buildTournamentStatsQueryString } from '../app/me/tournament/_lib/tournament-stats-url'

const row: MyTournamentReviewPointsRow = {
	entryId: 1,
	entryName: 'Team',
	playerName: 'Manager',
	applicable: true,
	groupId: 1,
	rank: 1,
	previousRank: 2,
	grossPoints: 70,
	transferCost: 4,
	netPoints: 66,
	tournamentScore: 66,
	seasonGrossPoints: 700,
	seasonNetPoints: 680,
	eventRank: 1,
	overallPoints: 700,
	overallRank: 10
}

const points: MyTournamentReviewPoints = {
	headlineMetric: 'gross',
	grossPointsTotal: 140,
	grossPointsAverage: 70,
	netPointsTotal: 132,
	seasonGrossPointsTotal: 1400,
	seasonGrossPointsAverage: 700,
	seasonNetPointsTotal: 1360,
	rows: [row],
	nextCursor: null,
	hasNextPage: false
}

describe('My Tournament Review V2 client semantics', () => {
	it('accepts a requested gameweek only when that tournament published it', () => {
		assert.equal(selectTournamentReviewEventId(3, 12, [10, 11, 12]), 12)
		assert.equal(selectTournamentReviewEventId(11, 12, [10, 11, 12]), 11)
		assert.equal(selectTournamentReviewEventId(null, 12, [10, 11, 12]), 12)
	})

	it('preserves later finalized events after loading a historical cutoff', () => {
		assert.deepEqual(
			mergeTournamentReviewEventIds([10, 11, 12], [10, 11]),
			[10, 11, 12]
		)
	})

	it('renders cumulative point values in Season and round values in Gameweek', () => {
		assert.deepEqual(tournamentReviewPointsSummary(points, 'gameweek'), {
			grossTotal: 140,
			grossAverage: 70,
			netTotal: 132
		})
		assert.deepEqual(tournamentReviewPointsSummary(points, 'season'), {
			grossTotal: 1400,
			grossAverage: 700,
			netTotal: 1360
		})
		assert.deepEqual(tournamentReviewPointsRow(row, 'season'), {
			grossPoints: 700,
			transferCost: 20,
			netPoints: 680
		})
	})

	it('persists the admin scope and keeps Season as the omitted-view default', () => {
		assert.equal(
			buildTournamentStatsQueryString({
				tournamentId: 6953,
				view: 'season',
				gw: 12,
				scope: 'ALL'
			}),
			'tournamentId=6953&gw=12&scope=all'
		)
	})
})
