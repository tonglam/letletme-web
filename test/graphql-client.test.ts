import assert from 'node:assert/strict'
import test from 'node:test'

import {
	clearPendingClientQueries,
	executeQuery,
	extractOperationName,
	GraphQLRequestError,
	normalizeGraphQLTimeoutMs
} from '@/lib/graphql-client'
import {
	clearDependencyCooldown,
	noteDependencyFailure,
	readDependencyCooldown
} from '@/lib/dependency-cooldown'
import { GET_GAMEWEEK_DESK } from '@/lib/graphql/operations/gameweek'
import { GET_HOME_GAMEWEEK } from '@/lib/graphql/operations/home'
import { GET_TOURNAMENT_DETAIL_DESK } from '@/lib/graphql/operations/tournaments'

test('normalizeGraphQLTimeoutMs matches the request deadline fallback', () => {
	assert.equal(normalizeGraphQLTimeoutMs(), 15_000)
	assert.equal(normalizeGraphQLTimeoutMs(5_000), 5_000)
	assert.equal(normalizeGraphQLTimeoutMs(0), 15_000)
	assert.equal(normalizeGraphQLTimeoutMs(Number.NaN), 15_000)
	assert.equal(normalizeGraphQLTimeoutMs(Number.POSITIVE_INFINITY), 15_000)
})

test('executeQuery aborts a stalled request at the configured deadline', async () => {
	const originalFetch = globalThis.fetch
	const originalError = console.error
	let observedAbort = false
	let observedLog: Record<string, unknown> | undefined
	console.error = (_message?: unknown, details?: unknown) => {
		if (details && typeof details === 'object') {
			observedLog = details as Record<string, unknown>
		}
	}

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
			executeQuery('query TimeoutProbe { __typename }', undefined, {
				timeoutMs: 5
			}),
			/GraphQL request timed out/
		)
		assert.equal(observedAbort, true)
		assert.equal(observedLog?.operation, 'TimeoutProbe')
		assert.equal(observedLog?.timeoutMs, 5)
		assert.equal(typeof observedLog?.durationMs, 'number')
		const stages = observedLog?.stages as Record<string, unknown>
		assert.equal(stages.responseHeadersMs, null)
		assert.equal(stages.responseBodyMs, null)
		assert.equal(typeof stages.timeoutFiredMs, 'number')
	} finally {
		globalThis.fetch = originalFetch
		console.error = originalError
	}
})

test('executeQuery classifies a response body timeout as REQUEST_TIMEOUT', async () => {
	const originalFetch = globalThis.fetch
	const originalError = console.error
	let diagnostic: Record<string, unknown> | undefined
	console.error = (_message, detail) => { diagnostic = detail }
	let cancelled = false
	globalThis.fetch = (async () =>
		new Response(
			new ReadableStream<Uint8Array>({
				pull: () => new Promise<void>(() => undefined),
				cancel: () => {
					cancelled = true
				}
			})
		)) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query BodyTimeoutProbe { __typename }', undefined, {
				timeoutMs: 5
			}),
			(error: unknown) =>
				error instanceof GraphQLRequestError && error.code === 'REQUEST_TIMEOUT'
		)
		assert.equal(cancelled, true)
		const stages = diagnostic?.stages as Record<string, unknown>
		assert.equal(typeof stages.responseHeadersMs, 'number')
		assert.equal(stages.responseBodyMs, null)
		assert.equal(typeof stages.timeoutFiredMs, 'number')
	} finally {
		globalThis.fetch = originalFetch
		console.error = originalError
	}
})

