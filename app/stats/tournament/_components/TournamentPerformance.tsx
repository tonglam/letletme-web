import { Card } from '@/components/ui/card'
import { formatCompactNumber } from '@/lib/utils'
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react'
import type { TournamentStatsViewModel } from '../_lib/tournament-stats-model'

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
	if (stats.myRank === null || stats.myPreviousRank === null) {
		return <span className="text-muted-foreground">This team is not in the tournament</span>
	}
	if (stats.myPreviousRank > stats.myRank) {
		return (
			<span className="inline-flex items-center gap-1 text-success">
				<ArrowUp aria-hidden="true" /> Up {formatCompactNumber(stats.myPreviousRank - stats.myRank)}
			</span>
		)
	}
	if (stats.myPreviousRank < stats.myRank) {
		return (
			<span className="inline-flex items-center gap-1 text-destructive">
				<ArrowDown aria-hidden="true" /> Down {formatCompactNumber(stats.myRank - stats.myPreviousRank)}
			</span>
		)
	}
	return <span className="text-muted-foreground">No change</span>
}

export function TournamentPerformance({ dataGameweek, stats }: { dataGameweek: number | null; stats: TournamentStatsViewModel }) {
	return (
		<Card className="mb-6 p-6">
			<h2 className="mb-6 text-xl font-bold">My Performance</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<Metric
					label="My Rank"
					value={stats.myRank === null ? '—' : formatCompactNumber(stats.myRank)}
					detail={<RankMovement stats={stats} />}
				/>
				<Metric
					label={dataGameweek === null ? 'Latest Gameweek' : `Gameweek ${dataGameweek}`}
					value={stats.myTeam?.points == null ? '—' : `${stats.myTeam.points} pts`}
					detail={<span className="text-muted-foreground">Event cost: {stats.myTeam?.eventCost == null ? '—' : `${stats.myTeam.eventCost} pts`}</span>}
				/>
				<Metric
					label="Captain"
					value={stats.myTeam?.captaincy.name ?? 'N/A'}
					detail={<span>{stats.myTeam?.captaincy.team !== 'N/A' ? `${stats.myTeam?.captaincy.team} · ` : ''}{stats.myTeam?.captaincy.points ?? 0} pts</span>}
				/>
				<Metric
					label="Top Score"
					value={stats.topPerformers[0] ? `${stats.topPerformers[0].points} pts` : '—'}
					detail={<span className="truncate">{stats.topPerformers[0]?.teamName ?? 'No data'}</span>}
				/>
			</div>

			{stats.topPerformers.length > 0 ? (
				<div className="mt-6 border-t pt-6">
					<h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
						<Trophy className="size-4 text-warning" aria-hidden="true" />
						GW{dataGameweek} Top Performers
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
									{performer.captain.name !== 'N/A' ? <span className="hidden text-xs text-muted-foreground sm:inline">{performer.captain.name} (C) {performer.captain.points} pts</span> : null}
									<span className="font-bold text-primary">{performer.points} pts</span>
								</div>
							</div>
						))}
					</div>
				</div>
			) : null}
		</Card>
	)
}
