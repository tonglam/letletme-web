import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { buildTournamentEventResultSeeds } from '../app/me/tournament/_lib/tournament-stats-seed'

describe('tournament SSR event-result seeds', () => {
	it('keeps latest season rows separate from a deep-linked gameweek slice', () => {
		const latestRows = [{ entryId: 10, points: 700 }]
		const deepLinkedRows = [{ entryId: 10, points: 180 }]
		const previousRows = [{ entryId: 10, points: 120 }]

		assert.deepEqual(
			buildTournamentEventResultSeeds({
				dataGameweek: 10,
				sliceGameweek: 3,
				seasonRows: latestRows,
				sliceRows: deepLinkedRows,
				previousRows
			}),
			[
				{ eventId: 10, rows: latestRows },
				{ eventId: 3, rows: deepLinkedRows },
				{ eventId: 2, rows: previousRows }
			]
		)
	})

	it('deduplicates the default latest-gameweek slice', () => {
		const rows = [{ entryId: 10 }]
		assert.deepEqual(
			buildTournamentEventResultSeeds({
				dataGameweek: 10,
				sliceGameweek: 10,
				seasonRows: rows,
				sliceRows: rows,
				previousRows: []
			}),
			[{ eventId: 10, rows }]
		)
	})
})
