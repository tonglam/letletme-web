import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
	ENTRY_SYNC_MAX_RETRY_AFTER_SECONDS,
	requestEntryInfoSync,
	syncEntryAfterBind,
} from '../lib/entry-sync'

const ENV_KEYS = ['LETLETME_DATA_URL', 'LETLETME_DATA_API_KEY'] as const

type FetchCall = { url: string; init?: RequestInit }

let savedEnv: Record<string, string | undefined>
let savedFetch: typeof globalThis.fetch
let savedWarn: typeof console.warn
let savedInfo: typeof console.info
let fetchCalls: FetchCall[]
let warnCalls: string[]
let infoCalls: string[]

const stubFetch = (
	impl: (url: string, init?: RequestInit) => Promise<Response>
) => {
	globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
		const url = String(input)
		fetchCalls.push({ url, init })
		return impl(url, init)
	}) as typeof globalThis.fetch
}

beforeEach(() => {
	savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
	for (const key of ENV_KEYS) delete process.env[key]
	savedFetch = globalThis.fetch
	savedWarn = console.warn
	savedInfo = console.info
	fetchCalls = []
	warnCalls = []
	infoCalls = []
	console.warn = (...args: unknown[]) =>
		warnCalls.push(args.map(String).join(' '))
	console.info = (...args: unknown[]) =>
		infoCalls.push(args.map(String).join(' '))
})

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (savedEnv[key] === undefined) delete process.env[key]
		else process.env[key] = savedEnv[key]
	}
	globalThis.fetch = savedFetch
	console.warn = savedWarn
	console.info = savedInfo
})

