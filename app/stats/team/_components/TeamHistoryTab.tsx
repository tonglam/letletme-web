import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import { formatCompact, formatMoney, type TeamStatsViewModel } from '../_lib/team-stats-model'

const GAMEWEEK_COLUMNS: StatsTableColumn[] = [
	{ key: 'gameweek', label: 'GW', className: 'text-center' },
	{ key: 'eventPoints', label: 'Pts', className: 'text-center font-bold' },
	{ key: 'eventNetPoints', label: 'Net', className: 'text-center font-bold' },
	{
		key: 'eventRank',
		label: 'GW Rank',
		className: 'text-center',
		format: (value) => (value == null ? '—' : formatCompact(Number(value))),
	},
	{ key: 'overallPoints', label: 'Total', className: 'text-center font-bold' },
	{
		key: 'overallRank',
		label: 'Overall Rank',
		className: 'text-center',
		format: (value) => formatCompact(Number(value)),
	},
	{ key: 'eventTransfers', label: 'Trans', className: 'text-center' },
	{ key: 'eventTransfersCost', label: 'Cost', className: 'text-center' },
	{
		key: 'teamValue',
		label: 'Value',
		className: 'text-right',
		format: (value) => formatMoney(value == null ? null : Number(value)),
	},
	{
		key: 'bank',
		label: 'Bank',
		className: 'text-right',
		format: (value) => formatMoney(value == null ? null : Number(value)),
	},
]

const SEASON_COLUMNS: StatsTableColumn[] = [
	{ key: 'seasonOrder', label: '#', className: 'text-center' },
	{ key: 'season', label: 'Season', className: 'text-center' },
	{ key: 'totalPoints', label: 'Points', className: 'text-center font-bold' },
	{
		key: 'overallRank',
		label: 'Overall Rank',
		className: 'text-center',
		format: (value) => formatCompact(Number(value)),
	},
]

export function TeamHistoryTab({ stats }: { stats: TeamStatsViewModel }) {
	return (
		<div className="flex flex-col gap-6">
			<StatsTable title="Gameweek History" data={stats.historyRows} columns={GAMEWEEK_COLUMNS} rowKeyField="gameweek" />
			<StatsTable title="Season History" data={stats.seasonHistoryRows} columns={SEASON_COLUMNS} rowKeyField="season" />
		</div>
	)
}
