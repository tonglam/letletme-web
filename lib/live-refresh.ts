import type {
	LiveContextResponse,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'

// Context is a cheap ETag probe. Keep it more frequent than the Data live
// publication poll so a newly published revision is noticed promptly without
// causing another upstream FPL request.
export const LIVE_AUTO_REFRESH_SECONDS = 30
export const LIVE_EXPLAIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function liveContextToSnapshot(
	context: LiveContextResponse['liveContext']
): LiveSnapshotStatus | null {
	if (!context || context.anchorEventId == null) {
		return null
	}
	return {
		eventId: context.anchorEventId,
		revision: context.revision,
		state: context.windowState,
		publishedAt: context.publishedAt ?? null,
		checkedAt: context.checkedAt ?? null,
		windowState: context.windowState,
		dataAvailability: context.dataAvailability,
		nextRefreshAt: context.nextRefreshAt
	}
}

export function shouldPollLiveSnapshot({
	isPageActive,
	currentEventId,
	selectedEventId,
	snapshot,
	managerScoreState,
	managerNextRefreshAt,
	windowState,
	nextRefreshAt,
	probeEventIdentity = false
}: {
	isPageActive: boolean
	currentEventId?: number
	selectedEventId?: number
	snapshot?: LiveSnapshotStatus | null
	/** Official manager score may refresh after the player snapshot settles. */
	managerScoreState?: string | null
	managerNextRefreshAt?: string | null
	windowState?: string | null
	nextRefreshAt?: string | null
	/** Keep the matches page alive so it can discover the next event after settlement. */
	probeEventIdentity?: boolean
}): boolean {
	if (!isPageActive || !currentEventId || selectedEventId !== currentEventId) {
		return false
	}
	// Preseason still has an upcoming anchor and needs a low-frequency context
	// probe so the three live desks can switch together after the first actual
	// kickoff. There is nothing to probe in a true offseason with no anchor.
	if (windowState === 'OFFSEASON') return false

	// A missing snapshot is expected briefly while a backend refresh is publishing.
	// A stale/mismatched snapshot can also remain after a failed gameweek switch.
	// Keep current-event polling enabled so the UI can recover automatically.
	if (!snapshot || snapshot.eventId !== selectedEventId) return true
	if (managerScoreState === 'SETTLING') return true
	// Keep the normal countdown armed for both due and future official manager
	// refreshes. React will not re-evaluate this predicate merely because time
	// passed, so disabling it for a future deadline would leave stale scores
	// stuck until a manual refresh.
	if (managerNextRefreshAt && Number.isFinite(Date.parse(managerNextRefreshAt)))
		return true
	if (nextRefreshAt && Number.isFinite(Date.parse(nextRefreshAt))) return true

	return snapshot.state !== 'SETTLED' || probeEventIdentity
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
		accepted.revision !== observed.revision ||
		accepted.checkedAt !== observed.checkedAt
	)
}

export function liveRefreshEventIdentityChanged(
	acceptedCurrentEventId: number | undefined,
	acceptedNextEventId: number | undefined,
	currentEventId: number | undefined,
	nextEventId: number | undefined
): boolean {
	return (
		acceptedCurrentEventId !== currentEventId ||
		acceptedNextEventId !== nextEventId
	)
}
