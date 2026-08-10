'use client'

import { LineChart } from '@/components/charts/ChartPrimitives'
import { Button } from '@/components/ui/button'
import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { cn } from '@/lib/utils'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { TournamentPathPoint } from '../_lib/tournament-stats-data'

type ChartMode = 'tournamentRank' | 'gapToLeader' | 'pointsVsAverage'
const FORM_LEN = 8

function formatAxis(value: number, compact: (value: number) => string): string {
	if (!Number.isFinite(value)) return '—'
	return Math.abs(value) >= 1000 ? compact(value) : String(Math.round(value))
}

/** League form over time. Shared line adapter handles single and dual series. */
export function TournamentSeasonCharts({
	points,
	loading,
	onOpenGameweek,
}: {
	points: TournamentPathPoint[]
	loading?: boolean
	onOpenGameweek?: (gameweek: number) => void
}) {
	const t = useTranslations('TournamentStats')
	const format = useFormatter()
	const [mode, setMode] = useState<ChartMode>('tournamentRank')
	const [hover, setHover] = useState<TournamentPathPoint | null>(null)
	const compact = (value: number) => format.number(value, { notation: 'compact', maximumFractionDigits: 1 })
	const form = useMemo(() => points.slice(-FORM_LEN), [points])

	const chartData = useMemo(() => points.map(point => ({
		x: point.gameweek,
		you: mode === 'tournamentRank' ? point.tournamentRank : point.overallPoints,
		benchmark: mode === 'gapToLeader' ? point.leaderOverallPoints : point.averageOverallPoints,
	})), [mode, points])

	const modes: Array<{ id: ChartMode; label: string }> = [
		{ id: 'tournamentRank', label: t('chartTournamentRank') },
		{ id: 'gapToLeader', label: t('chartGapToLeader') },
		{ id: 'pointsVsAverage', label: t('chartPointsVsAverage') },
	]

	const formatHover = (point: TournamentPathPoint) => {
		if (mode === 'tournamentRank') return point.tournamentRank == null ? '—' : t('formRankChip', { rank: point.tournamentRank })
		if (mode === 'gapToLeader') {
			const you = point.overallPoints == null ? '—' : format.number(point.overallPoints)
			const leader = point.leaderOverallPoints == null ? '—' : format.number(point.leaderOverallPoints)
			const gap = point.gapToLeader == null ? '—' : point.gapToLeader === 0 ? t('leading') : t('pointsBehindCount', { points: format.number(point.gapToLeader) })
			return t('chartHoverDual', { you, other: leader, otherLabel: t('chartSeriesLeader'), delta: gap })
		}
		const you = point.overallPoints == null ? '—' : format.number(point.overallPoints)
		const average = point.averageOverallPoints == null ? '—' : format.number(Math.round(point.averageOverallPoints))
		const difference = point.pointsVsAverage == null ? '—' : point.pointsVsAverage === 0 ? t('atAverage') : point.pointsVsAverage > 0 ? t('aboveAverageBy', { points: format.number(Math.round(point.pointsVsAverage)) }) : t('belowAverageBy', { points: format.number(Math.abs(Math.round(point.pointsVsAverage))) })
		return t('chartHoverDual', { you, other: average, otherLabel: t('chartSeriesAverage'), delta: difference })
	}

	const latest = points.at(-1) ?? null
	const updateHover = (point: { x?: string | number | null } | null) => {
		const gameweek = Number(point?.x)
		setHover(Number.isFinite(gameweek) ? points.find(item => item.gameweek === gameweek) ?? null : null)
	}

	return (
		<StatsSectionCard
			className="mb-5 sm:mb-6"
			title={t('seasonPath')}
			description={latest?.tournamentRank != null ? t('seasonPathHint', { rank: latest.tournamentRank }) : undefined}
		>
			{loading && points.length === 0 ? (
				<p className="text-sm text-muted-foreground" aria-busy="true">{t('seasonPathLoading')}</p>
			) : points.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t('seasonPathEmpty')}</p>
			) : (
				<div className="space-y-4">
					<div>
						<p className="mb-2 text-[11px] font-medium text-muted-foreground">{t('formRecent', { count: form.length })}</p>
						<ol className="flex flex-wrap gap-1.5">
							{form.map(point => {
								const rank = point.tournamentRank
								const good = rank != null && rank <= 3
								const bad = rank != null && rank >= 8
								return (
									<li key={point.gameweek}>
										<button
											type="button"
											className={cn(
												'inline-flex min-w-10 flex-col items-center rounded-md border px-2 py-1.5 font-mono text-xs tabular-nums transition-colors',
												'hover:border-primary-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
												good && 'border-success/40 bg-success/10 text-foreground',
												bad && 'border-destructive/30 bg-destructive/5 text-foreground',
												!good && !bad && 'border-border/70 bg-muted/30 text-foreground',
											)}
											onClick={() => onOpenGameweek?.(point.gameweek)}
											aria-label={t('formChipAria', { gameweek: point.gameweek, rank: rank ?? '—' })}
										>
											<span className="text-[10px] text-muted-foreground">{point.gameweek}</span>
											<span className="font-display text-sm font-bold">{rank == null ? '—' : rank}</span>
										</button>
									</li>
								)
							})}
						</ol>
					</div>

					<div className="space-y-2 border-t border-border/60 pt-3">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<p className="text-[11px] font-medium text-muted-foreground">{t('seasonPathDetail')}</p>
							<div className="flex flex-wrap gap-1">
								{modes.map(item => <Button key={item.id} type="button" size="sm" variant={mode === item.id ? 'default' : 'ghost'} className="h-7 px-2 text-[11px]" aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setHover(null) }}>{item.label}</Button>)}
							</div>
						</div>

						{mode !== 'tournamentRank' ? (
							<ul className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
								<li className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded-full bg-primary-ink" aria-hidden="true" />{t('chartSeriesYou')}</li>
								<li className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded-full bg-muted-foreground opacity-70" aria-hidden="true" />{mode === 'gapToLeader' ? t('chartSeriesLeader') : t('chartSeriesAverage')}</li>
							</ul>
						) : null}

						{points.length < 2 ? (
							<p className="text-sm text-muted-foreground">{t('seasonPathNeedMore')}</p>
						) : (
							<LineChart
								data={chartData}
								series={mode === 'tournamentRank'
									? [{ key: 'you', label: t('chartSeriesYou'), color: 'hsl(var(--primary-ink))' }]
									: [{ key: 'you', label: t('chartSeriesYou'), color: 'hsl(var(--primary-ink))' }, { key: 'benchmark', label: mode === 'gapToLeader' ? t('chartSeriesLeader') : t('chartSeriesAverage'), color: 'hsl(var(--muted-foreground))', dashed: true, strokeWidth: 1.75 }]}
								invertY={mode === 'tournamentRank'}
								xFormatter={value => `GW${value}`}
								yFormatter={value => formatAxis(Number(value), compact)}
								ariaLabel={t('seasonPath')}
								onActivePointChange={updateHover}
								onPointClick={point => {
									const gameweek = Number(point.x)
									if (Number.isFinite(gameweek)) onOpenGameweek?.(gameweek)
								}}
							/>
						)}

						{hover ? (
							<p className="text-xs text-muted-foreground" aria-live="polite"><span className="font-display font-semibold text-foreground">GW{hover.gameweek}</span>{' · '}{formatHover(hover)}</p>
						) : (
							<p className="text-[11px] text-muted-foreground">{mode === 'tournamentRank' ? t('chartTournamentRankHint') : mode === 'gapToLeader' ? t('chartGapToLeaderHint') : t('chartPointsVsAverageHint')}</p>
						)}
					</div>
					{loading ? <p className="text-[11px] text-muted-foreground">{t('seasonPathLoading')}</p> : null}
				</div>
			)}
		</StatsSectionCard>
	)
}
