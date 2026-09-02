import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { TournamentOfficialH2H } from '../lib/graphql/operations/tournaments'
import {
	isCompleteOfficialH2HSnapshot,
	isOfficialH2HContentChanged,
	isOfficialH2HScoreVisible,
	isSameOfficialH2HMatchSet,
	isUsableOfficialH2HSnapshot,
	retainOfficialH2HMatches,
	retainOfficialH2HStandings,
	shouldShowOfficialH2HStandings
} from '../lib/tournament/official-h2h-presentation'
import { resolveUrlGameweekSelection } from '../lib/tournament/live-board'

const snapshot = (overrides: Record<string, unknown> = {}) =>
	({
		eventId: 1,
		availability: 'READY',
		matches: [{ officialMatchId: 1, availability: 'READY', eventId: 1 }],
		standings: { state: 'READY', rows: [{ entryId: 1 }] },
		revisions: {
			roster: 'roster-1',
			fixtureIdentity: 'fixture-1',
			identity: 'identity-1'
		},
		...overrides
	}) as unknown as TournamentOfficialH2H

describe('official H2H presentation', () => {
	it('only exposes a score when both sides are ready', () => {
		assert.equal(
			isOfficialH2HScoreVisible(
				{ availability: 'READY', points: 10 },
				{ availability: 'READY', points: 8 }
			),
			true
		)
		assert.equal(
			isOfficialH2HScoreVisible(
				{ availability: 'READY', points: 10 },
				{ availability: 'PENDING', points: 8 }
			),
			false
		)
		assert.equal(
			isOfficialH2HScoreVisible(
				{ availability: 'READY', points: null },
				{ availability: 'READY', points: 8 }
			),
			false
		)
	})

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

	it('accepts a complete publication while isolating unresolved matches', () => {
		assert.equal(
			isCompleteOfficialH2HSnapshot(snapshot(), { requireStandings: true }),
			true
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(
				snapshot({
					matches: [
						{ officialMatchId: 1, availability: 'READY', eventId: 1 },
						{ officialMatchId: 2, availability: 'PENDING', eventId: 1 }
					]
				}),
				{ requireStandings: false }
			),
			true
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(
				snapshot({
					matches: [{ officialMatchId: 1, availability: 'READY', eventId: 2 }]
				})
			),
			false
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(snapshot(), { eventId: 2 }),
			false
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(snapshot({ standings: null }), {
				requireStandings: true
			}),
			false
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(
				snapshot({ standings: { state: 'UPDATING', rows: [{ entryId: 1 }] } }),
				{ requireStandings: true }
			),
			false
		)
		assert.equal(
			isCompleteOfficialH2HSnapshot(
				snapshot({
					standings: { state: 'UPDATING', rows: [{ entryId: 1 }] }
				})
			),
			false
		)
		assert.equal(
			isUsableOfficialH2HSnapshot(
				snapshot({
					standings: { state: 'UPDATING', rows: [] }
				})
			),
			true
		)
	})

	it('does not merge a changed or incomplete H2H match set', () => {
		const previous = snapshot({
			matches: [
				{
					officialMatchId: 1,
					eventId: 1,
					groupId: 1,
					sourceOrder: 0,
					phase: 'REGULAR',
					knockoutName: null,
					tiebreak: null,
					isBye: false,
					availability: 'READY',
					home: { entryId: 1, isAverage: false },
					away: { entryId: 2, isAverage: false }
				}
			]
		})
		const missing = snapshot({
			matches: [
				{
					officialMatchId: 2,
					eventId: 1,
					groupId: 1,
					sourceOrder: 0,
					phase: 'REGULAR',
					knockoutName: null,
					tiebreak: null,
					isBye: false,
					availability: 'PENDING',
					home: { entryId: 1, isAverage: false },
					away: { entryId: 2, isAverage: false }
				}
			]
		})

		assert.equal(isSameOfficialH2HMatchSet(previous, missing), false)
		assert.deepEqual(
			retainOfficialH2HMatches(previous, missing).matches,
			missing.matches
		)
	})

	it('retains only the same match identity when one match refresh is pending', () => {
		const previous = snapshot({
			matches: [
				{
					officialMatchId: 1,
					eventId: 1,
					groupId: 1,
					sourceOrder: 0,
					phase: 'REGULAR',
					knockoutName: null,
					tiebreak: null,
					isBye: false,
					availability: 'READY',
					delivery: {
						state: 'FRESH',
						servedFrom: 'REDIS_CURRENT',
						reasonCodes: []
					},
					home: { entryId: 1, isAverage: false },
					away: { entryId: 2, isAverage: false }
				}
			]
		})
		const next = snapshot({
			matches: [
				{
					officialMatchId: 1,
					eventId: 1,
					groupId: 1,
					sourceOrder: 0,
					phase: 'REGULAR',
					knockoutName: null,
					tiebreak: null,
					isBye: false,
					availability: 'PENDING',
					delivery: {
						state: 'FRESH',
						servedFrom: 'REDIS_CURRENT',
						reasonCodes: []
					},
					home: { entryId: 1, isAverage: false },
					away: { entryId: 2, isAverage: false }
				}
			]
		})
		const retained = retainOfficialH2HMatches(previous, next)

		assert.equal(retained.matches[0]?.availability, 'READY')
		assert.equal(retained.matches[0]?.delivery.state, 'DEGRADED')
		assert.equal(retained.matches[0]?.delivery.servedFrom, 'PROCESS_LKG')
		assert.deepEqual(retained.matches[0]?.home, previous.matches[0]?.home)
	})

	it('retains official standings rows while the overlay is updating', () => {
		const previous = snapshot()
		const next = snapshot({
			matches: [{ officialMatchId: 1, availability: 'PENDING' }],
			standings: { state: 'UPDATING', rows: [] }
		})
		const retained = retainOfficialH2HStandings(previous, next)

		assert.deepEqual(retained.matches, next.matches)
		assert.equal(retained.standings?.state, 'UPDATING')
		assert.deepEqual(retained.standings?.rows, previous.standings?.rows)

		const otherEvent = snapshot({
			eventId: 2,
			matches: [{ officialMatchId: 2, availability: 'READY', eventId: 2 }]
		})
		const otherEventRetained = retainOfficialH2HStandings(otherEvent, next)
		assert.deepEqual(otherEventRetained.standings, next.standings)
	})

	it('does not label retained standings as unavailable', () => {
		const previous = snapshot()
		const next = snapshot({
			standings: {
				state: 'UNAVAILABLE',
				rows: [],
				throughEventId: 0,
				sourceCheckedAt: '2026-09-02T01:00:00.000Z'
			}
		})

		const retained = retainOfficialH2HStandings(previous, next)

		assert.equal(retained.standings?.state, 'UPDATING')
		assert.deepEqual(retained.standings?.rows, previous.standings?.rows)
		assert.equal(
			retained.standings?.throughEventId,
			previous.standings?.throughEventId
		)
		assert.equal(
			retained.standings?.sourceCheckedAt,
			previous.standings?.sourceCheckedAt
		)
	})

	it('does not retain standings across a roster or schedule identity change', () => {
		const previous = snapshot()
		const next = snapshot({
			standings: { state: 'UPDATING', rows: [] },
			revisions: {
				roster: 'roster-2',
				fixtureIdentity: 'fixture-2',
				identity: 'identity-2'
			}
		})

		const result = retainOfficialH2HStandings(previous, next)

		assert.deepEqual(result.standings?.rows, [])
		assert.equal(result.standings?.state, 'UPDATING')
	})

	it('invalidates content when the event changes even if the hash is reused', () => {
		const previous = snapshot({
			eventId: 1,
			revisions: { content: 'same-content' }
		})
		const next = snapshot({
			eventId: 2,
			matches: [{ officialMatchId: 2, availability: 'READY', eventId: 2 }],
			revisions: { content: 'same-content' }
		})

		assert.equal(isOfficialH2HContentChanged(previous, next), true)
	})
})
