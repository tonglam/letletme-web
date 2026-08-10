'use client'

import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentEntryRankingSummary,
	type TournamentEntryRankingSummaryResponse,
	type TournamentEventResultItem,
	type TournamentSeasonSnapshotApi,
} from '@/lib/graphql/operations/tournaments'
import { usePageActive } from '@/hooks/use-page-active'
import {
	areTournamentInsightsReady,
	isTournamentSetupInFlight,
} from '@/lib/tournament/lifecycle'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
	fetchPlayerMetaByIds,
	fetchTournamentEventResultsCached,
	fetchTournamentSeasonSnapshotCached,
	loadTournamentSeasonPath,
	type TournamentPathPoint,
} from '../_lib/tournament-stats-data'
import {
	clearRankingInFlight,
	getRankingInFlight,
	peekRanking,
	rankingKey,
	seedEventResults,
	seedPlayerMeta,
	seedRanking,
	seedSeasonSnapshot,
	setRankingInFlight,
	getAllCachedPlayerMeta,
} from '../_lib/tournament-stats-cache'
import {
	buildTournamentSeasonField,
	buildTournamentSeasonFieldFromSnapshot,
	buildTournamentSeasonMe,
	buildTournamentStats,
	type PlayerMeta,
	type TournamentSeasonField,
	type TournamentSeasonMe,
	type TournamentStatsViewModel,
	resolveTournamentStatsLoadState,
} from '../_lib/tournament-stats-model'
import { buildTournamentEventResultSeeds } from '../_lib/tournament-stats-seed'

export interface TournamentStatsClientProps {
	entryId: number
	initialCurrentGameweek: number
	initialTournaments: EntryTournament[]
	initialSelectedTournamentId: string
	initialDataGameweek: number | null
	/** Event ID represented by initialCurrentRows; may differ for a deep link. */
	initialSliceGameweek: number | null
	initialCurrentRows: TournamentEventResultItem[]
	/** Latest-data-GW full field for Season A; defaults to initialCurrentRows */
	initialSeasonFieldRows?: TournamentEventResultItem[]
	/** Phase 2: server season snapshot for dimension A */
	initialSeasonSnapshot?: TournamentSeasonSnapshotApi | null
	initialPreviousRows?: TournamentEventResultItem[]
	initialRankingSummary?: TournamentEntryRankingSummary | null
	initialPlayerMeta?: Record<number, PlayerMeta>
	initialUsedFallbackGameweek?: boolean
	initialError: string | null
	/** When true, load standings/performance for selectedGameweek */
	loadGameweekData?: boolean
	/** When true, load deferred multi-GW season path (Season tab only) */
	loadSeasonPath?: boolean
}

async function fetchRankingCached(
	tournamentId: number,
	eventId: number,
	entryId: number,
): Promise<TournamentEntryRankingSummary | null> {
	const cached = peekRanking<TournamentEntryRankingSummary>(
		tournamentId,
		eventId,
		entryId,
	)
	if (cached) return cached
	const key = rankingKey(tournamentId, eventId, entryId)
	const inflight = getRankingInFlight(key)
	if (inflight) return inflight as Promise<TournamentEntryRankingSummary | null>

	const request = executeQuery<TournamentEntryRankingSummaryResponse>(
		GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
		{ tournamentId, eventId, entryId },
		{ cache: 'no-store' },
	)
		.then(response => {
			const summary = response.tournamentEntryRankingSummary
			seedRanking(tournamentId, eventId, entryId, summary)
			return summary
		})
		.catch(err => {
			console.warn('[tournament stats] ranking unavailable:', err)
			return null
		})
		.finally(() => clearRankingInFlight(key))

	setRankingInFlight(key, request)
	return request
}

