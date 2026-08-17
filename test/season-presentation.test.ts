import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
	resolveSeasonPresentation,
	type SeasonPhaseSignal,
} from '@/lib/season-presentation'
import type { CoreEventContextData } from '@/lib/graphql/operations/events'

const baseContext = (
	overrides: Partial<CoreEventContextData> = {},
): CoreEventContextData => ({
	season: '2627',
	revision: 'core-test-v1',
	sourceCheckedAt: '2026-08-17T00:00:00.000Z',
	currentEventId: null,
	nextEventId: 1,
	nextDeadlineTime: '2026-08-21T18:30:00.000Z',
	latestFinishedEventId: null,
	...overrides,
})

describe('resolveSeasonPresentation', () => {
	it('recognises valid preseason and does not substitute next GW for current', () => {
		const result = resolveSeasonPresentation(baseContext())
		assert.equal(result.phase, 'PRESEASON')
		assert.equal(result.currentEventId, null)
		assert.equal(result.nextEventId, 1)
	})

	it('distinguishes a later between-gameweek gap from preseason', () => {
		assert.equal(
			resolveSeasonPresentation(
				baseContext({ nextEventId: 8, latestFinishedEventId: 7 }),
			).phase,
			'BETWEEN_GAMEWEEKS',
		)
	})

	it('recognises offseason when there is no current or next event', () => {
		assert.equal(
			resolveSeasonPresentation(
				baseContext({ nextEventId: null, latestFinishedEventId: 38 }),
			).phase,
			'OFFSEASON',
		)
	})

	it('maps authoritative live lifecycle signals', () => {
		const expected: Array<[SeasonPhaseSignal, string]> = [
			['SCHEDULED', 'PRE_DEADLINE'],
			['PRE_DEADLINE', 'PRE_DEADLINE'],
			['PROVISIONAL', 'LIVE'],
			['LIVE', 'LIVE'],
			['LIVE_ACTIVE', 'LIVE'],
			['BETWEEN_FIXTURES', 'LIVE'],
			['PICKS_WAIT', 'SETTLING'],
			['PICKS_PROBE', 'SETTLING'],
			['PICKS_SYNC', 'SETTLING'],
			['DAY_SETTLING', 'SETTLING'],
			['GW_REVIEW', 'SETTLING'],
			['SETTLING', 'SETTLING'],
			['SETTLED', 'SETTLED'],
			['FINALIZED', 'SETTLED'],
		]

		for (const [signal, phase] of expected) {
			assert.equal(
				resolveSeasonPresentation(
					baseContext({ currentEventId: 1, latestFinishedEventId: null }),
					signal,
				).phase,
				phase,
				`signal ${signal}`,
			)
		}
	})

	it('treats active context without a valid live signal as unavailable', () => {
		assert.equal(
			resolveSeasonPresentation(baseContext({ currentEventId: 1 })).phase,
			'UNAVAILABLE',
		)
		assert.equal(resolveSeasonPresentation(null).phase, 'UNAVAILABLE')
		assert.equal(resolveSeasonPresentation(undefined).phase, 'UNAVAILABLE')
	})
})
