import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	buildAuthoritativeTournamentAction,
	buildAuthoritativeTournamentDelete,
	buildAuthoritativeTournamentRename,
	InvalidTournamentManagementPayloadError,
	isTrustedTournamentMutationRequest
} from '../../lib/tournament/management-security'

describe('tournament management boundary', () => {
	it('uses the verified server-side entry as the administrator', () => {
		assert.deepEqual(
			buildAuthoritativeTournamentRename({ name: '  Secure Cup  ' }, 15702),
			{
				name: 'Secure Cup',
				adminEntryId: 15702,
				platformAdmin: false
			}
		)
		assert.deepEqual(buildAuthoritativeTournamentDelete(15702), {
			adminEntryId: 15702,
			platformAdmin: false
		})
		assert.deepEqual(
			buildAuthoritativeTournamentAction({ action: 'retry_setup' }, 15702),
			{
				action: 'retry_setup',
				adminEntryId: 15702,
				platformAdmin: false
			}
		)
	})

	it('carries a server-owned platform administrator role for every mutation', () => {
		assert.equal(
			buildAuthoritativeTournamentRename({ name: 'Secure Cup' }, 6953, true)
				.platformAdmin,
			true
		)
		assert.equal(
			buildAuthoritativeTournamentDelete(6953, true).platformAdmin,
			true
		)
		assert.equal(
			buildAuthoritativeTournamentAction({ action: 'pause' }, 6953, true)
				.platformAdmin,
			true
		)
	})

	it('rejects browser-controlled identity and fields other than name', () => {
		assert.throws(
			() =>
				buildAuthoritativeTournamentRename(
					{ name: 'Secure Cup', adminEntryId: 999 },
					15702
				),
			InvalidTournamentManagementPayloadError
		)
		assert.throws(
			() =>
				buildAuthoritativeTournamentRename(
					{ name: 'Secure Cup', platformAdmin: true },
					15702
				),
			InvalidTournamentManagementPayloadError
		)
		assert.throws(
			() =>
				buildAuthoritativeTournamentAction(
					{ action: 'pause', adminEntryId: 999 },
					15702
				),
			InvalidTournamentManagementPayloadError
		)
		assert.throws(
			() =>
				buildAuthoritativeTournamentAction({ action: 'drop_database' }, 15702),
			InvalidTournamentManagementPayloadError
		)
		assert.throws(
			() => buildAuthoritativeTournamentRename({ creator: 'attacker' }, 15702),
			InvalidTournamentManagementPayloadError
		)
	})

	it('enforces normalized name and verified entry constraints', () => {
		assert.throws(
			() => buildAuthoritativeTournamentRename({ name: ' x ' }, 15702),
			/Tournament name must be between 3 and 80 characters/
		)
		assert.throws(
			() => buildAuthoritativeTournamentDelete(0),
			/verified FPL entry/
		)
	})

	it('accepts same-origin requests and rejects cross-site mutations', () => {
		assert.equal(
			isTrustedTournamentMutationRequest(
				'http://127.0.0.1:3000/api/tournaments/1',
				new Headers({
					origin: 'https://letletme.top',
					'sec-fetch-site': 'same-origin'
				})
			),
			true
		)
		assert.equal(
			isTrustedTournamentMutationRequest(
				'https://letletme.top/api/tournaments/1',
				new Headers({
					origin: 'https://evil.example',
					'sec-fetch-site': 'cross-site'
				})
			),
			false
		)
	})
})
