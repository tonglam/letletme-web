import assert from 'node:assert/strict'
import test from 'node:test'

import { CORE_AUTHORITY_FETCH_OPTIONS } from '../lib/core-authority-cache-policy'

test('current gameweek authority is not duplicated in the Web fetch cache', () => {
	assert.deepEqual(CORE_AUTHORITY_FETCH_OPTIONS, {
		cache: 'no-store',
		timeoutMs: 5_000
	})
	assert.equal('next' in CORE_AUTHORITY_FETCH_OPTIONS, false)
})
