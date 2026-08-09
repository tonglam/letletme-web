'use client'

import { StatsMetricTile, StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { cn } from '@/lib/utils'
import {
	ArrowDown,
	ArrowUp,
	Flame,
	TrendingDown,
	TrendingUp,
	Trophy,
} from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { TournamentStatsViewModel } from '../_lib/tournament-stats-model'

function RankMovement({ stats }: { stats: TournamentStatsViewModel }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	if (stats.myRank === null || stats.myPreviousRank === null) {
		return <span className="text-muted-foreground">{t('notInTournament')}</span>
	}
	if (stats.myPreviousRank > stats.myRank) {
		return (
			<span className="inline-flex items-center gap-1 text-success">
				<ArrowUp className="size-3.5" aria-hidden="true" />{' '}
				{t('up', {
					count: format.number(stats.myPreviousRank - stats.myRank, {
						notation: 'compact',
					}),
				})}
			</span>
		)
	}
	if (stats.myPreviousRank < stats.myRank) {
		return (
			<span className="inline-flex items-center gap-1 text-destructive">
				<ArrowDown className="size-3.5" aria-hidden="true" />{' '}
				{t('down', {
					count: format.number(stats.myRank - stats.myPreviousRank, {
						notation: 'compact',
					}),
				})}
			</span>
		)
	}
	return <span className="text-muted-foreground">{t('noChange')}</span>
}

/** List row — hairline only, no filled gray. */
function BoardRow({
	primary,
	secondary,
	trailing,
	emphasis,
}: {
	primary: string
	secondary: string
	trailing: React.ReactNode
	emphasis?: 'success' | 'danger' | 'default'
}) {
	return (
		<li
			className={cn(
				'flex items-center justify-between gap-2 border-b border-border/50 px-0.5 py-2.5 text-sm last:border-b-0',
				emphasis === 'success' && 'border-l-2 border-l-success/70 pl-2',
				emphasis === 'danger' && 'border-l-2 border-l-destructive/70 pl-2',
			)}
		>
			<div className="min-w-0">
				<p className="truncate font-medium text-foreground">{primary}</p>
				<p className="truncate text-xs text-muted-foreground">{secondary}</p>
			</div>
			<div className="shrink-0 text-right">{trailing}</div>
		</li>
	)
}

function BoardColumn({
	icon: Icon,
	title,
	empty,
	children,
	tone,
}: {
	icon: typeof Trophy
	title: string
	empty: string
	children: React.ReactNode
	tone?: 'success' | 'danger' | 'default'
}) {
	const hasKids = Array.isArray(children)
		? children.length > 0
		: Boolean(children)
	return (
		<div className="flex min-h-0 flex-col">
			<h3
				className={cn(
					'mb-2 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.12em]',
					tone === 'success' && 'text-success',
					tone === 'danger' && 'text-destructive',
					(!tone || tone === 'default') && 'text-muted-foreground',
				)}
			>
				<Icon className="size-3.5 shrink-0" aria-hidden="true" />
				{title}
			</h3>
			{hasKids ? (
				<ul className="flex flex-1 flex-col border-t border-border/60">
					{children}
				</ul>
			) : (
				<p className="border-t border-dashed border-border/70 px-1 py-4 text-center text-xs text-muted-foreground">
					{empty}
				</p>
			)}
		</div>
	)
}

export function TournamentPerformance({
	dataGameweek,
	stats,
}: {
	dataGameweek: number | null
	stats: TournamentStatsViewModel
}) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const gwLabel =
		dataGameweek == null
			? t('latestGameweek')
			: t('gameweek', { gameweek: dataGameweek })

	return (
		<div className="mb-5 space-y-5 sm:mb-6 sm:space-y-6">
			<StatsSectionCard icon={Trophy} title={t('myPerformance')}>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
					<StatsMetricTile
						label={t('myRank')}
						value={
							stats.myRank === null
								? '—'
								: format.number(stats.myRank, { notation: 'compact' })
						}
						detail={<RankMovement stats={stats} />}
					/>
					<StatsMetricTile
						label={gwLabel}
						value={
							stats.myTeam?.points == null
								? '—'
								: t('pointsValue', { points: stats.myTeam.points })
						}
						detail={
							<span>
								{t('eventCost', {
									points:
										stats.myTeam?.eventCost == null
											? '—'
											: t('pointsValue', {
													points: stats.myTeam.eventCost,
												}),
								})}
							</span>
						}
					/>
					<StatsMetricTile
						label={t('captain')}
						value={
							stats.myTeam?.captaincy.name
								? stats.myTeam.captaincy.name
								: '—'
						}
						detail={
							<span>
								{stats.myTeam?.captaincy.team
									? `${stats.myTeam.captaincy.team} · `
									: ''}
								{t('pointsValue', {
									points: stats.myTeam?.captaincy.points ?? 0,
								})}
							</span>
						}
					/>
					<StatsMetricTile
						label={t('topScore')}
						value={
							stats.topPerformers[0]
								? t('pointsValue', {
										points: stats.topPerformers[0].points,
									})
								: '—'
						}
						detail={
							<span className="truncate">
								{stats.topPerformers[0]?.teamName ?? t('noData')}
							</span>
						}
					/>
				</div>
			</StatsSectionCard>

			<StatsSectionCard
				title={t('gwHighlights', {
					gameweek: dataGameweek ?? '—',
				})}
				description={t('gwHighlightsHint')}
			>
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-6">
					<BoardColumn
						icon={Flame}
						title={t('topScorers')}
						empty={t('topScorersEmpty')}
						tone="default"
					>
						{stats.topPerformers.map(row => (
							<BoardRow
								key={row.entryId}
								primary={`${row.rank}. ${row.teamName}`}
								secondary={
									row.captain.name
										? t('captainPoints', {
												name: row.captain.name,
												points: t('pointsValue', {
													points: row.captain.points,
												}),
											})
										: row.managerName
								}
								trailing={
									<span className="font-display text-base font-bold tabular-nums">
										{t('pointsValue', { points: row.points })}
									</span>
								}
							/>
						))}
					</BoardColumn>

					<BoardColumn
						icon={TrendingUp}
						title={t('biggestRisers')}
						empty={t('biggestRisersEmpty')}
						tone="success"
					>
						{stats.biggestRisers.map(row => (
							<BoardRow
								key={row.entryId}
								emphasis="success"
								primary={row.teamName}
								secondary={t('rankMoveFromTo', {
									from: row.previousRank,
									to: row.rank,
								})}
								trailing={
									<span className="inline-flex items-center gap-0.5 font-display text-sm font-bold tabular-nums text-success">
										<ArrowUp className="size-3.5" aria-hidden="true" />
										{t('placesGained', { count: row.placesGained })}
									</span>
								}
							/>
						))}
					</BoardColumn>

					<BoardColumn
						icon={TrendingDown}
						title={t('biggestFallers')}
						empty={t('biggestFallersEmpty')}
						tone="danger"
					>
						{stats.biggestFallers.map(row => (
							<BoardRow
								key={row.entryId}
								emphasis="danger"
								primary={row.teamName}
								secondary={t('rankMoveFromTo', {
									from: row.previousRank,
									to: row.rank,
								})}
								trailing={
									<span className="inline-flex items-center gap-0.5 font-display text-sm font-bold tabular-nums text-destructive">
										<ArrowDown className="size-3.5" aria-hidden="true" />
										{t('placesLost', { count: row.placesLost })}
									</span>
								}
							/>
						))}
					</BoardColumn>
				</div>
			</StatsSectionCard>
		</div>
	)
}
