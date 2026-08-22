'use client'

import { executeQuery } from '@/lib/graphql-client'
import {
	GET_MY_FPL_COMPETITION_BOARD,
	GET_MY_FPL_COMPETITION_SEASON_PATH,
	GET_MY_FPL_COMPETITIONS_DESK,
	type MyFplCompetitionBoardPage,
	type MyFplCompetitionBoardResponse,
	type MyFplCompetitionAggregate,
	type MyFplCompetitionsDeskResponse,
	type MyFplReviewState
} from '@/lib/graphql/operations/my-fpl'
import {
	type EntryTournament,
	type TournamentEntryRankingSummary,
	type TournamentEventResultItem,
	type TournamentSeasonSnapshotApi
} from '@/lib/graphql/operations/tournaments'
import { usePageActive } from '@/hooks/use-page-active'
import {
	areTournamentInsightsReady,
	isTournamentInsightsRepairExhausted,
	isTournamentSetupPollingPending
} from '@/lib/tournament/lifecycle'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
	aggregateToRankingSummary,
	aggregateToSeasonSnapshot,
	aggregateToTournamentStats,
	boardRowsToEventResults
} from '../_lib/my-fpl-adapters'
import type { TournamentPathPoint } from '../_lib/tournament-stats-data'
import {
	buildTournamentSeasonField,
	buildTournamentSeasonFieldFromSnapshot,
	buildTournamentSeasonMe,
	buildTournamentStats,
	type PlayerMeta,
	type TournamentSeasonField,
	type TournamentSeasonMe,
	type TournamentStatsViewModel,
	resolveTournamentStatsLoadState
} from '../_lib/tournament-stats-model'

export interface TournamentStatsClientProps {
	entryId: number
	initialCurrentGameweek: number
	initialLatestFinalizedGameweek?: number | null
	initialTournaments: EntryTournament[]
	initialSelectedTournamentId: string
	initialDataGameweek: number | null
	initialSliceGameweek: number | null
	initialCurrentRows: TournamentEventResultItem[]
	initialSeasonFieldRows?: TournamentEventResultItem[]
	initialSeasonSnapshot?: TournamentSeasonSnapshotApi | null
	initialPreviousRows?: TournamentEventResultItem[]
	initialRankingSummary?: TournamentEntryRankingSummary | null
	initialPlayerMeta?: Record<number, PlayerMeta>
	initialUsedFallbackGameweek?: boolean
	initialReviewState?: MyFplReviewState
	initialBoard?: MyFplCompetitionBoardPage | null
	initialAggregate?: MyFplCompetitionAggregate | null
	initialError: string | null
	loadGameweekData?: boolean
	loadSeasonPath?: boolean
}

type BoardQueryOptions = {
	tournamentId: number
	eventId: number
	page?: number
	pageSize?: number
	search?: string
	signal?: AbortSignal
}

async function fetchBoardPage({
	tournamentId,
	eventId,
	page = 1,
	pageSize = 100,
	search,
	signal
}: BoardQueryOptions): Promise<MyFplCompetitionBoardPage> {
	const response = await executeQuery<MyFplCompetitionBoardResponse>(
		GET_MY_FPL_COMPETITION_BOARD,
		{ tournamentId, eventId, page, pageSize, search: search || null },
		{ cache: 'no-store', signal }
	)
	return response.myFplCompetitionBoard
}

async function fetchDesk(
	tournamentId: number,
	eventId: number | null,
	signal?: AbortSignal
): Promise<MyFplCompetitionsDeskResponse['myFplCompetitionsDesk']> {
	const response = await executeQuery<MyFplCompetitionsDeskResponse>(
		GET_MY_FPL_COMPETITIONS_DESK,
		{ tournamentId, eventId },
		{ cache: 'no-store', signal }
	)
	return response.myFplCompetitionsDesk
}

