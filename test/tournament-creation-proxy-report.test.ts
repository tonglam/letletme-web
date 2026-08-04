import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	createTournamentCreationProxyReporter,
	extractTournamentCreationResult,
	type TournamentCreationProxyReport
} from '../lib/tournament/creation-proxy-report'

describe('tournament creation proxy reporting', () => {
	it('extracts only bounded creation milestones', () => {
		assert.deepEqual(
			extractTournamentCreationResult({
				tournament: { id: 42, name: 'Private tournament name' },
				setupStatus: 'pending',
				leagueUrl: 'https://example.com/private-league'
			}),
			{ tournamentId: 42, setupStatus: 'pending' }
		)
		assert.deepEqual(
			extractTournamentCreationResult({
				tournament: { id: '42' },
				setupStatus: 'private-upstream-message'
			}),
			{ tournamentId: null, setupStatus: null }
		)
	})

	it('emits exactly once for success without retaining user data', () => {
		const reports: TournamentCreationProxyReport[] = []
		const report = createTournamentCreationProxyReporter(
			performance.now(),
			value => {
				reports.push(value)
			}
		)
		const privateMarker = 'Private Manager Marker'
		report('success', 201, {
			tournament: { id: 123, name: privateMarker },
			setupStatus: 'pending'
		})
		report('unavailable', 502, { error: privateMarker })

		assert.equal(reports.length, 1)
		assert.deepEqual(
			{
				outcome: reports[0].outcome,
				responseStatus: reports[0].responseStatus,
				tournamentId: reports[0].tournamentId,
				setupStatus: reports[0].setupStatus
			},
			{
				outcome: 'success',
				responseStatus: 201,
				tournamentId: 123,
				setupStatus: 'pending'
			}
		)
		assert.equal(JSON.stringify(reports[0]).includes(privateMarker), false)
	})

	it('supports upstream rejection, timeout and unavailable outcomes', () => {
		for (const [outcome, status] of [
			['upstream_rejected', 409],
			['timeout', 504],
			['unavailable', 502]
		] as const) {
			const reports: TournamentCreationProxyReport[] = []
			createTournamentCreationProxyReporter(performance.now(), value =>
				reports.push(value)
			)(outcome, status)
			assert.equal(reports[0].outcome, outcome)
			assert.equal(reports[0].responseStatus, status)
			assert.equal(reports[0].tournamentId, null)
		}
	})
})
