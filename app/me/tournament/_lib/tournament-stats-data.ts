import { executeQuery } from '@/lib/graphql-client'
import {
	GET_PLAYER_BASIC,
	type PlayerBasicResponse,
} from '@/lib/graphql/operations/players'
import {
	GET_TOURNAMENT_EVENT_RESULTS,
	GET_TOURNAMENT_SEASON_SNAPSHOT,
	type TournamentEventResultItem,
	type TournamentEventResultsResponse,
	type TournamentSeasonSnapshotApi,
	type TournamentSeasonSnapshotResponse,
} from '@/lib/graphql/operations/tournaments'
import {
	clearEventResultsInFlight,
	clearSeasonSnapshotInFlight,
	eventResultsKey,
	getAllCachedPlayerMeta,
	getEventResultsInFlight,
	getSeasonSnapshotInFlight,
	peekEventResults,
	peekPlayerMeta,
	peekSeasonSnapshot,
	seasonSnapshotKey,
	seedEventResults,
	seedPlayerMeta,
	seedSeasonSnapshot,
	setEventResultsInFlight,
	setSeasonSnapshotInFlight,
} from './tournament-stats-cache'
import {
	compareTournamentSeasonRows,
	type PlayerMeta,
} from './tournament-stats-model'

/**
 * Resolve captain player labels via fixed operations (no runtime query strings).
 * Uses session cache with long TTL — review page, not Live.
 */
export async function fetchPlayerMetaByIds(
	ids: number[],
): Promise<Record<number, PlayerMeta>> {
	const uniqueIds = Array.from(
		new Set(ids.filter(id => Number.isInteger(id) && id > 0)),
	)
	const result: Record<number, PlayerMeta> = { ...getAllCachedPlayerMeta() }

	const missing = uniqueIds.filter(id => peekPlayerMeta(id) === undefined)
	if (missing.length === 0) {
		const filtered: Record<number, PlayerMeta> = {}
		for (const id of uniqueIds) {
			const hit = peekPlayerMeta(id)
			if (hit) filtered[id] = hit
		}
		return filtered
	}

	await Promise.all(
		missing.map(async id => {
			try {
				const data = await executeQuery<PlayerBasicResponse>(
					GET_PLAYER_BASIC,
					{ id },
					{ cache: 'no-store' },
				)
				const webName = data.player?.webName?.trim()
				if (!webName) return
				const meta: PlayerMeta = {
					webName,
					teamShortName:
						data.player?.team?.shortName?.trim() ||
						data.player?.team?.name?.trim() ||
						'—',
				}
				seedPlayerMeta(id, meta)
				result[id] = meta
			} catch (err) {
				console.warn(`[tournament stats] player meta ${id} failed:`, err)
			}
		}),
	)

	const filtered: Record<number, PlayerMeta> = {}
	for (const id of uniqueIds) {
		const hit = peekPlayerMeta(id) ?? result[id]
		if (hit) filtered[id] = hit
	}
	return filtered
}

/** Cached season field snapshot (Phase 2 backend; fallback client-side). */
export async function fetchTournamentSeasonSnapshotCached(
	tournamentId: number,
	eventId: number,
): Promise<TournamentSeasonSnapshotApi | null> {
	if (eventId <= 0) return null
	const cached = peekSeasonSnapshot<TournamentSeasonSnapshotApi>(
		tournamentId,
		eventId,
	)
	if (cached) return cached
	const key = seasonSnapshotKey(tournamentId, eventId)
	const inflight = getSeasonSnapshotInFlight(key)
	if (inflight) return inflight as Promise<TournamentSeasonSnapshotApi | null>

	const request = executeQuery<TournamentSeasonSnapshotResponse>(
		GET_TOURNAMENT_SEASON_SNAPSHOT,
		{ tournamentId, eventId },
		{ cache: 'no-store' },
	)
		.then(response => {
			const snap = response.tournamentSeasonSnapshot ?? null
			if (snap) seedSeasonSnapshot(tournamentId, eventId, snap)
			return snap
		})
		.catch(err => {
			console.warn('[tournament stats] season snapshot unavailable:', err)
			return null
		})
		.finally(() => clearSeasonSnapshotInFlight(key))

	setSeasonSnapshotInFlight(key, request)
	return request
}

