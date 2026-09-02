/**
 * URL for /my-fpl/competitions
 *
 *   ?tournamentId=1001
 *   ?tournamentId=1001&view=season
 *   ?tournamentId=1001&view=gameweek&gw=28
 */

export type TournamentStatsPageView = 'gameweek' | 'season'

export const TOURNAMENT_STATS_PATH = '/my-fpl/competitions'

export function parseTournamentStatsView(
	value: string | null | undefined
): TournamentStatsPageView {
	return value === 'gameweek' ? 'gameweek' : 'season'
}

export function parseTournamentStatsGw(
	value: string | null | undefined,
	maxGw: number,
	fallback: number
): number {
	const n = Number(value)
	if (!Number.isFinite(n) || n < 1) return fallback
	const floor = Math.floor(n)
	if (maxGw > 0) return Math.min(floor, maxGw)
	return floor
}

export function buildTournamentStatsQueryString(opts: {
	tournamentId?: string | number | null
	view: TournamentStatsPageView
	gw?: number | null
	/** URL scope is intentionally limited to the two user-selectable views.
	 * MANAGED is an authorization class returned by GraphQL, not a public URL
	 * mode; admin users use ALL to read the complete catalog. */
	scope?: 'ACCESSIBLE' | 'ALL'
}): string {
	const params = new URLSearchParams()
	if (opts.tournamentId != null && String(opts.tournamentId).length > 0) {
		params.set('tournamentId', String(opts.tournamentId))
	}
	if (opts.view === 'gameweek') {
		params.set('view', 'gameweek')
	}
	if (opts.gw != null && opts.gw > 0) {
		params.set('gw', String(opts.gw))
	}
	if (opts.scope === 'ALL') {
		params.set('scope', 'all')
	}
	return params.toString()
}
