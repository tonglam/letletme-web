import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import {
	StatsMetricTile,
	StatsSectionCard,
} from '@/components/stats/StatsSurfaces'
import { Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { TeamStatsViewModel } from '../_lib/team-stats-model'

export function TeamChipsTab({ stats }: { stats: TeamStatsViewModel }) {
	const t = useTranslations('TeamStats')
	const chipName = (value: unknown) => {
		const chip = String(value).toUpperCase()
		if (chip === 'NONE') return t('chipNone')
		if (chip === 'BBOOST' || chip === 'BENCH BOOST') return t('benchBoost')
		if (chip === '3XC' || chip === 'TRIPLE CAPTAIN') return t('tripleCaptain')
		if (chip === 'WILDCARD') return t('wildcard')
		if (chip === 'FREEHIT' || chip === 'FREE HIT') return t('freeHit')
		return String(value)
	}
	const chipCountColumns: StatsTableColumn[] = [
		{ key: 'chip', label: t('chip'), format: chipName },
		{ key: 'count', label: t('timesUsed'), className: 'text-right font-bold' },
	]
	const chipUsageColumns: StatsTableColumn[] = [
		{ key: 'gameweek', label: t('gameweekShort'), className: 'text-center' },
		{ key: 'chip', label: t('chip'), className: 'text-right font-bold', format: chipName },
	]

	return (
		<StatsSectionCard icon={Clock} title={t('chipUsage')}>
			<div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
				<StatsMetricTile
					label={t('currentEventChip')}
					value={chipName(stats.eventChip)}
				/>
				<StatsMetricTile
					label={t('totalChipsUsed')}
					value={stats.chipUsageRows.length}
				/>
			</div>

			<div className="mb-6">
				<StatsTable
					title={t('usageByChip')}
					data={stats.chipCounts}
					columns={chipCountColumns}
					rowKeyField="chip"
				/>
			</div>
			<StatsTable
				title={t('gameweekUsage')}
				data={stats.chipUsageRows}
				columns={chipUsageColumns}
				rowKeyField="gameweek"
			/>
		</StatsSectionCard>
	)
}
