'use client'

import {
	buildTournamentStatsQueryString,
	TOURNAMENT_STATS_PATH,
} from '@/app/me/tournament/_lib/tournament-stats-url'
import { Button } from '@/components/ui/button'
import { usePageActive } from '@/hooks/use-page-active'
import { Link } from '@/i18n/navigation'
import { executeQuery } from '@/lib/graphql-client'
import {
	GET_ENTRY_OFFICIAL_H2H_DESK,
	type EntryOfficialH2HDeskResponse,
} from '@/lib/graphql/operations/tournaments'
import {
	HOME_LEAGUE_RANK_LIMIT,
	mergeHomeOfficialH2HDesk,
	type HomeLeagueRankRow,
	type RankMovement,
} from '@/lib/home-league-ranks'
import { cn, formatInteger } from '@/lib/utils'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Minus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'

/** How many extra rows each "Show more" click adds. */
const EXPAND_STEP = 10

function MovementBadge({ movement }: { movement: RankMovement }) {
	if (movement.kind === 'up') {
		return (
			<span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums text-success">
				<ArrowUp className="size-3 shrink-0" aria-hidden="true" />
				{movement.places}
			</span>
		)
	}
	if (movement.kind === 'down') {
		return (
			<span className="inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums text-destructive">
				<ArrowDown className="size-3 shrink-0" aria-hidden="true" />
				{movement.places}
			</span>
		)
	}
	if (movement.kind === 'flat') {
		return (
			<span className="inline-flex items-center text-muted-foreground">
				<Minus className="size-3" aria-hidden="true" />
			</span>
		)
	}
	return <span className="text-[11px] text-muted-foreground/50">·</span>
}

function LeagueRow({ entryId, row }: { entryId: number; row: HomeLeagueRankRow }) {
	const t = useTranslations('Home')
	const metaParts = [
		row.type === 'H2H' ? t('personalLeagueH2H') : t('personalLeagueClassic'),
	]
	if (row.totalTeamNum != null) {
		metaParts.push(t('personalLeagueTeams', { count: row.totalTeamNum }))
	}
	const rankDisplay =
		row.entryRank != null ? formatInteger(row.entryRank) : '—'

	const ariaMove =
		row.movement.kind === 'up'
			? t('personalLeagueUp', { count: row.movement.places })
			: row.movement.kind === 'down'
				? t('personalLeagueDown', { count: row.movement.places })
				: row.movement.kind === 'flat'
					? t('personalLeagueFlat')
					: t('personalLeagueNoChange')

	const rank = (
		<span
			className="flex shrink-0 items-center gap-2 pl-2"
			aria-label={`${t('personalLeagueRank', { rank: rankDisplay })}, ${ariaMove}`}
		>
			<span className="font-mono text-sm font-semibold tabular-nums tracking-tight text-primary-ink">
				<span className="text-muted-foreground">#</span>
				{rankDisplay}
			</span>
			<span className="flex w-8 justify-end">
				<MovementBadge movement={row.movement} />
			</span>
		</span>
	)
	const desk = row.officialH2H
	const match = desk?.match ?? null
	const viewerIsHome = match?.home.entryId === entryId
	const viewerIsAway = match?.away.entryId === entryId
	const viewerSide = viewerIsHome ? match?.home : viewerIsAway ? match?.away : null
	const opponentSide = viewerIsHome ? match?.away : viewerIsAway ? match?.home : null
	const opponentName = opponentSide?.isAverage
		? t('personalH2HAverageTeam')
		: opponentSide?.entryName ?? t('personalH2HOpponent')
	const matchup = desk?.awaitingSchedule
		? t('personalH2HAwaiting')
		: match && viewerSide && opponentSide
			? viewerSide.points == null || opponentSide.points == null
				? t('personalH2HScheduledMatch', { opponent: opponentName })
				: t('personalH2HScoredMatch', {
					myPoints: viewerSide.points,
					opponent: opponentName,
					opponentPoints: opponentSide.points,
				})
			: t('personalH2HNoMatch')
	const h2hStatus = desk?.awaitingSchedule
		? t('personalH2HScheduled')
		: desk?.isLive
			? t('personalH2HLive')
			: desk?.isFinal
				? t('personalH2HFinal')
				: t('personalH2HScheduled')

	const body = desk ? (
		<span className="min-w-0 flex-1 py-0.5">
			<span className="flex items-start justify-between gap-2">
				<span className="block min-w-0 truncate text-sm font-medium leading-tight">
					{row.name}
				</span>
				{rank}
			</span>
			<span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
				<span className="truncate">{metaParts.join(' · ')}</span>
				<span className="shrink-0 font-mono font-semibold tabular-nums text-primary-ink">
					{t('personalH2HPoints', { points: desk.matchPoints })}
				</span>
			</span>
			<span className="mt-1.5 flex min-w-0 items-center gap-2 text-xs">
				<span className={cn(
					'shrink-0 font-display text-[10px] font-bold uppercase tracking-[0.12em]',
					desk.isLive ? 'text-pink' : 'text-muted-foreground',
				)}>
					GW{desk.eventId} · {h2hStatus}
				</span>
				<span className="truncate font-medium">{matchup}</span>
			</span>
		</span>
	) : (
		<>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium leading-tight">
					{row.name}
				</span>
				<span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
					{metaParts.join(' · ')}
				</span>
			</span>
			{rank}
		</>
	)

	const rowClass = cn(
		'flex w-full items-center gap-2 border-b border-border/40 py-2.5 last:border-b-0',
		desk?.isLive && '-mx-3 w-[calc(100%+1.5rem)] bg-pink/5 px-3',
		row.tournamentId != null &&
			'transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
	)

	if (row.tournamentId != null) {
		if (desk) {
			return (
				<li>
					<Link
						href={`/live/competitions/${row.tournamentId}?gw=${desk.eventId}`}
						prefetch={false}
						className={rowClass}
					>
						{body}
					</Link>
				</li>
			)
		}
		const qs = buildTournamentStatsQueryString({
			tournamentId: row.tournamentId,
			view: 'season',
		})
		return (
			<li>
				<Link
					href={`${TOURNAMENT_STATS_PATH}?${qs}`}
					prefetch={false}
					className={rowClass}
				>
					{body}
				</Link>
			</li>
		)
	}

	return <li className={rowClass}>{body}</li>
}

