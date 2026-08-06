import {
	TEAM_STATS_UI_MOCK_ENABLED,
	getTeamStatsUiMockEntryEventResult,
	getTeamStatsUiMockHistory,
	getTeamStatsUiMockTransfers,
} from '@/lib/dev/team-stats-ui-mock'
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

interface EventPickViewModel {
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
	}>
	chipCounts: Array<{
		chip: string
		count: number
	}>
	transferRows: Array<{
		gameweek: string
		transfers: number
		cost: number
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

export const mapApiDataToTeamStats = (
	entryEventResult: EntryEventResult,
	entryHistoryResults: EntryHistoryItem[],
	entrySeasonHistory: EntrySeasonHistoryItem[],
	entryTransferHistory: EntryGameweekTransfers[]
): TeamStatsViewModel => {
	const transferByEvent = new Map<number, EntryGameweekTransfers>()
	entryTransferHistory.forEach(item => {
		transferByEvent.set(item.eventId, item)
	})

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
				FWD: 4
			}
			return [...entryEventResult.eventPicks].sort((a, b) => {
				const aBench = a.multiplier === 0 ? 1 : 0
				const bBench = b.multiplier === 0 ? 1 : 0
				if (aBench !== bBench) return aBench - bBench
				return (
					(posOrder[a.elementTypeName] ?? 5) -
					(posOrder[b.elementTypeName] ?? 5)
				)
			})
		})(),
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
				teamValue: item.teamValue,
				bank: item.bank
			})),
		seasonHistoryRows: [...entrySeasonHistory].map((item, index) => ({
			seasonOrder: String(index + 1),
			season: item.season,
			totalPoints: item.totalPoints,
			overallRank: item.overallRank
		})),
		chipUsageRows: [...entryHistoryResults]
			.filter(item => item.eventChip !== 'NONE')
			.sort((a, b) => b.eventId - a.eventId)
			.map(item => ({
				gameweek: String(item.eventId),
				chip: item.eventChip
			})),
		chipCounts: Object.entries(
			entryHistoryResults.reduce<Record<string, number>>((acc, item) => {
				if (item.eventChip !== 'NONE') {
					acc[item.eventChip] = (acc[item.eventChip] ?? 0) + 1
				}
				return acc
			}, {})
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
					hasTransferDetails: Boolean(
						transferInfo && transferInfo.transfers.length > 0
					),
					moves:
						transferInfo?.transfers.map(transfer => ({
							inName: transfer.elementInWebName,
							inTeam: transfer.elementInTeamShortName,
							inCost: transfer.elementInCost,
							outName: transfer.elementOutWebName,
							outTeam: transfer.elementOutTeamShortName,
							outCost: transfer.elementOutCost
						})) ?? []
				}
			})
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

export const LIVE_CACHE_TTL_MS = 30_000
const HISTORY_CACHE_TTL_MS = 5 * 60_000
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

export const getEntryHistoryCached = async (
	entryId: number
): Promise<EntryHistoryResponse['entryHistory']> => {
	// TEMP UI mock — remove with lib/dev/team-stats-ui-mock.ts
	if (TEAM_STATS_UI_MOCK_ENABLED) {
		return getTeamStatsUiMockHistory()
	}
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
	eventId: number
): Promise<EntryEventResult | null> => {
	// TEMP UI mock — remove with lib/dev/team-stats-ui-mock.ts
	if (TEAM_STATS_UI_MOCK_ENABLED) {
		return getTeamStatsUiMockEntryEventResult(eventId, entryId)
	}
	const cacheKey = entryEventCacheKey(entryId, eventId)
	const cached = getFreshCacheValue(entryEventCache, cacheKey)
	if (cached !== undefined) return cached
	const cachedInFlight = entryEventInFlightCache.get(cacheKey)
	if (cachedInFlight) return cachedInFlight
	const request = executeQuery<EntryEventResultResponse>(
		GET_ENTRY_EVENT_RESULT,
		{ eventId, entryId },
		{ cache: 'no-store' }
	)
		.then(response => {
			const result = response.entryEventResult ?? null
			setCacheValue(entryEventCache, cacheKey, result, LIVE_CACHE_TTL_MS)
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
	// TEMP UI mock — remove with lib/dev/team-stats-ui-mock.ts
	if (TEAM_STATS_UI_MOCK_ENABLED) {
		return getTeamStatsUiMockTransfers()
	}
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
