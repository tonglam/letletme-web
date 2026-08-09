import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_EVENT_RESULT,
	GET_ENTRY_HISTORY,
	GET_ENTRY_TRANSFER_HISTORY,
	type EntryEventResult,
	type EntryEventResultResponse,
	type EntryGameweekTransfers,
	type EntryHistoryItem,
	type EntryHistoryResponse,
	type EntrySeasonHistoryItem,
	type EntryTransferHistoryResponse,
} from '@/lib/graphql/operations/entries'

export interface EventPickViewModel {
	position: number
	webName: string
	teamShortName: string
	teamName: string
	elementTypeName: string
	isCaptain: boolean
	isViceCaptain: boolean
	minutes: number
	totalPoints: number
	multiplier: number
	goalsScored: number
	assists: number
	cleanSheets: number
	goalsConceded: number
	yellowCards: number
	redCards: number
	saves: number
	bonus: number
	bps: number
	againstShortName: string
	wasHome: string
	score: string
	isPlayed: boolean
	autoSub: boolean
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
}

/** Season-level card — not tied to the selected gameweek. */
export interface TeamSeasonOverallSnapshot {
	teamName: string
	playerName: string
	region: string
	overallPoints: number
	overallRank: number
	teamValue: number | null
	bank: number | null
	totalTransfers: number | null
	/** Latest GW this snapshot reflects (from history or current entry). */
	asOfGameweek: number
}

export interface TeamStatsViewModel {
	teamName: string
	playerName: string
	region: string
	teamValue: number | null
	bank: number | null
	totalTransfers: number | null
	eventId: number
	eventName: string
	eventPoints: number
	overallPoints: number
	overallRank: number
	eventTransfers: number
	eventTransfersCost: number
	eventNetPoints: number
	eventChip: string
	eventBenchPoints: number
	eventPlayedCaptainName: string
	eventCaptainPoints: number
	eventPicks: EventPickViewModel[]
	historyRows: Array<{
		gameweek: string
		eventPoints: number
		eventNetPoints: number
		eventRank: number | null
		overallPoints: number
		overallRank: number
		eventTransfers: number
		eventTransfersCost: number
		/** Played captain that GW (resolved name); empty if unknown. */
		captainName: string
		captainTeam: string
		/** Captain contribution points for that GW (includes TC multiplier when applied). */
		captainPoints: number
		/** Points scored by bench that GW (FPL event_bench_points). */
		benchPoints: number
		teamValue: number | null
		bank: number | null
	}>
	seasonHistoryRows: Array<{
		seasonOrder: string
		season: string
		totalPoints: number
		overallRank: number
	}>
	chipUsageRows: Array<{
		gameweek: string
		chip: string
		/** Points scored that gameweek (when chip was played) */
		points: number
		netPoints: number
		rank: number | null
	}>
	chipCounts: Array<{
		chip: string
		count: number
	}>
	transferRows: Array<{
		gameweek: string
		transfers: number
		cost: number
		/** Chip played that GW (NONE / WILDCARD / FREE_HIT / …) — drives WC/FH bulk UI. */
		chip: string
		hasTransferDetails: boolean
		moves: Array<{
			inName: string
			inTeam: string
			inCost: number
			outName: string
			outTeam: string
			outCost: number
		}>
	}>
}

export type SeasonIdentity = {
	teamName: string
	playerName: string
	region: string
	totalTransfers: number | null
	/** Fallbacks when history is empty */
	overallPoints?: number
	overallRank?: number
	teamValue?: number | null
	bank?: number | null
	asOfGameweek?: number
}

/**
 * Season card: prefer latest history row for scoreboard metrics so the card
 * does not flip with the GW selector. Identity comes from light entry (or event.entry).
 */
export function buildSeasonOverallSnapshot(
	identity: SeasonIdentity,
	entryHistoryResults: EntryHistoryItem[],
): TeamSeasonOverallSnapshot {
	const latestHistory =
		entryHistoryResults.length > 0
			? [...entryHistoryResults].sort((a, b) => b.eventId - a.eventId)[0]
			: null

	return {
		teamName: identity.teamName,
		playerName: identity.playerName || '-',
		region: identity.region || '-',
		overallPoints:
			latestHistory?.overallPoints ?? identity.overallPoints ?? 0,
		overallRank: latestHistory?.overallRank ?? identity.overallRank ?? 0,
		teamValue: latestHistory?.teamValue ?? identity.teamValue ?? null,
		bank: latestHistory?.bank ?? identity.bank ?? null,
		totalTransfers: identity.totalTransfers,
		asOfGameweek:
			latestHistory?.eventId ?? identity.asOfGameweek ?? 0,
	}
}

