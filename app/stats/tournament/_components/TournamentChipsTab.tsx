import { Card } from '@/components/ui/card'
import { Star } from 'lucide-react'
import type { ChipRow } from '../_lib/tournament-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

export function TournamentChipsTab({ rows }: { rows: ChipRow[] }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const chipName = (chip: string) => {
		if (chip === 'Bench Boost') return t('benchBoost')
		if (chip === 'Triple Captain') return t('tripleCaptain')
		if (chip === 'Free Hit') return t('freeHit')
		if (chip === 'Wildcard') return t('wildcard')
		if (chip === 'No Chip') return t('noChip')
		return chip
	}
	return (
		<Card className="p-6">
			<h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
				<Star className="size-5 text-warning" aria-hidden="true" /> {t('chipUsage')}
			</h2>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('noChipData')}</p>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{rows.map((chip) => (
						<div key={chip.chip} className="rounded-lg bg-accent/30 p-4">
							<div className="flex items-center justify-between gap-4">
								<div>
									<h3 className="text-lg font-bold">{chipName(chip.chip)}</h3>
									<p className="text-sm text-muted-foreground">{t('managerCount', { count: format.number(chip.count, { notation: 'compact' }), percentage: chip.percentage })}</p>
								</div>
								<div className="text-right">
									<p className="text-lg font-bold">{chip.averagePoints}</p>
									<p className="text-xs text-muted-foreground">{t('averageNetPoints')}</p>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</Card>
	)
}
