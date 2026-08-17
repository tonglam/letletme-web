import { CORE_AUTHORITY_FETCH_OPTIONS } from '@/lib/core-authority-cache-policy'
import { executePublicServerQuery } from '@/lib/graphql-server'
import { pickCurrentEventId } from '@/lib/events-current'
import {
	GET_CORE_EVENT_CONTEXT,
	type CoreEventContextResponse,
	type CoreEventContextData,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import { cache } from 'react'

export { pickCurrentEventId } from '@/lib/events-current'

const isCoreEventContext = (
	value: CoreEventContextData | null | undefined,
): value is CoreEventContextData =>
	Boolean(
		value &&
		typeof value.season === 'string' &&
		typeof value.revision === 'string' &&
		typeof value.sourceCheckedAt === 'string' &&
		(value.currentEventId === null ||
			(typeof value.currentEventId === 'number' &&
				Number.isSafeInteger(value.currentEventId) &&
				value.currentEventId > 0)) &&
		(value.nextEventId === null ||
			(typeof value.nextEventId === 'number' &&
				Number.isSafeInteger(value.nextEventId) &&
				value.nextEventId > 0)) &&
		(value.latestFinishedEventId === null ||
			(typeof value.latestFinishedEventId === 'number' &&
				Number.isSafeInteger(value.latestFinishedEventId) &&
				value.latestFinishedEventId > 0)) &&
		(value.nextDeadlineTime === null || typeof value.nextDeadlineTime === 'string'),
	)

/** Read the authoritative event context without converting failures into an empty state. */
export const getCoreEventContext = cache(
	async (): Promise<CoreEventContextData> => {
		const response = await executePublicServerQuery<CoreEventContextResponse>(
			GET_CORE_EVENT_CONTEXT,
			undefined,
			CORE_AUTHORITY_FETCH_OPTIONS,
		)
		if (!isCoreEventContext(response.coreEventContext)) {
			throw new TypeError('Core event context response was invalid')
		}
		return response.coreEventContext
	},
)

export const getCurrentAndNextEvents = cache(
	async (): Promise<EventsResponse | null> => {
		try {
			const context = await getCoreEventContext()
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
