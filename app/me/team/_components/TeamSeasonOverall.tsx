import { formatMoney, type TeamSeasonOverallSnapshot } from '../_lib/team-stats-model'
import { cn } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'

/**
 * Season identity + metrics.
 * - compact: slim strip while browsing GW tabs (not shown on Season — avoids double card)
 * - full: full card on Season view only
 */
export function TeamSeasonOverall({
	snapshot,
	variant = 'full',
}: {
	snapshot: TeamSeasonOverallSnapshot
	variant?: 'compact' | 'full'
}) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()

	if (variant === 'compact') {
		return (
			<div
				className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm sm:px-5"
				aria-label={t('bandSeasonSnapshot')}
			>
				<div className="min-w-0">
					<p className="truncate font-display text-lg font-bold tracking-tight sm:text-xl">
						{snapshot.teamName}
					</p>
					<p className="mt-0.5 truncate text-sm text-muted-foreground">
						{snapshot.playerName}
						{snapshot.region ? (
							<>
								{' '}
								<span aria-hidden="true">·</span> {snapshot.region}
							</>
						) : null}
					</p>
				</div>
				<div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-xs tabular-nums">
					<span>
						<span className="text-muted-foreground">{t('overallPoints')} </span>
						<span className="font-display text-base font-bold text-foreground">
							{format.number(snapshot.overallPoints)}
						</span>
					</span>
					<span>
						<span className="text-muted-foreground">{t('overallRank')} </span>
						<span className="font-display text-base font-bold text-primary-ink">
							{format.number(snapshot.overallRank, { notation: 'compact' })}
						</span>
					</span>
				</div>
			</div>
		)
	}

	const secondary = [
		{
			label: t('teamValue'),
			value: formatMoney(snapshot.teamValue),
		},
		{
			label: t('bank'),
			value: formatMoney(snapshot.bank),
		},
		{
			label: t('totalTransfers'),
			value:
				snapshot.totalTransfers != null
					? format.number(snapshot.totalTransfers)
					: '—',
		},
	] as const

	return (
		<section
			className={cn(
				'overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm',
			)}
			aria-labelledby="team-season-overall-title"
		>
			<div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
					{t('season')}
				</p>
				<h2
					id="team-season-overall-title"
					className="mt-1 truncate font-display text-2xl font-bold tracking-tight text-foreground sm:text-2xl sm:text-3xl"
				>
					{snapshot.teamName}
				</h2>
				<p className="mt-1 truncate text-sm text-muted-foreground">
					{snapshot.playerName}
					{snapshot.region ? (
						<>
							{' '}
							<span aria-hidden="true">·</span> {snapshot.region}
						</>
					) : null}
				</p>

				<div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
					<div className="rounded-lg bg-muted/40 px-3 py-3 dark:bg-muted/25 sm:px-4 sm:py-3.5">
						<p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
							{t('overallPoints')}
						</p>
						<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
							{format.number(snapshot.overallPoints)}
						</p>
					</div>
					<div className="rounded-lg bg-muted/40 px-3 py-3 dark:bg-muted/25 sm:px-4 sm:py-3.5">
						<p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
							{t('overallRank')}
						</p>
						<p className="mt-1 font-display text-3xl font-bold tabular-nums tracking-tight text-primary-ink sm:text-4xl">
							{format.number(snapshot.overallRank, { notation: 'compact' })}
						</p>
					</div>
				</div>
			</div>

			<div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-border/60 bg-muted/20 px-4 py-3 font-mono text-xs tabular-nums text-muted-foreground sm:px-5">
				{secondary.map(item => (
					<span key={item.label}>
						<span className="text-muted-foreground/70">{item.label} </span>
						<span className="font-semibold text-foreground">{item.value}</span>
					</span>
				))}
			</div>
		</section>
	)
}
