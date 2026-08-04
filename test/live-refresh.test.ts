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

	it('keeps polling during a rolling rollout before metadata exists', () => {
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
	it('uses no-store and returns match data with producer metadata', async () => {
		let requestCache: RequestCache | undefined
		const response: LiveMatchesResponse = {
			liveSnapshot: snapshot('SCHEDULED'),
			liveMatches: { nextEvent: [], notStarted: [], playing: [], finished: [] }
		}
		const result = await getLiveMatchesSnapshot(
			async (_query, _variables, options) => {
				requestCache = options?.cache
				return response as never
			}
		)

		assert.equal(requestCache, 'no-store')
		assert.deepEqual(result.matches, [])
		assert.equal(result.snapshot?.revision, 'a'.repeat(24))
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
		const nextRows = [{ entry: 1, liveNetPoints: 11 }] as TournamentLiveCalcData[]

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
