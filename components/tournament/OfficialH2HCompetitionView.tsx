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
	type TournamentOfficialH2H,
	type TournamentOfficialH2HResponse
} from '@/lib/graphql/operations/tournaments'
import { traceableOfficialH2HScore } from '@/lib/live-manager-score'
import { cn, formatInteger } from '@/lib/utils'
import {
	ArrowLeft,
	ArrowRight,
	CalendarClock,
	RefreshCw,
	Swords
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

	return (
		<li>
			<Card
				className={cn(
					'overflow-hidden border-border/80 p-0 shadow-sm',
					involvesViewer && 'border-primary/45 ring-1 ring-primary/20'
				)}
			>
				<div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					<span>
						{match.phase === 'KNOCKOUT'
							? match.knockoutName || t('officialH2HKnockout')
							: t('officialH2HRegular')}
					</span>
					<span className="flex items-center gap-2">
						{involvesViewer ? (
							<Badge variant="outline">{t('youBadge')}</Badge>
						) : null}
						{match.isBye ? (
							<Badge variant="outline">{t('officialH2HBye')}</Badge>
						) : null}
					</span>
				</div>
				<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-4">
					<div className="min-w-0 text-right">
						<p className="truncate text-sm font-semibold">
							{sideLabel(match.home, t('officialH2HAverageTeam'))}
						</p>
						{match.home.playerName ? (
							<p className="mt-0.5 truncate text-[11px] text-muted-foreground">
								{match.home.playerName}
							</p>
						) : null}
					</div>
					<div className="flex min-w-24 items-center justify-center gap-2 font-mono text-lg font-bold tabular-nums">
						{hasScore ? (
							<>
								<span>{scoreLabel(match.home)}</span>
								<span className="text-muted-foreground">—</span>
								<span>{scoreLabel(match.away)}</span>
							</>
						) : (
							<span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
								{t('officialH2HVersus')}
							</span>
						)}
					</div>
					<div className="min-w-0">
						<p className="truncate text-sm font-semibold">
							{sideLabel(match.away, t('officialH2HAverageTeam'))}
						</p>
						{match.away.playerName ? (
							<p className="mt-0.5 truncate text-[11px] text-muted-foreground">
								{match.away.playerName}
							</p>
						) : null}
					</div>
				</div>
				{match.tiebreak ? (
					<p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
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
			} catch (error) {
				console.error('Failed to refresh official H2H mirror:', error)
				setRefreshFailed(true)
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
	const roundButtonClass = 'min-w-[5.75rem] justify-center'

	return (
		<div
			ref={shareRef}
			className="space-y-5"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="font-display text-xl font-bold tracking-tight">
						{t('officialH2HGameweek', { event: eventId })}
					</h2>
				</div>
				<div
					className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto"
					data-share-exclude="true"
				>
					<Button
						variant="outline"
						size="sm"
						className={roundButtonClass}
						asChild={previousEvent != null}
						disabled={previousEvent == null}
					>
						{previousEvent == null ? (
							<>
								<ArrowLeft aria-hidden="true" />
								{t('previous')}
							</>
						) : (
							<Link
								href={`/live/competitions/${tournamentId}?gw=${previousEvent}`}
								prefetch={false}
							>
								<ArrowLeft aria-hidden="true" />
								{t('previous')}
							</Link>
						)}
					</Button>
					<Button
						variant="outline"
						size="sm"
						className={roundButtonClass}
						asChild={nextEvent != null}
						disabled={nextEvent == null}
					>
						{nextEvent == null ? (
							<>
								{t('next')}
								<ArrowRight aria-hidden="true" />
							</>
						) : (
							<Link
								href={`/live/competitions/${tournamentId}?gw=${nextEvent}`}
								prefetch={false}
							>
								{t('next')}
								<ArrowRight aria-hidden="true" />
							</Link>
						)}
					</Button>
					<Button
						variant="outline"
						size="sm"
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

			{refreshFailed ? (
				<Alert variant="warning">
					<AlertDescription>{t('officialH2HRefreshFallback')}</AlertDescription>
				</Alert>
			) : null}

			{snapshot?.awaitingSchedule ? (
				<Card className="border-dashed border-border/80 p-8 text-center shadow-sm">
					<CalendarClock
						className="mx-auto size-7 text-primary-ink"
						aria-hidden="true"
					/>
					<h3 className="mt-4 font-display text-lg font-bold tracking-tight">
						{t('officialH2HAwaitingSchedule')}
					</h3>
					<p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
						{t('officialH2HAwaitingScheduleHelp')}
					</p>
				</Card>
			) : null}

			{snapshot && !snapshot.awaitingSchedule && !hasTraceableScore ? (
				<Alert variant="warning">
					<AlertDescription>{t('officialH2HPendingSettlement')}</AlertDescription>
				</Alert>
			) : null}

			<div>
				<Card className="overflow-hidden border-border/80 p-0 shadow-sm">
					<div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
						<Swords
							className="size-4 text-primary-ink"
							aria-hidden="true"
						/>
						<h3 className="font-display text-base font-bold tracking-tight">
							{t('officialH2HTable')}
						</h3>
					</div>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[38rem] text-sm">
							<thead className="bg-muted/30 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
								<tr>
									<th
										scope="col"
										className="w-12 px-3 py-2 text-center"
									>
										#
									</th>
									<th
										scope="col"
										className="px-3 py-2 text-left"
									>
										{t('team')}
									</th>
									<th
										scope="col"
										className="px-2 py-2 text-center"
									>
										P
									</th>
									<th
										scope="col"
										className="px-2 py-2 text-center"
									>
										W
									</th>
									<th
										scope="col"
										className="px-2 py-2 text-center"
									>
										D
									</th>
									<th
										scope="col"
										className="px-2 py-2 text-center"
									>
										L
									</th>
									<th
										scope="col"
										className="px-3 py-2 text-right"
									>
										{t('officialH2HPointsFor')}
									</th>
									<th
										scope="col"
										className="px-3 py-2 text-right"
									>
										{t('officialH2HMatchPoints')}
									</th>
								</tr>
							</thead>
							<tbody>
								{standings.map(standing => (
									<tr
										key={standing.entryId}
										className={cn(
											'border-t border-border/50',
											standing.entryId === viewerEntryId &&
												'bg-primary/5 dark:bg-primary/10'
										)}
									>
										<td className="px-3 py-3 text-center font-mono font-semibold tabular-nums">
											{standing.rank ?? '—'}
										</td>
										<td className="px-3 py-3">
											<Link
												href={`/live/points/${standing.entryId}?tournamentId=${tournamentId}&gw=${eventId}`}
												prefetch={false}
												className="block min-w-0 hover:text-primary-ink hover:underline underline-offset-2"
											>
												<p className="truncate font-medium">
													{standing.entryName ?? `Entry ${standing.entryId}`}
												</p>
												{standing.playerName ? (
													<p className="truncate text-xs text-muted-foreground">
														{standing.playerName}
													</p>
												) : null}
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
												className="px-2 py-3 text-center font-mono tabular-nums"
											>
												{value}
											</td>
										))}
										<td className="px-3 py-3 text-right font-mono tabular-nums">
											{standing.pointsFor}
										</td>
										<td className="px-3 py-3 text-right font-mono font-bold tabular-nums text-primary-ink">
											{standing.matchPoints}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>

				<section aria-labelledby="official-h2h-fixtures-title">
					<div className="mb-3 flex items-center justify-between gap-3">
						<h3
							id="official-h2h-fixtures-title"
							className="font-display text-lg font-bold tracking-tight"
						>
							{t('officialH2HFixtures')}
						</h3>
						<Badge variant="outline">{t('officialH2HOfficialOrder')}</Badge>
					</div>
					{matches.length > 0 ? (
						<ul className="grid gap-3 md:grid-cols-2">
							{matches.map(match => (
								<MatchCard
									key={match.officialMatchId}
									match={match}
									viewerEntryId={viewerEntryId}
								/>
							))}
						</ul>
					) : (
						<Card className="border-dashed border-border/80 p-6 text-center text-sm text-muted-foreground shadow-sm">
							{snapshot?.awaitingSchedule
								? t('officialH2HAwaitingGameweek', { event: eventId })
								: t('officialH2HNoFixtures', { event: eventId })}
						</Card>
					)}
				</section>
			</div>
		</div>
	)
}