export function PersonalLeagueRankList({
	entryId,
	rows: initialRows,
}: {
	entryId: number
	rows: HomeLeagueRankRow[]
}) {
	const t = useTranslations('Home')
	const isPageActive = usePageActive()
	const [rows, setRows] = useState(initialRows)
	const [visibleCount, setVisibleCount] = useState(HOME_LEAGUE_RANK_LIMIT)
	const hasLiveH2H = rows.some(row => row.officialH2H?.isLive)

	useEffect(() => setRows(initialRows), [initialRows])

	useEffect(() => {
		if (!hasLiveH2H || !isPageActive) return
		const refresh = async () => {
			try {
				const response = await executeQuery<EntryOfficialH2HDeskResponse>(
					GET_ENTRY_OFFICIAL_H2H_DESK,
					{ entryId },
					{ cache: 'no-store' },
				)
				setRows(current => mergeHomeOfficialH2HDesk(
					current,
					response.entryOfficialH2HDesk,
				))
			} catch (error) {
				console.error('[personal desk] official H2H refresh failed:', error)
			}
		}
		const timer = window.setInterval(() => void refresh(), 60_000)
		return () => window.clearInterval(timer)
	}, [entryId, hasLiveH2H, isPageActive])

	const visible = useMemo(
		() => rows.slice(0, visibleCount),
		[rows, visibleCount],
	)
	const remaining = Math.max(0, rows.length - visible.length)
	const isExpanded = visibleCount > HOME_LEAGUE_RANK_LIMIT
	const canShowMore = remaining > 0

	if (rows.length === 0) {
		return (
			<p className="rounded-md border border-dashed border-border/70 px-3 py-3 text-center text-xs text-muted-foreground">
				{t('personalLeaguesEmpty')}
			</p>
		)
	}

	return (
		<div>
			<ul className="rounded-lg border border-border/60 bg-muted/15 px-3 dark:bg-muted/10">
				{visible.map(row => (
					<LeagueRow entryId={entryId} key={`${row.id}:${row.tournamentId ?? ''}`} row={row} />
				))}
			</ul>

			{(canShowMore || isExpanded) && (
				<div className="mt-2.5 space-y-1.5">
					{canShowMore ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 w-full gap-1.5 border-border/80 bg-background text-xs font-semibold shadow-sm"
							onClick={() =>
								setVisibleCount(n =>
									Math.min(rows.length, n + EXPAND_STEP),
								)
							}
						>
							{t('personalLeaguesShowMore', {
								count: Math.min(EXPAND_STEP, remaining),
							})}
							<span className="font-normal text-muted-foreground">
								({visible.length}/{rows.length})
							</span>
							<ChevronDown className="size-3.5" aria-hidden="true" />
						</Button>
					) : null}
					{isExpanded ? (
						<div className="flex justify-center">
							<button
								type="button"
								className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
								onClick={() => setVisibleCount(HOME_LEAGUE_RANK_LIMIT)}
							>
								{t('personalLeaguesShowLess')}
								<ChevronUp className="size-3.5" aria-hidden="true" />
							</button>
						</div>
					) : null}
				</div>
			)}
		</div>
	)
}
