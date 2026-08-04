'use client'

import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
	GET_TOURNAMENT_EVENT_RESULTS,
	type EntryTournament,
	type EntryTournamentsResponse,
	type TournamentEntryRankingSummary,
	type TournamentEntryRankingSummaryResponse,
	type TournamentEventResultItem,
	type TournamentEventResultsResponse,
} from '@/lib/graphql/operations/tournaments'
import { usePageActive } from '@/hooks/use-page-active'
import {
	areTournamentInsightsReady,
	isTournamentSetupInFlight,
} from '@/lib/tournament/lifecycle'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { fetchPlayerMetaByIds } from '../_lib/tournament-stats-data'
import {
	buildTournamentStats,
	type PlayerMeta,
	type TournamentStatsViewModel,
} from '../_lib/tournament-stats-model'

export interface TournamentStatsClientProps {
	entryId: number
	initialCurrentGameweek: number
	initialTournaments: EntryTournament[]
	initialSelectedTournamentId: string
	initialDataGameweek: number | null
	initialCurrentRows: TournamentEventResultItem[]
	initialError: string | null
}

const MAX_CACHE_ENTRIES = 100

function setBoundedCache<K, V>(cache: Map<K, V>, key: K, value: V) {
	if (!cache.has(key) && cache.size >= MAX_CACHE_ENTRIES) {
		const oldestKey = cache.keys().next().value as K | undefined
		if (oldestKey !== undefined) cache.delete(oldestKey)
	}
	cache.set(key, value)
}

