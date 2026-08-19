import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

describe('miniprogram entry-sync route', () => {
	const source = readFileSync(
		new URL('../app/api/miniprogram/entry-sync/route.ts', import.meta.url),
		'utf8',
	)

	it('enqueues Data persist after bind-style rate limits', () => {
		assert.match(source, /parseFplEntryId/)
		assert.match(source, /assertValidDeviceId/)
		assert.match(source, /syncEntryAfterBind/)
		assert.match(source, /after\(\(\) => syncEntryAfterBind\(entryId\)\)/)
		assert.match(source, /scope: 'mini-entry-sync-ip'/)
		assert.match(source, /scope: 'mini-entry-sync-device'/)
		assert.doesNotMatch(source, /LETLETME_DATA_API_KEY/)
	})
})
