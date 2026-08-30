import type { LiveCalcData } from '@/lib/graphql/operations/live'

export type LivePointsPayloadState =
	'READY' | 'PENDING_SYNC' | 'NO_DATA'

/**
 * Classify an entry payload before rendering or scheduling another request.
 * READY is intentionally strict: an empty published lineup can never be
 * treated as usable live data, even when returned by an older GraphQL server.
 */
export function resolveLivePointsPayloadState(
	live: LiveCalcData
): LivePointsPayloadState {
	if (live.pickList.length > 0) return 'READY'

	if (live.availability === 'PENDING') return 'PENDING_SYNC'
	if (live.availability === 'NO_PICKS') return 'NO_DATA'

	return 'NO_DATA'
}
