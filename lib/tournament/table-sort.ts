import type { TournamentEntry } from '@/types/tournament'

export type TournamentSortColumn =
	| 'gwPoints'
	| 'totalPoints'
	| 'overallRank'
	| 'teamValue'
	| 'eventCost'
	| 'standings'
	| 'rank'

export type TournamentSortDirection = 'asc' | 'desc'

/**
 * Filter and sort the standings in one pure step so the rendered order always
 * follows the selected direction, including deterministic tie-breakers.
 */
export function sortTournamentEntries(
	entries: TournamentEntry[],
	searchQuery: string,
	sortColumn: TournamentSortColumn,
	sortDirection: TournamentSortDirection
): TournamentEntry[] {
	const query = searchQuery.trim().toLowerCase()
	const filtered = entries.filter(entry => {
		if (!query) return true
		return (
			entry.teamName.toLowerCase().includes(query) ||
			entry.managerName.toLowerCase().includes(query)
		)
	})

	const direction = sortDirection === 'asc' ? 1 : -1
	return [...filtered].sort((a, b) => {
		// Stale retained rows always sort after live recalcs (any column).
		if (Boolean(a.stale) !== Boolean(b.stale)) {
			return a.stale ? 1 : -1
		}

		let valueA: number
		let valueB: number
		let unknownA = false
		let unknownB = false

		switch (sortColumn) {
			case 'overallRank':
				valueA =
					a.overallRank && a.overallRank > 0
						? a.overallRank
						: Number.MAX_SAFE_INTEGER
				valueB =
					b.overallRank && b.overallRank > 0
						? b.overallRank
						: Number.MAX_SAFE_INTEGER
				break
			case 'eventCost':
				valueA = a.eventCost ?? 0
				valueB = b.eventCost ?? 0
				break
			case 'gwPoints':
				valueA = a.gwPoints ?? a.livePoints ?? 0
				valueB = b.gwPoints ?? b.livePoints ?? 0
				unknownA = a.gwPoints == null && a.livePoints == null
				unknownB = b.gwPoints == null && b.livePoints == null
				break
			case 'totalPoints':
				valueA = a.totalPoints ?? 0
				valueB = b.totalPoints ?? 0
				unknownA = a.totalPoints == null
				unknownB = b.totalPoints == null
				break
			case 'teamValue':
				valueA = a.teamValue ?? -1
				valueB = b.teamValue ?? -1
				break
			case 'standings':
			case 'rank':
			default:
				valueA = a.rank > 0 ? a.rank : Number.MAX_SAFE_INTEGER
				valueB = b.rank > 0 ? b.rank : Number.MAX_SAFE_INTEGER
		}

		if (unknownA !== unknownB) return unknownA ? 1 : -1

		const primary = (valueA - valueB) * direction
		if (primary !== 0) return primary

		const rankDiff = (a.rank || 999999) - (b.rank || 999999)
		if (rankDiff !== 0) return rankDiff * direction
		return a.id.localeCompare(b.id) * direction
	})
}
