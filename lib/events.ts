import { executePublicServerQuery } from '@/lib/graphql-server'
import { pickCurrentEventId } from '@/lib/events-current'
import {
	GET_CORE_EVENT_CONTEXT,
	type CoreEventContextResponse,
	type CoreEventContextData,
	type EventsResponse
} from '@/lib/graphql/operations/events'
import { CacheTag, RevalidateSeconds } from '@/lib/cache-policy'
import { coalescePublicSeed } from '@/lib/public-seed-singleflight'
import { unstable_cache } from 'next/cache'
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

const loadCoreEventContextFromOrigin = unstable_cache(
	async (): Promise<CoreEventContextData> => {
		return coalescePublicSeed('core-event-context', async () => {
			console.info('[public graphql cache]', {
				key: 'core-event-context',
				workload: 'home',
				cacheResult: 'miss-fill'
			})
			const response = await executePublicServerQuery<CoreEventContextResponse>(
				'home',
				GET_CORE_EVENT_CONTEXT,
				undefined,
				{ cache: 'no-store', timeoutMs: 5_000 }
			)
			if (!isCoreEventContext(response.coreEventContext)) {
				throw new TypeError('Core event context response was invalid')
			}
			return response.coreEventContext
		})
	},
	['graphql', 'core-event-context', 'v1'],
	{ revalidate: RevalidateSeconds.events, tags: [CacheTag.events] }
)

/** Request-coalesced read backed by the cross-instance Next Data Cache. */
export const getCoreEventContext = cache(loadCoreEventContextFromOrigin)

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
