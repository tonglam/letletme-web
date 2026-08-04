import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import {
	countEntrySyncResults,
	requestEntryInfoSync,
	syncEntryAfterBind,
} from '../lib/entry-sync'

const ENV_KEYS = [
	'LETLETME_DATA_URL',
	'LETLETME_DATA_API_KEY',
	'TOURNAMENT_API_BASE_URL',
	'TOURNAMENT_API_KEY',
] as const

type FetchCall = { url: string; init?: RequestInit }

let savedEnv: Record<string, string | undefined>
let savedFetch: typeof globalThis.fetch
let savedWarn: typeof console.warn
let savedInfo: typeof console.info
let fetchCalls: FetchCall[]
let warnCalls: string[]
let infoCalls: string[]

const stubFetch = (impl: (url: string, init?: RequestInit) => Promise<Response>) => {
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
	console.warn = (...args: unknown[]) => warnCalls.push(args.map(String).join(' '))
	console.info = (...args: unknown[]) => infoCalls.push(args.map(String).join(' '))
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
				new Response('{"success":true,"status":"queued","jobId":"entry-info-6953"}', {
					status: 202,
				}),
		)

		const result = await requestEntryInfoSync(6953)

		assert.deepEqual(result, { ok: true, status: 'queued', jobId: 'entry-info-6953' })
		assert.equal(fetchCalls.length, 1)
		assert.equal(fetchCalls[0].url, 'http://data:4001/entry-info/6953/sync')
		assert.equal(fetchCalls[0].init?.method, 'POST')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), 'k1')
	})

	it('falls back to the tournament env vars when dedicated ones are unset', async () => {
		process.env.TOURNAMENT_API_BASE_URL = 'http://127.0.0.1:4001'
		process.env.TOURNAMENT_API_KEY = 't-key'
		stubFetch(async () => new Response('{}', { status: 200 }))

		const result = await requestEntryInfoSync(42)

		assert.deepEqual(result, { ok: true, status: 'completed', jobId: null })
		assert.equal(fetchCalls[0].url, 'http://127.0.0.1:4001/entry-info/42/sync')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), 't-key')
	})

	it('defaults to localhost:4001 and sends no key when nothing is configured', async () => {
		stubFetch(async () => new Response('{}', { status: 200 }))

		const result = await requestEntryInfoSync(7)

		assert.deepEqual(result, { ok: true, status: 'completed', jobId: null })
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

	it('rejects a malformed queued response as retryable', async () => {
		stubFetch(async () => new Response('{"success":true,"status":"queued"}', { status: 202 }))

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
				}),
		)

		const result = await requestEntryInfoSync(6953, { timeoutMs: 5 })

		assert.equal(result.ok, false)
		if (!result.ok) assert.match(result.reason, /timed out/)
	})
})

describe('countEntrySyncResults', () => {
	it('keeps queued work separate from completed synchronization', () => {
		assert.deepEqual(
			countEntrySyncResults([
				{ ok: true, status: 'queued', jobId: 'job-1' },
				{ ok: true, status: 'queued', jobId: 'job-2' },
				{ ok: true, status: 'completed', jobId: null },
				{ ok: false, retryable: true, reason: 'unavailable' },
			]),
			{ completed: 1, queued: 2, failed: 1 },
		)
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

	it('retries a transient failure and succeeds on a later attempt', async () => {
		let calls = 0
		stubFetch(async () => {
			calls += 1
		return calls < 3
				? new Response('boom', { status: 500 })
				: new Response('{"success":true,"status":"queued","jobId":"job-3"}', {
						status: 202,
					})
		})

		await syncEntryAfterBind(6953, { retryDelaysMs: [1, 1] })

		assert.equal(fetchCalls.length, 3)
		assert.equal(warnCalls.length, 0)
		assert.equal(infoCalls.length, 1)
		assert.match(infoCalls[0], /\[entry-sync\] queued entry 6953 as job job-3/)
	})

	it('does not retry non-retryable failures', async () => {
		stubFetch(async () => new Response('unauthorized', { status: 401 }))

		await syncEntryAfterBind(6953, { retryDelaysMs: [1, 1] })

		assert.equal(fetchCalls.length, 1)
		assert.equal(warnCalls.length, 1)
	})

	it('gives up after the configured attempts and reports the count', async () => {
		stubFetch(async () => new Response('boom', { status: 503 }))

		await syncEntryAfterBind(6953, { retryDelaysMs: [1, 1] })

		assert.equal(fetchCalls.length, 3)
		assert.match(warnCalls[0], /after 3 attempt\(s\)/)
	})
})
