import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { pickCurrentEventId } from '@/lib/events-current'
import {
	GET_CORE_EVENT_CONTEXT,
	type CoreEventContextResponse,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import { cache } from 'react'

export { pickCurrentEventId } from '@/lib/events-current'

export const getCurrentAndNextEvents = cache(
	async (): Promise<EventsResponse | null> => {
		try {
			const response = await executePublicServerQuery<CoreEventContextResponse>(
				GET_CORE_EVENT_CONTEXT,
				undefined,
				CORE_AUTHORITY_FETCH_OPTIONS
			)
			const context = response.coreEventContext
			return {
				current:
					context.currentEventId == null
						? []
						: [{ id: context.currentEventId }],
				next:
					context.nextEventId == null
						? []
						: [
								{
									id: context.nextEventId,
									deadlineTime: context.nextDeadlineTime ?? ''
								}
							]
			}
		} catch (err) {
			console.error('[events] Failed to fetch current and next events:', err)
			return null
		}
	}
)

/**
 * Authoritative current gameweek for live calculation / this-GW seed only.
 * Never substitutes next[] or liveSnapshot.eventId.
 */
export async function getCurrentEventId(): Promise<number | null> {
	return pickCurrentEventId(await getCurrentAndNextEvents())
}
