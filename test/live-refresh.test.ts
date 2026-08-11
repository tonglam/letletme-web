import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
	LiveMatchesResponse,
	LiveSnapshotStatus
} from '../lib/graphql/operations/live'
import { getLiveMatchesSnapshot } from '../lib/live-matches'
import {
	LIVE_AUTO_REFRESH_SECONDS,
	LIVE_EXPLAIN_REFRESH_INTERVAL_MS,
	liveRefreshEventIdentityChanged,
	liveSnapshotNeedsRefresh,
	shouldPollLiveSnapshot,
	shouldRefreshLiveExplain
} from '../lib/live-refresh'
import {
	getTournamentLiveBatchSeed,
	mergePartialTournamentRows
} from '../lib/tournament/liveEntries'
import type {
	TournamentLiveCalcData,
	TournamentLivePointsResponse
} from '../lib/graphql/operations/tournaments'

const snapshot = (state: LiveSnapshotStatus['state']): LiveSnapshotStatus => ({
	eventId: 33,
	revision: 'a'.repeat(24),
	state,
	publishedAt: '2026-08-04T10:00:00.000Z',
	checkedAt: '2026-08-04T10:00:00.000Z'
})

describe('live refresh policy', () => {
	it('polls scheduled and live current events every 30 seconds', () => {
		assert.equal(LIVE_AUTO_REFRESH_SECONDS, 30)
		for (const state of ['SCHEDULED', 'LIVE'] as const) {
			assert.equal(
				shouldPollLiveSnapshot({
					isPageActive: true,
					currentEventId: 33,
					selectedEventId: 33,
					snapshot: snapshot(state)
				}),
				true
			)
		}
	})

	it('stops background, past-event, and settled polling', () => {
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: false,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: snapshot('LIVE')
			}),
			false
		)
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 32,
				snapshot: snapshot('LIVE')
			}),
			false
		)
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: snapshot('SETTLED')
			}),
			false
		)
	})

	it('keeps polling while refreshed metadata is not yet available', () => {
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: null
			}),
			true
		)
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: { ...snapshot('LIVE'), eventId: 34 }
			}),
			true
		)
	})

	it('throttles explain fan-out to the ten-minute persistence cadence', () => {
		const lastAttempt = 1_000
		assert.equal(
			shouldRefreshLiveExplain(
				lastAttempt,
				lastAttempt + LIVE_EXPLAIN_REFRESH_INTERVAL_MS - 1
			),
			false
		)
		assert.equal(
			shouldRefreshLiveExplain(
				lastAttempt,
				lastAttempt + LIVE_EXPLAIN_REFRESH_INTERVAL_MS
			),
			true
		)
	})

	it('runs heavy work only for a new or unavailable producer revision', () => {
		const accepted = snapshot('LIVE')
		assert.equal(liveSnapshotNeedsRefresh(accepted, { ...accepted }), false)
		assert.equal(
			liveSnapshotNeedsRefresh(accepted, {
				...accepted,
				checkedAt: '2026-08-04T10:01:00.000Z'
			}),
			false
		)
		assert.equal(
			liveSnapshotNeedsRefresh(accepted, {
				...accepted,
				revision: 'b'.repeat(24)
			}),
			true
		)
		assert.equal(liveSnapshotNeedsRefresh(null, null), true)
	})

	it('re-resolves event identities before a freshness probe', () => {
		assert.equal(liveRefreshEventIdentityChanged(33, 34, 33, 34), false)
		assert.equal(liveRefreshEventIdentityChanged(33, 34, 34, 35), true)
		assert.equal(liveRefreshEventIdentityChanged(33, 34, 33, undefined), true)
	})
})

