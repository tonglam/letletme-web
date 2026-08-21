const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

describe('platform admin account resolver', () => {
	it('accepts one positive safe FPL entry ID', async () => {
		const { parsePlatformAdminEntryId } =
			await import('../scripts/resolve-platform-admin-user.mjs')
		assert.equal(parsePlatformAdminEntryId('6953'), 6953)
	})

	it('rejects ambiguous or unsafe input before any database access', async () => {
		const { parsePlatformAdminEntryId } =
			await import('../scripts/resolve-platform-admin-user.mjs')
		for (const value of ['', '0', '-1', '6953,15702', '9007199254740992']) {
			assert.throws(() => parsePlatformAdminEntryId(value))
		}
	})
})
