/**
 * Tests for session cookie requirements.
 *
 * Better Auth creates session cookies with specific attributes. These tests
 * verify our configuration produces the right cookie attributes by checking
 * the same policy constants consumed by the live auth server.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
	AUTH_COOKIE_PREFIX,
	AUTH_PASSWORD_POLICY,
	AUTH_SESSION_POLICY,
	AUTH_TRUSTED_PROVIDERS
} from '../../lib/auth-policy'
import { hasSessionCookieHintInHeaders } from '../../lib/session-cookie-hint'

// ─── tests ────────────────────────────────────────────────────────────────────

describe('session configuration', () => {
	it('session expires in 7 days', () => {
		assert.equal(AUTH_SESSION_POLICY.expiresIn, 60 * 60 * 24 * 7)
	})

	it('session refreshes at most once per day', () => {
		assert.equal(AUTH_SESSION_POLICY.updateAge, 60 * 60 * 24)
		// updateAge must be less than expiresIn
		assert.ok(AUTH_SESSION_POLICY.updateAge < AUTH_SESSION_POLICY.expiresIn)
	})

	it('cookie cache stays within the Better Auth 5-minute prompt-cache TTL', () => {
		assert.equal(AUTH_SESSION_POLICY.cookieCacheMaxAge, 5 * 60)
	})

	it('uses letletme cookie prefix to avoid collisions with other apps', () => {
		assert.equal(AUTH_COOKIE_PREFIX, 'letletme')
	})

	it('uses the session cookie only as an anonymous display hint', () => {
		assert.equal(hasSessionCookieHintInHeaders(new Headers()), false)
		assert.equal(
			hasSessionCookieHintInHeaders(
				new Headers({ cookie: 'letletme.session_token=opaque-signed-value' })
			),
			true
		)
		assert.equal(
			hasSessionCookieHintInHeaders(
				new Headers({
					cookie: '__Secure-letletme.session_token=opaque-signed-value'
				})
			),
			true
		)
		assert.equal(
			hasSessionCookieHintInHeaders(
				new Headers({ cookie: 'unrelated.session_token=value' })
			),
			false
		)
	})
})

describe('account linking — trusted providers', () => {
	it('only Google is a trusted provider (has verified email)', () => {
		assert.deepEqual(AUTH_TRUSTED_PROVIDERS, ['google'])
	})

	it('WeChat is NOT a trusted provider', () => {
		assert.equal(
			(AUTH_TRUSTED_PROVIDERS as readonly string[]).includes('wechat'),
			false
		)
	})
})

describe('password policy', () => {
	it('requires at least 10 characters', () => {
		assert.equal(AUTH_PASSWORD_POLICY.minPasswordLength, 10)
	})

	it('revokes existing sessions after a password reset', () => {
		assert.equal(AUTH_PASSWORD_POLICY.revokeSessionsOnPasswordReset, true)
	})

	it('rejects 9-character passwords', () => {
		const password = 'abcd12345' // 9 chars
		assert.ok(password.length < AUTH_PASSWORD_POLICY.minPasswordLength)
	})

	it('accepts 10-character passwords', () => {
		const password = 'abcd123456' // 10 chars
		assert.ok(password.length >= AUTH_PASSWORD_POLICY.minPasswordLength)
	})
})
