import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	GraphQLUpstreamError,
	readGraphQLUpstream
} from '../lib/graphql-proxy-upstream'
import { PayloadTooLargeError } from '../lib/http-security-core'

function timerHarness() {
	let callback: (() => void) | undefined
	let cleared = false
	return {
		setTimeoutImpl: ((handler: () => void) => {
			callback = handler
			return 1 as unknown as ReturnType<typeof setTimeout>
		}) as typeof globalThis.setTimeout,
		clearTimeoutImpl: (() => {
			cleared = true
		}) as typeof globalThis.clearTimeout,
		fire() {
			callback?.()
		},
		get cleared() {
			return cleared
		}
	}
}

describe('GraphQL upstream bounded read', () => {
	it('uses one timer for fetch and body and clears it after a fast response', async () => {
		const timers = timerHarness()
		const result = await readGraphQLUpstream({
			endpoint: 'http://upstream/graphql',
			init: { method: 'POST' },
			maxResponseBytes: 8,
			fetchImpl: async (_input, init) => {
				assert.ok(init?.signal)
				assert.equal(init.signal.aborted, false)
				return new Response(new Uint8Array([1, 2]))
			},
			setTimeoutImpl: timers.setTimeoutImpl,
			clearTimeoutImpl: timers.clearTimeoutImpl
		})
		assert.deepEqual(result.body, new Uint8Array([1, 2]))
		assert.equal(timers.cleared, true)
	})

	it('cancels a response stream when the shared timeout fires', async () => {
		const timers = timerHarness()
		let cancelled = false
		const result = readGraphQLUpstream({
			endpoint: 'http://upstream/graphql',
			init: { method: 'POST' },
			maxResponseBytes: 8,
			fetchImpl: async () =>
				new Response(
					new ReadableStream<Uint8Array>({
						cancel() {
							cancelled = true
						}
					})
				),
			setTimeoutImpl: timers.setTimeoutImpl,
			clearTimeoutImpl: timers.clearTimeoutImpl
		})
		timers.fire()
		await assert.rejects(
			result,
			(error: unknown) =>
				error instanceof GraphQLUpstreamError && error.code === 'timeout'
		)
		assert.equal(cancelled, true)
		assert.equal(timers.cleared, true)
	})

	it('cancels the upstream immediately when the client disconnects', async () => {
		const timers = timerHarness()
		const client = new AbortController()
		let upstreamSignal: AbortSignal | undefined
		const result = readGraphQLUpstream({
			endpoint: 'http://upstream/graphql',
			init: { method: 'POST' },
			requestSignal: client.signal,
			maxResponseBytes: 8,
			fetchImpl: async (_input, init) => {
				upstreamSignal = init?.signal ?? undefined
				return new Response(new ReadableStream<Uint8Array>())
			},
			setTimeoutImpl: timers.setTimeoutImpl,
			clearTimeoutImpl: timers.clearTimeoutImpl
		})
		client.abort()
		await assert.rejects(
			result,
			(error: unknown) =>
				error instanceof GraphQLUpstreamError && error.code === 'client-abort'
		)
		assert.equal(upstreamSignal?.aborted, true)
		assert.equal(timers.cleared, true)
	})

	it('preserves the hard 8 MiB boundary and rejects the first byte over it', async () => {
		const exact = await readGraphQLUpstream({
			endpoint: 'http://upstream/graphql',
			init: { method: 'POST' },
			maxResponseBytes: 8,
			fetchImpl: async () => new Response(new Uint8Array(8))
		})
		assert.equal(exact.body.byteLength, 8)
		await assert.rejects(
			() =>
				readGraphQLUpstream({
					endpoint: 'http://upstream/graphql',
					init: { method: 'POST' },
					maxResponseBytes: 8,
					fetchImpl: async () => new Response(new Uint8Array(9))
				}),
			PayloadTooLargeError
		)
	})
})
