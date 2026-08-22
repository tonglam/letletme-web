'use client'

import type {
	EntryEventResult,
	EntryGameweekTransfers,
	EntryHistoryItem,
	EntrySeasonHistoryItem
} from '@/lib/graphql/operations/entries'
import type { MyFplReviewState } from '@/lib/graphql/operations/my-fpl'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import {
	buildSeasonLogs,
	buildSeasonOverallSnapshot,
	getEntryEventResultCached,
	getEntryHistoryCached,
	getTransferHistoryCached,
	hydrateTeamStatsSessionCache,
	identityFromEventResult,
	mapApiDataToTeamStats,
	peekEntryEventResult,
	peekEntryGameweekState,
	peekEntryHistory,
	peekEntryHistoryState,
	peekTransferHistory,
	peekTransferHistoryState,
	seedTransferHistoryCache,
	type SeasonIdentity,
	type TeamSeasonLogs,
	type TeamSeasonOverallSnapshot,
	type TeamStatsViewModel
} from '../_lib/team-stats-model'

export type InitialEntryHistory = {
	results: EntryHistoryItem[]
	history: EntrySeasonHistoryItem[]
} | null

export type InitialEntryIdentity = SeasonIdentity | null

interface UseTeamStatsOptions {
	entryId: number
	currentGameweek: number
	initialSelectedGameweek?: number
	/** Gameweek tab active → load entryEventResult(selected). */
	loadGameweekData: boolean
	initialEntryEventResult: EntryEventResult | null
	initialEntryGameweekState?: MyFplReviewState
	initialDeskState?: MyFplReviewState
	initialPastSeasonsState?: MyFplReviewState
	initialEntryHistory?: InitialEntryHistory
	initialEntryIdentity?: InitialEntryIdentity
	/** null = deferred client fetch; array = already complete */
	initialEntryTransfers?: EntryGameweekTransfers[] | null
	initialEntryTransfersState?: MyFplReviewState
	initialError: string | null
	initialRequestComplete: boolean
	preseason: boolean
}

/**
 * Session cache (Map in team-stats-model) is the source of truth for fetched
 * payloads. React state is the view projection only.
 *
 * load paths:
 * - season critical: SSR history + identity
 * - transfers: deferred once if not in session cache
 * - gameweek: on demand when loadGameweekData + selectedGameweek
 */
