import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { EntryLeague } from '../lib/graphql/operations/leagues'
import type { EntryOfficialH2HDeskItem } from '../lib/graphql/operations/tournaments'
import {
	buildHomeLeagueRankRows,
	rankMovement,
	sortEntryLeagues,
} from '../lib/home-league-ranks'

function league(partial: Partial<EntryLeague> & { id: number }): EntryLeague {
	return {
		name: partial.name ?? `League ${partial.id}`,
		type: partial.type ?? 'CLASSIC',
		entryRank: partial.entryRank ?? null,
		entryLastRank: partial.entryLastRank ?? null,
		totalTeamNum: partial.totalTeamNum ?? null,
		startedEvent: partial.startedEvent ?? null,
		tournamentId: partial.tournamentId ?? null,
		tournamentName: partial.tournamentName ?? null,
		state: partial.state ?? null,
		...partial,
	}
}

describe('rankMovement', () => {
	it('marks rise when rank number improves', () => {
		assert.deepEqual(rankMovement(12, 15), { kind: 'up', places: 3 })
	})

	it('marks fall when rank number worsens', () => {
		assert.deepEqual(rankMovement(20, 11), { kind: 'down', places: 9 })
	})

	it('marks flat when ranks match', () => {
		assert.deepEqual(rankMovement(5, 5), { kind: 'flat' })
	})

	it('is unknown without both ranks', () => {
		assert.deepEqual(rankMovement(null, 10), { kind: 'unknown' })
		assert.deepEqual(rankMovement(10, null), { kind: 'unknown' })
		assert.deepEqual(rankMovement(0, 5), { kind: 'unknown' })
	})
})

describe('sortEntryLeagues / buildHomeLeagueRankRows', () => {
	it('sorts ranked leagues first by rank then name', () => {
		const sorted = sortEntryLeagues([
			league({ id: 1, name: 'Beta', entryRank: 3 }),
			league({ id: 2, name: 'Alpha', entryRank: null }),
			league({ id: 3, name: 'Gamma', entryRank: 1 }),
		])
		assert.equal(sorted[0]?.id, 3)
		assert.equal(sorted[1]?.id, 1)
		assert.equal(sorted[2]?.id, 2)
	})

	it('returns the full sorted list for progressive UI reveal', () => {
		const leagues = Array.from({ length: 8 }, (_, i) =>
			league({
				id: i + 1,
				name: `L${i + 1}`,
				entryRank: i + 1,
				entryLastRank: i + 2,
				tournamentId: i === 0 ? 99 : null,
			}),
		)
		const rows = buildHomeLeagueRankRows(leagues)
		assert.equal(rows.length, 8)
		assert.equal(rows[0]?.movement.kind, 'up')
		assert.equal(rows[0]?.tournamentId, 99)
	})

	it('pins a live official H2H mirror and keeps its official matchup on the league row', () => {
		const desk: EntryOfficialH2HDeskItem = {
			tournamentId: 99,
			tournamentName: '碰撞大奖赛',
			totalTeams: 11,
			eventId: 1,
			awaitingSchedule: false,
			isLive: true,
			isFinal: false,
			rank: 3,
			lastRank: null,
			matchPoints: 7,
			match: {
				officialMatchId: 9001,
				eventId: 1,
				sourceOrder: 4,
				phase: 'REGULAR',
				knockoutName: null,
				isBye: false,
				winnerEntryId: null,
				tiebreak: null,
				sourceCheckedAt: null,
				home: { entryId: 7, entryName: 'Mine', playerName: null, isAverage: false, points: 42, matchPoints: 3 },
				away: { entryId: null, entryName: 'Average Team', playerName: null, isAverage: true, points: 38, matchPoints: 0 },
			},
		}
		const rows = buildHomeLeagueRankRows([
			league({ id: 1, name: 'Classic leader', entryRank: 1 }),
			league({ id: 2, name: '碰撞大奖赛', entryRank: 8, entryLastRank: 4, tournamentId: 99, type: 'H2H' }),
		], [desk])

		assert.equal(rows[0]?.tournamentId, 99)
		assert.equal(rows[0]?.entryRank, 3)
		assert.deepEqual(rows[0]?.movement, { kind: 'up', places: 1 })
		assert.equal(rows[0]?.officialH2H?.match?.sourceOrder, 4)
	})
})
