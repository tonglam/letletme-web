'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	type EntryTournament,
	type TournamentLiveCalcData,
	type TournamentParticipant,
	GET_TOURNAMENT_LIVE_POINTS,
	type TournamentLivePointsResponse
} from '@/lib/graphql/operations/tournaments'
import {
	GET_LIVE_SNAPSHOT,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import { executeQuery } from '@/lib/graphql-client'
import { usePageActive } from '@/hooks/use-page-active'
import {
	liveSnapshotNeedsRefresh,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import {
	areTournamentInsightsReady,
	normalizeTournamentSetupStatus,
	shouldPollTournamentSetup
} from '@/lib/tournament/lifecycle'
import {
	buildTournamentEntries,
	buildTournamentStats,
	mergePartialTournamentRows
} from '@/lib/tournament/liveEntries'
import {
	ArrowLeft,
	Calendar,
	Check,
	Circle,
	LoaderCircle,
	RefreshCw,
	Settings,
	Users
} from 'lucide-react'
import { Link, useRouter } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

const SETUP_PHASES = [
	'SYNCING_ENTRIES',
	'BUILDING_STRUCTURE',
	'CALCULATING_STANDINGS',
	'ENRICHING_HISTORY',
	'FINALIZING'
] as const

const phaseIndex = (phase: EntryTournament['setupPhase']) => {
	if (phase === 'READY') return SETUP_PHASES.length
	return SETUP_PHASES.findIndex(item => item === phase)
}

export default function TournamentDetailClient({
	canManage,
	tournament,
	currentGameweek,
	initialRows,
	initialError,
	initialSnapshot,
	initialParticipants,
	justCreated
}: {
	canManage: boolean
	tournament: EntryTournament | null
	currentGameweek?: number
	initialRows: TournamentLiveCalcData[]
	initialError: string | null
	initialSnapshot?: LiveSnapshotStatus | null
	initialParticipants: TournamentParticipant[]
	justCreated: boolean
}) {
	const t = useTranslations('LiveTournament')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const router = useRouter()
	const isPageActive = usePageActive()
	const [searchQuery, setSearchQuery] = useState('')
	const [currentTournament, setCurrentTournament] = useState(tournament)
	const [rows, setRows] = useState(initialRows)
	const [error, setError] = useState(initialError)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const refreshInFlightRef = useRef<Promise<void> | null>(null)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const failedEntryCountRef = useRef(initialError ? 1 : 0)
	const refreshGenerationRef = useRef(0)
	const [visible, setVisible] = useState(true)
	const [online, setOnline] = useState(true)
	const [retrying, setRetrying] = useState(false)
	const [actionError, setActionError] = useState<string | null>(null)
	const [announcement, setAnnouncement] = useState('')
	const previousStandingsReadyAt = useRef(tournament?.standingsReadyAt ?? null)
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])

	useEffect(() => {
		const updateVisibility = () =>
			setVisible(document.visibilityState === 'visible')
		const updateOnline = () => setOnline(navigator.onLine)
		updateVisibility()
		updateOnline()
		document.addEventListener('visibilitychange', updateVisibility)
		window.addEventListener('online', updateOnline)
		window.addEventListener('offline', updateOnline)
		return () => {
			document.removeEventListener('visibilitychange', updateVisibility)
			window.removeEventListener('online', updateOnline)
			window.removeEventListener('offline', updateOnline)
		}
	}, [])

	const polledTournamentId = currentTournament?.id
	const polledSetupStatus = currentTournament?.setupStatus

	useEffect(() => {
		if (
			!polledTournamentId ||
			!polledSetupStatus ||
			!shouldPollTournamentSetup({
				setupStatus: polledSetupStatus,
				visible,
				online
			})
		) {
			return
		}

		const controller = new AbortController()
		let timer: ReturnType<typeof setTimeout> | null = null
		let stopped = false
		const tournamentId = polledTournamentId

		const poll = async () => {
			try {
				const response = await fetch(
					`/api/tournaments/setup-status?id=${tournamentId}`,
					{
						cache: 'no-store',
						signal: controller.signal
					}
				)
				if (!response.ok) throw new Error('status unavailable')
				const status = normalizeTournamentSetupStatus(await response.json())
				if (!status || status.tournamentId !== tournamentId) {
					if (!stopped) timer = setTimeout(poll, 5_000)
					return
				}
				if (stopped) return

				const standingsJustPublished =
					!previousStandingsReadyAt.current && Boolean(status.standingsReadyAt)
				setCurrentTournament(current =>
					current
						? {
								...current,
								setupStatus: status.setupStatus,
								setupPhase: status.setupPhase,
								setupCompletedUnits: status.setupCompletedUnits,
								setupTotalUnits: status.setupTotalUnits,
								setupProgressUpdatedAt: status.setupProgressUpdatedAt,
								standingsReadyAt: status.standingsReadyAt,
								setupHasWarnings: status.setupHasWarnings,
								setupStartedAt: status.setupStartedAt,
								setupFinishedAt: status.setupFinishedAt
							}
						: current
				)

				if (standingsJustPublished) {
					previousStandingsReadyAt.current = status.standingsReadyAt
					setAnnouncement(lifecycleT('standingsPublishedAnnouncement'))
					router.refresh()
				}

				if (
					status.setupStatus === 'PENDING' ||
					status.setupStatus === 'PROCESSING'
				) {
					timer = setTimeout(poll, 5_000)
				} else {
					router.refresh()
				}
			} catch (error) {
				if (error instanceof Error && error.name === 'AbortError') return
				if (!stopped) timer = setTimeout(poll, 5_000)
			}
		}

		void poll()
		return () => {
			stopped = true
			controller.abort()
			if (timer) clearTimeout(timer)
		}
	}, [
		lifecycleT,
		online,
		polledSetupStatus,
		polledTournamentId,
		router,
		visible
	])

	const standingsReady = Boolean(currentTournament?.standingsReadyAt)

	const refreshStandings = useCallback((): Promise<void> => {
		if (!currentTournament || !currentGameweek || !standingsReady) {
			return Promise.resolve()
		}
		if (refreshInFlightRef.current) return refreshInFlightRef.current
		refreshGenerationRef.current += 1

		const request = (async () => {
			try {
				setIsRefreshing(true)
				setError(null)
				const response = await executeQuery<TournamentLivePointsResponse>(
					GET_TOURNAMENT_LIVE_POINTS,
					{ tournamentId: currentTournament.id, eventId: currentGameweek },
					{ cache: 'no-store' }
				)
				const batch = response.calcLivePointsForTournament
				failedEntryCountRef.current = batch.meta.failedCount
				setRows(previousRows =>
					mergePartialTournamentRows({
						nextRows: batch.results ?? [],
						previousRows,
						failedEntryIds: batch.errors.map(batchError => batchError.entryId),
						preserveFailed: true
					})
				)
				acceptSnapshot(response.liveSnapshot)
				if (batch.meta.failedCount > 0) {
					setError(
						t('partialResults', {
							failed: batch.meta.failedCount,
							total: batch.meta.totalEntries
						})
					)
				}
			} catch (refreshError) {
				console.error('Failed to refresh live tournament standings:', refreshError)
				setError(t('standingsFailed'))
			} finally {
				setIsRefreshing(false)
			}
		})()
		refreshInFlightRef.current = request
		void request.finally(() => {
			if (refreshInFlightRef.current === request) refreshInFlightRef.current = null
		})
		return request
	}, [acceptSnapshot, currentGameweek, currentTournament, standingsReady, t])

	const autoRefreshStandings = useCallback((): Promise<void> => {
		if (!currentTournament || !currentGameweek || !standingsReady) {
			return Promise.resolve()
		}
		if (freshnessRequestRef.current) return freshnessRequestRef.current

		const generation = refreshGenerationRef.current
		const request = (async () => {
			try {
				const probe = await executeQuery<LiveSnapshotResponse>(
					GET_LIVE_SNAPSHOT,
					{ eventId: currentGameweek },
					{ cache: 'no-store' }
				)
				if (generation !== refreshGenerationRef.current) return
				if (!liveSnapshotNeedsRefresh(snapshotRef.current, probe.liveSnapshot)) {
					acceptSnapshot(probe.liveSnapshot)
					if (failedEntryCountRef.current === 0) setError(null)
					return
				}
				await refreshStandings()
			} catch (probeError) {
				if (generation !== refreshGenerationRef.current) return
				console.error('Failed to check live tournament freshness:', probeError)
				setError(t('standingsFailed'))
			}
		})()
		freshnessRequestRef.current = request
		void request.finally(() => {
			if (freshnessRequestRef.current === request) {
				freshnessRequestRef.current = null
			}
		})
		return request
	}, [acceptSnapshot, currentGameweek, currentTournament, refreshStandings, standingsReady, t])

	const entries = useMemo(
		() => buildTournamentEntries(rows),
		[rows]
	)
	const standingsStats = useMemo(() => buildTournamentStats(entries), [entries])
	const insightsReady = currentTournament
		? areTournamentInsightsReady(currentTournament)
		: false
	const tournamentHeaderData = useMemo(() => {
		if (!currentTournament || !standingsReady) return null
		return {
			name: currentTournament.name,
			averagePoints: standingsStats.averagePoints,
			highestPoints: standingsStats.highestPoints,
			totalEntries:
				standingsStats.totalEntries || currentTournament.totalTeamNum
		}
	}, [currentTournament, standingsReady, standingsStats])

	const retrySetup = async () => {
		if (!currentTournament || retrying) return
		setRetrying(true)
		setActionError(null)
		try {
			const response = await fetch(`/api/tournaments/${currentTournament.id}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'retry_setup' })
			})
			if (!response.ok) throw new Error('retry failed')
			setCurrentTournament(current =>
				current
					? {
							...current,
							setupStatus: 'PENDING',
							setupPhase: 'QUEUED',
							setupHasWarnings: false
						}
					: current
			)
			setAnnouncement(lifecycleT('retryQueued'))
		} catch {
			setActionError(lifecycleT('retryFailed'))
		} finally {
			setRetrying(false)
		}
	}

	const formatGroupMode = (groupMode: string) =>
		groupMode === 'BATTLE_RACES'
			? t('headToHead')
			: groupMode === 'POINTS_RACES'
				? t('pointsRace')
				: t('noGroup')
	const formatKnockoutMode = (knockoutMode: string) =>
		knockoutMode === 'SINGLE_ELIMINATION'
			? t('singleElimination')
			: knockoutMode === 'DOUBLE_ELIMINATION'
				? t('homeAway')
				: t('noKnockout')
	const leagueType =
		currentTournament?.leagueType === 'H2H'
			? t('headToHead')
			: currentTournament?.leagueType === 'CLASSIC'
				? t('classic')
				: currentTournament?.leagueType
	const autoRefreshEnabled = shouldPollLiveSnapshot({
		isPageActive,
		currentEventId: currentGameweek,
		selectedEventId: currentGameweek,
		snapshot
	})

	return (
		<PageShell>
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<Button
						variant="ghost"
						className="-ml-3 text-primary-ink hover:text-primary-ink/80"
						asChild
					>
						<Link href="/live/tournament">
							<ArrowLeft aria-hidden="true" />
							<span>{t('backToTournaments')}</span>
						</Link>
					</Button>
					{canManage && currentTournament ? (
						<Button
							variant="outline"
							asChild
						>
							<Link href={`/tournament/${currentTournament.id}/manage`}>
								<Settings aria-hidden="true" /> {t('manage')}
							</Link>
						</Button>
					) : null}
				</div>

				<p
					className="sr-only"
					aria-live="polite"
					aria-atomic="true"
				>
					{announcement}
				</p>

				{justCreated && currentTournament ? (
					<Alert
						variant="success"
						className="mb-6"
					>
						<Check aria-hidden="true" />
						<AlertDescription>{lifecycleT('createdShell')}</AlertDescription>
					</Alert>
				) : null}

				{error ? (
					<Card className="mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
						{error}
					</Card>
				) : null}

				{!currentTournament && !error ? (
					<Card className="mb-6 p-6 text-sm text-muted-foreground">
						{t('unavailable')}
					</Card>
				) : null}

				{currentTournament ? (
					<>
						{tournamentHeaderData ? (
							<div>
								<div className="mb-3 flex justify-end">
									<TournamentLifecycleBadge tournament={currentTournament} />
								</div>
								<TournamentHeader {...tournamentHeaderData} />
							</div>
						) : (
							<Card className="mb-6 p-6">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<p className="text-sm text-muted-foreground">
											{currentTournament.sourceLeagueName ??
												t('sourceLeagueFallback', {
													id: currentTournament.leagueId
												})}
										</p>
										<h1 className="mt-1 text-3xl font-bold tracking-tight">
											{currentTournament.name}
										</h1>
									</div>
									<TournamentLifecycleBadge tournament={currentTournament} />
								</div>
								<div className="mt-5 flex flex-wrap gap-4 text-sm text-muted-foreground">
									<span className="flex items-center gap-2">
										<Users
											className="size-4"
											aria-hidden="true"
										/>
										{t('participantCountValue', {
											count: currentTournament.totalTeamNum
										})}
									</span>
									<span className="flex items-center gap-2">
										<Calendar
											className="size-4"
											aria-hidden="true"
										/>
										{t('gameweekRange', {
											start: currentTournament.groupStartedEventId ?? '—',
											end: currentTournament.groupEndedEventId ?? '—'
										})}
									</span>
								</div>
							</Card>
						)}

						{standingsReady ? (
							<div className="mb-4 flex items-center justify-end gap-3">
								<LiveAutoRefreshCountdown
									enabled={autoRefreshEnabled}
									onRefresh={autoRefreshStandings}
									renderLabel={seconds => t('nextRefresh', { seconds })}
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={() => void refreshStandings()}
									disabled={isRefreshing || !currentGameweek}
								>
									<RefreshCw
										className={isRefreshing ? 'animate-spin' : undefined}
										aria-hidden="true"
									/>
									{t('refresh')}
								</Button>
							</div>
						) : null}

						{currentTournament.setupStatus !== 'READY' ||
						currentTournament.setupHasWarnings ? (
							<Card className="mb-6 p-5">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h2 className="font-semibold">
											{lifecycleT('setupTitle')}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											{currentTournament.setupHasWarnings
												? lifecycleT('warningSummary')
												: standingsReady
													? lifecycleT('enrichingMessage')
													: lifecycleT('leavePageMessage')}
										</p>
									</div>
									<TournamentLifecycleBadge tournament={currentTournament} />
								</div>

								{currentTournament.setupStatus === 'FAILED' ? (
									<div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
										<p>
											{canManage
												? lifecycleT('ownerFailure')
												: lifecycleT('memberFailure')}
										</p>
										{canManage ? (
											<Button
												className="mt-3"
												size="sm"
												onClick={retrySetup}
												disabled={retrying}
											>
												{retrying ? (
													<LoaderCircle
														className="animate-spin"
														aria-hidden="true"
													/>
												) : (
													<RefreshCw aria-hidden="true" />
												)}
												{lifecycleT('retrySetup')}
											</Button>
										) : null}
									</div>
								) : currentTournament.setupHasWarnings ? (
									<div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
										<p>
											{canManage
												? lifecycleT('warningOwner')
												: lifecycleT('warningMember')}
										</p>
										{canManage ? (
											<Button
												className="mt-3"
												size="sm"
												variant="outline"
												onClick={retrySetup}
												disabled={retrying}
											>
												{retrying ? (
													<LoaderCircle
														className="animate-spin"
														aria-hidden="true"
													/>
												) : (
													<RefreshCw aria-hidden="true" />
												)}
												{lifecycleT('retrySetup')}
											</Button>
										) : null}
									</div>
								) : (
									<ol className="mt-5 space-y-3">
										{SETUP_PHASES.map((phase, index) => {
											const currentIndex = phaseIndex(
												currentTournament.setupPhase
											)
											const complete = currentIndex > index
											const active =
												currentIndex === index ||
												(currentTournament.setupPhase === 'QUEUED' &&
													index === 0)
											return (
												<li
													key={phase}
													className="flex items-center gap-3 text-sm"
												>
													{complete ? (
														<Check
															className="size-4 text-emerald-600"
															aria-hidden="true"
														/>
													) : active ? (
														<LoaderCircle
															className="size-4 animate-spin text-primary"
															aria-hidden="true"
														/>
													) : (
														<Circle
															className="size-4 text-muted-foreground"
															aria-hidden="true"
														/>
													)}
													<span
														className={
															active
																? 'font-medium text-foreground'
																: 'text-muted-foreground'
														}
													>
														{lifecycleT(`phase.${phase}`)}
														{active && currentTournament.setupTotalUnits > 0
															? ` ${currentTournament.setupCompletedUnits}/${currentTournament.setupTotalUnits}`
															: ''}
													</span>
												</li>
											)
										})}
									</ol>
								)}
								{actionError ? (
									<p className="mt-3 text-sm text-destructive">{actionError}</p>
								) : null}
							</Card>
						) : null}

						<Tabs
							defaultValue="standings"
							className="mb-6"
						>
							<Card className="mb-6 p-4">
								<TabsList className="grid w-full grid-cols-3 gap-2">
									<TabsTrigger value="standings">{t('standings')}</TabsTrigger>
									<TabsTrigger
										value="stats"
										disabled={!insightsReady}
									>
										{t('tournamentStats')}
									</TabsTrigger>
									<TabsTrigger value="rules">{t('rules')}</TabsTrigger>
								</TabsList>
								{!insightsReady ? (
									<p className="mt-3 text-center text-xs text-muted-foreground">
										{lifecycleT('insightsLoading')}
									</p>
								) : null}
							</Card>

							<TabsContent value="standings">
								{!standingsReady ? (
									<Card className="p-8 text-center">
										<LoaderCircle
											className="mx-auto size-6 animate-spin text-primary"
											aria-hidden="true"
										/>
										<h2 className="mt-4 font-semibold">
											{lifecycleT('standingsPreparing')}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											{lifecycleT('standingsPreparingDescription')}
										</p>
									</Card>
								) : currentGameweek && entries.length > 0 ? (
									<>
										<SearchHeader
											searchQuery={searchQuery}
											setSearchQuery={setSearchQuery}
											showFilters={false}
										/>
										<TournamentTable
											entries={entries}
											searchQuery={searchQuery}
											tournamentId={String(currentTournament.id)}
											gameweek={currentGameweek}
										/>
									</>
								) : (
									<Card className="p-6 text-sm text-muted-foreground">
										{t('liveUnavailable')}
									</Card>
								)}
							</TabsContent>

							<TabsContent value="stats">
								<Card className="p-6">
									<h2 className="mb-6 text-xl font-bold">{t('statistics')}</h2>
									<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">
												{t('creator')}
											</div>
											<div className="font-semibold">
												{currentTournament.creator}
											</div>
										</div>
										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">
												{t('leagueType')}
											</div>
											<div className="font-semibold">{leagueType}</div>
										</div>
										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">
												{t('participantCount')}
											</div>
											<div className="text-2xl font-bold">
												{currentTournament.totalTeamNum}
											</div>
										</div>
									</div>
								</Card>
							</TabsContent>

							<TabsContent value="rules">
								<div className="grid gap-6 md:grid-cols-2">
									<Card className="p-6">
										<h2 className="text-xl font-bold">
											{t('tournamentRules')}
										</h2>
										<ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
											<li>
												{t('mode', {
													mode: formatGroupMode(currentTournament.groupMode)
												})}
											</li>
											<li>
												{t('teamsPerGroup', {
													count: currentTournament.groupTeamNum
												})}
											</li>
											<li>
												{t('groups', { count: currentTournament.groupNum })}
											</li>
											<li>
												{t('gameweeks', {
													value:
														currentTournament.groupStartedEventId &&
														currentTournament.groupEndedEventId
															? t('gameweekRange', {
																	start: currentTournament.groupStartedEventId,
																	end: currentTournament.groupEndedEventId
																})
															: t('notScheduled')
												})}
											</li>
											<li>
												{t('mode', {
													mode: formatKnockoutMode(
														currentTournament.knockoutMode
													)
												})}
											</li>
										</ul>
									</Card>
									<Card className="p-6">
										<h2 className="text-xl font-bold">
											{lifecycleT('rosterTitle')}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											{lifecycleT('rosterCount', {
												count: initialParticipants.length
											})}
										</p>
										<ul className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-2">
											{initialParticipants.map(participant => (
												<li
													key={participant.entryId}
													className="rounded-md border px-3 py-2 text-sm"
												>
													<span className="font-medium">
														{participant.entryName ??
															lifecycleT('entryFallback', {
																id: participant.entryId
															})}
													</span>
													{participant.playerName ? (
														<span className="ml-2 text-muted-foreground">
															{participant.playerName}
														</span>
													) : null}
												</li>
											))}
										</ul>
									</Card>
								</div>
							</TabsContent>
						</Tabs>
					</>
				) : null}
			</div>
		</PageShell>
	)
}
