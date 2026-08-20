import assert from 'node:assert/strict'
import test from 'node:test'

import { CORE_AUTHORITY_FETCH_OPTIONS } from '../lib/core-authority-cache-policy'

test('public gameweek authority uses the bounded five-second seed cache', () => {
	assert.deepEqual(CORE_AUTHORITY_FETCH_OPTIONS, {
		cache: 'force-cache',
		next: {
			revalidate: 5,
			tags: ['events']
		},
		timeoutMs: 5_000
	})
})
