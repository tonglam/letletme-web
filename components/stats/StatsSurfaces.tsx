import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/** Neutral metric tile — soft muted surface, matchday-friendly */
export function StatsMetricTile({
	icon,
	label,
	value,
	detail,
	valueClassName,
	className,
}: {
	icon?: ReactNode
	label: string
	value: ReactNode
	detail?: ReactNode
	valueClassName?: string
	className?: string
}) {
	return (
		<div
			className={cn(
				'rounded-lg border border-border/70 bg-muted/40 px-3 py-3 sm:px-4 sm:py-3.5 dark:bg-muted/25',
				className,
			)}
		>
			<div className="mb-2 flex items-center gap-2">
				{icon ? (
					<span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border/60 sm:size-8">
						{icon}
					</span>
				) : null}
				<span className="font-display text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-[11px]">
					{label}
				</span>
			</div>
			<div
				className={cn(
					'truncate font-display text-xl font-bold tabular-nums tracking-wide text-foreground sm:text-2xl',
					valueClassName,
				)}
			>
				{value}
			</div>
			{detail != null ? (
				<div className="mt-1.5 min-h-5 text-sm text-muted-foreground">{detail}</div>
			) : null}
		</div>
	)
}

export function StatsSectionCard({
	icon: Icon,
	eyebrow,
	title,
	titleId,
	description,
	children,
	className,
}: {
	icon?: LucideIcon
	eyebrow?: string
	title?: string
	titleId?: string
	description?: string
	children: ReactNode
	className?: string
}) {
	return (
		<Card className={cn('border-border/80 p-4 shadow-sm sm:p-6', className)}>
			{title ? (
				<div className="mb-4 sm:mb-5">
					{eyebrow ? <p className="chyron mb-1.5">{eyebrow}</p> : null}
					<h2
						id={titleId}
						className="flex items-center gap-2 font-display text-lg font-bold tracking-tight sm:text-xl"
					>
						{Icon ? (
							<Icon
								className="size-5 shrink-0 text-primary-ink"
								aria-hidden="true"
							/>
						) : null}
						{title}
					</h2>
					{description ? (
						<p className="mt-1.5 text-sm text-muted-foreground">
							{description}
						</p>
					) : null}
				</div>
			) : null}
			{children}
		</Card>
	)
}

/** Tab strip shell aligned with live matches / gameweek stats */
export function StatsTabsShell({ children }: { children: ReactNode }) {
	return (
		<div className="rounded-lg border border-border/80 bg-card p-2 shadow-sm sm:p-3">
			{children}
		</div>
	)
}

export function StatsPageHeader({
	eyebrow,
	title,
	badge,
}: {
	eyebrow: string
	title: string
	badge?: ReactNode
}) {
	return (
		<header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				<p className="chyron">{eyebrow}</p>
				<h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
					{title}
				</h1>
			</div>
			{badge != null ? (
				<div className="shrink-0">{badge}</div>
			) : null}
		</header>
	)
}
