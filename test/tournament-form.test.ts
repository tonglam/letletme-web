import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	computeTournamentPlan,
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
			},
		)
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
