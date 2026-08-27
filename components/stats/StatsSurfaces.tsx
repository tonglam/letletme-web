import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Metric tile — border only by default (no filled gray slab).
 * Pass className if a page needs a surface fill.
 */
export function StatsMetricTile({
	icon,
	label,
	value,
	detail,
	valueClassName,
	className,
	onClick,
	'aria-label': ariaLabel,
}: {
	icon?: ReactNode
	label: string
	value: ReactNode
	detail?: ReactNode
	valueClassName?: string
	className?: string
	onClick?: () => void
	'aria-label'?: string
}) {
	const body = (
		<>
			<div className="mb-2 flex items-center gap-2">
				{icon ? (
					<span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted-foreground sm:size-8">
						{icon}
					</span>
				) : null}
				<span className="eyebrow sm:text-caption">
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
		</>
	)

	const surface = cn(
		'rounded-lg border border-border/70 bg-transparent px-3 py-3 sm:px-4 sm:py-3.5',
		onClick &&
			'w-full cursor-pointer text-left transition-colors hover:border-primary/35 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
		className,
	)

	if (onClick) {
		return (
			<button type="button" onClick={onClick} aria-label={ariaLabel ?? label} className={surface}>
				{body}
			</button>
		)
	}

	return <div className={surface}>{body}</div>
}

export function StatsSectionCard({
	icon: Icon,
	eyebrow,
	title,
	titleId,
	description,
	action,
	children,
	className,
}: {
	icon?: LucideIcon
	eyebrow?: string
	title?: string
	titleId?: string
	description?: string
	action?: ReactNode
	children: ReactNode
	className?: string
}) {
	return (
		<Card className={cn('border-border/80 p-4 shadow-sm sm:p-6', className)}>
			{title ? (
				<div className="mb-4 sm:mb-5">
					<div className="flex items-start justify-between gap-3">
						<div className="min-w-0">
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
						</div>
						{action ? <div className="shrink-0">{action}</div> : null}
					</div>
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
	/** Optional chyron above the title; omit when not needed */
	eyebrow?: string
	title: string
	badge?: ReactNode
}) {
	return (
		<header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
			<div className="min-w-0">
				{eyebrow ? <p className="chyron">{eyebrow}</p> : null}
				<h1
					className={
						eyebrow
							? 'mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl'
							: 'font-display text-2xl font-bold tracking-tight sm:text-3xl'
					}
				>
					{title}
				</h1>
			</div>
			{badge != null ? (
				<div className="shrink-0">{badge}</div>
			) : null}
		</header>
	)
}
