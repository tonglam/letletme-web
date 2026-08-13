import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Team stats mini-metrics — matchday fascia tiles.
 *
 * Design intent (not “gray wash” or “green wash”):
 * - Dark aubergine strip (brand fascia) against the light page = clear rest + hierarchy
 * - Fixed height so a grid row never staggers
 * - Label + value only — never a second micro-line under the number
 * - Tone only changes the value color, not the tile fill
 */
export function TeamMetricTile({
	label,
	value,
	tone: _tone = 'default',
	className,
}: {
	label: string
	value: ReactNode
	/** Reserved for future emphasis; body text is always white on fascia. */
	tone?: 'default' | 'destructive' | 'primary'
	className?: string
}) {
	return (
		<div
			className={cn(
				'flex h-16 flex-col justify-center rounded-md px-3',
				'bg-fascia text-fascia-foreground',
				'shadow-[2px_2px_0_0_hsl(var(--sticker)/var(--sticker-alpha))]',
				className,
			)}
		>
			{/* Header / label — electric, unchanged */}
			<p className="truncate eyebrow text-electric/75">
				{label}
			</p>
			{/* Body — always white */}
			<p className="mt-1 truncate font-display text-xl font-bold tabular-nums tracking-tight text-fascia-foreground">
				{value}
			</p>
		</div>
	)
}

export function TeamMetricGrid({
	children,
	cols = 3,
	className,
}: {
	children: ReactNode
	cols?: 2 | 3
	className?: string
}) {
	return (
		<div
			className={cn(
				'grid gap-2.5',
				cols === 2 ? 'grid-cols-2' : 'grid-cols-3',
				className,
			)}
		>
			{children}
		</div>
	)
}

/**
 * Compact name chip (e.g. Salah LIV ×8).
 * Same fascia family, fixed height — not white/gray pills.
 */
export function TeamMetricChip({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<span
			className={cn(
				'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-fascia-foreground',
				'bg-fascia',
				'shadow-[1px_1px_0_0_hsl(var(--sticker)/var(--sticker-alpha))]',
				className,
			)}
		>
			{children}
		</span>
	)
}
