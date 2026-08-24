'use client'

import { PageState } from '@/components/feedback/PageState'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { TournamentLifecycleBadge } from '@/components/tournament/TournamentLifecycleBadge'
import { OfficialH2HCompetitionView } from '@/components/tournament/OfficialH2HCompetitionView'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { usePageActive } from '@/hooks/use-page-active'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_LIVE_CONTEXT,
	type LiveContextResponse,
	type LiveSnapshotResponse,
	type LiveSnapshotStatus
} from '@/lib/graphql/operations/live'
import {
	GET_TOURNAMENT_LIVE_DESK,
	type EntryTournament,
	type TournamentOfficialH2H,
	type TournamentLiveCalcData,
	type TournamentLivePointsResponse,
	type TournamentParticipant
} from '@/lib/graphql/operations/tournaments'
import {
	liveSnapshotNeedsRefresh,
	liveContextToSnapshot,
	shouldPollLiveSnapshot
} from '@/lib/live-refresh'
import type { TournamentDetailLoadError } from '@/lib/tournament/detail-load-error'
import {
	areTournamentInsightsReady,
	isTournamentInsightsRepairExhausted,
	isTournamentSetupPollingPending,
	normalizeTournamentSetupStatus,
	shouldPollTournamentSetup
} from '@/lib/tournament/lifecycle'
import {
	buildTournamentEntries,
	buildTournamentStats,
	countTraceableTournamentScores,
	getRetainedFailedEntryIds,
	mergeUnavailableTournamentEntryIds,
	mergePartialTournamentRows
} from '@/lib/tournament/liveEntries'
import { traceableOfficialManagerScore } from '@/lib/live-manager-score'
import { Link, useRouter } from '@/i18n/navigation'
import {
	ArrowLeft,
	Calendar,
	Check,
	Circle,
	KeyRound,
	Link2Off,
	LoaderCircle,
	Lock,
	RefreshCw,
	ServerCrash,
	Settings,
	Users
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const SETUP_PHASES = [
	'SYNCING_ENTRIES',
	'BUILDING_STRUCTURE',
	'CALCULATING_STANDINGS',
	'ENRICHING_HISTORY',
	'FINALIZING'
] as const

/** Large published rosters (~100 teams) — preview then expand. */
const ROSTER_PREVIEW = 20
const ROSTER_STEP = 20

const phaseIndex = (phase: EntryTournament['setupPhase']) => {
	if (phase === 'READY') return SETUP_PHASES.length
	return SETUP_PHASES.findIndex(item => item === phase)
}

function TournamentRosterList({
	participants,
	viewerEntryId,
	tournamentId,
	gameweek
}: {
	participants: TournamentParticipant[]
	viewerEntryId?: number
	tournamentId: number
	gameweek?: number
}) {
	const t = useTranslations('LiveTournament')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const [visibleCount, setVisibleCount] = useState(ROSTER_PREVIEW)
	const [query, setQuery] = useState('')

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase()
		if (!q) return participants
		return participants.filter(p => {
			const name = (p.entryName ?? '').toLowerCase()
			const manager = (p.playerName ?? '').toLowerCase()
			return (
				name.includes(q) || manager.includes(q) || String(p.entryId).includes(q)
			)
		})
	}, [participants, query])

	useEffect(() => {
		setVisibleCount(ROSTER_PREVIEW)
	}, [participants, query])

	const total = filtered.length
	const visible = useMemo(() => {
		if (total <= visibleCount) return filtered
		const top = filtered.slice(0, visibleCount)
		if (viewerEntryId == null) return top
		const me = filtered.find(p => p.entryId === viewerEntryId)
		if (me && !top.some(p => p.entryId === me.entryId)) {
			return [...top, me]
		}
		return top
	}, [filtered, total, viewerEntryId, visibleCount])

	const hasMore = total > visibleCount
	const remaining = Math.max(0, total - visibleCount)
	const canCollapse = visibleCount > ROSTER_PREVIEW && total > ROSTER_PREVIEW
	const nextStep = Math.min(ROSTER_STEP, remaining)
	const teamHref = (entryId: number) => {
		const params = new URLSearchParams({ tournamentId: String(tournamentId) })
		if (gameweek && gameweek > 0) params.set('gw', String(gameweek))
		return `/live/points/${entryId}?${params.toString()}`
	}

	return (
		<Card className="p-4 shadow-sm sm:p-6">
			<h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
				{lifecycleT('rosterTitle')}
			</h2>
			<p className="mt-1 text-sm text-muted-foreground">
				{lifecycleT('rosterCount', { count: participants.length })}
			</p>
			{participants.length > ROSTER_PREVIEW ? (
				<div className="mt-3">
					<input
						type="search"
						value={query}
						onChange={e => setQuery(e.target.value)}
						placeholder={t('searchPlaceholder')}
						aria-label={t('search')}
						className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					/>
				</div>
			) : null}
			<ul className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-2">
				{visible.length === 0 ? (
					<li className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
						{t('noMatchingTeams')}
					</li>
				) : (
					visible.map(participant => {
						const isMe =
							viewerEntryId != null && participant.entryId === viewerEntryId
						return (
							<li
								key={participant.entryId}
								className={cn(
									'rounded-md border px-3 py-2 text-sm',
									isMe && 'border-primary/40 row-self'
								)}
							>
								<Link
									href={teamHref(participant.entryId)}
									prefetch={false}
									className="block min-w-0 hover:text-primary-ink hover:underline underline-offset-2"
								>
									<span
										className={cn('font-medium', isMe && 'text-primary-ink')}
									>
										{participant.entryName ??
											lifecycleT('entryFallback', {
												id: participant.entryId
											})}
										{isMe ? (
											<span className="ml-1.5 text-caption font-semibold text-primary-ink">
												{t('youBadge')}
											</span>
										) : null}
									</span>
									{participant.playerName ? (
										<span className="mt-0.5 block truncate text-xs text-muted-foreground">
											{participant.playerName}
										</span>
									) : null}
								</Link>
							</li>
						)
					})
				)}
			</ul>
			{hasMore || canCollapse ? (
				<div className="mt-3 flex flex-wrap items-center justify-center gap-2">
					{total > ROSTER_PREVIEW ? (
						<p className="w-full text-center text-xs text-muted-foreground">
							{t('showingEntries', {
								shown: Math.min(visibleCount, total),
								total
							})}
						</p>
					) : null}
					{hasMore ? (
						<>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="text-xs"
								onClick={() =>
									setVisibleCount(c => Math.min(c + ROSTER_STEP, total))
								}
							>
								{t('showMoreEntries', { count: nextStep })}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="text-xs"
								onClick={() => setVisibleCount(total)}
							>
								{t('showAllEntries', { count: total })}
							</Button>
						</>
					) : null}
					{canCollapse ? (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="text-xs"
							onClick={() => setVisibleCount(ROSTER_PREVIEW)}
						>
							{t('showLessEntries')}
						</Button>
					) : null}
				</div>
			) : null}
		</Card>
	)
}

