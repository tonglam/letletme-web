import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { formatMatchKickoff } from '../components/live/match-card/match-card-model'

describe('formatMatchKickoff', () => {
	it('uses UTC until the client has hydrated', () => {
		assert.equal(
			formatMatchKickoff('2026-08-21T19:00:00.000Z', 'en-US'),
			'August 21, 2026 at 19:00',
		)
	})

	it('returns null for an invalid kickoff', () => {
		assert.equal(formatMatchKickoff('not-a-date', 'en-US'), null)
	})
})
