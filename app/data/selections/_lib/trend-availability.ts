import {
	normalizeFeatureAvailabilityState,
	type FeatureAvailabilityState,
} from '@/lib/season-presentation'

/** Convert upstream trend lifecycle values into the Web availability contract. */
export function normalizeTrendAvailabilityState(
	value: string | null | undefined,
): FeatureAvailabilityState | null {
	return normalizeFeatureAvailabilityState(value)
}

export function resolveTrendAvailabilityState(section: {
	state: string
	evidenceContext?: { availabilityState?: string | null }
	rows?: unknown[] | null
}): FeatureAvailabilityState {
	return (
		normalizeTrendAvailabilityState(section.evidenceContext?.availabilityState) ??
		normalizeTrendAvailabilityState(section.state) ??
		(section.rows === null ? 'UNAVAILABLE' : 'AVAILABLE')
	)
}

export type TrendAvailabilityLabelKey =
	| 'availabilityAvailable'
	| 'availabilityNotYetCaptured'
	| 'availabilityConfirmedEmpty'
	| 'availabilityStale'
	| 'availabilityPartial'
	| 'availabilityUnavailable'

export function trendAvailabilityLabelKey(
	state: FeatureAvailabilityState,
): TrendAvailabilityLabelKey {
	const labels: Record<FeatureAvailabilityState, TrendAvailabilityLabelKey> = {
		AVAILABLE: 'availabilityAvailable',
		NOT_YET_CAPTURED: 'availabilityNotYetCaptured',
		CONFIRMED_EMPTY: 'availabilityConfirmedEmpty',
		STALE: 'availabilityStale',
		PARTIAL: 'availabilityPartial',
		UNAVAILABLE: 'availabilityUnavailable',
	}
	return labels[state]
}

export type TrendAvailabilityMessageKey =
	| 'notYetCaptured'
	| 'confirmedEmpty'
	| 'staleData'
	| 'partialData'
	| 'sectionUnavailable'

export function trendAvailabilityMessageKey(
	state: FeatureAvailabilityState,
): TrendAvailabilityMessageKey {
	const messages: Record<FeatureAvailabilityState, TrendAvailabilityMessageKey> = {
		AVAILABLE: 'sectionUnavailable',
		NOT_YET_CAPTURED: 'notYetCaptured',
		CONFIRMED_EMPTY: 'confirmedEmpty',
		STALE: 'staleData',
		PARTIAL: 'partialData',
		UNAVAILABLE: 'sectionUnavailable',
	}
	return messages[state]
}