export function useTeamStats({
	entryId,
	currentGameweek: initialCurrentGameweek,
	initialSelectedGameweek,
	loadGameweekData,
	initialEntryEventResult,
	initialEntryGameweekState,
	initialDeskState = 'EMPTY',
	initialPastSeasonsState,
	initialEntryHistory = null,
	initialEntryIdentity = null,
	initialEntryTransfers = null,
	initialEntryTransfersState,
	initialError,
	initialRequestComplete,
	preseason
}: UseTeamStatsOptions) {
	const t = useTranslations('TeamStats')
	const [currentGameweek, setCurrentGameweek] = useState(initialCurrentGameweek)
	const [deskState] = useState<MyFplReviewState>(initialDeskState)
	const [selectedGameweek, setSelectedGameweek] = useState(
		initialSelectedGameweek && initialSelectedGameweek > 0
			? initialSelectedGameweek
			: initialCurrentGameweek
	)

	const seedGw =
		initialSelectedGameweek && initialSelectedGameweek > 0
			? initialSelectedGameweek
			: initialCurrentGameweek

	const historyResults0 = initialEntryHistory?.results ?? []
	const seasonHistory0 = initialEntryHistory?.history ?? []
	const transfers0 = initialEntryTransfers ?? []
	const transfersSeeded = initialEntryTransfers !== null

	const identity0: SeasonIdentity | null =
		initialEntryIdentity ??
		(initialEntryEventResult
			? identityFromEventResult(initialEntryEventResult)
			: null)

	// Hydrate the session cache once after mount so render stays pure.
	const didHydrateRef = useRef(false)

	const [teamStats, setTeamStats] = useState<TeamStatsViewModel | null>(() =>
		initialEntryEventResult
			? mapApiDataToTeamStats(
					initialEntryEventResult,
					historyResults0,
					seasonHistory0,
					transfers0
				)
			: null
	)
	const [seasonOverall, setSeasonOverall] =
		useState<TeamSeasonOverallSnapshot | null>(() =>
			identity0
				? buildSeasonOverallSnapshot(identity0, historyResults0, { preseason })
				: null
		)
	const [seasonLogs, setSeasonLogs] = useState<TeamSeasonLogs | null>(() => {
		if (
			historyResults0.length > 0 ||
			seasonHistory0.length > 0 ||
			transfers0.length > 0
		) {
			return buildSeasonLogs(historyResults0, seasonHistory0, transfers0)
		}
		return null
	})

	const [isLoading, setIsLoading] = useState(false)
	const [historyRetryNonce, setHistoryRetryNonce] = useState(0)
	const [pastSeasonsState, setPastSeasonsState] = useState<
		MyFplReviewState | undefined
	>(initialPastSeasonsState)
	const [isTransfersLoading, setIsTransfersLoading] = useState(
		() => !transfersSeeded && peekTransferHistory(entryId) === undefined
	)
	const [transferState, setTransferState] = useState<
		MyFplReviewState | undefined
	>(initialEntryTransfersState ?? (transfersSeeded ? 'READY' : undefined))
	const [transferRetryNonce, setTransferRetryNonce] = useState(0)
	const [baseError, setBaseError] = useState<string | null>(
		initialError ??
			(initialEntryTransfersState === 'UNAVAILABLE'
				? t('transferDetailsUnavailable')
				: null)
	)
	const [gameweekError, setGameweekError] = useState<string | null>(null)
	const [gameweekState, setGameweekState] = useState<
		MyFplReviewState | undefined
	>(
		initialEntryGameweekState ?? (initialEntryEventResult ? 'READY' : undefined)
	)
	const [gameweekRetryNonce, setGameweekRetryNonce] = useState(0)
	const [emptyStateMessage, setEmptyStateMessage] = useState<string | null>(
		initialEntryGameweekState === 'PENDING'
			? t('pendingReviewForGameweek', {
					gameweek: initialSelectedGameweek ?? initialCurrentGameweek
				})
			: null
	)

	const identityRef = useRef<SeasonIdentity | null>(identity0)
	const gwRequestIdRef = useRef(0)

	useEffect(() => {
		if (didHydrateRef.current || !initialRequestComplete) return
		didHydrateRef.current = true
		hydrateTeamStatsSessionCache({
			entryId,
			seedGw,
			currentGameweek: initialCurrentGameweek,
			history: initialEntryHistory,
			historyState: initialPastSeasonsState,
			event: initialEntryEventResult,
			eventState: initialEntryGameweekState,
			transfers: initialEntryTransfers,
			transfersState: initialEntryTransfersState
		})
	}, [
		entryId,
		initialEntryEventResult,
		initialEntryGameweekState,
		initialPastSeasonsState,
		initialEntryHistory,
		initialEntryIdentity,
		initialEntryTransfers,
		initialEntryTransfersState,
		initialCurrentGameweek,
		initialRequestComplete,
		seedGw
	])

	const rebuildSeasonLogs = (
		history: NonNullable<InitialEntryHistory>,
		transfers: EntryGameweekTransfers[]
	) => {
		setSeasonLogs(buildSeasonLogs(history.results, history.history, transfers))
	}

	// History fallback if SSR missed (session cache empty)
	useEffect(() => {
		let cancelled = false
		let retryTimer: number | undefined
		const scheduleRetry = () => {
			retryTimer = window.setTimeout(() => {
				if (!cancelled) setHistoryRetryNonce(value => value + 1)
			}, 10_000)
		}
		const cachedHistory = peekEntryHistory(entryId)
		if (cachedHistory !== undefined) {
			const cachedState = peekEntryHistoryState(entryId)
			if (cachedState) setPastSeasonsState(cachedState)
			if (cachedState === 'PENDING') scheduleRetry()
			return () => {
				cancelled = true
				if (retryTimer !== undefined) window.clearTimeout(retryTimer)
			}
		}
		void (async () => {
			try {
				const history = await getEntryHistoryCached(entryId)
				if (cancelled || !history) return
				const nextPastSeasonsState = peekEntryHistoryState(entryId)
				if (nextPastSeasonsState) {
					setPastSeasonsState(nextPastSeasonsState)
					if (nextPastSeasonsState === 'PENDING') scheduleRetry()
				}
				if (initialCurrentGameweek <= 0) {
					setCurrentGameweek(
						history.results.reduce(
							(maxEventId, item) => Math.max(maxEventId, item.eventId),
							1
						)
					)
				}
				const transfers = peekTransferHistory(entryId) ?? []
				rebuildSeasonLogs(history, transfers)
				if (identityRef.current) {
					setSeasonOverall(
						buildSeasonOverallSnapshot(identityRef.current, history.results, {
							preseason
						})
					)
				}
			} catch (e) {
				console.error('[team stats] history load failed:', e)
				if (!cancelled) setBaseError(t('loadFailed'))
			}
		})()
		return () => {
			cancelled = true
			if (retryTimer !== undefined) window.clearTimeout(retryTimer)
		}
	}, [entryId, historyRetryNonce, initialCurrentGameweek, preseason, t])

	// Deferred transfers — once per entry unless already in session cache
	useEffect(() => {
		const cachedTransfers = peekTransferHistory(entryId)
		if (cachedTransfers !== undefined) {
			setTransferState(peekTransferHistoryState(entryId) ?? 'READY')
			setIsTransfersLoading(false)
			return
		}
		let cancelled = false
		let pending = false
		let retryTimer: number | undefined
		const loadTransfers = async () => {
			setIsTransfersLoading(true)
			try {
				const transfers = await getTransferHistoryCached(entryId)
				if (cancelled) return
				const state = peekTransferHistoryState(entryId) ?? 'READY'
				setTransferState(state)
				if (state === 'PENDING') {
					pending = true
					retryTimer = window.setTimeout(() => {
						if (!cancelled) setTransferRetryNonce(value => value + 1)
					}, 10_000)
					return
				}
				if (state === 'UNAVAILABLE') {
					setBaseError(prev => prev ?? t('transferDetailsUnavailable'))
				}
				const history = peekEntryHistory(entryId)
				if (history) rebuildSeasonLogs(history, transfers)
			} catch (transferError) {
				console.warn(
					'[team stats] transfers deferred load failed:',
					transferError
				)
				if (!cancelled) {
					// Mark empty so we do not retry forever this session
					seedTransferHistoryCache(entryId, [], 'UNAVAILABLE')
					setTransferState('UNAVAILABLE')
					setBaseError(prev => prev ?? t('transferDetailsUnavailable'))
				}
			} finally {
				if (!cancelled) setIsTransfersLoading(pending)
			}
		}
		void loadTransfers()
		return () => {
			cancelled = true
			if (retryTimer !== undefined) window.clearTimeout(retryTimer)
		}
	}, [entryId, t, transferRetryNonce])

	// On-demand gameweek scoreboard + squad
	useEffect(() => {
		if (!loadGameweekData) {
			setIsLoading(false)
			setGameweekState(undefined)
			return
		}

		const requestId = gwRequestIdRef.current + 1
		gwRequestIdRef.current = requestId
		setGameweekError(null)

		const cachedEvent = peekEntryEventResult(entryId, selectedGameweek)
		const cachedState = peekEntryGameweekState(entryId, selectedGameweek)
		setGameweekState(cachedState)
		let cancelled = false
		let retryTimer: number | undefined
		const schedulePendingRetry = () => {
			if (retryTimer !== undefined || cachedState !== 'PENDING') return
			retryTimer = window.setTimeout(() => {
				if (!cancelled) {
					// The session cache deliberately keeps PENDING short-lived; a
					// retry must be able to replace the null projection after Data
					// finishes its rich sync.
					setGameweekRetryNonce(value => value + 1)
				}
			}, 10_000)
		}
		if (cachedEvent !== undefined && teamStats?.eventId === selectedGameweek) {
			setGameweekState(cachedState ?? 'READY')
			setEmptyStateMessage(null)
			setIsLoading(false)
			return
		}
		// Sync apply cache hit without network
		if (cachedEvent !== undefined && cachedEvent !== null) {
			setGameweekState(cachedState ?? 'READY')
			setEmptyStateMessage(null)
			applyGameweekResult(cachedEvent)
			setIsLoading(false)
			setEmptyStateMessage(null)
			return
		}
		if (cachedEvent === null) {
			setTeamStats(null)
			setGameweekState(cachedState)
			setEmptyStateMessage(formatEmptyStateMessage(cachedState))
			schedulePendingRetry()
			setIsLoading(false)
			return () => {
				cancelled = true
				if (retryTimer !== undefined) window.clearTimeout(retryTimer)
			}
		}

		const loadGw = async () => {
			setIsLoading(true)
			setTeamStats(null)
			setGameweekState(undefined)
			setEmptyStateMessage(null)
			try {
				const entryEventResult = await getEntryEventResultCached(
					entryId,
					selectedGameweek,
					{
						isCurrentGameweek: selectedGameweek === currentGameweek,
						force: gameweekRetryNonce > 0
					}
				)
				if (requestId !== gwRequestIdRef.current) return
				const resolvedState =
					peekEntryGameweekState(entryId, selectedGameweek) ??
					(entryEventResult ? 'READY' : undefined)
				setGameweekState(resolvedState)

				if (!entryEventResult) {
					setTeamStats(null)
					if (resolvedState === 'PENDING') {
						retryTimer = window.setTimeout(() => {
							if (!cancelled) {
								setGameweekRetryNonce(value => value + 1)
							}
						}, 10_000)
					}
					setEmptyStateMessage(
						formatEmptyStateMessage(
							peekEntryGameweekState(entryId, selectedGameweek)
						)
					)
					return
				}
				applyGameweekResult(entryEventResult)
			} catch (loadError) {
				if (requestId !== gwRequestIdRef.current) return
				console.error('[team stats] gameweek load failed:', loadError)
				setGameweekError(t('loadFailed'))
				setTeamStats(null)
			} finally {
				if (requestId === gwRequestIdRef.current) setIsLoading(false)
			}
		}

		void loadGw()
		return () => {
			cancelled = true
			gwRequestIdRef.current += 1
			if (retryTimer !== undefined) window.clearTimeout(retryTimer)
		}

		function applyGameweekResult(entryEventResult: EntryEventResult) {
			setGameweekState('READY')
			const identity = identityFromEventResult(entryEventResult)
			identityRef.current = identity
			const history = peekEntryHistory(entryId)
			const historyResults = history?.results ?? []
			const seasonHistory = history?.history ?? []
			const transfers = peekTransferHistory(entryId) ?? []

			setSeasonOverall(
				buildSeasonOverallSnapshot(identity, historyResults, { preseason })
			)
			const mapped = mapApiDataToTeamStats(
				entryEventResult,
				historyResults,
				seasonHistory,
				transfers
			)
			setTeamStats(mapped)
			if (historyResults.length > 0 || transfers.length > 0) {
				setSeasonLogs({
					historyRows: mapped.historyRows,
					seasonHistoryRows: mapped.seasonHistoryRows,
					chipUsageRows: mapped.chipUsageRows,
					chipCounts: mapped.chipCounts,
					transferRows: mapped.transferRows
				})
			}
		}

		function formatEmptyStateMessage(state: MyFplReviewState | undefined) {
			if (state === 'PENDING') {
				return t('pendingReviewForGameweek', { gameweek: selectedGameweek })
			}
			if (state === 'UNAVAILABLE') {
				return t('gameweekReviewUnavailable', { gameweek: selectedGameweek })
			}
			return t('noStatsForGameweek', { gameweek: selectedGameweek })
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- intentional GW gate
	}, [
		entryId,
		selectedGameweek,
		loadGameweekData,
		currentGameweek,
		gameweekRetryNonce,
		preseason,
		t
	])

	return {
		currentGameweek,
		deskState,
		emptyStateMessage,
		error: gameweekError ?? baseError,
		gameweekState,
		isLoading,
		isTransfersLoading,
		transferState,
		seasonLogs,
		seasonOverall,
		selectedGameweek,
		setSelectedGameweek,
		teamStats,
		pastSeasonsState
	}
}

export { identityFromEntrySummary } from '../_lib/team-stats-model'
