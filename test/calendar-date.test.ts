import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CALENDAR_DATE_TIME_ZONE, parseCalendarDate } from '../lib/calendar-date'

function getDateParts(date: Date, timeZone: string) {
	return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		timeZone,
	}).formatToParts(date).map(part => [part.type, part.value]))
}

describe('calendar dates', () => {
	it('keeps a GraphQL date on the same calendar day when formatted in UTC', () => {
		const date = parseCalendarDate('2026-08-02')
		assert.ok(date)
		assert.deepEqual(
			getDateParts(date, CALENDAR_DATE_TIME_ZONE),
			{ month: '08', literal: '/', day: '02', year: '2026' },
		)
		assert.equal(getDateParts(date, 'America/Los_Angeles').day, '01')
	})

	it('rejects timestamps and impossible calendar dates', () => {
		assert.equal(parseCalendarDate('2026-08-02T00:00:00Z'), null)
		assert.equal(parseCalendarDate('2026-02-30'), null)
	})
})
