import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { Crown } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { CaptainRow } from '../_lib/tournament-stats-model'

/** Most captained players this GW — field intel, not a standings view. */
export function TournamentCaptainsTab({ rows }: { rows: CaptainRow[] }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	return (
		<StatsSectionCard
			className="h-full"
			icon={Crown}
			title={t('mostCaptained')}
			description={t('mostCaptainedHint')}
		>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('noCaptainData')}</p>
			) : (
				<ol className="flex flex-col border-t border-border/60">
					{rows.map((stat, index) => (
						<li
							key={`${stat.player}-${stat.team}`}
							className="flex items-center justify-between gap-3 border-b border-border/50 py-2.5 last:border-b-0"
						>
							<div className="flex min-w-0 items-center gap-2.5">
								<span className="w-5 shrink-0 text-center font-mono text-xs tabular-nums text-muted-foreground">
									{index + 1}
								</span>
								<div className="min-w-0">
									<p className="truncate font-display text-sm font-bold">
										{stat.player}
										{stat.team && stat.team !== '—' ? (
											<span className="ml-1.5 text-xs font-normal text-muted-foreground">
												{stat.team}
											</span>
										) : null}
									</p>
									<p className="text-xs text-muted-foreground">
										{t('managerCount', {
											count: format.number(stat.count, {
												notation: 'compact',
											}),
											percentage: stat.percentage,
										})}
									</p>
								</div>
							</div>
							<div className="shrink-0 text-right">
								<p className="font-display text-base font-bold tabular-nums">
									{stat.averagePoints}
								</p>
								<p className="text-label text-muted-foreground">
									{t('averageCaptainPoints')}
								</p>
							</div>
						</li>
					))}
				</ol>
			)}
		</StatsSectionCard>
	)
}
