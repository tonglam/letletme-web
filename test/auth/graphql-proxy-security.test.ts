import assert from 'node:assert/strict'
import test from 'node:test'

import { readForwardableMiniProgramAuthorization } from '@/lib/graphql-proxy-security'

test('normalizes a bounded Web-issued Mini Program bearer token', () => {
	const token = 'a'.repeat(43)
	assert.deepEqual(
		readForwardableMiniProgramAuthorization(
			new Headers({ Authorization: `bearer ${token}` }),
		),
		{ ok: true, value: `Bearer ${token}` },
	)
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
