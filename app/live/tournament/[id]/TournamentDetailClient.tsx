'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import PageShell from '@/components/layout/PageShell'
import { LiveAutoRefreshCountdown } from '@/components/live/LiveAutoRefreshCountdown'
import { TournamentHeader } from '@/components/tournament/TournamentHeader'
import { SearchHeader } from '@/components/tournament/SearchHeader'
import { TournamentTable } from '@/components/tournament/TournamentTable'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
	type EntryTournament,
	type TournamentLiveCalcData,
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
	buildTournamentEntries,
	buildTournamentStats,
	mergePartialTournamentRows
} from '@/lib/tournament/liveEntries'
import { ArrowLeft, Calendar, RefreshCw, Settings, Users } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

export default function TournamentDetailClient({
	canManage,
	tournament,
	currentGameweek,
	initialRows,
	initialError,
	initialSnapshot
}: {
	canManage: boolean
	tournament: EntryTournament | null
	currentGameweek?: number
	initialRows: TournamentLiveCalcData[]
	initialError: string | null
	initialSnapshot?: LiveSnapshotStatus | null
}) {
	const t = useTranslations('LiveTournament')
	const isPageActive = usePageActive()
	const [searchQuery, setSearchQuery] = useState('')
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
	const acceptSnapshot = useCallback((next: LiveSnapshotStatus | null) => {
		snapshotRef.current = next
		setSnapshot(next)
	}, [])
	const entries = useMemo(() => buildTournamentEntries(rows), [rows])

	const refreshStandings = useCallback((): Promise<void> => {
		if (!tournament || !currentGameweek) return Promise.resolve()
		if (refreshInFlightRef.current) return refreshInFlightRef.current
		refreshGenerationRef.current += 1

		const request = (async () => {
			try {
				setIsRefreshing(true)
				setError(null)
				const response = await executeQuery<TournamentLivePointsResponse>(
					GET_TOURNAMENT_LIVE_POINTS,
					{ tournamentId: tournament.id, eventId: currentGameweek },
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
	}, [acceptSnapshot, currentGameweek, t, tournament])

	const autoRefreshStandings = useCallback((): Promise<void> => {
		if (!tournament || !currentGameweek) return Promise.resolve()
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
				console.error(
					'Failed to check live tournament freshness:',
					probeError
				)
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
	}, [acceptSnapshot, currentGameweek, refreshStandings, t, tournament])

	const standingsStats = useMemo(() => buildTournamentStats(entries), [entries])

	const tournamentHeaderData = useMemo(() => {
		if (!tournament) {
			return null
		}

		return {
			name: tournament.name,
			averagePoints: standingsStats.averagePoints,
			highestPoints: standingsStats.highestPoints,
			totalEntries: standingsStats.totalEntries || tournament.totalTeamNum
		}
	}, [standingsStats, tournament])
	const formatGroupMode = (groupMode: string) =>
		groupMode === 'H2H'
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
	const formatState = (state: string) =>
		state === 'ACTIVE'
			? t('active')
			: state === 'COMPLETED'
				? t('completed')
				: state === 'PENDING'
					? t('pending')
					: state
	const leagueType =
		tournament?.leagueType === 'H2H'
			? t('headToHead')
			: tournament?.leagueType === 'CLASSIC'
				? t('classic')
				: tournament?.leagueType
	const autoRefreshEnabled = shouldPollLiveSnapshot({
		isPageActive,
		currentEventId: currentGameweek,
		selectedEventId: currentGameweek,
		snapshot
	})

	return (
		<PageShell>
			<div className="container max-w-4xl mx-auto px-4 py-8">
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
					{canManage && tournament ? (
						<Button
							variant="outline"
							asChild
						>
							<Link href={`/tournament/${tournament.id}/manage`}>
								<Settings aria-hidden="true" /> {t('manage')}
							</Link>
						</Button>
					) : null}
				</div>

				{error && (
					<Card className="p-4 mb-6 border-destructive/30 bg-destructive/5 text-destructive text-sm">
						{error}
					</Card>
				)}

				{!tournament && !error && (
					<Card className="p-6 text-sm text-muted-foreground mb-6">
						{t('unavailable')}
					</Card>
				)}

				{tournament && tournamentHeaderData && (
					<>
						<TournamentHeader
							name={tournamentHeaderData.name}
							averagePoints={tournamentHeaderData.averagePoints}
							highestPoints={tournamentHeaderData.highestPoints}
							totalEntries={tournamentHeaderData.totalEntries}
						/>
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
								/>
								{t('refresh')}
							</Button>
						</div>

						<Tabs
							defaultValue="standings"
							className="mb-6"
						>
							<Card className="p-4 mb-6">
								<TabsList className="w-full grid grid-cols-3 gap-2">
									<TabsTrigger value="standings">{t('standings')}</TabsTrigger>
									<TabsTrigger value="stats">
										{t('tournamentStats')}
									</TabsTrigger>
									<TabsTrigger value="rules">{t('rules')}</TabsTrigger>
								</TabsList>
							</Card>

							<TabsContent value="standings">
								{currentGameweek ? (
									<>
										<SearchHeader
											searchQuery={searchQuery}
											setSearchQuery={setSearchQuery}
											showFilters={false}
										/>

										<TournamentTable
											entries={entries}
											searchQuery={searchQuery}
											tournamentId={String(tournament.id)}
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
									<h2 className="text-xl font-bold mb-6">{t('statistics')}</h2>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">
												{t('creator')}
											</div>
											<div className="font-semibold">{tournament.creator}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground">
												{t('leagueType')}
											</div>
											<div className="font-semibold">{leagueType}</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground flex items-center gap-2">
												<Users className="h-4 w-4 text-emerald-500" />
												{t('participantCount')}
											</div>
											<div className="text-2xl font-bold">
												{tournament.totalTeamNum}
											</div>
										</div>

										<div className="space-y-2 rounded-lg bg-accent/30 p-4">
											<div className="text-sm text-muted-foreground flex items-center gap-2">
												<Calendar className="h-4 w-4 text-purple-500" />
												{t('status')}
											</div>
											<div className="text-2xl font-bold">
												{formatState(tournament.state)}
											</div>
										</div>
									</div>
								</Card>
							</TabsContent>

							<TabsContent value="rules">
								<Card className="p-6">
									<h2 className="text-xl font-bold mb-6">
										{t('tournamentRules')}
									</h2>

									<div className="space-y-6 text-muted-foreground">
										<div>
											<h3 className="text-lg font-semibold mb-2 text-foreground">
												{t('groupStage')}
											</h3>
											<ul className="list-disc pl-5 space-y-1">
												<li>
													{t('mode', {
														mode: formatGroupMode(tournament.groupMode)
													})}
												</li>
												<li>
													{t('teamsPerGroup', {
														count: tournament.groupTeamNum
													})}
												</li>
												<li>{t('groups', { count: tournament.groupNum })}</li>
												<li>
													{t('gameweeks', {
														value:
															tournament.groupStartedEventId &&
															tournament.groupEndedEventId
																? t('gameweekRange', {
																		start: tournament.groupStartedEventId,
																		end: tournament.groupEndedEventId
																	})
																: t('notScheduled')
													})}
												</li>
											</ul>
										</div>

										<div>
											<h3 className="text-lg font-semibold mb-2 text-foreground">
												{t('knockoutStage')}
											</h3>
											<ul className="list-disc pl-5 space-y-1">
												<li>
													{t('mode', {
														mode: formatKnockoutMode(tournament.knockoutMode)
													})}
												</li>
												<li>
													{t('teamsCount', {
														count:
															tournament.knockoutTeamNum !== null
																? tournament.knockoutTeamNum
																: t('notConfigured')
													})}
												</li>
												<li>
													{t('rounds', {
														count:
															tournament.knockoutRounds !== null
																? tournament.knockoutRounds
																: t('notConfigured')
													})}
												</li>
												<li>
													{t('gameweeks', {
														value:
															tournament.knockoutStartedEventId &&
															tournament.knockoutEndedEventId
																? t('gameweekRange', {
																		start: tournament.knockoutStartedEventId,
																		end: tournament.knockoutEndedEventId
																	})
																: t('notScheduled')
													})}
												</li>
											</ul>
										</div>
									</div>
								</Card>
							</TabsContent>
						</Tabs>
					</>
				)}
			</div>
		</PageShell>
	)
}
