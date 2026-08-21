import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	isPlatformAdminIdentity,
	parsePlatformAdminFplEntryIds,
	parsePlatformAdminUserIds
} from '../../lib/platform-admin'

describe('platform administrator configuration', () => {
	it('accepts a comma-separated current-season entry allowlist', () => {
		assert.deepEqual(
			Array.from(parsePlatformAdminFplEntryIds('6953, 15702,6953')),
			[6953, 15702]
		)
		assert.deepEqual(
			Array.from(parsePlatformAdminUserIds('user-1, user-2,user-1')),
			['user-1', 'user-2']
		)
		assert.equal(
			isPlatformAdminIdentity(
				{
					id: 'user-1',
					fplEntryId: 6953,
					fplEntryVerifiedAt: '2026-08-21T00:00:00.000Z'
				},
				'6953,15702',
				'user-1'
			),
			true
		)
	})

	it('fails closed without a verified matching FPL binding', () => {
		assert.equal(
			isPlatformAdminIdentity(
				{ id: 'user-1', fplEntryId: 6953, fplEntryVerifiedAt: null },
				'6953',
				'user-1'
			),
			false
		)
		assert.equal(
			isPlatformAdminIdentity(
				{
					id: 'user-1',
					fplEntryId: 9999,
					fplEntryVerifiedAt: '2026-08-21T00:00:00.000Z'
				},
				'6953',
				'user-1'
			),
			false
		)
		assert.equal(
			isPlatformAdminIdentity(
				{
					id: 'attacker',
					fplEntryId: 6953,
					fplEntryVerifiedAt: '2026-08-21T00:00:00.000Z'
				},
				'6953',
				'user-1'
			),
			false
		)
	})

	it('rejects malformed configuration instead of granting partial access', () => {
		assert.throws(
			() => parsePlatformAdminFplEntryIds('6953,not-an-id'),
			/PLATFORM_ADMIN_FPL_ENTRY_IDS/
		)
		assert.throws(
			() => parsePlatformAdminUserIds('user-1,'),
			/PLATFORM_ADMIN_USER_IDS/
		)
	})
})