test('executeQuery classifies malformed JSON as INVALID_RESPONSE', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () =>
		new Response('not-json', { status: 200 })) as typeof fetch
	try {
		await assert.rejects(
			executeQuery('query InvalidResponseProbe { __typename }'),
			(error: unknown) =>
				error instanceof GraphQLRequestError &&
				error.code === 'INVALID_RESPONSE'
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery classifies malformed JSON on an error status as INVALID_RESPONSE', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () =>
		new Response('upstream-html', { status: 502 })) as typeof fetch
	try {
		await assert.rejects(
			executeQuery('query InvalidErrorResponseProbe { __typename }'),
			(error: unknown) =>
				error instanceof GraphQLRequestError &&
				error.status === 502 &&
				error.code === 'INVALID_RESPONSE'
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery keeps a response reader failure as NETWORK_ERROR', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = (async () =>
		new Response(
			new ReadableStream<Uint8Array>({
				pull: () => {
					throw new Error('body reader failed')
				}
			})
		)) as typeof fetch
	try {
		await assert.rejects(
			executeQuery('query ReaderFailureProbe { __typename }'),
			(error: unknown) =>
				error instanceof GraphQLRequestError && error.code === 'NETWORK_ERROR'
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('extractOperationName supports named GraphQL operations', () => {
	assert.equal(
		extractOperationName('query NamedProbe { __typename }'),
		'NamedProbe'
	)
	assert.equal(extractOperationName('{ __typename }'), undefined)
})

test('executeQuery sends the named GraphQL operation', async () => {
	const originalFetch = globalThis.fetch
	let requestBody: unknown
	globalThis.fetch = (async (
		_input: string | URL | Request,
		init?: RequestInit
	) => {
		requestBody = JSON.parse(String(init?.body))
		return Response.json({ data: { __typename: 'Query' } })
	}) as typeof fetch

	try {
		await executeQuery('query NamedProbe { __typename }')
		assert.deepEqual(requestBody, {
			operationName: 'NamedProbe',
			query: 'query NamedProbe { __typename }'
		})
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery sends the Live Points V2 header for every affected desk request', async () => {
	const originalFetch = globalThis.fetch
	const contractHeaders: Array<string | null> = []
	globalThis.fetch = (async (
		_input: string | URL | Request,
		init?: RequestInit
	) => {
		contractHeaders.push(new Headers(init?.headers).get('X-LetLetMe-Contract'))
		return Response.json({ data: {} })
	}) as typeof fetch

	try {
		await executeQuery(GET_GAMEWEEK_DESK, { eventId: 1 })
		await executeQuery(GET_HOME_GAMEWEEK, { eventId: 1 })
		await executeQuery(GET_TOURNAMENT_DETAIL_DESK, {
			tournamentId: 1,
			entryId: 1,
			eventId: 1
		})
		assert.deepEqual(contractHeaders, [
			'live-points-v2',
			'live-points-v2',
			'live-points-v2'
		])
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
			{
				status: 429,
				headers: {
					'Retry-After': '37',
					'X-RateLimit-Policy': 'graphql-v4',
					'X-RateLimit-Scope': 'workload',
					'X-RateLimit-Workload': 'player-stats'
				}
			}
		)) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query RateLimitProbe { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.status, 429)
				assert.equal(error.code, 'RATE_LIMITED')
				assert.equal(error.retryAfterSeconds, 37)
				assert.equal(error.rateLimitPolicy, 'graphql-v4')
				assert.equal(error.rateLimitScope, 'workload')
				assert.equal(error.rateLimitWorkload, 'player-stats')
				return true
			}
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('browser dependency failures cool down later requests without another fetch', async () => {
	const originalFetch = globalThis.fetch
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	const originalError = console.error
	const storage = new Map<string, string>()
	let calls = 0
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: {
			location: { origin: 'https://letletme.test' },
			sessionStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key)
			}
		}
	})
	console.error = () => undefined
	globalThis.fetch = (async () => {
		calls += 1
		return Response.json(
			{
				errors: [
					{
						message: 'Unavailable',
						extensions: { code: 'DEPENDENCY_UNAVAILABLE' }
					}
				]
			},
			{ status: 503, headers: { 'Retry-After': '300' } }
		)
	}) as typeof fetch
	clearPendingClientQueries()
	clearDependencyCooldown()

	try {
		await assert.rejects(
			executeQuery('query DependencyProbe { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.status, 503)
				assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE')
				assert.ok((error.retryAfterSeconds ?? 0) >= 299)
				return true
			}
		)
		await assert.rejects(
			executeQuery('query DependencyProbeRefresh { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.status, 503)
				assert.equal(error.code, 'DEPENDENCY_UNAVAILABLE')
				assert.ok((error.retryAfterSeconds ?? 0) >= 299)
				return true
			}
		)
		assert.equal(calls, 1)
	} finally {
		clearDependencyCooldown()
		clearPendingClientQueries()
		globalThis.fetch = originalFetch
		console.error = originalError
		if (originalWindow) {
			Object.defineProperty(globalThis, 'window', originalWindow)
		} else {
			Reflect.deleteProperty(globalThis, 'window')
		}
	}
})

test('optional browser reads do not fence or clear primary dependency cooldowns', async () => {
	const originalFetch = globalThis.fetch
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	const originalError = console.error
	const storage = new Map<string, string>()
	let calls = 0
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: {
			location: { origin: 'https://letletme.test' },
			sessionStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key)
			}
		}
	})
	console.error = () => undefined
	globalThis.fetch = (async () => {
		calls += 1
		if (calls === 1)
			return Response.json(
				{
					errors: [
						{
							message: 'Unavailable',
							extensions: { code: 'DEPENDENCY_UNAVAILABLE' }
						}
				]
				},
				{ status: 503, headers: { 'Retry-After': '300' } }
			)
		return Response.json({ data: { ok: true } })
	}) as typeof fetch
	clearPendingClientQueries()
	clearDependencyCooldown()

	try {
		await assert.rejects(
			executeQuery('query OptionalRankProbe { __typename }', undefined, {
				dependencyCooldown: 'neutral'
			})
		)
		assert.equal(readDependencyCooldown().active, false)
		assert.deepEqual(
			await executeQuery<{ ok: boolean }>(
				'query PrimaryReviewProbe { ok }'
			),
			{ ok: true }
		)
		assert.equal(calls, 2)

		noteDependencyFailure('300')
		assert.equal(readDependencyCooldown().active, true)
		await executeQuery('query OptionalRankSuccess { __typename }', undefined, {
			dependencyCooldown: 'neutral'
		})
		assert.equal(readDependencyCooldown().active, true)
	} finally {
		clearDependencyCooldown()
		clearPendingClientQueries()
		globalThis.fetch = originalFetch
		console.error = originalError
		if (originalWindow) {
			Object.defineProperty(globalThis, 'window', originalWindow)
		} else {
			Reflect.deleteProperty(globalThis, 'window')
		}
	}
})

