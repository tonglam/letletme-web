import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import {
	buildIngressContextHeaders,
	buildOpaqueRateLimitSubject,
	PayloadTooLargeError,
	readBoundedBytes,
	readBoundedResponseBytes,
	readBoundedText,
	resolveProviderClientIp
} from '../../lib/http-security-core'

test('ignores spoofed forwarding headers outside verified provider boundaries', () => {
	const previousAuthUrl = process.env.BETTER_AUTH_URL
	process.env.BETTER_AUTH_URL = 'https://www.letletme.top'
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: 'evil.example',
				'cf-connecting-ip': '1.2.3.4',
				'cf-ray': 'spoofed'
			})
		),
		'unknown'
	)
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: 'www.letletme.top',
				'cf-connecting-ip': '1.2.3.4',
				'cf-ray': 'real-marker'
			})
		),
		'1.2.3.4'
	)
	process.env.BETTER_AUTH_URL = 'https://letletme.top'
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: 'www.letletme.top',
				'x-vercel-forwarded-for': '1.2.3.4',
				'x-vercel-id': 'syd1::abc'
			})
		),
		'1.2.3.4'
	)
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: 'evil.example',
				'x-vercel-forwarded-for': '1.2.3.4',
				'x-vercel-id': 'syd1::spoofed'
			})
		),
		'unknown'
	)
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: 'preview.vercel.app',
				'x-vercel-forwarded-for': '1.2.3.4',
				'x-vercel-id': 'iad1::abc'
			})
		),
		'1.2.3.4'
	)
	if (previousAuthUrl === undefined) delete process.env.BETTER_AUTH_URL
	else process.env.BETTER_AUTH_URL = previousAuthUrl
})

test('uses loopback as the local development client IP for Mini ingress', () => {
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: 'localhost:3001'
			})
		),
		'127.0.0.1'
	)
	assert.equal(
		resolveProviderClientIp(
			new Headers({
				host: '127.0.0.1:3001'
			})
		),
		'127.0.0.1'
	)
})

test('trusts one valid Nginx-injected IP only with the local proxy secret', () => {
	const previousAuthUrl = process.env.BETTER_AUTH_URL
	const previousProxySecret = process.env.LETLETME_LOCAL_PROXY_SECRET
	const previousPreviousProxySecret = process.env.LETLETME_LOCAL_PROXY_SECRET_PREVIOUS
	process.env.BETTER_AUTH_URL = 'https://letletme.top'
	process.env.LETLETME_LOCAL_PROXY_SECRET = 'local-proxy-secret'
	process.env.LETLETME_LOCAL_PROXY_SECRET_PREVIOUS = 'previous-proxy-secret'
	try {
		assert.equal(
			resolveProviderClientIp(
				new Headers({
					host: 'letletme.top',
					'x-letletme-proxy-client-ip': '203.0.113.7',
					'x-letletme-proxy-secret': 'local-proxy-secret'
				})
			),
			'203.0.113.7'
		)
		assert.equal(
			resolveProviderClientIp(
				new Headers({
					host: 'letletme.top',
					'x-letletme-proxy-client-ip': '203.0.113.7',
					'x-letletme-proxy-secret': 'previous-proxy-secret'
				})
			),
			'203.0.113.7'
		)
		assert.equal(
			resolveProviderClientIp(
				new Headers({
					host: 'letletme.top',
					'x-letletme-proxy-client-ip': '203.0.113.7',
					'x-letletme-proxy-secret': 'wrong-secret'
				})
			),
			'unknown'
		)
		assert.equal(
			resolveProviderClientIp(
				new Headers({
					host: 'letletme.top',
					'x-letletme-proxy-client-ip': '203.0.113.7, 198.51.100.2',
					'x-letletme-proxy-secret': 'local-proxy-secret'
				})
			),
			'unknown'
		)
		assert.equal(
			resolveProviderClientIp(
				new Headers({
					host: 'evil.example',
					'x-letletme-proxy-client-ip': '203.0.113.7',
					'x-letletme-proxy-secret': 'local-proxy-secret'
				})
			),
			'unknown'
		)
	} finally {
		if (previousAuthUrl === undefined) delete process.env.BETTER_AUTH_URL
		else process.env.BETTER_AUTH_URL = previousAuthUrl
		if (previousProxySecret === undefined) {
			delete process.env.LETLETME_LOCAL_PROXY_SECRET
		} else {
			process.env.LETLETME_LOCAL_PROXY_SECRET = previousProxySecret
		}
		if (previousPreviousProxySecret === undefined) {
			delete process.env.LETLETME_LOCAL_PROXY_SECRET_PREVIOUS
		} else {
			process.env.LETLETME_LOCAL_PROXY_SECRET_PREVIOUS = previousPreviousProxySecret
		}
	}
})

