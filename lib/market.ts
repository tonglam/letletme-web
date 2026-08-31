import type {
	MarketCoverage,
	MarketOwnershipChange,
	MarketPlayer,
	MarketPulse
} from '@/lib/graphql/operations/market'

export type MarketPositionCode =
	MarketPlayer['position'] | 'GKP' | 'DEF' | 'MID' | 'FWD'

export type MarketPositionFilter = 'ALL' | MarketPlayer['position']

export const MARKET_POSITION_FILTERS: readonly MarketPositionFilter[] = [
	'ALL',
	'GOALKEEPER',
	'DEFENDER',
	'MIDFIELDER',
	'FORWARD'
]

export type MarketCoverageMode = 'empty' | 'one-day' | 'tracking'
export type MarketTeaserMode = 'price' | 'selected' | 'empty'
export type MarketViewMode =
	'price-led' | 'availability-led' | 'ownership-led' | 'baseline'

/** GraphQL sends this many availability rows in the initial highlights. */
export const MARKET_AVAILABILITY_HIGHLIGHT_LIMIT = 5

export function getMarketCoverageMode(
	coverage: MarketCoverage
): MarketCoverageMode {
	if (coverage.observedDays <= 0 || !coverage.latestDate) return 'empty'
	if (coverage.observedDays === 1) return 'one-day'
	return 'tracking'
}

export function getMarketTeaserMode(
	pulse: Pick<MarketPulse, 'priceChanges' | 'mostSelected'>
): MarketTeaserMode {
	if (pulse.priceChanges.length > 0) return 'price'
	if (pulse.mostSelected.length > 0) return 'selected'
	return 'empty'
}

/** Chooses the page narrative from non-ownership evidence. */
export function getMarketViewMode(
	pulse: MarketPulse,
	hasOwnershipEvidence = false
): MarketViewMode {
	if (pulse.priceChanges.length > 0) return 'price-led'
	if (pulse.availabilityHighlights.length > 0) return 'availability-led'
	if (hasOwnershipEvidence) return 'ownership-led'
	return 'baseline'
}

export function rankOwnershipChanges(
	risers: readonly MarketOwnershipChange[],
	fallers: readonly MarketOwnershipChange[]
): MarketOwnershipChange[] {
	return [...risers, ...fallers].sort(
		(a, b) =>
			Math.abs(b.changePercentagePoints) - Math.abs(a.changePercentagePoints) ||
			a.player.webName.localeCompare(b.player.webName)
	)
}

export function shortMarketPosition(
	position: MarketPositionCode
): 'GKP' | 'DEF' | 'MID' | 'FWD' {
	switch (position) {
		case 'GOALKEEPER':
		case 'GKP':
			return 'GKP'
		case 'DEFENDER':
		case 'DEF':
			return 'DEF'
		case 'MIDFIELDER':
		case 'MID':
			return 'MID'
		case 'FORWARD':
		case 'FWD':
			return 'FWD'
	}
}

export function filterMarketPlayersByPosition(
	players: readonly MarketPlayer[],
	position: MarketPositionFilter
): MarketPlayer[] {
	if (position === 'ALL') return [...players]
	return players.filter(player => player.position === position)
}
