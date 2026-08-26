'use client'

import { ShareActions } from '@/components/share/ShareActions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePageActive } from '@/hooks/use-page-active'
import { Link } from '@/i18n/navigation'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_TOURNAMENT_OFFICIAL_H2H,
	type OfficialH2HMatch,
	type OfficialH2HMatchSide,
	type OfficialH2HStanding,
	type TournamentOfficialH2H,
	type TournamentOfficialH2HResponse
} from '@/lib/graphql/operations/tournaments'
import { traceableOfficialH2HScore } from '@/lib/live-manager-score'
import { cn, formatInteger } from '@/lib/utils'
import {
	ArrowLeft,
	ArrowRight,
	CalendarClock,
	CheckCircle2,
	RefreshCw,
	Swords,
	Trophy,
	Users
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const REFRESH_INTERVAL_MS = 60_000
const EMPTY_OFFICIAL_H2H_MATCHES: readonly OfficialH2HMatch[] = []

function sideLabel(side: OfficialH2HMatchSide, averageLabel: string): string {
	return side.isAverage ? averageLabel : side.entryName
}

function scoreLabel(side: OfficialH2HMatchSide): string {
	return side.points == null ? '—' : formatInteger(side.points)
}

function shareMatchLabel(
	match: OfficialH2HMatch,
	averageLabel: string,
	versusLabel: string
): string {
	const home = sideLabel(match.home, averageLabel)
	const away = sideLabel(match.away, averageLabel)
	if (match.home.points == null || match.away.points == null) {
		return `${home} ${versusLabel} ${away}`
	}
	return `${home} ${scoreLabel(match.home)} — ${scoreLabel(match.away)} ${away}`
}

function matchIsComplete(match: OfficialH2HMatch): boolean {
	return match.home.points != null && match.away.points != null
}

function scoreSourceLabel(
	scoreSource: TournamentOfficialH2H['scoreSource'],
	t: ReturnType<typeof useTranslations<'LiveTournament'>>
): string {
	if (scoreSource === 'FPL_EVENT_LIVE') return t('live')
	if (scoreSource === 'FPL_H2H_FINAL') return t('completed')
	return t('pending')
}

function scoreSourceClass(
	scoreSource: TournamentOfficialH2H['scoreSource']
): string {
	if (scoreSource === 'FPL_EVENT_LIVE') {
		return 'border-primary/35 bg-primary/10 text-primary-ink'
	}
	if (scoreSource === 'FPL_H2H_FINAL') {
		return 'border-border/80 bg-muted/60 text-muted-foreground'
	}
	return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
}

function StandingBoard({
	standings,
	tournamentId,
	eventId,
	viewerEntryId
}: {
	standings: OfficialH2HStanding[]
	tournamentId: number
	eventId: number
	viewerEntryId?: number
}) {
	const t = useTranslations('LiveTournament')

	return (
		<div className="overflow-hidden rounded-xl border border-border/70 bg-background/45">
			<table className="w-full table-fixed text-[13px] sm:text-sm">
				<thead className="border-b border-border/70 bg-muted/30 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					<tr>
						<th className="w-12 px-2 py-3 text-center sm:w-14 sm:px-3">
							#
						</th>
						<th className="px-2 py-3 text-left sm:px-3">{t('team')}</th>
						<th className="hidden w-10 px-1 py-3 text-center sm:table-cell">P</th>
						<th className="hidden w-10 px-1 py-3 text-center sm:table-cell">W</th>
						<th className="hidden w-10 px-1 py-3 text-center sm:table-cell">D</th>
						<th className="hidden w-10 px-1 py-3 text-center sm:table-cell">L</th>
						<th className="hidden w-20 px-2 py-3 text-right sm:table-cell sm:px-3">
							{t('officialH2HPointsFor')}
						</th>
						<th className="w-[4.5rem] px-2 py-3 text-right sm:w-20 sm:px-3">
							{t('officialH2HMatchPoints')}
						</th>
					</tr>
				</thead>
				<tbody>
					{standings.map(standing => {
						const isViewer = standing.entryId === viewerEntryId
						return (
							<tr
								key={standing.entryId}
								className={cn(
									'border-t border-border/50 transition-colors first:border-t-0 hover:bg-muted/30',
									isViewer &&
										'bg-primary/[0.06] shadow-[inset_3px_0_0_hsl(var(--primary))]'
								)}
							>
								<td className="px-2 py-3 text-center font-mono font-semibold tabular-nums text-muted-foreground sm:px-3">
									{standing.rank ?? '—'}
								</td>
								<td className="min-w-0 px-2 py-3 sm:px-3">
									<Link
										href={`/live/points/${standing.entryId}?tournamentId=${tournamentId}&gw=${eventId}`}
										prefetch={false}
										className="block min-w-0 hover:text-primary-ink hover:underline underline-offset-2"
										title={standing.entryName ?? `Entry ${standing.entryId}`}
									>
										<p className="truncate whitespace-nowrap font-semibold leading-5">
											{standing.entryName ?? `Entry ${standing.entryId}`}
										</p>
										{standing.playerName ? (
											<p className="truncate whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
												{standing.playerName}
											</p>
										) : null}
										<p className="truncate whitespace-nowrap text-[10px] leading-4 text-muted-foreground sm:hidden">
											{standing.played} P · {standing.won} W · {standing.drawn} D ·{' '}
											{standing.lost} L · {t('officialH2HPointsFor')} {standing.pointsFor}
										</p>
									</Link>
								</td>
								{[
									standing.played,
									standing.won,
									standing.drawn,
									standing.lost
								].map((value, index) => (
									<td
										key={index}
										className="hidden px-1 py-3 text-center font-mono tabular-nums text-muted-foreground sm:table-cell"
									>
										{value}
									</td>
								))}
								<td className="hidden px-2 py-3 text-right font-mono tabular-nums text-muted-foreground sm:table-cell sm:px-3">
									{standing.pointsFor}
								</td>
								<td className="px-2 py-3 text-right font-mono text-base font-bold tabular-nums text-primary-ink sm:px-3">
									{standing.matchPoints}
								</td>
							</tr>
						)
					})}
				</tbody>
			</table>
		</div>
	)
}

function MatchCard({
	match,
	viewerEntryId
}: {
	match: OfficialH2HMatch
	viewerEntryId?: number
}) {
	const t = useTranslations('LiveTournament')
	const involvesViewer =
		viewerEntryId != null &&
		(match.home.entryId === viewerEntryId ||
			match.away.entryId === viewerEntryId)
	const hasScore = match.home.points != null && match.away.points != null
	const homeWon =
		hasScore && match.winnerEntryId != null && match.winnerEntryId === match.home.entryId
	const awayWon =
		hasScore && match.winnerEntryId != null && match.winnerEntryId === match.away.entryId

	return (
		<li>
			<Card
				className={cn(
					'group overflow-hidden border-border/70 bg-card/80 p-0 shadow-sm transition-colors hover:border-primary/35',
					involvesViewer &&
						'border-primary/50 bg-primary/[0.035] ring-1 ring-primary/15'
				)}
			>
				<div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:px-4">
					<span className="flex min-w-0 items-center gap-2">
						<span className="font-mono tabular-nums text-primary-ink">
							#{String(match.sourceOrder + 1).padStart(2, '0')}
						</span>
						<span className="truncate">
							{match.phase === 'KNOCKOUT'
								? match.knockoutName || t('officialH2HKnockout')
								: t('officialH2HRegular')}
						</span>
					</span>
					<span className="flex shrink-0 items-center gap-2">
						{involvesViewer ? (
							<span className="size-2 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.16)]" />
						) : null}
						{match.isBye ? (
							<Badge variant="outline" className="px-2 py-0 text-[10px]">
								{t('officialH2HBye')}
							</Badge>
						) : null}
					</span>
				</div>
				<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-4 sm:gap-3 sm:px-4">
					<div className="min-w-0 text-right">
						<p
							className={cn(
								'truncate whitespace-nowrap text-sm font-semibold',
								homeWon && 'text-primary-ink'
							)}
							title={sideLabel(match.home, t('officialH2HAverageTeam'))}
						>
							{sideLabel(match.home, t('officialH2HAverageTeam'))}
						</p>
						{match.home.playerName ? (
							<p className="truncate whitespace-nowrap text-[10px] text-muted-foreground">
								{match.home.playerName}
							</p>
						) : null}
					</div>
					<div className="flex min-w-[4.75rem] flex-col items-center gap-1">
						<div className="rounded-lg border border-border/80 bg-background px-2.5 py-1.5 font-mono text-base font-bold tabular-nums shadow-sm">
							{hasScore ? (
								<span className="flex items-center gap-1.5">
									<span className={homeWon ? 'text-primary-ink' : undefined}>
										{scoreLabel(match.home)}
									</span>
									<span className="text-muted-foreground">—</span>
									<span className={awayWon ? 'text-primary-ink' : undefined}>
										{scoreLabel(match.away)}
									</span>
								</span>
							) : (
								<span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{t('officialH2HVersus')}
								</span>
							)}
						</div>
						{hasScore ? (
							<span className="text-[10px] font-medium text-muted-foreground">
								{t('officialH2HMatchPoints')}
							</span>
						) : null}
					</div>
					<div className="min-w-0">
						<p
							className={cn(
								'truncate whitespace-nowrap text-sm font-semibold',
								awayWon && 'text-primary-ink'
							)}
							title={sideLabel(match.away, t('officialH2HAverageTeam'))}
						>
							{sideLabel(match.away, t('officialH2HAverageTeam'))}
						</p>
						{match.away.playerName ? (
							<p className="truncate whitespace-nowrap text-[10px] text-muted-foreground">
								{match.away.playerName}
							</p>
						) : null}
					</div>
				</div>
				{match.tiebreak ? (
					<p className="border-t border-border/60 px-3 py-2 text-[11px] text-muted-foreground sm:px-4">
						{t('officialH2HTiebreak', { value: match.tiebreak })}
					</p>
				) : null}
			</Card>
		</li>
	)
}

export function OfficialH2HCompetitionView({
	activeEventId,
	eventId,
	initialSnapshot,
	tournamentId,
	viewerEntryId
}: {
	activeEventId?: number
	eventId: number
	initialSnapshot: TournamentOfficialH2H | null
	tournamentId: number
	viewerEntryId?: number
}) {
	const t = useTranslations('LiveTournament')
	const isPageActive = usePageActive()
	const [snapshot, setSnapshot] = useState(initialSnapshot)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [refreshFailed, setRefreshFailed] = useState(false)
	const [hasLoaded, setHasLoaded] = useState(Boolean(initialSnapshot))
	const inFlightRef = useRef<Promise<void> | null>(null)
	const shareRef = useRef<HTMLDivElement | null>(null)
	const isCurrentEvent = activeEventId === eventId

	const refresh = useCallback(() => {
		if (inFlightRef.current) return inFlightRef.current
		const request = (async () => {
			try {
				setIsRefreshing(true)
				const response = await executeQuery<TournamentOfficialH2HResponse>(
					GET_TOURNAMENT_OFFICIAL_H2H,
					{ tournamentId, eventId },
					{ cache: 'no-store' }
				)
				setSnapshot(response.tournamentOfficialH2H)
				setRefreshFailed(false)
				setHasLoaded(true)
			} catch (error) {
				console.error('Failed to refresh official H2H mirror:', error)
				setRefreshFailed(true)
				setHasLoaded(true)
			} finally {
				setIsRefreshing(false)
			}
		})()
		inFlightRef.current = request
		void request.finally(() => {
			if (inFlightRef.current === request) inFlightRef.current = null
		})
		return request
	}, [eventId, tournamentId])

	useEffect(() => {
		if (!isPageActive || snapshot?.eventId === eventId) return
		void refresh()
	}, [eventId, isPageActive, refresh, snapshot?.eventId])

	useEffect(() => {
		if (!isCurrentEvent || !isPageActive) return
		const timer = window.setInterval(() => void refresh(), REFRESH_INTERVAL_MS)
		return () => window.clearInterval(timer)
	}, [isCurrentEvent, isPageActive, refresh])

	const hasTraceableScore = traceableOfficialH2HScore(snapshot)
	const standings = useMemo(
		() =>
			hasTraceableScore
				? [...(snapshot?.standings ?? [])].sort(
				(left, right) =>
					(left.rank ?? Number.MAX_SAFE_INTEGER) -
						(right.rank ?? Number.MAX_SAFE_INTEGER) ||
					right.matchPoints - left.matchPoints ||
					right.pointsFor - left.pointsFor ||
					left.entryId - right.entryId
				)
				: [],
		[hasTraceableScore, snapshot?.standings]
	)
	const matches = useMemo(() => {
		const source = snapshot?.matches ?? EMPTY_OFFICIAL_H2H_MATCHES
		if (hasTraceableScore) return source
		return source.map(match => ({
			...match,
			home: { ...match.home, points: null, matchPoints: null },
			away: { ...match.away, points: null, matchPoints: null },
			winnerEntryId: null,
			sourceCheckedAt: null
		}))
	}, [hasTraceableScore, snapshot])
	const viewerStanding = useMemo(
		() => standings.find(standing => standing.entryId === viewerEntryId) ?? null,
		[standings, viewerEntryId]
	)
	const matchCount = matches.length
	const completedMatchCount = matches.filter(matchIsComplete).length
	const isInitialLoading = !hasLoaded && isRefreshing
	const scoreStatus = scoreSourceLabel(
		snapshot?.scoreSource ?? 'UNAVAILABLE',
		t
	)
	const previousEvent = eventId > 1 ? eventId - 1 : null
	const nextEvent = eventId < 38 ? eventId + 1 : null
	const shareText = useMemo(() => {
		const lines = [
			t('officialH2HGameweek', { event: eventId }),
			`${t('officialH2HTable')}:`,
			...standings.map(
				standing =>
					`${standing.rank ?? '—'}. ${standing.entryName ?? `Entry ${standing.entryId}`} · ${standing.matchPoints} ${t('officialH2HMatchPoints')} · ${standing.pointsFor} ${t('officialH2HPointsFor')}`
			)
		]
		if (matches.length > 0) {
			lines.push(
				'',
				t('officialH2HFixtures'),
				...matches.map(match =>
					shareMatchLabel(
						match,
						t('officialH2HAverageTeam'),
						t('officialH2HVersus')
					)
				)
			)
		}
		if (typeof window !== 'undefined') lines.push('', window.location.href)
		return lines.join('\n')
	}, [eventId, matches, standings, t])

	return (
		<div
			ref={shareRef}
			className="space-y-4"
		>
			<section className="relative overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_16px_42px_-28px_rgba(45,11,59,0.55)]">
				<div
					className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
					aria-hidden="true"
				/>
				<div
					className="pointer-events-none absolute -bottom-28 -left-16 size-56 rounded-full bg-secondary/15 blur-3xl"
					aria-hidden="true"
				/>
				<div className="relative p-4 sm:p-5 lg:p-6">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div className="min-w-0">
							<div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
								<Badge className="rounded-md border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[10px] tracking-[0.12em] text-primary-ink shadow-none">
									H2H
								</Badge>
								<span>{t('headToHead')}</span>
							</div>
							<h2 className="mt-2 truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
								{t('officialH2HGameweek', { event: eventId })}
							</h2>
							<div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
								<Badge
									variant="outline"
									className={cn(
										'rounded-full px-2.5 py-1 font-medium',
										scoreSourceClass(snapshot?.scoreSource ?? 'UNAVAILABLE')
									)}
								>
									{scoreStatus}
								</Badge>
								<span className="inline-flex items-center gap-1.5">
									<span className="size-1.5 rounded-full bg-border" />
									{t('officialH2HOfficialOrder')}
								</span>
							</div>
						</div>
						<div
							className="flex w-full flex-wrap items-center justify-start gap-2 lg:w-auto lg:justify-end"
							data-share-exclude="true"
						>
							<Button
								variant="outline"
								size="icon"
								className="size-9 rounded-lg"
								asChild={previousEvent != null}
								disabled={previousEvent == null}
								aria-label={t('previous')}
							>
								{previousEvent == null ? (
									<ArrowLeft aria-hidden="true" />
								) : (
									<Link
										href={'/live/competitions/' + tournamentId + '?gw=' + previousEvent}
										prefetch={false}
									>
										<ArrowLeft aria-hidden="true" />
									</Link>
								)}
							</Button>
							<Button
								variant="outline"
								size="icon"
								className="size-9 rounded-lg"
								asChild={nextEvent != null}
								disabled={nextEvent == null}
								aria-label={t('next')}
							>
								{nextEvent == null ? (
									<ArrowRight aria-hidden="true" />
								) : (
									<Link
										href={'/live/competitions/' + tournamentId + '?gw=' + nextEvent}
										prefetch={false}
									>
										<ArrowRight aria-hidden="true" />
									</Link>
								)}
							</Button>
							<Button
								variant="outline"
								size="sm"
								className="rounded-lg"
								onClick={() => void refresh()}
								disabled={isRefreshing}
							>
								<RefreshCw
									className={isRefreshing ? 'animate-spin' : undefined}
									aria-hidden="true"
								/>
								{t('refresh')}
							</Button>
							<ShareActions
								text={shareText}
								imageRef={shareRef}
								title={t('officialH2HGameweek', { event: eventId })}
							/>
						</div>
					</div>

					<dl className="mt-5 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-4">
						<div className="flex min-w-0 flex-col gap-1 pr-3 sm:pr-5">
							<dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<Trophy className="size-3.5 text-primary-ink" aria-hidden="true" />
								{t('rank')}
							</dt>
							<dd className="font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
								{viewerStanding?.rank != null ? '#' + viewerStanding.rank : '—'}
							</dd>
						</div>
						<div className="flex min-w-0 flex-col gap-1 px-3 sm:px-5">
							<dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<CheckCircle2 className="size-3.5 text-primary-ink" aria-hidden="true" />
								{t('officialH2HMatchPoints')}
							</dt>
							<dd className="font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
								{viewerStanding?.matchPoints ?? '—'}
							</dd>
						</div>
						<div className="flex min-w-0 flex-col gap-1 pl-3 sm:pl-5">
							<dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<Users className="size-3.5 text-primary-ink" aria-hidden="true" />
								{t('officialH2HFixtures')}
							</dt>
							<dd className="font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
								{matchCount > 0 ? completedMatchCount + '/' + matchCount : '—'}
							</dd>
						</div>
					</dl>
				</div>
			</section>

			{refreshFailed ? (
				<Alert variant="warning" className="rounded-xl">
					<AlertDescription>{t('officialH2HRefreshFallback')}</AlertDescription>
				</Alert>
			) : null}

			{snapshot?.awaitingSchedule ? (
				<Card className="flex items-start gap-3 rounded-xl border-dashed border-border/80 bg-muted/20 p-4 shadow-none sm:items-center">
					<CalendarClock
						className="mt-0.5 size-5 shrink-0 text-primary-ink sm:mt-0"
						aria-hidden="true"
					/>
					<div className="min-w-0">
						<h3 className="font-display text-sm font-bold tracking-tight">
							{t('officialH2HAwaitingSchedule')}
						</h3>
						<p className="mt-0.5 text-xs leading-5 text-muted-foreground">
							{t('officialH2HAwaitingScheduleHelp')}
						</p>
					</div>
				</Card>
			) : null}

			<div className="grid gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(20rem,0.84fr)]">
				<section
					aria-labelledby="official-h2h-standings-title"
					className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
				>
					<div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
						<div className="flex min-w-0 items-center gap-2.5">
							<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-ink">
								<Swords className="size-4" aria-hidden="true" />
							</div>
							<h3
								id="official-h2h-standings-title"
								className="truncate font-display text-base font-bold tracking-tight"
							>
								{t('officialH2HTable')}
							</h3>
						</div>
						<Badge variant="outline" className="shrink-0 rounded-full">
							{standings.length}
						</Badge>
					</div>
					{isInitialLoading ? (
						<div
							className="space-y-2 p-3"
							aria-busy="true"
							aria-label={t('loadingStandings')}
						>
							{Array.from({ length: 7 }, (_, index) => (
								<div
									key={index}
									className="h-14 animate-pulse rounded-lg bg-muted/60"
								/>
							))}
						</div>
					) : standings.length > 0 ? (
						<StandingBoard
							standings={standings}
							tournamentId={tournamentId}
							eventId={eventId}
							viewerEntryId={viewerEntryId}
						/>
					) : (
						<div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
							<Trophy className="size-7 text-muted-foreground/60" aria-hidden="true" />
							<p className="text-sm font-medium">
								{snapshot?.awaitingSchedule
									? t('officialH2HAwaitingSchedule')
									: t('officialH2HLiveUnavailable')}
							</p>
						</div>
					)}
				</section>

				<section
					aria-labelledby="official-h2h-fixtures-title"
					className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
				>
					<div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
						<div className="flex min-w-0 items-center gap-2.5">
							<div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary-foreground">
								<CalendarClock className="size-4" aria-hidden="true" />
							</div>
							<h3
								id="official-h2h-fixtures-title"
								className="truncate font-display text-base font-bold tracking-tight"
							>
								{t('officialH2HFixtures')}
							</h3>
						</div>
						<Badge variant="outline" className="shrink-0 rounded-full">
							{t('officialH2HOfficialOrder')}
						</Badge>
					</div>
					{isInitialLoading ? (
						<div
							className="grid gap-3 p-3"
							aria-busy="true"
							aria-label={t('loadingStandings')}
						>
							{Array.from({ length: 4 }, (_, index) => (
								<div
									key={index}
									className="h-32 animate-pulse rounded-xl bg-muted/60"
								/>
							))}
						</div>
					) : matches.length > 0 ? (
						<ul className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-1">
							{matches.map(match => (
								<MatchCard
									key={match.officialMatchId}
									match={match}
									viewerEntryId={viewerEntryId}
								/>
							))}
						</ul>
					) : (
						<div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
							<CalendarClock className="size-7 text-muted-foreground/60" aria-hidden="true" />
							<p className="text-sm font-medium text-muted-foreground">
								{snapshot?.awaitingSchedule
									? t('officialH2HAwaitingGameweek', { event: eventId })
									: t('officialH2HNoFixtures', { event: eventId })}
							</p>
						</div>
					)}
				</section>
			</div>
		</div>
	)
}
