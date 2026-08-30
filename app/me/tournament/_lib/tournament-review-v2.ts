import type {
	MyTournamentReviewPoints,
	MyTournamentReviewPointsRow
} from '@/lib/graphql/operations/my-fpl'

export type TournamentReviewV2View = 'gameweek' | 'season'

export function selectTournamentReviewEventId(
	requestedEventId: number | null,
	latestSettledEventId: number | null,
	finalizedEventIds: readonly number[]
): number | null {
	if (requestedEventId !== null && finalizedEventIds.includes(requestedEventId))
		return requestedEventId
	if (
		latestSettledEventId !== null &&
		finalizedEventIds.includes(latestSettledEventId)
	)
		return latestSettledEventId
	return finalizedEventIds.at(-1) ?? null
}

export function mergeTournamentReviewEventIds(
	current: readonly number[],
	incoming: readonly number[]
): number[] {
	return Array.from(new Set([...current, ...incoming])).sort(
		(left, right) => left - right
	)
}

export function tournamentReviewPointsSummary(
	points: MyTournamentReviewPoints,
	view: TournamentReviewV2View
): { grossTotal: number; grossAverage: number; netTotal: number } {
	return view === 'season'
		? {
				grossTotal: points.seasonGrossPointsTotal,
				grossAverage: points.seasonGrossPointsAverage,
				netTotal: points.seasonNetPointsTotal
			}
		: {
				grossTotal: points.grossPointsTotal,
				grossAverage: points.grossPointsAverage,
				netTotal: points.netPointsTotal
			}
}

export function tournamentReviewPointsRow(
	row: MyTournamentReviewPointsRow,
	view: TournamentReviewV2View
): {
	grossPoints: number | null
	transferCost: number | null
	netPoints: number | null
} {
	if (view === 'gameweek')
		return {
			grossPoints: row.grossPoints,
			transferCost: row.transferCost,
			netPoints: row.netPoints
		}
	const transferCost =
		row.seasonGrossPoints === null || row.seasonNetPoints === null
			? null
			: row.seasonGrossPoints - row.seasonNetPoints
	return {
		grossPoints: row.seasonGrossPoints,
		transferCost,
		netPoints: row.seasonNetPoints
	}
}
