import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'

import { requestEntryInfoSync, syncEntryAfterBind } from '../lib/entry-sync'

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
let fetchCalls: FetchCall[]
let warnCalls: string[]

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
	fetchCalls = []
	warnCalls = []
	console.warn = (...args: unknown[]) => warnCalls.push(args.map(String).join(' '))
})

afterEach(() => {
	for (const key of ENV_KEYS) {
		if (savedEnv[key] === undefined) delete process.env[key]
		else process.env[key] = savedEnv[key]
	}
	globalThis.fetch = savedFetch
	console.warn = savedWarn
})

describe('requestEntryInfoSync', () => {
	it('posts to the configured base URL with the configured API key', async () => {
		process.env.LETLETME_DATA_URL = 'http://data:4001/'
		process.env.LETLETME_DATA_API_KEY = 'k1'
		stubFetch(async () => new Response('{"success":true}', { status: 200 }))

		const result = await requestEntryInfoSync(6953)

		assert.deepEqual(result, { ok: true })
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

		assert.equal(result.ok, true)
		assert.equal(fetchCalls[0].url, 'http://127.0.0.1:4001/entry-info/42/sync')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), 't-key')
	})

	it('defaults to localhost:4001 and sends no key when nothing is configured', async () => {
		stubFetch(async () => new Response('{}', { status: 200 }))

		const result = await requestEntryInfoSync(7)

		assert.equal(result.ok, true)
		assert.equal(fetchCalls[0].url, 'http://127.0.0.1:4001/entry-info/7/sync')
		const headers = new Headers(fetchCalls[0].init?.headers)
		assert.equal(headers.get('x-api-key'), null)
	})

	it('returns a hint on 401 without throwing', async () => {
		stubFetch(async () => new Response('unauthorized', { status: 401 }))

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) assert.match(result.reason, /401|LETLETME_DATA_API_KEY/)
	})

	it('reports server errors with the status code', async () => {
		stubFetch(async () => new Response('boom', { status: 500 }))

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) assert.match(result.reason, /500/)
	})

	it('reports unavailability when the service is down and never throws', async () => {
		stubFetch(async () => {
			throw new Error('connect ECONNREFUSED')
		})

		const result = await requestEntryInfoSync(6953)

		assert.equal(result.ok, false)
		if (!result.ok) assert.match(result.reason, /unavailable/)
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

describe('syncEntryAfterBind', () => {
	it('warns with the [entry-sync] prefix on failure and does not throw', async () => {
		stubFetch(async () => {
			throw new Error('connect ECONNREFUSED')
		})

		await syncEntryAfterBind(6953)

		assert.equal(warnCalls.length, 1)
		assert.match(warnCalls[0], /\[entry-sync\]/)
	})
})
