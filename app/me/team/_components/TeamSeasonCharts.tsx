'use client'

import { BarChart, ComboChart } from '@/components/charts/ChartPrimitives'
import { Button } from '@/components/ui/button'
import { StatsSectionCard } from '@/components/stats/StatsSurfaces'
import { LineChart } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { TeamSeasonLogs } from '../_lib/team-stats-model'
import { TeamMetricChip } from './TeamMetricTile'

/** Shared with Bench section — weeks at/above this are “left a lot on the bench”. */
export const BENCH_HIGH_THRESHOLD = 10

type ChartMode = 'rank' | 'totalPoints' | 'netPoints' | 'captain' | 'bench' | 'transfers'

type ChartPoint = {
	gameweek: number
	overallRank: number | null
	overallPoints: number
	netPoints: number
	eventPoints: number
	transfers: number
	transferCost: number
	captainName: string
	captainTeam: string
	captainPoints: number
	benchPoints: number
	chip: string
	isChip: boolean
}

const TRANSFER_VISUAL_CAP = 10

function normalizeChip(raw: string | undefined): string {
	return String(raw ?? 'NONE').toUpperCase().replace(/[\s-]+/g, '_')
}

function isHighlightChip(chip: string): boolean {
	return ['WILDCARD', 'WC', 'FREE_HIT', 'FREEHIT', 'FH', 'BENCH_BOOST', 'BB', 'TRIPLE_CAPTAIN', 'TC', '3XC'].includes(normalizeChip(chip))
}

function chipShortLabel(chip: string): string | null {
	const c = normalizeChip(chip)
	if (c === 'WILDCARD' || c === 'WC') return 'WC'
	if (c === 'FREE_HIT' || c === 'FREEHIT' || c === 'FH') return 'FH'
	if (c === 'BENCH_BOOST' || c === 'BB' || c === 'BBOOST') return 'BB'
	if (c === 'TRIPLE_CAPTAIN' || c === 'TC' || c === '3XC') return '3C'
	return null
}

function buildPoints(logs: TeamSeasonLogs): ChartPoint[] {
	const byGw = new Map<number, ChartPoint>()
	for (const row of logs.historyRows) {
		const gameweek = Number(row.gameweek)
		if (!Number.isFinite(gameweek) || gameweek <= 0) continue
		byGw.set(gameweek, {
			gameweek,
			overallRank: row.overallRank > 0 ? row.overallRank : null,
			overallPoints: row.overallPoints,
			netPoints: row.eventNetPoints,
			eventPoints: row.eventPoints,
			transfers: row.eventTransfers,
			transferCost: row.eventTransfersCost,
			captainName: row.captainName,
			captainTeam: row.captainTeam,
			captainPoints: row.captainPoints,
			benchPoints: row.benchPoints,
			chip: 'NONE',
			isChip: false,
		})
	}
	for (const row of logs.transferRows) {
		const gameweek = Number(row.gameweek)
		if (!Number.isFinite(gameweek) || gameweek <= 0) continue
		const existing = byGw.get(gameweek)
		const chip = row.chip ?? 'NONE'
		if (existing) {
			existing.transfers = row.transfers
			existing.transferCost = row.cost
			if (isHighlightChip(chip)) {
				existing.chip = chip
				existing.isChip = true
			}
		} else {
			byGw.set(gameweek, {
				gameweek,
				overallRank: null,
				overallPoints: 0,
				netPoints: 0,
				eventPoints: 0,
				transfers: row.transfers,
				transferCost: row.cost,
				captainName: '',
				captainTeam: '',
				captainPoints: 0,
				benchPoints: 0,
				chip,
				isChip: isHighlightChip(chip),
			})
		}
	}
	for (const row of logs.chipUsageRows) {
		const point = byGw.get(Number(row.gameweek))
		if (!point) continue
		point.chip = row.chip
		point.isChip = isHighlightChip(row.chip)
	}
	return Array.from(byGw.values()).sort((a, b) => a.gameweek - b.gameweek)
}

