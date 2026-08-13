/**
 * URL contract for /my-fpl/team
 *
 *   (default)                 → Season view
 *   ?view=season
 *   ?view=gameweek            → Gameweek view, current GW if gw omitted
 *   ?view=gameweek&gw=12      → Gameweek view locked to GW12
 *
 * `gw` may stay on season URLs so switching back preserves the last week.
 */

export type TeamStatsPageView = 'gameweek' | 'season'

export const TEAM_STATS_PATH = '/my-fpl/team'

export function parseTeamStatsView(
	value: string | null | undefined,
): TeamStatsPageView {
	return value === 'gameweek' ? 'gameweek' : 'season'
}

/** Clamp gw into 1..maxGw (when maxGw > 0); invalid → fallback. */
export function parseTeamStatsGw(
	value: string | null | undefined,
	maxGw: number,
	fallback: number,
): number {
	const n = Number(value)
	if (!Number.isFinite(n) || n < 1) return fallback
	const floor = Math.floor(n)
	if (maxGw > 0) return Math.min(floor, maxGw)
	return floor
}

export function teamStatsHref(opts: {
	view?: TeamStatsPageView
	gw?: number | null
}): string {
	const params = new URLSearchParams()
	const view = opts.view ?? 'season'
	if (view === 'gameweek') {
		params.set('view', 'gameweek')
	}
	if (opts.gw != null && opts.gw > 0) {
		params.set('gw', String(opts.gw))
	}
	const q = params.toString()
	return q ? `${TEAM_STATS_PATH}?${q}` : TEAM_STATS_PATH
}

/** Deep link straight into a gameweek scoreboard + squad. */
export function teamStatsGameweekHref(gameweek: number): string {
	return teamStatsHref({ view: 'gameweek', gw: gameweek })
}

export function buildTeamStatsQueryString(opts: {
	view: TeamStatsPageView
	gw?: number | null
}): string {
	const params = new URLSearchParams()
	if (opts.view === 'gameweek') {
		params.set('view', 'gameweek')
	}
	if (opts.gw != null && opts.gw > 0) {
		params.set('gw', String(opts.gw))
	}
	return params.toString()
}
