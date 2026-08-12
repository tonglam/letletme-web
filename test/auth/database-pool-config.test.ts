import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	resolveWebDatabasePoolMax,
	WEB_DATABASE_POOL_MAX
} from '../../lib/db/pool-config'

describe('Web database pool contract', () => {
	it('defaults each Vercel instance to two lazy sessions', () => {
		assert.equal(WEB_DATABASE_POOL_MAX, 2)
		assert.equal(resolveWebDatabasePoolMax(undefined), 2)
		assert.equal(resolveWebDatabasePoolMax(''), 2)
	})

	it('accepts only the bounded one-or-two session range', () => {
		assert.equal(resolveWebDatabasePoolMax('1'), 1)
		assert.equal(resolveWebDatabasePoolMax('2'), 2)
		for (const value of ['0', '3', '1.5', 'many']) {
			assert.throws(() => resolveWebDatabasePoolMax(value))
		}
	})
})
