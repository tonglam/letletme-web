export interface TournamentEventResultSeed<T> {
	eventId: number
	rows: T[]
}

export function buildTournamentEventResultSeeds<T>({
	dataGameweek,
	sliceGameweek,
	seasonRows,
	sliceRows,
	previousRows
}: {
	dataGameweek: number | null
	sliceGameweek: number | null
	seasonRows: T[]
	sliceRows: T[]
	previousRows: T[]
}): TournamentEventResultSeed<T>[] {
	const byEvent = new Map<number, T[]>()
	if (dataGameweek !== null && dataGameweek > 0 && seasonRows.length > 0) {
		byEvent.set(dataGameweek, seasonRows)
	}
	if (sliceGameweek !== null && sliceGameweek > 0 && sliceRows.length > 0) {
		byEvent.set(sliceGameweek, sliceRows)
	}
	if (sliceGameweek !== null && sliceGameweek > 1 && previousRows.length > 0) {
		byEvent.set(sliceGameweek - 1, previousRows)
	}
	return Array.from(byEvent, ([eventId, rows]) => ({ eventId, rows }))
}
