import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import type { TournamentEntryRankingSummary } from '@/lib/graphql/operations/tournaments'
import { useTranslations } from 'next-intl'
import { buildTournamentRankingRows } from '../_lib/tournament-stats-model'

const LABEL_KEYS = {
	'Overall Rank': 'overallRank',
	'Tournament Rank': 'tournamentRank',
	'Team Value': 'teamValue',
	'Tournament Team Value Rank': 'tournamentTeamValueRank',
	Transfers: 'transfers',
	'Tournament Transfers Rank': 'tournamentTransfersRank',
	'Total Costs': 'totalCosts',
	'Tournament Costs Rank': 'tournamentCostsRank',
	'Total Bench Points': 'totalBenchPoints',
	'Tournament Bench Rank': 'tournamentBenchRank',
	'Auto-sub Points': 'autoSubPoints',
	'Tournament Auto-sub Rank': 'tournamentAutoSubRank',
} as const

export function TournamentRanking({
	summary,
}: {
	summary: TournamentEntryRankingSummary | null
}) {
	const t = useTranslations('TournamentStats')
	const translateLabel = (label: string) => {
		const key = LABEL_KEYS[label as keyof typeof LABEL_KEYS]
		return key ? t(key) : label
	}
	const translateValue = (value: string) => {
		const points = /^(.+) pts$/.exec(value)
		return points ? t('pointsValue', { points: points[1] }) : value
	}
	return (
		<StatsSectionCard className="mb-5 sm:mb-6" title={t('myTournamentRanking')}>
			<div className="overflow-hidden rounded-lg border border-border/70">
				{buildTournamentRankingRows(summary).map((row, index) => (
					<div
						key={row.label}
						className={`grid grid-cols-1 gap-3 px-3 py-3.5 sm:grid-cols-2 sm:gap-6 sm:px-4 ${index ? 'border-t border-border/60' : ''} ${index % 2 === 1 ? 'bg-muted/20' : ''}`}
					>
						<div className="flex items-start justify-between gap-4">
							<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
								{translateLabel(row.label)}
							</p>
							<p className="text-right font-display text-sm font-semibold tabular-nums">
								{translateValue(row.value)}
							</p>
						</div>
						<div className="flex items-start justify-between gap-4">
							<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-[11px]">
								{translateLabel(row.rankLabel)}
							</p>
							<p className="text-right font-display text-sm font-semibold tabular-nums">
								{row.rank}
							</p>
						</div>
					</div>
				))}
			</div>
		</StatsSectionCard>
	)
}
