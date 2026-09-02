import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	isCompleteLiveBoardPage,
	parseEntryLiveCompetitionBoardPage
} from '../lib/tournament/live-board'

const revision = 'a'.repeat(64)

describe('Live Board V2 score contract', () => {
	it('accepts negative event points and an unknown overall rank', () => {
		const payload = {
			head: {
				season: '2627',
				eventId: 1,
				tournamentId: 10,
				mode: 'CLASSIC',
				availability: 'READY',
				contentRevision: revision,
				nextRefreshAt: '2026-08-30T00:00:30.000Z',
				publication: {
					revisions: {
						publicationId: 'publication-1',
						generation: 1,
						roster: revision,
						scoreCore: revision,
						fixtureIdentity: revision,
						entryInputSet: revision,
						identity: revision,
						officialRank: null,
						rules: revision,
						algorithm: revision,
						content: revision
					},
					times: {
						sourceCheckedAt: '2026-08-30T00:00:00.000Z',
						contentUpdatedAt: '2026-08-30T00:00:00.000Z',
						publishedAt: '2026-08-30T00:00:01.000Z',
						checkpointedAt: null,
						servedAt: '2026-08-30T00:00:02.000Z',
						staleAt: '2026-08-30T00:01:00.000Z',
						nextRefreshAt: '2026-08-30T00:00:30.000Z'
					}
				},
				delivery: {
					state: 'FRESH',
					servedFrom: 'REDIS_CURRENT',
					reasonCodes: []
				}
			},
			totalEntries: 1,
			filteredEntries: 1,
			pageInfo: { hasNextPage: false, endCursor: null },
			highestEventPoints: -2,
			averageEventPoints: -2,
			rows: [
				{
					availability: 'READY',
					entry: 6953,
					entryName: 'Entry 6953',
					playerName: 'Manager',
					liveRank: 1,
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
		}
		const page = parseEntryLiveCompetitionBoardPage(payload)

		assert.equal(page.rows[0]?.score?.eventPoints, -2)
		assert.equal(page.rows[0]?.overallRank, null)

		const fractionalRankPayload = structuredClone(payload) as {
			rows: Array<{ overallRank: number | null }>
		}
		fractionalRankPayload.rows[0]!.overallRank = 1.5
		assert.throws(() =>
			parseEntryLiveCompetitionBoardPage(fractionalRankPayload)
		)
	})

	it('only treats a complete publication as replaceable LKG data', () => {
		const payload = {
			head: {
				season: '2627',
				eventId: 1,
				tournamentId: 10,
				mode: 'CLASSIC',
				availability: 'READY',
				contentRevision: revision,
				nextRefreshAt: '2026-08-30T00:00:30.000Z',
				publication: {
					revisions: {
						publicationId: 'publication-1',
						generation: 1,
						roster: revision,
						scoreCore: revision,
						fixtureIdentity: revision,
						entryInputSet: revision,
						identity: revision,
						officialRank: null,
						rules: revision,
						algorithm: revision,
						content: revision
					},
					times: {
						sourceCheckedAt: '2026-08-30T00:00:00.000Z',
						contentUpdatedAt: '2026-08-30T00:00:00.000Z',
						publishedAt: '2026-08-30T00:00:01.000Z',
						checkpointedAt: null,
						servedAt: '2026-08-30T00:00:02.000Z',
						staleAt: '2026-08-30T00:01:00.000Z',
						nextRefreshAt: '2026-08-30T00:00:30.000Z'
					}
				},
				delivery: {
					state: 'FRESH',
					servedFrom: 'REDIS_CURRENT',
					reasonCodes: []
				}
			},
			totalEntries: 1,
			filteredEntries: 1,
			pageInfo: { hasNextPage: false, endCursor: null },
			highestEventPoints: 1,
			averageEventPoints: 1,
			rows: [
				{
					availability: 'READY',
					entry: 6953,
					entryName: 'Entry 6953',
					playerName: 'Manager',
					liveRank: 1,
					overallRank: null,
					teamValue: 1000,
					chip: 'NONE',
					transferCost: 0,
					played: 11,
					toPlay: 0,
					captainId: 1,
					captainName: 'Captain',
					captainPoints: 1,
					score: {
						eventPoints: 1,
						netEventPoints: 1,
						totalPoints: 1,
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
		}
		const page = parseEntryLiveCompetitionBoardPage(payload)

		assert.equal(isCompleteLiveBoardPage(page), true)
		assert.equal(
			isCompleteLiveBoardPage({
				...page,
				viewerRow: page.rows[0]!
			}),
			true
		)
		assert.equal(
			isCompleteLiveBoardPage({
				...page,
				head: { ...page.head, availability: 'PENDING' }
			}),
			false
		)
		assert.equal(
			isCompleteLiveBoardPage({
				...page,
				rows: [{ ...page.rows[0]!, availability: 'ERROR', score: null }]
			}),
			false
		)
		assert.equal(
			isCompleteLiveBoardPage({
				...page,
				rows: [{ ...page.rows[0]!, availability: 'MISSING', score: null }]
			}),
			true
		)
		assert.equal(
			isCompleteLiveBoardPage({
				...page,
				filteredEntries: 2
			}),
			true
		)
		assert.equal(
			isCompleteLiveBoardPage(
				{
					...page,
					filteredEntries: 2,
					pageInfo: { hasNextPage: false, endCursor: 'cursor-terminal' }
				},
				{ firstPage: true }
			),
			false
		)
		assert.equal(
			isCompleteLiveBoardPage(
				{
					...page,
					rows: [],
					filteredEntries: 1,
					pageInfo: { hasNextPage: false, endCursor: null }
				},
				{ firstPage: true }
			),
			false
		)
	})
})
