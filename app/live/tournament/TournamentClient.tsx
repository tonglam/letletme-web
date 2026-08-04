'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { PlayerOwnershipFilter } from '@/components/player/PlayerOwnershipFilter'
import { TeamExposureFilter } from '@/components/player/TeamExposureFilter'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Card } from '@/components/ui/card'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_SNAPSHOT,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_POINTS,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import { usePageActive } from '@/hooks/use-page-active'
import {
	liveSnapshotNeedsRefresh,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import {
	buildTournamentEntries,
	buildTournamentStats,
	mergePartialTournamentRows,
	type LiveTournamentStats
} from '@/lib/tournament/liveEntries'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import {
	areTournamentStandingsReady,
	isTournamentSetupInFlight
} from '@/lib/tournament/lifecycle'
import { Tournament } from '@/types/tournament'
import { Link, useRouter } from '@/i18n/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const fetchLivePoints = async (
	tournamentId: number,
	eventId: number
): Promise<{
	rows: TournamentLiveCalcData[]
	failedCount: number
	failedEntryIds: number[]
	totalEntries: number
	snapshot: LiveSnapshotStatus | null
}> => {
	const response = await executeQuery<TournamentLivePointsResponse>(
		GET_TOURNAMENT_LIVE_POINTS,
		{ tournamentId, eventId }
	)
	const batch = response.calcLivePointsForTournament
	return {
		rows: batch.results ?? [],
		failedCount: batch.meta.failedCount,
		failedEntryIds: batch.errors.map(error => error.entryId),
		totalEntries: batch.meta.totalEntries,
		snapshot: response.liveSnapshot
	}
}

interface TournamentClientProps {
	entryId: number
	initialTournaments?: Tournament[]
	initialSelectedTournamentId?: string
	initialEventId: number
	initialCurrentRows?: TournamentLiveCalcData[]
	initialResultsLoaded?: boolean
	initialResultsError?: string | null
	initialSnapshot?: LiveSnapshotStatus | null
}