export function identityFromEntrySummary(entry: {
	entryName: string
	playerName: string | null
	region?: string | null
	totalTransfers?: number | null
	overallPoints?: number | null
	overallRank?: number | null
	teamValue?: number | null
	bank?: number | null
}): SeasonIdentity {
	return {
		teamName: entry.entryName,
		playerName: entry.playerName ?? '-',
		region: entry.region ?? '-',
		totalTransfers: entry.totalTransfers ?? null,
		overallPoints: entry.overallPoints ?? undefined,
		overallRank: entry.overallRank ?? undefined,
		teamValue: entry.teamValue ?? null,
		bank: entry.bank ?? null,
	}
}

export function identityFromEventResult(
	entryEventResult: EntryEventResult,
): SeasonIdentity {
	return {
		teamName: entryEventResult.entry.entryName,
		playerName: entryEventResult.entry.playerName ?? '-',
		region: entryEventResult.entry.region ?? '-',
		totalTransfers: entryEventResult.entry.totalTransfers,
		overallPoints: entryEventResult.overallPoints,
		overallRank: entryEventResult.overallRank,
		teamValue: entryEventResult.teamValue,
		bank: entryEventResult.bank,
		asOfGameweek: entryEventResult.eventId,
	}
}

/** Season log tables — independent of selected gameweek scoreboard/picks. */
export type TeamSeasonLogs = Pick<
	TeamStatsViewModel,
	| 'historyRows'
	| 'seasonHistoryRows'
	| 'chipUsageRows'
	| 'chipCounts'
	| 'transferRows'
>

export function buildSeasonLogs(
	entryHistoryResults: EntryHistoryItem[],
	entrySeasonHistory: EntrySeasonHistoryItem[],
	entryTransferHistory: EntryGameweekTransfers[],
): TeamSeasonLogs {
	const transferByEvent = new Map<number, EntryGameweekTransfers>()
	entryTransferHistory.forEach(item => {
		transferByEvent.set(item.eventId, item)
	})

	return {
		historyRows: [...entryHistoryResults]
			.sort((a, b) => b.eventId - a.eventId)
			.map(item => ({
				gameweek: String(item.eventId),
				eventPoints: item.eventPoints,
				eventNetPoints: item.eventNetPoints,
				eventRank: item.eventRank,
				overallPoints: item.overallPoints,
				overallRank: item.overallRank,
				eventTransfers: item.eventTransfers,
				eventTransfersCost: item.eventTransfersCost,
				captainName: item.eventPlayedCaptain?.webName?.trim() || '',
				captainTeam:
					item.eventPlayedCaptain?.team?.shortName?.trim() || '',
				captainPoints: item.eventCaptainPoints ?? 0,
				benchPoints: item.eventBenchPoints ?? 0,
				teamValue: item.teamValue,
				bank: item.bank,
			})),
		seasonHistoryRows: [...entrySeasonHistory].map((item, index) => ({
			seasonOrder: String(index + 1),
			season: item.season,
			totalPoints: item.totalPoints,
			overallRank: item.overallRank,
		})),
		chipUsageRows: [...entryHistoryResults]
			.filter(item => item.eventChip !== 'NONE')
			.sort((a, b) => b.eventId - a.eventId)
			.map(item => ({
				gameweek: String(item.eventId),
				chip: item.eventChip,
				points: item.eventPoints,
				netPoints: item.eventNetPoints,
				rank: item.eventRank,
			})),
		chipCounts: Object.entries(
			entryHistoryResults.reduce<Record<string, number>>((acc, item) => {
				if (item.eventChip !== 'NONE') {
					acc[item.eventChip] = (acc[item.eventChip] ?? 0) + 1
				}
				return acc
			}, {}),
		)
			.map(([chip, count]) => ({ chip, count }))
			.sort((a, b) => b.count - a.count),
		transferRows: [...entryHistoryResults]
			.sort((a, b) => b.eventId - a.eventId)
			.map(item => {
				const transferInfo = transferByEvent.get(item.eventId)
				return {
					gameweek: String(item.eventId),
					transfers: item.eventTransfers,
					cost: item.eventTransfersCost,
					chip: item.eventChip ?? 'NONE',
					hasTransferDetails: Boolean(
						transferInfo && transferInfo.transfers.length > 0,
					),
					moves:
						transferInfo?.transfers.map(transfer => ({
							inName: transfer.elementInWebName,
							inTeam: transfer.elementInTeamShortName,
							inCost: transfer.elementInCost,
							outName: transfer.elementOutWebName,
							outTeam: transfer.elementOutTeamShortName,
							outCost: transfer.elementOutCost,
						})) ?? [],
				}
			}),
	}
}

