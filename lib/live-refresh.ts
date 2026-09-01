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
 * Official post-deadline sync is scoped to the active event. A historical
 * event must report ordinary request failures even while the current event is
 * waiting for its official input publication.
 */
export function shouldSuppressOfficialLiveErrors(
	eventId: number,
	currentEventId: number,
	isOfficialUpdating: boolean,
	isOfficialSyncPending: boolean
): boolean {
	return (
		eventId === currentEventId && (isOfficialUpdating || isOfficialSyncPending)
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

/** Match V3 uses its own lifecycle and server cadence, never LP freshness. */
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

export function livePointsRequestChangesEvent(
	acceptedEventId: number | null | undefined,
	requestedEventId: number
): boolean {
	return acceptedEventId != null && acceptedEventId !== requestedEventId
}

/**
 * A refresh response may come from a fallback publication that is older than
 * the response already painted. Keep the accepted same-event publication
 * monotonic so a transient Redis/Data fallback cannot move the score
 * backwards. Generation is the primary order; publishedAt is only a
 * tie-breaker for snapshots that do not expose a complete revision vector.
 */
export function canReplaceLivePointsSnapshot(
	candidate: LiveSnapshotStatus | null | undefined,
	accepted: LiveSnapshotStatus | null | undefined
): boolean {
	if (!candidate) return false
	if (!accepted) return true
	if (candidate.eventId !== accepted.eventId) return false

	const candidateGeneration = candidate.revisions?.generation
	const acceptedGeneration = accepted.revisions?.generation
	if (
		typeof candidateGeneration === 'number' &&
		typeof acceptedGeneration === 'number' &&
		Number.isSafeInteger(candidateGeneration) &&
		Number.isSafeInteger(acceptedGeneration)
	) {
		if (candidateGeneration !== acceptedGeneration) {
			return candidateGeneration > acceptedGeneration
		}

		const candidatePublicationId = candidate.revisions?.publicationId
		const acceptedPublicationId = accepted.revisions?.publicationId
		if (candidatePublicationId && acceptedPublicationId) {
			return candidatePublicationId === acceptedPublicationId
		}
	}

	const candidatePublishedAt = Date.parse(
		candidate.times?.publishedAt ?? candidate.publishedAt ?? ''
	)
	const acceptedPublishedAt = Date.parse(
		accepted.times?.publishedAt ?? accepted.publishedAt ?? ''
	)
	if (
		Number.isFinite(candidatePublishedAt) &&
		Number.isFinite(acceptedPublishedAt)
	) {
		return candidatePublishedAt >= acceptedPublishedAt
	}

	// V2 snapshots should always carry generation/publication evidence. If a
	// degraded legacy-shaped snapshot reaches this client, fail closed instead
	// of allowing an unorderable response to overwrite the accepted one.
	return false
}

/**
 * Matchday payloads are owned by the score/fixture publication. Changes to
 * picks, rank, or unrelated live-point projections must not refetch the full
 * fixture-and-player payload. HEAD deliberately exposes only the detail
 * observation token; the verified detail revision is present only in FULL.
 */
export function liveMatchdayNeedsRefresh(
	accepted: LiveMatchdayStatus | null | undefined,
	observed: LiveMatchdayStatus | null | undefined
): boolean {
	if (!accepted || !observed) return true
	if (
		accepted.season !== observed.season ||
		accepted.eventId !== observed.eventId
	) {
		return true
	}
	// A previous Redis pointer or an in-flight fallback can be older than the
	// full board already painted in this browser. It is a delivery observation,
	// not a reason to issue another FULL request. Same-generation publication
	// conflicts are ambiguous for the same reason; fail closed and retain the
	// accepted board until a strictly newer desk is observed.
	if (observed.revisions.deskGeneration < accepted.revisions.deskGeneration) {
		return false
	}
	if (
		observed.revisions.deskGeneration === accepted.revisions.deskGeneration &&
		observed.revisions.deskPublicationId !==
			accepted.revisions.deskPublicationId
	) {
		return false
	}
	const detailObservationChanged =
		observed.revisions.detailObservation !== null &&
		observed.revisions.detailObservation !==
			accepted.revisions.detailObservation
	return (
		accepted.revisions.lifecycle !== observed.revisions.lifecycle ||
		accepted.revisions.fixtureIdentity !== observed.revisions.fixtureIdentity ||
		accepted.revisions.scoreState !== observed.revisions.scoreState ||
		detailObservationChanged
	)
}

/**
 * A HEAD response validates only the detail manifest, so the server returns a
 * descriptor-only observation and no authoritative detail revision. Once the
 * browser already owns a complete same-event detail payload, keep that local
 * detail state while accepting the newer heartbeat times and top-level
 * delivery state. A changed observation is returned unchanged so the caller
 * can issue exactly one FULL refresh.
 */
export function mergeLiveMatchdayHeadStatus(
	accepted: LiveMatchdayStatus | null | undefined,
	observed: LiveMatchdayStatus
): LiveMatchdayStatus {
	if (
		!accepted ||
		accepted.season !== observed.season ||
		accepted.eventId !== observed.eventId
	) {
		return observed
	}
	if (
		accepted.revisions.lifecycle !== observed.revisions.lifecycle ||
		accepted.revisions.fixtureIdentity !== observed.revisions.fixtureIdentity ||
		accepted.revisions.scoreState !== observed.revisions.scoreState ||
		(observed.revisions.detailObservation !== null &&
			observed.revisions.detailObservation !==
				accepted.revisions.detailObservation)
	) {
		return observed
	}
	const hasAcceptedDetailRevision =
		accepted.revisions.detailPublicationId !== null &&
		accepted.revisions.detailGeneration !== null &&
		accepted.revisions.playerDetail !== null
	const hasCompleteAcceptedDetailState =
		hasAcceptedDetailRevision &&
		accepted.detailDelivery.servedFrom !== null &&
		accepted.detailDelivery.state !== 'PENDING' &&
		accepted.detailDelivery.state !== 'UNAVAILABLE'
	if (!hasCompleteAcceptedDetailState) {
		return observed
	}
	const detailDelivery =
		observed.revisions.detailObservation === null
			? {
					...accepted.detailDelivery,
					state: 'DEGRADED' as const,
					reasonCodes: Array.from(
						new Set([
							...accepted.detailDelivery.reasonCodes,
							...observed.detailDelivery.reasonCodes,
							'DETAIL_LKG_RETAINED'
						])
					)
				}
			: accepted.detailDelivery
	return {
		...observed,
		revisions: {
			...observed.revisions,
			detailObservation: accepted.revisions.detailObservation,
			detailPublicationId: accepted.revisions.detailPublicationId,
			detailGeneration: accepted.revisions.detailGeneration,
			playerDetail: accepted.revisions.playerDetail
		},
		times: {
			...observed.times,
			detailSourceCheckedAt: accepted.times.detailSourceCheckedAt,
			detailContentUpdatedAt: accepted.times.detailContentUpdatedAt,
			detailPublishedAt: accepted.times.detailPublishedAt,
			detailStaleAt: accepted.times.detailStaleAt
		},
		detailDelivery
	}
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
