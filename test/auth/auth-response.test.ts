import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { withPrivateNoStore } from '../../lib/auth-response'

describe('auth response cache policy', () => {
	it('marks successful auth responses private and non-cacheable', () => {
		const response = withPrivateNoStore(Response.json({ session: null }))

		assert.equal(
			response.headers.get('cache-control'),
			'private, no-store, max-age=0'
		)
		assert.equal(response.headers.get('pragma'), 'no-cache')
		assert.equal(response.headers.get('expires'), '0')
	})

	it('preserves status, retry metadata, and cookies', () => {
		const response = new Response(null, {
			status: 429,
			headers: {
				'Retry-After': '45',
				'Set-Cookie': 'letletme.session_token=token; HttpOnly'
			}
		})
		const wrapped = withPrivateNoStore(response)

		assert.equal(wrapped.status, 429)
		assert.equal(wrapped.headers.get('retry-after'), '45')
		assert.match(wrapped.headers.get('set-cookie') ?? '', /HttpOnly/)
	})

	it('clones immutable redirect headers before applying the policy', () => {
		const redirect = Response.redirect(
			'https://letletme.top/onboarding/bind-entry',
			302
		)

		const wrapped = withPrivateNoStore(redirect)

		assert.equal(wrapped.status, 302)
		assert.equal(
			wrapped.headers.get('location'),
			'https://letletme.top/onboarding/bind-entry'
		)
		assert.equal(
			wrapped.headers.get('cache-control'),
			'private, no-store, max-age=0'
		)
	})

	it('normalizes Better Auth retry metadata to the standard header', () => {
		const response = withPrivateNoStore(
			new Response(null, {
				status: 429,
				headers: { 'X-Retry-After': '10' }
			})
		)

		assert.equal(response.headers.get('retry-after'), '10')
	})
})
