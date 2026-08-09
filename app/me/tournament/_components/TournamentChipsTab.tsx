import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { Star } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { ChipCode, ChipRow } from '../_lib/tournament-stats-model'

/** Chip usage this GW — field intel, not a standings view. */
export function TournamentChipsTab({ rows }: { rows: ChipRow[] }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const chipName = (chip: ChipCode) => {
		if (chip === 'BENCH_BOOST') return t('benchBoost')
		if (chip === 'TRIPLE_CAPTAIN') return t('tripleCaptain')
		if (chip === 'FREE_HIT') return t('freeHit')
		if (chip === 'WILDCARD') return t('wildcard')
		return t('noChip')
	}
	return (
		<StatsSectionCard
			className="h-full"
			icon={Star}
			title={t('chipUsage')}
			description={t('chipUsageHint')}
		>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('noChipData')}</p>
			) : (
				<ul className="flex flex-col border-t border-border/60">
					{rows.map(chip => (
						<li
							key={chip.chip}
							className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0"
						>
							<div className="min-w-0">
								<p className="font-display text-sm font-bold">
									{chipName(chip.chip)}
								</p>
								<p className="text-xs text-muted-foreground">
									{t('managerCount', {
										count: format.number(chip.count, {
											notation: 'compact',
										}),
										percentage: chip.percentage,
									})}
								</p>
							</div>
							<div className="shrink-0 text-right">
								<p className="font-display text-base font-bold tabular-nums">
									{chip.averagePoints}
								</p>
								<p className="text-[10px] text-muted-foreground">
									{t('averageNetPoints')}
								</p>
							</div>
						</li>
					))}
				</ul>
			)}
		</StatsSectionCard>
	)
}
