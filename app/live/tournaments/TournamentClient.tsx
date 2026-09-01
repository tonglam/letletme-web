'use client'

import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { LiveCompetitionBoardFilters } from '@/components/tournament/LiveCompetitionBoardFilters'
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
	GET_CURRENT_AND_NEXT_EVENTS,
	type EventsResponse
} from '@/lib/graphql/operations/events'
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
	canStartLiveBoardRefresh,
	fetchEntryLiveCompetitionBoard,
	fetchLeagueLiveHead,
	isCurrentLiveBoardRequest,
	isCompleteLiveBoardPage,
	isLiveBoardRevisionGoneCode,
	liveBoardPublicationChanged,
	readLiveBoardLastGood,
	resolveAnchoredGameweek,
	resolveUrlGameweekSelection,
	shouldAutoRefreshLiveBoardPage,
	shouldSyncLiveBoardSearchInput,
	writeLiveBoardLastGood,
	type LiveBoardFilterState,
	type LiveBoardFreshnessMarker
} from '@/lib/tournament/live-board'
import { formatLiveAveragePoints } from '@/lib/tournament/live-format'
import {
	areTournamentStandingsReady,
	isTournamentSetupPollingPending
} from '@/lib/tournament/lifecycle'
import {
	readLiveTournamentSelection,
	resolveLiveTournamentSelection,
	writeLiveTournamentSelection
} from '@/lib/tournament/live-selection'
import {
	isOfficialH2HTournament,
	mapEntryTournamentToLiveTournament
} from '@/lib/tournament/liveTournament'
import type {
	TournamentSortColumn,
	TournamentSortDirection
} from '@/lib/tournament/table-sort'
import type { Tournament, TournamentEntry } from '@/types/tournament'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check, Filter, RefreshCw } from 'lucide-react'
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
): TournamentEntry[] =>
	page
		? page.rows
				.filter(
					(
						row
					): row is typeof row & {
						availability: 'READY'
						score: NonNullable<typeof row.score>
					} => row.availability === 'READY' && row.score !== null
				)
				.map(boardRowToTournamentEntry)
		: []

const boardFreshnessMarker = (
	page: EntryLiveCompetitionBoardPage | null
): LiveBoardFreshnessMarker | null =>
	page?.head.publication?.revisions.scoreCore
		? {
				eventId: page.head.eventId,
				contentRevision: page.head.contentRevision
			}
		: null

type PendingBoardReplacement = {
	tournamentId: number
	eventId: number
	query: BoardQueryState
	options: { preserve: boolean; expectedScope: string }
	resolve: (accepted: boolean) => void
}

