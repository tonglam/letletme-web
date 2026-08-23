import assert from 'node:assert/strict'
import test from 'node:test'

import { safeAuthLogDiagnostics, safeAuthLogEvent } from '@/lib/auth-safe-log'

test('auth diagnostics exclude credential-bearing error details', () => {
	const sessionToken =
		'live_session_token_that_must_never_reach_logs_1234567890'
	const error = Object.assign(
		new Error(
			`Failed query: select * from bauth.session where token = $1\nparams: ${sessionToken}`
		),
		{
			code: '28P01',
			severity: 'FATAL',
			query: 'select * from bauth.session where token = $1',
			parameters: [sessionToken],
			cause: Object.assign(
				new Error(`postgresql://user:${sessionToken}@db.example/db`),
				{
					code: 'ECONNRESET',
					constraint_name: 'session_token_key'
				}
			)
		}
	)

	const serialized = JSON.stringify(safeAuthLogDiagnostics([error]))

	assert.doesNotMatch(
		serialized,
		/live_session_token|Failed query|bauth\.session|postgresql:/
	)
	assert.doesNotMatch(serialized, /parameters|query|stack|message/)
	assert.match(serialized, /28P01/)
	assert.match(serialized, /ECONNRESET/)
	assert.match(serialized, /session_token_key/)
})

test('auth diagnostics reject unsafe values in otherwise allowed metadata fields', () => {
	const diagnostics = safeAuthLogDiagnostics([
		{
			name: 'Error token=secret',
			code: 'CODE secret',
			constraint: 'safe_constraint',
			statusCode: 503
		}
	])

	assert.deepEqual(diagnostics, [
		{
			type: 'object',
			status: 503,
			constraint: 'safe_constraint'
		}
	])
})

test('auth log events replace SQL parameters and token-shaped text', () => {
	assert.equal(
		safeAuthLogEvent(
			'Failed query: select * from bauth.session where token = $1; params: live_session_token_1234567890'
		),
		'internal auth failure'
	)
	assert.equal(
		safeAuthLogEvent('graphql proxy authorization session lookup failed'),
		'graphql proxy authorization session lookup failed'
	)
	assert.equal(
		safeAuthLogEvent('Authentication failed for private@example.com'),
		'internal auth failure'
	)
	assert.equal(
		safeAuthLogEvent('better-auth diagnostic'),
		'better-auth diagnostic'
	)
})
