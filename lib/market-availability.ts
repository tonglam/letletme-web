import type { MarketAvailabilityUpdate } from '@/lib/graphql/operations/market'

export type MarketAvailabilityStatusKey =
	| 'available'
	| 'doubtful'
	| 'injured'
	| 'unavailable'
	| 'suspended'
	| 'unknown'

export function marketAvailabilityStatusKey(status: string): MarketAvailabilityStatusKey {
	switch (status.trim().toLowerCase()) {
		case 'a':
		case 'available':
			return 'available'
		case 'd':
		case 'doubtful':
			return 'doubtful'
		case 'i':
		case 'injured':
			return 'injured'
		case 'u':
		case 'n':
		case 'unavailable':
			return 'unavailable'
		case 's':
		case 'suspended':
			return 'suspended'
		default:
			return 'unknown'
	}
}

export function isUnavailableMarketStatus(status: string): boolean {
	return marketAvailabilityStatusKey(status) !== 'available'
}

export type AvailabilityCopyKey =
	| 'availabilityRecovered'
	| `status.${MarketAvailabilityStatusKey}`

/**
 * Body copy for an availability row.
 * Never maps empty news to "recovered" unless status actually flipped back to available.
 */
export function availabilityBodyText(
	update: Pick<MarketAvailabilityUpdate, 'status' | 'previousStatus' | 'news'>,
	t: (key: AvailabilityCopyKey) => string,
): string {
	const trimmed = update.news.trim()
	if (trimmed.length > 0) return trimmed

	const current = marketAvailabilityStatusKey(update.status)
	const previous = update.previousStatus
		? marketAvailabilityStatusKey(update.previousStatus)
		: null

	if (current === 'available' && previous !== null && previous !== 'available') {
		return t('availabilityRecovered')
	}

	return t(`status.${current}`)
}

/** Prefer higher-owned public signals; if fewer than limit, fill with lower-owned. */
export function selectHomeAvailabilityUpdates<T extends { player: { selectedByPercent: number } }>(
	updates: readonly T[],
	limit: number,
	minOwnedPercent: number,
): T[] {
	if (limit <= 0 || updates.length === 0) return []
	const preferred = updates.filter(u => u.player.selectedByPercent >= minOwnedPercent)
	if (preferred.length >= limit) return preferred.slice(0, limit)
	const preferredIds = new Set(preferred.map(u => u))
	const rest = updates.filter(u => !preferredIds.has(u))
	return [...preferred, ...rest].slice(0, limit)
}
