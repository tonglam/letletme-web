import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
	clearPlayerStatsDeskClientCache,
	primePlayerStatsDeskCache,
	requestPlayerStatsDesk
} from '../lib/player-stats-desk-client'

const originalFetch = globalThis.fetch
const responseBody = {
	eventId: 1,
	horizon: 5,
	section: 'overview' as const,
	entries: [
		{
			playerId: 13,
			overview: {
				id: 13,
				dataAvailability: {
					isFullyAuthoritative: true,
					seasonStats: { state: 'READY' },
					market: { state: 'READY' },
					historicalTeam: { state: 'READY' },
					fixtures: { state: 'READY' },
					recentGameweeks: { state: 'READY' }
				}
			},
			state: { playerId: 13 }
		},
		{
			playerId: 27,
			overview: {
				id: 27,
				dataAvailability: {
					isFullyAuthoritative: true,
					seasonStats: { state: 'READY' },
					market: { state: 'READY' },
					historicalTeam: { state: 'READY' },
					fixtures: { state: 'READY' },
					recentGameweeks: { state: 'READY' }
				}
			},
			state: { playerId: 27 }
		}
	],
	unavailablePlayerIds: []
}

afterEach(() => {
	globalThis.fetch = originalFetch
	clearPlayerStatsDeskClientCache()
})

describe('player stats desk client cache', () => {
	it('deduplicates a canonical two-player request and serves the next read without a network call', async () => {
		let calls = 0
		let release: (() => void) | undefined
		const gate = new Promise<void>(resolve => {
			release = resolve
		})
		globalThis.fetch = async () => {
			calls += 1
			await gate
			return Response.json(responseBody)
		}

		const first = requestPlayerStatsDesk({
			playerIds: [13, 27],
			eventId: 1,
			section: 'overview'
		})
		const second = requestPlayerStatsDesk({
			playerIds: [27, 13],
			eventId: 1,
			horizon: 5,
			section: 'overview'
		})
		assert.equal(calls, 1)
		release?.()
		const [firstResult, secondResult] = await Promise.all([first, second])
		assert.deepEqual(firstResult, secondResult)

		await requestPlayerStatsDesk({
			playerIds: [13, 27],
			eventId: 1,
			section: 'overview'
		})
		assert.equal(calls, 1)
	})

	it('aborts the shared fetch only after every abortable consumer leaves', async () => {
		let upstreamAborted = false
		globalThis.fetch = (_input, init) =>
			new Promise<Response>((_resolve, reject) => {
				const signal = init?.signal
				signal?.addEventListener(
					'abort',
					() => {
						upstreamAborted = true
						reject(new DOMException('Aborted', 'AbortError'))
					},
					{ once: true }
				)
			})
		const firstController = new AbortController()
		const secondController = new AbortController()
		const first = requestPlayerStatsDesk(
			{ playerIds: [13], eventId: 1, section: 'recent' },
			{ signal: firstController.signal }
		)
		const second = requestPlayerStatsDesk(
			{ playerIds: [13], eventId: 1, section: 'recent' },
			{ signal: secondController.signal }
		)

		firstController.abort()
		await Promise.resolve()
		assert.equal(upstreamAborted, false)
		secondController.abort()
		const settled = await Promise.allSettled([first, second])
		assert.equal(upstreamAborted, true)
		assert.ok(settled.every(result => result.status === 'rejected'))
	})

	it('starts a fresh request after an aborted generation without letting old cleanup evict it', async () => {
		let calls = 0
		globalThis.fetch = (_input, init) => {
			calls += 1
			if (calls === 1) {
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener(
						'abort',
						() => reject(new DOMException('Aborted', 'AbortError')),
						{ once: true }
					)
				})
			}
			return Promise.resolve(Response.json(responseBody))
		}
		const controller = new AbortController()
		const abandoned = requestPlayerStatsDesk(
			{ playerIds: [13, 27], eventId: 1, section: 'overview' },
			{ signal: controller.signal }
		)
		controller.abort()
		const replacement = requestPlayerStatsDesk({
			playerIds: [27, 13],
			eventId: 1,
			section: 'overview'
		})

		await assert.rejects(abandoned, { name: 'AbortError' })
		assert.deepEqual(await replacement, responseBody)
		await requestPlayerStatsDesk({
			playerIds: [13, 27],
			eventId: 1,
			section: 'overview'
		})
		assert.equal(calls, 2)
	})

	it('bypasses the browser cache for an explicit retry', async () => {
		let calls = 0
		const seenCaches: RequestCache[] = []
		const seenHeaders: Headers[] = []
		globalThis.fetch = async (_input, init) => {
			calls += 1
			seenCaches.push(init?.cache ?? 'default')
			seenHeaders.push(new Headers(init?.headers))
			return Response.json(responseBody)
		}
		const input = { playerIds: [13], eventId: 1, section: 'overview' as const }
		await requestPlayerStatsDesk(input)
		await requestPlayerStatsDesk(input, { bypassCache: true })
		await requestPlayerStatsDesk(input)
		assert.equal(calls, 2)
		assert.deepEqual(seenCaches, ['default', 'no-store'])
		assert.equal(seenHeaders[1]?.get('cache-control'), 'no-cache')
	})

	it('does not cache a response whose overview is not authoritative', async () => {
		let calls = 0
		const degradedResponse = {
			...responseBody,
			entries: responseBody.entries.map(entry => ({
				...entry,
				overview: {
					...entry.overview,
					dataAvailability: { isFullyAuthoritative: false }
				}
			}))
		}
		globalThis.fetch = async () => {
			calls += 1
			return Response.json(degradedResponse)
		}
		const input = {
			playerIds: [13, 27],
			eventId: 1,
			section: 'overview' as const
		}
		primePlayerStatsDeskCache(input, degradedResponse as never)
		await requestPlayerStatsDesk(input)
		await requestPlayerStatsDesk(input)
		assert.equal(calls, 2)
	})

	it('does not cache a process response without an overview authority object', async () => {
		let calls = 0
		const processResponse = {
			...responseBody,
			section: 'process' as const,
			entries: [
				{
					playerId: 13,
					evidence: { id: 13 },
					state: { playerId: 13 }
				}
			],
			unavailablePlayerIds: []
		}
		globalThis.fetch = async () => {
			calls += 1
			return Response.json(processResponse)
		}
		const input = { playerIds: [13], eventId: 1, section: 'process' as const }
		await requestPlayerStatsDesk(input)
		await requestPlayerStatsDesk(input)
		assert.equal(calls, 2)
	})
})
