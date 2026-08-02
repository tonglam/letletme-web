import { StatsTable, type StatsTableColumn } from '@/components/data/StatsTable'
import { formatMoney, type TeamStatsViewModel } from '../_lib/team-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

export function TeamHistoryTab({ stats }: { stats: TeamStatsViewModel }) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const compact = (value: unknown) => format.number(Number(value), { notation: 'compact' })
	const gameweekColumns: StatsTableColumn[] = [
		{ key: 'gameweek', label: t('gameweekShort'), className: 'text-center' },
		{ key: 'eventPoints', label: t('pointsShort'), className: 'text-center font-bold' },
		{ key: 'eventNetPoints', label: t('netShort'), className: 'text-center font-bold' },
		{ key: 'eventRank', label: t('gameweekRank'), className: 'text-center', format: (value) => (value == null ? '—' : compact(value)) },
		{ key: 'overallPoints', label: t('total'), className: 'text-center font-bold' },
		{ key: 'overallRank', label: t('overallRank'), className: 'text-center', format: compact },
		{ key: 'eventTransfers', label: t('transfersShort'), className: 'text-center' },
		{ key: 'eventTransfersCost', label: t('cost'), className: 'text-center' },
		{ key: 'teamValue', label: t('value'), className: 'text-right', format: (value) => formatMoney(value == null ? null : Number(value)) },
		{ key: 'bank', label: t('bank'), className: 'text-right', format: (value) => formatMoney(value == null ? null : Number(value)) },
	]
	const seasonColumns: StatsTableColumn[] = [
		{ key: 'seasonOrder', label: '#', className: 'text-center' },
		{ key: 'season', label: t('season'), className: 'text-center' },
		{ key: 'totalPoints', label: t('points'), className: 'text-center font-bold' },
		{ key: 'overallRank', label: t('overallRank'), className: 'text-center', format: compact },
	]

	return (
		<div className="flex flex-col gap-6">
			<StatsTable title={t('gameweekHistory')} data={stats.historyRows} columns={gameweekColumns} rowKeyField="gameweek" />
			<StatsTable title={t('seasonHistory')} data={stats.seasonHistoryRows} columns={seasonColumns} rowKeyField="season" />
		</div>
	)
}
