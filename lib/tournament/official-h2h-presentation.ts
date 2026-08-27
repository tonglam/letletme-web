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
