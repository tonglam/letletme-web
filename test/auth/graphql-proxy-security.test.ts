import assert from 'node:assert/strict'
import test from 'node:test'

import {
	copySafeGraphQLUpstreamHeaders,
	readForwardableMiniProgramAuthorization
} from '@/lib/graphql-proxy-security'

test('normalizes a bounded Web-issued Mini Program bearer token', () => {
	const token = 'a'.repeat(43)
	assert.deepEqual(
		readForwardableMiniProgramAuthorization(
			new Headers({ Authorization: `bearer ${token}` })
		),
		{ ok: true, value: `Bearer ${token}` }
	)
})

test('passes Retry-After and v3 policy headers without forwarding arbitrary upstream headers', () => {
	const target = new Headers({ 'Cache-Control': 'no-store' })
	copySafeGraphQLUpstreamHeaders(
		new Headers({
			'Retry-After': '17',
			'X-RateLimit-Policy': 'graphql-v3',
			'X-RateLimit-Scope': 'client',
			'X-RateLimit-Workload': 'player-stats',
			'X-RateLimit-Shadow-Outcome': 'deny',
			'X-RateLimit-Shadow-Scope': 'client',
			'X-Internal-Secret': 'never-forward'
		}),
		target
	)
	assert.equal(target.get('retry-after'), '17')
	assert.equal(target.get('x-ratelimit-policy'), 'graphql-v3')
	assert.equal(target.get('x-ratelimit-scope'), 'client')
	assert.equal(target.get('x-ratelimit-workload'), 'player-stats')
	assert.equal(target.get('x-ratelimit-shadow-outcome'), 'deny')
	assert.equal(target.get('x-ratelimit-shadow-scope'), 'client')
	assert.equal(target.has('x-internal-secret'), false)
})

test('omits request-specific rate-limit metadata from shared-cache responses', () => {
	const target = new Headers({ 'Cache-Control': 'public, s-maxage=60' })
	copySafeGraphQLUpstreamHeaders(
		new Headers({
			'Content-Type': 'application/json',
			'Retry-After': '17',
			'X-RateLimit-Policy': 'graphql-v3',
			'X-RateLimit-Scope': 'client',
			'X-RateLimit-Shadow-Outcome': 'allow',
			'X-RateLimit-Shadow-Scope': 'client'
		}),
		target,
		{ includeRateLimitMetadata: false }
	)
	assert.equal(target.get('content-type'), 'application/json')
	assert.equal(target.has('retry-after'), false)
	assert.equal(target.has('x-ratelimit-policy'), false)
	assert.equal(target.has('x-ratelimit-scope'), false)
	assert.equal(target.has('x-ratelimit-shadow-outcome'), false)
	assert.equal(target.has('x-ratelimit-shadow-scope'), false)
})

test('distinguishes absent credentials from malformed or oversized credentials', () => {
	assert.deepEqual(readForwardableMiniProgramAuthorization(new Headers()), {
		ok: true,
		value: null
	})
	assert.deepEqual(
		readForwardableMiniProgramAuthorization(
			new Headers({ Authorization: 'Basic abc' })
		),
		{ ok: false }
	)
	assert.deepEqual(
		readForwardableMiniProgramAuthorization(
			new Headers({ Authorization: `Bearer ${'a'.repeat(513)}` })
		),
		{ ok: false }
	)
})
