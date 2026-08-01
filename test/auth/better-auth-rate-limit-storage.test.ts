import assert from 'node:assert/strict'
import test from 'node:test'

import {
	buildBetterAuthRateLimitSubject,
	createBetterAuthRateLimitStorage
} from '../../lib/better-auth-rate-limit-storage'

test('Better Auth rate-limit keys are opaque and atomically consumed', async () => {
	let received: Record<string, unknown> | undefined
	const storage = createBetterAuthRateLimitStorage({
		resolveSecret: () => 'test-secret',
		consumeDatabaseRateLimit: async options => {
			received = options
			return { allowed: false, retryAfterSeconds: 17 }
		}
	})

	const result = await storage.consume('203.0.113.9|/get-session', {
		window: 60,
		max: 100
	})
	assert.deepEqual(result, { allowed: false, retryAfter: 17 })
	assert.deepEqual(received, {
		scope: 'better-auth',
		subject: buildBetterAuthRateLimitSubject(
			'203.0.113.9|/get-session',
			60,
			'test-secret'
		),
		limit: 100,
		windowSeconds: 60
	})
	assert.match(String(received?.subject), /^[a-f0-9]{64}$/)
	assert.equal(String(received?.subject).includes('203.0.113.9'), false)
})

test('Better Auth storage returns no retry delay for an allowed request', async () => {
	const storage = createBetterAuthRateLimitStorage({
		resolveSecret: () => 'test-secret',
		consumeDatabaseRateLimit: async () => ({
			allowed: true,
			retryAfterSeconds: 60
		})
	})

	assert.deepEqual(
		await storage.consume('unknown|/get-session', { window: 60, max: 100 }),
		{ allowed: true, retryAfter: null }
	)
})
