import type {
	TournamentOfficialH2H,
	TournamentOfficialH2HLiveMatchSide
} from '@/lib/graphql/operations/tournaments'

export function isOfficialH2HScoreVisible(
	home: Pick<TournamentOfficialH2HLiveMatchSide, 'availability' | 'points'>,
	away: Pick<TournamentOfficialH2HLiveMatchSide, 'availability' | 'points'>
): boolean {
	return (
		home.availability === 'READY' &&
		away.availability === 'READY' &&
		home.points != null &&
		away.points != null
	)
}

/**
 * The tournament detail context uses the active event as the boundary for
 * gameweek navigation. A future event has not started, so its H2H standings
 * tab must not be presented as an empty board.
 *
 * When the boundary is unavailable, keep the tab visible. The UI cannot prove
 * that the selected event is future in that case, and hiding it would turn a
 * context outage into a misleading product state.
 */
export function shouldShowOfficialH2HStandings(
	eventId: number,
	activeEventId?: number
): boolean {
	return activeEventId == null || eventId <= activeEventId
}

function hasUsableOfficialH2HMatches(
	value: TournamentOfficialH2H | null,
	eventId?: number
): boolean {
	if (
		!value ||
		(eventId !== undefined && value.eventId !== eventId) ||
		value.availability !== 'READY' ||
		value.matches.length === 0 ||
		value.matches.some(
			match =>
				!Number.isSafeInteger(match.officialMatchId) ||
				match.officialMatchId <= 0
		) ||
		value.matches.some(match => match.eventId !== value.eventId) ||
		new Set(value.matches.map(match => match.officialMatchId)).size !==
			value.matches.length
	)
		return false
	return true
}

/**
 * A usable H2H page has a coherent schedule. A match-level PENDING/ERROR is
 * valid because the official match is the isolation boundary; it must not
 * hide unrelated matches. The independent standings overlay is deliberately
 * not part of this readiness check.
 */
export function isUsableOfficialH2HSnapshot(
	value: TournamentOfficialH2H | null,
	options: { eventId?: number } = {}
): boolean {
	return hasUsableOfficialH2HMatches(value, options.eventId)
}

/**
 * A complete H2H snapshot additionally has a READY official standings
 * overlay. `requireStandings: false` is an explicit escape hatch for callers
 * that only need the isolated match publication.
 */
export function isCompleteOfficialH2HSnapshot(
	value: TournamentOfficialH2H | null,
	options: { eventId?: number; requireStandings?: boolean } = {}
): boolean {
	if (!hasUsableOfficialH2HMatches(value, options.eventId)) return false
	if (options.requireStandings === false) return true
	if (!value) return false
	return Boolean(
		value.standings &&
		value.standings.state === 'READY' &&
		value.standings.rows.length > 0
	)
}

function sameMatchIdentity(
	left: TournamentOfficialH2H['matches'][number],
	right: TournamentOfficialH2H['matches'][number]
): boolean {
	return (
		left.officialMatchId === right.officialMatchId &&
		left.eventId === right.eventId &&
		left.groupId === right.groupId &&
		left.sourceOrder === right.sourceOrder &&
		left.phase === right.phase &&
		left.knockoutName === right.knockoutName &&
		left.tiebreak === right.tiebreak &&
		left.isBye === right.isBye &&
		left.home.entryId === right.home.entryId &&
		left.away.entryId === right.away.entryId &&
		left.home.isAverage === right.home.isAverage &&
		left.away.isAverage === right.away.isAverage
	)
}

export function isSameOfficialH2HMatchSet(
	previous: TournamentOfficialH2H | null,
	next: TournamentOfficialH2H
): boolean {
	if (!previous || previous.eventId !== next.eventId) return false
	const previousIds = new Set(
		previous.matches.map(match => match.officialMatchId)
	)
	const nextIds = new Set(next.matches.map(match => match.officialMatchId))
	return (
		previousIds.size === previous.matches.length &&
		nextIds.size === next.matches.length &&
		previousIds.size === nextIds.size &&
		next.matches.every(match => previousIds.has(match.officialMatchId))
	)
}

