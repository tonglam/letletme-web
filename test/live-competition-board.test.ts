import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import type { EntryLiveCompetitionBoardPage } from '@/lib/graphql/operations/tournaments'
import {
	LIVE_BOARD_CONTRACT_VERSION,
	LiveBoardInvalidResponseError,
	LiveBoardRequestError,
	fetchEntryLiveCompetitionBoard,
	isCurrentLiveBoardRequest,
	isLiveBoardRevisionGoneCode,
	liveBoardLastGoodKey,
	parseEntryLiveCompetitionBoardPage,
	readLiveBoardLastGood,
	resolveAnchoredGameweek,
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
					source: 'FPL_CLASSIC_STANDINGS',
					state: 'LIVE',
					eventPointSemantics: 'OFFICIAL_NET',
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
