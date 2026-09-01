import type { TournamentOfficialH2H } from '@/lib/graphql/operations/tournaments'

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

/**
 * A READY root is not enough to replace the UI snapshot: every published
 * match must be READY, and standings are required only for events where the
 * standings tab is shown. This keeps a partial publication from erasing a
 * complete same-event LKG.
 */
export function isCompleteOfficialH2HSnapshot(
	value: TournamentOfficialH2H | null,
	options: { requireStandings?: boolean } = {}
): boolean {
	if (
		!value ||
		value.availability !== 'READY' ||
		value.matches.length === 0 ||
		!value.matches.every(match => match.availability === 'READY')
	)
		return false
	if (!options.requireStandings) return true
	return Boolean(
		value.standings &&
		value.standings.state !== 'UNAVAILABLE' &&
		value.standings.rows.length > 0
	)
}
