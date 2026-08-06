import { StatsMetricTile, StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
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

export function TournamentPerformance({
	dataGameweek,
	stats,
}: {
	dataGameweek: number | null
	stats: TournamentStatsViewModel
}) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	return (
		<StatsSectionCard
			className="mb-5 sm:mb-6"
			icon={Trophy}
			title={t('myPerformance')}
		>
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
					label={
						dataGameweek === null
							? t('latestGameweek')
							: t('gameweek', { gameweek: dataGameweek })
					}
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
						stats.myTeam?.captaincy.name === 'N/A'
							? '—'
							: (stats.myTeam?.captaincy.name ?? '—')
					}
					detail={
						<span>
							{stats.myTeam?.captaincy.team !== 'N/A'
								? `${stats.myTeam?.captaincy.team} · `
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
							? t('pointsValue', { points: stats.topPerformers[0].points })
							: '—'
					}
					detail={
						<span className="truncate">
							{stats.topPerformers[0]?.teamName ?? t('noData')}
						</span>
					}
				/>
			</div>

			{stats.topPerformers.length > 0 ? (
				<div className="mt-5 border-t border-border/60 pt-5 sm:mt-6 sm:pt-6">
					<h3 className="mb-3 flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						<Trophy className="size-3.5 text-primary-ink" aria-hidden="true" />
						{t('topPerformers', { gameweek: dataGameweek ?? '—' })}
					</h3>
					<div className="flex flex-col gap-2">
						{stats.topPerformers.map(performer => (
							<div
								key={performer.entryId}
								className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5 text-sm dark:bg-muted/20"
							>
								<div className="flex min-w-0 items-center gap-2">
									<span className="w-4 shrink-0 text-right font-mono text-xs text-muted-foreground">
										{performer.rank}
									</span>
									<span className="truncate font-medium">
										{performer.teamName}
									</span>
									<span className="hidden truncate text-xs text-muted-foreground sm:inline">
										({performer.managerName})
									</span>
								</div>
								<div className="flex shrink-0 items-center gap-3 text-right">
									{performer.captain.name !== 'N/A' ? (
										<span className="hidden text-xs text-muted-foreground sm:inline">
											{t('captainPoints', {
												name: performer.captain.name,
												points: t('pointsValue', {
													points: performer.captain.points,
												}),
											})}
										</span>
									) : null}
									<span className="font-display font-bold tabular-nums text-foreground">
										{t('pointsValue', { points: performer.points })}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}
		</StatsSectionCard>
	)
}
