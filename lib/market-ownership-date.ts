import type { MarketOwnershipCoverage } from '@/lib/graphql/operations/market'

const ISO_CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

export function normalizeMarketOwnershipDate(
	value: string | undefined
): string | null {
	if (!value || !ISO_CALENDAR_DATE.test(value)) return null
	const parsed = new Date(`${value}T00:00:00.000Z`)
	return Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value
		? null
		: value
}

export function isPublishedMarketOwnershipDate(
	date: string,
	coverage: Pick<
		MarketOwnershipCoverage,
		'firstDate' | 'latestDate' | 'missingDates'
	>
): boolean {
	return Boolean(
		normalizeMarketOwnershipDate(date) &&
			coverage.firstDate &&
			coverage.latestDate &&
			date >= coverage.firstDate &&
			date <= coverage.latestDate &&
			!coverage.missingDates.includes(date)
	)
}
