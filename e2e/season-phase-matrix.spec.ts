import { expect, test } from '@playwright/test'
import { resolveSeasonPresentation } from '../lib/season-presentation'
import type { CoreEventContextData } from '../lib/graphql/operations/events'

test('S03 season phase fixture states resolve to bounded user phases', async ({}, testInfo) => {
	const base: CoreEventContextData = {
		season: '2627',
		revision: 's03-fixture',
		sourceCheckedAt: '2026-09-15T00:00:00Z',
		currentEventId: null,
		nextEventId: null,
		nextDeadlineTime: null,
		latestFinishedEventId: null
	}
	const fixtures = [
		{
			name: 'PRESEASON',
			context: { ...base, nextEventId: 1 },
			expected: 'PRESEASON'
		},
		{
			name: 'BETWEEN_GAMEWEEKS',
			context: { ...base, nextEventId: 5, latestFinishedEventId: 4 },
			expected: 'BETWEEN_GAMEWEEKS'
		},
		{
			name: 'OFFSEASON',
			context: { ...base },
			expected: 'OFFSEASON'
		},
		{
			name: 'invalid context',
			context: { ...base, season: null as unknown as string },
			expected: 'UNAVAILABLE'
		}
	] as const
	const rows = fixtures.map(fixture => {
		const actual = resolveSeasonPresentation(fixture.context)
		expect(actual.phase, fixture.name).toBe(fixture.expected)
		return {
			state: fixture.name,
			input: fixture.context,
			actual: actual.phase,
			currentEventId: actual.currentEventId,
			nextEventId: actual.nextEventId,
			latestFinishedEventId: actual.latestFinishedEventId
		}
	})
	await testInfo.attach('S03-phase-model', {
		contentType: 'application/json',
		body: JSON.stringify({
			caseId: 'S03',
			stepIds: ['S03.01'],
			states: rows,
			assertions: [
				'PRESEASON is selected only when no current event and next event is GW1',
				'BETWEEN_GAMEWEEKS is selected when the current event is absent but a later next event and finished event exist',
				'OFFSEASON is selected when both current and next events are absent',
				'invalid core context resolves to UNAVAILABLE instead of waiting forever'
			],
			functionalStatus: 'PASS',
			performanceStatus: 'NOT_OBSERVED',
			readyMs: null,
			eventToPaintMs: null,
			businessWrites: [],
			wholeCaseComplete: false,
			missingReason: 'Phase resolver states are covered in isolated runtime; the rendered NOT_PUBLISHED feature state and full route/locale/device matrix remain open.'
		})
	})
})