/** Cached tournament event results for a single GW (all entries). */
export async function fetchTournamentEventResultsCached(
	tournamentId: number,
	eventId: number,
): Promise<TournamentEventResultItem[]> {
	if (eventId <= 0) return []
	const cached = peekEventResults<TournamentEventResultItem[]>(
		tournamentId,
		eventId,
	)
	if (cached) return cached
	const key = eventResultsKey(tournamentId, eventId)
	const inflight = getEventResultsInFlight(key)
	if (inflight) return inflight as Promise<TournamentEventResultItem[]>

	const request = executeQuery<TournamentEventResultsResponse>(
		GET_TOURNAMENT_EVENT_RESULTS,
		{ tournamentId, eventId },
		{ cache: 'no-store' },
	)
		.then(response => {
			const rows = response.tournamentEventResults ?? []
			seedEventResults(tournamentId, eventId, rows)
			return rows
		})
		.finally(() => clearEventResultsInFlight(key))

	setEventResultsInFlight(key, request)
	return request
}

/**
 * Per-GW league-relative path for the signed-in entry.
 * Intentionally not personal FPL curves (those live on My Team).
 */
export type TournamentPathPoint = {
	gameweek: number
	/** Tournament group rank after that GW (lower better). */
	tournamentRank: number | null
	/** Points behind the leader that GW (0 if leading). */
	gapToLeader: number | null
	/**
	 * Cumulative overall points minus field average that GW.
	 * Positive = above average in this tournament.
	 */
	pointsVsAverage: number | null
	/** Field size used for averages. */
	fieldSize: number
	/** My cumulative overall (hover context). */
	overallPoints: number | null
	/** Leader cumulative overall (hover context). */
	leaderOverallPoints: number | null
	/** Field average cumulative overall (hover context). */
	averageOverallPoints: number | null
}

const PATH_CONCURRENCY = 4

function buildPathPointFromRows(
	gameweek: number,
	entryId: number,
	rows: TournamentEventResultItem[],
): TournamentPathPoint | null {
	if (rows.length === 0) return null
	const mine = rows.find(r => r.entryId === entryId)
	if (!mine) return null

	const ordered = [...rows].sort(compareTournamentSeasonRows)

	const withPoints = ordered.filter(
		r => r.overallPoints != null && Number.isFinite(r.overallPoints),
	)
	const leaderOverallPoints = withPoints[0]?.overallPoints ?? null
	const myOverall = mine.overallPoints
	const averageOverallPoints =
		withPoints.length > 0
			? withPoints.reduce((sum, r) => sum + (r.overallPoints as number), 0) /
				withPoints.length
			: null

	const gapToLeader =
		myOverall != null && leaderOverallPoints != null
			? Math.max(0, leaderOverallPoints - myOverall)
			: null
	const pointsVsAverage =
		myOverall != null && averageOverallPoints != null
			? myOverall - averageOverallPoints
			: null

	return {
		gameweek,
		tournamentRank: mine.eventGroupRank,
		gapToLeader,
		pointsVsAverage,
		fieldSize: rows.length,
		overallPoints: myOverall,
		leaderOverallPoints,
		averageOverallPoints,
	}
}

/**
 * Build league-relative path across tournament gameweeks.
 * Deferred after first paint — reuses full-field event-results session cache.
 */
export async function loadTournamentSeasonPath(opts: {
	tournamentId: number
	entryId: number
	fromGw: number
	toGw: number
	onProgress?: (points: TournamentPathPoint[]) => void
}): Promise<TournamentPathPoint[]> {
	const from = Math.max(1, Math.min(opts.fromGw, opts.toGw))
	const to = Math.max(from, opts.toGw)
	const gws: number[] = []
	for (let g = from; g <= to; g += 1) gws.push(g)

	const byGw = new Map<number, TournamentPathPoint>()

	const emit = () => {
		const ordered = Array.from(byGw.values()).sort(
			(a, b) => a.gameweek - b.gameweek,
		)
		opts.onProgress?.(ordered)
	}

	for (let i = 0; i < gws.length; i += PATH_CONCURRENCY) {
		const batch = gws.slice(i, i + PATH_CONCURRENCY)
		await Promise.all(
			batch.map(async gw => {
				try {
					const rows = await fetchTournamentEventResultsCached(
						opts.tournamentId,
						gw,
					)
					const point = buildPathPointFromRows(gw, opts.entryId, rows)
					if (point) byGw.set(gw, point)
				} catch (err) {
					console.warn(
						`[tournament stats] season path GW${gw} failed:`,
						err,
					)
				}
			}),
		)
		emit()
	}

	return Array.from(byGw.values()).sort((a, b) => a.gameweek - b.gameweek)
}
