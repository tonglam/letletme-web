import type { EventsResponse } from '@/lib/graphql/operations/events'

/**
 * Pure helper: id of the event marked isCurrent, or null.
 * Does **not** fall back to next / snapshot — live calc and “this GW” seeds
 * must hard-fail when this is null.
 */
export function pickCurrentEventId(
	events: EventsResponse | null | undefined,
): number | null {
	const id = events?.current?.[0]?.id
	return typeof id === 'number' && Number.isFinite(id) && id > 0 ? id : null
}
