import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { createLogoutRouteHandler } from '../lib/logout-route'

const signOutForm = readFileSync('components/layout/SignOutForm.tsx', 'utf8')

describe('Navbar logout route', () => {
	it('posts the localized fallback destination before client hydration', () => {
		assert.match(
			signOutForm,
			/<input type="hidden" name="redirectHref" value=\{redirectHref\} \/>/
		)
	})

	it('copies cleared auth cookies into a same-origin redirect', async () => {
		let calls = 0
		const handler = createLogoutRouteHandler(async () => {
			calls += 1
			return new Response(null, {
				headers: {
					'Set-Cookie':
						'__Secure-letletme.session_token=; Path=/; Max-Age=0; HttpOnly; Secure'
				}
			})
		})
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Origin: 'https://letletme.top',
					'Sec-Fetch-Site': 'same-origin'
				}
			})
		)
		assert.equal(response.status, 303)
		assert.equal(response.headers.get('location'), '/')
		assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/)
		assert.equal(calls, 1)
	})

	it('preserves a validated localized redirect for the no-JavaScript form', async () => {
		const handler = createLogoutRouteHandler(async () => new Response(null))
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Origin: 'https://letletme.top',
					'Sec-Fetch-Site': 'same-origin',
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({ redirectHref: '/zh-CN' })
			})
		)
		assert.equal(response.status, 303)
		assert.equal(response.headers.get('location'), '/zh-CN')
	})

	it('rejects an external no-JavaScript redirect target', async () => {
		const handler = createLogoutRouteHandler(async () => new Response(null))
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Origin: 'https://letletme.top',
					'Sec-Fetch-Site': 'same-origin',
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				body: new URLSearchParams({ redirectHref: 'https://attacker.example' })
			})
		)
		assert.equal(response.headers.get('location'), '/')
	})

	it('accepts a public HTTPS origin when the internal request URL is HTTP', async () => {
		let calls = 0
		const handler = createLogoutRouteHandler(async () => {
			calls += 1
			return new Response(null)
		})
		const response = await handler(
			new Request('http://127.0.0.1:3000/api/session/logout', {
				method: 'POST',
				headers: {
					Host: 'letletme.top',
					Origin: 'https://letletme.top',
					'X-Forwarded-Proto': 'http',
					'Sec-Fetch-Site': 'same-origin'
				}
			})
		)
		assert.equal(response.status, 303)
		assert.equal(response.headers.get('location'), '/')
		assert.equal(calls, 1)
	})

	it('rejects cross-site posts before touching Auth', async () => {
		let calls = 0
		const handler = createLogoutRouteHandler(async () => {
			calls += 1
			return new Response(null)
		})
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Origin: 'https://attacker.example',
					'Sec-Fetch-Site': 'cross-site'
				}
			})
		)
		assert.equal(response.status, 403)
		assert.equal(calls, 0)
	})

	it('rejects a trusted origin paired with an attacker referer', async () => {
		let calls = 0
		const handler = createLogoutRouteHandler(async () => {
			calls += 1
			return new Response(null)
		})
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Origin: 'https://letletme.top',
					Referer: 'https://attacker.example/form',
					'Sec-Fetch-Site': 'same-origin'
				}
			})
		)
		assert.equal(response.status, 403)
		assert.equal(calls, 0)
	})

	it('returns a non-redirecting success to the in-app sign-out control', async () => {
		const handler = createLogoutRouteHandler(async () =>
			new Response(null, {
				headers: {
					'Set-Cookie':
						'__Secure-letletme.session_token=; Path=/; Max-Age=0; HttpOnly; Secure'
				}
			})
		)
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					Origin: 'https://letletme.top',
					'Sec-Fetch-Site': 'same-origin'
				}
			})
		)
		assert.equal(response.status, 204)
		assert.equal(response.headers.get('location'), null)
		assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/)
	})

	it('does not redirect when Auth rejects the sign-out', async () => {
		const handler = createLogoutRouteHandler(async () =>
			Response.json({ error: 'origin mismatch' }, { status: 403 })
		)
		const response = await handler(
			new Request('https://letletme.top/api/session/logout', {
				method: 'POST',
				headers: {
					Origin: 'https://letletme.top',
					'Sec-Fetch-Site': 'same-origin'
				}
			})
		)
		assert.equal(response.status, 502)
		assert.equal(response.headers.get('cache-control'), 'no-store')
		assert.equal(response.headers.get('location'), null)
	})
})
