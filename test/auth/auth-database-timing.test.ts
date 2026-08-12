import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	instrumentAuthDatabaseAdapter,
	withAuthDatabaseTiming
} from '../../lib/auth-database-timing'

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
})
