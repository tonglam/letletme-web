import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildAuthoritativeTournamentPayload,
	InvalidTournamentPayloadError,
} from '../../lib/tournament/security'

describe('tournament command identity', () => {
	it('overwrites browser-controlled admin and creator fields', () => {
		const payload = buildAuthoritativeTournamentPayload(
			{
				tournamentName: 'Secure Cup',
				adminId: '999999',
				creator: 'attacker',
			},
			{ fplEntryId: 15702, name: 'Tong' },
		)

		assert.equal(payload.tournamentName, 'Secure Cup')
		assert.equal(payload.adminId, '15702')
		assert.equal(payload.creator, 'Tong')
	})

	it('uses a non-sensitive display fallback', () => {
		const payload = buildAuthoritativeTournamentPayload({}, { fplEntryId: 15702, name: '  ' })
		assert.equal(payload.creator, 'FPL 15702')
	})

	it('rejects arrays and invalid verified entry IDs', () => {
		assert.throws(
			() => buildAuthoritativeTournamentPayload([], { fplEntryId: 15702 }),
			InvalidTournamentPayloadError,
		)
		assert.throws(
			() => buildAuthoritativeTournamentPayload({}, { fplEntryId: 0 }),
			InvalidTournamentPayloadError,
		)
	})
})
