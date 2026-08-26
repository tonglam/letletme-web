'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { PlayerOwnershipFilter } from '@/components/player/PlayerOwnershipFilter'
import { TeamExposureFilter } from '@/components/player/TeamExposureFilter'
import { MobileCollapsibleFilters } from '@/components/tournament/MobileCollapsibleFilters'
import { OfficialH2HCompetitionView } from '@/components/tournament/OfficialH2HCompetitionView'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePageActive } from '@/hooks/use-page-active'
import { Link, useRouter } from '@/i18n/navigation'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse
} from '@/lib/graphql/operations/live'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_DETAIL_DESK,
	GET_TOURNAMENT_LIVE_DESK,
	type EntryTournamentsResponse,
	type TournamentDetailDeskResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import {
	LiveBoardRequestError,
	boardRowToTournamentEntry,
	canLoadMoreLiveBoard,
	clearOtherLiveBoardLastGood,
	fetchEntryLiveCompetitionBoard,
	isCurrentLiveBoardRequest,
	isLiveBoardRevisionGoneCode,
	liveBoardLastGoodKey,
	readLiveBoardLastGood,
	resolveAnchoredGameweek,
	resolveUrlGameweekSelection,
	shouldAutoRefreshLiveBoardPage,
	shouldSyncLiveBoardSearchInput,
	writeLiveBoardLastGood,
	type LiveBoardFilterState
} from '@/lib/tournament/live-board'
import { liveContextToSnapshot } from '@/lib/live-refresh'
import {
	buildTournamentEntries,
	buildTournamentStats,
	countTraceableTournamentScores,
	getTournamentManagerNextRefreshAt,
	formatLiveAveragePoints,
	getRetainedFailedEntryIds,
	mergeUnavailableTournamentEntryIds,
	mergePartialTournamentRows,
	type LiveTournamentStats
} from '@/lib/tournament/liveEntries'
import { traceableOfficialManagerScore } from '@/lib/live-manager-score'
import {
	isOfficialH2HTournament,
	mapEntryTournamentToLiveTournament
} from '@/lib/tournament/liveTournament'
import {
	areTournamentStandingsReady,
	isTournamentSetupPollingPending
} from '@/lib/tournament/lifecycle'
import {
	readLiveTournamentSelection,
	resolveLiveTournamentSelection,
	writeLiveTournamentSelection
} from '@/lib/tournament/live-selection'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import type {
	TournamentSortColumn,
	TournamentSortDirection
} from '@/lib/tournament/table-sort'
import type { Tournament, TournamentEntry } from '@/types/tournament'
import { Filter, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const fetchLivePoints = async (
	entryId: number,
	tournamentId: number,
	eventId: number,
	revision?: string | null
): Promise<{
	rows: TournamentLiveCalcData[]
	failedCount: number
	failedEntryIds: number[]
	officialCoverage: number
	unavailableEntryIds: number[]
	totalEntries: number
	snapshot: LiveSnapshotStatus | null
}> => {
	let response: TournamentLivePointsResponse
	if (revision) {
		const params = new URLSearchParams({
			eventId: String(eventId),
			revision
		})
		const httpResponse = await fetch(
			`/api/live/competitions/${tournamentId}/board?${params.toString()}`,
			{ cache: 'no-store' }
		)
		if (!httpResponse.ok)
			throw new Error(
				`Live competition request failed (${httpResponse.status})`
			)
		response = (await httpResponse.json()) as TournamentLivePointsResponse
	} else {
		// A null live revision must still honor the selected historical GW. The
		// list desk intentionally resolves its event from the live anchor, so use
		// the detail projection, whose eventId argument is the actual selection.
		const detailResponse = await executeQuery<TournamentDetailDeskResponse>(
			GET_TOURNAMENT_DETAIL_DESK,
			{ entryId, tournamentId, eventId },
			{ cache: 'no-store' }
		)
		const detailDesk = detailResponse.tournamentDetailDesk
		const live = detailDesk?.live
		if (live) {
			const unavailableEntryIds = mergeUnavailableTournamentEntryIds(
				live.failedEntryIds,
				[]
			)
			const officialRows = countTraceableTournamentScores(live.rows)
			return {
				rows: live.rows,
				failedCount: unavailableEntryIds.length,
				failedEntryIds: unavailableEntryIds,
				officialCoverage:
					live.totalEntries > 0 ? officialRows / live.totalEntries : 0,
				unavailableEntryIds,
				totalEntries: live.totalEntries,
				snapshot: {
					eventId: live.eventId,
					revision: live.revision,
					state: live.state as LiveSnapshotStatus['state'],
					publishedAt: null,
					checkedAt: null
				}
			}
		}

		// Official H2H tournaments deliberately expose their settled standings
		// through `officialH2H` on the detail desk, not through `live`. The
		// competitions page still needs the current event board, so use the list
		// desk as the event-aware fallback instead of treating that valid H2H
		// response as an unavailable board.
		if (detailDesk?.kind !== 'OFFICIAL_H2H') {
			throw new Error('Tournament live board is unavailable')
		}
		response = await executeQuery<TournamentLivePointsResponse>(
			GET_TOURNAMENT_LIVE_DESK,
			{ entryId, selectedTournamentId: tournamentId, ref: null },
			{ cache: 'no-store' }
		)
		if (response.entryLiveCompetitionsDesk.eventId !== eventId) {
			throw new Error('Tournament live board returned an unexpected gameweek')
		}
	}
): string | null => {
	if (page.failedEntryCount > 0) {
		return messages.failed
	}
	if (
		page.deferredEntryCount > 0 ||
		page.coverageState === 'WARMING' ||
		page.coverageState === 'PARTIAL'
	) {
		return messages.warming
	}
	if (
		page.unavailableEntryCount > 0 ||
		page.managerDataAvailability === 'UNAVAILABLE'
	) {
		return messages.unavailable
	}
	return null
}

const exactUpdatedAt = (value: string | null): string | null => {
	if (!value || !Number.isFinite(Date.parse(value))) return null
	return `${value.replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC`
}

interface TournamentClientProps {
	entryId: number
	initialTournaments?: Tournament[]
	initialSelectedTournamentId?: string
	initialEventId: number
	initialBoardPage?: EntryLiveCompetitionBoardPage | null
	initialResultsLoaded?: boolean
	initialResultsError?: string | null
	season: string
	sessionCacheKey: string
}

export default function TournamentClient({
	entryId,
	initialTournaments = [],
	initialSelectedTournamentId = '',
	initialEventId,
	initialBoardPage = null,
	initialResultsLoaded = false,
	initialResultsError = null,
	season,
	sessionCacheKey
}: TournamentClientProps) {
	const t = useTranslations('LiveTournament')
	const format = useFormatter()
	const lifecycleT = useTranslations('TournamentLifecycle')
	const filtersT = useTranslations('Filters')
	const isPageActive = usePageActive()
	const router = useRouter()
	const searchParams = useSearchParams()

	const tournamentIdFromUrl = searchParams.get('tournamentId')?.trim() || null
	const gameweekFromUrl = (() => {
		const raw = searchParams.get('gw')
		if (!raw || !/^\d+$/.test(raw)) return null
		const value = Number(raw)
		return Number.isInteger(value) && value >= 1 && value <= 38 ? value : null
	})()

	const [tournaments, setTournaments] = useState(initialTournaments)
	const [restoredTournamentId, setRestoredTournamentId] = useState<
		string | null
	>(null)
	const [selectionRestoreComplete, setSelectionRestoreComplete] =
		useState(false)
	const selectionRestoreEntryIdRef = useRef<number | null>(null)
	const cachedTournamentIdRef = useRef<string | null>(null)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [resultsError, setResultsError] = useState<string | null>(
		initialResultsError
	)
	const [isLoadingInitial, setIsLoadingInitial] = useState(false)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [isLoadingMore, setIsLoadingMore] = useState(false)
	const [showingLastGood, setShowingLastGood] = useState(false)
	const [rateLimitSeconds, setRateLimitSeconds] = useState(0)
	const rateLimitSecondsRef = useRef(rateLimitSeconds)
	const [tableEntriesForShare, setTableEntriesForShare] = useState<
		TournamentEntry[]
	>([])
	const replaceAbortRef = useRef<AbortController | null>(null)
	const replaceInFlightRef = useRef(false)
	const requestVersionRef = useRef(0)
	const activeScopeRef = useRef(scopeKey)
	const refreshInFlightRef = useRef<Promise<boolean> | null>(null)
	const pendingReplacementRef = useRef<PendingBoardReplacement | null>(null)
	const acceptedBoardFreshnessRef = useRef<BoardFreshnessMarker | null>(
		boardFreshnessMarker(initialBoardPage)
	)
	const shareRef = useRef<HTMLDivElement | null>(null)
	const updateSearchInput = useCallback((value: string): void => {
		searchInputRef.current = value
		setSearchInput(value)
	}, [])

	useEffect(() => {
		queryStateRef.current = queryState
	}, [queryState])

	useEffect(() => {
		activeScopeRef.current = scopeKey
	}, [scopeKey])

	useEffect(() => {
		if (lastUrlGameweekRef.current === gameweekFromUrl) return
		lastUrlGameweekRef.current = gameweekFromUrl
		const next = resolveUrlGameweekSelection({
			currentEvent: currentGameweek,
			requestedGameweek: gameweekFromUrl
		})
		followsAnchorRef.current = next.followsAnchor
		setSelectedGameweek(next.selectedGameweek)
	}, [currentGameweek, gameweekFromUrl])

	useEffect(() => {
		rateLimitSecondsRef.current = rateLimitSeconds
	}, [rateLimitSeconds])

	useEffect(() => {
		if (rateLimitSeconds <= 0) return
		const timer = window.setTimeout(
			() =>
				setRateLimitSeconds(seconds => {
					const next = Math.max(0, seconds - 1)
					rateLimitSecondsRef.current = next
					return next
				}),
			1_000
		)
		return () => window.clearTimeout(timer)
	}, [rateLimitSeconds])

	useEffect(() => {
		if (entryId <= 0 || initialTournaments.length > 0) return
		const controller = new AbortController()
		setIsLoadingTournaments(true)
		setListError(null)
		void executeQuery<EntryTournamentsResponse>(
			GET_ENTRY_TOURNAMENTS,
			{ entryId },
			{ cache: 'no-store', signal: controller.signal }
		)
			.then(data =>
				setTournaments(
					data.entryTournaments.map(mapEntryTournamentToLiveTournament)
				)
			)
			.catch(() => {
				if (!controller.signal.aborted) setListError(t('listFailed'))
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoadingTournaments(false)
			})
		return () => controller.abort()
	}, [entryId, initialTournaments.length, t])

	useEffect(() => {
		if (entryId <= 0 || tournaments.length === 0) return
		let storage: Storage | null = null
		try {
			storage = window.localStorage
		} catch {
			// Optional storage.
		}

		if (selectionRestoreEntryIdRef.current !== entryId) {
			selectionRestoreEntryIdRef.current = entryId
			cachedTournamentIdRef.current = readLiveTournamentSelection(
				storage,
				entryId
			)
			setRestoredTournamentId(null)
		}

		const resolution = resolveLiveTournamentSelection({
			availableIds: tournaments.map(tournament => tournament.id),
			urlTournamentId: normalizedTournamentIdFromUrl,
			cachedTournamentId: cachedTournamentIdRef.current,
			initialTournamentId: initialSelectedTournamentId
		})
		if (resolution.source === 'unknown-url') {
			setSelectionRestoreComplete(true)
			return
		}

		if (resolution.selectedId) {
			setRestoredTournamentId(resolution.selectedId)
			if (resolution.source === 'url') {
				cachedTournamentIdRef.current = resolution.selectedId
				writeLiveTournamentSelection(storage, entryId, resolution.selectedId)
			} else if (!resolution.cachedId) {
				// Do not overwrite a cached id that is temporarily absent from an
				// incomplete membership list. Apply it when the list catches up.
				cachedTournamentIdRef.current = resolution.selectedId
				writeLiveTournamentSelection(storage, entryId, resolution.selectedId)
			}
		}
		setSelectionRestoreComplete(true)
	}, [entryId, initialSelectedTournamentId, tournamentIdFromUrl, tournaments])

	useEffect(() => {
		if (
			!selectionRestoreComplete ||
			!tournamentIdFromUrl ||
			tournaments.length === 0 ||
			tournaments.some(tournament => tournament.id === tournamentIdFromUrl)
		)
			return
		const fallback = tournaments[0]
		if (!fallback) return
		const params = new URLSearchParams({ tournamentId: fallback.id })
		if (gameweekFromUrl) params.set('gw', String(gameweekFromUrl))
		router.replace(`/live/competitions?${params.toString()}`)
	}, [
		entryId,
		initialSelectedTournamentId,
		normalizedTournamentIdFromUrl,
		tournaments
	])
	const selectedTournament = useMemo(() => {
		if (tournaments.length === 0) return null
		if (requestedTournamentId) {
			return tournaments.find(t => t.id === requestedTournamentId) ?? null
		}
		return tournaments[0] ?? null
	}, [requestedTournamentId, tournaments])
	const selectedTournamentIsOfficialH2H = isOfficialH2HTournament(selectedTournament)
	const selectedTournamentKey = selectedTournament?.id ?? null
	const lastUpdatedAt = useMemo(() => {
		const candidates = [
			snapshot?.checkedAt ?? null,
			...selectedRows.map(
				row => traceableOfficialManagerScore(row.score)?.checkedAt ?? null
			)
		].filter((value): value is string => Boolean(value))

		return candidates.reduce<string | null>((latest, candidate) => {
			if (!latest || Date.parse(candidate) > Date.parse(latest)) return candidate
			return latest
		}, null)
	}, [selectedRows, snapshot?.checkedAt])
	const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string | null>(null)
	useEffect(() => {
		if (!lastUpdatedAt) {
			setLastUpdatedLabel(null)
			return
		}
		const parsed = new Date(lastUpdatedAt)
		if (Number.isNaN(parsed.getTime())) {
			setLastUpdatedLabel(null)
			return
		}
		const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
		setLastUpdatedLabel(
			format.dateTime(parsed, {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				timeZone: browserTimeZone
			})
		)
	}, [format, lastUpdatedAt])
	const selectedSetupStatus = selectedTournament?.setupStatus
	const selectedInsightsReadyAt = selectedTournament?.insightsReadyAt
	const selectedSetupRepairExhausted = selectedTournament?.setupRepairExhausted
	/** URL asked for a tournament that is not in this entry's membership list. */
	const unknownTournamentFromUrl = Boolean(
		normalizedTournamentIdFromUrl &&
		tournaments.length > 0 &&
		!tournaments.some(t => t.id === normalizedTournamentIdFromUrl)
	)
	const standingsReady = selectedTournament
		? areTournamentStandingsReady(selectedTournament)
		: false

	const loadTournamentResults = useCallback(
		(
			tournamentId: number,
			eventId: number,
			options: { preserveOnError: boolean; revision?: string | null }
		): Promise<void> => {
			const requestKey = `${tournamentId}:${eventId}`
			if (resultsInFlightRef.current?.key === requestKey) {
				return resultsInFlightRef.current.promise
			}

			const requestId = resultsRequestIdRef.current + 1
			resultsRequestIdRef.current = requestId
			const request = (async () => {
				try {
					if (!options.preserveOnError) setIsLoadingResults(true)
					setResultsError(null)
					const currentBatch = await fetchLivePoints(
						entryId,
						tournamentId,
						eventId,
						options.revision !== undefined
							? options.revision
							: (snapshotRef.current?.revision ?? null)
					)
					if (requestId !== resultsRequestIdRef.current) return

					if (currentBatch.failedCount > 0) {
						setResultsError(
							t('partialResults', {
								failed: currentBatch.failedCount,
								total: currentBatch.totalEntries
							})
						)
					}

					failedEntryCountRef.current = currentBatch.failedCount
					setOfficialCoverage(currentBatch.officialCoverage)
					setLoadedResultsKey(requestKey)
					acceptSnapshot(currentBatch.snapshot)
					// Read previous rows via functional update, then set rows + stale separately
					// (avoid nested setState inside another updater).
					setSelectedRows(previousRows => {
						const nextRows = currentBatch.rows
						const retainedIds = getRetainedFailedEntryIds({
							nextRows,
							previousRows,
							failedEntryIds: currentBatch.failedEntryIds,
							preserveFailed: options.preserveOnError
						})
						const merged = mergePartialTournamentRows({
							nextRows,
							previousRows,
							failedEntryIds: currentBatch.failedEntryIds,
							preserveFailed: options.preserveOnError
						})
						// Schedule after this updater commits — not inside the updater body.
						queueMicrotask(() => {
							if (requestId !== resultsRequestIdRef.current) return
							setStaleEntryIds(
								retainedIds.length > 0 ? new Set(retainedIds) : new Set()
							)
						})
						return merged
					})
				} catch {
					if (requestId !== resultsRequestIdRef.current) return
					setResultsError(t('standingsFailed'))
					if (!options.preserveOnError) {
						setSelectedRows([])
						setOfficialCoverage(0)
						setStaleEntryIds(new Set())
						setLoadedResultsKey(null)
					}
				} finally {
					if (requestId === resultsRequestIdRef.current) {
						setIsLoadingResults(false)
					}
				}
			})()

			resultsInFlightRef.current = { key: requestKey, promise: request }
			void request.finally(() => {
				if (resultsInFlightRef.current?.promise === request) {
					resultsInFlightRef.current = null
				}
			})
			return request
		},
		[acceptSnapshot, entryId, t]
	)

	useEffect(() => {
		let isCancelled = false
		if (entryId <= 0) {
			return
		}
		if (initialTournaments.length > 0) {
			return
		}

		const loadEntryTournaments = async () => {
			try {
				setIsLoadingTournaments(true)
				setLoadError(null)

				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{
						entryId: entryId
					}
				)

				if (isCancelled) {
					return
				}

				const mappedTournaments = data.entryTournaments.map(entryTournament =>
					mapEntryTournamentToLiveTournament(entryTournament)
				)
				setTournaments(mappedTournaments)
			} catch {
				if (isCancelled) {
					return
				}

				setLoadError(t('listFailed'))
				setTournaments([])
			} finally {
				if (!isCancelled) {
					setIsLoadingTournaments(false)
				}
			}
		}

		loadEntryTournaments()

		return () => {
			isCancelled = true
		}
	}, [entryId, initialTournaments.length, t])

	useEffect(() => {
		if (requestedGameweekFromUrl === null) {
			appliedUrlGameweekRef.current = null
			return
		}
		if (requestedGameweekFromUrl > currentGameweek) return
		if (appliedUrlGameweekRef.current === requestedGameweekFromUrl) return

		appliedUrlGameweekRef.current = requestedGameweekFromUrl
		followsAnchorRef.current = false
		if (requestedGameweekFromUrl !== selectedGameweek) {
			setSelectedGameweek(requestedGameweekFromUrl)
		}
	}, [currentGameweek, requestedGameweekFromUrl, selectedGameweek])

	useEffect(() => {
		if (
			!isPageActive ||
			!selectedTournamentId ||
			!selectedTournamentSetupStatus ||
			!isTournamentSetupPollingPending(
				selectedTournamentSetupStatus,
				selectedTournamentInsightsReadyAt,
				selectedTournamentSetupRepairExhausted
			)
		) {
			return
		}
		let cancelled = false
		let timer: number | null = null
		const poll = async () => {
			try {
				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId },
					{ cache: 'no-store' }
				)
				if (!cancelled) {
					setTournaments(
						data.entryTournaments.map(mapEntryTournamentToLiveTournament)
					)
					setListError(null)
				}
			} catch {
				if (!cancelled) setListError(t('listFailed'))
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 5_000)
			}
		}
		timer = window.setTimeout(poll, 5_000)
		return () => {
			cancelled = true
			if (timer !== null) window.clearTimeout(timer)
		}
	}, [
		entryId,
		isPageActive,
		selectedTournamentId,
		selectedTournamentInsightsReadyAt,
		selectedTournamentSetupRepairExhausted,
		selectedTournamentSetupStatus,
		t
	])

	const buildVariables = useCallback(
		(
			tournamentId: number,
			eventId: number,
			query: BoardQueryState,
			page = 1,
			expectedBoardRevision: string | null = null
		): EntryLiveCompetitionBoardVariables => ({
			entryId,
			tournamentId,
			eventId,
			page,
			pageSize: 20,
			sort: tableSortToBoardSort(query.sortColumn),
			direction: query.sortDirection === 'asc' ? 'ASC' : 'DESC',
			search: query.search || null,
			chips: query.filters.chips,
			captainPlayerIds: query.filters.captainPlayerIds,
			ownership: query.filters.ownership,
			teamCountRules: query.filters.teamCountRules,
			expectedBoardRevision
		}),
		[entryId]
	)

	const replaceFirstPage = useCallback(
		async (
			tournamentId: number,
			eventId: number,
			query: BoardQueryState,
			options: { preserve: boolean; expectedScope: string }
		): Promise<boolean> => {
			if (rateLimitSecondsRef.current > 0) {
				pendingReplacementRef.current = {
					tournamentId,
					eventId,
					query,
					options
				}
				return false
			}
			const searchInputAtStart = searchInputRef.current
			replaceAbortRef.current?.abort()
			const controller = new AbortController()
			replaceAbortRef.current = controller
			replaceInFlightRef.current = true
			const version = requestVersionRef.current + 1
			requestVersionRef.current = version
			if (options.preserve) setIsRefreshing(true)
			else setIsLoadingInitial(true)
			try {
				const page = await fetchEntryLiveCompetitionBoard(
					tournamentId,
					buildVariables(tournamentId, eventId, query),
					{ signal: controller.signal }
				)
				if (
					controller.signal.aborted ||
					!isCurrentLiveBoardRequest(
						version,
						requestVersionRef.current,
						options.expectedScope,
						activeScopeRef.current
					)
				) {
					return false
				}
				setBoardPage(page)
				setEntries(pageRows(page))
				setContentScopeKey(options.expectedScope)
				acceptedBoardFreshnessRef.current = boardFreshnessMarker(page)
				queryStateRef.current = query
				setQueryState(query)
				if (
					shouldSyncLiveBoardSearchInput(
						searchInputAtStart,
						searchInputRef.current
					)
				) {
					updateSearchInput(query.search)
				}
				setResultsError(
					page.partial
						? boardPartialMessage(page, {
								failed: t('calculationFailed', {
									count: page.failedEntryCount
								}),
								warming: t('coverageWarming'),
								unavailable: t('unavailableCalculation', {
									count: page.unavailableEntryCount || page.totalEntries
								})
							})
						: null
				)
				setShowingLastGood(false)
				if (queryIsDefault(query)) {
					let storage: Storage | null = null
					try {
						storage = window.localStorage
					} catch {
						// Optional storage.
					}
					writeLiveBoardLastGood(
						storage,
						{
							sessionKey: sessionCacheKey,
							season,
							eventId,
							entryId,
							tournamentId
						},
						page
					)
				}
				return true
			} catch (error) {
				if (controller.signal.aborted) return false
				if (error instanceof LiveBoardRequestError && error.status === 429) {
					const cooldown = Math.max(1, error.retryAfterSeconds ?? 30)
					pendingReplacementRef.current = {
						tournamentId,
						eventId,
						query,
						options
					}
					rateLimitSecondsRef.current = cooldown
					setRateLimitSeconds(cooldown)
				}
				if (
					version === requestVersionRef.current &&
					activeScopeRef.current === options.expectedScope
				) {
					setResultsError(
						options.preserve ? t('refreshFailedRetained') : t('standingsFailed')
					)
				}
				return false
			} finally {
				if (replaceAbortRef.current === controller) {
					replaceAbortRef.current = null
					replaceInFlightRef.current = false
				}
				if (version === requestVersionRef.current) {
					setIsLoadingInitial(false)
					setIsRefreshing(false)
				}
			}
		},
		[buildVariables, entryId, season, sessionCacheKey, t, updateSearchInput]
	)

	useEffect(() => {
		if (!selectionRestoreComplete) return
		if (scopeKey && selectedTournamentId && standingsReady) return
		replaceAbortRef.current?.abort()
		replaceAbortRef.current = null
		replaceInFlightRef.current = false
		requestVersionRef.current += 1
		refreshInFlightRef.current = null
		pendingReplacementRef.current = null
		acceptedBoardFreshnessRef.current = null
		queryStateRef.current = defaultQueryState()
		setQueryState(queryStateRef.current)
		updateSearchInput('')
		setShowAdvancedFilters(false)
		setTableEntriesForShare([])
		setBoardPage(null)
		setEntries([])
		setContentScopeKey(scopeKey)
		setResultsError(null)
		setIsLoadingInitial(false)
		setIsLoadingMore(false)
		setIsRefreshing(false)
		setShowingLastGood(false)
	}, [
		selectedTournamentId,
		selectionRestoreComplete,
		scopeKey,
		standingsReady,
		updateSearchInput
	])

	useEffect(() => {
		if (
			!scopeKey ||
			!selectedTournamentId ||
			!standingsReady ||
			!selectionRestoreComplete
		) {
			// Invalidate any in-flight standings fetch for a previous selection.
			resultsRequestIdRef.current += 1
			resultsInFlightRef.current = null
			const resetTimer = window.setTimeout(() => {
				setIsLoadingResults(false)
				setResultsError(null)
				setSelectedRows([])
				setOfficialCoverage(0)
				setStaleEntryIds(new Set())
				setLoadedResultsKey(null)
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}
		const resultsKey = `${selectedTournamentKey}:${selectedGameweek}`
		if (selectedTournamentIsOfficialH2H) {
			// Official H2H has its own settled fixture/standings projection. Do not
			// run the manager live-board request and surface a misleading points-table
			// error while the H2H view is loading its authoritative snapshot.
			initialResultsKeyRef.current = null
			resultsRequestIdRef.current += 1
			resultsInFlightRef.current = null
			setSelectedRows([])
			setOfficialCoverage(0)
			setStaleEntryIds(new Set())
			setLoadedResultsKey(resultsKey)
			setResultsError(null)
			setIsLoadingResults(false)
			acceptSnapshot(null)
			return
		}
		if (initialResultsKeyRef.current === resultsKey) {
			initialResultsKeyRef.current = null
			if (
				initialResultsError &&
				initialCurrentRows.length === 0 &&
				!initialRetryAttemptedRef.current
			) {
				initialRetryAttemptedRef.current = true
				const retryTimer = window.setTimeout(() => {
					void loadTournamentResults(
						Number(selectedTournamentKey),
						selectedGameweek,
						{
							preserveOnError: false,
							// A full initial failure is often a stale publication
							// snapshot. Force the retry to ask for the current desk.
							revision: null
						}
					)
				}, 1_000)
				return () => window.clearTimeout(retryTimer)
			}
			return
		}
		const tournamentId = Number(selectedTournamentId)
		const eventId = selectedGameweek
		const nextQuery = defaultQueryState()
		queryStateRef.current = nextQuery
		setQueryState(nextQuery)
		updateSearchInput('')
		setShowAdvancedFilters(false)
		setTableEntriesForShare([])
		setResultsError(null)
		let storage: Storage | null = null
		try {
			storage = window.localStorage
		} catch {
			// Optional storage.
		}
		const cacheScope = {
			sessionKey: sessionCacheKey,
			season,
			eventId,
			entryId,
			tournamentId
		}
		const cacheKey = liveBoardLastGoodKey(cacheScope)
		clearOtherLiveBoardLastGood(storage, cacheKey)

		const initial = initialSeedRef.current
		if (initial?.key === scopeKey && initial.page) {
			initialSeedRef.current = null
			setBoardPage(initial.page)
			setEntries(pageRows(initial.page))
			setContentScopeKey(scopeKey)
			acceptedBoardFreshnessRef.current = boardFreshnessMarker(initial.page)
			setShowingLastGood(false)
			writeLiveBoardLastGood(storage, cacheScope, initial.page)
			if (initial.page.partial) {
				setResultsError(
					boardPartialMessage(initial.page, {
						failed: t('calculationFailed', {
							count: initial.page.failedEntryCount
						}),
						warming: t('coverageWarming'),
						unavailable: t('unavailableCalculation', {
							count:
								initial.page.unavailableEntryCount || initial.page.totalEntries
						})
					})
				)
			}
			if (initial.loaded) return
		}

		const cached = readLiveBoardLastGood(storage, cacheScope)
		if (cached) {
			setBoardPage(cached)
			setEntries(pageRows(cached))
			setContentScopeKey(scopeKey)
			acceptedBoardFreshnessRef.current = boardFreshnessMarker(cached)
			setShowingLastGood(true)
		} else if (contentScopeKey !== scopeKey) {
			setBoardPage(null)
			setEntries([])
			setContentScopeKey(scopeKey)
			setShowingLastGood(false)
		}
		void replaceFirstPage(tournamentId, eventId, nextQuery, {
			preserve: Boolean(cached),
			expectedScope: scopeKey
		})
		return () => replaceAbortRef.current?.abort()
		// contentScopeKey is intentionally read only to decide whether an old
		// selection may be cleared; it must not retrigger this strict-scope effect.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		entryId,
		replaceFirstPage,
		scopeKey,
		season,
		selectedGameweek,
		selectedTournamentIsOfficialH2H,
		selectedTournamentKey,
		standingsReady
	])

	useEffect(() => {
		if (rateLimitSeconds !== 0) return
		const pending = pendingReplacementRef.current
		if (!pending) return
		if (pending.options.expectedScope !== activeScopeRef.current) {
			pendingReplacementRef.current = null
			return
		}
		pendingReplacementRef.current = null
		void replaceFirstPage(
			pending.tournamentId,
			pending.eventId,
			pending.query,
			pending.options
		)
	}, [rateLimitSeconds, replaceFirstPage])

	useEffect(() => {
		if (!scopeKey || !selectedTournamentId || !standingsReady) return
		if (searchInput === queryState.search) return
		const timer = window.setTimeout(() => {
			const requestedInput = searchInput
			const next = { ...queryStateRef.current, search: requestedInput.trim() }
			void replaceFirstPage(
				Number(selectedTournamentId),
				selectedGameweek,
				next,
				{ preserve: entries.length > 0, expectedScope: scopeKey }
			).then(accepted => {
				if (
					!accepted &&
					shouldSyncLiveBoardSearchInput(requestedInput, searchInputRef.current)
				) {
					updateSearchInput(queryStateRef.current.search)
				}
			})
		}, 350)
		return () => window.clearTimeout(timer)
	}, [
		entries.length,
		queryState.search,
		replaceFirstPage,
		scopeKey,
		searchInput,
		selectedGameweek,
		selectedTournamentId,
		standingsReady,
		updateSearchInput
	])

	const applyFilters = useCallback(
		async (filters: LiveBoardFilterState): Promise<boolean> => {
			if (!scopeKey || !selectedTournamentId) return false
			return replaceFirstPage(
				Number(selectedTournamentId),
				selectedGameweek,
				{ ...queryStateRef.current, filters },
				{ preserve: entries.length > 0, expectedScope: scopeKey }
			)
		},
		[
			entries.length,
			replaceFirstPage,
			scopeKey,
			selectedGameweek,
			selectedTournamentId
		]
	)

	const applySort = useCallback(
		(column: TournamentSortColumn, direction: TournamentSortDirection) => {
			if (!scopeKey || !selectedTournamentId) return
			void replaceFirstPage(
				Number(selectedTournamentId),
				selectedGameweek,
				{
					...queryStateRef.current,
					sortColumn: column,
					sortDirection: direction
				},
				{ preserve: entries.length > 0, expectedScope: scopeKey }
			)
		},
		[
			entries.length,
			replaceFirstPage,
			scopeKey,
			selectedGameweek,
			selectedTournamentId
		]
	)

	const loadMore = useCallback(async () => {
		if (
			!scopeKey ||
			!selectedTournamentId ||
			!boardPage ||
			!canLoadMoreLiveBoard({
				hasMore: boardPage.hasMore,
				isLoadingMore,
				replacementPending: replaceInFlightRef.current,
				rateLimited: rateLimitSecondsRef.current > 0
			})
		) {
			return
		}
		const version = requestVersionRef.current
		setIsLoadingMore(true)
		try {
			const next = await fetchEntryLiveCompetitionBoard(
				Number(selectedTournamentId),
				buildVariables(
					Number(selectedTournamentId),
					selectedGameweek,
					queryStateRef.current,
					boardPage.page + 1,
					boardPage.boardRevision
				)
			)
			if (
				!isCurrentLiveBoardRequest(
					version,
					requestVersionRef.current,
					scopeKey,
					activeScopeRef.current
				)
			) {
				return
			}
			setEntries(current => {
				const byId = new Map(current.map(entry => [entry.id, entry]))
				for (const entry of pageRows(next)) byId.set(entry.id, entry)
				return Array.from(byId.values())
			})
			setBoardPage(next)
			setResultsError(
				next.partial
					? boardPartialMessage(next, {
							failed: t('calculationFailed', {
								count: next.failedEntryCount
							}),
							warming: t('coverageWarming'),
							unavailable: t('unavailableCalculation', {
								count: next.unavailableEntryCount || next.totalEntries
							})
						})
					: null
			)
		} catch (error) {
			if (
				!isCurrentLiveBoardRequest(
					version,
					requestVersionRef.current,
					scopeKey,
					activeScopeRef.current
				)
			) {
				return
			}
			if (
				error instanceof LiveBoardRequestError &&
				isLiveBoardRevisionGoneCode(error.code)
			) {
				void replaceFirstPage(
					Number(selectedTournamentId),
					selectedGameweek,
					queryStateRef.current,
					{ preserve: true, expectedScope: scopeKey }
				)
			} else {
				if (error instanceof LiveBoardRequestError && error.status === 429) {
					const cooldown = Math.max(1, error.retryAfterSeconds ?? 30)
					rateLimitSecondsRef.current = cooldown
					setRateLimitSeconds(cooldown)
				}
				setResultsError(t('refreshFailedRetained'))
			}
		} finally {
			setIsLoadingMore(false)
		}
	}, [
		boardPage,
		buildVariables,
		isLoadingMore,
		replaceFirstPage,
		scopeKey,
		selectedGameweek,
		selectedTournamentId,
		t
	])

	const refresh = useCallback((): Promise<boolean> => {
		if (!scopeKey || !selectedTournamentId) return Promise.resolve(false)
		if (refreshInFlightRef.current) return refreshInFlightRef.current
		const request = replaceFirstPage(
			Number(selectedTournamentId),
			selectedGameweek,
			queryStateRef.current,
			{ preserve: entries.length > 0, expectedScope: scopeKey }
		)
		refreshInFlightRef.current = request
		void request.finally(() => {
			if (refreshInFlightRef.current === request)
				refreshInFlightRef.current = null
		})
		return request
	}, [
		entries.length,
		replaceFirstPage,
		scopeKey,
		selectedGameweek,
		selectedTournamentId
	])
	const handleBoardRevisionGone = useCallback(async (): Promise<void> => {
		await refresh()
	}, [refresh])

	const autoRefresh = useCallback(async (): Promise<void> => {
		try {
			const probe = await executeQuery<LiveContextResponse>(
				GET_LIVE_CONTEXT,
				undefined,
				{ cache: 'no-store', timeoutMs: 2_000 }
			)
			const nextEvent = probe.liveContext?.anchorEventId
			if (nextEvent && nextEvent !== currentGameweek) {
				setCurrentGameweek(nextEvent)
				if (followsAnchorRef.current) {
					const nextSelection = resolveAnchoredGameweek({
						nextEvent,
						requestedGameweek: gameweekFromUrl,
						followsAnchor: true
					})
					followsAnchorRef.current = nextSelection.followsAnchor
					setSelectedGameweek(nextSelection.selectedGameweek)
				}
				return
			}
			const observedSnapshot = liveContextToSnapshot(probe.liveContext)
			const accepted = acceptedBoardFreshnessRef.current
			const boardPublicationChanged =
				!observedSnapshot ||
				!accepted ||
				accepted.eventId !== observedSnapshot.eventId ||
				(accepted.revision !== observedSnapshot.revision &&
					observedSnapshot.revision !== null) ||
				accepted.dataAvailability !== observedSnapshot.dataAvailability
			const managerScoreDue = Boolean(
				boardPage?.managerNextRefreshAt &&
				Date.parse(boardPage.managerNextRefreshAt) <= Date.now()
			)
			if (
				shouldAutoRefreshLiveBoardPage(boardPage?.page ?? null) &&
				(boardPublicationChanged || managerScoreDue)
			) {
				await refresh()
			}
		} catch {
			if (entries.length > 0) setResultsError(t('refreshFailedRetained'))
		}
	}, [
		boardPage?.page,
		boardPage?.managerNextRefreshAt,
		currentGameweek,
		entries.length,
		gameweekFromUrl,
		refresh,
		t
	])

	const managerStatus = useMemo(() => {
		if (!boardPage) return t('scoreConfirming')
		const authorityLabels = new Set(
			boardPage.rows
				.map(row =>
					liveManagerScoreAuthorityLabel(
						traceableOfficialManagerScore(row.score),
						{ projected: scoreT('scoreProjected'), final: scoreT('scoreFinal') }
					)
				)
				.filter((label): label is string => label !== null)
		)
		const authorityLabel =
			authorityLabels.size === 1 ? Array.from(authorityLabels)[0] : null
		if (showingLastGood) return t('showingLastGood')
		if (boardPage.failedEntryCount > 0)
			return t('calculationFailed', { count: boardPage.failedEntryCount })
		if (boardPage.unavailableEntryCount > 0)
			return t('unavailableCalculation', {
				count: boardPage.unavailableEntryCount
			})
		if (boardPage.deferredEntryCount > 0) return t('coverageWarming')
		if (
			boardPage.coverageState === 'WARMING' ||
			boardPage.coverageState === 'PARTIAL'
		)
			return t('coverageWarming')
		if (boardPage.managerDataAvailability === 'LAST_GOOD')
			return t('scoreOfficialDelayed')
		if (
			boardPage.managerDataAvailability === 'PARTIAL' ||
			(boardPage.officialCoverage > 0 && boardPage.officialCoverage < 1)
		)
			return t('scorePartiallyAvailable')
		if (
			boardPage.managerDataAvailability === 'UNAVAILABLE' ||
			boardPage.officialCoverage === 0
		)
			return t('scoreOfficialUnavailable')
		if (authorityLabels.size === 0) return t('scoreOfficialUnavailable')
		if (authorityLabels.size > 1) return t('scorePartiallyAvailable')
		return authorityLabel!
	}, [boardPage, scoreT, showingLastGood, t])
	const boardCoverageSummary = useMemo(() => {
		if (!boardPage) return null
		const parts = [
			t('computedCoverage', {
				computed: boardPage.computedEntries,
				total: boardPage.totalEntries
			})
		]
		if (boardPage.deferredEntryCount > 0)
			parts.push(
				t('deferredCalculation', { count: boardPage.deferredEntryCount })
			)
		if (boardPage.failedEntryCount > 0)
			parts.push(t('calculationFailed', { count: boardPage.failedEntryCount }))
		if (boardPage.unavailableEntryCount > 0)
			parts.push(
				t('unavailableCalculation', {
					count: boardPage.unavailableEntryCount
				})
			)
		if (boardPage.rankScope === 'FULL_FIELD') parts.push(t('fullFieldRank'))
		else parts.push(t('availableRowsRank'))
		return parts.join(' · ')
	}, [boardPage, t])

	const updatedAt = exactUpdatedAt(boardPage?.managerCheckedAt ?? null)
	const visibleEntries = useMemo(
		() => (contentScopeKey === scopeKey ? entries : []),
		[contentScopeKey, entries, scopeKey]
	)
	const hasContent = visibleEntries.length > 0
	const hasBoard = contentScopeKey === scopeKey && boardPage !== null
	const activeFilterCount =
		(queryState.filters.ownership ? 1 : 0) +
		queryState.filters.teamCountRules.length +
		queryState.filters.chips.length +
		queryState.filters.captainPlayerIds.length
	const autoRefreshEnabled = Boolean(
		isPageActive &&
		selectedTournament &&
		standingsReady &&
		selectedGameweek === currentGameweek &&
		hasBoard &&
		rateLimitSeconds === 0
	)
	const serverControl = useMemo(
		() =>
			boardPage
				? {
						sortColumn: queryState.sortColumn,
						sortDirection: queryState.sortDirection,
						onSortChange: applySort,
						hasMore: boardPage.hasMore,
						filteredEntries: boardPage.filteredEntries,
						isLoadingMore: isLoadingMore || isRefreshing || isLoadingInitial,
						onLoadMore: () => void loadMore(),
						playerRevision: boardPage.playerRevision,
						onRevisionGone: handleBoardRevisionGone
					}
				: undefined,
		[
			applySort,
			boardPage,
			handleBoardRevisionGone,
			isLoadingInitial,
			isLoadingMore,
			isRefreshing,
			loadMore,
			queryState
		]
	)
	const shareUrl = useMemo(() => {
		const params = new URLSearchParams()
		if (selectedTournament?.id)
			params.set('tournamentId', selectedTournament.id)
		if (selectedGameweek > 0) params.set('gw', String(selectedGameweek))
		const query = params.toString()
		return `https://letletme.top/live/competitions${query ? `?${query}` : ''}`
	}, [selectedGameweek, selectedTournament?.id])
	const shareText = useMemo(() => {
		const lines = [
			`# ${selectedTournament?.name ?? t('liveStandings')} · GW${selectedGameweek}`,
			`${t('averageScore')}: ${boardPage?.averageEventPoints == null ? '—' : formatLiveAveragePoints(boardPage.averageEventPoints)} · ${t('highestScore')}: ${boardPage?.highestEventPoints ?? '—'}`,
			'',
			t('standings')
		]
		const entriesInRankOrder = (
			tableEntriesForShare.length > 0 ? tableEntriesForShare : filteredEntries
		)
			.slice()
			.sort((left, right) => {
				const leftRank =
					Number.isFinite(left.rank) && left.rank > 0
						? left.rank
						: Number.POSITIVE_INFINITY
				const rightRank =
					Number.isFinite(right.rank) && right.rank > 0
						? right.rank
						: Number.POSITIVE_INFINITY
				return leftRank - rightRank || left.id.localeCompare(right.id)
			})
		for (const entry of entriesInRankOrder.slice(0, 20)) {
			lines.push(
				`- ${entry.rank || '—'} ${entry.teamName} · ${entry.gwPoints ?? '—'} GW · ${entry.totalPoints ?? '—'} total`
			)
		lines.push('', shareUrl)
		return lines.join('\n')
	}, [
		boardPage?.averageEventPoints,
		boardPage?.highestEventPoints,
		selectedGameweek,
		selectedTournament?.name,
		t,
		tableEntriesForShare,
		visibleEntries,
		shareUrl
	])

	if (entryId <= 0) {
		return (
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader title={t('liveStandings')} />
					<Card className="p-6 text-sm text-muted-foreground shadow-sm">
						{t('signInPrompt')}{' '}
						<Link
							href="/auth/login?next=/live/competitions"
							className="text-primary-ink underline"
						>
							{t('signIn')}
						</Link>
					</Card>
				</div>
			</PageShell>
		)
	}

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<RouteReadyMarker
					name="LIVE_COMPETITION_BOARD_READY"
					ready={Boolean(
						selectedTournament &&
						selectionRestoreComplete &&
						standingsReady &&
						!isLoadingInitial &&
						contentScopeKey === scopeKey &&
						hasBoard
					)}
					audienceHint="session-hint"
					goodMs={1500}
					poorMs={2500}
					readyKey={scopeKey ?? 'none'}
				/>
				<StatsPageHeader
					title={t('liveStandings')}
					badge={
						<div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
							{lastUpdatedAt && lastUpdatedLabel ? (
								<time
									dateTime={lastUpdatedAt}
									className="whitespace-nowrap text-xs text-muted-foreground"
									role="status"
								>
									{t('lastUpdated', { time: lastUpdatedLabel })}
								</time>
							) : null}
							<Button
								size="sm"
								variant="outline"
								onClick={() => void refreshTournamentResults()}
								disabled={
									!selectedTournament ||
									!standingsReady ||
									isLoadingResults ||
									selectedGameweek === undefined
								}
							>
								<RefreshCw
									data-icon="inline-start"
									className={isLoadingResults ? 'animate-spin' : undefined}
								/>
								{t('refresh')}
							</Button>
							<LiveAutoRefreshCountdown
								enabled={autoRefreshEnabled}
								onRefresh={autoRefreshTournamentResults}
								nextRefreshAt={snapshot?.nextRefreshAt ?? managerNextRefreshAt}
								renderLabel={seconds => t('nextRefresh', { seconds })}
								showLabel={false}
							/>
							{selectedGameweek ? (
								<GameweekBadge gameweek={selectedGameweek} />
							) : null}
						</div>
					}
				/>

				{listError ? (
					<Card className="mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
						{listError}
					</Card>
				) : null}

				{unknownTournamentFromUrl ? (
					<Card className="mb-6 space-y-3 p-4 text-sm">
						<p className="text-muted-foreground">{t('competitionNotInList')}</p>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => router.replace('/live/competitions')}
						>
							{t('clear')}
						</Button>
					</Card>
				) : null}

				{tournaments.length > 0 ? (
					<TournamentSelector
						tournaments={tournaments}
						currentTournamentId={
							selectedTournament?.id ??
							(unknownTournamentFromUrl ? '__unknown__' : '')
						}
						onTournamentChange={id => {
							if (selectedTournament?.id === id) return
							setRestoredTournamentId(id)
							cachedTournamentIdRef.current = id
							try {
								writeLiveTournamentSelection(window.localStorage, entryId, id)
							} catch {
								// URL navigation remains authoritative.
							}
							router.replace(`/live/competitions?tournamentId=${id}`)
						}}
					/>
				) : null}

				<Card className="mb-6 p-4">
					<GameweekSelector
						onGameweekChange={gameweek => {
							followsAnchorRef.current = false
							setSelectedGameweek(gameweek)
						}}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={
							isLoadingInitial || Boolean(selectedTournament && !standingsReady)
						}
					/>
				</Card>

				{isLoadingTournaments ? (
					<Card className="p-6 text-sm text-muted-foreground">
						{t('loadingCompetitions')}
					</Card>
				) : null}
				{!isLoadingTournaments &&
				!selectedTournament &&
				!unknownTournamentFromUrl ? (
					<Card className="p-6 text-sm text-muted-foreground">
						{t('noCompetitions')}
					</Card>
				) : null}
				{selectedTournament && !standingsReady ? (
					<Card className="p-8 text-center">
						<p className="font-display text-lg font-semibold">
							{selectedTournament.setupStatus === 'FAILED'
								? lifecycleT('memberFailure')
								: lifecycleT('standingsPreparing')}
						</p>
					</Card>
				) : null}

		{selectedTournament && standingsReady && (
					<div>
						{!selectedTournamentIsOfficialH2H ? (
							<TournamentHeader
								name={selectedTournament.name}
								averagePoints={selectedStats.averagePoints}
								highestPoints={selectedStats.highestPoints}
								totalEntries={
									selectedStats.totalEntries || selectedTournament.totalEntries
								}
								isLoading={isLoadingResults}
							/>
						) : null}

						{selectedTournamentIsOfficialH2H ? (
							<OfficialH2HCompetitionView
								key={`${selectedTournament.id}:${displayGameweek}`}
								activeEventId={currentGameweek}
								eventId={displayGameweek}
								initialSnapshot={null}
								tournamentId={Number(selectedTournament.id)}
								viewerEntryId={entryId}
							/>
						) : isLoadingResults ? (
							<div
								className="space-y-4"
								aria-busy="true"
							>
								<Card className="p-6 text-sm text-muted-foreground">
									{t('loadingStandings')}
								</Card>
								<div className="overflow-hidden rounded-xl border border-border/80 bg-card">
									<div className="divide-y divide-border/50">
										{Array.from({ length: 8 }, (_, i) => (
											<div
												key={i}
												className="flex items-center gap-3 px-4 py-3"
											>
												<div className="h-4 w-6 animate-pulse rounded bg-muted" />
												<div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-muted" />
												<div className="h-4 w-12 animate-pulse rounded bg-muted" />
												<div className="h-4 w-10 animate-pulse rounded bg-muted" />
											</div>
										))}
									</div>
								</div>
							</div>
						) : (
							<div ref={shareRef}>
								<SearchHeader
									showFilters={false}
									searchQuery={searchInput}
									setSearchQuery={value =>
										updateSearchInput(value.slice(0, 100))
									}
								/>
								<div className="mb-3 flex justify-end">
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => setShowAdvancedFilters(open => !open)}
									>
										<Filter className="size-4" />
										{filtersT('advancedFilters')}
										{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
									</Button>
								</div>
								{showAdvancedFilters ? (
									<LiveCompetitionBoardFilters
										tournamentId={Number(selectedTournament.id)}
										eventId={selectedGameweek}
										playerRevision={boardPage.playerRevision}
										value={queryState.filters}
										disabled={isRefreshing || rateLimitSeconds > 0}
										onApply={applyFilters}
										onRevisionGone={handleBoardRevisionGone}
									/>
								) : null}
								<TournamentTable
									key={`table-${scopeKey}`}
									entries={visibleEntries}
									searchQuery=""
									tournamentId={selectedTournament.id}
									gameweek={selectedGameweek}
									viewerEntryId={entryId}
									pinnedViewerEntry={
										boardPage.viewerRow
											? boardRowToTournamentEntry(boardPage.viewerRow)
											: undefined
									}
									onVisibleEntriesChange={setTableEntriesForShare}
									shareText={shareText}
									shareImageRef={shareRef}
									shareTitle={selectedTournament.name}
									serverControl={serverControl}
								/>
							</div>
						)}
					</div>
				) : null}
			</div>
		</PageShell>
	)
}