function formatAxisNum(value: number): string {
	if (!Number.isFinite(value)) return '—'
	if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
	if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}k`
	if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
	return String(Math.round(value))
}

function modeValue(point: ChartPoint, mode: ChartMode): number | null {
	switch (mode) {
		case 'rank': return point.overallRank
		case 'totalPoints': return point.overallPoints
		case 'netPoints': return point.netPoints
		case 'captain': return point.captainPoints
		case 'bench': return point.benchPoints
		case 'transfers': return Math.sign(point.transfers) * Math.min(Math.abs(point.transfers), TRANSFER_VISUAL_CAP)
	}
}

function barColor(point: ChartPoint, mode: ChartMode): string {
	if (mode === 'netPoints') return point.netPoints < 0 ? 'hsl(var(--destructive))' : point.isChip ? 'hsl(var(--plum))' : 'hsl(var(--primary-ink))'
	if (mode === 'captain') return ['TRIPLE_CAPTAIN', 'TC', '3XC'].includes(normalizeChip(point.chip)) ? 'hsl(var(--plum))' : point.captainPoints > 0 ? 'hsl(var(--primary-ink))' : 'hsl(var(--muted-foreground))'
	if (mode === 'bench') return ['BENCH_BOOST', 'BB', 'BBOOST'].includes(normalizeChip(point.chip)) && point.benchPoints >= BENCH_HIGH_THRESHOLD ? 'hsl(var(--plum))' : point.benchPoints >= BENCH_HIGH_THRESHOLD ? 'hsl(var(--primary-ink))' : 'hsl(var(--muted-foreground))'
	return point.transferCost > 0 ? 'hsl(var(--destructive))' : point.isChip ? 'hsl(var(--plum))' : 'hsl(var(--muted-foreground))'
}

/** Team season charts use the shared chart adapters for lines, bars and combo charts. */
export function TeamSeasonCharts({ logs }: { logs: TeamSeasonLogs }) {
	const t = useTranslations('TeamStats')
	const format = useFormatter()
	const [mode, setMode] = useState<ChartMode>('rank')
	const [hover, setHover] = useState<ChartPoint | null>(null)
	const points = useMemo(() => buildPoints(logs), [logs])

	const chartData = useMemo(
		() => points.map(point => ({
			x: point.gameweek,
			value: modeValue(point, mode),
			net: point.netPoints,
			fill: barColor(point, mode),
			opacity: mode === 'netPoints' && point.netPoints === 0 ? 0.25 : 0.85,
		})),
		[mode, points],
	)

	const captainSummary = useMemo(() => {
		const counts = new Map<string, { name: string; team: string; weeks: number; points: number }>()
		let totalPoints = 0
		for (const point of points) {
			if (!point.captainName) continue
			totalPoints += point.captainPoints
			const key = `${point.captainName}|${point.captainTeam}`
			const current = counts.get(key) ?? { name: point.captainName, team: point.captainTeam, weeks: 0, points: 0 }
			current.weeks += 1
			current.points += point.captainPoints
			counts.set(key, current)
		}
		return { totalPoints, top: Array.from(counts.values()).sort((a, b) => b.weeks - a.weeks || b.points - a.points).slice(0, 3) }
	}, [points])

	const modes: Array<{ id: ChartMode; label: string }> = [
		{ id: 'rank', label: t('chartRank') },
		{ id: 'totalPoints', label: t('chartTotalPoints') },
		{ id: 'netPoints', label: t('chartNetPoints') },
		{ id: 'captain', label: t('chartCaptain') },
		{ id: 'bench', label: t('chartBench') },
		{ id: 'transfers', label: t('chartTransfers') },
	]
	if (points.length === 0 || !chartData.some(point => point.value != null)) return null

	const compact = (value: number | null | undefined) => value == null ? '—' : format.number(value, { notation: 'compact' })
	const modeHint = mode === 'rank'
		? t('chartRankHint')
		: mode === 'totalPoints'
			? t('chartTotalPointsHint')
			: mode === 'netPoints'
				? t('chartNetPointsHint')
				: mode === 'captain'
					? t('chartCaptainHint')
					: mode === 'bench'
						? t('chartBenchHint', { threshold: BENCH_HIGH_THRESHOLD })
						: t('chartTransfersCapHint', { cap: TRANSFER_VISUAL_CAP })
	const updateHover = (point: { x?: string | number | null } | null) => {
		const gameweek = Number(point?.x)
		setHover(Number.isFinite(gameweek) ? points.find(item => item.gameweek === gameweek) ?? null : null)
	}

	return (
		<div className="mb-0">
			<StatsSectionCard icon={LineChart} title={t('seasonCharts')}>
				<div className="mb-3 flex flex-wrap gap-1.5">
					{modes.map(item => (
						<Button key={item.id} type="button" size="sm" variant={mode === item.id ? 'default' : 'outline'} className="h-7 px-2.5 text-xs" onClick={() => { setMode(item.id); setHover(null) }} aria-pressed={mode === item.id}>
							{item.label}
						</Button>
					))}
				</div>
				<div className="mb-2 min-h-[2.5rem] font-mono text-xs tabular-nums text-muted-foreground" aria-live="polite">
					{hover ? (
						<div className="flex flex-wrap gap-x-3 gap-y-1">
							<span className="font-semibold text-foreground">GW{hover.gameweek}</span>
							<span>{t('historyColOverallRank')} <span className="text-foreground">{compact(hover.overallRank)}</span></span>
							<span>{t('historyColTotalPoints')} <span className="text-foreground">{format.number(hover.overallPoints)}</span></span>
							<span>{t('historyColNetPoints')} <span className="text-foreground">{hover.netPoints}</span></span>
							{hover.captainName ? <span>{t('historyColCaptain')} <span className="text-foreground">{hover.captainName} {hover.captainPoints}{t('pointsShort')}</span></span> : null}
							<span>{t('benchPoints')} <span className="text-foreground">{hover.benchPoints}</span></span>
							<span>{t('transferSummaryMoves')} <span className="text-foreground">{hover.transfers}</span></span>
							{hover.transferCost > 0 ? <span className="text-destructive">{t('historyColTransferHit')} −{hover.transferCost}</span> : null}
							{hover.isChip && chipShortLabel(hover.chip) ? <span className="rounded border border-border/70 px-1 py-px font-display text-[10px] font-semibold text-plum">{chipShortLabel(hover.chip)}</span> : null}
						</div>
					) : <span>{t('chartHoverHint')}</span>}
				</div>
				{mode === 'rank' || mode === 'totalPoints' ? (
					<ComboChart
						data={chartData}
						line={{ key: 'value', label: mode === 'rank' ? t('historyColOverallRank') : t('historyColTotalPoints'), color: 'hsl(var(--primary-ink))' }}
						bar={{ key: 'net', label: t('historyColNetPoints'), color: 'hsl(var(--muted-foreground))', fillOpacity: 0.2 }}
						markerXs={points.filter(point => point.isChip).map(point => point.gameweek)}
						invertY={mode === 'rank'}
						yFormatter={value => formatAxisNum(Number(value))}
						xFormatter={value => `GW${value}`}
						ariaLabel={t('seasonCharts')}
						onActivePointChange={updateHover}
					/>
				) : (
					<BarChart
						data={chartData}
						series={[{ key: 'value', label: modes.find(item => item.id === mode)?.label ?? '', color: 'hsl(var(--primary-ink))' }]}
						referenceY={mode === 'bench' ? BENCH_HIGH_THRESHOLD : null}
						baseline={mode === 'netPoints'}
						yFormatter={value => formatAxisNum(Number(value))}
						xFormatter={value => `GW${value}`}
						ariaLabel={t('seasonCharts')}
						onActivePointChange={updateHover}
					/>
				)}
				<p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{modeHint}</p>
				{mode === 'captain' && captainSummary.top.length > 0 ? (
					<ul className="mt-3 flex flex-wrap gap-1.5">
						<li><TeamMetricChip><span className="text-white/70">{t('captainTotalPts')}</span><span className="font-semibold text-white">{captainSummary.totalPoints}</span></TeamMetricChip></li>
						{captainSummary.top.map(item => <li key={`${item.name}-${item.team}`}><TeamMetricChip><span className="font-medium text-white">{item.name}</span>{item.team ? <span className="font-mono text-[10px] text-white/70">{item.team}</span> : null}<span className="font-mono text-[10px] tabular-nums text-white/70">×{item.weeks}</span></TeamMetricChip></li>)}
					</ul>
				) : null}
			</StatsSectionCard>
		</div>
	)
}
