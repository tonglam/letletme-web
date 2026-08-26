'use client'

import { ShareActions } from '@/components/share/ShareActions'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { HomeAutoCarousel } from '@/components/home/HomeAutoCarousel'
import { usePageActive } from '@/hooks/use-page-active'
import { Link, useRouter } from '@/i18n/navigation'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_OFFICIAL_H2H_MATCHUPS,
	GET_TOURNAMENT_OFFICIAL_H2H,
	type EntryOfficialH2HMatchupsItem,
	type EntryOfficialH2HMatchupsResponse,
	type OfficialH2HMatch,
	type OfficialH2HMatchSide,
	type OfficialH2HStanding,
	type TournamentOfficialH2H,
	type TournamentOfficialH2HResponse
} from '@/lib/graphql/operations/tournaments'
import { traceableOfficialH2HScore } from '@/lib/live-manager-score'
import { shouldShowOfficialH2HStandings } from '@/lib/tournament/official-h2h-presentation'
import { cn, formatInteger } from '@/lib/utils'
import {
	ArrowLeft,
	ArrowRight,
	CalendarClock,
	CheckCircle2,
	RefreshCw,
	Swords,
	Trophy
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const REFRESH_INTERVAL_MS = 60_000
const EMPTY_OFFICIAL_H2H_MATCHES: readonly OfficialH2HMatch[] = []
const H2H_STANDING_COLUMNS =
	'2.5rem minmax(0,1fr) 2.75rem 2.75rem 2.75rem 3.75rem 4.5rem 5.5rem'

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
			<div
				className="eyebrow hidden border-b border-border/60 bg-muted/20 px-4 py-2 lg:grid lg:items-center lg:gap-2"
				style={{ gridTemplateColumns: H2H_STANDING_COLUMNS }}
			>
				<span className="text-center">#</span>
				<span>{t('team')}</span>
				<span className="text-right">{t('officialH2HWon')}</span>
				<span className="text-right">{t('officialH2HDrawn')}</span>
				<span className="text-right">{t('officialH2HLost')}</span>
				<span className="text-right">{t('officialH2HPlayed')}</span>
				<span className="text-right">{t('officialH2HPointsFor')}</span>
				<span className="text-right">{t('officialH2HMatchPoints')}</span>
			</div>
			<ul className="divide-y divide-border/60">
				{standings.map(standing => {
					const isViewer = standing.entryId === viewerEntryId
					const isTopThree = standing.rank != null && standing.rank <= 3
					return (
						<li
							key={standing.entryId}
							className={cn(
								'px-3 py-2.5 transition-colors hover:bg-muted/30 sm:px-4',
								isViewer &&
									'bg-primary/[0.06] shadow-[inset_3px_0_0_hsl(var(--primary))]'
							)}
						>
							<div className="flex min-w-0 items-start gap-3 lg:hidden">
								<div
									className={cn(
										'w-7 shrink-0 pt-1 text-center font-display text-base font-bold tabular-nums',
										isTopThree ? 'text-primary-ink' : 'text-muted-foreground'
									)}
								>
									{standing.rank ?? '—'}
								</div>
								<div className="min-w-0 flex-1">
									<Link
										href={`/live/points/${standing.entryId}?tournamentId=${tournamentId}&gw=${eventId}`}
										prefetch={false}
										className="block min-w-0 hover:text-primary-ink hover:underline underline-offset-2"
										title={standing.entryName ?? `Entry ${standing.entryId}`}
									>
										<p className="break-words text-sm font-semibold leading-5">
											{standing.entryName ?? `Entry ${standing.entryId}`}
										</p>
										{standing.playerName ? (
											<p className="break-words text-xs leading-4 text-muted-foreground">
												{standing.playerName}
											</p>
										) : null}
									</Link>
								</div>
								<div
									className="shrink-0 rounded-md bg-primary/[0.08] px-2 py-1 text-right"
									aria-label={`${t('officialH2HMatchPoints')}: ${standing.matchPoints}`}
								>
									<div className="text-[10px] leading-3 text-muted-foreground">
										{t('officialH2HMatchPoints')}
									</div>
									<div className="font-display text-xl font-extrabold leading-6 tabular-nums text-primary-ink">
										{standing.matchPoints}
									</div>
								</div>
							</div>

							<div className="mt-2 grid grid-cols-5 divide-x divide-border/50 border-t border-border/50 pt-2 lg:hidden">
								{[
									[t('officialH2HWon'), standing.won],
									[t('officialH2HDrawn'), standing.drawn],
									[t('officialH2HLost'), standing.lost],
									[t('officialH2HPlayed'), standing.played],
									[t('officialH2HPointsFor'), standing.pointsFor]
								].map(([label, value]) => (
									<div
										key={label}
										className="min-w-0 px-1.5 text-center first:pl-0 last:pr-0"
									>
										<div className="text-[10px] leading-3 text-muted-foreground">
											{label}
										</div>
										<div className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground/90">
											{value}
										</div>
									</div>
								))}
							</div>

							<div
								className="hidden items-center gap-2 lg:grid"
								style={{ gridTemplateColumns: H2H_STANDING_COLUMNS }}
							>
								<div
									className={cn(
										'text-center font-display text-base font-bold tabular-nums',
										isTopThree ? 'text-primary-ink' : 'text-muted-foreground'
									)}
								>
									{standing.rank ?? '—'}
								</div>
								<div className="min-w-0">
									<Link
										href={`/live/points/${standing.entryId}?tournamentId=${tournamentId}&gw=${eventId}`}
										prefetch={false}
										className="block min-w-0 hover:text-primary-ink hover:underline underline-offset-2"
										title={standing.entryName ?? `Entry ${standing.entryId}`}
									>
										<p className="break-words text-sm font-semibold leading-5">
											{standing.entryName ?? `Entry ${standing.entryId}`}
										</p>
										{standing.playerName ? (
											<p className="break-words text-xs leading-4 text-muted-foreground">
												{standing.playerName}
											</p>
										) : null}
									</Link>
								</div>
								<span className="text-right font-mono text-sm tabular-nums text-foreground/90">
									{standing.won}
								</span>
								<span className="text-right font-mono text-sm tabular-nums text-foreground/90">
									{standing.drawn}
								</span>
								<span className="text-right font-mono text-sm tabular-nums text-foreground/90">
									{standing.lost}
								</span>
								<span className="text-right font-mono text-sm tabular-nums text-muted-foreground">
									{standing.played}
								</span>
								<span className="text-right font-mono text-sm tabular-nums text-foreground/90">
									{standing.pointsFor}
								</span>
								<div
									className="text-right font-display text-2xl font-extrabold leading-6 tabular-nums text-primary-ink"
									aria-label={`${t('officialH2HMatchPoints')}: ${standing.matchPoints}`}
								>
									{standing.matchPoints}
								</div>
							</div>
						</li>
					)
				})}
			</ul>
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
		hasScore &&
		match.winnerEntryId != null &&
		match.winnerEntryId === match.home.entryId
	const awayWon =
		hasScore &&
		match.winnerEntryId != null &&
		match.winnerEntryId === match.away.entryId

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
							<Badge
								variant="outline"
								className="px-2 py-0 text-[10px]"
							>
								{t('officialH2HBye')}
							</Badge>
						) : null}
					</span>
				</div>
				<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-4 sm:gap-3 sm:px-4">
					<div className="min-w-0 text-right">
						<p
							className={cn(
								'break-words text-sm font-semibold leading-tight',
								homeWon && 'text-primary-ink'
							)}
							title={sideLabel(match.home, t('officialH2HAverageTeam'))}
						>
							{sideLabel(match.home, t('officialH2HAverageTeam'))}
						</p>
						{match.home.playerName ? (
							<p className="break-words text-[10px] leading-tight text-muted-foreground">
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
					</div>
					<div className="min-w-0">
						<p
							className={cn(
								'break-words text-sm font-semibold leading-tight',
								awayWon && 'text-primary-ink'
							)}
							title={sideLabel(match.away, t('officialH2HAverageTeam'))}
						>
							{sideLabel(match.away, t('officialH2HAverageTeam'))}
						</p>
						{match.away.playerName ? (
							<p className="break-words text-[10px] leading-tight text-muted-foreground">
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

function MatchupHistoryBoard({
	matches,
	currentEventId,
	isLive,
	isFinal
}: {
	matches: readonly OfficialH2HMatch[]
	currentEventId?: number
	isLive?: boolean
	isFinal?: boolean
}) {
	const t = useTranslations('LiveTournament')

	return (
		<div className="overflow-hidden rounded-xl border border-border/70 bg-background/45">
			<ul className="divide-y divide-border/60">
				{matches.map(match => {
					const hasScore =
						match.home.points != null && match.away.points != null
					const isLiveMatch =
						isLive === true && match.eventId === currentEventId
					const isFinishedMatch =
						currentEventId != null &&
						(match.eventId < currentEventId ||
							(match.eventId === currentEventId && isFinal === true))
					const status = isLiveMatch
						? t('officialH2HMatchupLive')
						: isFinishedMatch
							? t('officialH2HMatchupFinished')
							: t('officialH2HMatchupUpcoming')
					const home = sideLabel(match.home, t('officialH2HAverageTeam'))
					const away = sideLabel(match.away, t('officialH2HAverageTeam'))

					return (
						<li
							key={match.officialMatchId}
							className="px-3 py-3 sm:px-4"
						>
							<div className="flex min-w-0 items-center gap-3">
								<div className="flex w-12 shrink-0 flex-col gap-1">
									<span className="font-mono text-xs font-bold tabular-nums text-primary-ink">
										{t('officialH2HMatchupRound', { event: match.eventId })}
									</span>
									<Badge
										variant="outline"
										className={cn(
											'w-fit rounded-full px-1.5 py-0 text-[9px] leading-4',
											isLiveMatch
												? 'border-primary/35 bg-primary/10 text-primary-ink'
												: isFinishedMatch
													? 'border-border/70 bg-muted/60 text-muted-foreground'
													: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
										)}
									>
										{status}
									</Badge>
								</div>
								<div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
									<div className="min-w-0 text-right">
										<p className="break-words text-sm font-semibold leading-5">
											{home}
										</p>
										{match.home.playerName ? (
											<p className="break-words text-[10px] leading-4 text-muted-foreground">
												{match.home.playerName}
											</p>
										) : null}
									</div>
									<div className="min-w-10 text-center font-mono text-sm font-bold tabular-nums">
										{hasScore ? (
											<span>
												{scoreLabel(match.home)}
												<span className="px-1 text-muted-foreground">—</span>
												{scoreLabel(match.away)}
											</span>
										) : (
											<span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
												{t('officialH2HVersus')}
											</span>
										)}
									</div>
									<div className="min-w-0">
										<p className="break-words text-sm font-semibold leading-5">
											{away}
										</p>
										{match.away.playerName ? (
											<p className="break-words text-[10px] leading-4 text-muted-foreground">
												{match.away.playerName}
											</p>
										) : null}
									</div>
								</div>
							</div>
						</li>
					)
				})}
			</ul>
		</div>
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
	const router = useRouter()
	const isPageActive = usePageActive()
	const [snapshot, setSnapshot] = useState(initialSnapshot)
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [refreshFailed, setRefreshFailed] = useState(false)
	const [hasLoaded, setHasLoaded] = useState(Boolean(initialSnapshot))
	const [entryDesk, setEntryDesk] =
		useState<EntryOfficialH2HMatchupsItem | null>(null)
	const [entryDeskFailed, setEntryDeskFailed] = useState(false)
	const [hasLoadedEntryDesk, setHasLoadedEntryDesk] = useState(
		viewerEntryId == null
	)
	const inFlightRef = useRef<Promise<void> | null>(null)
	const boardsShareRef = useRef<HTMLElement | null>(null)
	const isCurrentEvent = activeEventId === eventId
	const showStandings = shouldShowOfficialH2HStandings(eventId, activeEventId)

	const refresh = useCallback(() => {
		if (inFlightRef.current) return inFlightRef.current
		const request = (async () => {
			const settle = <T,>(promise: Promise<T>) =>
				promise.then(
					value => ({ ok: true as const, value }),
					error => ({ ok: false as const, error })
				)
			const matchupRequest =
				viewerEntryId == null
					? Promise.resolve(null)
					: settle(
							executeQuery<EntryOfficialH2HMatchupsResponse>(
								GET_ENTRY_OFFICIAL_H2H_MATCHUPS,
								{ entryId: viewerEntryId },
								{ cache: 'no-store' }
							)
						)
			try {
				setIsRefreshing(true)
				const [snapshotResult, matchupResult] = await Promise.all([
					settle(
						executeQuery<TournamentOfficialH2HResponse>(
							GET_TOURNAMENT_OFFICIAL_H2H,
							{ tournamentId, eventId },
							{ cache: 'no-store' }
						)
					),
					matchupRequest
				])
				if (snapshotResult.ok) {
					setSnapshot(snapshotResult.value.tournamentOfficialH2H)
					setRefreshFailed(false)
				} else {
					console.error(
						'Failed to refresh official H2H mirror:',
						snapshotResult.error
					)
					setRefreshFailed(true)
				}
				setHasLoaded(true)
				if (matchupResult === null) {
					setEntryDesk(null)
					setEntryDeskFailed(false)
					setHasLoadedEntryDesk(true)
				} else if (matchupResult.ok) {
					setEntryDesk(
						matchupResult.value.entryOfficialH2HDesk.find(
							item => item.tournamentId === tournamentId
						) ?? null
					)
					setEntryDeskFailed(false)
					setHasLoadedEntryDesk(true)
				} else {
					console.error(
						'Failed to refresh official H2H matchup history:',
						matchupResult.error
					)
					setEntryDeskFailed(true)
					setHasLoadedEntryDesk(true)
				}
			} finally {
				setIsRefreshing(false)
			}
		})()
		inFlightRef.current = request
		void request.finally(() => {
			if (inFlightRef.current === request) inFlightRef.current = null
		})
		return request
	}, [eventId, tournamentId, viewerEntryId])

	useEffect(() => {
		if (!isPageActive || snapshot?.eventId === eventId) return
		void refresh()
	}, [eventId, isPageActive, refresh, snapshot?.eventId])

	useEffect(() => {
		if (!isPageActive || viewerEntryId == null || hasLoadedEntryDesk) return
		void refresh()
	}, [hasLoadedEntryDesk, isPageActive, refresh, viewerEntryId])

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
		() =>
			standings.find(standing => standing.entryId === viewerEntryId) ?? null,
		[standings, viewerEntryId]
	)
	const matchupHistory = entryDesk?.matchupHistory ?? EMPTY_OFFICIAL_H2H_MATCHES
	const isMatchupInitialLoading =
		viewerEntryId != null && !hasLoadedEntryDesk && isRefreshing
	const isInitialLoading = !hasLoaded && isRefreshing
	const scoreStatus = scoreSourceLabel(
		snapshot?.scoreSource ?? 'UNAVAILABLE',
		t
	)
	const previousEvent = eventId > 1 ? eventId - 1 : null
	const nextEvent = eventId < 38 ? eventId + 1 : null

	useEffect(() => {
		if (!isPageActive) return

		const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
			if (
				keyboardEvent.defaultPrevented ||
				keyboardEvent.altKey ||
				keyboardEvent.ctrlKey ||
				keyboardEvent.metaKey ||
				keyboardEvent.shiftKey
			)
				return

			const eventTarget =
				keyboardEvent.target instanceof Element ? keyboardEvent.target : null
			const activeElement = document.activeElement
			if (
				eventTarget?.closest(
					'input, textarea, select, [contenteditable="true"], [role="dialog"], [data-radix-dialog-content]'
				) ||
				(activeElement instanceof HTMLElement &&
					(activeElement.isContentEditable ||
						['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY'].includes(
							activeElement.tagName
						)))
			)
				return

			const targetEvent =
				keyboardEvent.key === 'ArrowLeft'
					? previousEvent
					: keyboardEvent.key === 'ArrowRight'
						? nextEvent
						: null
			if (targetEvent == null) return

			keyboardEvent.preventDefault()
			router.push(`/live/competitions/${tournamentId}?gw=${targetEvent}`)
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isPageActive, nextEvent, previousEvent, router, tournamentId])

	const standingsShareText = useMemo(() => {
		const lines = [
			t('officialH2HGameweek', { event: eventId }),
			`${t('officialH2HTable')}:`,
			...standings.map(
				standing =>
					`${standing.rank ?? '—'}. ${standing.entryName ?? `Entry ${standing.entryId}`} · ${standing.matchPoints} ${t('officialH2HMatchPoints')} · ${standing.pointsFor} ${t('officialH2HPointsFor')}`
			)
		]
		if (typeof window !== 'undefined') lines.push('', window.location.href)
		return lines.join('\n')
	}, [eventId, standings, t])
	const fixturesShareText = useMemo(() => {
		const lines = [
			t('officialH2HGameweek', { event: eventId }),
			`${t('officialH2HFixtures')}:`,
			...matches.map(match =>
				shareMatchLabel(
					match,
					t('officialH2HAverageTeam'),
					t('officialH2HVersus')
				)
			)
		]
		if (typeof window !== 'undefined') lines.push('', window.location.href)
		return lines.join('\n')
	}, [eventId, matches, t])
	const myMatchupsShareText = useMemo(() => {
		const lines = [
			t('officialH2HMyMatchups'),
			...matchupHistory.map(
				match =>
					`${t('officialH2HMatchupRound', { event: match.eventId })}: ${shareMatchLabel(match, t('officialH2HAverageTeam'), t('officialH2HVersus'))}`
			)
		]
		if (typeof window !== 'undefined') lines.push('', window.location.href)
		return lines.join('\n')
	}, [matchupHistory, t])
	const boardSlides = useMemo(
		() => [
			{
				id: 'standings',
				enabled: showStandings,
				label: t('officialH2HTable'),
				count: standings.length,
				content: isInitialLoading ? (
					<div
						className="space-y-1.5"
						aria-busy="true"
						aria-label={t('loadingStandings')}
					>
						{Array.from({ length: 7 }, (_, index) => (
							<div
								key={index}
								className="h-12 animate-pulse rounded-lg bg-muted/60"
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
						<Trophy
							className="size-7 text-muted-foreground/60"
							aria-hidden="true"
						/>
						<p className="text-sm font-medium">
							{snapshot?.awaitingSchedule
								? t('officialH2HAwaitingSchedule')
								: t('officialH2HLiveUnavailable', { event: eventId })}
						</p>
					</div>
				)
			},
			{
				id: 'fixtures',
				label: t('officialH2HFixtures'),
				count: matches.length,
				content: isInitialLoading ? (
					<div
						className="grid gap-3"
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
					<ul className="grid gap-3">
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
						<CalendarClock
							className="size-7 text-muted-foreground/60"
							aria-hidden="true"
						/>
						<p className="text-sm font-medium text-muted-foreground">
							{snapshot?.awaitingSchedule
								? t('officialH2HAwaitingGameweek', { event: eventId })
								: t('officialH2HNoFixtures', { event: eventId })}
						</p>
					</div>
				)
			},
			{
				id: 'my-matchups',
				enabled: viewerEntryId != null,
				label: t('officialH2HMyMatchups'),
				count: matchupHistory.length,
				content: isMatchupInitialLoading ? (
					<div
						className="grid gap-1.5"
						aria-busy="true"
						aria-label={t('loadingStandings')}
					>
						{Array.from({ length: 6 }, (_, index) => (
							<div
								key={index}
								className="h-16 animate-pulse rounded-lg bg-muted/60"
							/>
						))}
					</div>
				) : entryDeskFailed ? (
					<div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
						<CalendarClock
							className="size-7 text-muted-foreground/60"
							aria-hidden="true"
						/>
						<p className="text-sm font-medium text-muted-foreground">
							{t('officialH2HMyMatchupsUnavailable')}
						</p>
					</div>
				) : matchupHistory.length > 0 ? (
					<MatchupHistoryBoard
						matches={matchupHistory}
						currentEventId={entryDesk?.eventId}
						isLive={entryDesk?.isLive}
						isFinal={entryDesk?.isFinal}
					/>
				) : (
					<div className="flex min-h-44 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
						<CalendarClock
							className="size-7 text-muted-foreground/60"
							aria-hidden="true"
						/>
						<p className="text-sm font-medium text-muted-foreground">
							{t('officialH2HNoMyMatchups')}
						</p>
					</div>
				)
			}
		],
		[
			entryDesk?.eventId,
			entryDesk?.isLive,
			entryDesk?.isFinal,
			entryDeskFailed,
			eventId,
			isInitialLoading,
			isMatchupInitialLoading,
			matches,
			matchupHistory,
			snapshot?.awaitingSchedule,
			standings,
			showStandings,
			t,
			tournamentId,
			viewerEntryId
		]
	)

	return (
		<div className="space-y-4">
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
										href={
											'/live/competitions/' +
											tournamentId +
											'?gw=' +
											previousEvent
										}
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
										href={
											'/live/competitions/' + tournamentId + '?gw=' + nextEvent
										}
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
						</div>
					</div>

					<dl className="mt-5 grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-4">
						<div className="flex min-w-0 flex-col gap-1 pr-3 sm:pr-5">
							<dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<Trophy
									className="size-3.5 text-primary-ink"
									aria-hidden="true"
								/>
								{t('rank')}
							</dt>
							<dd className="font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
								{viewerStanding?.rank ?? '—'}
							</dd>
						</div>
						<div className="flex min-w-0 flex-col gap-1 px-3 sm:px-5">
							<dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<CheckCircle2
									className="size-3.5 text-primary-ink"
									aria-hidden="true"
								/>
								{t('officialH2HMatchPoints')}
							</dt>
							<dd className="font-mono text-xl font-bold tabular-nums tracking-tight sm:text-2xl">
								{viewerStanding?.matchPoints ?? '—'}
							</dd>
						</div>
						<div className="flex min-w-0 flex-col gap-1 pl-3 sm:pl-5">
							<dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
								<Swords
									className="size-3.5 text-primary-ink"
									aria-hidden="true"
								/>
								{t('officialH2HRecord')}
							</dt>
							<dd className="text-sm font-bold tracking-tight sm:text-base">
								{viewerStanding
									? t('officialH2HRecordValue', {
											won: viewerStanding.won,
											drawn: viewerStanding.drawn,
											lost: viewerStanding.lost
										})
									: '—'}
							</dd>
						</div>
					</dl>
				</div>
			</section>

			{refreshFailed ? (
				<Alert
					variant="warning"
					className="rounded-xl"
				>
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

			<section
				ref={boardsShareRef}
				aria-label={t('officialH2HBoardsPager')}
				data-share-fit-content="true"
				data-share-preserve-width="true"
				className="overflow-hidden rounded-2xl border border-border/80 bg-card p-3 shadow-sm sm:p-4"
			>
				<HomeAutoCarousel
					slides={boardSlides}
					labels={{
						pagerLabel: t('officialH2HBoardsPager'),
						previousPage: t('officialH2HBoardsPrevious'),
						nextPage: t('officialH2HBoardsNext'),
						pause: t('officialH2HBoardsPause'),
						resume: t('officialH2HBoardsResume')
					}}
					dataAttribute="official-h2h-boards"
					renderHeader={slide => (
						<div className="flex min-w-0 items-center gap-2.5">
							<div
								className={cn(
									'flex size-7 shrink-0 items-center justify-center rounded-lg',
									slide.id === 'standings'
										? 'bg-primary/10 text-primary-ink'
										: 'bg-secondary/20 text-secondary-foreground'
								)}
							>
								{slide.id === 'standings' ? (
									<Swords
										className="size-4"
										aria-hidden="true"
									/>
								) : (
									<CalendarClock
										className="size-4"
										aria-hidden="true"
									/>
								)}
							</div>
							<h3 className="truncate font-display text-base font-bold tracking-tight">
								{slide.label}
							</h3>
						</div>
					)}
					renderAction={slide => (
						<ShareActions
							text={
								slide.id === 'standings'
									? standingsShareText
									: slide.id === 'fixtures'
										? fixturesShareText
										: myMatchupsShareText
							}
							imageRef={boardsShareRef}
							title={slide.label}
							disabled={
								slide.id === 'my-matchups'
									? isMatchupInitialLoading
									: isInitialLoading
							}
						/>
					)}
				/>
			</section>
		</div>
	)
}
