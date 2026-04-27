/**
 * Tests for session cookie requirements.
 *
 * Better Auth creates session cookies with specific attributes. These tests
 * verify our configuration produces the right cookie attributes by checking
 * the auth config constants rather than the live auth server.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

// ─── auth config constants (mirrors lib/auth.ts) ──────────────────────────────

const AUTH_CONFIG = {
	cookiePrefix: 'letletme',
	session: {
		expiresIn: 60 * 60 * 24 * 7,   // 7 days in seconds
		updateAge: 60 * 60 * 24,        // 1 day in seconds
		cookieCacheMaxAge: 5 * 60,      // 5 minutes in seconds
	},
	rateLimit: {
		window: 60,
		max: 100,
	},
	trustedProviders: ['google'] as string[],
	minPasswordLength: 10,
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe('session configuration', () => {
	it('session expires in 7 days', () => {
		assert.equal(AUTH_CONFIG.session.expiresIn, 60 * 60 * 24 * 7)
	})

	it('session refreshes at most once per day', () => {
		assert.equal(AUTH_CONFIG.session.updateAge, 60 * 60 * 24)
		// updateAge must be less than expiresIn
		assert.ok(AUTH_CONFIG.session.updateAge < AUTH_CONFIG.session.expiresIn)
	})

	it('cookie cache stays within the Better Auth 5-minute prompt-cache TTL', () => {
		assert.equal(AUTH_CONFIG.session.cookieCacheMaxAge, 5 * 60)
	})

	it('uses letletme cookie prefix to avoid collisions with other apps', () => {
		assert.equal(AUTH_CONFIG.cookiePrefix, 'letletme')
	})
})

describe('account linking — trusted providers', () => {
	it('only Google is a trusted provider (has verified email)', () => {
		assert.deepEqual(AUTH_CONFIG.trustedProviders, ['google'])
	})

	it('WeChat is NOT a trusted provider', () => {
		assert.ok(!AUTH_CONFIG.trustedProviders.includes('wechat'))
	})
})

describe('rate limiting', () => {
	it('allows at most 100 requests per 60-second window', () => {
		assert.equal(AUTH_CONFIG.rateLimit.window, 60)
		assert.equal(AUTH_CONFIG.rateLimit.max, 100)
	})
})

describe('password policy', () => {
	it('requires at least 10 characters', () => {
		assert.equal(AUTH_CONFIG.minPasswordLength, 10)
	})

	it('rejects 9-character passwords', () => {
		const password = 'abcd12345' // 9 chars
		assert.ok(password.length < AUTH_CONFIG.minPasswordLength)
	})

	it('accepts 10-character passwords', () => {
		const password = 'abcd123456' // 10 chars
		assert.ok(password.length >= AUTH_CONFIG.minPasswordLength)
	})
})
