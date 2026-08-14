import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createLogoutRouteHandler } from '../lib/logout-route'

describe('Navbar logout route', () => {
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
		assert.equal(response.headers.get('location'), 'https://letletme.top/')
		assert.match(response.headers.get('set-cookie') ?? '', /Max-Age=0/)
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
