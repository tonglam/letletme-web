import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { ReactNode } from 'react'

const TONE_CLASS = {
	positive: 'text-success',
	negative: 'text-destructive',
	neutral: 'text-muted-foreground',
} as const

/**
 * Signed change indicator — arrow + tabular number in the shared
 * success/destructive tone language. Used for price moves, ownership
 * swings and rank movement so pages stop re-deciding tone inline.
 */
export function DeltaBadge({
	value,
	invert = false,
	format,
	showArrow = true,
	size = 'md',
	className,
}: {
	value: number
	/** Flip tone semantics (e.g. rank: a falling number means climbing). */
	invert?: boolean
	/** Custom value render; default renders a signed number. */
	format?: (value: number) => ReactNode
	showArrow?: boolean
	size?: 'sm' | 'md'
	className?: string
}) {
	const tone =
		value === 0 ? 'neutral' : value > 0 !== invert ? 'positive' : 'negative'
	const Icon =
		value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight

	return (
		<span
			className={cn(
				'inline-flex items-center gap-0.5 font-mono tabular-nums',
				size === 'sm' ? 'text-caption font-semibold' : 'text-sm font-bold',
				TONE_CLASS[tone],
				className,
			)}
		>
			{showArrow ? (
				<Icon
					className={size === 'sm' ? 'size-3' : 'size-3.5'}
					aria-hidden="true"
				/>
			) : null}
			{format ? format(value) : value > 0 ? `+${value}` : value}
		</span>
	)
}
