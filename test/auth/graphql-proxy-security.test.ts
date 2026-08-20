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
			new Headers({ Authorization: `bearer ${token}` }),
		),
		{ ok: true, value: `Bearer ${token}` },
	)
})

test('passes Retry-After and v3 policy headers without forwarding arbitrary upstream headers', () => {
	const target = new Headers({ 'Cache-Control': 'no-store' })
	copySafeGraphQLUpstreamHeaders(
		new Headers({
			'Retry-After': '17',
			'X-RateLimit-Policy': 'graphql-v3',
			'X-RateLimit-Scope': 'client',
			'X-Internal-Secret': 'never-forward'
		}),
		target
	)
	assert.equal(target.get('retry-after'), '17')
	assert.equal(target.get('x-ratelimit-policy'), 'graphql-v3')
	assert.equal(target.get('x-ratelimit-scope'), 'client')
	assert.equal(target.has('x-internal-secret'), false)
})

test('distinguishes absent credentials from malformed or oversized credentials', () => {
	assert.deepEqual(readForwardableMiniProgramAuthorization(new Headers()), {
		ok: true,
		value: null,
	})
	assert.deepEqual(
		readForwardableMiniProgramAuthorization(new Headers({ Authorization: 'Basic abc' })),
		{ ok: false },
	)
	assert.deepEqual(
		readForwardableMiniProgramAuthorization(
			new Headers({ Authorization: `Bearer ${'a'.repeat(513)}` }),
		),
		{ ok: false },
	)
})
