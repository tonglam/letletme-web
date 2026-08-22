import type {
	MarketOwnershipDay,
	MarketOwnershipOverview,
	MarketPulse,
	MarketSnapshotContext
} from '@/lib/graphql/operations/market'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
	return value !== null && typeof value === 'object'
		? (value as UnknownRecord)
		: null
}

function hasArray(value: UnknownRecord, key: string): boolean {
	return Array.isArray(value[key])
}

function hasMarketCoverage(value: unknown): boolean {
	const coverage = asRecord(value)
	return coverage !== null && Array.isArray(coverage.missingDates)
}

function hasOwnershipShape(value: UnknownRecord): boolean {
	return (
		(value.period === 'DAILY' || value.period === 'GAMEWEEK') &&
		hasMarketCoverage(value.coverage) &&
		hasArray(value, 'risers') &&
		hasArray(value, 'fallers')
	)
}

export function normalizeMarketPulseSummaryResponse(value: unknown): {
	marketSnapshotContext: MarketSnapshotContext
	marketPulse: MarketPulse
} | null {
	const response = asRecord(value)
	const context = asRecord(response?.marketSnapshotContext)
	const pulse = asRecord(response?.marketPulse)
	if (
		response === null ||
		context === null ||
		typeof context.revision !== 'string' ||
		pulse === null ||
		!hasMarketCoverage(pulse.coverage) ||
		!hasArray(pulse, 'mostSelected') ||
		!hasArray(pulse, 'transferMovers') ||
		!hasArray(pulse, 'availabilityHighlights') ||
		!hasArray(pulse, 'newPlayers') ||
		!hasArray(pulse, 'priceChanges') ||
		typeof pulse.availabilityUpdateCount !== 'number'
	) {
		return null
	}

	return {
		marketSnapshotContext: context as unknown as MarketSnapshotContext,
		marketPulse: {
			...(pulse as unknown as Omit<MarketPulse, 'availabilityUpdates'>),
			availabilityUpdates: []
		}
	}
}

export function normalizeMarketOwnershipOverview(
	value: unknown
): MarketOwnershipOverview | null {
	const response = asRecord(value)
	const overview = asRecord(response?.marketOwnershipOverview)
	return overview !== null && hasOwnershipShape(overview)
		? (overview as unknown as MarketOwnershipOverview)
		: null
}

export function normalizeMarketOwnershipDay(
	value: unknown
): MarketOwnershipDay | null {
	const response = asRecord(value)
	const day = asRecord(response?.marketOwnershipDay)
	return day !== null &&
		day.period === 'DAILY' &&
		hasMarketCoverage(day.coverage) &&
		hasArray(day, 'risers') &&
		hasArray(day, 'fallers')
		? (day as unknown as MarketOwnershipDay)
		: null
}
