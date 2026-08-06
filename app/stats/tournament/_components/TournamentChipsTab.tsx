import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { Star } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { ChipRow } from '../_lib/tournament-stats-model'

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
		<StatsSectionCard icon={Star} title={t('chipUsage')}>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('noChipData')}</p>
			) : (
				<div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
					{rows.map(chip => (
						<div
							key={chip.chip}
							className="rounded-lg border border-border/70 bg-muted/40 p-3 sm:p-4 dark:bg-muted/25"
						>
							<div className="flex items-center justify-between gap-4">
								<div>
									<h3 className="font-display text-base font-bold">
										{chipName(chip.chip)}
									</h3>
									<p className="text-sm text-muted-foreground">
										{t('managerCount', {
											count: format.number(chip.count, {
												notation: 'compact',
											}),
											percentage: chip.percentage,
										})}
									</p>
								</div>
								<div className="text-right">
									<p className="font-display text-lg font-bold tabular-nums">
										{chip.averagePoints}
									</p>
									<p className="text-xs text-muted-foreground">
										{t('averageNetPoints')}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</StatsSectionCard>
	)
}
