import { cn } from '@/lib/utils'

/**
 * Shared current/selected gameweek chip — mid-plum scoreboard surface + electric label.
 * Use wherever headers surface the active GW (live, stats, data, home).
 */
export function GameweekBadge({
	gameweek,
	label,
	className,
	size = 'default'
}: {
	gameweek?: number | null
	label?: string
	className?: string
	/** `sm` for inline section titles; default for page headers */
	size?: 'sm' | 'default'
}) {
	const resolvedLabel =
		label ??
		(typeof gameweek === 'number' && Number.isFinite(gameweek) && gameweek > 0
			? `GW${gameweek}`
			: 'GW')

	return (
		<span
			className={cn(
				'scoreboard-lifted inline-flex w-fit shrink-0 items-center font-mono font-semibold tracking-caps text-electric',
				size === 'sm' && 'rounded-md px-2 py-1 text-xs',
				size === 'default' &&
					'rounded-md px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm',
				className
			)}
		>
			{resolvedLabel}
		</span>
	)
}