export function extractSeasonLogs(stats: TeamStatsViewModel): TeamSeasonLogs {
	return {
		historyRows: stats.historyRows,
		seasonHistoryRows: stats.seasonHistoryRows,
		chipUsageRows: stats.chipUsageRows,
		chipCounts: stats.chipCounts,
		transferRows: stats.transferRows,
	}
}

export const mapApiDataToTeamStats = (
	entryEventResult: EntryEventResult,
	entryHistoryResults: EntryHistoryItem[],
	entrySeasonHistory: EntrySeasonHistoryItem[],
	entryTransferHistory: EntryGameweekTransfers[]
): TeamStatsViewModel => {
	const seasonLogs = buildSeasonLogs(
		entryHistoryResults,
		entrySeasonHistory,
		entryTransferHistory,
	)

	return {
		teamName: entryEventResult.entry.entryName,
		playerName: entryEventResult.entry.playerName ?? '-',
		region: entryEventResult.entry.region ?? '-',
		teamValue: entryEventResult.teamValue,
		bank: entryEventResult.bank,
		totalTransfers: entryEventResult.entry.totalTransfers,
		eventId: entryEventResult.eventId,
		eventName: `Gameweek ${entryEventResult.eventId}`,
		eventPoints: entryEventResult.eventPoints,
		overallPoints: entryEventResult.overallPoints,
		overallRank: entryEventResult.overallRank,
		eventTransfers: entryEventResult.eventTransfers,
		eventTransfersCost: entryEventResult.eventTransfersCost,
		eventNetPoints: entryEventResult.eventNetPoints,
		eventChip: entryEventResult.eventChip,
		eventBenchPoints: entryEventResult.eventBenchPoints,
		eventPlayedCaptainName: entryEventResult.eventPlayedCaptain?.webName ?? '-',
		eventCaptainPoints: entryEventResult.eventCaptainPoints,
		eventPicks: (() => {
			const posOrder: Record<string, number> = {
				GKP: 1,
				DEF: 2,
				MID: 3,
				FWD: 4,
			}
			return [...entryEventResult.eventPicks]
				.map(
					(pick): EventPickViewModel => ({
						position: pick.position,
						webName: pick.webName,
						teamShortName: pick.teamShortName,
						teamName: pick.teamName,
						elementTypeName: pick.elementTypeName,
						isCaptain: pick.isCaptain,
						isViceCaptain: pick.isViceCaptain,
						minutes: pick.minutes,
						totalPoints: pick.totalPoints,
						multiplier: pick.multiplier,
						goalsScored: pick.goalsScored ?? 0,
						assists: pick.assists ?? 0,
						cleanSheets: pick.cleanSheets ?? 0,
						goalsConceded: pick.goalsConceded ?? 0,
						yellowCards: pick.yellowCards ?? 0,
						redCards: pick.redCards ?? 0,
						saves: pick.saves ?? 0,
						bonus: pick.bonus ?? 0,
						bps: pick.bps ?? 0,
						againstShortName: pick.againstShortName ?? '',
						wasHome: pick.wasHome ?? '',
						score: pick.score ?? '',
						isPlayed: pick.isPlayed ?? pick.minutes > 0,
						autoSub: pick.autoSub ?? false,
						expectedGoals: pick.expectedGoals ?? null,
						expectedAssists: pick.expectedAssists ?? null,
						expectedGoalInvolvements: pick.expectedGoalInvolvements ?? null,
						expectedGoalsConceded: pick.expectedGoalsConceded ?? null,
					}),
				)
				.sort((a, b) => {
					const aBench = a.multiplier === 0 ? 1 : 0
					const bBench = b.multiplier === 0 ? 1 : 0
					if (aBench !== bBench) return aBench - bBench
					if (a.position !== b.position) return a.position - b.position
					return (
						(posOrder[a.elementTypeName] ?? 5) -
						(posOrder[b.elementTypeName] ?? 5)
					)
				})
		})(),
		...seasonLogs,
	}
}

