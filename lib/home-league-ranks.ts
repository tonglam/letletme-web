import type { EntryLeague } from '@/lib/graphql/operations/leagues'

export type RankMovement =
	| { kind: 'up'; places: number }
	| { kind: 'down'; places: number }
	| { kind: 'flat' }
	| { kind: 'unknown' }

export type HomeLeagueRankRow = {
	id: number
	name: string
	type: string
	entryRank: number | null
	entryLastRank: number | null
	totalTeamNum: number | null
	tournamentId: number | null
	movement: RankMovement
}

export const HOME_LEAGUE_RANK_LIMIT = 6

function isPositiveRank(value: number | null | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * FPL convention: lower rank number is better.
 * places = lastRank − rank → positive = rose, negative = fell.
 */
export function rankMovement(
	rank: number | null | undefined,
	lastRank: number | null | undefined,
): RankMovement {
	if (!isPositiveRank(rank) || !isPositiveRank(lastRank)) {
		return { kind: 'unknown' }
	}
	const places = lastRank - rank
	if (places > 0) return { kind: 'up', places }
	if (places < 0) return { kind: 'down', places: Math.abs(places) }
	return { kind: 'flat' }
}

export function sortEntryLeagues(leagues: EntryLeague[]): EntryLeague[] {
	return [...leagues].sort((a, b) => {
		const aRank = isPositiveRank(a.entryRank) ? a.entryRank : Number.MAX_SAFE_INTEGER
		const bRank = isPositiveRank(b.entryRank) ? b.entryRank : Number.MAX_SAFE_INTEGER
		if (aRank !== bRank) return aRank - bRank
		return a.name.localeCompare(b.name)
	})
}

export function mapEntryLeagueToRankRow(league: EntryLeague): HomeLeagueRankRow {
	return {
		id: league.id,
		name: league.name?.trim() || `League ${league.id}`,
		type: String(league.type ?? 'CLASSIC').toUpperCase(),
		entryRank: isPositiveRank(league.entryRank) ? league.entryRank : null,
		entryLastRank: isPositiveRank(league.entryLastRank)
			? league.entryLastRank
			: null,
		totalTeamNum:
			typeof league.totalTeamNum === 'number' && league.totalTeamNum > 0
				? league.totalTeamNum
				: null,
		tournamentId:
			typeof league.tournamentId === 'number' && league.tournamentId > 0
				? league.tournamentId
				: null,
		movement: rankMovement(league.entryRank, league.entryLastRank),
	}
}

/** Full sorted list — UI progressively reveals (no second network fetch). */
export function buildHomeLeagueRankRows(leagues: EntryLeague[]): HomeLeagueRankRow[] {
	return sortEntryLeagues(leagues).map(mapEntryLeagueToRankRow)
}
