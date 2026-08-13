'use client'

import {
	buildTournamentStatsQueryString,
	TOURNAMENT_STATS_PATH,
} from '@/app/me/tournament/_lib/tournament-stats-url'
import { DeltaBadge } from '@/components/data/DeltaBadge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import {
	HOME_LEAGUE_RANK_LIMIT,
	type HomeLeagueRankRow,
	type RankMovement,
} from '@/lib/home-league-ranks'
import { cn, formatInteger } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

/** How many extra rows each "Show more" click adds. */
const EXPAND_STEP = 10

function MovementBadge({ movement }: { movement: RankMovement }) {
	if (movement.kind === 'up') {
		return <DeltaBadge value={movement.places} size="sm" />
	}
	if (movement.kind === 'down') {
		return <DeltaBadge value={-movement.places} size="sm" />
	}
	if (movement.kind === 'flat') {
		return <DeltaBadge value={0} size="sm" format={() => null} />
	}
	return <span className="text-caption text-muted-foreground/50">·</span>
}

function LeagueRow({ row }: { row: HomeLeagueRankRow }) {
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

	const body = (
		<>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-medium leading-tight">
					{row.name}
				</span>
				<span className="mt-0.5 block truncate text-caption text-muted-foreground">
					{metaParts.join(' · ')}
				</span>
			</span>
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
		</>
	)

	const rowClass = cn(
		'flex w-full items-center gap-2 border-b border-border/40 py-2.5 last:border-b-0',
		row.tournamentId != null &&
			'transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
	)

	if (row.tournamentId != null) {
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

export function PersonalLeagueRankList({ rows }: { rows: HomeLeagueRankRow[] }) {
	const t = useTranslations('Home')
	const [visibleCount, setVisibleCount] = useState(HOME_LEAGUE_RANK_LIMIT)

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
			<ul className="rounded-lg border surface-inset-soft px-3">
				{visible.map(row => (
					<LeagueRow key={row.id} row={row} />
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
