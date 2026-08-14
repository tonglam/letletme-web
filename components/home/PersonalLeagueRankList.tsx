'use client'

import {
	buildTournamentStatsQueryString,
	TOURNAMENT_STATS_PATH
} from '@/app/me/tournament/_lib/tournament-stats-url'
import { RouteReadyMarker } from '@/components/analytics/RouteReadyMarker'
import { DeltaBadge } from '@/components/data/DeltaBadge'
import { Button } from '@/components/ui/button'
import { Link } from '@/i18n/navigation'
import type {
	HomeLeagueRank,
	HomeRankDirection
} from '@/lib/graphql/operations/home'
import { cn, formatInteger } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

const HOME_LEAGUE_RANK_LIMIT = 6
const EXPAND_STEP = 10

function MovementBadge({
	direction,
	places
}: {
	direction: HomeRankDirection
	places: number | null
}) {
	if (direction === 'UP') {
		return <DeltaBadge value={places ?? 0} size="sm" />
	}
	if (direction === 'DOWN') {
		return <DeltaBadge value={-(places ?? 0)} size="sm" />
	}
	if (direction === 'FLAT') {
		return <DeltaBadge value={0} size="sm" format={() => null} />
	}
	return <span className="text-caption text-muted-foreground/50">·</span>
}

function LeagueRow({ row }: { row: HomeLeagueRank }) {
	const t = useTranslations('Home')
	const rankDisplay = row.rank == null ? '—' : formatInteger(row.rank)
	const ariaMove =
		row.movement.direction === 'UP'
			? t('personalLeagueUp', { count: row.movement.places ?? 0 })
			: row.movement.direction === 'DOWN'
				? t('personalLeagueDown', { count: row.movement.places ?? 0 })
				: row.movement.direction === 'FLAT'
					? t('personalLeagueFlat')
					: t('personalLeagueNoChange')
	const body = (
		<>
			<span className="min-w-0 flex-1 truncate text-sm font-medium leading-tight">
				{row.name}
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
					<MovementBadge
						direction={row.movement.direction}
						places={row.movement.places}
					/>
				</span>
			</span>
		</>
	)
	const rowClass = cn(
		'flex min-h-11 w-full items-center gap-2 border-b border-border/40 py-2.5 last:border-b-0',
		row.tournamentId != null &&
			'transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
	)

	if (row.tournamentId == null) {
		return <li className={rowClass}>{body}</li>
	}
	const query = buildTournamentStatsQueryString({
		tournamentId: row.tournamentId,
		view: 'season'
	})
	return (
		<li>
			<Link
				href={`${TOURNAMENT_STATS_PATH}?${query}`}
				prefetch={false}
				className={rowClass}
			>
				{body}
			</Link>
		</li>
	)
}

export function PersonalLeagueRankList({
	rows,
	readyKey
}: {
	rows: HomeLeagueRank[]
	readyKey: string
}) {
	const t = useTranslations('Home')
	const [visibleCount, setVisibleCount] = useState(HOME_LEAGUE_RANK_LIMIT)
	const visible = useMemo(
		() => rows.slice(0, visibleCount),
		[rows, visibleCount]
	)
	const remaining = Math.max(0, rows.length - visible.length)
	const isExpanded = visibleCount > HOME_LEAGUE_RANK_LIMIT
	const canShowMore = remaining > 0

	return (
		<div data-home-league-ranks-ready="true">
			{rows.length === 0 ? (
				<p className="min-h-11 rounded-md border border-dashed border-border/70 px-3 py-3 text-center text-xs text-muted-foreground">
					{t('personalLeaguesEmpty')}
				</p>
			) : (
				<ul className="rounded-lg border surface-inset-soft px-3">
					{visible.map(row => (
						<LeagueRow key={row.key} row={row} />
					))}
				</ul>
			)}

			{(canShowMore || isExpanded) && (
				<div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
					{canShowMore ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-9 w-full gap-1.5 border-border/80 bg-background text-xs font-semibold shadow-sm"
							onClick={() =>
								setVisibleCount(count =>
									Math.min(rows.length, count + EXPAND_STEP)
								)
							}
						>
							{t('personalLeaguesShowMore')}
							<ChevronDown className="size-3.5" aria-hidden="true" />
						</Button>
					) : null}
					{isExpanded ? (
						<button
							type="button"
							className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
							onClick={() => setVisibleCount(HOME_LEAGUE_RANK_LIMIT)}
						>
							{t('personalLeaguesShowLess')}
							<ChevronUp className="size-3.5" aria-hidden="true" />
						</button>
					) : null}
				</div>
			)}
			<RouteReadyMarker
				name="HOME_LEAGUE_RANKS_READY"
				readyKey={readyKey}
				audienceHint="session-hint"
				goodMs={500}
				poorMs={1_000}
			/>
		</div>
	)
}
