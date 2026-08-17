import type { CoreEventContextData } from '@/lib/graphql/operations/events'

export type SeasonPresentationPhase =
	| 'PRESEASON'
	| 'PRE_DEADLINE'
	| 'LIVE'
	| 'SETTLING'
	| 'SETTLED'
	| 'BETWEEN_GAMEWEEKS'
	| 'OFFSEASON'
	| 'UNAVAILABLE'

export type FeatureAvailabilityState =
	| 'AVAILABLE'
	| 'NOT_YET_CAPTURED'
	| 'CONFIRMED_EMPTY'
	| 'STALE'
	| 'PARTIAL'
	| 'UNAVAILABLE'

export type SeasonPhaseSignal =
	| 'SCHEDULED'
	| 'PRE_DEADLINE'
	| 'PROVISIONAL'
	| 'LIVE'
	| 'LIVE_ACTIVE'
	| 'BETWEEN_FIXTURES'
	| 'PICKS_WAIT'
	| 'PICKS_PROBE'
	| 'PICKS_SYNC'
	| 'DAY_SETTLING'
	| 'GW_REVIEW'
	| 'SETTLING'
	| 'SETTLED'
	| 'FINALIZED'

const featureAvailabilityStates = new Set<FeatureAvailabilityState>([
	'AVAILABLE',
	'NOT_YET_CAPTURED',
	'CONFIRMED_EMPTY',
	'STALE',
	'PARTIAL',
	'UNAVAILABLE',
])

/** Normalize upstream feature lifecycle values before they reach a UI. */
export function normalizeFeatureAvailabilityState(
	value: string | null | undefined,
): FeatureAvailabilityState | null {
	const normalized = value?.trim().toUpperCase()
	if (!normalized) return null
	if (normalized === 'NOT_READY') return 'NOT_YET_CAPTURED'
	if (normalized === 'READY') return 'AVAILABLE'
	if (normalized === 'EMPTY') return 'CONFIRMED_EMPTY'
	if (normalized === 'FAILED' || normalized === 'ERROR') return 'UNAVAILABLE'
	return featureAvailabilityStates.has(normalized as FeatureAvailabilityState)
		? (normalized as FeatureAvailabilityState)
		: null
}

export type SeasonPresentation = {
	phase: SeasonPresentationPhase
	season: string | null
	currentEventId: number | null
	nextEventId: number | null
	latestFinishedEventId: number | null
	nextDeadlineTime: string | null
	signal: SeasonPhaseSignal | null
}

const isNullablePositiveInteger = (value: unknown): value is number | null =>
	value === null ||
	(typeof value === 'number' && Number.isSafeInteger(value) && value > 0)

const isCoreEventContext = (
	value: CoreEventContextData | null | undefined,
): value is CoreEventContextData =>
	Boolean(
		value &&
		typeof value.season === 'string' &&
		typeof value.revision === 'string' &&
		typeof value.sourceCheckedAt === 'string' &&
		isNullablePositiveInteger(value.currentEventId) &&
		isNullablePositiveInteger(value.nextEventId) &&
		isNullablePositiveInteger(value.latestFinishedEventId) &&
		(value.nextDeadlineTime === null || typeof value.nextDeadlineTime === 'string'),
	)

const basePresentation = (
	context: CoreEventContextData | null,
	signal: SeasonPhaseSignal | null,
	phase: SeasonPresentationPhase,
): SeasonPresentation => ({
	phase,
	season: context?.season ?? null,
	currentEventId: context?.currentEventId ?? null,
	nextEventId: context?.nextEventId ?? null,
	latestFinishedEventId: context?.latestFinishedEventId ?? null,
	nextDeadlineTime: context?.nextDeadlineTime ?? null,
	signal,
})

function phaseFromSignal(signal: SeasonPhaseSignal): SeasonPresentationPhase {
	switch (signal) {
		case 'SCHEDULED':
		case 'PRE_DEADLINE':
			return 'PRE_DEADLINE'
		case 'PROVISIONAL':
		case 'LIVE':
		case 'LIVE_ACTIVE':
		case 'BETWEEN_FIXTURES':
			return 'LIVE'
		case 'PICKS_WAIT':
		case 'PICKS_PROBE':
		case 'PICKS_SYNC':
		case 'DAY_SETTLING':
		case 'GW_REVIEW':
		case 'SETTLING':
			return 'SETTLING'
		case 'SETTLED':
		case 'FINALIZED':
			return 'SETTLED'
	}
}

/**
 * Resolve user-facing season state from authoritative event and live signals.
 * A missing current event is valid; it is never treated as a fetch failure.
 */
export function resolveSeasonPresentation(
	context: CoreEventContextData | null | undefined,
	signal: SeasonPhaseSignal | null | undefined = null,
): SeasonPresentation {
	if (!isCoreEventContext(context)) {
		return basePresentation(null, signal ?? null, 'UNAVAILABLE')
	}

	const { currentEventId, nextEventId, latestFinishedEventId } = context
	if (currentEventId === null) {
		if (nextEventId === 1 && latestFinishedEventId === null) {
			return basePresentation(context, signal ?? null, 'PRESEASON')
		}
		if (nextEventId !== null && nextEventId > 1 && latestFinishedEventId !== null) {
			return basePresentation(context, signal ?? null, 'BETWEEN_GAMEWEEKS')
		}
		if (nextEventId === null) {
			return basePresentation(context, signal ?? null, 'OFFSEASON')
		}
		return basePresentation(context, signal ?? null, 'UNAVAILABLE')
	}

	if (signal === null || signal === undefined) {
		return basePresentation(context, null, 'UNAVAILABLE')
	}

	return basePresentation(context, signal, phaseFromSignal(signal))
}
