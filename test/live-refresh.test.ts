import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type {
	LiveMatchdayDeskResponse,
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
	it('polls scheduled and live current events every 15 seconds', () => {
		assert.equal(LIVE_AUTO_REFRESH_SECONDS, 15)
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

	it('stops background and past-event polling', () => {
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
		assert.equal(
			shouldPollLiveSnapshot({
				isPageActive: true,
				currentEventId: 33,
				selectedEventId: 33,
				snapshot: snapshot('SETTLED'),
				probeEventIdentity: true
			}),
			true
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
	it('loads one compact desk containing live matches and next fixtures', async () => {
		const requests: Array<{
			query: string
			variables?: Record<string, unknown>
			cache?: RequestCache
		}> = []
		const response: LiveMatchdayDeskResponse = {
			liveMatchdayDesk: {
				season: '2026',
				eventId: 33,
				revision: 'a'.repeat(24),
				state: 'SCHEDULED',
				publishedAt: new Date().toISOString(),
				matches: [],
				nextFixtures: [
					{
						fixtureId: 3401,
						eventId: 34,
						homeTeamId: 1,
						homeTeamName: 'Arsenal',
						awayTeamId: 2,
						awayTeamName: 'Chelsea',
						homeScore: null,
						awayScore: null,
						kickoffTime: '2026-08-11T18:00:00.000Z',
						started: false,
						finished: false
					}
				]
			}
		}
		const result = await getLiveMatchesSnapshot(
			34,
			async (query, variables, options) => {
				requests.push({ query, variables, cache: options?.cache })
				return response as never
			}
		)

		assert.equal(requests.length, 1)
		assert.equal(
			requests.every(request => request.cache === 'no-store'),
			true
		)
		assert.equal(result.matches.length, 1)
		assert.equal(result.matches[0]?.status, 'UPCOMING')
		assert.equal(result.snapshot?.revision, 'a'.repeat(24))
	})

	it('keeps live results when the optional upcoming-fixtures query fails', async () => {
		const response: LiveMatchdayDeskResponse = {
			liveMatchdayDesk: {
				season: '2026',
				eventId: 33,
				revision: 'b'.repeat(24),
				state: 'LIVE',
				publishedAt: new Date().toISOString(),
				matches: [
					{
						fixtureId: 3301,
						eventId: 33,
						homeTeamId: 1,
						homeTeamName: 'Arsenal',
						awayTeamId: 2,
						awayTeamName: 'Chelsea',
						homeScore: 1,
						awayScore: 0,
						kickoffTime: '2026-08-11T18:00:00.000Z',
						started: true,
						finished: false
					}
				],
				nextFixtures: []
			}
		}
		const result = await getLiveMatchesSnapshot(
			34,
			async () => response as never
		)

		assert.equal(result.matches.length, 1)
		assert.equal(result.matches[0]?.status, 'LIVE')
	})

	it('keeps the caller-provided event identity while merging the desk', async () => {
		const requests: Array<{
			query: string
			variables?: Record<string, unknown>
		}> = []
		const result = await getLiveMatchesSnapshot(
			34,
			async (query, variables) => {
				requests.push({ query, variables })
				return {
					liveMatchdayDesk: {
						eventId: 34,
						revision: 'rev-34',
						state: 'LIVE',
						publishedAt: new Date().toISOString(),
						matches: [],
						nextFixtures: [
							{
								fixtureId: 3401,
								eventId: 34,
								homeTeamId: 1,
								homeTeamName: 'Arsenal',
								awayTeamId: 2,
								awayTeamName: 'Chelsea',
								homeScore: null,
								awayScore: null,
								kickoffTime: '2026-08-11T18:00:00.000Z',
								started: false,
								finished: false
							}
						]
					}
				} as never
			},
			33
		)

		assert.equal(result.nextEventId, 34)
		assert.equal(result.matches[0]?.id, 'next-3401')
		assert.equal(requests.length, 1)
	})
})

describe('partial tournament refreshes', () => {
	it('preserves a settled producer snapshot beside partial row errors', () => {
		const settled = snapshot('SETTLED')
		const seed = getTournamentLiveBatchSeed({
			entryLiveCompetitionsDesk: {
				eventId: 33,
				revision: settled.revision,
				state: 'SETTLED',
				tournaments: [],
				selectedTournamentId: null,
				partial: true,
				board: [{ entry: 1 }] as TournamentLiveCalcData[],
				failedEntryIds: [2],
				totalEntries: 2
			}
		} satisfies TournamentLivePointsResponse)

		assert.equal(seed.snapshot?.eventId, settled.eventId)
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
