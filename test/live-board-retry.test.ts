import assert from 'node:assert/strict'
import test from 'node:test'

import {
	fetchEntryLiveCompetitionBoard,
	LiveBoardRequestError
} from '@/lib/tournament/live-board'

const variables = {
	entryId: 1,
	tournamentId: 2,
	eventId: 3
}

test('live board honors a long Retry-After before the only transient retry', async () => {
	let requests = 0
	const sleeps: number[] = []

	await assert.rejects(
		fetchEntryLiveCompetitionBoard(2, variables, {
			fetchImpl: (async () => {
				requests += 1
				return new Response(
					JSON.stringify({ error: 'DEPENDENCY_UNAVAILABLE' }),
					{ status: 503, headers: { 'Retry-After': '300' } }
				)
			}) as typeof fetch,
			sleepImpl: async milliseconds => {
				sleeps.push(milliseconds)
			}
		}),
		error =>
			error instanceof LiveBoardRequestError &&
			error.status === 503 &&
			error.retryAfterSeconds === 300
	)

	assert.equal(requests, 2)
	assert.deepEqual(sleeps, [300_000])
})

test('live board uses the bounded 30 second fallback without Retry-After', async () => {
	let requests = 0
	const sleeps: number[] = []

	await assert.rejects(
		fetchEntryLiveCompetitionBoard(2, variables, {
			fetchImpl: (async () => {
				requests += 1
				return new Response(
					JSON.stringify({ error: 'DEPENDENCY_UNAVAILABLE' }),
					{ status: 502 }
				)
			}) as typeof fetch,
			sleepImpl: async milliseconds => {
				sleeps.push(milliseconds)
			}
		}),
		error => error instanceof LiveBoardRequestError && error.status === 502
	)

	assert.equal(requests, 2)
	assert.deepEqual(sleeps, [30_000])
})

test('live board aborts while waiting for a long retry delay', async () => {
	const controller = new AbortController()
	let requests = 0
	let releaseSleep!: () => void
	const pendingSleep = new Promise<void>(resolve => {
		releaseSleep = resolve
	})
	const promise = fetchEntryLiveCompetitionBoard(2, variables, {
		signal: controller.signal,
		fetchImpl: (async () => {
			requests += 1
			return new Response(JSON.stringify({ error: 'DEPENDENCY_UNAVAILABLE' }), {
				status: 503,
				headers: { 'Retry-After': '300' }
			})
		}) as typeof fetch,
		sleepImpl: async () => pendingSleep
	})

	await new Promise<void>(resolve => setImmediate(resolve))
	controller.abort()
	await assert.rejects(
		promise,
		error => error instanceof Error && error.name === 'AbortError'
	)
	assert.equal(requests, 1)
	releaseSleep()
})
