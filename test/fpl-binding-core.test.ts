import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	FPL_IDENTITY_REFRESH_INTERVAL_MS,
	assertFplEntryId,
	isFplIdentitySnapshotStale,
	parseFplEntryId,
} from '../lib/fpl-binding-core'

describe('parseFplEntryId', () => {
	it('accepts a plain numeric string', () => {
		assert.equal(parseFplEntryId('123456'), 123456)
		assert.equal(parseFplEntryId(' 6953 '), 6953)
	})

	it('accepts a number', () => {
		assert.equal(parseFplEntryId(123456), 123456)
	})

	it('extracts the ID from FPL page URLs', () => {
		assert.equal(
			parseFplEntryId('https://fantasy.premierleague.com/en/entry/6953/history'),
			6953,
		)
		assert.equal(
			parseFplEntryId('https://fantasy.premierleague.com/en/entry/123456/event/1'),
			123456,
		)
		assert.equal(
			parseFplEntryId('https://fantasy.premierleague.com/entry/42/transfers'),
			42,
		)
	})

	it('handles trailing punctuation and query strings', () => {
		assert.equal(parseFplEntryId('…/entry/777/history?foo=bar'), 777)
		assert.equal(parseFplEntryId('/en/entry/88'), 88)
	})

	it('rejects unrelated URLs and garbage', () => {
		assert.equal(parseFplEntryId('https://fantasy.premierleague.com/en/my-team'), null)
		assert.equal(parseFplEntryId('entry/123'), null)
		assert.equal(parseFplEntryId('abc'), null)
		assert.equal(parseFplEntryId(''), null)
		assert.equal(parseFplEntryId(null), null)
		assert.equal(parseFplEntryId(undefined), null)
	})

	it('rejects non-positive and unsafe numbers', () => {
		assert.equal(parseFplEntryId('0'), null)
		assert.equal(parseFplEntryId('-5'), null)
		assert.equal(parseFplEntryId('1.5'), null)
		assert.equal(parseFplEntryId(Number.MAX_SAFE_INTEGER + 1), null)
	})
})

describe('assertFplEntryId', () => {
	it('returns the parsed ID for valid input', () => {
		assert.equal(assertFplEntryId('https://fantasy.premierleague.com/en/entry/6953/history'), 6953)
	})

	it('throws for invalid input', () => {
		assert.throws(() => assertFplEntryId('nope'), /valid FPL entry ID/)
	})
})

describe('isFplIdentitySnapshotStale', () => {
	const now = new Date('2026-08-02T12:00:00Z')

	it('is stale when never refreshed or unparseable', () => {
		assert.equal(isFplIdentitySnapshotStale(null, now), true)
		assert.equal(isFplIdentitySnapshotStale(undefined, now), true)
		assert.equal(isFplIdentitySnapshotStale('not-a-date', now), true)
	})

	it('is fresh within the refresh interval', () => {
		const recent = new Date(now.getTime() - FPL_IDENTITY_REFRESH_INTERVAL_MS + 1000)
		assert.equal(isFplIdentitySnapshotStale(recent, now), false)
		assert.equal(isFplIdentitySnapshotStale(recent.toISOString(), now), false)
	})

	it('is stale at and beyond the interval', () => {
		const boundary = new Date(now.getTime() - FPL_IDENTITY_REFRESH_INTERVAL_MS)
		assert.equal(isFplIdentitySnapshotStale(boundary, now), true)
	})
})
