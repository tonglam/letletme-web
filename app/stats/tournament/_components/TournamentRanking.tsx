import { Card } from '@/components/ui/card'
import type { TournamentEntryRankingSummary } from '@/lib/graphql/operations/tournaments'
import { buildTournamentRankingRows } from '../_lib/tournament-stats-model'

export function TournamentRanking({ summary }: { summary: TournamentEntryRankingSummary | null }) {
	return (
		<Card className="mb-6 p-6">
			<h2 className="mb-6 text-xl font-bold">My Tournament Ranking</h2>
			<div className="overflow-hidden rounded-lg border">
				{buildTournamentRankingRows(summary).map((row, index) => (
					<div key={row.label} className={`grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-6 sm:px-6 ${index ? 'border-t' : ''}`}>
						<div className="flex items-start justify-between gap-4">
							<p className="text-sm text-foreground/80">{row.label}</p>
							<p className="text-right font-semibold">{row.value}</p>
						</div>
						<div className="flex items-start justify-between gap-4">
							<p className="text-sm text-muted-foreground">{row.rankLabel}</p>
							<p className="text-right font-semibold">{row.rank}</p>
						</div>
					</div>
				))}
			</div>
		</Card>
	)
}
