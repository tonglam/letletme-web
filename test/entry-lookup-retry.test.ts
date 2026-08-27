import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	ENTRY_LOOKUP_MAX_AUTOMATIC_RETRIES,
	nextEntryLookupRetryDelay
} from '../app/live/points/_lib/entry-lookup-retry'

describe('Entry lookup retry policy', () => {
	it('backs off only retryable lookup results and stays bounded', () => {
		assert.equal(nextEntryLookupRetryDelay(false, 0), null)
		assert.equal(nextEntryLookupRetryDelay(true, 0), 1_500)
		assert.equal(nextEntryLookupRetryDelay(true, 1), 3_000)
		assert.equal(
			nextEntryLookupRetryDelay(true, ENTRY_LOOKUP_MAX_AUTOMATIC_RETRIES),
			null
		)
	})

	it('fails closed on invalid retry counters', () => {
		assert.equal(nextEntryLookupRetryDelay(true, -1), null)
		assert.equal(nextEntryLookupRetryDelay(true, 0.5), null)
	})
})
