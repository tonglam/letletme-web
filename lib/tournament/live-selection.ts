export const LIVE_TOURNAMENT_SELECTION_STORAGE_PREFIX =
	'letletme:live-tournament-selection:v1'

type LiveTournamentSelectionStorage = Pick<Storage, 'getItem' | 'setItem'>

export type LiveTournamentSelectionResolution = {
	selectedId: string | null
	source: 'url' | 'storage' | 'initial' | 'first' | 'unknown-url' | 'empty'
	cachedId: string | null
}

const normalizeTournamentId = (value: string | null | undefined) =>
	value?.trim() || null

export const getLiveTournamentSelectionStorageKey = (entryId: number) =>
	`${LIVE_TOURNAMENT_SELECTION_STORAGE_PREFIX}:${entryId}`

export const resolveLiveTournamentSelection = ({
	availableIds,
	urlTournamentId,
	cachedTournamentId,
	initialTournamentId
}: {
	availableIds: readonly string[]
	urlTournamentId?: string | null
	cachedTournamentId?: string | null
	initialTournamentId?: string | null
}): LiveTournamentSelectionResolution => {
	const available = new Set(availableIds)
	const urlId = normalizeTournamentId(urlTournamentId)
	const cachedId = normalizeTournamentId(cachedTournamentId)
	const initialId = normalizeTournamentId(initialTournamentId)

	// An explicit URL is authoritative, including an unknown id. The caller
	// can show the membership picker so the invalid URL can be corrected.
	if (urlId) {
		return {
			selectedId: available.has(urlId) ? urlId : null,
			source: available.has(urlId) ? 'url' : 'unknown-url',
			cachedId
		}
	}

	if (cachedId && available.has(cachedId)) {
		return { selectedId: cachedId, source: 'storage', cachedId }
	}

	if (initialId && available.has(initialId)) {
		return { selectedId: initialId, source: 'initial', cachedId }
	}

	const firstId = availableIds[0] ?? null
	return {
		selectedId: firstId,
		source: firstId ? 'first' : 'empty',
		cachedId
	}
}

export const readLiveTournamentSelection = (
	storage: LiveTournamentSelectionStorage | null | undefined,
	entryId: number
): string | null => {
	if (!storage || !Number.isSafeInteger(entryId) || entryId <= 0) return null
	try {
		const value = storage.getItem(getLiveTournamentSelectionStorageKey(entryId))
		return normalizeTournamentId(value)
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
