/**
 * Browser session cache for My Tournament review (not Live / not tournament list).
 * Private data stays no-store on the wire; memory TTL is intentionally long.
 */

const EVENT_RESULTS_TTL_MS = 15 * 60_000
const RANKING_TTL_MS = 15 * 60_000
const PLAYER_META_TTL_MS = 30 * 60_000
const MAX_ENTRIES = 100

interface Timed<T> {
	value: T
	expiresAt: number
}

function getFresh<K, T>(cache: Map<K, Timed<T>>, key: K): T | undefined {
	const hit = cache.get(key)
	if (!hit) return undefined
	if (hit.expiresAt <= Date.now()) {
		cache.delete(key)
		return undefined
	}
	return hit.value
}

function setTimed<K, T>(
	cache: Map<K, Timed<T>>,
	key: K,
	value: T,
	ttlMs: number,
): void {
	const now = Date.now()
	cache.forEach((v, k) => {
		if (v.expiresAt <= now) cache.delete(k)
	})
	if (!cache.has(key) && cache.size >= MAX_ENTRIES) {
		const oldest = cache.keys().next().value as K | undefined
		if (oldest !== undefined) cache.delete(oldest)
	}
	cache.set(key, { value, expiresAt: now + ttlMs })
}

const eventResultsCache = new Map<string, Timed<unknown>>()
const rankingCache = new Map<string, Timed<unknown>>()
const seasonSnapshotCache = new Map<string, Timed<unknown>>()
const playerMetaCache = new Map<number, Timed<{ webName: string; teamShortName: string }>>()
const eventResultsInFlight = new Map<string, Promise<unknown>>()
const rankingInFlight = new Map<string, Promise<unknown>>()
const seasonSnapshotInFlight = new Map<string, Promise<unknown>>()

export function eventResultsKey(tournamentId: number, eventId: number): string {
	return `${tournamentId}:${eventId}`
}

export function rankingKey(
	tournamentId: number,
	eventId: number,
	entryId: number,
): string {
	return `${tournamentId}:${eventId}:${entryId}`
}

export function seasonSnapshotKey(tournamentId: number, eventId: number): string {
	return `${tournamentId}:${eventId}`
}

export function peekEventResults<T>(
	tournamentId: number,
	eventId: number,
): T | undefined {
	return getFresh(eventResultsCache, eventResultsKey(tournamentId, eventId)) as
		| T
		| undefined
}

export function seedEventResults<T>(
	tournamentId: number,
	eventId: number,
	value: T,
): void {
	setTimed(
		eventResultsCache,
		eventResultsKey(tournamentId, eventId),
		value,
		EVENT_RESULTS_TTL_MS,
	)
}

export function peekRanking<T>(
	tournamentId: number,
	eventId: number,
	entryId: number,
): T | undefined {
	return getFresh(
		rankingCache,
		rankingKey(tournamentId, eventId, entryId),
	) as T | undefined
}

export function seedRanking<T>(
	tournamentId: number,
	eventId: number,
	entryId: number,
	value: T,
): void {
	setTimed(
		rankingCache,
		rankingKey(tournamentId, eventId, entryId),
		value,
		RANKING_TTL_MS,
	)
}

export function peekPlayerMeta(
	id: number,
): { webName: string; teamShortName: string } | undefined {
	return getFresh(playerMetaCache, id)
}

export function seedPlayerMeta(
	id: number,
	value: { webName: string; teamShortName: string },
): void {
	setTimed(playerMetaCache, id, value, PLAYER_META_TTL_MS)
}

export function getAllCachedPlayerMeta(): Record<
	number,
	{ webName: string; teamShortName: string }
> {
	const out: Record<number, { webName: string; teamShortName: string }> = {}
	const now = Date.now()
	playerMetaCache.forEach((timed, id) => {
		if (timed.expiresAt > now) out[id] = timed.value
	})
	return out
}

export function getEventResultsInFlight(
	key: string,
): Promise<unknown> | undefined {
	return eventResultsInFlight.get(key)
}

export function setEventResultsInFlight(
	key: string,
	promise: Promise<unknown>,
): void {
	eventResultsInFlight.set(key, promise)
}

export function clearEventResultsInFlight(key: string): void {
	eventResultsInFlight.delete(key)
}

export function getRankingInFlight(key: string): Promise<unknown> | undefined {
	return rankingInFlight.get(key)
}

export function setRankingInFlight(key: string, promise: Promise<unknown>): void {
	rankingInFlight.set(key, promise)
}

export function clearRankingInFlight(key: string): void {
	rankingInFlight.delete(key)
}

export function peekSeasonSnapshot<T>(
	tournamentId: number,
	eventId: number,
): T | undefined {
	return getFresh(
		seasonSnapshotCache,
		seasonSnapshotKey(tournamentId, eventId),
	) as T | undefined
}

export function seedSeasonSnapshot<T>(
	tournamentId: number,
	eventId: number,
	value: T,
): void {
	setTimed(
		seasonSnapshotCache,
		seasonSnapshotKey(tournamentId, eventId),
		value,
		RANKING_TTL_MS,
	)
}

export function getSeasonSnapshotInFlight(
	key: string,
): Promise<unknown> | undefined {
	return seasonSnapshotInFlight.get(key)
}

export function setSeasonSnapshotInFlight(
	key: string,
	promise: Promise<unknown>,
): void {
	seasonSnapshotInFlight.set(key, promise)
}

export function clearSeasonSnapshotInFlight(key: string): void {
	seasonSnapshotInFlight.delete(key)
}
