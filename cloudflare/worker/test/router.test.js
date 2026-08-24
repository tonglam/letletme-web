import assert from 'node:assert/strict'
import test from 'node:test'

import { fetchVercel } from '../src/router.js'

const env = {
	VERCEL_ORIGIN_HOST: 'letletme-web.vercel.app',
	VERCEL_PROXY_SECRET: 'trusted-secret',
	EDGE_MARKER: 'cloudflare-fallback'
}

test('pass-through strips client-controlled internal headers and injects trusted IP', async () => {
	let forwarded
	const response = await fetchVercel(
		new Request('https://letletme.top/en/explore', {
			headers: {
				host: 'letletme.top',
				'cf-connecting-ip': '203.0.113.7',
				'x-letletme-proxy-client-ip': '198.51.100.8',
				'x-letletme-proxy-secret': 'spoofed',
				'x-letletme-origin-token': 'spoofed'
			}
		}),
		env,
		async request => {
			forwarded = request
			return new Response('ok', {
				headers: {
					Location: 'https://letletme-web.vercel.app/login',
					'Server-Timing': 'upstream;dur=12',
					'X-Letletme-Release': 'f669312c2906abaf4b7ec105528b7a81e2743d9c'
				}
			})
		}
	)

	assert.equal(new URL(forwarded.url).hostname, env.VERCEL_ORIGIN_HOST)
	assert.equal(forwarded.headers.get('host'), 'letletme.top')
	assert.equal(
		forwarded.headers.get('x-letletme-proxy-client-ip'),
		'203.0.113.7'
	)
	assert.equal(
		forwarded.headers.get('x-letletme-proxy-secret'),
		'trusted-secret'
	)
	assert.equal(forwarded.headers.has('x-letletme-origin-token'), false)
	assert.equal(response.headers.get('x-letletme-edge'), 'cloudflare-fallback')
	assert.equal(response.headers.get('x-letletme-origin'), 'vercel')
	assert.equal(response.headers.get('location'), 'https://letletme.top/login')
	assert.match(response.headers.get('server-timing') ?? '', /upstream;dur=12/)
	assert.match(response.headers.get('server-timing') ?? '', /edge-origin;dur=/)
})

test('forwards POST bodies without reading them', async () => {
	let body
	await fetchVercel(
		new Request('https://letletme.top/api/graphql', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: '{"query":"{__typename}"}'
		}),
		env,
		async request => {
			body = await request.text()
			return new Response('ok')
		}
	)
	assert.equal(body, '{"query":"{__typename}"}')
})

test('does not manufacture trusted proxy headers without a valid Cloudflare IP', async () => {
	let forwarded
	await fetchVercel(
		new Request('https://letletme.top/healthz', {
			headers: {
				'x-letletme-proxy-client-ip': 'spoofed',
				'x-letletme-proxy-secret': 'spoofed'
			}
		}),
		env,
		async request => {
			forwarded = request
			return new Response('ok')
		}
	)
	assert.equal(forwarded.headers.has('x-letletme-proxy-client-ip'), false)
	assert.equal(forwarded.headers.has('x-letletme-proxy-secret'), false)
})
