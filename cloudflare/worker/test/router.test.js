import assert from 'node:assert/strict'
import test from 'node:test'

import {
	isTencentCandidate,
	routeRequest
} from '../src/router.js'

const baseEnv = {
	ROUTER_MODE: 'cn-router',
	ORIGIN_TOKEN: 'origin-token',
	TENCENT_ORIGIN_HOST: 'tencent-origin.letletme.top',
	TENCENT_TIMEOUT_MS: '20',
	VERCEL_ORIGIN_HOST: 'letletme-web.vercel.app',
	VERCEL_PROXY_SECRET: 'vercel-proxy-secret',
	ROUTER_VERSION: 'test',
	EXPECTED_RELEASE_SHA: 'abc1234'
}

function quietOptions(options = {}) {
	return { logger: () => {}, country: 'CN', ...options }
}

test('routes only mainland safe reads to Tencent', () => {
	assert.equal(
		isTencentCandidate(new Request('https://letletme.top/en/explore'), 'CN'),
		true
	)
	for (const request of [
		new Request('https://letletme.top/api'),
		new Request('https://letletme.top/api/graphql'),
		new Request(
			'https://letletme.top/.well-known/acme-challenge/token'
		),
		new Request('https://letletme.top/.well-known/acme-challenge'),
		new Request('https://letletme.top/en/profile', {
			method: 'POST',
			body: 'server-action'
		}),
		new Request('https://letletme.top/socket', {
			headers: { Upgrade: 'websocket' }
		})
	]) {
		assert.equal(isTencentCandidate(request, 'CN'), false)
	}
	assert.equal(
		isTencentCandidate(new Request('https://letletme.top/en/explore'), null),
		false
	)
	assert.equal(
		isTencentCandidate(new Request('https://letletme.top/en/explore'), 'AU'),
		false
	)
})

test('passes request bodies through to Vercel without reading or retaining internal headers', async () => {
	let forwardedBody
	const response = await routeRequest(
		new Request('https://letletme.top/api/graphql', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'x-letletme-origin-token': 'spoofed',
				'x-letletme-proxy-secret': 'spoofed'
			},
			body: JSON.stringify({ query: '{ __typename }' })
		}),
		baseEnv,
		quietOptions({
			fetchImpl: async request => {
				assert.equal(
					new URL(request.url).hostname,
					'letletme-web.vercel.app'
				)
				assert.equal(request.headers.has('x-letletme-origin-token'), false)
				assert.equal(request.headers.has('x-letletme-proxy-secret'), false)
				assert.equal(request.headers.has('x-letletme-proxy-client-ip'), false)
				forwardedBody = await request.text()
				return new Response('vercel')
			}
		})
	)
	assert.equal(forwardedBody, JSON.stringify({ query: '{ __typename }' }))
	assert.equal(response.headers.get('x-letletme-origin'), 'vercel')
})

test('authenticates the original client IP on the cross-zone Vercel hop', async () => {
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore', {
			headers: {
				'cf-connecting-ip': '203.0.113.7',
				'x-letletme-proxy-client-ip': 'spoofed',
				'x-letletme-proxy-secret': 'spoofed'
			}
		}),
		{ ...baseEnv, ROUTER_MODE: 'pass-through' },
		quietOptions({
			fetchImpl: async request => {
				assert.equal(
					new URL(request.url).hostname,
					'letletme-web.vercel.app'
				)
				assert.equal(
					request.headers.get('x-letletme-proxy-client-ip'),
					'203.0.113.7'
				)
				assert.equal(
					request.headers.get('x-letletme-proxy-secret'),
					'vercel-proxy-secret'
				)
				return new Response('vercel')
			}
		})
	)
	assert.equal(await response.text(), 'vercel')
})

test('streams Tencent response bodies without waiting for completion', async () => {
	const body = new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode('first'))
		}
	})
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore'),
		baseEnv,
		quietOptions({
			fetchImpl: async () =>
				new Response(body, {
					headers: { 'X-Letletme-Release': 'abc1234' }
				})
		})
	)
	const reader = response.body.getReader()
	const first = await reader.read()
	assert.equal(new TextDecoder().decode(first.value), 'first')
	await reader.cancel()
})

test('overwrites internal headers and uses resolveOverride for Tencent', async () => {
	const calls = []
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore', {
			headers: {
				'cf-connecting-ip': '203.0.113.7',
				'x-letletme-origin-token': 'spoofed',
				'x-letletme-client-ip': '198.51.100.2',
				'x-letletme-proxy-secret': 'spoofed'
			}
		}),
		baseEnv,
		quietOptions({
			fetchImpl: async (request, init) => {
				calls.push({ request, init })
				return new Response('tencent', {
					headers: { 'X-Letletme-Release': 'abc1234' }
				})
			}
		})
	)
	assert.equal(calls.length, 1)
	assert.equal(
		calls[0].init.cf.resolveOverride,
		'tencent-origin.letletme.top'
	)
	assert.equal(
		calls[0].request.headers.get('x-letletme-origin-token'),
		'origin-token'
	)
	assert.equal(
		calls[0].request.headers.get('x-letletme-client-ip'),
		'203.0.113.7'
	)
	assert.equal(calls[0].request.headers.has('x-letletme-proxy-secret'), false)
	assert.equal(response.headers.get('x-letletme-origin'), 'tencent')
	assert.equal(response.headers.get('x-letletme-release'), 'abc1234')
	assert.equal(await response.text(), 'tencent')
})

