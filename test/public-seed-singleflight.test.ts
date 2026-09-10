import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	coalescePublicSeed,
	isPublicSeedFill,
} from '../lib/public-seed-singleflight'

describe('public seed cold-fill coalescing', () => {
	it('runs one origin request for twenty concurrent callers of one cache key', async () => {
		let originCalls = 0
		let release: (() => void) | undefined
		const gate = new Promise<void>(resolve => {
			release = resolve
		})
		const callers = Array.from({ length: 20 }, () =>
			coalescePublicSeed('player-stats:fixture-window:31:5', async () => {
				originCalls += 1
				await gate
				return { ok: true }
			})
		)
		await new Promise(resolve => setImmediate(resolve))
		assert.equal(originCalls, 1)
		release?.()
		assert.deepEqual(
			await Promise.all(callers),
			Array.from({ length: 20 }, () => ({ ok: true }))
		)
	})

	it('does not retain failed fills', async () => {
		let originCalls = 0
		await assert.rejects(() =>
			coalescePublicSeed('failed-seed', async () => {
				originCalls += 1
				throw new Error('upstream 429')
			})
		)
		await assert.rejects(() =>
			coalescePublicSeed('failed-seed', async () => {
				originCalls += 1
				throw new Error('upstream 429')
			})
		)
		assert.equal(originCalls, 2)
	})

	it('marks only the shared cold-fill work as independent of callers', async () => {
		let observedInside = false
		const result = await coalescePublicSeed('context-seed', async () => {
			observedInside = isPublicSeedFill()
			await new Promise<void>(resolve => setImmediate(resolve))
			return isPublicSeedFill()
		})

		assert.equal(observedInside, true)
		assert.equal(result, true)
		assert.equal(isPublicSeedFill(), false)
	})
})
