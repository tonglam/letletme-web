import {
	DEFAULT_PRICE_CHANGE_SCOPE,
	type PriceChangeMovementFilter,
	type PriceChangeScope
} from '@/lib/price-change-sorting'

/**
 * Keep the shareable price-change filters in the address bar without causing
 * an RSC navigation. Search, sorting, and team filters remain client-only.
 */
export function buildPriceChangeFilterUrl(
	currentUrl: string,
	scope: PriceChangeScope,
	movement: PriceChangeMovementFilter
): string {
	const url = new URL(currentUrl, 'http://localhost')
	const effectiveScope =
		movement === 'locked' ? DEFAULT_PRICE_CHANGE_SCOPE : scope

	if (effectiveScope === DEFAULT_PRICE_CHANGE_SCOPE) {
		url.searchParams.delete('scope')
	} else {
		url.searchParams.set('scope', effectiveScope)
	}

	if (movement === 'all') {
		url.searchParams.delete('movement')
	} else {
		url.searchParams.set('movement', movement)
	}

	return `${url.pathname}${url.search}${url.hash}`
}
