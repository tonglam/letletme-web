import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { TournamentOfficialH2H } from '../lib/graphql/operations/tournaments'
import {
	isCompleteOfficialH2HSnapshot,
	shouldShowOfficialH2HStandings
} from '../lib/tournament/official-h2h-presentation'
import { resolveUrlGameweekSelection } from '../lib/tournament/live-board'

const snapshot = (overrides: Record<string, unknown> = {}) =>
	({
		availability: 'READY',
		matches: [{ availability: 'READY' }],
		standings: { state: 'READY', rows: [{ entryId: 1 }] },
		...overrides
	}) as unknown as TournamentOfficialH2H

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

	it('keeps future H2H gameweeks explicitly selectable', () => {
		assert.deepEqual(
			resolveUrlGameweekSelection({
				currentEvent: 2,
				requestedGameweek: 3,
				preserveFutureGameweek: true
			}),
			{ selectedGameweek: 3, followsAnchor: false }
		)
	})

	it('accepts only a complete same-event publication for LKG replacement', () => {
		assert.equal(
			isCompleteOfficialH2HSnapshot(snapshot(), { requireStandings: true }),
			true
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(
				snapshot({
					matches: [{ availability: 'READY' }, { availability: 'PENDING' }]
				}),
				{ requireStandings: false }
			),
			false
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(snapshot({ standings: null }), {
				requireStandings: true
			}),
			false
		)
	})
})
