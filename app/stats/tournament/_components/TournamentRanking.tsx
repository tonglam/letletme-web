import { Card } from '@/components/ui/card'
import type { TournamentEntryRankingSummary } from '@/lib/graphql/operations/tournaments'
import { buildTournamentRankingRows } from '../_lib/tournament-stats-model'
import { useTranslations } from 'next-intl'

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

export function TournamentRanking({ summary }: { summary: TournamentEntryRankingSummary | null }) {
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
		<Card className="mb-6 p-6">
			<h2 className="mb-6 text-xl font-bold">{t('myTournamentRanking')}</h2>
			<div className="overflow-hidden rounded-lg border">
				{buildTournamentRankingRows(summary).map((row, index) => (
					<div key={row.label} className={`grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-6 sm:px-6 ${index ? 'border-t' : ''}`}>
						<div className="flex items-start justify-between gap-4">
							<p className="text-sm text-foreground/80">{translateLabel(row.label)}</p>
							<p className="text-right font-semibold">{translateValue(row.value)}</p>
						</div>
						<div className="flex items-start justify-between gap-4">
							<p className="text-sm text-muted-foreground">{translateLabel(row.rankLabel)}</p>
							<p className="text-right font-semibold">{row.rank}</p>
						</div>
					</div>
				))}
			</div>
		</Card>
	)
}
