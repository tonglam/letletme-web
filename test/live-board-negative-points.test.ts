import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { parseEntryLiveCompetitionBoardPage } from '../lib/tournament/live-board'

const revision = 'a'.repeat(64)

describe('Live Board V2 score contract', () => {
	it('accepts negative event points and an unknown overall rank', () => {
		const page = parseEntryLiveCompetitionBoardPage({
			season: '2627',
			eventId: 1,
			tournamentId: 10,
			boardRevision: revision,
			scoreCoreRevision: revision,
			dataAvailability: 'READY',
			revisions: {
				publicationId: 'publication-1',
				generation: 1,
				lifecycle: revision,
				fixtureIdentity: revision,
				scoreCore: revision,
				displayStats: revision,
				explain: revision,
				rules: revision,
				algorithm: revision,
				input: revision,
				picksBase: null,
				officialAdjustment: null,
				previousTotals: null,
				finalResult: null
			},
			times: {
				sourceCheckedAt: '2026-08-30T00:00:00.000Z',
				contentUpdatedAt: '2026-08-30T00:00:00.000Z',
				publishedAt: '2026-08-30T00:00:01.000Z',
				checkpointedAt: null,
				servedAt: '2026-08-30T00:00:02.000Z',
				staleAt: '2026-08-30T00:01:00.000Z',
				nextRefreshAt: '2026-08-30T00:00:30.000Z'
			},
			delivery: {
				state: 'FRESH',
				servedFrom: 'REDIS_CURRENT',
				reasonCodes: []
			},
			coverageState: 'COMPLETE',
			rankScope: 'AVAILABLE_ROWS',
			computedEntries: 1,
			deferredEntryCount: 0,
			failedEntryCount: 0,
			unavailableEntryCount: 0,
			officialCoverage: 1,
			unavailableEntryIds: [],
			failedEntryIds: [],
			partial: false,
			totalEntries: 1,
			filteredEntries: 1,
			page: 1,
			pageSize: 20,
			hasMore: false,
			highestEventPoints: -2,
			averageEventPoints: -2,
			rows: [
				{
					entry: 6953,
					entryName: 'Entry 6953',
					playerName: 'Manager',
					rank: 1,
					overallRank: null,
					teamValue: 1000,
					chip: 'NONE',
					transferCost: 0,
					played: 11,
					toPlay: 0,
					captainId: 1,
					captainName: 'Captain',
					captainPoints: -4,
					score: {
						eventPoints: -2,
						netEventPoints: -2,
						totalPoints: 100,
						totalScope: 'OVERALL',
						transferCost: 0,
						source: 'FPL_EVENT_LIVE',
						calculationMode: 'PROJECTED_AUTOSUBS',
						revisions: {
							publicationId: 'publication-1',
							generation: 1,
							lifecycle: revision,
							fixtureIdentity: revision,
							scoreCore: revision,
							displayStats: revision,
							explain: revision,
							rules: revision,
							algorithm: revision,
							input: revision,
							picksBase: null,
							officialAdjustment: null,
							previousTotals: null,
							finalResult: null
						},
						times: {
							sourceCheckedAt: '2026-08-30T00:00:00.000Z',
							contentUpdatedAt: '2026-08-30T00:00:00.000Z',
							publishedAt: '2026-08-30T00:00:01.000Z',
							checkpointedAt: null,
							servedAt: '2026-08-30T00:00:02.000Z',
							staleAt: '2026-08-30T00:01:00.000Z',
							nextRefreshAt: null
						},
						delivery: {
							state: 'FRESH',
							servedFrom: 'REDIS_CURRENT',
							reasonCodes: []
						}
					}
				}
			],
			viewerRow: null
		})

		assert.equal(page.rows[0]?.score.eventPoints, -2)
		assert.equal(page.rows[0]?.overallRank, null)
	})
})
