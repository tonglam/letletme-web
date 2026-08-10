import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
	entryMatchesTeamExposureRules,
	getTeamExposureFilterSummary,
	type TeamExposureEntry,
} from '../lib/team-exposure-filter'

const entries: TeamExposureEntry[] = [
	{
		id: '1',
		picks: [
			{ teamShortName: 'ARS', teamName: 'Arsenal', position: 1 },
			{ teamShortName: 'ARS', teamName: 'Arsenal', position: 2 },
			{ teamShortName: 'LIV', teamName: 'Liverpool', position: 5 },
			{ teamShortName: 'MCI', teamName: 'Man City', position: 12 },
		],
	},
	{
		id: '2',
		picks: [
			{ teamShortName: 'ARS', teamName: 'Arsenal', position: 3 },
			{ teamShortName: 'LIV', teamName: 'Liverpool', position: 6 },
			{ teamShortName: 'LIV', teamName: 'Liverpool', position: 7 },
		],
	},
	{
		id: '3',
		picks: [
			{ teamShortName: 'CHE', teamName: 'Chelsea', position: 4 },
			{ teamShortName: 'ARS', teamName: 'Arsenal', position: 13 },
		],
	},
]

describe('team exposure multi-team filter', () => {
	it('matches all rules with AND semantics', () => {
		const ok = entryMatchesTeamExposureRules(
			entries[0],
			[
				{ teamShortName: 'ARS', exactCount: 2 },
				{ teamShortName: 'LIV', exactCount: 1 },
			],
			'any',
		)
		assert.equal(ok, true)

		const no = entryMatchesTeamExposureRules(
			entries[1],
			[
				{ teamShortName: 'ARS', exactCount: 2 },
				{ teamShortName: 'LIV', exactCount: 1 },
			],
			'any',
		)
		assert.equal(no, false)
	})

	it('respects starter scope across multiple teams', () => {
		// entry 1 has 2 ARS starters, 1 LIV starter, 1 MCI bench
		const summary = getTeamExposureFilterSummary(
			entries,
			[{ teamShortName: 'ARS', exactCount: 2 }],
			'starter',
		)
		assert.deepEqual(summary.matchedEntryIds, ['1'])
	})

	it('inactive when rules empty', () => {
		const summary = getTeamExposureFilterSummary(entries, [], 'any')
		assert.equal(summary.matchedCount, 3)
	})
})