test('keeps rate-limit subjects distinct for clients behind the Tencent proxy', () => {
	const previousAuthUrl = process.env.BETTER_AUTH_URL
	const previousProxySecret = process.env.LETLETME_LOCAL_PROXY_SECRET
	process.env.BETTER_AUTH_URL = 'https://letletme.top'
	process.env.LETLETME_LOCAL_PROXY_SECRET = 'local-proxy-secret'
	try {
		const headersFor = (ip: string) =>
			new Headers({
				host: 'letletme.top',
				'x-letletme-proxy-client-ip': ip,
				'x-letletme-proxy-secret': 'local-proxy-secret'
			})
		assert.notEqual(
			buildOpaqueRateLimitSubject(headersFor('203.0.113.7'), 'rate-secret'),
			buildOpaqueRateLimitSubject(headersFor('198.51.100.2'), 'rate-secret')
		)
	} finally {
		if (previousAuthUrl === undefined) delete process.env.BETTER_AUTH_URL
		else process.env.BETTER_AUTH_URL = previousAuthUrl
		if (previousProxySecret === undefined) {
			delete process.env.LETLETME_LOCAL_PROXY_SECRET
		} else {
			process.env.LETLETME_LOCAL_PROXY_SECRET = previousProxySecret
		}
	}
})

test('opaque rate subjects and ingress signatures never contain raw IPs', () => {
	const headers = new Headers({
		host: 'preview.vercel.app',
		'x-vercel-forwarded-for': '1.2.3.4',
		'x-vercel-id': 'iad1::abc'
	})
	const subject = buildOpaqueRateLimitSubject(headers, 'secret')
	assert.match(subject, /^[a-f0-9]{64}$/)
	assert.equal(subject.includes('1.2.3.4'), false)
	const signed = buildIngressContextHeaders(subject, 'secret', 100)
	const payload = Buffer.from(
		signed['X-Ingress-Context'],
		'base64url'
	).toString()
	assert.deepEqual(JSON.parse(payload), {
		aud: 'letletme-graphql',
		sub: subject,
		iat: 100,
		exp: 160
	})
	assert.equal(
		signed['X-Ingress-Context-Sig'],
		createHmac('sha256', 'secret').update(payload).digest('base64url')
	)
})

test('bounded streaming rejects chunked bodies before full buffering', async () => {
	const request = new Request('http://localhost', {
		method: 'POST',
		body: new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('1234'))
				controller.enqueue(new TextEncoder().encode('5678'))
				controller.close()
			}
		}),
		duplex: 'half'
	} as RequestInit & { duplex: 'half' })
	await assert.rejects(() => readBoundedText(request, 6), PayloadTooLargeError)
})

test('bounded byte and upstream response readers enforce the hard cap', async () => {
	const request = new Request('http://localhost', {
		method: 'POST',
		body: new Uint8Array([1, 2, 3, 4]),
	})
	assert.deepEqual(await readBoundedBytes(request, 4), new Uint8Array([1, 2, 3, 4]))
	await assert.rejects(
		() => readBoundedResponseBytes(new Response(new Uint8Array(9)), 8),
		PayloadTooLargeError
	)
	assert.deepEqual(
		await readBoundedResponseBytes(new Response(new Uint8Array([5, 6])), 8),
		new Uint8Array([5, 6])
	)
})
