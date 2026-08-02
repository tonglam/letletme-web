import { cache } from 'react'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse,
} from '@/lib/graphql/operations/events'

export const getCurrentAndNextEvents = cache(async (): Promise<EventsResponse | null> => {
	try {
		return await executePublicServerQuery<EventsResponse>(
			GET_CURRENT_AND_NEXT_EVENTS,
			undefined,
			{ cache: 'force-cache', next: { revalidate: 300 }, timeoutMs: 5_000 },
		)
	} catch (err) {
		console.error('[events] Failed to fetch current and next events:', err)
		return null
	}
})
