import { Card } from '@/components/ui/card'
import { Crown } from 'lucide-react'
import type { CaptainRow } from '../_lib/tournament-stats-model'
import { useFormatter, useTranslations } from 'next-intl'

export function TournamentCaptainsTab({ rows }: { rows: CaptainRow[] }) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	return (
		<Card className="p-6">
			<h2 className="mb-6 flex items-center gap-2 text-xl font-bold">
				<Crown className="size-5 text-warning" aria-hidden="true" /> {t('mostCaptained')}
			</h2>
			{rows.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('noCaptainData')}</p>
			) : (
				<ol className="flex flex-col gap-4">
					{rows.map((stat, index) => (
						<li key={`${stat.player}-${stat.team}`} className="rounded-lg bg-accent/30 p-4">
							<div className="flex items-center justify-between gap-4">
								<div className="flex min-w-0 items-center gap-3">
									<span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">{index + 1}</span>
									<div className="min-w-0">
										<p className="truncate text-lg font-bold">{stat.player}{stat.team !== 'N/A' ? <span className="ml-2 text-sm font-normal text-muted-foreground">({stat.team})</span> : null}</p>
										<p className="text-sm text-muted-foreground">{t('managerCount', { count: format.number(stat.count, { notation: 'compact' }), percentage: stat.percentage })}</p>
									</div>
								</div>
								<div className="shrink-0 text-right">
									<p className="text-lg font-bold">{stat.averagePoints}</p>
									<p className="text-xs text-muted-foreground">{t('averageCaptainPoints')}</p>
								</div>
							</div>
						</li>
					))}
				</ol>
			)}
		</Card>
	)
}
