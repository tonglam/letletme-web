import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { describe, it } from 'node:test'
import { parse, visit } from 'graphql'

import { GET_LIVE_POINTS } from '../lib/graphql/operations/live'
import { traceableOfficialManagerScore } from '../lib/live-manager-score'

function astNodeCount(document: string): number {
	let count = 0
	visit(parse(document), {
		enter() {
			count += 1
		}
	})
	return count
}

describe('live points GraphQL document', () => {
	it('stays within the development gateway AST-node limit', () => {
		const count = astNodeCount(GET_LIVE_POINTS)
		assert.ok(
			count <= 200,
			`GET_LIVE_POINTS contains ${count} AST nodes`
		)
	})

	it('retains fields needed for score rendering on the legacy schema', () => {
		assert.match(GET_LIVE_POINTS, /pickActive/)
		assert.match(GET_LIVE_POINTS, /autoSub/)
		assert.match(GET_LIVE_POINTS, /nextRefreshAt/)
		assert.match(GET_LIVE_POINTS, /reconciliation/)
		assert.match(GET_LIVE_POINTS, /effectiveLineup/)
		assert.doesNotMatch(GET_LIVE_POINTS, /calculationMode/)
		assert.doesNotMatch(GET_LIVE_POINTS, /algorithmVersion/)
	})

	it('uses the queried score revision to invalidate an entry-specific SSR seed', async () => {
		const source = await readFile(
			new URL('../app/live/points/_hooks/useLivePoints.ts', import.meta.url),
			'utf8'
		)
		assert.match(source, /initialLiveData\?\.score\?\.revision/)
		assert.doesNotMatch(source, /initialLiveData\?\.livePoints/)
	})

	it('accepts a legacy score when source and state are authoritative', () => {
		const score = traceableOfficialManagerScore({
			eventPoints: 71,
			netEventPoints: 71,
			totalPoints: 71,
			totalScope: 'OVERALL',
			eventRank: 1,
			overallRank: 1,
			leagueRank: null,
			transferCost: 0,
			source: 'FPL_FINAL_RESULT',
			state: 'FINAL',
			eventPointSemantics: 'ZERO_COST_EQUIVALENT',
			revision: 'final:1:6953:test',
			checkedAt: '2026-08-27T08:08:31.281Z',
			upstreamUpdatedAt: null,
			staleAt: null,
			nextRefreshAt: null,
			reconciliation: 'MATCHED',
			reasonCodes: []
		})

		assert.ok(score)
		assert.equal(score?.eventPoints, 71)
	})

	it('keeps an explicit null calculation mode untraceable', () => {
		const score = traceableOfficialManagerScore({
			eventPoints: 71,
			netEventPoints: 71,
			totalPoints: 71,
			totalScope: 'OVERALL',
			eventRank: 1,
			overallRank: 1,
			leagueRank: null,
			transferCost: 0,
			source: 'FPL_FINAL_RESULT',
			state: 'FINAL',
			calculationMode: null,
			eventPointSemantics: 'ZERO_COST_EQUIVALENT',
			revision: 'final:1:6953:test',
			checkedAt: '2026-08-27T08:08:31.281Z',
			upstreamUpdatedAt: null,
			staleAt: null,
			nextRefreshAt: null,
			reconciliation: 'MATCHED',
			reasonCodes: []
		})

		assert.equal(score, undefined)
	})
})
