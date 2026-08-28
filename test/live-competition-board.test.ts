import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { EntryLiveCompetitionBoardPage } from '@/lib/graphql/operations/tournaments'
import {
	LIVE_BOARD_CONTRACT_VERSION,
	LiveBoardInvalidResponseError,
	LiveBoardRequestError,
	canLoadMoreLiveBoard,
	canStartLiveBoardRefresh,
	fetchEntryLiveCompetitionBoard,
	isCurrentLiveBoardRequest,
	isLiveBoardRevisionGoneCode,
	liveBoardLastGoodKey,
	liveBoardPublicationChanged,
	parseEntryLiveCompetitionBoardPage,
	readLiveBoardLastGood,
	resolveAnchoredGameweek,
	resolveUrlGameweekSelection,
	shouldAutoRefreshLiveBoardPage,
	shouldSyncLiveBoardSearchInput,
	writeLiveBoardLastGood
} from '@/lib/tournament/live-board'

class MemoryStorage implements Storage {
	private readonly values = new Map<string, string>()

	get length() {
		return this.values.size
	}

	clear() {
		this.values.clear()
	}

	getItem(key: string) {
		return this.values.get(key) ?? null
	}

	key(index: number) {
		return Array.from(this.values.keys())[index] ?? null
	}

	removeItem(key: string) {
		this.values.delete(key)
	}

	setItem(key: string, value: string) {
		this.values.set(key, value)
	}
}

const page = (overrides: Partial<EntryLiveCompetitionBoardPage> = {}) =>
	({
		season: '2026-27',
		eventId: 1,
		tournamentId: 99,
		boardRevision: 'board-1',
		playerRevision: 'players-1',
		managerRevision: 'managers-1',
		dataAvailability: 'FRESH',
		managerDataAvailability: 'FRESH',
		managerServedFrom: 'REDIS',
		managerRefreshQueued: false,
		managerCheckedAt: '2026-08-23T10:00:00.000Z',
		managerNextRefreshAt: '2026-08-23T10:00:30.000Z',
		coverageState: 'COMPLETE',
		rankScope: 'FULL_FIELD',
		computedEntries: 65,
		deferredEntryCount: 0,
		failedEntryCount: 0,
		unavailableEntryCount: 0,
		officialCoverage: 1,
		unavailableEntryIds: [],
		failedEntryIds: [],
		partial: false,
		totalEntries: 65,
		filteredEntries: 65,
		page: 1,
		pageSize: 20,
		hasMore: true,
		highestEventPoints: 72,
		averageEventPoints: 41.2,
		rows: [
			{
				entry: 6953,
				entryName: 'Last Good FC',
				playerName: 'Manager',
				rank: 1,
				overallRank: 100,
				teamValue: 100.4,
				chip: '',
				livePoints: 42,
				transferCost: 0,
				liveNetPoints: 42,
				liveTotalPoints: 102,
				played: 7,
				toPlay: 4,
				captainId: 10,
				captainName: 'Captain',
				captainPoints: 12,
				score: {
					eventPoints: 42,
					netEventPoints: 42,
					totalPoints: 102,
					totalScope: 'CLASSIC_PHASE',
					eventRank: 10,
					overallRank: 100,
					leagueRank: 1,
					transferCost: 0,
					source: 'FPL_EVENT_LIVE',
					calculationMode: 'PROJECTED_AUTOSUBS',
					algorithmVersion: 'fpl-projected-autosubs-v1',
					provenance: {
						scoreSource: 'FPL_EVENT_LIVE',
						calculationMode: 'PROJECTED_AUTOSUBS',
						algorithmVersion: 'fpl-projected-autosubs-v1',
						inputRevision: 'input-1',
						scoreRevision: 'score-1',
						rankRevision: null,
						livePublicationId: '00000000-0000-4000-8000-000000000001',
						liveRevision: '1',
						liveCheckedAt: '2026-08-23T10:00:00.000Z',
						picksRevision: 'picks-1',
						picksCheckedAt: '2026-08-23T10:00:00.000Z',
						previousTotalsRevision: 'totals-1',
						previousTotalsThroughEventId: 0,
						resultRevision: null,
						resultCheckedAt: null,
						dataCheckedAt: null,
						rankSource: null,
						rankCheckedAt: null
					},
					state: 'FRESH',
					eventPointSemantics: 'NET',
					revision: 'managers-1',
					checkedAt: '2026-08-23T10:00:00.000Z',
					upstreamUpdatedAt: null,
					staleAt: null,
					nextRefreshAt: '2026-08-23T10:00:30.000Z',
					reconciliation: 'MATCHED',
					reasonCodes: []
				}
			}
		],
		viewerRow: null,
		...overrides
	}) satisfies EntryLiveCompetitionBoardPage

const scope = {
	sessionKey: 'session-a',
	season: '2026-27',
	eventId: 1,
	entryId: 6953,
	tournamentId: 99
}

