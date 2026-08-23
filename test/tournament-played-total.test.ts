import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	FPL_SQUAD_PLAYERS,
	FPL_STARTING_PLAYERS,
	getPlayedPlayerLimit,
} from '../lib/tournament/played-total'

describe('getPlayedPlayerLimit', () => {
	it('uses the starting XI for a normal gameweek', () => {
		assert.equal(getPlayedPlayerLimit({ bench: false }), FPL_STARTING_PLAYERS)
	})

	it('uses the full squad when Bench Boost is active', () => {
		assert.equal(getPlayedPlayerLimit({ bench: true }), FPL_SQUAD_PLAYERS)
	})
})
