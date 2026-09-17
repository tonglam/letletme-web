import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	instrumentAuthDatabaseAdapter,
	withAuthDatabaseTiming
} from '../../lib/auth-database-timing'
import {
	AuthorizationSessionTimeoutError,
	withAuthorizationSessionDeadline
} from '../../lib/auth-session-deadline'

describe('Better Auth database timing', () => {
	it('times adapter work only inside the request-local timing context', async () => {
		const events: string[] = []
		const adapterFactory = instrumentAuthDatabaseAdapter(() => ({
			id: 'test-adapter',
			findOne: async () => ({ id: 'session' })
		}))
		const adapter = adapterFactory()

		assert.deepEqual(await adapter.findOne(), { id: 'session' })
		assert.equal(events.length, 0)

		const result = await withAuthDatabaseTiming(
			() => {
				events.push('start')
				return () => events.push('stop')
			},
			() => adapter.findOne()
		)
		assert.deepEqual(result, { id: 'session' })
		assert.deepEqual(events, ['start', 'stop'])
	})

	it('stops timing when an adapter call rejects', async () => {
		let stopped = false
		const adapterFactory = instrumentAuthDatabaseAdapter(() => ({
			id: 'test-adapter',
			findOne: async () => {
				throw new Error('database unavailable')
			}
		}))
		const adapter = adapterFactory()

		await assert.rejects(
			withAuthDatabaseTiming(
				() => () => {
					stopped = true
				},
				() => adapter.findOne()
			),
			/database unavailable/
		)
		assert.equal(stopped, true)
	})

	it('returns before a stalled session lookup and observes its eventual settlement', async () => {
		let resolve!: (value: string) => void
		const operation = new Promise<string>((finish) => {
			resolve = finish
		})
		await assert.rejects(
			withAuthorizationSessionDeadline(operation, { timeoutMs: 5 }),
			(error: unknown) => error instanceof AuthorizationSessionTimeoutError
		)
		resolve('late')
	})

	it('cancels the request-local deadline when the request is aborted', async () => {
		const controller = new AbortController()
		const operation = new Promise<string>(() => undefined)
		const pending = withAuthorizationSessionDeadline(operation, {
			timeoutMs: 1_000,
			signal: controller.signal
		})
		controller.abort()
		await assert.rejects(
			pending,
			(error: unknown) => error instanceof AuthorizationSessionTimeoutError
		)
	})
})