const okResponse = () =>
	new Response(JSON.stringify({ entryLiveCompetitionBoard: page() }), {
		status: 200,
		headers: {
			'content-type': 'application/json',
			'x-request-id': 'req-board-1'
		}
	})

describe('live competition board contract', () => {
	it('keeps a paged viewer row in the validated response', () => {
		const viewerRow = page().rows[0]
		const parsed = parseEntryLiveCompetitionBoardPage(
			page({ rows: [], viewerRow })
		)
		assert.equal(parsed.viewerRow?.entry, 6953)
	})

	it('rejects malformed success payloads with the stable contract error', () => {
		assert.throws(
			() =>
				parseEntryLiveCompetitionBoardPage({
					entryLiveCompetitionBoard: { ...page(), boardRevision: undefined }
				}),
			(error: unknown) => {
				assert.ok(error instanceof LiveBoardInvalidResponseError)
				assert.equal(error.code, 'LIVE_BOARD_INVALID_RESPONSE')
				assert.deepEqual(error.missingFields, ['boardRevision'])
				return true
			}
		)
	})

	it('keeps last-good indefinitely but never crosses strict scope keys', () => {
		const storage = new MemoryStorage()
		writeLiveBoardLastGood(storage, scope, page())

		const key = liveBoardLastGoodKey(scope)
		const stored = JSON.parse(storage.getItem(key) ?? '{}') as Record<
			string,
			unknown
		>
		stored.savedAt = '2000-01-01T00:00:00.000Z'
		storage.setItem(key, JSON.stringify(stored))

		assert.equal(
			readLiveBoardLastGood(storage, scope)?.boardRevision,
			'board-1'
		)
		assert.equal(
			key,
			`letletme:live-board:last-good:${LIVE_BOARD_CONTRACT_VERSION}:session-a:2026-27:1:6953:99`
		)
		for (const changed of [
			{ sessionKey: 'session-b' },
			{ season: '2027-28' },
			{ eventId: 2 },
			{ entryId: 6954 },
			{ tournamentId: 100 }
		]) {
			assert.equal(
				readLiveBoardLastGood(storage, { ...scope, ...changed }),
				null
			)
		}
	})

	it('stores only a valid first page for the matching season, GW and event', () => {
		const storage = new MemoryStorage()
		writeLiveBoardLastGood(storage, scope, page({ page: 2 }))
		assert.equal(storage.length, 0)
		writeLiveBoardLastGood(storage, scope, page({ eventId: 2 }))
		assert.equal(storage.length, 0)
		writeLiveBoardLastGood(storage, scope, page())
		assert.equal(storage.length, 1)
	})

	it('never stores or restores an all-unavailable board as last-good data', () => {
		const storage = new MemoryStorage()
		const unavailable = page({
			managerRevision: null,
			managerDataAvailability: 'UNAVAILABLE',
			officialCoverage: 0,
			unavailableEntryCount: 65,
			partial: true
		})
		writeLiveBoardLastGood(storage, scope, unavailable)
		assert.equal(storage.length, 0)

		const key = liveBoardLastGoodKey(scope)
		storage.setItem(
			key,
			JSON.stringify({
				contractVersion: LIVE_BOARD_CONTRACT_VERSION,
				savedAt: '2026-08-23T10:00:00.000Z',
				page: unavailable
			})
		)
		assert.equal(readLiveBoardLastGood(storage, scope), null)
		assert.equal(storage.getItem(key), null)
	})
})

