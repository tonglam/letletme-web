import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldShowOfficialH2HStandings } from '../lib/tournament/official-h2h-presentation'

describe('official H2H presentation', () => {
	it('hides standings for a future gameweek', () => {
		assert.equal(shouldShowOfficialH2HStandings(3, 2), false)
	})

	it('keeps standings for the active and historical gameweeks', () => {
		assert.equal(shouldShowOfficialH2HStandings(2, 2), true)
		assert.equal(shouldShowOfficialH2HStandings(1, 2), true)
	})

	it('does not hide standings when the active boundary is unavailable', () => {
		assert.equal(shouldShowOfficialH2HStandings(3), true)
	})
})
