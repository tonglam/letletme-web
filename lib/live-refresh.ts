import type {
	LiveContextResponse,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'

// Context is a cheap ETag probe. Keep it more frequent than the Data live
// publication poll so a newly published revision is noticed promptly without
// causing another upstream FPL request.
export const LIVE_AUTO_REFRESH_SECONDS = 15
export const LIVE_EXPLAIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function liveContextToSnapshot(
	context: LiveContextResponse['liveContext']
): LiveSnapshotStatus | null {
	if (
		!context ||
		context.eventId == null ||
		!context.revision ||
		!context.publishedAt ||
		!context.checkedAt
	) {
		return null
	}
	return {
		eventId: context.eventId,
		revision: context.revision,
		state: context.state,
		publishedAt: context.publishedAt,
		checkedAt: context.checkedAt
	}
}

/**
 * Tournament detail uses a synthetic revision while the next event has no
 * live publication yet. It is safe to probe for a real publication, but it
 * must never be sent to the live board endpoint as if it were a live revision.
 */
export function isSyntheticScheduledSnapshot(
	snapshot?: LiveSnapshotStatus | null
): boolean {
	return Boolean(
		snapshot?.state === 'SCHEDULED' && snapshot.revision.startsWith('scheduled-')
	)
}

export function canRequestLiveTournamentBoard(
	snapshot: LiveSnapshotStatus | null | undefined,
	nextRevision?: string | null
): boolean {
	if (!isSyntheticScheduledSnapshot(snapshot)) return true
	return Boolean(nextRevision && !nextRevision.startsWith('scheduled-'))
}

export function shouldPollLiveSnapshot({
	isPageActive,
	currentEventId,
	selectedEventId,
	snapshot,
	managerScoreState,
	managerNextRefreshAt,
	probeEventIdentity = false
}: {
	isPageActive: boolean
	currentEventId?: number
	selectedEventId?: number
	snapshot?: LiveSnapshotStatus | null
	/** Official manager score may refresh after the player snapshot settles. */
	managerScoreState?: string | null
	managerNextRefreshAt?: string | null
	/** Keep the matches page alive so it can discover the next event after settlement. */
	probeEventIdentity?: boolean
}): boolean {
	if (!isPageActive || !currentEventId || selectedEventId !== currentEventId) {
		return false
	}

	// A missing snapshot is expected briefly while a backend refresh is publishing.
	// A stale/mismatched snapshot can also remain after a failed gameweek switch.
	// Keep current-event polling enabled so the UI can recover automatically.
	if (!snapshot || snapshot.eventId !== selectedEventId) return true
	if (managerScoreState === 'SETTLING') return true
	if (managerNextRefreshAt && Date.parse(managerNextRefreshAt) <= Date.now()) return true

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
