export const LIVE_TOURNAMENT_SELECTION_STORAGE_PREFIX =
	'letletme:live-tournament-selection:v1'

type LiveTournamentSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>

export const getLiveTournamentSelectionStorageKey = (entryId: number) =>
	`${LIVE_TOURNAMENT_SELECTION_STORAGE_PREFIX}:${entryId}`

export const readLiveTournamentSelection = (
	storage: LiveTournamentSelectionStorage | null | undefined,
	entryId: number
): string | null => {
	if (!storage || !Number.isSafeInteger(entryId) || entryId <= 0) return null
	try {
		const value = storage.getItem(getLiveTournamentSelectionStorageKey(entryId))
		const normalized = value?.trim()
		return normalized ? normalized : null
	} catch {
		return null
	}
}

export const writeLiveTournamentSelection = (
	storage: LiveTournamentSelectionStorage | null | undefined,
	entryId: number,
	tournamentId: string
): void => {
	if (
		!storage ||
		!Number.isSafeInteger(entryId) ||
		entryId <= 0 ||
		!tournamentId.trim()
	)
		return
	try {
		storage.setItem(
			getLiveTournamentSelectionStorageKey(entryId),
			tournamentId.trim()
		)
	} catch {
		// Private browsing and storage quota failures must not break live data.
	}
}