describe('live matches server snapshot', () => {
	it('loads live matches and next-event fixtures in parallel without caching', async () => {
		const requests: Array<{
			query: string
			variables?: Record<string, unknown>
			cache?: RequestCache
		}> = []
		const response: LiveMatchesResponse = {
			liveSnapshot: snapshot('SCHEDULED'),
			liveMatches: { notStarted: [], playing: [], finished: [] }
		}
		const result = await getLiveMatchesSnapshot(
			34,
			async (query, variables, options) => {
				requests.push({ query, variables, cache: options?.cache })
				if (query.includes('GetEventFixtures')) {
					return {
						eventFixtures: [
							{
								id: 3401,
								code: 3401,
								event: { id: 34, name: 'Gameweek 34' },
								kickoffTime: '2026-08-11T18:00:00.000Z',
								finished: false,
								started: false,
								homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
								awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
								homeScore: null,
								awayScore: null,
								homeTeamDifficulty: 2,
								awayTeamDifficulty: 4
							}
						]
					} as never
				}
				return response as never
			}
		)

		assert.equal(requests.length, 2)
		assert.equal(
			requests.every(request => request.cache === 'no-store'),
			true
		)
		assert.deepEqual(
			requests.find(request => request.query.includes('GetEventFixtures'))
				?.variables,
			{ eventId: 34 }
		)
		assert.equal(result.matches.length, 1)
		assert.equal(result.matches[0]?.status, 'UPCOMING')
		assert.equal(result.snapshot?.revision, 'a'.repeat(24))
	})

	it('keeps live results when the optional upcoming-fixtures query fails', async () => {
		const response: LiveMatchesResponse = {
			liveSnapshot: snapshot('LIVE'),
			liveMatches: {
				notStarted: [],
				playing: [
					{
						matchId: 3301,
						minutes: 12,
						homeTeamId: 1,
						homeTeamName: 'Arsenal',
						homeTeamShortName: 'ARS',
						homePosition: 1,
						awayTeamId: 2,
						awayTeamName: 'Chelsea',
						awayTeamShortName: 'CHE',
						awayPosition: 2,
						kickoffTime: '2026-08-11T18:00:00.000Z',
						playStatus: 'LIVE',
						homeScore: 1,
						awayScore: 0,
						homeTeamDataList: [],
						awayTeamDataList: []
					}
				],
				finished: []
			}
		}
		const result = await getLiveMatchesSnapshot(34, async query => {
			if (query.includes('GetEventFixtures'))
				throw new Error('temporary fixture failure')
			return response as never
		})

		assert.equal(result.matches.length, 1)
		assert.equal(result.matches[0]?.status, 'LIVE')
	})

	it('re-resolves event identities before merging after a gameweek rollover', async () => {
		const requests: Array<{
			query: string
			variables?: Record<string, unknown>
		}> = []
		const result = await getLiveMatchesSnapshot(
			34,
			async (query, variables) => {
				requests.push({ query, variables })
				if (query.includes('GetCurrentAndNextEvents')) {
					return {
						current: [{ id: 34 }],
						next: [{ id: 35, deadlineTime: '2026-08-12T18:00:00.000Z' }]
					} as never
				}
				if (query.includes('GetEventFixtures')) {
					const eventId = (variables as { eventId: number }).eventId
					return {
						eventFixtures: [
							{
								id: eventId * 100 + 1,
								code: eventId * 100 + 1,
								event: { id: eventId, name: `Gameweek ${eventId}` },
								kickoffTime: '2026-08-11T18:00:00.000Z',
								finished: false,
								started: false,
								homeTeam: { id: 1, name: 'Arsenal', shortName: 'ARS' },
								awayTeam: { id: 2, name: 'Chelsea', shortName: 'CHE' },
								homeScore: null,
								awayScore: null,
								homeTeamDifficulty: 2,
								awayTeamDifficulty: 4
							}
						]
					} as never
				}
				return {
					liveSnapshot: { ...snapshot('LIVE'), eventId: 34 },
					liveMatches: { notStarted: [], playing: [], finished: [] }
				} as never
			},
			33
		)

		assert.equal(result.nextEventId, 35)
		assert.equal(result.matches[0]?.id, 'next-3501')
		assert.deepEqual(
			requests
				.filter(request => request.query.includes('GetEventFixtures'))
				.map(request => request.variables),
			[{ eventId: 34 }, { eventId: 35 }]
		)
	})
})

describe('partial tournament refreshes', () => {
	it('preserves a settled producer snapshot beside partial row errors', () => {
		const settled = snapshot('SETTLED')
		const seed = getTournamentLiveBatchSeed({
			liveSnapshot: settled,
			calcLivePointsForTournament: {
				results: [{ entry: 1 }] as TournamentLiveCalcData[],
				errors: [{ entryId: 2, message: 'temporary failure' }],
				meta: {
					eventId: 33,
					totalEntries: 2,
					succeededCount: 1,
					failedCount: 1
				}
			}
		} satisfies TournamentLivePointsResponse)

		assert.equal(seed.snapshot, settled)
		assert.equal(seed.failedCount, 1)
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: seed.snapshot
			}),
			false
		)
	})

	it('keeps the last-good row only for entries that failed this refresh', () => {
		const previousRows = [
			{ entry: 1, liveNetPoints: 10 },
			{ entry: 2, liveNetPoints: 9 }
		] as TournamentLiveCalcData[]
		const nextRows = [
			{ entry: 1, liveNetPoints: 11 }
		] as TournamentLiveCalcData[]

		const merged = mergePartialTournamentRows({
			nextRows,
			previousRows,
			failedEntryIds: [2],
			preserveFailed: true
		})
		assert.deepEqual(
			merged.map(row => [row.entry, row.liveNetPoints]),
			[
				[1, 11],
				[2, 9]
			]
		)
	})
})
