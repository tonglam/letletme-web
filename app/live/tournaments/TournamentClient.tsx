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
	clearOtherLiveBoardLastGood,
	fetchEntryLiveCompetitionBoard,
	liveBoardLastGoodKey,
	readLiveBoardLastGood,
	writeLiveBoardLastGood,
	type LiveBoardFilterState
} from '@/lib/tournament/live-board'
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
	const followsAnchorRef = useRef(gameweekFromUrl === null)
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
	const requestVersionRef = useRef(0)
	const activeScopeRef = useRef(scopeKey)
	const refreshInFlightRef = useRef<Promise<boolean> | null>(null)
	const shareRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		queryStateRef.current = queryState
	}, [queryState])

	useEffect(() => {
		activeScopeRef.current = scopeKey
	}, [scopeKey])

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
				if (!cancelled)
					setTournaments(
						data.entryTournaments.map(mapEntryTournamentToLiveTournament)
					)
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
		selectedTournamentSetupStatus
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
			replaceAbortRef.current?.abort()
			const controller = new AbortController()
			replaceAbortRef.current = controller
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
					version !== requestVersionRef.current ||
					activeScopeRef.current !== options.expectedScope
				) {
					return false
				}
				setBoardPage(page)
				setEntries(pageRows(page))
				setContentScopeKey(options.expectedScope)
				setQueryState(query)
				setSearchInput(query.search)
				setResultsError(
					page.partial
						? t('partialResults', {
								failed: page.unavailableEntryIds.length,
								total: page.totalEntries
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
				if (version === requestVersionRef.current) {
					setIsLoadingInitial(false)
					setIsRefreshing(false)
				}
			}
		},
		[buildVariables, entryId, season, sessionCacheKey, t]
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
		setQueryState(nextQuery)
		setSearchInput('')
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
					t('partialResults', {
						failed: initial.page.unavailableEntryIds.length,
						total: initial.page.totalEntries
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
		t
	])

	useEffect(() => {
		if (!scopeKey || !selectedTournamentId || !standingsReady) return
		if (searchInput === queryState.search) return
		const timer = window.setTimeout(() => {
			const next = { ...queryStateRef.current, search: searchInput.trim() }
			void replaceFirstPage(
				Number(selectedTournamentId),
				selectedGameweek,
				next,
				{ preserve: entries.length > 0, expectedScope: scopeKey }
			).then(accepted => {
				if (!accepted) setSearchInput(queryStateRef.current.search)
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
		standingsReady
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
			!boardPage?.hasMore ||
			isLoadingMore ||
			rateLimitSecondsRef.current > 0
		) {
			return
		}
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
			if (activeScopeRef.current !== scopeKey) return
			setEntries(current => {
				const byId = new Map(current.map(entry => [entry.id, entry]))
				for (const entry of pageRows(next)) byId.set(entry.id, entry)
				return Array.from(byId.values())
			})
			setBoardPage(next)
			setResultsError(
				next.partial
					? t('partialResults', {
							failed: next.unavailableEntryIds.length,
							total: next.totalEntries
						})
					: null
			)
		} catch (error) {
			if (
				error instanceof LiveBoardRequestError &&
				error.code === 'LIVE_BOARD_REVISION_GONE'
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
				if (followsAnchorRef.current) setSelectedGameweek(nextEvent)
				return
			}
			await refresh()
		} catch {
			if (entries.length > 0) setResultsError(t('refreshFailedRetained'))
		}
	}, [currentGameweek, entries.length, refresh, t])

	const managerStatus = useMemo(() => {
		if (!boardPage) return t('scoreConfirming')
		if (showingLastGood || boardPage.managerDataAvailability === 'LAST_GOOD')
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

	const updatedAt = exactUpdatedAt(boardPage?.managerCheckedAt ?? null)
	const visibleEntries = useMemo(
		() => (contentScopeKey === scopeKey ? entries : []),
		[contentScopeKey, entries, scopeKey]
	)
	const hasContent = visibleEntries.length > 0
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
		hasContent &&
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
						isLoadingMore,
						onLoadMore: () => void loadMore(),
						playerRevision: boardPage.playerRevision
					}
				: undefined,
		[applySort, boardPage, isLoadingMore, loadMore, queryState]
	)
	const shareText = useMemo(() => {
		const lines = [
			`# ${selectedTournament?.name ?? t('liveStandings')} · GW${selectedGameweek}`,
			`${t('averageScore')}: ${boardPage?.averageEventPoints ?? '—'} · ${t('highestScore')}: ${boardPage?.highestEventPoints ?? '—'}`,
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
						/>

						{isLoadingInitial && !hasContent ? (
							<Card
								className="p-6 text-sm text-muted-foreground"
								aria-busy="true"
							>
								{t('loadingStandings')}
							</Card>
						) : hasContent && boardPage ? (
							<>
								<SearchHeader
									showFilters={false}
									searchQuery={searchInput}
									setSearchQuery={value => setSearchInput(value.slice(0, 100))}
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
