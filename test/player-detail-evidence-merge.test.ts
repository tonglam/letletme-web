import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	mergePlayerDetailEvidence,
	type PlayerEvidenceSection
} from '../app/data/player-stats/_lib/player-detail-evidence'
import type { PlayerDetailData } from '../lib/graphql/operations/players'

const availability = (
	fixtureState: 'READY' | 'STALE',
	recentState: 'READY' | 'STALE',
	marketState: 'READY' | 'STALE' = 'STALE'
) => ({
	isFullyAuthoritative: false,
	seasonStats: { state: 'READY' as const },
	market: { state: marketState },
	historicalTeam: { state: 'READY' as const },
	fixtures: { state: fixtureState },
	recentGameweeks: { state: recentState }
})

const detail = (dataAvailability: ReturnType<typeof availability>) =>
	({
		id: 13,
		dataAvailability
	}) as unknown as PlayerDetailData

describe('player detail evidence merge', () => {
	it('updates only the section covered by a recent evidence request', () => {
		const previous = detail(availability('STALE', 'STALE'))
		const next = mergePlayerDetailEvidence(
			previous,
			{
				dataAvailability: {
					...previous.dataAvailability,
					fixtures: { state: 'READY' },
					recentGameweeks: { state: 'READY' }
				}
			} as never,
			'recent'
		)
		assert.equal(next.dataAvailability.recentGameweeks.state, 'READY')
		assert.equal(next.dataAvailability.fixtures.state, 'STALE')
		assert.equal(next.dataAvailability.isFullyAuthoritative, false)
	})

	it('uses the same field-scoped merge for process and season evidence', () => {
		for (const section of ['season', 'process'] as PlayerEvidenceSection[]) {
			const previous = detail(availability('STALE', 'STALE'))
			const next = mergePlayerDetailEvidence(
				previous,
				{
					dataAvailability: {
						...previous.dataAvailability,
						seasonStats: { state: 'READY' }
					}
				} as never,
				section
			)
			assert.equal(next.dataAvailability.seasonStats.state, 'READY')
			assert.equal(next.dataAvailability.fixtures.state, 'STALE')
		}
	})

	it('recomputes aggregate authority after the final degraded section is refreshed', () => {
		const previous = detail(availability('READY', 'STALE', 'READY'))
		const next = mergePlayerDetailEvidence(
			previous,
			{
				dataAvailability: {
					...previous.dataAvailability,
					recentGameweeks: { state: 'READY' }
				}
			} as never,
			'recent'
		)
		assert.equal(next.dataAvailability.isFullyAuthoritative, true)
	})

	it('preserves a fresh unrelated degradation from an evidence response', () => {
		const previous = detail(availability('READY', 'READY', 'READY'))
		const next = mergePlayerDetailEvidence(
			previous,
			{
				dataAvailability: {
					...previous.dataAvailability,
					fixtures: { state: 'STALE' },
					recentGameweeks: { state: 'READY' }
				}
			} as never,
			'recent'
		)
		assert.equal(next.dataAvailability.fixtures.state, 'STALE')
		assert.equal(next.dataAvailability.recentGameweeks.state, 'READY')
		assert.equal(next.dataAvailability.isFullyAuthoritative, false)
	})
})
