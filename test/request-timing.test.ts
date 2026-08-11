import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RequestTiming, resolveRequestId } from '../lib/request-timing'

describe('request timing diagnostics', () => {
	it('records deterministic stage durations', async () => {
		let now = 10
		const timing = new RequestTiming(() => now)
		await timing.measure('databaseRateLimit', async () => {
			now += 12.5
		})
		timing.measureSync('headerBuild', () => {
			now += 0.25
		})

		assert.deepEqual(timing.snapshot(), { databaseRateLimit: 12.5, headerBuild: 0.25 })
		assert.equal(timing.elapsedMs(), 12.75)
	})

	it('does not accept unbounded request identifiers', () => {
		assert.equal(resolveRequestId('proxy_123456', () => 'generated'), 'proxy_123456')
		assert.equal(resolveRequestId('bad id', () => 'generated'), 'generated')
	})
})
