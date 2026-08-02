import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	computeTournamentPlan,
	getImportedTournamentName,
	isPowerOfTwo,
	tournamentFormSchema,
	validateLeagueUrl,
} from '../app/tournament/create/_lib/tournament-form'

describe('tournament creation model', () => {
	it('accepts only secure supported Fantasy Premier League URLs', () => {
		assert.equal(
			validateLeagueUrl('https://fantasy.premierleague.com/leagues/12345/standings').valid,
			true,
		)
		assert.deepEqual(
			validateLeagueUrl('https://evil.example/leagues/12345/standings'),
			{
				valid: false,
				domainValid: false,
				message: 'Only secure URLs from fantasy.premierleague.com are allowed.',
				leagueId: null,
				leagueType: null,
			},
		)
	})

	it('accepts the localized classic URL copied from FPL', () => {
		assert.deepEqual(
			validateLeagueUrl(
				'https://fantasy.premierleague.com/en/leagues/8863/standings/c',
				undefined,
				{ classicOnly: true },
			),
			{
				valid: true,
				domainValid: true,
				message: null,
				leagueId: 8863,
				leagueType: 'classic',
			},
		)
	})

	it('keeps head-to-head import reserved without removing custom URL support', () => {
		const url = 'https://fantasy.premierleague.com/en/leagues/99/standings/h'
		assert.equal(validateLeagueUrl(url).valid, true)
		assert.deepEqual(validateLeagueUrl(url, undefined, { classicOnly: true }), {
			valid: false,
			domainValid: true,
			message: 'Use an FPL Classic standings URL. Head-to-head import is coming later.',
			leagueId: 99,
			leagueType: 'h2h',
		})
	})

	it('uses the official league name without making it a required input', () => {
		assert.equal(getImportedTournamentName(' ♪ü♪让让群联赛10周年 ', 8863), '♪ü♪让让群联赛10周年')
		assert.equal(getImportedTournamentName('x', 8863), 'FPL League 8863')
	})

	it('requires a power-of-two knockout field', () => {
		assert.equal(isPowerOfTwo(2), true)
		assert.equal(isPowerOfTwo(8), true)
		assert.equal(isPowerOfTwo(6), false)
	})

	it('prevents a knockout plan that would overrun the season', () => {
		const plan = computeTournamentPlan(
			{
				groupFormat: 'none',
				startGameweek: 'GW35',
				endGameweek: 'GW38',
				groupNum: '1',
				qualifiersPerGroup: '',
				knockoutFormat: 'single',
			},
			16,
			true,
		)
		assert.equal(plan.groupReady, true)
		assert.equal(plan.knockoutEnd > 38, true)
		assert.equal(plan.knockoutReady, false)
	})

	it('accepts a valid no-knockout points race', () => {
		const plan = computeTournamentPlan(
			{
				groupFormat: 'points',
				startGameweek: 'GW1',
				endGameweek: 'GW38',
				groupNum: '2',
				qualifiersPerGroup: '',
				knockoutFormat: 'none',
			},
			20,
			true,
		)
		assert.equal(plan.groupTeamCount, 10)
		assert.equal(plan.groupReady, true)
		assert.equal(plan.knockoutReady, true)
	})

	it('rejects invalid gameweek ordering and numeric structure fields', () => {
		const result = tournamentFormSchema.safeParse({
			tournamentName: 'Review Cup',
			participantSource: 'official',
			leagueUrl: 'https://fantasy.premierleague.com/leagues/12345/standings',
			groupFormat: 'points',
			startGameweek: 'GW12',
			endGameweek: 'GW4',
			groupNum: 'not-a-number',
			qualifiersPerGroup: '0',
			knockoutFormat: 'single',
		})

		assert.equal(result.success, false)
		if (!result.success) {
			assert.deepEqual(
				new Set(result.error.issues.map((issue) => issue.path[0])),
				new Set(['endGameweek', 'groupNum', 'qualifiersPerGroup']),
			)
		}
	})
})
