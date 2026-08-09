import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { pickCurrentEventId } from '@/lib/events-current'
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse,
} from '@/lib/graphql/operations/events'
import { cache } from 'react'

export { pickCurrentEventId } from '@/lib/events-current'

export const getCurrentAndNextEvents = cache(async (): Promise<EventsResponse | null> => {
	try {
		return await executePublicServerQuery<EventsResponse>(
			GET_CURRENT_AND_NEXT_EVENTS,
			undefined,
			CORE_AUTHORITY_FETCH_OPTIONS,
		)
	} catch (err) {
		console.error('[events] Failed to fetch current and next events:', err)
		return null
	}
})

/**
 * Authoritative current gameweek for live calculation / this-GW seed only.
 * Never substitutes next[] or liveSnapshot.eventId.
 */
export async function getCurrentEventId(): Promise<number | null> {
	return pickCurrentEventId(await getCurrentAndNextEvents())
}
