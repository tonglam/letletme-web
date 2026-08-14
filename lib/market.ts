import type {
	MarketCoverage,
	MarketOwnershipMover,
	MarketPosition,
	MarketPulse,
} from '@/lib/graphql/operations/market'

export type MarketCoverageMode = 'empty' | 'one-day' | 'tracking' | 'last-14-days'
export type MarketTeaserMode = 'price' | 'ownership' | 'selected' | 'empty'
export type MarketViewMode =
	'price-led' | 'availability-led' | 'ownership-led' | 'baseline'

/** GraphQL sends this many availability rows in the initial highlights. */
export const MARKET_AVAILABILITY_HIGHLIGHT_LIMIT = 5

export function getMarketCoverageMode(coverage: MarketCoverage): MarketCoverageMode {
	if (coverage.observedDays <= 0 || !coverage.latestDate) return 'empty'
	if (coverage.observedDays === 1) return 'one-day'
	if (coverage.observedDays < 14) return 'tracking'
	return 'last-14-days'
}

export function getMarketTeaserMode(
	pulse: Pick<MarketPulse, 'priceChanges' | 'ownershipMovers' | 'mostSelected'>
): MarketTeaserMode {
	if (pulse.priceChanges.length > 0) return 'price'
	if (
		pulse.ownershipMovers.risers.length > 0 ||
		pulse.ownershipMovers.fallers.length > 0
	) {
		return 'ownership'
	}
	if (pulse.mostSelected.length > 0) return 'selected'
	return 'empty'
}

/** Chooses the page narrative from evidence actually present in the response. */
export function getMarketViewMode(pulse: MarketPulse): MarketViewMode {
	if (pulse.priceChanges.length > 0) return 'price-led'
	if (pulse.availabilityHighlights.length > 0) return 'availability-led'
	if (
		pulse.ownershipMovers.risers.length > 0 ||
		pulse.ownershipMovers.fallers.length > 0
	) {
		return 'ownership-led'
	}
	return 'baseline'
}

export function rankOwnershipMovers(
	risers: readonly MarketOwnershipMover[],
	fallers: readonly MarketOwnershipMover[],
): MarketOwnershipMover[] {
	return [...risers, ...fallers].sort(
		(a, b) =>
			Math.abs(b.change) - Math.abs(a.change) ||
			a.player.webName.localeCompare(b.player.webName),
	)
}

export function shortMarketPosition(position: MarketPosition): 'GKP' | 'DEF' | 'MID' | 'FWD' {
	switch (position) {
		case 'GOALKEEPER':
			return 'GKP'
		case 'DEFENDER':
			return 'DEF'
		case 'MIDFIELDER':
			return 'MID'
		case 'FORWARD':
			return 'FWD'
	}
}
