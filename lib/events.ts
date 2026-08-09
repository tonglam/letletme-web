import { cache } from 'react'
import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
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
			CORE_AUTHORITY_FETCH_OPTIONS,
		)
	} catch (err) {
		console.error('[events] Failed to fetch current and next events:', err)
		return null
	}
})
