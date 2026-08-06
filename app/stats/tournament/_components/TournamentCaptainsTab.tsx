import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { Crown } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import type { CaptainRow } from '../_lib/tournament-stats-model'

export function TournamentCaptainsTab({ rows }: { rows: CaptainRow[] }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	return (
		<StatsSectionCard icon={Crown} title={t('mostCaptained')}>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('noCaptainData')}</p>
			) : (
				<ol className="flex flex-col gap-3">
					{rows.map((stat, index) => (
						<li key={`${stat.player}-${stat.team}`}>
							<div className="rounded-lg border border-border/70 bg-muted/40 p-3 sm:p-4 dark:bg-muted/25">
								<div className="flex items-center justify-between gap-4">
									<div className="flex min-w-0 items-center gap-3">
										<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background font-display text-sm font-bold tabular-nums text-foreground ring-1 ring-border/60">
											{index + 1}
										</span>
										<div className="min-w-0">
											<p className="truncate font-display text-base font-bold">
												{stat.player}
												{stat.team !== 'N/A' ? (
													<span className="ml-2 text-sm font-normal text-muted-foreground">
														({stat.team})
													</span>
												) : null}
											</p>
											<p className="text-sm text-muted-foreground">
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
										<p className="font-display text-lg font-bold tabular-nums">
											{stat.averagePoints}
										</p>
										<p className="text-xs text-muted-foreground">
											{t('averageCaptainPoints')}
										</p>
									</div>
								</div>
							</div>
						</li>
					))}
				</ol>
			)}
		</StatsSectionCard>
	)
}