export default function TournamentClient({
	entryId,
	initialTournaments = [],
	initialSelectedTournamentId = '',
	initialEventId,
	initialCurrentRows = [],
	initialResultsLoaded = false,
	initialResultsError = null,
	initialSnapshot
}: TournamentClientProps) {
	const t = useTranslations('LiveTournament')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const isPageActive = usePageActive()
	const router = useRouter()
	const searchParams = useSearchParams()

	const [searchQuery, setSearchQuery] = useState<string>('')
	const [chipFilter, setChipFilter] = useState<string>('all')
	const [captainFilter, setCaptainFilter] = useState<string>('all')
	const [tournaments, setTournaments] =
		useState<Tournament[]>(initialTournaments)
	const [loadError, setLoadError] = useState<string | null>(null)
	const [resultsError, setResultsError] =
		useState<string | null>(initialResultsError)
	const [isLoadingTournaments, setIsLoadingTournaments] = useState<boolean>(
		entryId > 0 && initialTournaments.length === 0
	)
	const [isLoadingResults, setIsLoadingResults] = useState<boolean>(false)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const [currentGameweek] = useState<number>(initialEventId)
	const [selectedGameweek, setSelectedGameweek] =
		useState<number>(initialEventId)
	const [selectedRows, setSelectedRows] =
		useState<TournamentLiveCalcData[]>(initialCurrentRows)
	const selectedEntries = useMemo(
		() => buildTournamentEntries(selectedRows),
		[selectedRows]
	)
	const [ownershipMatchedEntryIds, setOwnershipMatchedEntryIds] = useState<
		string[] | null
	>(null)
	const [teamExposureMatchedEntryIds, setTeamExposureMatchedEntryIds] =
		useState<string[] | null>(null)
	const selectedStats: LiveTournamentStats = useMemo(
		() => buildTournamentStats(selectedEntries),
		[selectedEntries]
	)
	const initialResultsKeyRef = useRef(
		initialResultsLoaded && initialSelectedTournamentId && initialEventId
			? `${initialSelectedTournamentId}:${initialEventId}`
			: null
	)
	const resultsRequestIdRef = useRef(0)
	const failedEntryCountRef = useRef(initialResultsError ? 1 : 0)
	const resultsInFlightRef = useRef<{
		key: string
		promise: Promise<void>
	} | null>(null)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])

	const tournamentIdFromUrl = searchParams.get('tournamentId')

	const selectedTournament = useMemo(() => {
		const currentTournament = tournaments.find(
			t => t.id === (tournamentIdFromUrl ?? initialSelectedTournamentId)
		)
		return currentTournament ?? tournaments[0] ?? null
	}, [initialSelectedTournamentId, tournamentIdFromUrl, tournaments])
	const standingsReady = selectedTournament
		? areTournamentStandingsReady(selectedTournament)
		: false

	const loadTournamentResults = useCallback(
		(
			tournamentId: number,
			eventId: number,
			options: { preserveOnError: boolean }
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
					const currentBatch = await fetchLivePoints(tournamentId, eventId)
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
					acceptSnapshot(currentBatch.snapshot)
					setSelectedRows(previousRows =>
						mergePartialTournamentRows({
							nextRows: currentBatch.rows,
							previousRows,
							failedEntryIds: currentBatch.failedEntryIds,
							preserveFailed: options.preserveOnError
						})
					)
				} catch {
					if (requestId !== resultsRequestIdRef.current) return
					setResultsError(t('standingsFailed'))
					if (!options.preserveOnError) {
						setSelectedRows([])
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
		[acceptSnapshot, t]
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
		if (
			!isPageActive ||
			!selectedTournament ||
			standingsReady ||
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
					{ cache: 'no-store' }
				)
				if (!cancelled) {
					setTournaments(
						data.entryTournaments.map(mapEntryTournamentToLiveTournament)
					)
				}
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
	}, [entryId, isPageActive, selectedTournament, standingsReady])

	useEffect(() => {
		if (!selectedTournament || !standingsReady || selectedGameweek === undefined) {
			resultsRequestIdRef.current += 1
			const resetTimer = window.setTimeout(() => {
				setIsLoadingResults(false)
				setResultsError(null)
				setSelectedRows([])
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}
		const resultsKey = `${selectedTournament.id}:${selectedGameweek}`
		if (initialResultsKeyRef.current === resultsKey) {
			initialResultsKeyRef.current = null
			return
		}

		acceptSnapshot(null)
		void loadTournamentResults(
			Number(selectedTournament.id),
			selectedGameweek,
			{
				preserveOnError: false
			}
		)
	}, [
		acceptSnapshot,
		loadTournamentResults,
		selectedGameweek,
		selectedTournament,
		standingsReady
	])

	useEffect(() => {
		const resetTimer = window.setTimeout(() => {
			setOwnershipMatchedEntryIds(null)
			setTeamExposureMatchedEntryIds(null)
		}, 0)
		return () => window.clearTimeout(resetTimer)
	}, [selectedGameweek, selectedTournament?.id])

	const displayGameweek = selectedGameweek
	const autoRefreshEnabled = shouldPollLiveSnapshot({
		isPageActive,
		currentEventId: currentGameweek,
		selectedEventId: selectedGameweek,
		snapshot
	})
	const refreshTournamentResults = useCallback(async () => {
		if (!selectedTournament) return
		await loadTournamentResults(
			Number(selectedTournament.id),
			selectedGameweek,
			{
				preserveOnError: true
			}
		)
	}, [loadTournamentResults, selectedGameweek, selectedTournament])
	const autoRefreshTournamentResults = useCallback((): Promise<void> => {
		if (!selectedTournament) return Promise.resolve()
		if (freshnessRequestRef.current) return freshnessRequestRef.current

		const requestId = resultsRequestIdRef.current
		const request = (async () => {
			try {
				const probe = await executeQuery<LiveSnapshotResponse>(
					GET_LIVE_SNAPSHOT,
					{ eventId: selectedGameweek },
					{ cache: 'no-store' }
				)
				if (requestId !== resultsRequestIdRef.current) return
				if (!liveSnapshotNeedsRefresh(snapshotRef.current, probe.liveSnapshot)) {
					acceptSnapshot(probe.liveSnapshot)
					if (failedEntryCountRef.current === 0) setResultsError(null)
					return
				}
				await refreshTournamentResults()
			} catch (probeError) {
				if (requestId !== resultsRequestIdRef.current) return
				console.error(
					'Failed to check live tournament freshness:',
					probeError
				)
				setResultsError(t('standingsFailed'))
			}
		})()
		freshnessRequestRef.current = request
		void request.finally(() => {
			if (freshnessRequestRef.current === request) {
				freshnessRequestRef.current = null
			}
		})
		return request
	}, [
		acceptSnapshot,
		refreshTournamentResults,
		selectedGameweek,
		selectedTournament,
		t
	])
	const captainOptions = useMemo(
		() =>
			Array.from(
				new Set(
					selectedEntries
						.map(entry => entry.captainName)
						.filter(name => !!name && name !== 'N/A')
				)
			).sort((a, b) => a.localeCompare(b)),
		[selectedEntries]
	)

	const handleOwnershipMatchedEntryIdsChange = useCallback(
		(entryIds: string[] | null) => {
			setOwnershipMatchedEntryIds(entryIds)
		},
		[]
	)

	const handleTeamExposureMatchedEntryIdsChange = useCallback(
		(entryIds: string[] | null) => {
			setTeamExposureMatchedEntryIds(entryIds)
		},
		[]
	)

	const ownershipMatchedEntrySet = useMemo(
		() => (ownershipMatchedEntryIds ? new Set(ownershipMatchedEntryIds) : null),
		[ownershipMatchedEntryIds]
	)

	const teamExposureMatchedEntrySet = useMemo(
		() =>
			teamExposureMatchedEntryIds ? new Set(teamExposureMatchedEntryIds) : null,
		[teamExposureMatchedEntryIds]
	)

	const filteredEntries = useMemo(() => {
		const query = searchQuery.trim().toLowerCase()
		const captainQuery = captainFilter.trim().toLowerCase()
		return selectedEntries.filter(entry => {
			const matchesSearch =
				query.length === 0 ||
				entry.teamName.toLowerCase().includes(query) ||
				entry.managerName.toLowerCase().includes(query)

			const matchesChip =
				chipFilter === 'all' ||
				(chipFilter === 'triple' && entry.chips.triple) ||
				(chipFilter === 'bench' && entry.chips.bench) ||
				(chipFilter === 'wildcard' && entry.chips.wildcard)

			const matchesCaptain =
				captainFilter === 'all' ||
				captainQuery.length === 0 ||
				entry.captainName.toLowerCase() === captainQuery

			const matchesOwnership =
				ownershipMatchedEntrySet === null ||
				ownershipMatchedEntrySet.has(entry.id)

			const matchesTeamExposure =
				teamExposureMatchedEntrySet === null ||
				teamExposureMatchedEntrySet.has(entry.id)

			return (
				matchesSearch &&
				matchesChip &&
				matchesCaptain &&
				matchesOwnership &&
				matchesTeamExposure
			)
		})
	}, [
		captainFilter,
		chipFilter,
		ownershipMatchedEntrySet,
		teamExposureMatchedEntrySet,
		searchQuery,
		selectedEntries
	])

	if (entryId <= 0) {
		return (
			<PageShell>
				<div className="container max-w-4xl mx-auto px-4 py-8">
					<Card className="p-6 text-sm text-muted-foreground">
						{t('signInPrompt')}{' '}
						<Link
							href="/auth/login?next=/live/tournament"
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
			<div className="container max-w-4xl mx-auto px-4 py-8">
				{loadError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{loadError}
					</Card>
				)}

				{resultsError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{resultsError}
					</Card>
				)}

				{tournaments.length > 0 && selectedTournament && (
					<TournamentSelector
						tournaments={tournaments}
						currentTournamentId={selectedTournament.id}
						onTournamentChange={id => {
							router.push(`/live/tournament?tournamentId=${id}`)
						}}
					/>
				)}

				<Card className="p-4 mb-6">
					<GameweekSelector
						onGameweekChange={setSelectedGameweek}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={isLoadingResults || Boolean(selectedTournament && !standingsReady)}
					/>
					<div className="mt-2 flex justify-end">
						<LiveAutoRefreshCountdown
							enabled={autoRefreshEnabled}
							onRefresh={autoRefreshTournamentResults}
							renderLabel={seconds => t('nextRefresh', { seconds })}
						/>
					</div>
				</Card>

				{isLoadingTournaments && (
					<Card className="p-6 text-sm text-muted-foreground">
						{t('loadingTournaments')}
					</Card>
				)}

				{!isLoadingTournaments && !selectedTournament && (
					<Card className="p-6 text-sm text-muted-foreground">
						{t('noTournaments')}
					</Card>
				)}

				{selectedTournament && !standingsReady && (
					<Card className="p-8 text-center">
						<p className="font-semibold">
							{selectedTournament.setupStatus === 'FAILED'
								? lifecycleT('memberFailure')
								: lifecycleT('standingsPreparing')}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{selectedTournament.setupStatus === 'FAILED'
								? lifecycleT('insightsLoading')
								: lifecycleT('standingsPreparingDescription')}
						</p>
					</Card>
				)}

				{selectedTournament && standingsReady && (
					<>
						<TournamentHeader
							name={selectedTournament.name}
							averagePoints={selectedStats.averagePoints}
							highestPoints={selectedStats.highestPoints}
							totalEntries={
								selectedStats.totalEntries || selectedTournament.totalEntries
							}
						/>

						<SearchHeader
							searchQuery={searchQuery}
							setSearchQuery={setSearchQuery}
							captainOptions={captainOptions}
							chipFilter={chipFilter}
							onChipFilterChange={setChipFilter}
							captainFilter={captainFilter}
							onCaptainFilterChange={setCaptainFilter}
						/>

						{isLoadingResults ? (
							<Card className="p-6 text-sm text-muted-foreground mb-6">
								{t('loadingStandings')}
							</Card>
						) : (
							<>
								<PlayerOwnershipFilter
									key={`${selectedTournament.id}-${displayGameweek}`}
									entries={selectedEntries}
									onMatchedEntryIdsChange={handleOwnershipMatchedEntryIdsChange}
								/>

								<TeamExposureFilter
									key={`team-${selectedTournament.id}-${displayGameweek}`}
									entries={selectedEntries}
									onMatchedEntryIdsChange={
										handleTeamExposureMatchedEntryIdsChange
									}
								/>

								<TournamentTable
									entries={filteredEntries}
									searchQuery=""
									tournamentId={selectedTournament.id}
									gameweek={displayGameweek}
								/>
							</>
						)}
					</>
				)}
			</div>
		</PageShell>
	)
}