export function useTournamentStats({
	entryId,
	initialCurrentGameweek,
	initialTournaments,
	initialSelectedTournamentId,
	initialDataGameweek,
	initialSliceGameweek,
	initialCurrentRows,
	initialSeasonFieldRows,
	initialSeasonSnapshot = null,
	initialPreviousRows = [],
	initialRankingSummary = null,
	initialPlayerMeta = {},
	initialUsedFallbackGameweek = false,
	initialError,
	loadGameweekData = false,
	loadSeasonPath = false,
}: TournamentStatsClientProps) {
	const seasonFieldSeed =
		initialSeasonFieldRows && initialSeasonFieldRows.length > 0
			? initialSeasonFieldRows
			: initialCurrentRows
	const t = useTranslations('TournamentStats')
	const pageActive = usePageActive()

	// Hydrate session cache from SSR once after mount so render stays pure.
	const hydratedRef = useRef(false)
	useEffect(() => {
		if (hydratedRef.current) return
		hydratedRef.current = true
		const tid = Number(initialSelectedTournamentId)
		if (Number.isFinite(tid) && tid > 0 && initialDataGameweek != null) {
			buildTournamentEventResultSeeds({
				dataGameweek: initialDataGameweek,
				sliceGameweek: initialSliceGameweek,
				seasonRows: seasonFieldSeed,
				sliceRows: initialCurrentRows,
				previousRows: initialPreviousRows,
			}).forEach(seed => seedEventResults(tid, seed.eventId, seed.rows))
			if (initialSeasonSnapshot) {
				seedSeasonSnapshot(tid, initialDataGameweek, initialSeasonSnapshot)
			}
			if (initialRankingSummary) {
				seedRanking(
					tid,
					initialDataGameweek,
					entryId,
					initialRankingSummary,
				)
			}
		}
		Object.entries(initialPlayerMeta).forEach(([id, meta]) => {
			seedPlayerMeta(Number(id), meta)
		})
	}, [
		entryId,
		initialCurrentRows,
		initialDataGameweek,
		initialPlayerMeta,
		initialPreviousRows,
		initialRankingSummary,
		initialSeasonSnapshot,
		initialSelectedTournamentId,
		initialSliceGameweek,
		seasonFieldSeed,
	])

	const initialSelectedTournament =
		initialTournaments.find(
			item => String(item.id) === initialSelectedTournamentId,
		) ?? null
	const initialStats =
		initialSelectedTournament &&
		areTournamentInsightsReady(initialSelectedTournament) &&
		initialSliceGameweek !== null
			? buildTournamentStats(
					initialSelectedTournament,
					initialSliceGameweek,
					initialCurrentRows,
					initialPreviousRows,
					{ ...getAllCachedPlayerMeta(), ...initialPlayerMeta },
					entryId,
				)
			: null

	const [tournaments, setTournaments] = useState(initialTournaments)
	const [selectedTournamentId, setSelectedTournamentIdState] = useState(
		initialSelectedTournamentId,
	)
	const [dataGameweek, setDataGameweek] = useState<number | null>(
		initialDataGameweek,
	)
	const [usedFallbackGameweek, setUsedFallbackGameweek] = useState(
		initialUsedFallbackGameweek,
	)
	const [tournamentStats, setTournamentStats] =
		useState<TournamentStatsViewModel | null>(initialStats)
	const [rankingSummary, setRankingSummary] =
		useState<TournamentEntryRankingSummary | null>(initialRankingSummary)
	/** Latest-data-GW full field rows for Season dimension A (fallback) */
	const [seasonFieldRows, setSeasonFieldRows] = useState<
		TournamentEventResultItem[]
	>(() =>
		initialDataGameweek != null && seasonFieldSeed.length > 0
			? seasonFieldSeed
			: [],
	)
	/** Phase 2 server snapshot for Season dimension A (preferred) */
	const [seasonSnapshot, setSeasonSnapshot] =
		useState<TournamentSeasonSnapshotApi | null>(initialSeasonSnapshot)
	const [standingsSearch, setStandingsSearch] = useState('')
	const [isLoading, setIsLoading] = useState(false)
	const [seasonPath, setSeasonPath] = useState<TournamentPathPoint[]>([])
	const [seasonPathLoading, setSeasonPathLoading] = useState(false)
	const [error, setError] = useState<string | null>(initialError)
	const [selectedGameweek, setSelectedGameweek] = useState(
		initialSliceGameweek && initialSliceGameweek > 0
			? initialSliceGameweek
			: initialCurrentGameweek,
	)
	const currentGameweek = initialCurrentGameweek

	const selectedTournament = useMemo(
		() =>
			tournaments.find(item => String(item.id) === selectedTournamentId) ??
			null,
		[selectedTournamentId, tournaments],
	)
	const insightsReady = selectedTournament
		? areTournamentInsightsReady(selectedTournament)
		: false
	const statsLoadState = resolveTournamentStatsLoadState({
		isBootstrapping: false,
		hasSelectedTournament: Boolean(selectedTournament),
		insightsReady,
	})
	const filteredStandings = useMemo(() => {
		if (!tournamentStats) return []
		const query = standingsSearch.trim().toLowerCase()
		if (!query) return tournamentStats.standings
		return tournamentStats.standings.filter(
			row =>
				row.teamName.toLowerCase().includes(query) ||
				row.managerName.toLowerCase().includes(query),
		)
	}, [standingsSearch, tournamentStats])

	const seasonField: TournamentSeasonField | null = useMemo(() => {
		const fromSnap = buildTournamentSeasonFieldFromSnapshot(
			seasonSnapshot,
			entryId,
		)
		if (fromSnap) return fromSnap
		if (dataGameweek == null || seasonFieldRows.length === 0) return null
		return buildTournamentSeasonField(seasonFieldRows, entryId, dataGameweek)
	}, [dataGameweek, entryId, seasonFieldRows, seasonSnapshot])

	const seasonMe: TournamentSeasonMe | null = useMemo(() => {
		if (dataGameweek == null && !seasonSnapshot) return null
		const asOf =
			seasonSnapshot?.asOfEventId ??
			dataGameweek ??
			0
		if (asOf < 1) return null
		return buildTournamentSeasonMe(rankingSummary, seasonField, asOf)
	}, [dataGameweek, rankingSummary, seasonField, seasonSnapshot])

	// URL updates live in TournamentStatsClient (view/gw/tournamentId together)
	const setSelectedTournamentId = (value: string) => {
		setStandingsSearch('')
		setSelectedTournamentIdState(value)
		// Drop GW slice + season field so next load rebuilds for the new tournament
		setTournamentStats(null)
		setSeasonFieldRows([])
		setSeasonSnapshot(null)
		setRankingSummary(null)
	}

	// Setup in-flight: poll gently while page visible (review page — not Live 1s)
	useEffect(() => {
		if (
			!pageActive ||
			!selectedTournament ||
			insightsReady ||
			!isTournamentSetupInFlight(selectedTournament.setupStatus)
		) {
			return
		}

		let cancelled = false
		let timer: number | undefined
		const poll = async () => {
			try {
				const data = await executeQuery<EntryTournamentsResponse>(
					GET_ENTRY_TOURNAMENTS,
					{ entryId },
					{ cache: 'no-store' },
				)
				if (!cancelled) setTournaments(data.entryTournaments)
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
	}, [entryId, insightsReady, pageActive, selectedTournament])

	// Season materials: ranking as-of latest available GW (not tied to open GW tabs)
	useEffect(() => {
		if (statsLoadState !== 'load' || !selectedTournament) return
		let cancelled = false
		const tournament = selectedTournament

		async function loadSeasonMaterials() {
			try {
				// Resolve latest GW with data (for ranking as-of)
				let latestGameweek = initialCurrentGameweek
				let currentRows = await fetchTournamentEventResultsCached(
					tournament.id,
					latestGameweek,
				)
				let fallback = false
				// Critical path: at most one previous GW (match SSR). Avoid 1+4 full-field probes.
				if (currentRows.length === 0 && latestGameweek > 1) {
					const prevRows = await fetchTournamentEventResultsCached(
						tournament.id,
						latestGameweek - 1,
					)
					if (prevRows.length > 0) {
						latestGameweek = latestGameweek - 1
						currentRows = prevRows
						fallback = true
					}
				}
				if (cancelled) return

				setDataGameweek(currentRows.length > 0 ? latestGameweek : null)
				setUsedFallbackGameweek(fallback)
				// Dimension A fallback: keep full field rows
				setSeasonFieldRows(currentRows)

				if (currentRows.length === 0) {
					setRankingSummary(null)
					setSeasonSnapshot(null)
					return
				}

				// Phase 2: snapshot (field) + ranking (me + gaps) in parallel
				const [ranking, snapshot] = await Promise.all([
					fetchRankingCached(tournament.id, latestGameweek, entryId),
					fetchTournamentSeasonSnapshotCached(
						tournament.id,
						latestGameweek,
					),
				])
				if (cancelled) return
				setRankingSummary(ranking)
				setSeasonSnapshot(snapshot)

				// Keep selectedGameweek default aligned to latest if unset
				setSelectedGameweek(prev => (prev > 0 ? prev : latestGameweek))
			} catch (err) {
				console.error('[tournament stats] season materials failed:', err)
				if (!cancelled) setError(t('loadFailed'))
			}
		}

		// Skip if SSR already seeded this tournament field + ranking
		if (
			rankingSummary &&
			(seasonSnapshot || seasonFieldRows.length > 0) &&
			selectedTournament.id === Number(initialSelectedTournamentId) &&
			dataGameweek != null
		) {
			return
		}

		void loadSeasonMaterials()
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [entryId, initialCurrentGameweek, selectedTournament, statsLoadState, t])

	// Gameweek slice — only while GW view is active
	useEffect(() => {
		if (!loadGameweekData) {
			setIsLoading(false)
			return
		}
		if (statsLoadState !== 'load' || !selectedTournament) return
		if (selectedGameweek < 1) return

		let cancelled = false
		const tournament = selectedTournament
		const gw = selectedGameweek

		// Already showing this tournament+gw
		if (
			tournamentStats?.tournament.id === tournament.id &&
			tournamentStats.currentGameweek === gw
		) {
			setIsLoading(false)
			return
		}

		async function loadGw() {
			setIsLoading(true)
			setError(null)
			try {
				const currentRows = await fetchTournamentEventResultsCached(
					tournament.id,
					gw,
				)
				if (cancelled) return
				const captainIds = currentRows
					.map(row => row.captainId)
					.filter((value): value is number => value !== null && value > 0)
				const [previousRows, playerMeta] = await Promise.all([
					gw > 1
						? fetchTournamentEventResultsCached(tournament.id, gw - 1)
						: Promise.resolve([] as TournamentEventResultItem[]),
					fetchPlayerMetaByIds(captainIds),
				])
				if (cancelled) return
				setTournamentStats(
					buildTournamentStats(
						tournament,
						gw,
						currentRows,
						previousRows,
						{ ...getAllCachedPlayerMeta(), ...playerMeta },
						entryId,
					),
				)
			} catch (err) {
				console.error('[tournament stats] gameweek load failed:', err)
				if (!cancelled) {
					setTournamentStats(null)
					setError(t('loadFailed'))
				}
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		}

		void loadGw()
		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		entryId,
		loadGameweekData,
		selectedGameweek,
		selectedTournament,
		statsLoadState,
		t,
	])

	// Deferred season path — Season tab only (multi-GW fetch; keep off critical GW path)
	useEffect(() => {
		if (
			!loadSeasonPath ||
			!selectedTournament ||
			!insightsReady ||
			dataGameweek == null
		) {
			if (!loadSeasonPath) setSeasonPathLoading(false)
			return
		}
		const fromGw =
			selectedTournament.groupStartedEventId ??
			selectedTournament.knockoutStartedEventId ??
			1
		const toGw = dataGameweek
		if (toGw < fromGw) {
			setSeasonPath([])
			return
		}

		let cancelled = false
		setSeasonPathLoading(true)
		void loadTournamentSeasonPath({
			tournamentId: selectedTournament.id,
			entryId,
			fromGw: Math.max(1, fromGw),
			toGw,
			onProgress: points => {
				if (!cancelled) setSeasonPath(points)
			},
		})
			.then(points => {
				if (!cancelled) setSeasonPath(points)
			})
			.catch(err => {
				console.warn('[tournament stats] season path failed:', err)
			})
			.finally(() => {
				if (!cancelled) setSeasonPathLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [
		dataGameweek,
		entryId,
		insightsReady,
		loadSeasonPath,
		selectedTournament,
	])

	return {
		currentGameweek,
		dataGameweek,
		error,
		filteredStandings,
		insightsReady,
		isBootstrapping: false,
		isLoading,
		rankingSummary,
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
	}
}