/**
 * Keep a same-event READY match when a newer composite head temporarily
 * reports that one match as PENDING/ERROR. Do not merge a changed schedule or
 * a changed match set: that would create a cross-publication board.
 */
export function retainOfficialH2HMatches(
	previous: TournamentOfficialH2H | null,
	next: TournamentOfficialH2H
): TournamentOfficialH2H {
	if (
		!previous ||
		previous.eventId !== next.eventId ||
		previous.matches.length !== next.matches.length
	)
		return next
	const previousById = new Map(
		previous.matches.map(match => [match.officialMatchId, match])
	)
	const nextIds = new Set(next.matches.map(match => match.officialMatchId))
	if (
		previous.matches.some(match => !nextIds.has(match.officialMatchId)) ||
		next.matches.some(match => !previousById.has(match.officialMatchId))
	)
		return next
	return {
		...next,
		matches: next.matches.map(match => {
			const previousMatch = previousById.get(match.officialMatchId)
			if (
				!previousMatch ||
				match.availability === 'READY' ||
				previousMatch.availability !== 'READY' ||
				(match.availability !== 'PENDING' && match.availability !== 'ERROR') ||
				!sameMatchIdentity(previousMatch, match)
			)
				return match
			return {
				...previousMatch,
				delivery: {
					...previousMatch.delivery,
					state:
						previousMatch.delivery.state === 'FINAL' ? 'FINAL' : 'DEGRADED',
					servedFrom:
						previousMatch.delivery.servedFrom === 'FINAL_RESULT'
							? 'FINAL_RESULT'
							: 'PROCESS_LKG',
					reasonCodes: Array.from(
						new Set([
							...previousMatch.delivery.reasonCodes,
							'MATCH_PUBLICATION_FALLBACK'
						])
					)
				}
			}
		})
	}
}

/**
 * A content revision is scoped to one tournament and event. Keep the event
 * boundary in this comparison even when an upstream bug accidentally reuses
 * a content hash: a new event must invalidate any lazy history request from
 * the previous event.
 */
export function isOfficialH2HContentChanged(
	previous: TournamentOfficialH2H | null,
	next: TournamentOfficialH2H
): boolean {
	return (
		previous === null ||
		previous.eventId !== next.eventId ||
		previous.revisions?.content !== next.revisions?.content
	)
}

/**
 * Keep the last official standings rows while the independent standings lane
 * is updating. Match rows may still be replaced from the newer publication.
 */
export function retainOfficialH2HStandings(
	previous: TournamentOfficialH2H | null,
	next: TournamentOfficialH2H
): TournamentOfficialH2H {
	const previousStandings = previous?.standings
	const nextStandings = next.standings
	const scopeKeys = ['roster', 'fixtureIdentity', 'identity'] as const
	const samePublicationScope =
		previous?.revisions != null &&
		next.revisions != null &&
		scopeKeys.every(key => {
			const previousRevision = previous.revisions?.[key]
			const nextRevision = next.revisions?.[key]
			return (
				typeof previousRevision === 'string' &&
				typeof nextRevision === 'string' &&
				previousRevision === nextRevision
			)
		})
	if (
		!previous ||
		previous.eventId !== next.eventId ||
		!previousStandings ||
		!samePublicationScope ||
		(nextStandings?.state === 'READY' && nextStandings.rows.length > 0)
	)
		return next
	return {
		...next,
		standings: {
			...previousStandings,
			// The rows are retained from the previous publication. Keep every
			// piece of metadata that describes those rows together with them;
			// the incomplete publication may belong to a different finalisation
			// attempt and must not masquerade as the source of the old rows.
			throughEventId: previousStandings.throughEventId,
			state: 'UPDATING',
			sourceCheckedAt: previousStandings.sourceCheckedAt
		}
	}
}