test('a success that started before a newer failure cannot clear its cooldown', () => {
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	const storage = new Map<string, string>()
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: {
			sessionStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key)
			}
		}
	})
	try {
		clearDependencyCooldown()
		noteDependencyFailure('300', 2_000)
		clearDependencyCooldown(1_000)
		assert.equal(readDependencyCooldown(2_001).active, true)
		clearDependencyCooldown(3_000)
		assert.equal(readDependencyCooldown(3_001).active, false)
	} finally {
		clearDependencyCooldown()
		if (originalWindow)
			Object.defineProperty(globalThis, 'window', originalWindow)
		else Reflect.deleteProperty(globalThis, 'window')
	}
})

test('deterministic oversized responses do not cool down unrelated browser queries', async () => {
	const originalFetch = globalThis.fetch
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	const originalError = console.error
	const storage = new Map<string, string>()
	let calls = 0
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: {
			location: { origin: 'https://letletme.test' },
			sessionStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key)
			}
		}
	})
	console.error = () => undefined
	globalThis.fetch = (async () => {
		calls += 1
		return Response.json(
			{
				errors: [
					{
						message: 'Upstream response too large',
						extensions: { code: 'UPSTREAM_RESPONSE_TOO_LARGE' }
					}
				]
			},
			{ status: 502, headers: { 'Retry-After': '300' } }
		)
	}) as typeof fetch
	clearPendingClientQueries()
	clearDependencyCooldown()
	try {
		await assert.rejects(executeQuery('query OversizedProbeA { __typename }'))
		await assert.rejects(executeQuery('query OversizedProbeB { __typename }'))
		assert.equal(calls, 2)
		assert.equal(readDependencyCooldown().active, false)
	} finally {
		clearDependencyCooldown()
		clearPendingClientQueries()
		globalThis.fetch = originalFetch
		console.error = originalError
		if (originalWindow)
			Object.defineProperty(globalThis, 'window', originalWindow)
		else Reflect.deleteProperty(globalThis, 'window')
	}
})

test('executeQuery preserves a GraphQL error code on a successful HTTP response', async () => {
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
			{
				status: 200,
				headers: {
					'Retry-After': '19',
					'X-RateLimit-Policy': 'graphql-v4',
					'X-RateLimit-Scope': 'workload',
					'X-RateLimit-Workload': 'player-stats'
				}
			}
		)) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query RateLimitGraphQLErrorProbe { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.status, 200)
				assert.equal(error.code, 'RATE_LIMITED')
				assert.equal(error.retryAfterSeconds, 19)
				assert.equal(error.rateLimitPolicy, 'graphql-v4')
				assert.equal(error.rateLimitScope, 'workload')
				assert.equal(error.rateLimitWorkload, 'player-stats')
				return true
			}
		)
	} finally {
		globalThis.fetch = originalFetch
	}
})

