import assert from 'node:assert/strict'
import test from 'node:test'

import {
	createCompetitionSessionHandoff,
	readCompetitionSessionHandoff
} from '@/lib/competition-session-handoff'

const session = {
	user: {
		id: 'user-1',
		name: 'Manager',
		fplEntryId: 15702,
		fplEntryVerifiedAt: new Date('2026-08-15T06:00:00.000Z')
	}
} as never

test('competition session handoff binds identity to path and cookie', () => {
	process.env.BACKEND_PROXY_SECRET = 'test-secret'
	const path = '/zh-CN/live/competitions/42'
	const cookie = 'better-auth.session_token=opaque'
	const token = createCompetitionSessionHandoff(session, path, cookie, 1000)
	assert.ok(token)

	const payload = readCompetitionSessionHandoff(token, path, cookie, 1010)
	assert.equal(payload?.uid, 'user-1')
	assert.equal(payload?.eid, 15702)
	assert.equal(payload?.path, path)
	assert.equal(
		readCompetitionSessionHandoff(
			token,
			'/en/live/competitions/42',
			cookie,
			1010
		),
		null
	)
	assert.equal(
		readCompetitionSessionHandoff(token, path, 'different-cookie', 1010),
		null
	)
})

test('competition session handoff expires and rejects tampering', () => {
	process.env.BACKEND_PROXY_SECRET = 'test-secret'
	const token = createCompetitionSessionHandoff(
		session,
		'/live/competitions/42',
		null,
		1000
	)
	assert.ok(token)
	assert.equal(
		readCompetitionSessionHandoff(token, '/live/competitions/42', null, 1031),
		null
	)
	const [encoded, signature] = token.split('.')
	assert.ok(encoded && signature)
	const tampered = `${encoded}x.${signature}`
	assert.equal(
		readCompetitionSessionHandoff(
			tampered,
			'/live/competitions/42',
			null,
			1000
		),
		null
	)
})
