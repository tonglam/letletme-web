'use client'

import { useFormatter, useTranslations } from 'next-intl'

interface TournamentHeaderProps {
	name: string
	averagePoints: number
	highestPoints: number
	totalEntries: number
	/** When true, avg/highest show em dash instead of misleading zeros. */
	isLoading?: boolean
}

export function TournamentHeader({
	name,
	averagePoints,
	highestPoints,
	totalEntries,
	isLoading = false,
}: TournamentHeaderProps) {
	const t = useTranslations('LiveTournament')
	const format = useFormatter()

	const stats = [
		{
			label: t('highestScore'),
			value: isLoading ? '—' : t('pointsValue', { points: highestPoints }),
		},
		{
			label: t('averageScore'),
			value: isLoading ? '—' : t('pointsValue', { points: averagePoints }),
		},
		{
			label: t('totalEntries'),
			value: isLoading
				? '—'
				: format.number(totalEntries, { notation: 'compact' }),
		},
	]

	return (
		<header className="mb-6">
			<p className="chyron">{t('liveStandings')}</p>
			<h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
				{name}
			</h2>

			{/* Inline stat strip — no tile grid clutter */}
			<dl className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-border/60 pt-3">
				{stats.map(stat => (
					<div key={stat.label} className="flex items-baseline gap-2">
						<dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
							{stat.label}
						</dt>
						<dd className="font-mono text-sm font-semibold tabular-nums text-foreground">
							{stat.value}
						</dd>
					</div>
				))}
			</dl>
		</header>
	)
}