test('falls back once on Tencent 5xx', async () => {
	let calls = 0
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore'),
		baseEnv,
		quietOptions({
			fetchImpl: async () => {
				calls += 1
				return calls === 1
					? new Response('failed', { status: 503 })
					: new Response('vercel', {
							headers: { 'X-Letletme-Release': 'abc1234' }
						})
			}
		})
	)
	assert.equal(calls, 2)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get('x-letletme-origin'), 'vercel-fallback')
	assert.equal(await response.text(), 'vercel')
})

test('does not fall back on 4xx or 429', async () => {
	for (const status of [404, 429]) {
		let calls = 0
		const response = await routeRequest(
			new Request('https://letletme.top/en/explore'),
			baseEnv,
			quietOptions({
				fetchImpl: async () => {
					calls += 1
					return new Response('client response', {
						status,
						headers: { 'X-Letletme-Release': 'abc1234' }
					})
				}
			})
		)
		assert.equal(calls, 1)
		assert.equal(response.status, status)
		assert.equal(response.headers.get('x-letletme-origin'), 'tencent')
	}
})

test('falls back when Tencent serves a missing or mismatched release', async () => {
	for (const releaseHeader of [undefined, 'old-release']) {
		let calls = 0
		const response = await routeRequest(
			new Request('https://letletme.top/en/explore'),
			baseEnv,
			quietOptions({
				fetchImpl: async () => {
					calls += 1
					return calls === 1
						? new Response('wrong Tencent release', {
								status: 200,
								headers: releaseHeader
									? { 'X-Letletme-Release': releaseHeader }
									: undefined
							})
						: new Response('vercel', {
							headers: { 'X-Letletme-Release': 'abc1234' }
						})
				}
			})
		)
		assert.equal(calls, 2)
		assert.equal(response.headers.get('x-letletme-origin'), 'vercel-fallback')
		assert.equal(await response.text(), 'vercel')
	}
})

test('falls back when Tencent has no response headers before the timeout', async () => {
	let calls = 0
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore'),
		baseEnv,
		quietOptions({
			fetchImpl: async (_request, init) => {
				calls += 1
				if (calls === 2) return new Response('vercel')
				return await new Promise((resolve, reject) => {
					init.signal.addEventListener('abort', () => reject(init.signal.reason))
				})
			}
		})
	)
	assert.equal(calls, 2)
	assert.equal(response.headers.get('x-letletme-origin'), 'vercel-fallback')
})

test('pass-through mode and non-China requests use only Vercel', async () => {
	for (const [env, country] of [
		[{ ...baseEnv, ROUTER_MODE: 'pass-through' }, 'CN'],
		[baseEnv, 'AU'],
		[baseEnv, null]
	]) {
		let calls = 0
		const response = await routeRequest(
			new Request('https://letletme.top/en/explore'),
			env,
			quietOptions({
				country,
				fetchImpl: async (_request, init) => {
					calls += 1
					assert.equal(init.cf.resolveOverride, undefined)
					return new Response('vercel')
				}
			})
		)
		assert.equal(calls, 1)
		assert.equal(response.headers.get('x-letletme-origin'), 'vercel')
	}
})

test('restores the public origin in Vercel response headers', async () => {
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore'),
		{ ...baseEnv, ROUTER_MODE: 'pass-through' },
		quietOptions({
			fetchImpl: async () =>
				new Response('redirect', {
					status: 302,
					headers: {
						Location: 'https://letletme-web.vercel.app/login',
						Link: '<https://letletme-web.vercel.app/>; rel="canonical"'
					}
				})
		})
	)
	assert.equal(response.headers.get('location'), 'https://letletme.top/login')
	assert.equal(
		response.headers.get('link'),
		'<https://letletme.top/>; rel="canonical"'
	)
})

test('does not trust a client-supplied CF-IPCountry header when cf data is absent', async () => {
	let calls = 0
	const response = await routeRequest(
		new Request('https://letletme.top/en/explore', {
			headers: { 'CF-IPCountry': 'CN' }
		}),
		baseEnv,
		{
			logger: () => {},
			fetchImpl: async (_request, init) => {
				calls += 1
				assert.equal(init.cf.resolveOverride, undefined)
				return new Response('vercel')
			}
		}
	)
	assert.equal(calls, 1)
	assert.equal(response.headers.get('x-letletme-origin'), 'vercel')
})
