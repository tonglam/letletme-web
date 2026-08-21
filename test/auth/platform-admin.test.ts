import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	isPlatformAdminIdentity,
	parsePlatformAdminFplEntryIds
} from '../../lib/platform-admin'

describe('platform administrator configuration', () => {
	it('accepts a comma-separated current-season entry allowlist', () => {
		assert.deepEqual(
			Array.from(parsePlatformAdminFplEntryIds('6953, 15702,6953')),
			[6953, 15702]
		)
		assert.equal(
			isPlatformAdminIdentity(
				{
					fplEntryId: 6953,
					fplEntryVerifiedAt: '2026-08-21T00:00:00.000Z'
				},
				'6953,15702'
			),
			true
		)
	})

	it('fails closed without a verified matching FPL binding', () => {
		assert.equal(
			isPlatformAdminIdentity(
				{ fplEntryId: 6953, fplEntryVerifiedAt: null },
				'6953'
			),
			false
		)
		assert.equal(
			isPlatformAdminIdentity(
				{
					fplEntryId: 9999,
					fplEntryVerifiedAt: '2026-08-21T00:00:00.000Z'
				},
				'6953'
			),
			false
		)
	})

	it('rejects malformed configuration instead of granting partial access', () => {
		assert.throws(
			() => parsePlatformAdminFplEntryIds('6953,not-an-id'),
			/PLATFORM_ADMIN_FPL_ENTRY_IDS/
		)
	})
})
