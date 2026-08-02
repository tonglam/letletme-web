import { Card } from '@/components/ui/card'
import { formatCompactNumber } from '@/lib/utils'
import { Crown } from 'lucide-react'
import type { CaptainRow } from '../_lib/tournament-stats-model'

export function TournamentCaptainsTab({ rows }: { rows: CaptainRow[] }) {
	return (
		<Card className="p-6">
			<h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
				<Crown className="size-5 text-warning" aria-hidden="true" /> Most Captained Players
			</h2>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">No captain data is available for this event.</p>
			) : (
				<ol className="flex flex-col gap-4">
					{rows.map((stat, index) => (
						<li key={`${stat.player}-${stat.team}`} className="rounded-lg bg-accent/30 p-4">
							<div className="flex items-center justify-between gap-4">
								<div className="flex min-w-0 items-center gap-3">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{index + 1}</span>
									<div className="min-w-0">
										<p className="truncate text-lg font-bold">{stat.player}{stat.team !== 'N/A' ? <span className="ml-2 text-sm font-normal text-muted-foreground">({stat.team})</span> : null}</p>
										<p className="text-sm text-muted-foreground">{formatCompactNumber(stat.count)} managers ({stat.percentage}%)</p>
									</div>
								</div>
								<div className="shrink-0 text-right">
									<p className="text-lg font-bold">{stat.averagePoints}</p>
									<p className="text-xs text-muted-foreground">avg. captain pts</p>
								</div>
							</div>
						</li>
					))}
				</ol>
			)}
		</Card>
	)
}
