'use client'

import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { BENCH_HIGH_THRESHOLD } from './TeamSeasonCharts'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import { TeamGameweekLink } from './TeamGameweekLink'
import { TeamMetricGrid, TeamMetricTile } from './TeamMetricTile'

function isBenchBoost(chip: string | undefined): boolean {
	const c = String(chip ?? '')
		.toUpperCase()
		.replace(/[\s-]+/g, '_')
	return (
		c === 'BENCH_BOOST' ||
		c === 'BB' ||
		c === 'BBOOST' ||
		c === 'BENCHBOOST'
	)
}

/**
 * Bench section = exception list only (10+).
 * Full GW × bench trend lives in Season charts.
 */
export function TeamBenchTab({ logs }: { logs: TeamSeasonLogs }) {
	const t = useTranslations('TeamStats')

	const chipByGw = useMemo(() => {
		const map = new Map<string, string>()
		for (const row of logs.chipUsageRows) {
			map.set(row.gameweek, row.chip)
		}
		for (const row of logs.transferRows) {
			if (row.chip && row.chip !== 'NONE' && !map.has(row.gameweek)) {
				map.set(row.gameweek, row.chip)
			}
		}
		return map
	}, [logs.chipUsageRows, logs.transferRows])

	const seasonSeries = useMemo(() => {
		return [...logs.historyRows]
			.map(row => ({
				gameweek: Number(row.gameweek),
				benchPoints: row.benchPoints,
				bb: isBenchBoost(chipByGw.get(row.gameweek)),
			}))
			.filter(p => Number.isFinite(p.gameweek) && p.gameweek > 0)
			.sort((a, b) => a.gameweek - b.gameweek)
	}, [logs.historyRows, chipByGw])

	const highWeeks = useMemo(() => {
		return seasonSeries
			.filter(p => p.benchPoints >= BENCH_HIGH_THRESHOLD)
			.sort(
				(a, b) =>
					b.benchPoints - a.benchPoints || b.gameweek - a.gameweek,
			)
	}, [seasonSeries])

	const summary = useMemo(() => {
		let highTotal = 0
		let max = 0
		let maxGw = 0
		for (const p of seasonSeries) {
			if (p.benchPoints >= BENCH_HIGH_THRESHOLD) {
				highTotal += p.benchPoints
			}
			if (p.benchPoints > max) {
				max = p.benchPoints
				maxGw = p.gameweek
			}
		}
		return {
			highCount: highWeeks.length,
			highTotal,
			max,
			maxGw,
			weekCount: seasonSeries.length,
		}
	}, [seasonSeries, highWeeks.length])

	if (seasonSeries.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">{t('noBenchHistory')}</p>
		)
	}

	return (
		<div className="space-y-4">
			<p className="text-xs leading-relaxed text-muted-foreground">
				{t('benchPointsExplain')}
			</p>

			{summary.highCount > 0 ? (
				<TeamMetricGrid cols={3}>
					<TeamMetricTile
						label={t('benchHighWeeksLabel', {
							threshold: BENCH_HIGH_THRESHOLD,
						})}
						value={summary.highCount}
					/>
					<TeamMetricTile
						label={t('benchHighTotal')}
						value={summary.highTotal}
						tone="primary"
					/>
					<TeamMetricTile
						label={t('benchBestGw')}
						value={`GW${summary.maxGw} · ${summary.max}`}
					/>
				</TeamMetricGrid>
			) : (
				<p className="text-sm text-muted-foreground">
					{t('benchNoHighWeeks', { threshold: BENCH_HIGH_THRESHOLD })}
				</p>
			)}

			{highWeeks.length > 0 ? (
				<div>
					<p className="mb-2 eyebrow">
						{t('benchHighListTitle', { threshold: BENCH_HIGH_THRESHOLD })}
					</p>
					<ul className="space-y-1.5">
						{highWeeks.map(p => (
							<li
								key={p.gameweek}
								className={cn(
									'flex items-center gap-3 rounded-lg border px-3 py-2.5',
									p.bb
										? 'border-plum/35 bg-plum/[0.06]'
										: 'border-border/70 bg-card',
								)}
							>
								<TeamGameweekLink
									gameweek={p.gameweek}
									className="w-10 shrink-0 text-xs font-semibold text-muted-foreground hover:text-primary-ink"
								/>
								<span className="min-w-0 flex-1 text-sm text-muted-foreground">
									{p.bb ? (
										<span className="inline-flex items-center gap-1.5">
											<span className="rounded bg-plum px-1.5 py-px font-display text-label font-bold text-electric">
												BB
											</span>
											<span>{t('benchBoostActive')}</span>
										</span>
									) : (
										t('benchLeftOnBench')
									)}
								</span>
								<span className="shrink-0 font-display text-lg font-bold tabular-nums text-primary-ink">
									{p.benchPoints}
								</span>
							</li>
						))}
					</ul>
					{summary.weekCount > summary.highCount ? (
						<p className="mt-2 text-caption text-muted-foreground">
							{t('benchOtherWeeksNote', {
								count: summary.weekCount - summary.highCount,
								threshold: BENCH_HIGH_THRESHOLD,
							})}
						</p>
					) : null}
				</div>
			) : null}
		</div>
	)
}