export function useTournamentStats({
	entryId,
	initialCurrentGameweek,
	initialLatestFinalizedGameweek = null,
	initialTournaments,
	initialSelectedTournamentId,
	initialDataGameweek,
	initialSliceGameweek,
	initialCurrentRows,
	initialSeasonFieldRows = [],
	initialSeasonSnapshot = null,
	initialPreviousRows = [],
	initialRankingSummary = null,
	initialPlayerMeta = {},
	initialUsedFallbackGameweek = false,
	initialReviewState = 'EMPTY',
	initialBoard = null,
	initialAggregate = null,
	initialError,
	loadGameweekData = false,
	loadSeasonPath = false
}: TournamentStatsClientProps) {
	const t = useTranslations('TournamentStats')
	const pageActive = usePageActive()
	const initialSelectedTournament =
		initialTournaments.find(
			item => String(item.id) === initialSelectedTournamentId
		) ?? null
	const initialFallbackStats =
		initialSelectedTournament &&
		initialSliceGameweek !== null &&
		initialCurrentRows.length > 0
			? buildTournamentStats(
					initialSelectedTournament,
					initialSliceGameweek,
					initialCurrentRows,
					initialPreviousRows,
					initialPlayerMeta,
					entryId
				)
			: null
	const initialAggregateStats =
		initialSelectedTournament &&
		initialAggregate &&
		initialBoard &&
		initialReviewState === 'READY'
			? aggregateToTournamentStats(
					initialSelectedTournament,
					initialAggregate,
					initialBoard,
					entryId
				)
			: null

	const [tournaments, setTournaments] = useState(initialTournaments)
	const [selectedTournamentId, setSelectedTournamentIdState] = useState(
		initialSelectedTournamentId
	)
	const [currentGameweek, setCurrentGameweek] = useState(initialCurrentGameweek)
	const [latestFinalizedGameweek, setLatestFinalizedGameweek] = useState<
		number | null
	>(initialLatestFinalizedGameweek)
	const [dataGameweek, setDataGameweek] = useState<number | null>(
		initialDataGameweek
	)
	const [usedFallbackGameweek, setUsedFallbackGameweek] = useState(
		initialUsedFallbackGameweek
	)
	const [reviewState, setReviewState] =
		useState<MyFplReviewState>(initialReviewState)
	const [tournamentStats, setTournamentStats] =
		useState<TournamentStatsViewModel | null>(
			initialAggregateStats ?? initialFallbackStats
		)
	const [aggregate, setAggregate] = useState<MyFplCompetitionAggregate | null>(
		initialAggregate
	)
	const [boardPage, setBoardPage] = useState<MyFplCompetitionBoardPage | null>(
		initialBoard
	)
	const [boardSearch, setBoardSearch] = useState('')
	const [rankingSummary, setRankingSummary] =
		useState<TournamentEntryRankingSummary | null>(initialRankingSummary)
	const [seasonFieldRows, setSeasonFieldRows] = useState<
		TournamentEventResultItem[]
	>(
		initialSeasonFieldRows.length > 0
			? initialSeasonFieldRows
			: initialCurrentRows
	)
	const [seasonSnapshot, setSeasonSnapshot] =
		useState<TournamentSeasonSnapshotApi | null>(initialSeasonSnapshot)
	const [standingsSearch, setStandingsSearch] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [isBoardLoading, setIsBoardLoading] = useState(false)
	const [seasonPath, setSeasonPath] = useState<TournamentPathPoint[]>([])
	const [seasonPathLoading, setSeasonPathLoading] = useState(false)
	const [seasonPathState, setSeasonPathState] =
		useState<MyFplReviewState>('EMPTY')
	const [seasonPathRetryNonce, setSeasonPathRetryNonce] = useState(0)
	const [error, setError] = useState<string | null>(initialError)
	const [selectedGameweek, setSelectedGameweek] = useState(
		initialSliceGameweek && initialSliceGameweek > 0
			? initialSliceGameweek
			: initialCurrentGameweek
	)

	const requestSequenceRef = useRef(0)
	const requestAbortRef = useRef<AbortController | null>(null)
	const boardSequenceRef = useRef(0)
	const boardAbortRef = useRef<AbortController | null>(null)
	const boardPageRef = useRef<MyFplCompetitionBoardPage | null>(initialBoard)
	const firstDeskLoadRef = useRef(true)
	const initialBoardSearchSkippedRef = useRef(false)
	const [deskRefreshNonce, setDeskRefreshNonce] = useState(0)

	const commitBoardPage = useCallback(
		(nextBoard: MyFplCompetitionBoardPage | null, search = '') => {
			boardPageRef.current = nextBoard
			setBoardPage(nextBoard)
			setBoardSearch(search)
		},
		[]
	)
	const updateStandingsSearch = useCallback((value: string) => {
		setStandingsSearch(value)
		if (value.trim() === '') {
			setSeasonFieldRows([])
			setSeasonSnapshot(null)
		}
	}, [])

	const selectedTournament = useMemo(
		() =>
			tournaments.find(item => String(item.id) === selectedTournamentId) ??
			null,
		[selectedTournamentId, tournaments]
	)
	const insightsReady = selectedTournament
		? areTournamentInsightsReady(selectedTournament)
		: false
	const statsLoadState = resolveTournamentStatsLoadState({
		isBootstrapping: false,
		hasSelectedTournament: Boolean(selectedTournament),
		insightsReady
	})

	const filteredStandings = useMemo(
		() => tournamentStats?.standings ?? [],
		[tournamentStats]
	)
	const seasonField: TournamentSeasonField | null = useMemo(() => {
		const fromSnapshot = buildTournamentSeasonFieldFromSnapshot(
			seasonSnapshot,
			entryId
		)
		if (fromSnapshot) return fromSnapshot
		if (dataGameweek == null || seasonFieldRows.length === 0) return null
		return buildTournamentSeasonField(seasonFieldRows, entryId, dataGameweek)
	}, [dataGameweek, entryId, seasonFieldRows, seasonSnapshot])
	const seasonMe: TournamentSeasonMe | null = useMemo(() => {
		if (dataGameweek == null && !seasonSnapshot) return null
		const asOf = seasonSnapshot?.asOfEventId ?? dataGameweek ?? 0
		return asOf > 0
			? buildTournamentSeasonMe(rankingSummary, seasonField, asOf)
			: null
	}, [dataGameweek, rankingSummary, seasonField, seasonSnapshot])

	const setSelectedTournamentId = (value: string) => {
		requestSequenceRef.current += 1
		requestAbortRef.current?.abort()
		requestAbortRef.current = null
		boardSequenceRef.current += 1
		boardAbortRef.current?.abort()
		boardAbortRef.current = null
		setIsBoardLoading(false)
		commitBoardPage(null)
		setStandingsSearch('')
		setSelectedTournamentIdState(value)
		setSelectedGameweek(prev => (prev > 0 ? prev : currentGameweek))
		setTournamentStats(null)
		setBoardPage(null)
		setAggregate(null)
		setSeasonFieldRows([])
		setSeasonSnapshot(null)
		setRankingSummary(null)
		setReviewState('PENDING')
		setError(null)
	}

	// The setup poll uses the same authenticated desk/list projection as the page.
	useEffect(() => {
		if (
			!pageActive ||
			!selectedTournament ||
			insightsReady ||
			!isTournamentSetupPollingPending(
				selectedTournament.setupStatus,
				selectedTournament.insightsReadyAt,
				isTournamentInsightsRepairExhausted(selectedTournament.warningSummaries)
			)
		)
			return

		let cancelled = false
		let timer: number | undefined
		const poll = async () => {
			try {
				const response = await executeQuery<MyFplCompetitionsDeskResponse>(
					GET_MY_FPL_COMPETITIONS_DESK,
					{ tournamentId: Number(selectedTournamentId) || null, eventId: null },
					{ cache: 'no-store' }
				)
				if (!cancelled) {
					const nextDesk = response.myFplCompetitionsDesk
					const nextTournament =
						nextDesk.selectedTournament ??
						nextDesk.tournaments.find(
							item => item.id === Number(selectedTournamentId)
						) ??
						null
					setTournaments(nextDesk.tournaments)
					if (
						!insightsReady &&
						nextTournament &&
						areTournamentInsightsReady(nextTournament)
					) {
						setDeskRefreshNonce(value => value + 1)
					}
				}
			} catch (pollError) {
				console.warn('[tournament stats] setup poll failed:', pollError)
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 10_000)
			}
		}
		timer = window.setTimeout(poll, 10_000)
		return () => {
			cancelled = true
			if (timer !== undefined) window.clearTimeout(timer)
		}
	}, [insightsReady, pageActive, selectedTournament, selectedTournamentId])

	// One request owns the selected tournament + GW. Abort and sequence-guard
	// every previous selection so rapid switching cannot commit stale details.
	useEffect(() => {
		const tournamentId = Number(selectedTournamentId)
		if (!Number.isSafeInteger(tournamentId) || tournamentId <= 0) return
		boardSequenceRef.current += 1
		boardAbortRef.current?.abort()
		boardAbortRef.current = null
		const requestId = requestSequenceRef.current + 1
		requestSequenceRef.current = requestId
		requestAbortRef.current?.abort()
		const controller = new AbortController()
		requestAbortRef.current = controller
		let deskRetryTimer: number | undefined

		if (
			firstDeskLoadRef.current &&
			tournamentId === Number(initialSelectedTournamentId) &&
			(initialBoard !== null || initialReviewState !== 'EMPTY')
		) {
			firstDeskLoadRef.current = false
			return () => controller.abort()
		}
		firstDeskLoadRef.current = false
		setIsLoading(true)
		setError(null)
		setTournamentStats(null)
		setAggregate(null)
		setRankingSummary(null)
		setSeasonSnapshot(null)
		setSeasonFieldRows([])
		setDataGameweek(null)

		void fetchDesk(
			tournamentId,
			loadGameweekData && selectedGameweek > 0 ? selectedGameweek : null,
			controller.signal
		)
			.then(desk => {
				if (
					requestId !== requestSequenceRef.current ||
					controller.signal.aborted
				)
					return
				const nextTournament =
					desk.selectedTournament ??
					desk.tournaments.find(item => item.id === tournamentId) ??
					null
				const nextState =
					desk.state === 'READY'
						? (desk.board?.state ?? desk.state)
						: desk.state
				const board = nextState === 'READY' ? desk.board : null
				const aggregate = nextState === 'READY' ? desk.aggregate : null
				const rows = boardRowsToEventResults(board, nextTournament)
				setTournaments(desk.tournaments)
				setCurrentGameweek(
					desk.context.currentEventId ??
						desk.context.latestFinalizedEventId ??
						0
				)
				setLatestFinalizedGameweek(desk.context.latestFinalizedEventId ?? null)
				setReviewState(nextState)
				commitBoardPage(board)
				setAggregate(aggregate)
				setRankingSummary(aggregateToRankingSummary(aggregate))
				setSeasonSnapshot(aggregateToSeasonSnapshot(aggregate, board))
				setSeasonFieldRows(nextState === 'READY' ? rows : [])
				setDataGameweek(
					nextState === 'READY'
						? desk.eventId
						: desk.context.latestFinalizedEventId
				)
				setUsedFallbackGameweek(false)
				if (nextState === 'PENDING') {
					deskRetryTimer = window.setTimeout(() => {
						if (
							requestId === requestSequenceRef.current &&
							!controller.signal.aborted
						) {
							setDeskRefreshNonce(value => value + 1)
						}
					}, 10_000)
				}
				if (nextTournament && nextState === 'READY' && aggregate && board) {
					setTournamentStats(
						aggregateToTournamentStats(
							nextTournament,
							aggregate,
							board,
							entryId
						)
					)
				}
			})
			.catch(loadError => {
				if (
					requestId !== requestSequenceRef.current ||
					controller.signal.aborted
				)
					return
				console.error(
					'[tournament stats] selected desk load failed:',
					loadError
				)
				setReviewState('UNAVAILABLE')
				setError(t('loadFailed'))
			})
			.finally(() => {
				if (
					requestId === requestSequenceRef.current &&
					!controller.signal.aborted
				) {
					setIsLoading(false)
				}
			})

		return () => {
			controller.abort()
			if (deskRetryTimer !== undefined) window.clearTimeout(deskRetryTimer)
			// A desk refresh can supersede an in-flight search or load-more request.
			// Abort/clear the board channel as part of the same lifecycle so a stale
			// request cannot leave the standings spinner permanently active.
			boardSequenceRef.current += 1
			boardAbortRef.current?.abort()
			boardAbortRef.current = null
			setIsBoardLoading(false)
		}
	}, [
		entryId,
		initialBoard,
		initialReviewState,
		initialSelectedTournamentId,
		loadGameweekData,
		commitBoardPage,
		selectedGameweek,
		selectedTournamentId,
		t,
		deskRefreshNonce
	])

	const rebuildStatsFromBoard = useCallback(
		(nextBoard: MyFplCompetitionBoardPage, nextAggregate = aggregate) => {
			if (!selectedTournament || !nextAggregate || nextBoard.state !== 'READY')
				return
			const previousBoard = boardPageRef.current
			const boardWithViewer =
				(nextBoard.viewerRow ?? previousBoard?.viewerRow)
					? {
							...nextBoard,
							viewerRow: nextBoard.viewerRow ?? previousBoard?.viewerRow ?? null
						}
					: nextBoard
			commitBoardPage(boardWithViewer, standingsSearch.trim())
			setTournamentStats(
				aggregateToTournamentStats(
					selectedTournament,
					nextAggregate,
					boardWithViewer,
					entryId
				)
			)
			if (standingsSearch.trim() === '') {
				setSeasonSnapshot(
					aggregateToSeasonSnapshot(nextAggregate, boardWithViewer)
				)
				setSeasonFieldRows(
					boardRowsToEventResults(boardWithViewer, selectedTournament)
				)
			}
		},
		[aggregate, commitBoardPage, entryId, selectedTournament, standingsSearch]
	)
	const boardEventId = boardPage?.eventId ?? null

	// Search is server-side. Each new term has its own abort/sequence boundary.
	useEffect(() => {
		if (boardEventId === null || reviewState !== 'READY' || !selectedTournament)
			return
		if (
			!initialBoardSearchSkippedRef.current &&
			initialBoard !== null &&
			initialReviewState === 'READY' &&
			standingsSearch.trim() === '' &&
			boardEventId === initialBoard.eventId
		) {
			initialBoardSearchSkippedRef.current = true
			return
		}
		const eventId = boardEventId
		const boardId = boardSequenceRef.current + 1
		boardSequenceRef.current = boardId
		boardAbortRef.current?.abort()
		const controller = new AbortController()
		boardAbortRef.current = controller
		const timer = window.setTimeout(() => {
			setIsBoardLoading(true)
			void fetchBoardPage({
				tournamentId: selectedTournament.id,
				eventId,
				page: 1,
				pageSize: 100,
				search: standingsSearch.trim(),
				signal: controller.signal
			})
				.then(nextBoard => {
					if (boardId !== boardSequenceRef.current || controller.signal.aborted)
						return
					rebuildStatsFromBoard(nextBoard)
				})
				.catch(searchError => {
					if (!controller.signal.aborted) {
						console.warn('[tournament stats] board search failed:', searchError)
						setError(t('loadFailed'))
						setTournamentStats(null)
						// Keep the last known event/page context on a transient search
						// failure. Clearing it makes a valid member look like an empty
						// or unselected competition and loses the server-side cursor.
						commitBoardPage(boardPageRef.current, standingsSearch.trim())
						if (standingsSearch.trim() === '') {
							setSeasonSnapshot(null)
							setSeasonFieldRows([])
						}
					}
				})
				.finally(() => {
					if (
						boardId === boardSequenceRef.current &&
						!controller.signal.aborted
					)
						setIsBoardLoading(false)
				})
		}, 180)
		return () => {
			window.clearTimeout(timer)
			controller.abort()
			if (boardId === boardSequenceRef.current) setIsBoardLoading(false)
		}
	}, [
		boardEventId,
		commitBoardPage,
		initialBoard,
		initialReviewState,
		rebuildStatsFromBoard,
		reviewState,
		selectedTournament,
		standingsSearch,
		t
	])

	const loadMoreStandings = useCallback(async () => {
		if (
			!boardPage ||
			!selectedTournament ||
			boardPage.page >= boardPage.totalPages
		)
			return
		const boardId = boardSequenceRef.current + 1
		boardSequenceRef.current = boardId
		boardAbortRef.current?.abort()
		const controller = new AbortController()
		boardAbortRef.current = controller
		setIsBoardLoading(true)
		setError(null)
		try {
			const nextPage = await fetchBoardPage({
				tournamentId: selectedTournament.id,
				eventId: boardPage.eventId,
				page: boardPage.page + 1,
				pageSize: boardPage.pageSize,
				search: standingsSearch.trim(),
				signal: controller.signal
			})
			if (boardId !== boardSequenceRef.current || controller.signal.aborted)
				return
			const merged: MyFplCompetitionBoardPage = {
				...nextPage,
				page: nextPage.page,
				rows: [...boardPage.rows, ...nextPage.rows],
				viewerRow: nextPage.viewerRow ?? boardPage.viewerRow
			}
			rebuildStatsFromBoard(merged)
			setError(null)
		} catch (loadError) {
			if (!controller.signal.aborted) setError(t('loadFailed'))
		} finally {
			if (boardId === boardSequenceRef.current && !controller.signal.aborted)
				setIsBoardLoading(false)
		}
	}, [boardPage, rebuildStatsFromBoard, selectedTournament, standingsSearch, t])

	// Dedicated server path replaces client-side N× full-field reconstruction.
	useEffect(() => {
		const seasonPathThroughEventId = latestFinalizedGameweek ?? dataGameweek
		if (
			!loadSeasonPath ||
			!selectedTournament ||
			seasonPathThroughEventId == null ||
			seasonPathThroughEventId < 1
		) {
			setSeasonPath([])
			setSeasonPathState('EMPTY')
			if (!loadSeasonPath) setSeasonPathLoading(false)
			return
		}
		const controller = new AbortController()
		let cancelled = false
		let retryPending = false
		let retryTimer: number | undefined
		setSeasonPath([])
		setSeasonPathState('PENDING')
		setSeasonPathLoading(true)
		void executeQuery<{
			myFplCompetitionSeasonPath: {
				state: MyFplReviewState
				points: TournamentPathPoint[]
			}
		}>(
			GET_MY_FPL_COMPETITION_SEASON_PATH,
			{
				tournamentId: selectedTournament.id,
				throughEventId: seasonPathThroughEventId
			},
			{ cache: 'no-store', signal: controller.signal }
		)
			.then(response => {
				const path = response.myFplCompetitionSeasonPath
				if (path.state === 'PENDING') {
					if (!cancelled) setSeasonPathState('PENDING')
					retryPending = true
					retryTimer = window.setTimeout(() => {
						if (!cancelled) setSeasonPathRetryNonce(value => value + 1)
					}, 10_000)
					return
				}
				if (!cancelled) {
					setSeasonPathState(path.state)
					setSeasonPath(path.state === 'READY' ? (path.points ?? []) : [])
				}
			})
			.catch(pathError => {
				if (!controller.signal.aborted) {
					setSeasonPathState('UNAVAILABLE')
					console.warn('[tournament stats] season path failed:', pathError)
				}
			})
			.finally(() => {
				if (!cancelled) setSeasonPathLoading(retryPending)
			})
		return () => {
			cancelled = true
			controller.abort()
			if (retryTimer !== undefined) window.clearTimeout(retryTimer)
		}
	}, [
		dataGameweek,
		latestFinalizedGameweek,
		loadSeasonPath,
		selectedTournament,
		seasonPathRetryNonce
	])

	return {
		currentGameweek,
		dataGameweek,
		error,
		filteredStandings,
		insightsReady,
		isBootstrapping: false,
		isLoading,
		isBoardLoading,
		boardSearch,
		hasMoreStandings: Boolean(
			boardPage && boardPage.page < boardPage.totalPages
		),
		loadMoreStandings,
		latestFinalizedGameweek,
		rankingSummary,
		reviewState,
		seasonField,
		seasonMe,
		seasonPath,
		seasonPathLoading,
		seasonPathState,
		selectedGameweek,
		setSelectedGameweek,
		selectedTournament,
		selectedTournamentId,
		setSelectedTournamentId,
		setStandingsSearch: updateStandingsSearch,
		standingsSearch,
		tournamentStats,
		tournaments,
		usedFallbackGameweek,
		statsLoadState
	}
}
