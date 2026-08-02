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

	it('turns classic import into an authoritative all-members points race', () => {
		const payload = buildAuthoritativeTournamentPayload(
			{
				creationMode: 'classic',
				tournamentName: 'Official Classic',
				leagueUrl: 'https://fantasy.premierleague.com/en/leagues/8863/standings/c',
				startGameweek: 'GW3',
				participantSource: 'custom',
				groupFormat: 'none',
				endGameweek: 'GW4',
				knockoutFormat: 'double',
				selectedParticipantIds: ['1'],
			},
			{ fplEntryId: 15702, name: 'Tong' },
		)

		assert.deepEqual(payload, {
			tournamentName: 'Official Classic',
			participantSource: 'official',
			tournamentType: 'standard',
			leagueUrl: 'https://fantasy.premierleague.com/en/leagues/8863/standings/c',
			groupFormat: 'points',
			startGameweek: 'GW3',
			endGameweek: 'GW38',
			groupNum: '1',
			qualifiersPerGroup: '',
			knockoutFormat: 'none',
			adminId: '15702',
			creator: 'Tong',
		})
	})

	it('keeps head-to-head import reserved for a later mode', () => {
		assert.throws(
			() => buildAuthoritativeTournamentPayload(
				{
					creationMode: 'classic',
					tournamentName: 'H2H League',
					leagueUrl: 'https://fantasy.premierleague.com/en/leagues/99/standings/h',
				},
				{ fplEntryId: 15702, name: 'Tong' },
			),
			InvalidTournamentPayloadError,
		)
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
