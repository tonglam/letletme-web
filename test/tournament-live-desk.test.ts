import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { GraphQLRequestError } from '../lib/graphql-client'
import type {
	TournamentLiveCalcData,
	TournamentLivePointsResponse
} from '../lib/graphql/operations/tournaments'
import {
	buildTournamentEntries,
	buildTournamentStats,
	formatLiveAveragePoints,
	mergeUnavailableTournamentEntryIds
} from '../lib/tournament/liveEntries'
import { loadTournamentLiveDeskWithRevisionRecovery } from '../lib/tournament/liveDesk'
import { sortTournamentEntries } from '../lib/tournament/table-sort'

const response = {
	entryLiveCompetitionsDesk: {
		eventId: 1,
		revision: 'next',
		state: 'LIVE',
		tournaments: [],
		selectedTournamentId: 97,
		partial: false,
		failedEntryIds: [],
		totalEntries: 0,
		board: []
	}
} as TournamentLivePointsResponse

const managerScore = (
	overrides: Partial<NonNullable<TournamentLiveCalcData['score']>>
): NonNullable<TournamentLiveCalcData['score']> => ({
	eventPoints: null,
	netEventPoints: null,
	totalPoints: null,
	totalScope: 'UNKNOWN',
	eventRank: null,
	overallRank: null,
	leagueRank: null,
	transferCost: 0,
	source: 'UNAVAILABLE',
	state: 'UNAVAILABLE',
	eventPointSemantics: 'UNKNOWN',
	revision: null,
	checkedAt: null,
	upstreamUpdatedAt: null,
	staleAt: null,
	nextRefreshAt: null,
	reconciliation: 'NO_OFFICIAL_SCORE',
	reasonCodes: [],
	...overrides
})

describe('live tournament desk', () => {
	it('unifies calculation failures and unavailable official manager rows', () => {
		assert.deepEqual(
			mergeUnavailableTournamentEntryIds([2, 3], [3, 4]),
			[2, 3, 4]
		)
	})

	it('uses a positive live OR, falls back to the top-level OR, and sorts the resolved value', () => {
		const rows = [
			{
				entry: 1,
				rank: 3,
				entryName: 'Available',
				playerName: 'Manager',
				overallRank: 999,
				transferCost: 0,
				livePoints: 6,
				liveNetPoints: 6,
				liveTotalPoints: 101,
				played: 3,
				toPlay: 8,
				captainName: 'Captain',
				teamValue: 100.5,
				bank: 7.49,
				chip: null,
				pickList: [],
				score: managerScore({
					eventPoints: 6,
					totalPoints: 101,
					totalScope: 'CLASSIC_PHASE',
					overallRank: 123,
					source: 'FPL_CLASSIC_STANDINGS',
					state: 'LIVE'
				})
			},
			{
				entry: 2,
				rank: 0,
				entryName: 'Syncing',
				playerName: 'Manager 2',
				overallRank: 456,
				transferCost: 0,
				livePoints: 0,
				liveNetPoints: 0,
				liveTotalPoints: 0,
				played: 0,
				toPlay: 11,
				captainName: 'Captain',
				chip: null,
				pickList: [],
				score: managerScore({})
			},
			{
				entry: 3,
				rank: 0,
				entryName: 'No rank yet',
				playerName: 'Manager 3',
				overallRank: 0,
				transferCost: 0,
				livePoints: 0,
				liveNetPoints: 0,
				liveTotalPoints: 0,
				played: 0,
				toPlay: 11,
				captainName: 'Captain',
				chip: null,
				pickList: [],
				score: managerScore({ overallRank: 0 })
			}
		] satisfies TournamentLiveCalcData[]

		const entries = buildTournamentEntries(rows)
		assert.equal(entries[0]?.rank, 3)
		assert.equal(entries[0]?.totalPoints, 101)
		assert.equal(entries[0]?.overallRank, 123)
		assert.equal(entries[0]?.teamValue, 100.5)
		assert.equal(entries[0]?.bank, 7.49)
		assert.equal(entries[1]?.overallRank, 456)
		assert.equal(entries[2]?.overallRank, 0)
		assert.deepEqual(
			sortTournamentEntries(entries, '', 'overallRank', 'asc').map(
				entry => entry.id
			),
			['1', '2', '3']
		)
		assert.deepEqual(buildTournamentStats(entries), {
			averagePoints: 6,
			highestPoints: 6,
			totalEntries: 3
		})

		const fractionalStats = buildTournamentStats([
			{ ...entries[0], id: 'fraction-1', livePoints: 59, stale: false },
			{ ...entries[0], id: 'fraction-2', livePoints: 39, stale: false },
			{ ...entries[0], id: 'fraction-3', livePoints: 0, stale: false }
		])
		assert.equal(fractionalStats.averagePoints, 98 / 3)
		assert.equal(formatLiveAveragePoints(fractionalStats.averagePoints), '32.67')
	})

	it('retries an expired revision exactly once without a ref', async () => {
		const refs: Array<{ revision: string } | null> = []
		const result = await loadTournamentLiveDeskWithRevisionRecovery(
			async ref => {
				refs.push(ref)
				if (refs.length === 1) {
					throw new GraphQLRequestError('expired', {
						code: 'LIVE_REVISION_GONE'
					})
				}
				return response
			},
			{ season: '2026', eventId: 1, revision: 'old' }
		)

		assert.equal(result, response)
		assert.deepEqual(refs, [
			{ season: '2026', eventId: 1, revision: 'old' },
			null
		])
	})
})
