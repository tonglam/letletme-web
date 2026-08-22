import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePreferredHomeMatchDayKey } from '../lib/home-match-day-selection'

test('home fixture tabs prefer the current local date', () => {
	assert.equal(
		resolvePreferredHomeMatchDayKey(
			[{ dateKey: '2026-08-22' }, { dateKey: '2026-08-23' }],
			new Date(2026, 7, 23, 1)
		),
		'2026-08-23'
	)
})

test('home fixture tabs fall back to the first available date', () => {
	assert.equal(
		resolvePreferredHomeMatchDayKey(
			[{ dateKey: '2026-08-22' }, { dateKey: '2026-08-24' }],
			new Date(2026, 7, 23, 1)
		),
		'2026-08-22'
	)
})
