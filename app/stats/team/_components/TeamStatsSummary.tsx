import { StatsMetricTile, StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { formatMoney, type TeamStatsViewModel } from '../_lib/team-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

export function TeamStatsSummary({ stats }: { stats: TeamStatsViewModel }) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const eventChip = (() => {
		switch (stats.eventChip) {
			case 'BB':
			case 'BBOOST':
			case 'BENCH_BOOST':
				return t('benchBoost')
			case '3XC':
			case 'TC':
			case 'TRIPLE_CAPTAIN':
				return t('tripleCaptain')
			case 'WC':
			case 'WILDCARD':
				return t('wildcard')
			case 'FH':
			case 'FREE_HIT':
				return t('freeHit')
			case 'NONE':
			case null:
			case undefined:
				return t('chipNone')
			default:
				return stats.eventChip
		}
	})()

	return (
		<div className="mb-6 flex flex-col gap-5">
			<StatsSectionCard title={stats.teamName}>
				<p className="-mt-2 mb-4 text-sm text-muted-foreground">
					{stats.playerName}{' '}
					<span aria-hidden="true">·</span> {stats.region}
				</p>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
					<StatsMetricTile
						label={t('teamValue')}
						value={formatMoney(stats.teamValue)}
					/>
					<StatsMetricTile label={t('bank')} value={formatMoney(stats.bank)} />
					<StatsMetricTile
						label={t('totalTransfers')}
						value={stats.totalTransfers ?? '—'}
					/>
				</div>
				<div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
					<StatsMetricTile
						label={t('overallPoints')}
						value={stats.overallPoints}
					/>
					<StatsMetricTile
						label={t('overallRank')}
						value={format.number(stats.overallRank, { notation: 'compact' })}
					/>
				</div>
			</StatsSectionCard>

			<StatsSectionCard>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
					<StatsMetricTile
						label={t('eventPoints')}
						value={stats.eventPoints}
					/>
					<StatsMetricTile
						label={t('transferCost')}
						value={
							stats.eventTransfersCost > 0
								? `-${stats.eventTransfersCost}`
								: 0
						}
					/>
					<StatsMetricTile
						label={t('netPoints')}
						value={stats.eventNetPoints}
					/>
					<StatsMetricTile
						label={t('eventTransfers')}
						value={stats.eventTransfers}
					/>
				</div>
				<div className="mt-3 grid grid-cols-1 gap-3 md:mt-4 md:grid-cols-3 md:gap-4">
					<StatsMetricTile label={t('eventChip')} value={eventChip} />
					<StatsMetricTile
						label={t('benchPoints')}
						value={stats.eventBenchPoints}
					/>
					<StatsMetricTile
						label={t('playedCaptain')}
						value={`${stats.eventPlayedCaptainName} (${stats.eventCaptainPoints})`}
					/>
				</div>
			</StatsSectionCard>
		</div>
	)
}
