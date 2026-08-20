import assert from 'node:assert/strict'
import test from 'node:test'

import {
	CORE_AUTHORITY_DATA_CACHE,
	CORE_AUTHORITY_ORIGIN_OPTIONS
} from '../lib/core-authority-cache-policy'

test('public gameweek authority caches normalized success outside signed fetches', () => {
	assert.deepEqual(CORE_AUTHORITY_DATA_CACHE, {
		revalidate: 5,
		tags: ['events']
	})
	assert.deepEqual(CORE_AUTHORITY_ORIGIN_OPTIONS, {
		cache: 'no-store',
		timeoutMs: 5_000
	})
})
