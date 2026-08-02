const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export const CALENDAR_DATE_TIME_ZONE = 'UTC'

export function parseCalendarDate(value: string): Date | null {
	const match = CALENDAR_DATE_PATTERN.exec(value)
	if (!match) return null

	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const date = new Date(Date.UTC(year, month - 1, day))

	return date.getUTCFullYear() === year &&
		date.getUTCMonth() === month - 1 &&
		date.getUTCDate() === day
		? date
		: null
}
