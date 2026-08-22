import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	isTrendCohortReady,
	mergeVisibleTrendCohorts
} from '../app/data/selections/_lib/trend-cohorts'
import { buildTrendUrl } from '../app/data/selections/_lib/trend-url'
import type { TrendAccess, TrendCohort } from '../lib/graphql/operations/trends'

function cohort(
	id: number,
	access: TrendAccess,
	setupStatus = 'ready'
): TrendCohort {
	return {
		id: `competition:${id}`,
		kind: 'TRACKED_OFFICIAL_COMPETITION',
		access,
		displayName: `Competition ${id}`,
		setupStatus,
		exact: true,
		latestEventId: setupStatus === 'ready' ? 1 : null,
		revision: null,
		availability: setupStatus === 'ready' ? 'READY' : 'NOT_READY',
		capabilities: []
	}
}

describe('visible Trends cohorts', () => {
	it('returns every membership plus public-only whitelist entries', () => {
		const visible = mergeVisibleTrendCohorts(
			[cohort(1, 'MINE'), cohort(2, 'MINE')],
			[cohort(2, 'PUBLIC'), cohort(3, 'PUBLIC')]
		)

		assert.deepEqual(
			visible.map(item => [item.id, item.access]),
			[
				['competition:1', 'MINE'],
				['competition:2', 'MINE'],
				['competition:3', 'PUBLIC']
			]
		)
	})

	it('keeps unfinished memberships visible but not selectable', () => {
		const unfinished = cohort(8, 'MINE', 'processing')
		const visible = mergeVisibleTrendCohorts([unfinished], [])

		assert.equal(visible[0], unfinished)
		assert.equal(isTrendCohortReady(unfinished), false)
		assert.equal(isTrendCohortReady(cohort(7, 'MINE')), true)
	})

	it('canonicalizes a fallback selection for navigation and sharing', () => {
		const url = buildTrendUrl(
			'https://letletme.top/explore/selections?tournament=8&gw=2&utm=test',
			'MINE',
			'competition:7',
			1
		)

		assert.equal(url.searchParams.get('cohort'), 'competition:7')
		assert.equal(url.searchParams.get('gw'), '1')
		assert.equal(url.searchParams.get('scope'), 'mine')
		assert.equal(url.searchParams.get('tournament'), null)
		assert.equal(url.searchParams.get('utm'), 'test')
	})
})
