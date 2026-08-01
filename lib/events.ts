import { cache } from 'react'
import { executePublicServerQuery } from '@/lib/graphql-server'
import {
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse,
} from '@/lib/graphql/queries'

export const getCurrentAndNextEvents = cache(async (): Promise<EventsResponse | null> => {
	try {
		return await executePublicServerQuery<EventsResponse>(
			GET_CURRENT_AND_NEXT_EVENTS,
			undefined,
			{ cache: 'force-cache', next: { revalidate: 300 } },
		)
	} catch (err) {
		console.error('[events] Failed to fetch current and next events:', err)
		return null
	}
})
