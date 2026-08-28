import type { LiveCalcData } from '@/lib/graphql/operations/live'

export type LivePointsPayloadState =
	'READY' | 'PENDING_SYNC' | 'LINEUP_UNAVAILABLE' | 'NO_DATA'

const unavailableReasonCodes = new Set([
	'UPSTREAM_UNAVAILABLE',
	'UPSTREAM_RATE_LIMITED',
	'SOURCE_TOO_OLD',
	'SOURCE_SKEW'
])

/**
 * Classify an entry payload before rendering or scheduling another request.
 * READY is intentionally strict: an empty published lineup can never be
 * treated as usable live data, even when returned by an older GraphQL server.
 */
export function resolveLivePointsPayloadState(
	live: LiveCalcData
): LivePointsPayloadState {
	if (live.pickList.length > 0) return 'READY'

	if (
		live.availability === 'LINEUP_UNAVAILABLE' ||
		live.availability === 'READY'
	) {
		return 'LINEUP_UNAVAILABLE'
	}

	if (
		live.availability === undefined &&
		live.score?.reasonCodes.some(reason => unavailableReasonCodes.has(reason))
	) {
		return 'LINEUP_UNAVAILABLE'
	}

	if (live.availability === 'NO_PICKS' || live.availability === undefined) {
		if (
			live.score?.source === 'FPL_FINAL_RESULT' &&
			live.score.state === 'FINAL'
		) {
			return 'NO_DATA'
		}

		if (!live.entryName?.trim() || live.score?.state === 'UNAVAILABLE') {
			return 'PENDING_SYNC'
		}
	}

	return 'NO_DATA'
}