export function useTournamentStats({
	entryId,
	initialCurrentGameweek,
	initialTournaments,
	initialSelectedTournamentId,
	initialDataGameweek,
	initialCurrentRows,
	initialError,
}: TournamentStatsClientProps) {
	const t = useTranslations('TournamentStats')
	const pageActive = usePageActive()
	const initialSelectedTournament =
		initialTournaments.find((item) => String(item.id) === initialSelectedTournamentId) ?? null
	const initialStats =
		initialSelectedTournament &&
		areTournamentInsightsReady(initialSelectedTournament) &&
		initialDataGameweek !== null
			? buildTournamentStats(
					initialSelectedTournament,
					initialDataGameweek,
					initialCurrentRows,
					[],
					{},
					entryId,
				)
			: null

	const [tournaments, setTournaments] = useState(initialTournaments)
	const [selectedTournamentId, setSelectedTournamentId] = useState(initialSelectedTournamentId)
	const [dataGameweek, setDataGameweek] = useState<number | null>(initialDataGameweek)
	const [tournamentStats, setTournamentStats] = useState<TournamentStatsViewModel | null>(initialStats)
	const [rankingSummary, setRankingSummary] = useState<TournamentEntryRankingSummary | null>(null)
	const [standingsSearch, setStandingsSearch] = useState('')
	const [isBootstrapping, setIsBootstrapping] = useState(initialTournaments.length === 0 && entryId > 0)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(initialError)
	const eventResultsCacheRef = useRef<Map<string, TournamentEventResultItem[]>>(
		(() => {
			const cache = new Map<string, TournamentEventResultItem[]>()
			if (
				initialSelectedTournamentId &&
				initialSelectedTournament &&
				areTournamentInsightsReady(initialSelectedTournament) &&
				initialDataGameweek !== null
			) {
				cache.set(`${initialSelectedTournamentId}:${initialDataGameweek}`, initialCurrentRows)
			}
			return cache
		})(),
	)
	const playerMetaCacheRef = useRef<Map<number, PlayerMeta>>(new Map())
	const rankingSummaryCacheRef = useRef<Map<string, TournamentEntryRankingSummary>>(new Map())

	const selectedTournament = useMemo(
		() => tournaments.find((item) => String(item.id) === selectedTournamentId) ?? null,
		[selectedTournamentId, tournaments],
	)
	const insightsReady = selectedTournament
		? areTournamentInsightsReady(selectedTournament)
		: false
	const filteredStandings = useMemo(() => {
		if (!tournamentStats) return []
		const query = standingsSearch.trim().toLowerCase()
		if (!query) return tournamentStats.standings
		return tournamentStats.standings.filter(
			(row) => row.teamName.toLowerCase().includes(query) || row.managerName.toLowerCase().includes(query),
		)
	}, [standingsSearch, tournamentStats])

	useEffect(() => {
		let cancelled = false
		if (initialTournaments.length > 0) return

		if (!entryId) {
			const resetTimer = window.setTimeout(() => {
				if (cancelled) return
				setTournaments([])
				setSelectedTournamentId('')
				setIsBootstrapping(false)
			}, 0)
			return () => {
				cancelled = true
				window.clearTimeout(resetTimer)
			}
		}

		async function bootstrap() {
			try {
				setIsBootstrapping(true)
				setError(null)
				const data = await executeQuery<EntryTournamentsResponse>(GET_ENTRY_TOURNAMENTS, { entryId })
				if (cancelled) return
				setTournaments(data.entryTournaments)
				setSelectedTournamentId((previous) => previous || String(data.entryTournaments[0]?.id ?? ''))
			} catch (loadError) {
				console.error('Failed to bootstrap tournament stats:', loadError)
				if (!cancelled) setError(t('listFailed'))
			} finally {
				if (!cancelled) setIsBootstrapping(false)
			}
		}

		void bootstrap()
		return () => {
			cancelled = true
		}
		}, [entryId, initialTournaments.length, t])

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
				const data = await executeQuery<EntryTournamentsResponse>(GET_ENTRY_TOURNAMENTS, {
					entryId,
				})
				if (!cancelled) setTournaments(data.entryTournaments)
			} catch (pollError) {
				console.warn('Tournament setup status unavailable:', pollError)
			} finally {
				if (!cancelled) timer = window.setTimeout(poll, 5_000)
			}
		}

		timer = window.setTimeout(poll, 5_000)
		return () => {
			cancelled = true
			if (timer !== undefined) window.clearTimeout(timer)
		}
	}, [entryId, insightsReady, pageActive, selectedTournament])

	useEffect(() => {
		if (isBootstrapping || !selectedTournament || !insightsReady) return
		let cancelled = false
		const tournament = selectedTournament

		async function loadStats() {
			try {
				setIsLoading(true)
				setError(null)
				setTournamentStats((current) => current?.tournament.id === tournament.id ? current : null)
				setRankingSummary(null)

				const fetchResults = async (eventId: number): Promise<TournamentEventResultItem[]> => {
					if (eventId <= 0) return []
					const cacheKey = `${tournament.id}:${eventId}`
					const cached = eventResultsCacheRef.current.get(cacheKey)
					if (cached) return cached
					const response = await executeQuery<TournamentEventResultsResponse>(
						GET_TOURNAMENT_EVENT_RESULTS,
						{ tournamentId: tournament.id, eventId },
					)
					const rows = response.tournamentEventResults ?? []
					setBoundedCache(eventResultsCacheRef.current, cacheKey, rows)
					return rows
				}

				let latestGameweek = initialCurrentGameweek
				let currentRows = await fetchResults(initialCurrentGameweek)
				if (currentRows.length === 0) {
					for (let offset = 1; offset <= 4; offset += 1) {
						const fallbackGameweek = initialCurrentGameweek - offset
						if (fallbackGameweek <= 0) break
						const fallbackRows = await fetchResults(fallbackGameweek)
						if (cancelled) return
						if (fallbackRows.length > 0) {
							latestGameweek = fallbackGameweek
							currentRows = fallbackRows
							break
						}
					}
				}

				if (cancelled) return
				if (currentRows.length === 0) {
					setDataGameweek(initialCurrentGameweek)
					setTournamentStats(buildTournamentStats(tournament, initialCurrentGameweek, [], [], {}, entryId))
					return
				}

				const fetchRankingSummary = async () => {
					const cacheKey = `${tournament.id}:${latestGameweek}:${entryId}`
					const cached = rankingSummaryCacheRef.current.get(cacheKey)
					if (cached) return cached
					const response = await executeQuery<TournamentEntryRankingSummaryResponse>(
						GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
						{ tournamentId: tournament.id, eventId: latestGameweek, entryId },
					)
					setBoundedCache(rankingSummaryCacheRef.current, cacheKey, response.tournamentEntryRankingSummary)
					return response.tournamentEntryRankingSummary
				}

				const [previousRows, fetchedRankingSummary] = await Promise.all([
					fetchResults(latestGameweek - 1),
					fetchRankingSummary().catch((rankingError) => {
						console.warn('Ranking summary unavailable:', rankingError)
						return null
					}),
				])
				if (cancelled) return

				const captainIds = currentRows
					.map((row) => row.captainId)
					.filter((value): value is number => value !== null && value > 0)
				const missingCaptainIds = Array.from(new Set(captainIds)).filter(
					(id) => !playerMetaCacheRef.current.has(id),
				)
				if (missingCaptainIds.length > 0) {
					const playerMeta = await fetchPlayerMetaByIds(missingCaptainIds)
					if (cancelled) return
					Object.entries(playerMeta).forEach(([id, value]) =>
						setBoundedCache(playerMetaCacheRef.current, Number(id), value),
					)
				}

				setDataGameweek(latestGameweek)
				setRankingSummary(fetchedRankingSummary)
				setTournamentStats(
					buildTournamentStats(
						tournament,
						latestGameweek,
						currentRows,
						previousRows,
						Object.fromEntries(playerMetaCacheRef.current.entries()),
						entryId,
					),
				)
			} catch (loadError) {
				console.error('Failed to load tournament stats:', loadError)
				if (!cancelled) {
					setTournamentStats(null)
					setRankingSummary(null)
					setError(t('loadFailed'))
				}
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		}

		void loadStats()
		return () => {
			cancelled = true
		}
	}, [entryId, initialCurrentGameweek, insightsReady, isBootstrapping, selectedTournament, t])

	return {
		dataGameweek,
		error,
		filteredStandings,
		insightsReady,
		isBootstrapping,
		isLoading,
		rankingSummary,
		selectedTournament,
		selectedTournamentId,
		setSelectedTournamentId: (value: string) => {
			setStandingsSearch('')
			setSelectedTournamentId(value)
		},
		setStandingsSearch,
		standingsSearch,
		tournamentStats,
		tournaments,
	}
}
