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
	const firstDeskLoadRef = useRef(true)
	const initialBoardSearchSkippedRef = useRef(false)
	const [deskRefreshNonce, setDeskRefreshNonce] = useState(0)

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
				const board = desk.board
				const nextState = board?.state ?? desk.state
				const rows = boardRowsToEventResults(board, nextTournament)
				setTournaments(desk.tournaments)
				setCurrentGameweek(
					desk.context.currentEventId ??
						desk.context.latestFinalizedEventId ??
						0
				)
				setLatestFinalizedGameweek(desk.context.latestFinalizedEventId ?? null)
				setReviewState(nextState)
				setBoardPage(board)
				setAggregate(desk.aggregate)
				setRankingSummary(aggregateToRankingSummary(desk.aggregate))
				setSeasonSnapshot(aggregateToSeasonSnapshot(desk.aggregate, board))
				setSeasonFieldRows(nextState === 'READY' ? rows : [])
				setDataGameweek(
					nextState === 'READY'
						? desk.eventId
						: desk.context.latestFinalizedEventId
				)
				setUsedFallbackGameweek(false)
				if (
					nextTournament &&
					nextState === 'READY' &&
					desk.aggregate &&
					board
				) {
					setTournamentStats(
						aggregateToTournamentStats(
							nextTournament,
							desk.aggregate,
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

		return () => controller.abort()
	}, [
		entryId,
		initialBoard,
		initialReviewState,
		initialSelectedTournamentId,
		loadGameweekData,
		selectedGameweek,
		selectedTournamentId,
		t,
		deskRefreshNonce
	])

	const rebuildStatsFromBoard = useCallback(
		(nextBoard: MyFplCompetitionBoardPage, nextAggregate = aggregate) => {
			if (!selectedTournament || !nextAggregate || nextBoard.state !== 'READY')
				return
			const boardWithViewer =
				(nextBoard.viewerRow ?? boardPage?.viewerRow)
					? {
							...nextBoard,
							viewerRow: nextBoard.viewerRow ?? boardPage?.viewerRow ?? null
						}
					: nextBoard
			setBoardPage(boardWithViewer)
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
		[aggregate, boardPage, entryId, selectedTournament, standingsSearch]
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
					if (!controller.signal.aborted)
						console.warn('[tournament stats] board search failed:', searchError)
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
		}
	}, [
		boardEventId,
		initialBoard,
		initialReviewState,
		rebuildStatsFromBoard,
		reviewState,
		selectedTournament,
		standingsSearch
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
			if (!loadSeasonPath) setSeasonPathLoading(false)
			return
		}
		const controller = new AbortController()
		let cancelled = false
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
				if (!cancelled)
					setSeasonPath(response.myFplCompetitionSeasonPath.points ?? [])
			})
			.catch(pathError => {
				if (!controller.signal.aborted)
					console.warn('[tournament stats] season path failed:', pathError)
			})
			.finally(() => {
				if (!cancelled) setSeasonPathLoading(false)
			})
		return () => {
			cancelled = true
			controller.abort()
		}
	}, [
		dataGameweek,
		latestFinalizedGameweek,
		loadSeasonPath,
		selectedTournament
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
		selectedGameweek,
		setSelectedGameweek,
		selectedTournament,
		selectedTournamentId,
		setSelectedTournamentId,
		setStandingsSearch,
		standingsSearch,
		tournamentStats,
		tournaments,
		usedFallbackGameweek,
		statsLoadState
	}
}
