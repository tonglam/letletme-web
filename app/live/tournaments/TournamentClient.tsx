'use client'

import { GameweekSelector } from '@/components/data/GameweekSelector'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { GameweekBadge } from '@/components/stats/GameweekBadge'
import { StatsPageHeader } from '@/components/stats/StatsSurfaces'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { PlayerOwnershipFilter } from '@/components/player/PlayerOwnershipFilter'
import { TeamExposureFilter } from '@/components/player/TeamExposureFilter'
import { MobileCollapsibleFilters } from '@/components/tournament/MobileCollapsibleFilters'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentSelector } from '@/components/tournament/TournamentSelector'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { ShareActions } from '@/components/share/ShareActions'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	GET_ENTRY_TOURNAMENTS,
	GET_TOURNAMENT_LIVE_DESK,
	type EntryTournamentsResponse,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import { usePageActive } from '@/hooks/use-page-active'
import {
	liveSnapshotNeedsRefresh,
	liveContextToSnapshot,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import {
	buildTournamentEntries,
	buildTournamentStats,
	getRetainedFailedEntryIds,
	mergePartialTournamentRows,
	type LiveTournamentStats
} from '@/lib/tournament/liveEntries'
import { mapEntryTournamentToLiveTournament } from '@/lib/tournament/liveTournament'
import {
	areTournamentStandingsReady,
	isTournamentSetupInFlight
} from '@/lib/tournament/lifecycle'
import { Tournament, type TournamentEntry } from '@/types/tournament'
import { Link, useRouter } from '@/i18n/navigation'
import { RefreshCw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
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
		response = await executeQuery<TournamentLivePointsResponse>(
			GET_TOURNAMENT_LIVE_DESK,
			{ entryId, selectedTournamentId: tournamentId, ref: null }
		)
	}
	const batch = response.entryLiveCompetitionsDesk
	return {
		rows: batch.board ?? [],
		failedCount: batch.failedEntryIds.length,
		failedEntryIds: batch.failedEntryIds,
		totalEntries: batch.totalEntries,
		snapshot: batch.revision
			? {
					eventId: batch.eventId,
					revision: batch.revision,
					state: 'LIVE' as const,
					publishedAt: new Date().toISOString(),
					checkedAt: new Date().toISOString()
				}
			: null
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
	const [resultsError, setResultsError] = useState<string | null>(
		initialResultsError
	)
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
	const [tableEntriesForShare, setTableEntriesForShare] = useState<
		TournamentEntry[]
	>([])
	const [staleEntryIds, setStaleEntryIds] = useState<ReadonlySet<number>>(
		() => new Set()
	)
	const selectedEntries = useMemo(
		() =>
			buildTournamentEntries(selectedRows, {
				staleEntryIds: staleEntryIds.size > 0 ? staleEntryIds : undefined
			}),
		[selectedRows, staleEntryIds]
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
	const shareRef = useRef<HTMLDivElement | null>(null)
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])

	const tournamentIdFromUrl = searchParams.get('tournamentId')

	const requestedTournamentId =
		(tournamentIdFromUrl ?? initialSelectedTournamentId) || null
	const selectedTournament = useMemo(() => {
		if (tournaments.length === 0) return null
		if (requestedTournamentId) {
			return tournaments.find(t => t.id === requestedTournamentId) ?? null
		}
		return tournaments[0] ?? null
	}, [requestedTournamentId, tournaments])
	/** URL asked for a tournament that is not in this entry's membership list. */
	const unknownTournamentFromUrl = Boolean(
		tournamentIdFromUrl &&
		tournaments.length > 0 &&
		!tournaments.some(t => t.id === tournamentIdFromUrl)
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
						options.revision ?? snapshotRef.current?.revision ?? null
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
						setStaleEntryIds(new Set())
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
		if (
			!selectedTournament ||
			!standingsReady ||
			selectedGameweek === undefined
		) {
			// Invalidate any in-flight standings fetch for a previous selection.
			resultsRequestIdRef.current += 1
			resultsInFlightRef.current = null
			const resetTimer = window.setTimeout(() => {
				setIsLoadingResults(false)
				setResultsError(null)
				setSelectedRows([])
				setStaleEntryIds(new Set())
			}, 0)
			return () => window.clearTimeout(resetTimer)
		}
		const resultsKey = `${selectedTournament.id}:${selectedGameweek}`
		if (initialResultsKeyRef.current === resultsKey) {
			initialResultsKeyRef.current = null
			return
		}

		// UX: drop previous tournament/GW rows in the same turn as selection change
		// so we never paint "new header + old standings" for a frame.
		resultsRequestIdRef.current += 1
		resultsInFlightRef.current = null
		setSelectedRows([])
		setStaleEntryIds(new Set())
		setResultsError(null)
		setIsLoadingResults(true)
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
		// Reset filters as soon as the tournament or GW changes (not after fetch).
		setTableEntriesForShare([])
		const resetTimer = window.setTimeout(() => {
			setSearchQuery('')
			setChipFilter('all')
			setCaptainFilter('all')
			setOwnershipMatchedEntryIds(null)
			setTeamExposureMatchedEntryIds(null)
		}, 0)
		return () => window.clearTimeout(resetTimer)
	}, [selectedGameweek, selectedTournament?.id])

	const displayGameweek = selectedGameweek
	const autoRefreshEnabled =
		standingsReady &&
		shouldPollLiveSnapshot({
			isPageActive,
			currentEventId: currentGameweek,
			selectedEventId: selectedGameweek,
			snapshot
		})
	const refreshTournamentResults = useCallback(
		async (revision?: string | null) => {
			if (!selectedTournament) return
			await loadTournamentResults(
				Number(selectedTournament.id),
				selectedGameweek,
				{
					preserveOnError: true,
					revision: revision ?? snapshotRef.current?.revision ?? null
				}
			)
		},
		[loadTournamentResults, selectedGameweek, selectedTournament]
	)
	const autoRefreshTournamentResults = useCallback((): Promise<void> => {
		if (!selectedTournament || !standingsReady) return Promise.resolve()
		if (freshnessRequestRef.current) return freshnessRequestRef.current

		const requestId = resultsRequestIdRef.current
		const request = (async () => {
			try {
				const probe = await executeQuery<LiveContextResponse>(
					GET_LIVE_CONTEXT,
					undefined,
					{ cache: 'no-store' }
				)
				if (requestId !== resultsRequestIdRef.current) return
				const observedSnapshot = liveContextToSnapshot(probe.liveContext)
				if (!liveSnapshotNeedsRefresh(snapshotRef.current, observedSnapshot)) {
					acceptSnapshot(observedSnapshot)
					if (failedEntryCountRef.current === 0) setResultsError(null)
					return
				}
				await refreshTournamentResults(observedSnapshot?.revision ?? null)
			} catch (probeError) {
				if (requestId !== resultsRequestIdRef.current) return
				console.error('Failed to check live tournament freshness:', probeError)
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
		selectedTournament,
		standingsReady,
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

	const handleTableEntriesForShareChange = useCallback(
		(entries: TournamentEntry[]) => {
			setTableEntriesForShare(entries)
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
				(chipFilter === 'wildcard' && entry.chips.wildcard) ||
				(chipFilter === 'freehit' && entry.chips.freeHit)

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
	const shareText = useMemo(() => {
		const name = selectedTournament?.name ?? t('liveStandings')
		const lines = [
			`# ${name} · GW${displayGameweek}`,
			`${t('averageScore')}: ${selectedStats.averagePoints} · ${t('highestScore')}: ${selectedStats.highestPoints}`,
			'',
			t('standings')
		]
		const entriesInTableOrder =
			tableEntriesForShare.length > 0
				? tableEntriesForShare
				: filteredEntries.slice(0, 20)
		for (const entry of entriesInTableOrder.slice(0, 20)) {
			lines.push(
				`- ${entry.rank || '—'} ${entry.teamName} · ${entry.gwPoints} GW · ${entry.totalPoints} total`
			)
		}
		lines.push(
			'',
			typeof window !== 'undefined'
				? window.location.href
				: 'https://letletme.top/live/competitions'
		)
		return lines.join('\n')
	}, [
		displayGameweek,
		filteredEntries,
		selectedStats,
		selectedTournament,
		t,
		tableEntriesForShare
	])

	if (entryId <= 0) {
		return (
			<PageShell>
				<div className="container mx-auto max-w-4xl px-4 py-8">
					<StatsPageHeader
						eyebrow={t('liveStandings')}
						title={t('liveStandings')}
					/>
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
						selectedTournament && standingsReady && !isLoadingResults
					)}
					audienceHint="session-hint"
					goodMs={1000}
					poorMs={1500}
					readyKey={`${selectedTournament?.id ?? 'none'}:${selectedGameweek ?? 'none'}`}
				/>
				<StatsPageHeader
					eyebrow={t('liveStandings')}
					title={t('liveStandings')}
					badge={
						<div className="flex items-center gap-2">
							{selectedTournament && standingsReady ? (
								<ShareActions
									text={shareText}
									imageRef={shareRef}
									title={selectedTournament.name}
								/>
							) : null}
							{selectedGameweek ? (
								<GameweekBadge gameweek={selectedGameweek} />
							) : null}
						</div>
					}
				/>

				{loadError && (
					<Card className="mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
						{loadError}
					</Card>
				)}

				{unknownTournamentFromUrl && (
					<Card className="mb-6 space-y-3 border-border/80 p-4 text-sm shadow-sm">
						<p className="text-muted-foreground">{t('competitionNotInList')}</p>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								size="sm"
								variant="outline"
								onClick={() => router.replace('/live/competitions')}
							>
								{t('clear')}
							</Button>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								asChild
							>
								<Link
									href="/competitions/browse"
									prefetch={false}
								>
									{t('errorCtaMyCompetitions')}
								</Link>
							</Button>
						</div>
					</Card>
				)}

				{resultsError && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{resultsError}
					</Card>
				)}

				{/* Always offer the membership list so a bad ?tournamentId= can be corrected in-place. */}
				{tournaments.length > 0 && (
					<TournamentSelector
						tournaments={tournaments}
						// Unknown URL id: force a non-matching value so every membership stays selectable.
						currentTournamentId={
							selectedTournament?.id ??
							(unknownTournamentFromUrl ? '__unknown__' : '')
						}
						onTournamentChange={id => {
							if (selectedTournament && id === selectedTournament.id) return
							router.replace(`/live/competitions?tournamentId=${id}`)
						}}
					/>
				)}

				<Card className="p-4 mb-6">
					<GameweekSelector
						onGameweekChange={setSelectedGameweek}
						currentGameweek={currentGameweek}
						selectedGameweek={selectedGameweek}
						disabled={
							isLoadingResults || Boolean(selectedTournament && !standingsReady)
						}
					/>
					<div className="mt-2 flex flex-wrap items-center justify-end gap-2 sm:gap-3">
						<LiveAutoRefreshCountdown
							enabled={autoRefreshEnabled}
							onRefresh={autoRefreshTournamentResults}
							renderLabel={seconds => t('nextRefresh', { seconds })}
						/>
						{/* Manual refresh — same idea as /live/points (auto countdown alone is easy to miss) */}
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
					</div>
				</Card>

				{isLoadingTournaments && (
					<Card className="border-border/80 p-6 text-sm text-muted-foreground shadow-sm">
						{t('loadingCompetitions')}
					</Card>
				)}

				{!isLoadingTournaments &&
					!selectedTournament &&
					!unknownTournamentFromUrl && (
						<Card className="border-border/80 p-6 text-sm text-muted-foreground shadow-sm">
							{t('noCompetitions')}
						</Card>
					)}

				{selectedTournament && !standingsReady && (
					<Card className="p-8 text-center shadow-sm">
						<p className="font-display text-lg font-semibold tracking-tight">
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
					<div ref={shareRef}>
						<TournamentHeader
							name={selectedTournament.name}
							averagePoints={selectedStats.averagePoints}
							highestPoints={selectedStats.highestPoints}
							totalEntries={
								selectedStats.totalEntries || selectedTournament.totalEntries
							}
							isLoading={isLoadingResults}
						/>

						{isLoadingResults ? (
							<div
								className="space-y-4"
								aria-busy="true"
								aria-live="polite"
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
							<>
								<SearchHeader
									searchQuery={searchQuery}
									setSearchQuery={setSearchQuery}
									captainOptions={captainOptions}
									chipFilter={chipFilter}
									onChipFilterChange={setChipFilter}
									captainFilter={captainFilter}
									onCaptainFilterChange={setCaptainFilter}
								/>

								<MobileCollapsibleFilters
									activeCount={
										(ownershipMatchedEntryIds ? 1 : 0) +
										(teamExposureMatchedEntryIds ? 1 : 0)
									}
								>
									<PlayerOwnershipFilter
										key={`${selectedTournament.id}-${displayGameweek}`}
										entries={selectedEntries}
										onMatchedEntryIdsChange={
											handleOwnershipMatchedEntryIdsChange
										}
									/>

									<TeamExposureFilter
										key={`team-${selectedTournament.id}-${displayGameweek}`}
										entries={selectedEntries}
										onMatchedEntryIdsChange={
											handleTeamExposureMatchedEntryIdsChange
										}
									/>
								</MobileCollapsibleFilters>

								<TournamentTable
									key={`table-${selectedTournament.id}-${displayGameweek}`}
									entries={filteredEntries}
									searchQuery=""
									tournamentId={selectedTournament.id}
									gameweek={displayGameweek}
									viewerEntryId={entryId}
									onVisibleEntriesChange={handleTableEntriesForShareChange}
								/>
							</>
						)}
					</div>
				)}
			</div>
		</PageShell>
	)
}
