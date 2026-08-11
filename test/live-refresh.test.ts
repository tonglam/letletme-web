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

	it('keeps live matches when the optional next-event request fails', async () => {
		const response: LiveMatchesResponse = {
			liveSnapshot: snapshot('LIVE'),
			liveMatches: { notStarted: [], playing: [], finished: [] }
		}
		const result = await getLiveMatchesSnapshot(
			34,
			async query => {
				if (query.includes('GetEventFixtures')) {
					throw new Error('fixtures temporarily unavailable')
				}
				return response as never
			}
		)

		assert.deepEqual(result.matches, [])
		assert.equal(result.snapshot?.state, 'LIVE')
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
