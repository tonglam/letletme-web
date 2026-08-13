import type { EntryLeague } from '@/lib/graphql/operations/leagues'
import type { EntryOfficialH2HDeskItem } from '@/lib/graphql/operations/tournaments'

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
	officialH2H: EntryOfficialH2HDeskItem | null
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
		officialH2H: null,
	}
}

/** Full sorted list — UI progressively reveals (no second network fetch). */
export function buildHomeLeagueRankRows(
	leagues: EntryLeague[],
	officialH2HDesk: EntryOfficialH2HDeskItem[] = [],
): HomeLeagueRankRow[] {
	return mergeHomeOfficialH2HDesk(
		sortEntryLeagues(leagues).map(mapEntryLeagueToRankRow),
		officialH2HDesk,
	)
}

export function mergeHomeOfficialH2HDesk(
	rows: HomeLeagueRankRow[],
	officialH2HDesk: EntryOfficialH2HDeskItem[],
): HomeLeagueRankRow[] {
	const deskByTournamentId = new Map(
		officialH2HDesk.map(item => [item.tournamentId, item]),
	)
	const matchedTournamentIds = new Set<number>()
	const merged = rows.map(row => {
		const desk = row.tournamentId == null ? null : deskByTournamentId.get(row.tournamentId) ?? null
		if (!desk) return row
		matchedTournamentIds.add(desk.tournamentId)
		const entryRank = isPositiveRank(desk.rank) ? desk.rank : row.entryRank
		const previousRank = isPositiveRank(desk.lastRank) ? desk.lastRank : row.entryLastRank
		return {
			...row,
			type: 'H2H',
			entryRank,
			totalTeamNum: desk.totalTeams > 0 ? desk.totalTeams : row.totalTeamNum,
			movement: rankMovement(entryRank, previousRank),
			officialH2H: desk,
		}
	})

	for (const desk of officialH2HDesk) {
		if (matchedTournamentIds.has(desk.tournamentId)) continue
		merged.push({
			id: -desk.tournamentId,
			name: desk.tournamentName,
			type: 'H2H',
			entryRank: isPositiveRank(desk.rank) ? desk.rank : null,
			entryLastRank: isPositiveRank(desk.lastRank) ? desk.lastRank : null,
			totalTeamNum: desk.totalTeams > 0 ? desk.totalTeams : null,
			tournamentId: desk.tournamentId,
			movement: rankMovement(desk.rank, desk.lastRank),
			officialH2H: desk,
		})
	}

	return merged.sort((left, right) => {
		const liveOrder = Number(Boolean(right.officialH2H?.isLive)) - Number(Boolean(left.officialH2H?.isLive))
		if (liveOrder !== 0) return liveOrder
		const leftRank = isPositiveRank(left.entryRank) ? left.entryRank : Number.MAX_SAFE_INTEGER
		const rightRank = isPositiveRank(right.entryRank) ? right.entryRank : Number.MAX_SAFE_INTEGER
		if (leftRank !== rightRank) return leftRank - rightRank
		return left.name.localeCompare(right.name)
	})
}
