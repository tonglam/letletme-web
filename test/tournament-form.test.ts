import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	computeTournamentPlan,
	getImportedTournamentName,
	isCurrentLeaguePreviewRequest,
	nextPowerOfTwo,
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

	it('validates Head-to-Head mirrors independently from Classic mirrors', () => {
		const url = 'https://fantasy.premierleague.com/en/leagues/99/standings/h'
		assert.equal(validateLeagueUrl(url).valid, true)
		assert.deepEqual(validateLeagueUrl(url, undefined, { classicOnly: true }), {
			valid: false,
			domainValid: true,
			message: 'Use an FPL Classic standings URL.',
			leagueId: 99,
			leagueType: 'h2h',
		})
		assert.deepEqual(
			validateLeagueUrl(
				'https://fantasy.premierleague.com/en/leagues/34879/new-entries/h',
				undefined,
				{ h2hOnly: true },
			),
			{
				valid: true,
				domainValid: true,
				message: null,
				leagueId: 34879,
				leagueType: 'h2h',
			},
		)
	})

	it('uses the official league name without making it a required input', () => {
		assert.equal(getImportedTournamentName(' ♪ü♪让让群联赛10周年 ', 8863), '♪ü♪让让群联赛10周年')
		assert.equal(getImportedTournamentName('x', 8863), 'FPL League 8863')
	})

	it('ignores a league preview completed after switching creation mode', () => {
		assert.equal(isCurrentLeaguePreviewRequest({
			requestId: 4,
			currentRequestId: 4,
			requestMode: 'classic',
			currentMode: 'custom',
			requestedLeagueUrl: 'https://fantasy.premierleague.com/en/leagues/8863/standings/c',
			currentLeagueUrl: 'https://fantasy.premierleague.com/en/leagues/8863/standings/c',
		}), false)
	})

	it('applies only the latest preview for the current mode and URL', () => {
		assert.equal(isCurrentLeaguePreviewRequest({
			requestId: 4,
			currentRequestId: 4,
			requestMode: 'classic',
			currentMode: 'classic',
			requestedLeagueUrl: 'https://fantasy.premierleague.com/en/leagues/8863/standings/c',
			currentLeagueUrl: '  https://fantasy.premierleague.com/en/leagues/8863/standings/c  ',
		}), true)
	})

	it('rounds a non-power-of-two knockout field up with first-round byes', () => {
		assert.equal(nextPowerOfTwo(93), 128)

		const plan = computeTournamentPlan(
			{
				groupFormat: 'none',
				startGameweek: 'GW1',
				endGameweek: 'GW38',
				groupNum: '1',
				qualifiersPerGroup: '',
				knockoutFormat: 'single',
			},
			93,
			true,
		)

		assert.equal(plan.knockoutBracketSize, 128)
		assert.equal(plan.knockoutByeCount, 35)
		assert.equal(plan.knockoutReady, true)
	})

	it('prevents a knockout plan that would overrun the season', () => {
		const plan = computeTournamentPlan(
			{
				groupFormat: 'points',
				startGameweek: 'GW35',
				endGameweek: 'GW38',
				groupNum: '1',
				qualifiersPerGroup: '16',
				knockoutFormat: 'single',
			},
			16,
			true,
		)
		assert.equal(plan.groupReady, true)
		assert.equal(plan.knockoutEnd > 38, true)
		assert.equal(plan.knockoutReady, false)
	})

	it('starts a knockout-only tournament in its configured start gameweek', () => {
		const plan = computeTournamentPlan(
			{
				groupFormat: 'none',
				startGameweek: 'GW1',
				endGameweek: 'GW5',
				groupNum: '1',
				qualifiersPerGroup: '',
				knockoutFormat: 'single',
			},
			4,
			true,
		)

		assert.equal(plan.knockoutStart, 1)
		assert.equal(plan.knockoutEnd, 2)
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
