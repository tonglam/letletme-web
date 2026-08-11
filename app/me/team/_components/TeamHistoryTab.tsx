'use client'

import { Button } from '@/components/ui/button'
import { LineChart as SharedLineChart } from '@/components/charts/ChartPrimitives'
import { cn } from '@/lib/utils'
import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import { TeamGameweekLink } from './TeamGameweekLink'

const GW_INITIAL = 12
const GW_PAGE = 12

/**
 * Gameweek history — normal data table:
 * one shared header row, full-page scroll (no nested max-height box).
 */
export function TeamGameweekHistory({ stats }: { stats: TeamSeasonLogs }) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const [visible, setVisible] = useState(GW_INITIAL)

	const rows = useMemo(
		() =>
			[...stats.historyRows].sort(
				(a, b) => Number(b.gameweek) - Number(a.gameweek)
			),
		[stats.historyRows]
	)

	const compact = (value: number | null | undefined) =>
		value == null ? '—' : format.number(value, { notation: 'compact' })

	if (rows.length === 0) {
		return <p className="text-sm text-muted-foreground">{t('noStats')}</p>
	}

	const shown = rows.slice(0, visible)
	const remaining = rows.length - shown.length

	return (
		<div className="space-y-3">
			<div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0">
				<table className="w-full min-w-[28rem] border-collapse text-sm">
					<thead>
						<tr className="border-b border-border/70 text-left">
							<th className="px-2 py-2.5 font-display text-[11px] font-semibold tracking-tight text-muted-foreground">
								{t('historyColGameweek')}
							</th>
							<th className="px-2 py-2.5 text-right font-display text-[11px] font-semibold tracking-tight text-muted-foreground">
								{t('historyColTotalPoints')}
							</th>
							<th className="px-2 py-2.5 text-right font-display text-[11px] font-semibold tracking-tight text-muted-foreground">
								{t('historyColOverallRank')}
							</th>
							<th className="px-2 py-2.5 font-display text-[11px] font-semibold tracking-tight text-muted-foreground">
								{t('historyColCaptain')}
							</th>
							<th className="px-2 py-2.5 text-right font-display text-[11px] font-semibold tracking-tight text-muted-foreground">
								{t('historyColCaptainPoints')}
							</th>
							<th className="px-2 py-2.5 text-right font-display text-[11px] font-semibold tracking-tight text-muted-foreground">
								{t('historyColTransferHit')}
							</th>
						</tr>
					</thead>
					<tbody>
						{shown.map(row => (
							<tr
								key={row.gameweek}
								className="border-b border-border/40 last:border-b-0 hover:bg-muted/25"
							>
								<td className="px-2 py-2.5 text-xs font-semibold">
									<TeamGameweekLink
										gameweek={row.gameweek}
										className="font-semibold text-muted-foreground hover:text-primary-ink"
									/>
								</td>
								<td className="px-2 py-2.5 text-right font-display text-base font-bold tabular-nums text-primary-ink">
									{row.overallPoints}
								</td>
								<td className="px-2 py-2.5 text-right font-mono text-xs tabular-nums">
									{compact(row.overallRank)}
								</td>
								<td className="max-w-[9rem] px-2 py-2.5">
									{row.captainName ? (
										<span className="block truncate text-sm font-medium">
											{row.captainName}
											{row.captainTeam ? (
												<span className="ml-1 font-mono text-[10px] text-muted-foreground">
													{row.captainTeam}
												</span>
											) : null}
										</span>
									) : (
										<span className="text-sm text-muted-foreground">—</span>
									)}
								</td>
								<td className="px-2 py-2.5 text-right font-mono text-xs font-semibold tabular-nums">
									{row.captainName ? row.captainPoints : '—'}
								</td>
								<td
									className={cn(
										'px-2 py-2.5 text-right font-mono text-xs tabular-nums',
										row.eventTransfersCost > 0
											? 'font-semibold text-destructive'
											: 'text-muted-foreground'
									)}
								>
									{row.eventTransfersCost > 0
										? `−${row.eventTransfersCost}`
										: 0}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{remaining > 0 ? (
				<div className="flex justify-center">
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="h-8 text-xs"
						onClick={() => setVisible(n => Math.min(n + GW_PAGE, rows.length))}
					>
						{t('historyShowMore', {
							count: Math.min(GW_PAGE, remaining)
						})}
					</Button>
				</div>
			) : rows.length > GW_INITIAL ? (
				<div className="flex justify-center">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 text-xs text-muted-foreground"
						onClick={() => setVisible(GW_INITIAL)}
					>
						{t('historyShowLess')}
					</Button>
				</div>
			) : null}
		</div>
	)
}

type PastSeasonPoint = {
	season: string
	totalPoints: number
	overallRank: number
	/** Newest season first in API; chart draws oldest → newest. */
	isCurrent: boolean
}

/**
 * Cross-season overall rank path (invert Y: better rank higher on chart).
 * Rows from API are typically newest-first; we reverse for chronological X.
 */
function PastSeasonsRankChart({
	points,
	compactRank
}: {
	points: PastSeasonPoint[]
	compactRank: (n: number) => string
}) {
	const t = useTranslations('TeamStats')
	const [hover, setHover] = useState<PastSeasonPoint | null>(null)
	const series = useMemo(() => [...points].reverse(), [points])
	if (series.length < 2) return null
	const data = series.map(point => ({
		x: point.season,
		value: point.overallRank,
		totalPoints: point.totalPoints
	}))

	return (
		<div className="space-y-2">
			<p className="font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{t('pastSeasonsRankTrend')}
			</p>
			<p className="text-[11px] leading-relaxed text-muted-foreground">
				{t('pastSeasonsRankTrendHint')}
			</p>
			<SharedLineChart
				data={data}
				series={[
					{
						key: 'value',
						label: t('historyColOverallRank'),
						color: 'hsl(var(--primary-ink))'
					}
				]}
				invertY
				xFormatter={value => String(value ?? '').replace(/^20/, '')}
				yFormatter={value => compactRank(Number(value))}
				ariaLabel={t('pastSeasonsRankTrend')}
				onActivePointChange={point => {
					const season = String(point?.x ?? '')
					setHover(series.find(item => item.season === season) ?? null)
				}}
			/>
			{hover ? (
				<p
					className="text-xs text-muted-foreground"
					aria-live="polite"
				>
					<span className="font-display font-semibold text-foreground">
						{hover.season}
						{hover.isCurrent ? ` · ${t('seasonCurrent')}` : ''}
					</span>
					{' · '}
					{t('historyColOverallRank')}: {compactRank(hover.overallRank)}
					{' · '}
					{t('points')}: {hover.totalPoints.toLocaleString()}
				</p>
			) : null}
		</div>
	)
}

/**
 * Prior seasons — rank trend chart + compact list.
 */
export function TeamSeasonHistory({ stats }: { stats: TeamSeasonLogs }) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const compact = (value: number | null | undefined) =>
		value == null ? '—' : format.number(value, { notation: 'compact' })

	const points = useMemo<PastSeasonPoint[]>(
		() =>
			stats.seasonHistoryRows
				.filter(r => Number.isFinite(r.overallRank) && r.overallRank > 0)
				.map((row, index) => ({
					season: row.season,
					totalPoints: row.totalPoints,
					overallRank: row.overallRank,
					isCurrent: index === 0
				})),
		[stats.seasonHistoryRows]
	)

	if (stats.seasonHistoryRows.length === 0) {
		return (
			<p className="text-sm text-muted-foreground">{t('noSeasonHistory')}</p>
		)
	}

	return (
		<div className="space-y-5">
			{points.length >= 2 ? (
				<PastSeasonsRankChart
					points={points}
					compactRank={compact}
				/>
			) : null}

			<div className="overflow-hidden rounded-lg border border-border/70">
				<div className="flex items-center gap-3 border-b border-border/60 bg-muted/30 px-3 py-1.5 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
					<span className="min-w-0 flex-1">{t('season')}</span>
					<span className="w-16 shrink-0 text-right">{t('points')}</span>
					<span className="w-16 shrink-0 text-right">
						{t('historyColOverallRank')}
					</span>
				</div>
				<ul className="divide-y divide-border/50">
					{stats.seasonHistoryRows.map((row, index) => {
						const isCurrent = index === 0
						return (
							<li
								key={row.season}
								className={cn(
									'flex items-center gap-3 px-3 py-3',
									isCurrent && 'bg-plum/[0.05]'
								)}
							>
								<div className="min-w-0 flex-1">
									<p className="font-display text-sm font-bold tracking-tight">
										{row.season}
										{isCurrent ? (
											<span className="ml-2 font-display text-[10px] font-semibold uppercase tracking-wide text-plum">
												{t('seasonCurrent')}
											</span>
										) : null}
									</p>
								</div>
								<span className="w-16 shrink-0 text-right font-display text-base font-bold tabular-nums text-primary-ink">
									{format.number(row.totalPoints)}
								</span>
								<span className="w-16 shrink-0 text-right font-mono text-sm tabular-nums">
									{compact(row.overallRank)}
								</span>
							</li>
						)
					})}
				</ul>
			</div>
		</div>
	)
}
