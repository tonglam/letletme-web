/**
 * Remember last My Tournament selection per FPL entry (client-only).
 * URL ?tournamentId= still wins when present; this fills bare /my-fpl/competitions visits.
 */

const STORAGE_PREFIX = 'stats-tournament:lastId:'

function storageKey(entryId: number): string {
	return `${STORAGE_PREFIX}${entryId}`
}

export function readLastTournamentId(entryId: number): string | null {
	if (typeof window === 'undefined') return null
	if (!Number.isFinite(entryId) || entryId <= 0) return null
	try {
		const raw = window.localStorage.getItem(storageKey(entryId))
		if (raw == null || raw.trim() === '') return null
		return raw.trim()
	} catch {
		return null
	}
}

export function writeLastTournamentId(
	entryId: number,
	tournamentId: string,
): void {
	if (typeof window === 'undefined') return
	if (!Number.isFinite(entryId) || entryId <= 0) return
	const id = String(tournamentId).trim()
	if (!id) return
	try {
		window.localStorage.setItem(storageKey(entryId), id)
	} catch {
		// private mode / quota — ignore
	}
}

/** True when id is in the linked tournament list. */
export function isKnownTournamentId(
	tournamentId: string,
	tournaments: Array<{ id: number | string }>,
): boolean {
	const id = String(tournamentId)
	return tournaments.some(t => String(t.id) === id)
}