export const formatCompact = (value: number): string => {
	if (value >= 1_000_000) {
		return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
	}
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`
	}
	return String(value)
}

export const formatMoney = (value: number | null): string => {
	if (value === null) return '-'
	return `£${(value / 10).toFixed(1)}m`
}

export const formatPlayerValue = (value: number): string => {
	return `£${(value / 10).toFixed(1)}m`
}

interface TimedCacheValue<T> {
	value: T
	expiresAt: number
}

/**
 * My Team is review/replay — not Live.
 * Wire stays no-store (private). Memory TTLs are long on purpose.
 */
export const ENTRY_EVENT_CACHE_TTL_MS = 30 * 60_000
/** Current-GW event can drift during the matchday; still far from Live polling. */
export const ENTRY_EVENT_CURRENT_CACHE_TTL_MS = 10 * 60_000
const HISTORY_CACHE_TTL_MS = 20 * 60_000
/** @deprecated Use ENTRY_EVENT_CACHE_TTL_MS */
export const LIVE_CACHE_TTL_MS = ENTRY_EVENT_CACHE_TTL_MS
const MAX_CACHE_ENTRIES = 100

const getFreshCacheValue = <K, T>(
	cache: Map<K, TimedCacheValue<T>>,
	key: K,
): T | undefined => {
	const cached = cache.get(key)
	if (!cached) return undefined
	if (cached.expiresAt <= Date.now()) {
		cache.delete(key)
		return undefined
	}
	return cached.value
}

const setCacheValue = <K, T>(
	cache: Map<K, TimedCacheValue<T>>,
	key: K,
	value: T,
	ttlMs: number,
): void => {
	const now = Date.now()
	cache.forEach((cachedValue, cachedKey) => {
		if (cachedValue.expiresAt <= now) cache.delete(cachedKey)
	})
	if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = cache.keys().next().value as K | undefined
		if (oldestKey !== undefined) cache.delete(oldestKey)
	}
	cache.set(key, { value, expiresAt: now + ttlMs })
}

export const entryEventCache = new Map<string, TimedCacheValue<EntryEventResult | null>>()
const entryEventInFlightCache = new Map<
	string,
	Promise<EntryEventResult | null>
>()
const entryHistoryCache = new Map<
	number,
	TimedCacheValue<EntryHistoryResponse['entryHistory']>
>()
const entryHistoryInFlight = new Map<
	number,
	Promise<EntryHistoryResponse['entryHistory']>
>()
const transferHistoryCache = new Map<number, TimedCacheValue<EntryGameweekTransfers[]>>()
const transferHistoryInFlight = new Map<
	number,
	Promise<EntryGameweekTransfers[]>
>()

export const entryEventCacheKey = (entryId: number, eventId: number): string =>
	`${entryId}:${eventId}`

/** Read session cache without fetching (undefined = miss / expired). */
export const peekEntryHistory = (
	entryId: number,
): EntryHistoryResponse['entryHistory'] | undefined =>
	getFreshCacheValue(entryHistoryCache, entryId)

export const peekTransferHistory = (
	entryId: number,
): EntryGameweekTransfers[] | undefined =>
	getFreshCacheValue(transferHistoryCache, entryId)

export const peekEntryEventResult = (
	entryId: number,
	eventId: number,
): EntryEventResult | null | undefined =>
	getFreshCacheValue(entryEventCache, entryEventCacheKey(entryId, eventId))

/** Seed client caches from SSR so the first client fetch is a hit. */
export const seedEntryEventCache = (
	entryId: number,
	eventId: number,
	value: EntryEventResult | null,
	opts?: { isCurrentGameweek?: boolean },
): void => {
	const ttl = opts?.isCurrentGameweek
		? ENTRY_EVENT_CURRENT_CACHE_TTL_MS
		: ENTRY_EVENT_CACHE_TTL_MS
	setCacheValue(
		entryEventCache,
		entryEventCacheKey(entryId, eventId),
		value,
		ttl,
	)
}

export const seedEntryHistoryCache = (
	entryId: number,
	value: EntryHistoryResponse['entryHistory'],
): void => {
	setCacheValue(entryHistoryCache, entryId, value, HISTORY_CACHE_TTL_MS)
}

export const seedTransferHistoryCache = (
	entryId: number,
	value: EntryGameweekTransfers[],
): void => {
	setCacheValue(transferHistoryCache, entryId, value, HISTORY_CACHE_TTL_MS)
}

/**
 * One-shot hydrate of the browser session cache from SSR props.
 * Safe to call multiple times; later seeds overwrite with the same TTL rules.
 */
export function hydrateTeamStatsSessionCache(opts: {
	entryId: number
	seedGw: number
	currentGameweek: number
	history: EntryHistoryResponse['entryHistory'] | null
	event: EntryEventResult | null
	transfers: EntryGameweekTransfers[] | null
}): void {
	const { entryId, seedGw, currentGameweek, history, event, transfers } = opts
	if (history) seedEntryHistoryCache(entryId, history)
	if (transfers !== null) seedTransferHistoryCache(entryId, transfers)
	if (event && seedGw > 0) {
		seedEntryEventCache(entryId, seedGw, event, {
			isCurrentGameweek: seedGw === currentGameweek,
		})
	}
}

export const getEntryHistoryCached = async (
	entryId: number
): Promise<EntryHistoryResponse['entryHistory']> => {
	const cached = getFreshCacheValue(entryHistoryCache, entryId)
	if (cached !== undefined) return cached
	const inflight = entryHistoryInFlight.get(entryId)
	if (inflight) return inflight
	const request = executeQuery<EntryHistoryResponse>(
		GET_ENTRY_HISTORY,
		{ entryId },
		{ cache: 'no-store' }
	)
		.then(response => {
			setCacheValue(
				entryHistoryCache,
				entryId,
				response.entryHistory,
				HISTORY_CACHE_TTL_MS,
			)
			return response.entryHistory
		})
		.finally(() => {
			entryHistoryInFlight.delete(entryId)
		})
	entryHistoryInFlight.set(entryId, request)
	return request
}

export const getEntryEventResultCached = async (
	entryId: number,
	eventId: number,
	opts?: { isCurrentGameweek?: boolean },
): Promise<EntryEventResult | null> => {
	const cacheKey = entryEventCacheKey(entryId, eventId)
	const cached = getFreshCacheValue(entryEventCache, cacheKey)
	if (cached !== undefined) return cached
	const cachedInFlight = entryEventInFlightCache.get(cacheKey)
	if (cachedInFlight) return cachedInFlight
	const ttl = opts?.isCurrentGameweek
		? ENTRY_EVENT_CURRENT_CACHE_TTL_MS
		: ENTRY_EVENT_CACHE_TTL_MS
	const request = executeQuery<EntryEventResultResponse>(
		GET_ENTRY_EVENT_RESULT,
		{ eventId, entryId },
		{ cache: 'no-store' }
	)
		.then(response => {
			const result = response.entryEventResult ?? null
			setCacheValue(entryEventCache, cacheKey, result, ttl)
			return result
		})
		.finally(() => {
			entryEventInFlightCache.delete(cacheKey)
		})
	entryEventInFlightCache.set(cacheKey, request)
	return request
}

export const getTransferHistoryCached = async (
	entryId: number
): Promise<EntryGameweekTransfers[]> => {
	const cached = getFreshCacheValue(transferHistoryCache, entryId)
	if (cached !== undefined) return cached
	const inflight = transferHistoryInFlight.get(entryId)
	if (inflight) return inflight
	const request = executeQuery<EntryTransferHistoryResponse>(
		GET_ENTRY_TRANSFER_HISTORY,
		{ entryId },
		{ cache: 'no-store' },
	)
		.then(response => {
			const transfers = response.entryTransferHistory ?? []
			setCacheValue(
				transferHistoryCache,
				entryId,
				transfers,
				HISTORY_CACHE_TTL_MS,
			)
			return transfers
		})
		.finally(() => {
			transferHistoryInFlight.delete(entryId)
		})
	transferHistoryInFlight.set(entryId, request)
	return request
}

export type TeamStatsTab = 'squad' | 'transfer' | 'history' | 'chips'

export const isTeamStatsTab = (value: string): value is TeamStatsTab =>
	value === 'squad' ||
	value === 'transfer' ||
	value === 'history' ||
	value === 'chips'
