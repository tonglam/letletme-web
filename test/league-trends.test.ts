import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	buildLeagueTrendSummary,
	resolveInitialLeagueTrendsSelection,
} from '../app/data/selections/_lib/league-trends'
import type { EntryEventPick } from '../lib/graphql/operations/entries'
import type { TournamentStatPlayer } from '../lib/graphql/operations/tournaments'

const player = (
	id: number,
	selectedByPercent: number,
	eoByPercent: number,
	captainByPercent = 0,
): TournamentStatPlayer => ({
	id,
	webName: `Player ${id}`,
	teamShortName: 'ARS',
	position: 'MIDFIELDER',
	selectedByPercent,
	eoByPercent,
	captainByPercent,
})

const pick = (
	element: number,
	multiplier: number,
	isCaptain = false,
	isViceCaptain = false,
): EntryEventPick => ({
	element,
	webName: `Player ${element}`,
	teamShortName: 'ARS',
	teamName: 'Arsenal',
	elementTypeName: 'MIDFIELDER',
	isCaptain,
	isViceCaptain,
	multiplier,
	totalPoints: 0,
	minutes: 0,
	position: 1,
	goalsScored: 0,
	assists: 0,
	cleanSheets: 0,
	goalsConceded: 0,
	yellowCards: 0,
	redCards: 0,
	saves: 0,
	bonus: 0,
	bps: 0,
	againstShortName: 'CHE',
	wasHome: 'true',
	score: '',
	isPlayed: false,
	autoSub: false,
	expectedGoals: null,
	expectedAssists: null,
	expectedGoalInvolvements: null,
	expectedGoalsConceded: null,
})

describe('League Trends URL priority', () => {
	it('keeps mine/public identities separate even when numeric IDs collide', () => {
		const publicLeagues = [{
			tournamentId: 7,
			displayName: 'Public Seven',
			sortOrder: 1,
			publishedAt: '2026-08-01T00:00:00Z',
			updatedAt: '2026-08-01T00:00:00Z',
			latestAvailableEventId: 2,
			totalEntries: 100,
		}]
		assert.deepEqual(
			resolveInitialLeagueTrendsSelection({
				scopeParam: 'public',
				tournamentParam: '7',
				gwParam: '3',
				mineTournamentIds: [7],
				publicLeagues,
				defaultGameweek: 4,
			}),
			{
				scope: 'public',
				tournamentId: 7,
				key: 'public:7',
				gameweek: 3,
				urlSelectionValid: true,
			},
		)
	})

	it('falls back to My League, then the first curated public league', () => {
		const base = {
			scopeParam: null,
			tournamentParam: null,
			gwParam: null,
			publicLeagues: [{
				tournamentId: 9,
				displayName: 'Public',
				sortOrder: 1,
				publishedAt: '2026-08-01T00:00:00Z',
				updatedAt: '2026-08-01T00:00:00Z',
				latestAvailableEventId: 2,
				totalEntries: 100,
			}],
			defaultGameweek: 4,
		}
		assert.equal(
			resolveInitialLeagueTrendsSelection({ ...base, mineTournamentIds: [3] }).key,
			'mine:3',
		)
		const publicOnly = resolveInitialLeagueTrendsSelection({
			...base,
			mineTournamentIds: [],
		})
		assert.equal(publicOnly.key, 'public:9')
		assert.equal(publicOnly.gameweek, 2)
	})
})

describe('League Trends exposure', () => {
	it('uses user multiplier minus EO/100 within the returned top twelve', () => {
		const selection = [player(1, 80, 120), player(2, 60, 70), player(3, 40, 30)]
		const summary = buildLeagueTrendSummary(
			selection,
			[player(1, 80, 120, 35)],
			[pick(1, 2, true), pick(3, 0, false, true)],
		)
		assert.equal(summary.templateOwnedCount, 2)
		assert.equal(summary.captainRate, 35)
		assert.equal(summary.captainExposure?.gap, 0.8)
		assert.equal(summary.biggestNegative?.player.id, 2)
		assert.equal(summary.biggestNegative?.gap, -0.7)
		assert.equal(summary.biggestPositive?.player.id, 1)
		assert.deepEqual(summary.rolesByPlayerId.get(1), ['OWNED', 'CAPTAIN'])
		assert.deepEqual(summary.rolesByPlayerId.get(3), ['OWNED', 'VICE'])
	})
})