describe('live competition board request coordination', () => {
	it('rejects a load-more response after a replacement request starts', () => {
		assert.equal(isCurrentLiveBoardRequest(4, 5, '99:1', '99:1'), false)
		assert.equal(isCurrentLiveBoardRequest(5, 5, '99:1', '99:2'), false)
		assert.equal(isCurrentLiveBoardRequest(5, 5, '99:1', '99:1'), true)
	})

	it('stops automatic page-one replacement after more rows have been loaded', () => {
		assert.equal(shouldAutoRefreshLiveBoardPage(1), true)
		assert.equal(shouldAutoRefreshLiveBoardPage(2), false)
		assert.equal(shouldAutoRefreshLiveBoardPage(5), false)
		assert.equal(shouldAutoRefreshLiveBoardPage(null), false)
	})

	it('blocks pagination while a replacement query is in flight', () => {
		assert.equal(
			canLoadMoreLiveBoard({
				hasMore: true,
				isLoadingMore: false,
				replacementPending: true,
				rateLimited: false
			}),
			false
		)
		assert.equal(
			canLoadMoreLiveBoard({
				hasMore: true,
				isLoadingMore: false,
				replacementPending: false,
				rateLimited: false
			}),
			true
		)
	})

	it('coalesces heartbeat refreshes behind an active replacement request', () => {
		assert.equal(
			canStartLiveBoardRefresh({
				replacementPending: true,
				refreshPending: false
			}),
			false
		)
		assert.equal(
			canStartLiveBoardRefresh({
				replacementPending: false,
				refreshPending: false
			}),
			true
		)
	})

	it('refreshes only when the accepted board publication identity changes', () => {
		assert.equal(
			liveBoardPublicationChanged(
				{ eventId: 1, revision: '1230' },
				{ eventId: 1, revision: '1230' }
			),
			false
		)
		assert.equal(
			liveBoardPublicationChanged(
				{ eventId: 1, revision: '1230' },
				{ eventId: 1, revision: '1231' }
			),
			true
		)
		assert.equal(
			liveBoardPublicationChanged(
				{ eventId: 1, revision: '1230' },
				{ eventId: 1, revision: null }
			),
			false
		)
	})

	it('only synchronizes the search box while the triggering input is unchanged', () => {
		assert.equal(shouldSyncLiveBoardSearchInput('abc', 'abc'), true)
		assert.equal(shouldSyncLiveBoardSearchInput('abc', 'abcd'), false)
	})

	it('recognizes both current and legacy revision-expiry codes', () => {
		assert.equal(isLiveBoardRevisionGoneCode('LIVE_BOARD_REVISION_GONE'), true)
		assert.equal(isLiveBoardRevisionGoneCode('LIVE_REVISION_GONE'), true)
		assert.equal(isLiveBoardRevisionGoneCode('LIVE_BOARD_UNAVAILABLE'), false)
	})

	it('follows the live anchor until a future URL gameweek becomes selectable', () => {
		assert.deepEqual(
			resolveAnchoredGameweek({
				nextEvent: 6,
				requestedGameweek: 8,
				followsAnchor: true
			}),
			{ selectedGameweek: 6, followsAnchor: true }
		)
		assert.deepEqual(
			resolveAnchoredGameweek({
				nextEvent: 8,
				requestedGameweek: 8,
				followsAnchor: true
			}),
			{ selectedGameweek: 8, followsAnchor: false }
		)
	})

	it('treats a changed URL gameweek as authoritative selection state', () => {
		assert.deepEqual(
			resolveUrlGameweekSelection({ currentEvent: 8, requestedGameweek: 3 }),
			{ selectedGameweek: 3, followsAnchor: false }
		)
		assert.deepEqual(
			resolveUrlGameweekSelection({ currentEvent: 8, requestedGameweek: null }),
			{ selectedGameweek: 8, followsAnchor: true }
		)
	})
})

describe('live competition board retry policy', () => {
	it('retries a network failure once after a 400-800ms jitter', async () => {
		let calls = 0
		const sleeps: number[] = []
		const result = await fetchEntryLiveCompetitionBoard(
			99,
			{
				entryId: 6953,
				tournamentId: 99,
				eventId: 1
			},
			{
				fetchImpl: async () => {
					calls += 1
					if (calls === 1) throw new TypeError('temporary network failure')
					return okResponse()
				},
				random: () => 1,
				sleepImpl: async milliseconds => {
					sleeps.push(milliseconds)
				}
			}
		)

		assert.equal(result.boardRevision, 'board-1')
		assert.equal(calls, 2)
		assert.deepEqual(sleeps, [800])
	})

	it('retries 502 once but does not retry 429 or authentication errors', async () => {
		let transientCalls = 0
		const recovered = await fetchEntryLiveCompetitionBoard(
			99,
			{ entryId: 6953, tournamentId: 99, eventId: 1 },
			{
				fetchImpl: async () => {
					transientCalls += 1
					return transientCalls === 1
						? new Response(JSON.stringify({ error: 'UPSTREAM_UNAVAILABLE' }), {
								status: 502
							})
						: okResponse()
				},
				random: () => 0,
				sleepImpl: async milliseconds => assert.equal(milliseconds, 400)
			}
		)
		assert.equal(recovered.boardRevision, 'board-1')
		assert.equal(transientCalls, 2)

		for (const [status, retryAfter] of [
			[429, '17'],
			[401, null]
		] as const) {
			let calls = 0
			await assert.rejects(
				fetchEntryLiveCompetitionBoard(
					99,
					{ entryId: 6953, tournamentId: 99, eventId: 1 },
					{
						fetchImpl: async () => {
							calls += 1
							return new Response(JSON.stringify({ error: 'DENIED' }), {
								status,
								headers: retryAfter ? { 'retry-after': retryAfter } : undefined
							})
						}
					}
				),
				(error: unknown) => {
					assert.ok(error instanceof LiveBoardRequestError)
					assert.equal(error.status, status)
					assert.equal(error.retryAfterSeconds, retryAfter ? 17 : null)
					return true
				}
			)
			assert.equal(calls, 1)
		}
	})

	it('does not retry a malformed 200 payload', async () => {
		let calls = 0
		await assert.rejects(
			fetchEntryLiveCompetitionBoard(
				99,
				{ entryId: 6953, tournamentId: 99, eventId: 1 },
				{
					fetchImpl: async () => {
						calls += 1
						return new Response(JSON.stringify({ data: null }), { status: 200 })
					}
				}
			),
			(error: unknown) =>
				error instanceof LiveBoardInvalidResponseError &&
				error.code === 'LIVE_BOARD_INVALID_RESPONSE'
		)
		assert.equal(calls, 1)
	})
})
