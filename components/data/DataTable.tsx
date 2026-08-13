import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

/**
 * Shared dense table shell — the site standard for stat tables.
 * (Promoted from me/team TeamDataTable; same API, generic names.)
 */
export function DataTable({
	children,
	className,
	minWidthClass = 'min-w-[18rem]',
}: {
	children: ReactNode
	className?: string
	/** Per-table minimum width for horizontal scroll (e.g. 'min-w-[28rem]'). */
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

export function DataTh({
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
				'eyebrow px-1.5 py-2',
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

export function DataThead({
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
					'surface-inset border-b text-left',
					sticky && 'sticky top-0 z-10 shadow-sm backdrop-blur-sm',
				)}
			>
				{children}
			</tr>
		</thead>
	)
}

export function DataTr({
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

export function DataTd({
	children,
	className,
	align = 'left',
	colSpan,
}: {
	children: ReactNode
	className?: string
	align?: 'left' | 'center' | 'right'
	colSpan?: number
}) {
	return (
		<td
			colSpan={colSpan}
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