const boardPartialMessage = (
	page: EntryLiveCompetitionBoardPage,
	messages: {
		failed: string
		warming: string
		unavailable: string
	}
): string | null => {
	if (page.head.availability === 'PENDING') {
		return messages.warming
	}
	if (
		page.head.availability === 'MISSING' ||
		page.head.availability === 'ERROR' ||
		page.head.delivery.state === 'UNAVAILABLE'
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
	initialCreated?: boolean
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
	initialCreated = false,
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
	const initialTournamentForGameweek =
		initialTournaments.find(
			tournament => tournament.id === initialSelectedTournamentId
		) ??
		initialTournaments[0] ??
		null
	const initialAllowsFutureGameweek = isOfficialH2HTournament(
		initialTournamentForGameweek
	)
	const initialGameweekSelection =
		gameweekFromUrl !== null &&
		(gameweekFromUrl <= initialEventId || initialAllowsFutureGameweek)
			? gameweekFromUrl
			: initialEventId
	const initialFollowsGameweekAnchor =
		gameweekFromUrl === null ||
		(gameweekFromUrl > initialEventId && !initialAllowsFutureGameweek)

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
		initialGameweekSelection
	)
	const [followsGameweekAnchor, setFollowsGameweekAnchor] = useState(
		initialFollowsGameweekAnchor
	)
	const followsAnchorRef = useRef(initialFollowsGameweekAnchor)
	const lastUrlGameweekRef = useRef({
		requestedGameweek: gameweekFromUrl,
		preserveFutureGameweek: initialAllowsFutureGameweek
	})
	const selectionRestoreEntryIdRef = useRef<number | null>(null)
	const cachedTournamentIdRef = useRef<string | null>(null)
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
	const selectedTournamentIsOfficialH2H =
		isOfficialH2HTournament(selectedTournament)
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
			? `${initialSelectedTournamentId}:${initialBoardPage.head.eventId}`
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
	const desiredQueryRef = useRef(queryState)
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
	const pendingReplacementRef = useRef<PendingBoardReplacement | null>(null)
	const acceptedBoardFreshnessRef = useRef<LiveBoardFreshnessMarker | null>(
		boardFreshnessMarker(initialBoardPage)
	)
	const shareRef = useRef<HTMLDivElement | null>(null)
	const queuePendingReplacement = useCallback(
		(
			tournamentId: number,
			eventId: number,
			query: BoardQueryState,
			options: { preserve: boolean; expectedScope: string }
		): Promise<boolean> =>
			new Promise(resolve => {
				const previous = pendingReplacementRef.current
				if (previous) previous.resolve(previous.query.search === query.search)
				pendingReplacementRef.current = {
					tournamentId,
					eventId,
					query,
					options,
					resolve
				}
			}),
		[]
	)
	const updateSearchInput = useCallback((value: string): void => {
		searchInputRef.current = value
		desiredQueryRef.current = {
			...desiredQueryRef.current,
			search: value.trim()
		}
		setSearchInput(value)
	}, [])

	useEffect(() => {
		queryStateRef.current = queryState
	}, [queryState])

	useEffect(() => {
		activeScopeRef.current = scopeKey
	}, [scopeKey])

	useEffect(() => {
		const preserveFutureGameweek = selectedTournamentIsOfficialH2H
		if (
			lastUrlGameweekRef.current.requestedGameweek === gameweekFromUrl &&
			lastUrlGameweekRef.current.preserveFutureGameweek ===
				preserveFutureGameweek
		)
			return
		lastUrlGameweekRef.current = {
			requestedGameweek: gameweekFromUrl,
			preserveFutureGameweek
		}
		const next = resolveUrlGameweekSelection({
			currentEvent: currentGameweek,
			requestedGameweek: gameweekFromUrl,
			preserveFutureGameweek
		})
		followsAnchorRef.current = next.followsAnchor
		setFollowsGameweekAnchor(next.followsAnchor)
		setSelectedGameweek(next.selectedGameweek)
	}, [currentGameweek, gameweekFromUrl, selectedTournamentIsOfficialH2H])

	useEffect(() => {
		if (!followsGameweekAnchor) return
		setSelectedGameweek(currentGameweek)
	}, [currentGameweek, followsGameweekAnchor])

	useEffect(() => {
		if (
			!isPageActive ||
			!selectedTournamentId ||
			!standingsReady ||
			!followsGameweekAnchor
		)
			return
		let cancelled = false
		let timer: number | null = null
		const poll = async () => {
			try {
				const data = await executeQuery<EventsResponse>(
					GET_CURRENT_AND_NEXT_EVENTS,
					undefined,
					{ cache: 'no-store', timeoutMs: 5_000 }
				)
				const nextCurrentEvent = data.current[0]?.id
				if (
					!cancelled &&
					typeof nextCurrentEvent === 'number' &&
					Number.isSafeInteger(nextCurrentEvent) &&
					nextCurrentEvent >= 1 &&
					nextCurrentEvent <= 38 &&
					followsAnchorRef.current
				) {
					setCurrentGameweek(nextCurrentEvent)
					setSelectedGameweek(nextCurrentEvent)
				}
			} catch {
				// Existing publication-backed content remains usable while the
				// lifecycle anchor is temporarily unavailable.
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 30_000)
			}
		}
		void poll()
		return () => {
			cancelled = true
			if (timer !== null) window.clearTimeout(timer)
		}
	}, [
		followsGameweekAnchor,
		isPageActive,
		selectedTournamentId,
		standingsReady
	])

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
			const resolution = resolveLiveTournamentSelection({
				availableIds: tournaments.map(tournament => tournament.id),
				urlTournamentId: tournamentIdFromUrl,
				cachedTournamentId: cachedTournamentIdRef.current,
				initialTournamentId: initialSelectedTournamentId
			})
			if (resolution.source === 'unknown-url') {
				setSelectionRestoreComplete(true)
				return
			}
			if (resolution.selectedId) {
				setRestoredTournamentId(resolution.selectedId)
				cachedTournamentIdRef.current = resolution.selectedId
				writeLiveTournamentSelection(storage, entryId, resolution.selectedId)
			}
			setSelectionRestoreComplete(true)
			return
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
			cachedTournamentId: cachedTournamentIdRef.current,
			initialTournamentId: initialSelectedTournamentId
		})
		if (resolution.selectedId) {
			setRestoredTournamentId(resolution.selectedId)
			if (!resolution.cachedId) {
				cachedTournamentIdRef.current = resolution.selectedId
				writeLiveTournamentSelection(storage, entryId, resolution.selectedId)
			}
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
			after: string | null = null
		): EntryLiveCompetitionBoardVariables => ({
			entryId,
			tournamentId,
			eventId,
			input: {
				first: 20,
				after,
				sort: tableSortToBoardSort(query.sortColumn),
				direction: query.sortDirection === 'asc' ? 'ASC' : 'DESC',
				search: query.search || null,
				chips: query.filters.chips,
				captainPlayerIds: query.filters.captainPlayerIds,
				ownership: query.filters.ownership,
				teamCountRules: query.filters.teamCountRules
			}
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
			// A replacement invalidates every page after the first one. Clear the
			// pagination indicator even when the old load-more request finishes
			// after this replacement has advanced requestVersionRef.
			setIsLoadingMore(false)
			if (rateLimitSecondsRef.current > 0) {
				return queuePendingReplacement(tournamentId, eventId, query, options)
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
				if (!isCompleteLiveBoardPage(page) && options.preserve) {
					setResultsError(
						boardPartialMessage(page, {
							failed: t('calculationFailed'),
							warming: t('coverageWarming'),
							unavailable: t('unavailableCalculation', {
								count: page.totalEntries
							})
						}) ?? t('refreshFailedRetained')
					)
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
					boardPartialMessage(page, {
						failed: t('calculationFailed'),
						warming: t('coverageWarming'),
						unavailable: t('unavailableCalculation', {
							count: page.totalEntries
						})
					})
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
				let queuedReplacement: Promise<boolean> | null = null
				if (error instanceof LiveBoardRequestError && error.status === 429) {
					const cooldown = Math.max(1, error.retryAfterSeconds ?? 30)
					queuedReplacement = queuePendingReplacement(
						tournamentId,
						eventId,
						query,
						options
					)
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
				return queuedReplacement ?? false
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
		[
			buildVariables,
			entryId,
			queuePendingReplacement,
			season,
			sessionCacheKey,
			t,
			updateSearchInput
		]
	)

	useEffect(() => {
		if (!selectionRestoreComplete) return
		if (
			scopeKey &&
			selectedTournamentId &&
			standingsReady &&
			!selectedTournamentIsOfficialH2H
		)
			return
		replaceAbortRef.current?.abort()
		replaceAbortRef.current = null
		replaceInFlightRef.current = false
		requestVersionRef.current += 1
		refreshInFlightRef.current = null
		const pendingReplacement = pendingReplacementRef.current
		pendingReplacementRef.current = null
		pendingReplacement?.resolve(false)
		acceptedBoardFreshnessRef.current = null
		const resetQuery = defaultQueryState()
		queryStateRef.current = resetQuery
		desiredQueryRef.current = resetQuery
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
		selectedTournamentIsOfficialH2H,
		selectionRestoreComplete,
		scopeKey,
		standingsReady,
		updateSearchInput
	])

	useEffect(() => {
		if (
			!scopeKey ||
			!selectedTournamentId ||
			selectedTournamentIsOfficialH2H ||
			!standingsReady ||
			!selectionRestoreComplete
		) {
			return
		}
		const tournamentId = Number(selectedTournamentId)
		const eventId = selectedGameweek
		const nextQuery = defaultQueryState()
		queryStateRef.current = nextQuery
		desiredQueryRef.current = nextQuery
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
		const initial = initialSeedRef.current
		if (initial?.key === scopeKey && initial.page) {
			initialSeedRef.current = null
			setBoardPage(initial.page)
			setEntries(pageRows(initial.page))
			setContentScopeKey(scopeKey)
			acceptedBoardFreshnessRef.current = boardFreshnessMarker(initial.page)
			setShowingLastGood(false)
			writeLiveBoardLastGood(storage, cacheScope, initial.page)
			if (initial.page.head.availability !== 'READY') {
				setResultsError(
					boardPartialMessage(initial.page, {
						failed: t('calculationFailed'),
						warming: t('coverageWarming'),
						unavailable: t('unavailableCalculation', {
							count: initial.page.totalEntries
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
		selectedTournamentId,
		selectedTournamentIsOfficialH2H,
		selectionRestoreComplete,
		sessionCacheKey,
		standingsReady,
		t,
		updateSearchInput
	])

	useEffect(() => {
		if (rateLimitSeconds !== 0) return
		const pending = pendingReplacementRef.current
		if (!pending) return
		if (pending.options.expectedScope !== activeScopeRef.current) {
			pendingReplacementRef.current = null
			pending.resolve(false)
			return
		}
		pendingReplacementRef.current = null
		void replaceFirstPage(
			pending.tournamentId,
			pending.eventId,
			pending.query,
			pending.options
		).then(pending.resolve)
	}, [rateLimitSeconds, replaceFirstPage])

	useEffect(() => {
		if (!scopeKey || !selectedTournamentId || !standingsReady) return
		if (searchInput === queryState.search) return
		const timer = window.setTimeout(() => {
			const requestedInput = searchInputRef.current
			const next = {
				...desiredQueryRef.current,
				search: requestedInput.trim()
			}
			desiredQueryRef.current = next
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
					desiredQueryRef.current = queryStateRef.current
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
			const nextQuery = { ...desiredQueryRef.current, filters }
			desiredQueryRef.current = nextQuery
			return replaceFirstPage(
				Number(selectedTournamentId),
				selectedGameweek,
				nextQuery,
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
			const nextQuery = {
				...desiredQueryRef.current,
				sortColumn: column,
				sortDirection: direction
			}
			desiredQueryRef.current = nextQuery
			void replaceFirstPage(
				Number(selectedTournamentId),
				selectedGameweek,
				nextQuery,
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
				hasMore: boardPage.pageInfo.hasNextPage,
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
					boardPage.pageInfo.endCursor
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
			if (!isCompleteLiveBoardPage(next)) {
				setResultsError(
					boardPartialMessage(next, {
						failed: t('calculationFailed'),
						warming: t('coverageWarming'),
						unavailable: t('unavailableCalculation', {
							count: next.totalEntries
						})
					}) ?? t('refreshFailedRetained')
				)
				return
			}
			setEntries(current => {
				const byId = new Map(current.map(entry => [entry.id, entry]))
				for (const entry of pageRows(next)) byId.set(entry.id, entry)
				return Array.from(byId.values())
			})
			setBoardPage(next)
			setResultsError(
				boardPartialMessage(next, {
					failed: t('calculationFailed'),
					warming: t('coverageWarming'),
					unavailable: t('unavailableCalculation', {
						count: next.totalEntries
					})
				})
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
			if (
				isCurrentLiveBoardRequest(
					version,
					requestVersionRef.current,
					scopeKey,
					activeScopeRef.current
				)
			) {
				setIsLoadingMore(false)
			}
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
		if (
			!canStartLiveBoardRefresh({
				replacementPending: replaceInFlightRef.current,
				refreshPending: false
			})
		)
			return Promise.resolve(false)
		const request = replaceFirstPage(
			Number(selectedTournamentId),
			selectedGameweek,
			desiredQueryRef.current,
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
			if (!selectedTournamentId) return
			const observedHead = await fetchLeagueLiveHead(
				Number(selectedTournamentId),
				selectedGameweek,
				'CLASSIC'
			)
			const accepted = acceptedBoardFreshnessRef.current
			const boardPublicationChanged = liveBoardPublicationChanged(accepted, {
				eventId: observedHead.eventId,
				contentRevision: observedHead.contentRevision
			})
			if (
				boardPage &&
				observedHead.eventId === boardPage.head.eventId &&
				!boardPublicationChanged
			) {
				setBoardPage(current =>
					current ? { ...current, head: observedHead } : current
				)
			}
			if (
				shouldAutoRefreshLiveBoardPage(boardPage) &&
				boardPublicationChanged
			) {
				await refresh()
			}
		} catch {
			if (entries.length > 0) setResultsError(t('refreshFailedRetained'))
		}
	}, [
		boardPage,
		entries.length,
		refresh,
		selectedGameweek,
		selectedTournamentId,
		t
	])

	const liveStatus = useMemo(() => {
		if (!boardPage) return t('scoreConfirming')
		if (showingLastGood) return t('showingLastGood')
		if (boardPage.head.availability === 'PENDING') return t('coverageWarming')
		if (
			boardPage.head.availability === 'MISSING' ||
			boardPage.head.availability === 'ERROR' ||
			boardPage.head.delivery.state === 'UNAVAILABLE'
		)
			return t('scoreOfficialUnavailable')
		if (boardPage.head.delivery.state === 'DEGRADED')
			return t('scoreOfficialDelayed')
		if (boardPage.head.delivery.state === 'STALE')
			return t('scorePartiallyAvailable')
		return t('scoreOfficialLive')
	}, [boardPage, showingLastGood, t])
	const boardCoverageSummary = useMemo(() => {
		if (!boardPage) return null
		return t('participantCountValue', { count: boardPage.totalEntries })
	}, [boardPage, t])

	const updatedAt = exactUpdatedAt(
		boardPage?.head.publication?.times.contentUpdatedAt ?? null
	)
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
						hasMore: boardPage.pageInfo.hasNextPage,
						filteredEntries: boardPage.filteredEntries,
						isLoadingMore: isLoadingMore || isRefreshing || isLoadingInitial,
						onLoadMore: () => void loadMore(),
						scoreCoreRevision:
							boardPage.head.publication?.revisions.scoreCore ?? '',
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
		const shareEntries =
			tableEntriesForShare.length > 0
				? tableEntriesForShare
				: visibleEntries.slice(0, 20)
		for (const entry of shareEntries.slice(0, 20))
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
						(selectedTournamentIsOfficialH2H ||
							(!isLoadingInitial && contentScopeKey === scopeKey && hasBoard))
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

				{initialCreated ? (
					<Alert
						variant="success"
						className="mb-6"
					>
						<Check aria-hidden="true" />
						<AlertDescription>{lifecycleT('createdShell')}</AlertDescription>
					</Alert>
				) : null}

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
							const params = new URLSearchParams({ tournamentId: id })
							if (selectedGameweek > 0)
								params.set('gw', String(selectedGameweek))
							router.replace(`/live/competitions?${params.toString()}`)
						}}
					/>
				) : null}

				<Card className="mb-6 p-4">
					<GameweekSelector
						onGameweekChange={gameweek => {
							followsAnchorRef.current = false
							setFollowsGameweekAnchor(false)
							setSelectedGameweek(gameweek)
						}}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={
							isLoadingInitial || Boolean(selectedTournament && !standingsReady)
						}
					/>
					{!selectedTournamentIsOfficialH2H ? (
						<>
							<div className="mt-2 flex flex-wrap items-center justify-end gap-2">
								<LiveAutoRefreshCountdown
									enabled={autoRefreshEnabled}
									onRefresh={autoRefresh}
									nextRefreshAt={
										boardPage?.head.publication?.times.nextRefreshAt ?? null
									}
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
								{liveStatus}
								{updatedAt ? ` · ${t('lastUpdated', { time: updatedAt })}` : ''}
							</p>
							{boardCoverageSummary ? (
								<p className="mt-1 text-right text-xs text-muted-foreground">
									{boardCoverageSummary}
								</p>
							) : null}
						</>
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
					selectedTournamentIsOfficialH2H ? (
						<OfficialH2HCompetitionView
							key={`${selectedTournament.id}:${selectedGameweek}`}
							activeEventId={currentGameweek}
							eventId={selectedGameweek}
							initialSnapshot={null}
							tournamentId={Number(selectedTournament.id)}
							viewerEntryId={entryId}
						/>
					) : (
						<div
							ref={shareRef}
							data-share-preserve-width="true"
						>
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
											scoreCoreRevision={
												boardPage.head.publication?.revisions.scoreCore ?? ''
											}
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
											boardPage.viewerRow?.availability === 'READY' &&
											boardPage.viewerRow.score
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
					)
				) : null}
			</div>
		</PageShell>
	)
}
