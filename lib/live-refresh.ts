import type { LiveSnapshotStatus } from '@/lib/graphql/operations/live'

export const LIVE_AUTO_REFRESH_SECONDS = 30
export const LIVE_EXPLAIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function shouldPollLiveSnapshot({
	isPageActive,
	currentEventId,
	selectedEventId,
	snapshot
}: {
	isPageActive: boolean
	currentEventId?: number
	selectedEventId?: number
	snapshot?: LiveSnapshotStatus | null
}): boolean {
	if (!isPageActive || !currentEventId || selectedEventId !== currentEventId) {
		return false
	}

	// A missing snapshot is expected briefly while a backend refresh is publishing.
	// A stale/mismatched snapshot can also remain after a failed gameweek switch.
	// Keep current-event polling enabled so the UI can recover automatically.
	if (!snapshot || snapshot.eventId !== selectedEventId) return true

	return snapshot.state !== 'SETTLED'
}

export function shouldRefreshLiveExplain(
	lastAttemptAtMs: number,
	nowMs: number
): boolean {
	return nowMs - lastAttemptAtMs >= LIVE_EXPLAIN_REFRESH_INTERVAL_MS
}

export function liveSnapshotNeedsRefresh(
	accepted: LiveSnapshotStatus | null | undefined,
	observed: LiveSnapshotStatus | null | undefined
): boolean {
	if (!accepted || !observed) return true
	return (
		accepted.eventId !== observed.eventId ||
		accepted.revision !== observed.revision
	)
}
