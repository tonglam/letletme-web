import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import {
	clearPlayerStatsDeskClientCache,
	requestPlayerStatsDesk
} from '../lib/player-stats-desk-client'

const originalFetch = globalThis.fetch
const responseBody = {
	eventId: 1,
	horizon: 5,
	section: 'overview' as const,
	entries: [
		{ playerId: 13, overview: { id: 13 }, state: { playerId: 13 } },
		{ playerId: 27, overview: { id: 27 }, state: { playerId: 27 } }
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
})
