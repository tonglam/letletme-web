'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'

const STAT_LABEL_KEYS = {
	Price: 'price',
	Points: 'points',
	'Total Points': 'totalPoints',
	'Total Pts': 'totalPts',
	Total: 'total',
	Selected: 'selected',
	'Selected By': 'selectedBy',
	'Selected By %': 'selectedByPercent',
	Form: 'form',
	'Season Totals': 'seasonTotals',
	Goals: 'goals',
	Assists: 'assists',
	'Clean Sheets': 'cleanSheets',
	Minutes: 'minutes',
	'Ownership & Transfers': 'ownershipTransfers',
	'Season In': 'seasonIn',
	'Season Out': 'seasonOut',
	'GW Net': 'gwNet',
	Goalkeeping: 'goalkeeping',
	Saves: 'saves',
	'Pen. Saved': 'penaltiesSaved',
	'Goals Conceded': 'goalsConceded',
	Outfield: 'outfield',
	'Own Goals': 'ownGoals',
	Defensive: 'defensive',
	Attacking: 'attacking',
	Discipline: 'discipline',
	FPL: 'fpl',
	'Yellow Cards': 'yellowCards',
	'Red Cards': 'redCards',
	Bonus: 'bonus',
	BPS: 'bps',
	Current: 'current',
	Start: 'start',
	Change: 'change',
	'ICT Values': 'ictValues',
	Influence: 'influence',
	Creativity: 'creativity',
	Threat: 'threat',
	'ICT Index': 'ictIndex',
} as const

function useTranslatedStatLabel() {
	const t = useTranslations('PlayerStats.labels')

	return (label: string) => {
		const gameweekPoints = /^GW\s+(.+)\s+Pts$/.exec(label)
		if (gameweekPoints) return t('gwPoints', { gameweek: gameweekPoints[1] })

		const gameweek = /^GW\s+(.+)$/.exec(label)
		if (gameweek) return t('gameweek', { gameweek: gameweek[1] })

		const key = STAT_LABEL_KEYS[label as keyof typeof STAT_LABEL_KEYS]
		return key ? t(key) : label
	}
}

export const DIFFICULTY_COLORS: Record<number, string> = {
	1: 'bg-success',
	2: 'bg-success/70',
	3: 'bg-warning',
	4: 'bg-warning/80',
	5: 'bg-destructive',
}

export const formatPrice = (raw: number) => `£${(raw / 10).toFixed(1)}m`

export const formatPriceDiff = (current: number, start: number) => {
	const diff = current - start
	if (diff === 0) return null
	const sign = diff > 0 ? '+' : ''
	return `${sign}${(diff / 10).toFixed(1)}m`
}

export function StatCell({
	label,
	value,
	sub,
}: {
	label: string
	value: string | number | null
	sub?: string
}) {
	const translateLabel = useTranslatedStatLabel()

	return (
		<div className="rounded-lg border border-border/70 bg-muted/40 p-3 text-center dark:bg-muted/25">
			<p className="mb-1 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
				{translateLabel(label)}
			</p>
			<p className="font-display text-xl font-bold tabular-nums tracking-wide text-foreground">
				{value ?? '—'}
			</p>
			{sub ? (
				<p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
			) : null}
		</div>
	)
}

export function IctBar({
	label,
	value,
	color,
	max = 100,
}: {
	label: string
	value: number | null
	color: string
	max?: number
}) {
	const translateLabel = useTranslatedStatLabel()
	const numeric = value ?? 0
	const percentage = Math.min(100, (numeric / max) * 100)

	return (
		<div>
			<div className="mb-1 flex items-center justify-between">
				<span className="text-sm">{translateLabel(label)}</span>
				<span className="text-sm font-medium">{numeric}</span>
			</div>
			<div className="h-2 w-full rounded-full bg-muted">
				<div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
			</div>
		</div>
	)
}

export function CompareRow({
	label,
	v1,
	v2,
	higherIsBetter = true,
}: {
	label: string
	v1: string | number | null
	v2: string | number | null
	higherIsBetter?: boolean
}) {
	const translateLabel = useTranslatedStatLabel()
	const displayValue1 = v1 ?? '—'
	const displayValue2 = v2 ?? '—'
	const value1 = Number.parseFloat(String(displayValue1).replace(/[^0-9.-]/g, ''))
	const value2 = Number.parseFloat(String(displayValue2).replace(/[^0-9.-]/g, ''))
	const comparable = Number.isFinite(value1) && Number.isFinite(value2) && value1 !== value2
	const firstWins = comparable && (higherIsBetter ? value1 > value2 : value1 < value2)
	const secondWins = comparable && (higherIsBetter ? value2 > value1 : value2 < value1)

	return (
		<div className="grid grid-cols-3 items-center border-b border-border/60 py-2.5 text-sm last:border-0">
			<span
				className={`pr-4 text-right font-display font-semibold tabular-nums ${firstWins ? 'text-primary-ink' : ''}`}
			>
				{displayValue1}
			</span>
			<span className="text-center text-xs text-muted-foreground">
				{translateLabel(label)}
			</span>
			<span
				className={`pl-4 text-left font-display font-semibold tabular-nums ${secondWins ? 'text-primary-ink' : ''}`}
			>
				{displayValue2}
			</span>
		</div>
	)
}

