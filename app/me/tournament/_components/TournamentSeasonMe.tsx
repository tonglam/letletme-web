'use client'

import { cn, formatCompactNumber } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import type { TournamentSeasonMe } from '../_lib/tournament-stats-model'

function HeroTile({
	label,
	value,
	detail,
	emphasis,
}: {
	label: string
	value: string
	detail?: string
	emphasis?: boolean
}) {
	return (
		<div className="rounded-lg border border-border/70 px-3 py-3 sm:px-4 sm:py-3.5">
			<p className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
			{detail ? (
				<p className="mt-1 text-xs text-muted-foreground">{detail}</p>
			) : null}
		</div>
	)
}

export function TournamentSeasonMeSection({
	me,
}: {
	me: TournamentSeasonMe | null
}) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()

	if (!me) {
		return (
			<section className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6">
				<div className="px-4 py-5 sm:px-5">
					<p className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
						{t('youInTournament')}
					</p>
					<p className="mt-3 text-sm text-muted-foreground">
						{t('youInTournamentEmpty')}
					</p>
				</div>
			</section>
		)
	}

	const rankValue =
		me.tournamentRank == null
			? '—'
			: formatCompactNumber(me.tournamentRank)
	const pointsValue =
		me.totalPoints == null ? '—' : format.number(me.totalPoints)
	const gapLeaderValue =
		me.gapToLeader == null
			? '—'
			: me.gapToLeader === 0
				? t('leading')
				: format.number(me.gapToLeader)
	const gapAboveDetail =
		me.gapToAbove == null
			? undefined
			: me.gapToAbove === 0
				? t('atTop')
				: t('gapToAboveDetail', { points: format.number(me.gapToAbove) })

	return (
		<section
			className="mb-5 overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm sm:mb-6"
			aria-labelledby="tournament-me-title"
		>
			<div className="px-4 pb-4 pt-4 sm:px-5 sm:pb-5 sm:pt-5">
				<p
					id="tournament-me-title"
					className="font-display text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
				>
					{t('youInTournament')}
				</p>
				<p className="mt-1 text-sm text-muted-foreground">
					{t('youInTournamentAsOf', { gameweek: me.asOfGameweek })}
				</p>

				<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
					<HeroTile
						label={t('tournamentRank')}
						value={rankValue}
						emphasis
						detail={
							me.fplOverallRank != null
								? t('fplOverallRankDetail', {
										rank: formatCompactNumber(me.fplOverallRank),
									})
								: undefined
						}
					/>
					<HeroTile label={t('totalPoints')} value={pointsValue} />
					<HeroTile
						label={t('gapToLeader')}
						value={gapLeaderValue}
						detail={gapAboveDetail}
					/>
				</div>

				{me.secondary.length > 0 ? (
					<div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-3 sm:gap-3">
						{me.secondary.map(row => {
							const value = row.valueIsPoints
								? t('pointsValue', { points: row.value })
								: row.value
							return (
								<div
									key={row.labelKey}
									className="rounded-lg border border-border/60 bg-card px-3 py-2.5 sm:px-3.5 sm:py-3"
								>
									<p className="text-[11px] font-medium text-muted-foreground">
										{t(row.labelKey as 'teamValue')}
									</p>
									<p className="mt-0.5 font-display text-lg font-bold tabular-nums tracking-tight text-foreground sm:text-xl">
										{value}
									</p>
									<p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
										{t('rankInTournament', { rank: row.rank })}
										{row.averageDisplay ? (
											<>
												{' · '}
												{t('meMetricAverage', {
													value: row.averageDisplay,
												})}
											</>
										) : null}
									</p>
								</div>
							)
						})}
					</div>
				) : null}
			</div>
		</section>
	)
}
