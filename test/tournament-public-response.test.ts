import assert from 'node:assert/strict'
import test from 'node:test'

import {
	publicTournamentServiceError,
	sanitizeTournamentApiErrorPayload,
	sanitizeTournamentNameCheckError
} from '@/lib/tournament/public-response'

test('tournament proxy strips upstream error details', () => {
	assert.deepEqual(
		sanitizeTournamentApiErrorPayload(
			{
				error: 'relation competition.secret_table does not exist',
				stack: 'Error: private stack',
				details: { connectionString: 'postgres://secret' },
				retryAfterSeconds: 37
			},
			502
		),
		{
			success: false,
			error: 'The tournament service is unavailable.',
			code: 'TOURNAMENT_UNAVAILABLE',
			retryAfterSeconds: 37
		}
	)

	assert.equal(
		JSON.stringify(
			sanitizeTournamentApiErrorPayload({ error: 'private' }, 500)
		).includes('private'),
		false
	)
})

test('public tournament errors stay bounded by HTTP status', () => {
	assert.equal(
		publicTournamentServiceError(409),
		'The tournament request conflicts with current data.'
	)
	assert.equal(
		sanitizeTournamentApiErrorPayload(
			{
				code: 'TOURNAMENT_ADMIN_NOT_PARTICIPANT',
				error: 'safe upstream message'
			},
			400
		).code,
		'TOURNAMENT_ADMIN_NOT_PARTICIPANT'
	)
	assert.equal(
		sanitizeTournamentApiErrorPayload(
			{ code: 'DATABASE_CONNECTION_STRING', error: 'private' },
			502
		).code,
		'TOURNAMENT_UNAVAILABLE'
	)
	assert.deepEqual(sanitizeTournamentNameCheckError(503), {
		available: false,
		message: 'The tournament service is unavailable.'
	})
})
