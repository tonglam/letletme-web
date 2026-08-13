import assert from 'node:assert/strict'
import test from 'node:test'

import {
	clearPendingClientQueries,
	executeQuery,
	GraphQLRequestError
} from '@/lib/graphql-client'

test('executeQuery aborts a stalled request at the configured deadline', async () => {
	const originalFetch = globalThis.fetch
	let observedAbort = false

	globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) =>
		new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => {
				observedAbort = true
				const error = new Error('aborted')
				error.name = 'AbortError'
				reject(error)
			})
		})) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query TimeoutProbe { __typename }', undefined, { timeoutMs: 5 }),
			/GraphQL request timed out/,
		)
		assert.equal(observedAbort, true)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery sends the named GraphQL operation', async () => {
	const originalFetch = globalThis.fetch
	let requestBody: unknown
	globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
		requestBody = JSON.parse(String(init?.body))
		return Response.json({ data: { __typename: 'Query' } })
	}) as typeof fetch

	try {
		await executeQuery('query NamedProbe { __typename }')
		assert.deepEqual(requestBody, {
			operationName: 'NamedProbe',
			query: 'query NamedProbe { __typename }',
		})
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery preserves HTTP status, GraphQL code, and Retry-After', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () =>
		Response.json(
			{
				errors: [
					{
						message: 'Rate limit exceeded',
						extensions: { code: 'RATE_LIMITED' }
					}
				]
			},
			{ status: 429, headers: { 'Retry-After': '37' } }
		)) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query RateLimitProbe { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.status, 429)
				assert.equal(error.code, 'RATE_LIMITED')
				assert.equal(error.retryAfterSeconds, 37)
				return true
			}
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery preserves a GraphQL error code on a successful HTTP response', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () =>
		Response.json({
			errors: [
				{
					message: 'Forbidden',
					extensions: { code: 'FORBIDDEN' }
				}
			]
		})) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query ForbiddenProbe { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.status, 200)
				assert.equal(error.code, 'FORBIDDEN')
				return true
			}
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery caches only allowlisted public browser responses', async () => {
	const originalFetch = globalThis.fetch
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	let calls = 0
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: { location: { origin: 'https://letletme.test' } }
	})
	globalThis.fetch = (async () => {
		calls += 1
		return Response.json({ data: { playersForPicker: { items: [] } } })
	}) as typeof fetch
	clearPendingClientQueries()

	try {
		const query = 'query SearchPlayersForPicker { playersForPicker { items { id } } }'
		await executeQuery(query)
		await executeQuery(query)
		assert.equal(calls, 1)

		const privateQuery = 'query EntryTournaments { entryTournaments { id } }'
		await executeQuery(privateQuery)
		await executeQuery(privateQuery)
		assert.equal(calls, 3)
	} finally {
		clearPendingClientQueries()
		globalThis.fetch = originalFetch
		if (originalWindow) {
			Object.defineProperty(globalThis, 'window', originalWindow)
		} else {
			Reflect.deleteProperty(globalThis, 'window')
		}
	}
})

test('executeQuery exposes caller cancellation without reporting a timeout', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = ((_input: string | URL | Request, init?: RequestInit) =>
		new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => {
				const error = new Error('aborted')
				error.name = 'AbortError'
				reject(error)
			})
		})) as typeof fetch
	const controller = new AbortController()

	try {
		const request = executeQuery(
			'query CancelledProbe { __typename }',
			undefined,
			{ signal: controller.signal }
		)
		controller.abort()
		await assert.rejects(request, (error: unknown) => {
			assert.ok(error instanceof GraphQLRequestError)
			assert.equal(error.code, 'REQUEST_CANCELLED')
			return true
		})
	} finally {
		globalThis.fetch = originalFetch
	}
})
