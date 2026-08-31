import type {
	LiveContextResponse,
	LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import type { LiveMatchdayStatus } from '@/lib/live-matches'

// Context is a cheap ETag probe. Keep it more frequent than the Data live
// publication poll so a newly published revision is noticed promptly without
// causing another upstream FPL request.
export const LIVE_AUTO_REFRESH_SECONDS = 30
export const LIVE_EXPLAIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000

export function isLiveRefreshTerminalState(state?: string | null): boolean {
	return (
		state === 'FINAL' ||
		state === 'GW_REVIEW' ||
		state === 'FINALIZED' ||
		state === 'BETWEEN_GAMEWEEKS' ||
		state === 'OFFSEASON'
	)
}

/**
 * A finished matchday still needs a cheap lifecycle probe so an open matches
 * page can discover the next gameweek. This does not authorize another live
 * score refresh; the caller only reloads the desk when the event identity
 * changes.
 */
export function shouldPollLiveMatchesTransition({
	isPageActive,
	currentEventId,
	snapshot
}: {
	isPageActive: boolean
	currentEventId?: number
	snapshot?: LiveMatchdayStatus | null
}): boolean {
	if (!isPageActive || !currentEventId) return false
	if (!snapshot || snapshot.eventId !== currentEventId) return false
	return isLiveRefreshTerminalState(snapshot.state)
}

/** Match V2 uses its own lifecycle and server cadence, never LP freshness. */
export function shouldPollLiveMatchday({
	isPageActive,
	currentEventId,
	selectedEventId,
	snapshot
}: {
	isPageActive: boolean
	currentEventId?: number
	selectedEventId?: number
	snapshot?: LiveMatchdayStatus | null
}): boolean {
	if (!isPageActive || !currentEventId || selectedEventId !== currentEventId) {
		return false
	}
	// A known event with no desk is a recoverable cold/unavailable state. Keep
	// bounded retries enabled so the page can recover without a manual reload.
	if (!snapshot) return true
	if (snapshot.eventId !== selectedEventId) return false
	if (isLiveRefreshTerminalState(snapshot.state)) return false
	// The countdown consumes the server-provided nextRefreshAt when present;
	// the boolean only decides whether non-terminal Match observations remain
	// eligible for polling.
	return true
}

export function liveContextToSnapshot(
	context: LiveContextResponse['liveContext']
): LiveSnapshotStatus | null {
	if (!context || context.anchorEventId == null) {
		return null
	}
	return {
		season: context.season,
		eventId: context.anchorEventId,
		scoreCoreRevision: context.scoreCoreRevision,
		state: context.windowState,
		publishedAt: context.publishedAt ?? null,
		sourceCheckedAt: context.sourceCheckedAt ?? null,
		nextRefreshAt: context.nextRefreshAt,
		revisions: context.revisions,
		times: context.times,
		delivery: context.delivery
	}
}

export function shouldPollLiveSnapshot({
	isPageActive,
	currentEventId,
	selectedEventId,
	snapshot,
	windowState,
	nextRefreshAt,
	isOfficialUpdating = false
}: {
	isPageActive: boolean
	currentEventId?: number
	selectedEventId?: number
	snapshot?: LiveSnapshotStatus | null
	windowState?: string | null
	nextRefreshAt?: string | null
	/** The official post-deadline sync is expected to have no live snapshot yet. */
	isOfficialUpdating?: boolean
}): boolean {
	if (!isPageActive || !currentEventId || selectedEventId !== currentEventId) {
		return false
	}
	// Once the gameweek has moved into review/finalization or the gap between
	// gameweeks, the selected publication is durable data. Do not let a stale
	// nextRefreshAt re-arm the live countdown.
	if (
		isLiveRefreshTerminalState(snapshot?.state) ||
		isLiveRefreshTerminalState(windowState)
	) {
		return false
	}
	// During FPL's expected post-deadline sync the first live request can be
	// intentionally unavailable. Keep a cheap context heartbeat armed so the
	// page can discover the published snapshot without a manual reload. Outside
	// that explicit lifecycle state, uncertainty must remain manual-only.
	if (!snapshot || snapshot.eventId !== selectedEventId) {
		return isOfficialUpdating
	}
	// Keep the normal countdown armed for both due and future publication
	// refreshes. React will not re-evaluate this predicate merely because time
	// passed, so disabling it for a future deadline would leave stale scores
	// stuck until a manual refresh.
	if (nextRefreshAt && Number.isFinite(Date.parse(nextRefreshAt))) return true

	return !isLiveRefreshTerminalState(snapshot.state)
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
		accepted.scoreCoreRevision !== observed.scoreCoreRevision ||
		accepted.revisions?.scoreCore !== observed.revisions?.scoreCore ||
		accepted.revisions?.picksBase !== observed.revisions?.picksBase ||
		accepted.revisions?.officialAdjustment !==
			observed.revisions?.officialAdjustment ||
		accepted.revisions?.finalResult !== observed.revisions?.finalResult
	)
}

/**
 * Matchday payloads are owned by the score/fixture publication. Changes to
 * picks, rank, or unrelated live-point projections must not refetch the full
 * fixture-and-player payload.
 */
export function liveMatchdayNeedsRefresh(
	accepted: LiveMatchdayStatus | null | undefined,
	observed: LiveMatchdayStatus | null | undefined
): boolean {
	if (!accepted || !observed) return true
	return (
		accepted.eventId !== observed.eventId ||
		accepted.revisions.lifecycle !== observed.revisions.lifecycle ||
		accepted.revisions.fixtureIdentity !== observed.revisions.fixtureIdentity ||
		accepted.revisions.scoreState !== observed.revisions.scoreState ||
		accepted.revisions.playerDetail !== observed.revisions.playerDetail
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