test('executeQuery leaves deliberately handled GraphQL errors to the caller without console diagnostics', async () => {
	const originalFetch = globalThis.fetch
	const originalWarn = console.warn
	const originalError = console.error
	let warnings = 0
	let errors = 0
	console.warn = () => void (warnings += 1)
	console.error = () => void (errors += 1)
	globalThis.fetch = (async () =>
		Response.json({
			errors: [
				{
					message: 'Revision expired',
					extensions: { code: 'LIVE_REVISION_GONE' }
				}
			]
		})) as typeof fetch

	try {
		await assert.rejects(
			executeQuery('query RevisionProbe { __typename }', undefined, {
				handledErrorCodes: ['LIVE_REVISION_GONE']
			}),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.code, 'LIVE_REVISION_GONE')
				return true
			}
		)
		assert.equal(warnings, 0)
		assert.equal(errors, 0)
	} finally {
		globalThis.fetch = originalFetch
		console.warn = originalWarn
		console.error = originalError
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
		const query =
			'query SearchPlayersForPicker { playersForPicker { items { id } } }'
		await executeQuery(query)
		await executeQuery(query)
		assert.equal(calls, 1)

		const privateQuery =
			'query EntryParticipatingTournaments { entryParticipatingTournaments(entryId: 1) { id } }'
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

test('browser GraphQL errors never expose upstream resolver details', async () => {
	const originalFetch = globalThis.fetch
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	const originalWarn = console.warn
	const originalError = console.error
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: { location: { origin: 'https://letletme.test' } }
	})
	console.warn = () => undefined
	console.error = () => undefined
	globalThis.fetch = (async () =>
		Response.json({
			errors: [
				{
					message: 'relation private_table does not exist',
					extensions: { code: 'INTERNAL_SERVER_ERROR' }
				}
			]
		})) as typeof fetch
	clearPendingClientQueries()

	try {
		await assert.rejects(
			executeQuery('query SecretProbe { privateField }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.message, 'The data service is unavailable.')
				assert.equal(error.code, 'INTERNAL_SERVER_ERROR')
				assert.doesNotMatch(error.message, /private_table|relation/)
				return true
			}
		)
	} finally {
		clearPendingClientQueries()
		globalThis.fetch = originalFetch
		console.warn = originalWarn
		console.error = originalError
		if (originalWindow) {
			Object.defineProperty(globalThis, 'window', originalWindow)
		} else {
			Reflect.deleteProperty(globalThis, 'window')
		}
	}
})

test('browser network errors use a fixed public message', async () => {
	const originalFetch = globalThis.fetch
	const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
	const originalError = console.error
	Object.defineProperty(globalThis, 'window', {
		configurable: true,
		value: { location: { origin: 'https://letletme.test' } }
	})
	console.error = () => undefined
	globalThis.fetch = (async () => {
		throw new TypeError('Failed to fetch https://internal.example/graphql')
	}) as typeof fetch
	clearPendingClientQueries()

	try {
		await assert.rejects(
			executeQuery('query NetworkProbe { __typename }'),
			(error: unknown) => {
				assert.ok(error instanceof GraphQLRequestError)
				assert.equal(error.message, 'The data service is unavailable.')
				assert.equal(error.code, 'NETWORK_ERROR')
				assert.doesNotMatch(error.message, /Failed to fetch|internal\.example/)
				return true
			}
		)
	} finally {
		clearPendingClientQueries()
		globalThis.fetch = originalFetch
		console.error = originalError
		if (originalWindow) {
			Object.defineProperty(globalThis, 'window', originalWindow)
		} else {
			Reflect.deleteProperty(globalThis, 'window')
		}
	}
})

test('server slow-request stages separate header wait from body consumption', async () => {
	const originalFetch = globalThis.fetch
	const originalNow = Date.now
	const originalWarn = console.warn
	let clock = 10000
	let diagnostic: Record<string, unknown> | undefined
	Date.now = () => clock
	console.warn = (_message, detail) => { diagnostic = detail }
	globalThis.fetch = (async () => {
		clock += 2000
		return new Response(new ReadableStream<Uint8Array>({
			pull(controller) {
				clock += 3000
				controller.enqueue(new TextEncoder().encode(JSON.stringify({ data: { ok: true } })))
				controller.close()
			}
		}, { highWaterMark: 0 }), { headers: { 'x-request-id': 'stage-test' } })
	}) as typeof fetch
	try {
		assert.deepEqual(await executeQuery('query StageTimingProbe { ok }'), { ok: true })
		const stages = diagnostic?.stages as Record<string, number | null>
		assert.equal(diagnostic?.requestId, 'stage-test')
		assert.equal(stages.responseBodyMs, 5000)
		assert.equal(stages.timeoutFiredMs, null)
		assert.equal(stages.responseHeadersMs, 2000)
	} finally {
		globalThis.fetch = originalFetch
		Date.now = originalNow
		console.warn = originalWarn
	}
})
