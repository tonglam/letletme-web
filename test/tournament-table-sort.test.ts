import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { sortTournamentEntries } from '../lib/tournament/table-sort'
import type { TournamentEntry } from '../types/tournament'

function entry(id: string, gwPoints: number, rank: number): TournamentEntry {
	return {
		id,
		rank,
		teamName: `Team ${id}`,
		managerName: `Manager ${id}`,
		captainName: '',
		captainTeam: '',
		captainPoints: 0,
		gwPoints,
		livePoints: gwPoints,
		totalPoints: gwPoints,
		playersPlayed: 0,
		playersToPlay: 0,
		picks: [],
		chips: { bench: false, triple: false, wildcard: false, freeHit: false }
	}
}

describe('sortTournamentEntries', () => {
	it('reorders the same rows when the direction changes', () => {
		const entries = [entry('low', 3, 2), entry('high', 12, 1)]

		assert.deepEqual(
			sortTournamentEntries(entries, '', 'gwPoints', 'desc').map(row => row.id),
			['high', 'low']
		)
		assert.deepEqual(
			sortTournamentEntries(entries, '', 'gwPoints', 'asc').map(row => row.id),
			['low', 'high']
		)
	})

	it('keeps unknown point rows after known rows in either direction', () => {
		const entries = [
			entry('unknown', 0, 1),
			{ ...entry('known', 7, 2), gwPoints: 7 }
		]
		entries[0].gwPoints = null
		entries[0].livePoints = null

		assert.deepEqual(
			sortTournamentEntries(entries, '', 'gwPoints', 'asc').map(row => row.id),
			['known', 'unknown']
		)
		assert.deepEqual(
			sortTournamentEntries(entries, '', 'gwPoints', 'desc').map(row => row.id),
			['known', 'unknown']
		)
	})
})
