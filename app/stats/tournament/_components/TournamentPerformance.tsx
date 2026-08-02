import { Card } from '@/components/ui/card'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import type { TournamentStatsViewModel } from '../_lib/tournament-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

function Metric({ label, value, detail }: { label: string; value: string; detail: React.ReactNode }) {
	return (
		<div className="w-full rounded-lg bg-primary/10 p-5 text-center">
			<p className="mb-1 text-sm text-muted-foreground">{label}</p>
			<p className="text-2xl font-bold">{value}</p>
			<div className="mt-2 flex min-h-5 items-center justify-center text-sm">{detail}</div>
		</div>
	)
}

function RankMovement({ stats }: { stats: TournamentStatsViewModel }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	if (stats.myRank === null || stats.myPreviousRank === null) {
		return <span className="text-muted-foreground">{t('notInTournament')}</span>
	}
	if (stats.myPreviousRank > stats.myRank) {
		return (
			<span className="inline-flex items-center gap-1 text-success">
				<ArrowUp aria-hidden="true" /> {t('up', { count: format.number(stats.myPreviousRank - stats.myRank, { notation: 'compact' }) })}
			</span>
		)
	}
	if (stats.myPreviousRank < stats.myRank) {
		return (
			<span className="inline-flex items-center gap-1 text-destructive">
				<ArrowDown aria-hidden="true" /> {t('down', { count: format.number(stats.myRank - stats.myPreviousRank, { notation: 'compact' }) })}
			</span>
		)
	}
	return <span className="text-muted-foreground">{t('noChange')}</span>
}

export function TournamentPerformance({ dataGameweek, stats }: { dataGameweek: number | null; stats: TournamentStatsViewModel }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	return (
		<Card className="mb-6 p-6">
			<h2 className="mb-6 text-xl font-bold">{t('myPerformance')}</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Metric
					label={t('myRank')}
					value={stats.myRank === null ? '—' : format.number(stats.myRank, { notation: 'compact' })}
					detail={<RankMovement stats={stats} />}
				/>
				<Metric
					label={dataGameweek === null ? t('latestGameweek') : t('gameweek', { gameweek: dataGameweek })}
					value={stats.myTeam?.points == null ? '—' : t('pointsValue', { points: stats.myTeam.points })}
					detail={<span className="text-muted-foreground">{t('eventCost', { points: stats.myTeam?.eventCost == null ? '—' : t('pointsValue', { points: stats.myTeam.eventCost }) })}</span>}
				/>
				<Metric
					label={t('captain')}
					value={stats.myTeam?.captaincy.name === 'N/A' ? '—' : (stats.myTeam?.captaincy.name ?? '—')}
					detail={<span>{stats.myTeam?.captaincy.team !== 'N/A' ? `${stats.myTeam?.captaincy.team} · ` : ''}{t('pointsValue', { points: stats.myTeam?.captaincy.points ?? 0 })}</span>}
				/>
				<Metric
					label={t('topScore')}
					value={stats.topPerformers[0] ? t('pointsValue', { points: stats.topPerformers[0].points }) : '—'}
					detail={<span className="truncate">{stats.topPerformers[0]?.teamName ?? t('noData')}</span>}
				/>
			</div>

			{stats.topPerformers.length > 0 ? (
				<div className="mt-6 border-t pt-6">
					<h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
						<Trophy className="size-4 text-warning" aria-hidden="true" />
						{t('topPerformers', { gameweek: dataGameweek ?? '—' })}
					</h3>
					<div className="flex flex-col gap-2">
						{stats.topPerformers.map((performer) => (
							<div key={performer.entryId} className="flex items-center justify-between gap-2 text-sm">
								<div className="flex min-w-0 items-center gap-2">
									<span className="w-4 shrink-0 text-right text-xs text-muted-foreground">{performer.rank}</span>
									<span className="truncate font-medium">{performer.teamName}</span>
									<span className="hidden truncate text-xs text-muted-foreground sm:inline">({performer.managerName})</span>
								</div>
								<div className="flex shrink-0 items-center gap-3 text-right">
									{performer.captain.name !== 'N/A' ? <span className="hidden text-xs text-muted-foreground sm:inline">{t('captainPoints', { name: performer.captain.name, points: t('pointsValue', { points: performer.captain.points }) })}</span> : null}
									<span className="font-bold text-primary">{t('pointsValue', { points: performer.points })}</span>
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}
		</Card>
	)
}
