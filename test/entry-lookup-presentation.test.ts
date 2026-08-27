import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	entryLookupPresentation,
	entryPersistencePresentation
} from '../app/live/points/_lib/entry-lookup-presentation'

describe('Entry lookup presentation', () => {
	it('keeps successful and absent lookups silent', () => {
		assert.equal(entryLookupPresentation(undefined), null)
		assert.equal(entryLookupPresentation('FOUND'), null)
	})

	it('distinguishes deterministic failures from retryable dependency states', () => {
		assert.deepEqual(entryLookupPresentation('INVALID_ID'), {
			messageKey: 'invalidEntry',
			retryable: false
		})
		assert.deepEqual(entryLookupPresentation('NOT_FOUND'), {
			messageKey: 'entryNotFound',
			retryable: false
		})
		assert.deepEqual(entryLookupPresentation('SATURATED'), {
			messageKey: 'entryBusy',
			retryable: true
		})
		assert.deepEqual(entryLookupPresentation('UNAVAILABLE'), {
			messageKey: 'entryUnavailable',
			retryable: true
		})
	})

	it('presents every persistence state without treating queued work as a failure', () => {
		assert.equal(entryPersistencePresentation(undefined), null)
		assert.equal(entryPersistencePresentation('NOT_REQUIRED'), null)
		assert.deepEqual(entryPersistencePresentation('QUEUED'), {
			messageKey: 'entryPersistenceQueued',
			retryable: false
		})
		assert.deepEqual(entryPersistencePresentation('FAILED_RETRYABLE'), {
			messageKey: 'entryPersistenceFailed',
			retryable: true
		})
	})
})
