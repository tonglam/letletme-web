import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { playerDataAvailabilityIssues } from '../app/data/player-stats/_lib/player-data-availability'
import type {
	PlayerDataSectionAvailability,
	PlayerDataState
} from '../lib/graphql/operations/players'

const section = (state: PlayerDataState): PlayerDataSectionAvailability => ({
	state,
	reasonCode: `${state}_REASON`,
	revision: 'revision-1',
	sourceCheckedAt: '2026-08-28T00:00:00.000Z'
})

describe('player data availability presentation', () => {
	it('treats only READY, EMPTY, and NOT_APPLICABLE as authoritative', () => {
		for (const state of ['READY', 'EMPTY', 'NOT_APPLICABLE'] as const) {
			assert.deepEqual(
				playerDataAvailabilityIssues({
					isFullyAuthoritative: true,
					market: section(state),
					historicalTeam: section(state),
					fixtures: section(state),
					recentGameweeks: section(state)
				}),
				[]
			)
		}
	})

	it('preserves stale, fallback, and unavailable as distinct section issues', () => {
		const issues = playerDataAvailabilityIssues({
			isFullyAuthoritative: false,
			market: section('STALE'),
			historicalTeam: section('FALLBACK'),
			fixtures: section('UNAVAILABLE'),
			recentGameweeks: section('EMPTY')
		})

		assert.deepEqual(
			issues.map(issue => [issue.section, issue.state]),
			[
				['market', 'STALE'],
				['historicalTeam', 'FALLBACK'],
				['fixtures', 'UNAVAILABLE']
			]
		)
		assert.equal(issues[0]?.reasonCode, 'STALE_REASON')
		assert.equal(issues[0]?.sourceCheckedAt, '2026-08-28T00:00:00.000Z')
	})

	it('fails closed when the aggregate flag contradicts authoritative sections', () => {
		assert.deepEqual(
			playerDataAvailabilityIssues({
				isFullyAuthoritative: false,
				market: section('READY'),
				historicalTeam: section('EMPTY'),
				fixtures: section('NOT_APPLICABLE'),
				recentGameweeks: section('READY')
			}),
			[
				{
					section: 'player',
					state: 'UNAVAILABLE',
					reasonCode: 'INCONSISTENT_AVAILABILITY',
					sourceCheckedAt: null
				}
			]
		)
	})
})