describe('requestEntryInfoSync', () => {
	it('posts to the configured base URL with the configured API key', async () => {
		process.env.LETLETME_DATA_URL = 'http://data:4001/'
		process.env.LETLETME_DATA_API_KEY = 'k1'
		stubFetch(
			async () =>
				new Response(
					'{"success":true,"status":"queued","jobId":"entry-info-6953"}',
					{
						status: 202
					}
				)
		)

		const result = await requestEntryInfoSync(6953)

		assert.deepEqual(result, {
			ok: true,
			status: 'queued',
			jobId: 'entry-info-6953'
		})
		assert.equal(fetchCalls.length, 1)
		assert.equal(fetchCalls[0].url, 'http://data:4001/entry-info/6953/sync')
		assert.equal(fetchCalls[0].init?.method, 'POST')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), 'k1')
	})

	it('rejects a synchronous success response outside the canonical contract', async () => {
		stubFetch(async () => new Response('{}', { status: 200 }))

		const result = await requestEntryInfoSync(42)

		assert.deepEqual(result, {
			ok: false,
			retryable: false,
			errorCode: 'INVALID_RESPONSE',
			reason: 'entry sync contract requires HTTP 202, received 200'
		})
		assert.equal(fetchCalls[0].url, 'http://127.0.0.1:4001/entry-info/42/sync')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), null)
	})

	it('defaults to localhost:4001 and sends no key when nothing is configured', async () => {
		stubFetch(
			async () =>
				new Response('{"status":"queued","jobId":"entry-info-7"}', {
					status: 202
				})
		)

		const result = await requestEntryInfoSync(7)

		assert.deepEqual(result, {
			ok: true,
			status: 'queued',
			jobId: 'entry-info-7'
		})
		assert.equal(fetchCalls[0].url, 'http://127.0.0.1:4001/entry-info/7/sync')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), null)
	})

	it('returns a non-retryable hint on 401 without throwing', async () => {
		stubFetch(async () => new Response('unauthorized', { status: 401 }))

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) {
			assert.match(result.reason, /401|LETLETME_DATA_API_KEY/)
			assert.equal(result.retryable, false)
		}
	})

	it('reports server errors with the status code as retryable', async () => {
		stubFetch(async () => new Response('boom', { status: 500 }))

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) {
			assert.match(result.reason, /500/)
			assert.equal(result.retryable, true)
		}
	})

	it('reports throttling responses as retryable and preserves Retry-After', async () => {
		stubFetch(
			async () =>
				new Response('slow down', {
					status: 429,
					headers: { 'Retry-After': '37' }
				})
		)

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) {
			assert.equal(result.retryable, true)
			assert.equal(result.retryAfterSeconds, 37)
		}
	})

	it('bounds an oversized Retry-After before it reaches durable scheduling', async () => {
		stubFetch(
			async () =>
				new Response('slow down', {
					status: 429,
					headers: { 'Retry-After': '1e100' },
				})
		)

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok)
			assert.equal(
				result.retryAfterSeconds,
				ENTRY_SYNC_MAX_RETRY_AFTER_SECONDS
			)
	})

	it('rejects a malformed queued response as retryable', async () => {
		stubFetch(
			async () =>
				new Response('{"success":true,"status":"queued"}', { status: 202 })
		)

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) {
			assert.match(result.reason, /invalid queued response/)
			assert.equal(result.retryable, true)
		}
	})

	it('reports client errors as non-retryable', async () => {
		stubFetch(async () => new Response('not found', { status: 404 }))

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) assert.equal(result.retryable, false)
	})

	it('reports unavailability when the service is down and never throws', async () => {
		stubFetch(async () => {
			throw new Error('connect ECONNREFUSED')
		})

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) {
			assert.match(result.reason, /unavailable/)
			assert.equal(result.retryable, true)
		}
	})

	it('aborts after the injected timeout', async () => {
		stubFetch(
			(_url, init) =>
				new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
					})
				})
		)

		const result = await requestEntryInfoSync(6953, { timeoutMs: 5 })

		assert.equal(result.ok, false)
		if (!result.ok) assert.match(result.reason, /timed out/)
	})

	it('cancels a response body that stalls after headers', async () => {
		let cancelled = false
		stubFetch(
			async () =>
				new Response(
					new ReadableStream<Uint8Array>({
						pull: () => new Promise<void>(() => undefined),
						cancel: () => {
							cancelled = true
						}
					}),
					{ status: 202 }
				)
		)

		const result = await requestEntryInfoSync(6953, { timeoutMs: 5 })

		assert.deepEqual(result, {
			ok: false,
			retryable: true,
			errorCode: 'REQUEST_TIMEOUT',
			reason: 'timed out after 0.005s: http://127.0.0.1:4001'
		})
		assert.equal(cancelled, true)
	})

	it('classifies a caller cancellation during response body reading', async () => {
		const signalController = new AbortController()
		let cancelled = false
		stubFetch(
			async () =>
				new Response(
					new ReadableStream<Uint8Array>({
						pull: () => new Promise<void>(() => undefined),
						cancel: () => {
							cancelled = true
						}
					}),
					{ status: 202 }
				)
		)

		const resultPromise = requestEntryInfoSync(6953, {
			timeoutMs: 500,
			signal: signalController.signal
		})
		signalController.abort()
		const result = await resultPromise

		assert.deepEqual(result, {
			ok: false,
			retryable: true,
			errorCode: 'REQUEST_CANCELLED',
			reason: 'cancelled while syncing: http://127.0.0.1:4001'
		})
		assert.equal(cancelled, true)
	})
})

describe('syncEntryAfterBind', () => {
	it('warns with the [entry-sync] prefix on failure and does not throw', async () => {
		stubFetch(async () => {
			throw new Error('connect ECONNREFUSED')
		})

		await syncEntryAfterBind(6953, { retryDelaysMs: [] })

		assert.equal(warnCalls.length, 1)
		assert.match(warnCalls[0], /\[entry-sync\]/)
	})

	it('attempts a transient failure once and leaves retry to the durable outbox', async () => {
		stubFetch(async () => new Response('boom', { status: 500 }))

		await syncEntryAfterBind(6953, { retryDelaysMs: [1, 1] })

		assert.equal(fetchCalls.length, 1)
		assert.equal(warnCalls.length, 1)
		assert.equal(infoCalls.length, 0)
	})

	it('does not retry non-retryable failures', async () => {
		stubFetch(async () => new Response('unauthorized', { status: 401 }))

		await syncEntryAfterBind(6953, { retryDelaysMs: [1, 1] })

		assert.equal(fetchCalls.length, 1)
		assert.equal(warnCalls.length, 1)
	})

	it('reports one bounded attempt without sleeping or retrying', async () => {
		stubFetch(async () => new Response('boom', { status: 503 }))

		await syncEntryAfterBind(6953, { retryDelaysMs: [1, 1] })

		assert.equal(fetchCalls.length, 1)
		assert.match(warnCalls[0], /after 1 attempt\(s\)/)
	})
})
