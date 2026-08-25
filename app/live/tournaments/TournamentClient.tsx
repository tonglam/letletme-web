'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { LiveCompetitionBoardFilters } from '@/components/tournament/LiveCompetitionBoardFilters'
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
	type EntryLiveCompetitionBoardPage,
	type EntryLiveCompetitionBoardSort,
	type EntryLiveCompetitionBoardVariables,
	type EntryTournamentsResponse
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
import { formatLiveAveragePoints } from '@/lib/tournament/liveEntries'
import {
	areTournamentStandingsReady,
	isTournamentSetupPollingPending
} from '@/lib/tournament/lifecycle'
import {
	readLiveTournamentSelection,
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
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type BoardQueryState = {
	search: string
	filters: LiveBoardFilterState
	sortColumn: TournamentSortColumn
	sortDirection: TournamentSortDirection
}

const defaultQueryState = (): BoardQueryState => ({
	search: '',
	filters: {
		chips: [],
		captainPlayerIds: [],
		ownership: null,
		teamCountRules: []
	},
	sortColumn: 'gwPoints',
	sortDirection: 'desc'
})

const filtersAreEmpty = (filters: LiveBoardFilterState): boolean =>
	filters.chips.length === 0 &&
	filters.captainPlayerIds.length === 0 &&
	filters.ownership === null &&
	filters.teamCountRules.length === 0

const queryIsDefault = (query: BoardQueryState): boolean =>
	query.search.length === 0 &&
	filtersAreEmpty(query.filters) &&
	query.sortColumn === 'gwPoints' &&
	query.sortDirection === 'desc'

const tableSortToBoardSort = (
	column: TournamentSortColumn
): EntryLiveCompetitionBoardSort => {
	switch (column) {
		case 'totalPoints':
			return 'TOTAL_POINTS'
		case 'overallRank':
			return 'OVERALL_RANK'
		case 'teamValue':
			return 'TEAM_VALUE'
		case 'eventCost':
			return 'TRANSFER_COST'
		case 'standings':
		case 'rank':
			return 'RANK'
		case 'gwPoints':
		default:
			return 'EVENT_POINTS'
	}
}

const pageRows = (
	page: EntryLiveCompetitionBoardPage | null
): TournamentEntry[] => (page ? page.rows.map(boardRowToTournamentEntry) : [])

const boardPartialMessage = (
	page: EntryLiveCompetitionBoardPage,
	messages: {
		failed: string
		warming: string
		unavailable: string
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
	const [isLoadingTournaments, setIsLoadingTournaments] = useState(
		entryId > 0 && initialTournaments.length === 0
	)
	const [listError, setListError] = useState<string | null>(null)
	const [currentGameweek, setCurrentGameweek] = useState(initialEventId)
	const [selectedGameweek, setSelectedGameweek] = useState(
		gameweekFromUrl && gameweekFromUrl <= initialEventId
			? gameweekFromUrl
			: initialEventId
	)
	const followsAnchorRef = useRef(
		gameweekFromUrl === null || gameweekFromUrl > initialEventId
	)
	const lastUrlGameweekRef = useRef(gameweekFromUrl)
	const requestedTournamentId =
		tournamentIdFromUrl ?? restoredTournamentId ?? initialSelectedTournamentId
	const selectedTournament = useMemo(() => {
		if (tournaments.length === 0) return null
		if (requestedTournamentId)
			return (
				tournaments.find(
					tournament => tournament.id === requestedTournamentId
				) ?? null
			)
		return tournaments[0] ?? null
	}, [requestedTournamentId, tournaments])
	const selectedTournamentId = selectedTournament?.id ?? null
	const selectedTournamentSetupStatus = selectedTournament?.setupStatus ?? null
	const selectedTournamentInsightsReadyAt =
		selectedTournament?.insightsReadyAt ?? null
	const selectedTournamentSetupRepairExhausted =
		selectedTournament?.setupRepairExhausted ?? false
	const standingsReady = selectedTournament
		? areTournamentStandingsReady(selectedTournament)
		: false
	const unknownTournamentFromUrl = Boolean(
		tournamentIdFromUrl &&
		tournaments.length > 0 &&
		!tournaments.some(tournament => tournament.id === tournamentIdFromUrl)
	)
	const scopeKey = selectedTournamentId
		? `${selectedTournamentId}:${selectedGameweek}`
		: null

	const initialScopeKey =
		initialBoardPage && initialSelectedTournamentId
			? `${initialSelectedTournamentId}:${initialBoardPage.eventId}`
			: null
	const initialSeedRef = useRef(
		initialScopeKey
			? {
					key: initialScopeKey,
					page: initialBoardPage,
					loaded: initialResultsLoaded
				}
			: null
	)
	const [contentScopeKey, setContentScopeKey] = useState<string | null>(
		initialScopeKey
	)
	const [boardPage, setBoardPage] = useState(initialBoardPage)
	const [entries, setEntries] = useState<TournamentEntry[]>(() =>
		pageRows(initialBoardPage)
	)
	const [queryState, setQueryState] =
		useState<BoardQueryState>(defaultQueryState)
	const queryStateRef = useRef(queryState)
	const [searchInput, setSearchInput] = useState('')
	const searchInputRef = useRef(searchInput)
	const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
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
		if (tournamentIdFromUrl) {
			if (
				tournaments.some(tournament => tournament.id === tournamentIdFromUrl)
			) {
				setRestoredTournamentId(tournamentIdFromUrl)
				writeLiveTournamentSelection(storage, entryId, tournamentIdFromUrl)
			}
			setSelectionRestoreComplete(true)
			return
		}
		const stored = readLiveTournamentSelection(storage, entryId)
		const next =
			stored && tournaments.some(tournament => tournament.id === stored)
				? stored
				: initialSelectedTournamentId &&
					  tournaments.some(
							tournament => tournament.id === initialSelectedTournamentId
					  )
					? initialSelectedTournamentId
					: tournaments[0]?.id
		if (next) {
			setRestoredTournamentId(next)
			writeLiveTournamentSelection(storage, entryId, next)
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
		gameweekFromUrl,
		router,
		selectionRestoreComplete,
		tournamentIdFromUrl,
		tournaments
	])

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
			if (rateLimitSecondsRef.current > 0) return false
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
		if (
			!scopeKey ||
			!selectedTournamentId ||
			!standingsReady ||
			!selectionRestoreComplete
		) {
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
		selectedTournamentId,
		selectionRestoreComplete,
		sessionCacheKey,
		standingsReady,
		t,
		updateSearchInput
	])

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
		if (!scopeKey || !selectedTournamentId || rateLimitSecondsRef.current > 0)
			return Promise.resolve(false)
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
			if (shouldAutoRefreshLiveBoardPage(boardPage?.page ?? null)) {
				await refresh()
			}
		} catch {
			if (entries.length > 0) setResultsError(t('refreshFailedRetained'))
		}
	}, [
		boardPage?.page,
		currentGameweek,
		entries.length,
		gameweekFromUrl,
		refresh,
		t
	])

	const managerStatus = useMemo(() => {
		if (!boardPage) return t('scoreConfirming')
		if (showingLastGood) return t('showingLastGood')
		if (boardPage.failedEntryCount > 0)
			return t('calculationFailed', { count: boardPage.failedEntryCount })
		if (boardPage.deferredEntryCount > 0) return t('coverageWarming')
		if (boardPage.unavailableEntryCount > 0)
			return t('unavailableCalculation', {
				count: boardPage.unavailableEntryCount
			})
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
		return t('scoreOfficialLive')
	}, [boardPage, showingLastGood, t])
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
						playerRevision: boardPage.playerRevision
					}
				: undefined,
		[
			applySort,
			boardPage,
			isLoadingInitial,
			isLoadingMore,
			isRefreshing,
			loadMore,
			queryState
		]
	)
	const shareText = useMemo(() => {
		const lines = [
			`# ${selectedTournament?.name ?? t('liveStandings')} · GW${selectedGameweek}`,
			`${t('averageScore')}: ${boardPage?.averageEventPoints == null ? '—' : formatLiveAveragePoints(boardPage.averageEventPoints)} · ${t('highestScore')}: ${boardPage?.highestEventPoints ?? '—'}`,
			'',
			t('standings')
		]
		const shareEntries =
			tableEntriesForShare.length > 0
				? tableEntriesForShare
				: visibleEntries.slice(0, 20)
		for (const entry of shareEntries.slice(0, 20))
			lines.push(
				`- ${entry.rank || '—'} ${entry.teamName} · ${entry.gwPoints ?? '—'} GW · ${entry.totalPoints ?? '—'} total`
			)
		lines.push('', 'https://letletme.top/live/competitions')
		return lines.join('\n')
	}, [
		boardPage?.averageEventPoints,
		boardPage?.highestEventPoints,
		selectedGameweek,
		selectedTournament?.name,
		t,
		tableEntriesForShare,
		visibleEntries
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
						hasContent
					)}
					audienceHint="session-hint"
					goodMs={1500}
					poorMs={2500}
					readyKey={scopeKey ?? 'none'}
				/>
				<StatsPageHeader
					title={t('liveStandings')}
					badge={<GameweekBadge gameweek={selectedGameweek} />}
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
					<div className="mt-2 flex flex-wrap items-center justify-end gap-2">
						<LiveAutoRefreshCountdown
							enabled={autoRefreshEnabled}
							onRefresh={autoRefresh}
							nextRefreshAt={boardPage?.managerNextRefreshAt}
							renderLabel={seconds => t('nextRefresh', { seconds })}
						/>
						<Button
							size="sm"
							variant="outline"
							onClick={() => void refresh()}
							disabled={
								!selectedTournament ||
								!standingsReady ||
								isRefreshing ||
								rateLimitSeconds > 0
							}
						>
							<RefreshCw
								className={isRefreshing ? 'animate-spin' : undefined}
							/>
							{rateLimitSeconds > 0
								? `${t('refresh')} (${rateLimitSeconds}s)`
								: t('refresh')}
						</Button>
					</div>
					<p className="mt-2 text-right text-xs text-muted-foreground">
						{managerStatus}
						{updatedAt ? ` · ${t('lastUpdated', { time: updatedAt })}` : ''}
					</p>
					{boardCoverageSummary ? (
						<p className="mt-1 text-right text-xs text-muted-foreground">
							{boardCoverageSummary}
						</p>
					) : null}
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

				{resultsError ? (
					<Card
						className={
							hasContent
								? 'mb-6 border-warning/30 bg-warning/5 p-3 text-sm text-foreground'
								: 'mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive'
						}
					>
						<div className="flex flex-wrap items-center justify-between gap-2">
							<span>{resultsError}</span>
							{!hasContent && selectedTournament ? (
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={() => void refresh()}
									disabled={rateLimitSeconds > 0}
								>
									{t('errorCtaRetry')}
								</Button>
							) : null}
						</div>
					</Card>
				) : null}

				{selectedTournament && standingsReady ? (
					<div ref={shareRef}>
						<TournamentHeader
							name={selectedTournament.name}
							averagePoints={boardPage?.averageEventPoints ?? 0}
							highestPoints={boardPage?.highestEventPoints ?? 0}
							totalEntries={
								boardPage?.totalEntries ?? selectedTournament.totalEntries
							}
							isLoading={isLoadingInitial && !hasContent}
							scoresAvailable={
								typeof boardPage?.averageEventPoints === 'number' &&
								typeof boardPage?.highestEventPoints === 'number'
							}
						/>

						{isLoadingInitial && !hasContent ? (
							<Card
								className="p-6 text-sm text-muted-foreground"
								aria-busy="true"
							>
								{t('loadingStandings')}
							</Card>
						) : hasBoard && boardPage ? (
							<>
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
							</>
						) : null}
					</div>
				) : null}
			</div>
		</PageShell>
	)
}
