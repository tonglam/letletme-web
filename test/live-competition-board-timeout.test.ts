import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const route = readFileSync(
	'app/api/live/competitions/[id]/board/route.ts',
	'utf8'
)

describe('Live competition board timeout', () => {
	it('keeps a bounded 15 second budget for large-league page queries', () => {
		assert.match(
			route,
			/const LIVE_COMPETITION_BOARD_TIMEOUT_MS = 15_000/
		)
		assert.doesNotMatch(
			route,
			/const LIVE_COMPETITION_BOARD_TIMEOUT_MS = 5_000/
		)
	})
})
