import assert from 'node:assert/strict'
import test from 'node:test'

import { executeQuery } from '@/lib/graphql-client'

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
