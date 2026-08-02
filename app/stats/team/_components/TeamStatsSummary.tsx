import { Card } from '@/components/ui/card'
import { formatMoney, type TeamStatsViewModel } from '../_lib/team-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

function Metric({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg bg-accent/30 p-4 text-center">
			<p className="mb-1 text-xs text-muted-foreground">{label}</p>
			<p className="text-2xl font-bold">{value}</p>
		</div>
	)
}

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
		<>
			<Card className="mb-6 p-6">
				<header className="mb-6">
					<h2 className="text-xl font-bold">{stats.teamName}</h2>
					<p className="mt-1 text-muted-foreground">
						{stats.playerName} <span aria-hidden="true">•</span> {stats.region}
					</p>
				</header>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					<Metric label={t('teamValue')} value={formatMoney(stats.teamValue)} />
					<Metric label={t('bank')} value={formatMoney(stats.bank)} />
					<Metric label={t('totalTransfers')} value={stats.totalTransfers ?? '—'} />
				</div>
				<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
					<Metric label={t('overallPoints')} value={stats.overallPoints} />
					<Metric label={t('overallRank')} value={format.number(stats.overallRank, { notation: 'compact' })} />
				</div>
			</Card>

			<Card className="mb-6 p-6">
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<Metric label={t('eventPoints')} value={stats.eventPoints} />
					<Metric label={t('transferCost')} value={stats.eventTransfersCost > 0 ? `-${stats.eventTransfersCost}` : 0} />
					<Metric label={t('netPoints')} value={stats.eventNetPoints} />
					<Metric label={t('eventTransfers')} value={stats.eventTransfers} />
				</div>
				<div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
					<Metric label={t('eventChip')} value={eventChip} />
					<Metric label={t('benchPoints')} value={stats.eventBenchPoints} />
					<Metric label={t('playedCaptain')} value={`${stats.eventPlayedCaptainName} (${stats.eventCaptainPoints})`} />
				</div>
			</Card>
		</>
	)
}
