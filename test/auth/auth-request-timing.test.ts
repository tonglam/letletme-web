import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	formatAuthServerTiming,
	isGetSessionRequest
} from '../../lib/auth-request-timing'
import { readFileSync } from 'node:fs'

describe('get-session timing contract', () => {
	it('publishes handler, database/session, and total timings', () => {
		assert.equal(
			formatAuthServerTiming({
				handlerMs: 12.345,
				sessionMs: 11.234,
				databaseMs: 7.891,
				totalMs: 12.678
			}),
			'auth_handler;dur=12.35, auth_session;dur=11.23, auth_database;dur=7.89, auth_total;dur=12.68'
		)
	})

	it('keeps route, session, and database timing stages distinct', () => {
		const route = readFileSync('app/api/auth/[...all]/route.ts', 'utf8')
		assert.match(route, /withAuthDatabaseTiming/)
		assert.match(route, /timing\.measure\('sessionTotal'/)
		assert.match(route, /sessionTotalMs - databaseMs/)
		assert.match(route, /database: Number\(durations\.databaseMs/)
	})

	it('only labels the Better Auth get-session operation', () => {
		assert.equal(
			isGetSessionRequest('https://letletme.top/api/auth/get-session'),
			true
		)
		assert.equal(
			isGetSessionRequest('https://letletme.top/api/auth/sign-in/email'),
			false
		)
		assert.equal(isGetSessionRequest('not-a-url'), false)
	})
})
