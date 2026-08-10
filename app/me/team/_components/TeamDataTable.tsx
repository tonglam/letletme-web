import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/** Shared dense table shell — same language as TeamSquadSection. */
export function TeamDataTable({
	children,
	className,
	minWidthClass = 'min-w-[18rem]',
}: {
	children: ReactNode
	className?: string
	minWidthClass?: string
}) {
	return (
		<div
			className={cn(
				'-mx-1 overflow-x-auto overscroll-x-contain px-1 sm:mx-0 sm:px-0',
				className,
			)}
		>
			<table
				className={cn(
					'w-full border-collapse text-sm',
					minWidthClass,
				)}
			>
				{children}
			</table>
		</div>
	)
}

export function TeamDataTh({
	children,
	className,
	align = 'left',
}: {
	children: ReactNode
	className?: string
	align?: 'left' | 'center' | 'right'
}) {
	return (
		<th
			className={cn(
				'px-1.5 py-2 font-display text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground',
				align === 'center' && 'text-center',
				align === 'right' && 'text-right',
				align === 'left' && 'text-left',
				className,
			)}
		>
			{children}
		</th>
	)
}

export function TeamDataThead({
	children,
	sticky = false,
}: {
	children: ReactNode
	/** Sticky header when scrolling long season logs (e.g. 38 GW history). */
	sticky?: boolean
}) {
	return (
		<thead>
			<tr
				className={cn(
					'border-b border-border/70 bg-muted/40 text-left dark:bg-muted/20',
					sticky && 'sticky top-0 z-10 shadow-sm backdrop-blur-sm',
				)}
			>
				{children}
			</tr>
		</thead>
	)
}

export function TeamDataTr({
	children,
	className,
}: {
	children: ReactNode
	className?: string
}) {
	return (
		<tr
			className={cn(
				'border-b border-border/40 last:border-b-0 hover:bg-muted/30',
				className,
			)}
		>
			{children}
		</tr>
	)
}

export function TeamDataTd({
	children,
	className,
	align = 'left',
}: {
	children: ReactNode
	className?: string
	align?: 'left' | 'center' | 'right'
}) {
	return (
		<td
			className={cn(
				'px-1.5 py-2',
				align === 'center' && 'text-center',
				align === 'right' && 'text-right',
				className,
			)}
		>
			{children}
		</td>
	)
}
