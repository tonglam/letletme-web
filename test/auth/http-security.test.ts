import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

import {
	buildIngressContextHeaders,
	buildOpaqueRateLimitSubject,
	PayloadTooLargeError,
	readBoundedText,
	resolveProviderClientIp,
} from '../../lib/http-security-core'

test('ignores spoofed forwarding headers outside verified provider boundaries', () => {
	const previousAuthUrl = process.env.BETTER_AUTH_URL
	process.env.BETTER_AUTH_URL = 'https://www.letletme.top'
	assert.equal(resolveProviderClientIp(new Headers({
		host: 'evil.example', 'cf-connecting-ip': '1.2.3.4', 'cf-ray': 'spoofed',
	})), 'unknown')
	assert.equal(resolveProviderClientIp(new Headers({
		host: 'www.letletme.top', 'cf-connecting-ip': '1.2.3.4', 'cf-ray': 'real-marker',
	})), '1.2.3.4')
	assert.equal(resolveProviderClientIp(new Headers({
		host: 'preview.vercel.app', 'x-vercel-forwarded-for': '1.2.3.4', 'x-vercel-id': 'iad1::abc',
	})), '1.2.3.4')
	if (previousAuthUrl === undefined) delete process.env.BETTER_AUTH_URL
	else process.env.BETTER_AUTH_URL = previousAuthUrl
})

test('opaque rate subjects and ingress signatures never contain raw IPs', () => {
	const headers = new Headers({
		host: 'preview.vercel.app', 'x-vercel-forwarded-for': '1.2.3.4', 'x-vercel-id': 'iad1::abc',
	})
	const subject = buildOpaqueRateLimitSubject(headers, 'secret')
	assert.match(subject, /^[a-f0-9]{64}$/)
	assert.equal(subject.includes('1.2.3.4'), false)
	const signed = buildIngressContextHeaders(subject, 'secret', 100)
	const payload = Buffer.from(signed['X-Ingress-Context'], 'base64url').toString()
	assert.equal(JSON.parse(payload).exp, 160)
	assert.equal(
		signed['X-Ingress-Context-Sig'],
		createHmac('sha256', 'secret').update(payload).digest('base64url'),
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
			},
		}),
		duplex: 'half',
	} as RequestInit & { duplex: 'half' })
	await assert.rejects(() => readBoundedText(request, 6), PayloadTooLargeError)
})
