import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { PlayerDetailData } from '@/lib/graphql/operations/players'
import type { ReactNode } from 'react'

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
	return (
		<div className="rounded-lg bg-accent/30 p-3 text-center">
			<p className="mb-1 text-xs text-muted-foreground">{label}</p>
			<p className="text-xl font-bold">{value ?? '—'}</p>
			{sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
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
	const numeric = value ?? 0
	const percentage = Math.min(100, (numeric / max) * 100)

	return (
		<div>
			<div className="mb-1 flex items-center justify-between">
				<span className="text-sm">{label}</span>
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
	const displayValue1 = v1 ?? '—'
	const displayValue2 = v2 ?? '—'
	const value1 = Number.parseFloat(String(displayValue1).replace(/[^0-9.-]/g, ''))
	const value2 = Number.parseFloat(String(displayValue2).replace(/[^0-9.-]/g, ''))
	const comparable = Number.isFinite(value1) && Number.isFinite(value2) && value1 !== value2
	const firstWins = comparable && (higherIsBetter ? value1 > value2 : value1 < value2)
	const secondWins = comparable && (higherIsBetter ? value2 > value1 : value2 < value1)

	return (
		<div className="grid grid-cols-3 items-center border-b py-2 text-sm last:border-0">
			<span className={`pr-4 text-right font-medium tabular-nums ${firstWins ? 'text-primary' : ''}`}>
				{displayValue1}
			</span>
			<span className="text-center text-xs text-muted-foreground">{label}</span>
			<span className={`pl-4 text-left font-medium tabular-nums ${secondWins ? 'text-primary' : ''}`}>
				{displayValue2}
			</span>
		</div>
	)
}

export function CompareSectionHeader({ icon, label }: { icon: ReactNode; label: string }) {
	return (
		<h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			{icon}
			{label}
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
	const value1 = v1 ?? 0
	const value2 = v2 ?? 0
	const percentage1 = Math.min(100, (value1 / max) * 100)
	const percentage2 = Math.min(100, (value2 / max) * 100)

	return (
		<div className="flex flex-col gap-1">
			<span className="text-xs text-muted-foreground">{label}</span>
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
	return (
		<div className="flex flex-col gap-4" aria-label="Loading player statistics">
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
	const priceDiff = formatPriceDiff(detail.price, detail.startPrice)

	return (
		<Card className={`border-t-2 p-4 ${accent === 'info' ? 'border-info' : 'border-warning'}`}>
			<div className="mb-1 flex items-center gap-2">
				<span className="truncate font-bold">{detail.webName}</span>
				<Badge variant="outline" className="shrink-0 text-xs">
					{detail.elementTypeName}
				</Badge>
			</div>
			<p className="mb-3 text-xs text-muted-foreground">{detail.teamShortName}</p>
			<div className="grid grid-cols-3 gap-2">
				<MiniMetric label="Price" value={formatPrice(detail.price)} sub={priceDiff ?? undefined} positive={priceDiff?.startsWith('+')} />
				<MiniMetric label={`GW${currentGameweek ?? '—'}`} value={detail.eventPoints} emphasis />
				<MiniMetric label="Total" value={detail.totalPoints} />
				<MiniMetric label="Selected" value={detail.selectedByPercent == null ? '—' : `${detail.selectedByPercent}%`} />
				<MiniMetric label="Form" value={detail.form ?? '—'} />
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
		<div className="text-center">
			<p className="text-[10px] text-muted-foreground">{label}</p>
			<p className={`text-sm font-bold ${emphasis ? 'text-primary' : ''}`}>{value ?? '—'}</p>
			{sub ? (
				<p className={`text-[10px] ${positive ? 'text-success' : 'text-destructive'}`}>{sub}</p>
			) : null}
		</div>
	)
}
