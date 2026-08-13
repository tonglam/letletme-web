import type { TournamentEntryRankingSummary } from '@/lib/graphql/operations/tournaments'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'
import { buildTournamentRankingRows } from '../_lib/tournament-stats-model'

function HeroMetric({
	label,
	value,
	emphasis,
}: {
	label: string
	value: string
	emphasis?: boolean
}) {
	return (
		<div className="rounded-lg border border-border/70 px-3 py-3 sm:px-4 sm:py-3.5">
			<p className="eyebrow">
				{label}
			</p>
			<p
				className={cn(
					'mt-1 font-display text-3xl font-bold tabular-nums tracking-tight sm:text-4xl',
					emphasis ? 'text-primary-ink' : 'text-foreground',
				)}
			>
				{value}
			</p>
		</div>
	)
}

function SecondaryMetric({
	label,
	value,
	rankLabel,
}: {
	label: string
	value: string
	rankLabel: string
}) {
	return (
		<div className="rounded-lg border border-border/60 bg-card px-3 py-2.5 sm:px-3.5 sm:py-3">
			<p className="text-caption font-medium text-muted-foreground">{label}</p>
			<p className="mt-0.5 font-display text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">
				{value}
			</p>
			<p className="mt-0.5 font-mono text-caption tabular-nums text-muted-foreground">
				{rankLabel}
			</p>
		</div>
	)
}

export function TournamentRanking({
	summary,
}: {
	summary: TournamentEntryRankingSummary | null
}) {
	const t = useTranslations('TournamentStats')
	const rows = buildTournamentRankingRows(summary)

	// Hero: tournament rank + FPL overall rank (first model row)
	const hero = rows[0]
	const secondary = rows.slice(1)

	const heroTournamentRank = hero?.rank ?? '—'
	const heroOverallRank = hero?.value ?? '—'

	return (
		<section
			className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6"
			aria-labelledby="tournament-ranking-title"
		>
			<div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<p
					id="tournament-ranking-title"
					className="eyebrow"
				>
					{t('myTournamentRanking')}
				</p>

				<div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
					<HeroMetric
						label={t('tournamentRank')}
						value={heroTournamentRank}
						emphasis
					/>
					<HeroMetric label={t('overallRank')} value={heroOverallRank} />
				</div>

				{secondary.length > 0 ? (
					<div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
						{secondary.map(row => {
							const value = row.valueIsPoints
								? t('pointsValue', { points: row.value })
								: row.value
							return (
								<SecondaryMetric
									key={row.labelKey}
									label={t(row.labelKey as 'teamValue')}
									value={value}
									rankLabel={t('rankInTournament', { rank: row.rank })}
								/>
							)
						})}
					</div>
				) : null}
			</div>
		</section>
	)
}
