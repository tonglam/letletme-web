import assert from 'node:assert/strict'
import test from 'node:test'

import {
	getPublicErrorMessage,
	getSafeClientErrorMessage,
	PublicError,
} from '@/lib/safe-errors'

test('only typed public errors can cross a user-facing error boundary', () => {
	const fallback = 'The request could not be completed.'

	assert.equal(
		getPublicErrorMessage(new PublicError('Please choose a valid league.'), fallback),
		'Please choose a valid league.',
	)
	assert.equal(
		getPublicErrorMessage(new Error('postgres://internal:secret@example/db'), fallback),
		fallback,
	)
	assert.equal(getPublicErrorMessage({ message: 'private stack fragment' }, fallback), fallback)
})
test('native browser network errors are never shown verbatim', () => {
	const fallback = 'The league participants could not be loaded.'
	const networkError = new TypeError('Failed to fetch')

	assert.equal(getSafeClientErrorMessage(networkError, fallback), fallback)
	assert.equal(
		getSafeClientErrorMessage(new Error('ECONNREFUSED 127.0.0.1:4000'), fallback),
		fallback,
	)
})
