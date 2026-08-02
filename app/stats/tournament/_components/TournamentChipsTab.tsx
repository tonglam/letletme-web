import { Card } from '@/components/ui/card'
import { formatCompactNumber } from '@/lib/utils'
import { Star } from 'lucide-react'
import type { ChipRow } from '../_lib/tournament-stats-model'

export function TournamentChipsTab({ rows }: { rows: ChipRow[] }) {
	return (
		<Card className="p-6">
			<h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
				<Star className="size-5 text-warning" aria-hidden="true" /> Chip Usage
			</h2>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">No chip usage was recorded for this event.</p>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{rows.map((chip) => (
						<div key={chip.chip} className="rounded-lg bg-accent/30 p-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<h3 className="text-lg font-bold">{chip.chip}</h3>
									<p className="text-sm text-muted-foreground">{formatCompactNumber(chip.count)} managers ({chip.percentage}%)</p>
								</div>
								<div className="text-right">
									<p className="text-lg font-bold">{chip.averagePoints}</p>
									<p className="text-xs text-muted-foreground">avg. net points</p>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</Card>
	)
}
