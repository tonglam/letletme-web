import type { EventsResponse } from '@/lib/graphql/operations/events'
import { pickCurrentEventId } from '@/lib/events-current'

/**
 * Review-page gameweek anchor (My Team / My Tournament).
 *
 * Live calc still uses `pickCurrentEventId` only — never this helper.
 * When `isCurrent` is missing (between GWs, API lag), review pages must
 * still open Season history / last-known tournament field.
 */
export type ReviewGameweekAnchorSource =
	| 'current'
	| 'next-derived'
	| 'history'
	| 'none'

export type ReviewGameweekAnchor = {
	/** isCurrent id when present; null when FPL has no current event */
	currentGw: number | null
	/**
	 * Upper bound / default selected GW for review UI.
	 * Prefer current; else next-1; else history max; else null.
	 */
	anchorGw: number | null
	source: ReviewGameweekAnchorSource
}

function positiveId(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
		? value
		: null
}

/**
 * Resolve review anchor from events only (no GraphQL).
 * Optional `historyMaxEventId` refines when current/next are empty.
 */
export function resolveReviewGameweekAnchor(
	events: EventsResponse | null | undefined,
	opts?: { historyMaxEventId?: number | null },
): ReviewGameweekAnchor {
	const currentGw = pickCurrentEventId(events)
	if (currentGw != null) {
		return { currentGw, anchorGw: currentGw, source: 'current' }
	}

	const nextId = positiveId(events?.next?.[0]?.id)
	if (nextId != null) {
		// Between GWs: next is upcoming; last completed is typically next - 1.
		const derived = nextId > 1 ? nextId - 1 : nextId
		return { currentGw: null, anchorGw: derived, source: 'next-derived' }
	}

	const historyMax = positiveId(opts?.historyMaxEventId ?? null)
	if (historyMax != null) {
		return { currentGw: null, anchorGw: historyMax, source: 'history' }
	}

	return { currentGw: null, anchorGw: null, source: 'none' }
}

/** Current active event, otherwise the next event, for forward fixture planning. */
export function resolveFixturePlanningGameweek(
	events: EventsResponse | null | undefined,
): number | null {
	return pickCurrentEventId(events) ?? positiveId(events?.next?.[0]?.id)
}

/** Max eventId from entry history results (for Team review anchor). */
export function maxEventIdFromHistory(
	results: Array<{ eventId?: number | null }> | null | undefined,
): number | null {
	if (!results?.length) return null
	let max = 0
	for (const row of results) {
		const id = positiveId(row.eventId)
		if (id != null && id > max) max = id
	}
	return max > 0 ? max : null
}

/** True only before GW1; between later GWs also uses `next-derived`. */
export function isPreseasonReviewAnchor(
	anchor: ReviewGameweekAnchor,
): boolean {
	return (
		anchor.currentGw === null &&
		anchor.source === 'next-derived' &&
		anchor.anchorGw === 1
	)
}