export function CompareSectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
	const translateLabel = useTranslatedStatLabel()

	return (
		<h3 className="mb-2.5 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
			{icon ? (
				<span className="text-primary-ink [&_svg]:size-3.5">{icon}</span>
			) : null}
			{translateLabel(label)}
		</h3>
	)
}

export function DualIctBar({
	label,
	v1,
	v2,
	name1,
	name2,
	max,
}: {
	label: string
	v1: number | null
	v2: number | null
	name1: string
	name2: string
	max: number
}) {
	const translateLabel = useTranslatedStatLabel()
	const value1 = v1 ?? 0
	const value2 = v2 ?? 0
	const percentage1 = Math.min(100, (value1 / max) * 100)
	const percentage2 = Math.min(100, (value2 / max) * 100)

	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs text-muted-foreground">{translateLabel(label)}</span>
			<div className="flex items-center gap-2 text-xs">
				<span className="w-16 truncate text-right text-muted-foreground">{name1}</span>
				<div className="h-2 flex-1 rounded-full bg-muted">
					<div className="h-2 rounded-full bg-info" style={{ width: `${percentage1}%` }} />
				</div>
				<span className="w-8 font-medium">{value1}</span>
			</div>
			<div className="flex items-center gap-2 text-xs">
				<span className="w-16 truncate text-right text-muted-foreground">{name2}</span>
				<div className="h-2 flex-1 rounded-full bg-muted">
					<div className="h-2 rounded-full bg-warning" style={{ width: `${percentage2}%` }} />
				</div>
				<span className="w-8 font-medium">{value2}</span>
			</div>
		</div>
	)
}

export function PlayerDetailSkeleton() {
	const t = useTranslations('PlayerStats')

	return (
		<div className="flex flex-col gap-4" aria-label={t('loadingStats')}>
			<Skeleton className="h-32 w-full rounded-lg" />
			<Skeleton className="h-12 w-full rounded-lg" />
			<Skeleton className="h-64 w-full rounded-lg" />
		</div>
	)
}

export function PlayerMiniCard({
	detail,
	currentGameweek,
	accent,
}: {
	detail: PlayerDetailData
	currentGameweek: number | undefined
	accent: 'info' | 'warning'
}) {
	const t = useTranslations('PlayerStats.labels')
	const position = useTranslations('PlayerDirectory')
	const priceDiff = formatPriceDiff(detail.price, detail.startPrice)
	const positionName =
		detail.elementType === 1
			? position('goalkeeper')
			: detail.elementType === 2
				? position('defender')
				: detail.elementType === 3
					? position('midfielder')
					: detail.elementType === 4
						? position('forward')
						: detail.elementTypeName

	return (
		<Card
			className={`border-border/80 border-t-2 p-4 shadow-sm ${accent === 'info' ? 'border-t-info' : 'border-t-warning'}`}
		>
			<div className="mb-1 flex items-center gap-2">
				<span className="truncate font-display font-bold">{detail.webName}</span>
				<Badge variant="outline" className="shrink-0 text-xs">
					{positionName}
				</Badge>
			</div>
			<p className="mb-3 text-xs text-muted-foreground">{detail.teamShortName}</p>
			<div className="grid grid-cols-3 gap-2">
				<MiniMetric label={t('price')} value={formatPrice(detail.price)} sub={priceDiff ?? undefined} positive={priceDiff?.startsWith('+')} />
				<MiniMetric label={t('gameweek', { gameweek: currentGameweek ?? '—' })} value={detail.eventPoints} emphasis />
				<MiniMetric label={t('total')} value={detail.totalPoints} />
				<MiniMetric label={t('selected')} value={detail.selectedByPercent == null ? '—' : `${detail.selectedByPercent}%`} />
				<MiniMetric label={t('form')} value={detail.form ?? '—'} />
			</div>
		</Card>
	)
}

function MiniMetric({
	label,
	value,
	sub,
	positive,
	emphasis = false,
}: {
	label: string
	value: string | number | null
	sub?: string
	positive?: boolean
	emphasis?: boolean
}) {
	return (
		<div className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-1.5 text-center dark:bg-muted/20">
			<p className="font-display text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
				{label}
			</p>
			<p
				className={`font-display text-sm font-bold tabular-nums ${emphasis ? 'text-foreground' : 'text-foreground'}`}
			>
				{value ?? '—'}
			</p>
			{sub ? (
				<p
					className={`text-[10px] ${positive ? 'text-success' : 'text-destructive'}`}
				>
					{sub}
				</p>
			) : null}
		</div>
	)
}
