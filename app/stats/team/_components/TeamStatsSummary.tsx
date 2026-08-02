import { Card } from '@/components/ui/card'
import { formatCompact, formatMoney, type TeamStatsViewModel } from '../_lib/team-stats-model'

function Metric({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg bg-accent/30 p-4 text-center">
			<p className="mb-1 text-xs text-muted-foreground">{label}</p>
			<p className="text-2xl font-bold">{value}</p>
		</div>
	)
}

export function TeamStatsSummary({ stats }: { stats: TeamStatsViewModel }) {
	return (
		<>
			<Card className="mb-6 p-6">
				<header className="mb-6">
					<h2 className="text-xl font-bold">{stats.teamName}</h2>
					<p className="mt-1 text-muted-foreground">
						{stats.playerName} <span aria-hidden="true">•</span> {stats.region}
					</p>
				</header>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<Metric label="Team Value" value={formatMoney(stats.teamValue)} />
					<Metric label="Bank" value={formatMoney(stats.bank)} />
					<Metric label="Total Transfers" value={stats.totalTransfers ?? '—'} />
				</div>
				<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Metric label="Overall Points" value={stats.overallPoints} />
					<Metric label="Overall Rank" value={formatCompact(stats.overallRank)} />
				</div>
			</Card>

			<Card className="mb-6 p-6">
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<Metric label="Event Points" value={stats.eventPoints} />
					<Metric label="Transfer Cost" value={stats.eventTransfersCost > 0 ? `-${stats.eventTransfersCost}` : 0} />
					<Metric label="Net Points" value={stats.eventNetPoints} />
					<Metric label="Event Transfers" value={stats.eventTransfers} />
				</div>
				<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
					<Metric label="Event Chip" value={stats.eventChip} />
					<Metric label="Bench Points" value={stats.eventBenchPoints} />
					<Metric label="Played Captain" value={`${stats.eventPlayedCaptainName} (${stats.eventCaptainPoints})`} />
				</div>
			</Card>
		</>
	)
}
