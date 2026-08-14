import { cn } from '@/lib/utils'
import { shortMarketPosition } from '@/lib/market'
import type { MarketPosition } from '@/lib/graphql/operations/market'
import type { ReactNode } from 'react'

/** Compact semantic classes for the repeated rows on the Market page. */
export function MarketPositionBadge({ position }: { position: string }) {
	const shortPosition = shortMarketPosition(position as MarketPosition)
	return (
		<span
			className={cn(
				'market-position-badge',
				`market-position-badge--${shortPosition.toLowerCase()}`
			)}
		>
			{shortPosition}
		</span>
	)
}

export function MarketStatusBadge({
	available,
	children
}: {
	available: boolean
	children: ReactNode
}) {
	return (
		<span
			className={cn(
				'market-status-badge',
				available
					? 'market-status-badge--available'
					: 'market-status-badge--outline'
			)}
		>
			{children}
		</span>
	)
}
