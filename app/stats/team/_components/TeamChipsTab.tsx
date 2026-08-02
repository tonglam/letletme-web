import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import { Card } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import type { TeamStatsViewModel } from '../_lib/team-stats-model'
import { useTranslations } from 'next-intl'

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
		<Card className="p-6">
			<h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
				<Clock className="size-5 text-primary" aria-hidden="true" />
				{t('chipUsage')}
			</h2>
			<div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="rounded-lg bg-accent/30 p-4 text-center">
					<p className="mb-1 text-xs text-muted-foreground">{t('currentEventChip')}</p>
					<p className="text-base font-semibold">{chipName(stats.eventChip)}</p>
				</div>
				<div className="rounded-lg bg-accent/30 p-4 text-center">
					<p className="mb-1 text-xs text-muted-foreground">{t('totalChipsUsed')}</p>
					<p className="text-2xl font-bold">{stats.chipUsageRows.length}</p>
				</div>
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
		</Card>
	)
}