export default function TournamentDetailClient({
	canManage,
	tournament,
	currentGameweek,
	activeGameweek,
	entryId,
	initialRows,
	loadError,
	softError,
	initialSnapshot,
	initialOfficialH2H,
	initialParticipants,
	justCreated
}: {
	canManage: boolean
	tournament: EntryTournament | null
	currentGameweek?: number
	/** Actual current FPL event; the selected H2H event may be historical. */
	activeGameweek?: number
	/** Viewer FPL entry — pin + highlight on live standings */
	entryId?: number | null
	initialRows: TournamentLiveCalcData[]
	/** Blocking failure — no tournament payload */
	loadError: TournamentDetailLoadError | null
	/** Soft banner while tournament is still shown (e.g. partial calc) */
	softError: string | null
	initialSnapshot?: LiveSnapshotStatus | null
	initialOfficialH2H: TournamentOfficialH2H | null
	initialParticipants: TournamentParticipant[]
	justCreated: boolean
}) {
	const t = useTranslations('LiveTournament')
	const scoreT = useTranslations('LivePoints')
	const lifecycleT = useTranslations('TournamentLifecycle')
	const router = useRouter()
	const isPageActive = usePageActive()
	const [searchQuery, setSearchQuery] = useState('')
	const [currentTournament, setCurrentTournament] = useState(tournament)
	const [rows, setRows] = useState(initialRows)
	const managerNextRefreshAt = useMemo(() => {
		const refreshTimes = rows
			.map(row => traceableOfficialManagerScore(row.score)?.nextRefreshAt)
			.filter((value): value is string => Boolean(value))
			.sort()
		return refreshTimes[0] ?? null
	}, [rows])
	const managerScoreSettling = rows.some(
		row => traceableOfficialManagerScore(row.score)?.state === 'SETTLING'
	)
	const managerScoreStatus = useMemo(() => {
		const states = rows.flatMap(row => {
			const score = traceableOfficialManagerScore(row.score)
			return score ? [score.state] : []
		})
		const available = countTraceableTournamentScores(rows)
		if (states.includes('SETTLING')) return scoreT('scoreSettling')
		if (states.includes('STALE')) return scoreT('scoreDelayed')
		if (
			states.some(state => String(state) === 'FALLBACK') ||
			rows.some(
				row => String(row.score?.source) === 'LOCAL_MULTIPLIER_FALLBACK'
			)
		) {
			return scoreT('scoreFallback')
		}
		if (available > 0 && available < rows.length) {
			return scoreT('scorePartial', { available, total: rows.length })
		}
		if (rows.length === 0 || available === 0) {
			return scoreT('scoreUnavailable')
		}
		return scoreT('scoreOfficial')
	}, [rows, scoreT])
	const [staleEntryIds, setStaleEntryIds] = useState<ReadonlySet<number>>(
		() => new Set()
	)
	const [error, setError] = useState(softError)
	const [snapshot, setSnapshot] = useState<LiveSnapshotStatus | null>(
		initialSnapshot ?? null
	)
	const snapshotRef = useRef<LiveSnapshotStatus | null>(initialSnapshot ?? null)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const refreshInFlightRef = useRef<Promise<void> | null>(null)
	const freshnessRequestRef = useRef<Promise<void> | null>(null)
	const failedEntryCountRef = useRef(softError ? 1 : 0)
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
	const polledInsightsReadyAt = currentTournament?.insightsReadyAt
	const polledRepairExhausted = isTournamentInsightsRepairExhausted(
		currentTournament?.warningSummaries
	)

	useEffect(() => {
		if (
			!polledTournamentId ||
			!polledSetupStatus ||
			!shouldPollTournamentSetup({
				setupStatus: polledSetupStatus,
				insightsReadyAt: polledInsightsReadyAt,
				repairExhausted: polledRepairExhausted,
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
								setupProgressMode: status.setupProgressMode,
								setupAttempt: status.setupAttempt,
								setupMaxAttempts: status.setupMaxAttempts,
								nextRetryAt: status.nextRetryAt,
								setupProgressUpdatedAt: status.setupProgressUpdatedAt,
								standingsReadyAt: status.standingsReadyAt,
								profilesReadyAt: status.profilesReadyAt,
								insightsReadyAt: status.insightsReadyAt,
								setupHasWarnings: status.setupHasWarnings,
								warningSummaries: status.warningSummaries,
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
					isTournamentSetupPollingPending(
						status.setupStatus,
						status.insightsReadyAt,
						isTournamentInsightsRepairExhausted(status.warningSummaries)
					)
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
		polledInsightsReadyAt,
		polledRepairExhausted,
		polledSetupStatus,
		polledTournamentId,
		router,
		visible
	])

	const standingsReady = Boolean(currentTournament?.standingsReadyAt)
	const isOfficialH2H = Boolean(
		currentTournament?.leagueType === 'H2H' &&
		currentTournament.rosterMode === 'OFFICIAL_SYNC' &&
		currentTournament.groupMode === 'BATTLE_RACES'
	)

	const refreshStandings = useCallback(
		(revision?: string | null): Promise<void> => {
			if (
				!currentTournament ||
				!currentGameweek ||
				!standingsReady ||
				isOfficialH2H
			) {
				return Promise.resolve()
			}
			if (refreshInFlightRef.current) return refreshInFlightRef.current
			refreshGenerationRef.current += 1

			const request = (async () => {
				try {
					setIsRefreshing(true)
					setError(null)
					const requestedRevision =
						revision ?? snapshotRef.current?.revision ?? null
					let response: TournamentLivePointsResponse
					if (requestedRevision) {
						const params = new URLSearchParams({
							eventId: String(currentGameweek),
							revision: requestedRevision
						})
						const httpResponse = await fetch(
							`/api/live/competitions/${currentTournament.id}/board?${params.toString()}`,
							{ cache: 'no-store' }
						)
						if (!httpResponse.ok)
							throw new Error(
								`Live competition request failed (${httpResponse.status})`
							)
						response =
							(await httpResponse.json()) as TournamentLivePointsResponse
					} else {
						response = await executeQuery<TournamentLivePointsResponse>(
							GET_TOURNAMENT_LIVE_DESK,
							{
								entryId,
								selectedTournamentId: currentTournament.id,
								ref: null
							},
							{ cache: 'no-store' }
						)
					}
					const batch = response.entryLiveCompetitionsDesk
					const failedIds = mergeUnavailableTournamentEntryIds(
						batch.failedEntryIds,
						batch.unavailableEntryIds ?? []
					)
					failedEntryCountRef.current = failedIds.length
					const nextRows = batch.board ?? []
					setRows(previousRows => {
						const retainedIds = getRetainedFailedEntryIds({
							nextRows,
							previousRows,
							failedEntryIds: failedIds,
							preserveFailed: true
						})
						const merged = mergePartialTournamentRows({
							nextRows,
							previousRows,
							failedEntryIds: failedIds,
							preserveFailed: true
						})
						queueMicrotask(() => {
							setStaleEntryIds(
								retainedIds.length > 0 ? new Set(retainedIds) : new Set()
							)
						})
						return merged
					})
					acceptSnapshot(
						batch.revision
							? {
									eventId: batch.eventId,
									revision: batch.revision,
									state: (batch.windowState ??
										batch.state) as LiveSnapshotStatus['state'],
									publishedAt: null,
									checkedAt: null
								}
							: null
					)
					if (batch.partial) {
						setError(
							t('partialResults', {
								failed: failedIds.length,
								total: batch.totalEntries
							})
						)
					}
				} catch (refreshError) {
					console.error(
						'Failed to refresh live tournament standings:',
						refreshError
					)
					setError(t('standingsFailed'))
				} finally {
					setIsRefreshing(false)
				}
			})()
			refreshInFlightRef.current = request
			void request.finally(() => {
				if (refreshInFlightRef.current === request)
					refreshInFlightRef.current = null
			})
			return request
		},
		[
			acceptSnapshot,
			currentGameweek,
			currentTournament,
			entryId,
			isOfficialH2H,
			standingsReady,
			t
		]
	)

	const autoRefreshStandings = useCallback((): Promise<void> => {
		if (
			!currentTournament ||
			!currentGameweek ||
			!standingsReady ||
			isOfficialH2H
		) {
			return Promise.resolve()
		}
		if (freshnessRequestRef.current) return freshnessRequestRef.current

		const generation = refreshGenerationRef.current
		const request = (async () => {
			try {
				const probe = await executeQuery<LiveContextResponse>(
					GET_LIVE_CONTEXT,
					undefined,
					{ cache: 'no-store' }
				)
				if (generation !== refreshGenerationRef.current) return
				const observedSnapshot = liveContextToSnapshot(probe.liveContext)
				const managerScoreDue = Boolean(
					managerNextRefreshAt && Date.parse(managerNextRefreshAt) <= Date.now()
				)
				if (
					!liveSnapshotNeedsRefresh(snapshotRef.current, observedSnapshot) &&
					!managerScoreDue
				) {
					acceptSnapshot(observedSnapshot)
					if (failedEntryCountRef.current === 0) setError(null)
					return
				}
				await refreshStandings(observedSnapshot?.revision ?? null)
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
	}, [
		acceptSnapshot,
		currentGameweek,
		currentTournament,
		isOfficialH2H,
		refreshStandings,
		standingsReady,
		t,
		managerNextRefreshAt
	])

	const entries = useMemo(
		() =>
			buildTournamentEntries(rows, {
				staleEntryIds: staleEntryIds.size > 0 ? staleEntryIds : undefined
			}),
		[rows, staleEntryIds]
	)
	const standingsStats = useMemo(() => buildTournamentStats(entries), [entries])
	const insightsReady = currentTournament
		? areTournamentInsightsReady(currentTournament)
		: false
	const warningSummaries = currentTournament?.warningSummaries ?? []
	const hasSetupWarnings =
		Boolean(currentTournament?.setupHasWarnings) || warningSummaries.length > 0
	const profileWarningCount = warningSummaries
		.filter(summary => summary.category === 'PROFILES')
		.reduce((total, summary) => total + summary.affectedCount, 0)
	const insightsWarningCount = warningSummaries
		.filter(
			summary =>
				summary.category === 'INSIGHTS' || summary.category === 'RESULTS'
		)
		.reduce((total, summary) => total + summary.affectedCount, 0)
	const tournamentHeaderData = useMemo(() => {
		if (!currentTournament || !standingsReady || isOfficialH2H) return null
		return {
			name: currentTournament.name,
			averagePoints: standingsStats.averagePoints,
			highestPoints: standingsStats.highestPoints,
			scoresAvailable: Boolean(currentGameweek),
			totalEntries:
				standingsStats.totalEntries || currentTournament.totalTeamNum
		}
	}, [
		currentGameweek,
		currentTournament,
		isOfficialH2H,
		standingsReady,
		standingsStats
	])

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
							setupHasWarnings: false,
							warningSummaries: [],
							profilesReadyAt: null,
							insightsReadyAt: null
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
				: knockoutMode === 'HEAD_TO_HEAD'
					? t('officialH2HKnockout')
					: t('noKnockout')
	const leagueType =
		currentTournament?.leagueType === 'H2H'
			? t('headToHead')
			: currentTournament?.leagueType === 'CLASSIC'
				? t('classic')
				: currentTournament?.leagueType
	const autoRefreshEnabled = shouldPollLiveSnapshot({
		isPageActive: isPageActive && !isOfficialH2H,
		currentEventId: currentGameweek,
		selectedEventId: currentGameweek,
		snapshot,
		managerScoreState: managerScoreSettling ? 'SETTLING' : null,
		managerNextRefreshAt,
		windowState: snapshot?.windowState ?? snapshot?.state,
		nextRefreshAt: snapshot?.nextRefreshAt
	})

	// Full-page empty state for access / link / bind failures
	if (loadError || !currentTournament) {
		const kind = loadError ?? 'unavailable'
		const icon =
			kind === 'bind_entry'
				? KeyRound
				: kind === 'invalid_link'
					? Link2Off
					: kind === 'no_access'
						? Lock
						: ServerCrash
		const titleKey =
			kind === 'bind_entry'
				? 'errorBindEntryTitle'
				: kind === 'invalid_link'
					? 'errorInvalidLinkTitle'
					: kind === 'no_access'
						? 'errorNoAccessTitle'
						: 'errorUnavailableTitle'
		const descriptionKey =
			kind === 'bind_entry'
				? 'errorBindEntryDescription'
				: kind === 'invalid_link'
					? 'errorInvalidLinkDescription'
					: kind === 'no_access'
						? 'errorNoAccessDescription'
						: 'errorUnavailableDescription'

		return (
			<PageShell>
				<PageState
					icon={icon}
					title={t(titleKey)}
					description={t(descriptionKey)}
					actions={
						<>
							{kind === 'bind_entry' ? (
								<Button asChild>
									<Link href="/onboarding/bind-entry">
										{t('errorCtaBindEntry')}
									</Link>
								</Button>
							) : null}
							{kind === 'bind_entry' ? (
								<Button
									variant="outline"
									asChild
								>
									<Link href="/auth/login">{t('signIn')}</Link>
								</Button>
							) : null}
							{kind !== 'bind_entry' ? (
								<Button asChild>
									<Link
										href="/competitions/browse?mine=true"
										prefetch={false}
									>
										{t('errorCtaMyCompetitions')}
									</Link>
								</Button>
							) : null}
							{kind === 'no_access' || kind === 'unavailable' ? (
								<Button
									variant="outline"
									asChild
								>
									<Link
										href="/live/competitions"
										prefetch={false}
									>
										{t('errorCtaLiveList')}
									</Link>
								</Button>
							) : null}
							{kind === 'unavailable' ? (
								<Button
									variant="outline"
									onClick={() => router.refresh()}
								>
									<RefreshCw aria-hidden="true" />
									{t('errorCtaRetry')}
								</Button>
							) : null}
						</>
					}
				/>
			</PageShell>
		)
	}

	return (
		<PageShell>
			<div
				className="container mx-auto max-w-4xl px-4 py-8"
				data-competition-perf-ready="detail"
				data-competition-tournament-id={String(currentTournament.id)}
			>
				<RouteReadyMarker
					name="LIVE_COMPETITION_BOARD_READY"
					ready={Boolean(currentTournament && !retrying && !isRefreshing)}
					audienceHint="session-hint"
					goodMs={1000}
					poorMs={1500}
					readyKey={String(currentTournament?.id ?? 'none')}
				/>
				<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
					<Button
						variant="ghost"
						className="-ml-3 text-primary-ink hover:text-primary-ink/80"
						asChild
					>
						<Link
							href="/live/competitions"
							prefetch={false}
						>
							<ArrowLeft aria-hidden="true" />
							<span>{t('backToCompetitions')}</span>
						</Link>
					</Button>
					{canManage ? (
						<Button
							variant="outline"
							asChild
						>
							<Link
								href={`/competitions/${currentTournament.id}/manage`}
								prefetch={false}
							>
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

				{justCreated ? (
					<Alert
						variant="success"
						className="mb-6"
					>
						<Check aria-hidden="true" />
						<AlertDescription>{lifecycleT('createdShell')}</AlertDescription>
					</Alert>
				) : null}

				{error ? (
					<Alert
						variant="warning"
						className="mb-6"
					>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
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
							<Card className="mb-6 p-4 shadow-sm sm:p-6">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0">
										<p className="chyron">
											{currentTournament.sourceLeagueName ??
												t('sourceLeagueFallback', {
													id: currentTournament.leagueId
												})}
										</p>
										<h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
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

						{standingsReady && !isOfficialH2H && !currentGameweek ? (
							<Alert
								variant="warning"
								className="mb-6"
							>
								<Calendar aria-hidden="true" />
								<AlertDescription>
									<span className="font-medium">
										{t('currentRoundPendingTitle')}
									</span>
									<span className="mt-1 block">
										{t('currentRoundPendingDescription')}
									</span>
								</AlertDescription>
							</Alert>
						) : null}

						{standingsReady && !isOfficialH2H ? (
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
						{currentTournament && (!isOfficialH2H || rows.length > 0) ? (
							<p className="mb-4 text-right text-xs text-muted-foreground">
								{managerScoreStatus}
							</p>
						) : null}

						{currentTournament.setupStatus !== 'READY' || hasSetupWarnings ? (
							<Card className="mb-6 p-4 shadow-sm sm:p-5">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h2 className="font-display text-lg font-semibold tracking-tight">
											{lifecycleT('setupTitle')}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											{hasSetupWarnings
												? profileWarningCount > 0
													? lifecycleT('profileWarning', {
															count: profileWarningCount
														})
													: insightsWarningCount > 0
														? lifecycleT('insightsWarning')
														: lifecycleT('warningSummary')
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
												{lifecycleT('recoverSetup')}
											</Button>
										) : null}
									</div>
								) : hasSetupWarnings ? (
									<div className="mt-4 rounded-lg border border-border/80 bg-muted/30 p-4 text-sm">
										<p>
											{canManage
												? lifecycleT('warningOwner')
												: lifecycleT('warningMember')}
										</p>
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
															className="size-4 text-success"
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
														{active &&
														currentTournament.setupProgressMode !==
															'INDETERMINATE' &&
														currentTournament.setupTotalUnits > 0
															? ` ${currentTournament.setupCompletedUnits}/${currentTournament.setupTotalUnits}`
															: active &&
																  currentTournament.setupProgressMode ===
																		'INDETERMINATE'
																? ` · ${lifecycleT('indeterminateProgress')}`
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
							<div>
								<div className="rounded-lg border border-border/80 bg-card p-2 shadow-sm sm:p-3">
									<TabsList className="grid h-auto w-full grid-cols-3 gap-1.5 sm:gap-2">
										<TabsTrigger value="standings">
											{t('standings')}
										</TabsTrigger>
										<TabsTrigger
											value="stats"
											disabled={!insightsReady}
										>
											{t('tournamentStats')}
										</TabsTrigger>
										<TabsTrigger value="rules">{t('rules')}</TabsTrigger>
									</TabsList>
								</div>
								{!insightsReady ? (
									<p className="mt-3 text-center text-xs text-muted-foreground">
										{lifecycleT('insightsLoading')}
									</p>
								) : null}
							</div>

							<TabsContent value="standings">
								{!standingsReady ? (
									<Card className="p-8 text-center shadow-sm">
										<LoaderCircle
											className="mx-auto size-6 animate-spin text-primary"
											aria-hidden="true"
										/>
										<h2 className="mt-4 font-display text-lg font-semibold tracking-tight">
											{lifecycleT('standingsPreparing')}
										</h2>
										<p className="mt-1 text-sm text-muted-foreground">
											{lifecycleT('standingsPreparingDescription')}
										</p>
									</Card>
								) : isOfficialH2H && currentGameweek ? (
									<OfficialH2HCompetitionView
										activeEventId={activeGameweek}
										eventId={currentGameweek}
										initialSnapshot={initialOfficialH2H}
										tournamentId={currentTournament.id}
										viewerEntryId={entryId ?? undefined}
									/>
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
											viewerEntryId={entryId ?? undefined}
										/>
									</>
								) : (
									<Card className="p-6 text-sm text-muted-foreground shadow-sm">
										{t('liveUnavailable')}
									</Card>
								)}
							</TabsContent>

							<TabsContent value="stats">
								<Card className="p-4 shadow-sm sm:p-6">
									<h2 className="mb-5 font-display text-lg font-bold tracking-tight sm:text-xl">
										{t('statistics')}
									</h2>
									<div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-4">
										<div className="space-y-1 rounded-lg border surface-inset p-4">
											<div className="eyebrow">{t('creator')}</div>
											<div className="font-display text-base font-semibold">
												{currentTournament.creator}
											</div>
										</div>
										<div className="space-y-1 rounded-lg border surface-inset p-4">
											<div className="eyebrow">{t('leagueType')}</div>
											<div className="font-display text-base font-semibold">
												{leagueType}
											</div>
										</div>
										<div className="space-y-1 rounded-lg border surface-inset p-4">
											<div className="eyebrow">{t('participantCount')}</div>
											<div className="font-display text-2xl font-bold tabular-nums">
												{currentTournament.totalTeamNum}
											</div>
										</div>
									</div>
								</Card>
							</TabsContent>

							<TabsContent value="rules">
								<div className="grid gap-6 md:grid-cols-2">
									<Card className="p-4 shadow-sm sm:p-6">
										<h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">
											{t('competitionRules')}
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
											{currentTournament.knockoutMode !== 'NO_KNOCKOUT' ? (
												<>
													<li>
														{t('teamsCount', {
															count:
																currentTournament.knockoutTeamNum ??
																t('notConfigured')
														})}
													</li>
													<li>
														{t('rounds', {
															count:
																currentTournament.knockoutRounds ??
																t('notConfigured')
														})}
													</li>
													<li>
														{t('gameweeks', {
															value:
																currentTournament.knockoutStartedEventId &&
																currentTournament.knockoutEndedEventId
																	? t('gameweekRange', {
																			start:
																				currentTournament.knockoutStartedEventId,
																			end: currentTournament.knockoutEndedEventId
																		})
																	: t('notScheduled')
														})}
													</li>
												</>
											) : null}
										</ul>
									</Card>
									<TournamentRosterList
										participants={initialParticipants}
										viewerEntryId={entryId ?? undefined}
										tournamentId={currentTournament.id}
										gameweek={currentGameweek}
									/>
								</div>
							</TabsContent>
						</Tabs>
					</>
				) : null}
			</div>
		</PageShell>
	)
}
