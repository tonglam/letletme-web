import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import { Card } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { TeamStatsViewModel } from '../_lib/team-stats-model'

const CHIP_COUNT_COLUMNS: StatsTableColumn[] = [
	{ key: 'chip', label: 'Chip' },
	{ key: 'count', label: 'Times Used', className: 'text-right font-bold' },
]

const CHIP_USAGE_COLUMNS: StatsTableColumn[] = [
	{ key: 'gameweek', label: 'GW', className: 'text-center' },
	{ key: 'chip', label: 'Chip', className: 'text-right font-bold' },
]

export function TeamChipsTab({ stats }: { stats: TeamStatsViewModel }) {
	return (
		<Card className="p-6">
			<h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
				<Clock className="size-5 text-primary" aria-hidden="true" />
				Chip Usage
			</h2>
			<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="rounded-lg bg-accent/30 p-4 text-center">
					<p className="mb-1 text-xs text-muted-foreground">Current Event Chip</p>
					<p className="text-base font-semibold">{stats.eventChip}</p>
				</div>
				<div className="rounded-lg bg-accent/30 p-4 text-center">
					<p className="mb-1 text-xs text-muted-foreground">Total Chips Used</p>
					<p className="text-2xl font-bold">{stats.chipUsageRows.length}</p>
				</div>
			</div>

			<div className="mb-6">
				<StatsTable
					title="Usage by Chip"
					data={stats.chipCounts}
					columns={CHIP_COUNT_COLUMNS}
					rowKeyField="chip"
				/>
			</div>
			<StatsTable
				title="Gameweek Usage"
				data={stats.chipUsageRows}
				columns={CHIP_USAGE_COLUMNS}
				rowKeyField="gameweek"
			/>
		</Card>
	)
}
