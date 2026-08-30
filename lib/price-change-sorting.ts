import type { PriceChangePlayer } from '@/lib/graphql/operations/price-changes'
import { calculateSellingPrice } from '@/lib/price-change-personal'

export type PriceChangeSortColumn =
	| 'price'
	| 'progress'
	| 'signal'
	| 'movement'
	| 'purchasePrice'
	| 'sellingPrice'

export type PriceChangeSortDirection = 'asc' | 'desc'

export type PriceChangeSortState = {
	column: PriceChangeSortColumn
	direction: PriceChangeSortDirection
}

export type PriceChangeMovementFilter = 'all' | 'rise' | 'fall' | 'locked'

export type PriceChangeScope = 'all' | 'likely'

export const DEFAULT_PRICE_CHANGE_SCOPE: PriceChangeScope = 'likely'

export const DEFAULT_PRICE_CHANGE_SORT: PriceChangeSortState = {
	column: 'progress',
	direction: 'desc',
}

const signalLikelihoodRank: Record<PriceChangePlayer['status'], number> = {
	VERY_LIKELY_RISE: 3,
	VERY_LIKELY_FALL: 3,
	LIKELY_RISE: 2,
	LIKELY_FALL: 2,
	UNLIKELY: 1,
	LOCKED: 0,
	CALIBRATING: 0,
}

/** Players likely to move are the primary default audience for this board. */
export function isLikelyToChange(player: PriceChangePlayer): boolean {
	return (
		player.status === 'VERY_LIKELY_RISE' ||
		player.status === 'LIKELY_RISE' ||
		player.status === 'LIKELY_FALL' ||
		player.status === 'VERY_LIKELY_FALL'
	)
}

/** Keep the homepage summary and the detail board on the same filter semantics. */
export function matchesPriceChangePlayer(
	player: PriceChangePlayer,
	{
		scope = 'all',
		movement = 'all'
	}: {
		scope?: PriceChangeScope
		movement?: PriceChangeMovementFilter
	} = {},
): boolean {
	if (scope === 'likely' && !isLikelyToChange(player)) return false
	if (movement === 'rise' && player.progressPercent <= 0) return false
	if (movement === 'fall' && player.progressPercent >= 0) return false
	if (
		movement === 'locked' &&
		player.status !== 'LOCKED' &&
		player.status !== 'CALIBRATING'
	) {
		return false
	}
	return true
}

/**
 * Default relevance: likely-to-change squad players, other likely-to-change
 * players, remaining squad players, then the rest of the player pool.
 */
export function priceChangeRelevanceScore(
	player: PriceChangePlayer,
	squadElementIds: ReadonlySet<number>,
): number {
	return (isLikelyToChange(player) ? 2 : 0) +
		(squadElementIds.has(player.playerId) ? 1 : 0)
}

export function priceChangeMovementValue(player: PriceChangePlayer): number {
	return player.transfersInEvent - player.transfersOutEvent
}

function compareNullableNumbers(
	left: number | null,
	right: number | null,
	direction: PriceChangeSortDirection,
): number {
	if (left == null && right == null) return 0
	if (left == null) return 1
	if (right == null) return -1
	if (left === right) return 0
	return direction === 'asc' ? left - right : right - left
}

function sortValue(
	player: PriceChangePlayer,
	column: PriceChangeSortColumn,
	purchasePrices: Readonly<Record<string, number>>,
): number | null {
	switch (column) {
		case 'price':
			return player.currentPrice
		case 'progress':
			return Math.abs(player.progressPercent)
		case 'signal':
			return signalLikelihoodRank[player.status]
		case 'movement':
			return priceChangeMovementValue(player)
		case 'purchasePrice': {
			const value = purchasePrices[String(player.playerId)]
			return Number.isFinite(value) ? value : null
		}
		case 'sellingPrice': {
			const purchasePrice = purchasePrices[String(player.playerId)]
			if (!Number.isFinite(purchasePrice)) return null
			return calculateSellingPrice(purchasePrice, player.currentPrice)
		}
	}
}

export function sortPriceChangePlayers(
	players: readonly PriceChangePlayer[],
	{
		sort = DEFAULT_PRICE_CHANGE_SORT,
		squadElementIds = new Set<number>(),
		purchasePrices = {},
		locale,
	}: {
		sort?: PriceChangeSortState
		squadElementIds?: ReadonlySet<number>
		purchasePrices?: Readonly<Record<string, number>>
		locale?: string
	} = {},
): PriceChangePlayer[] {
	const relevanceFirst =
		sort.column === DEFAULT_PRICE_CHANGE_SORT.column &&
		sort.direction === DEFAULT_PRICE_CHANGE_SORT.direction

	return [...players].sort((left, right) => {
		if (relevanceFirst) {
			const relevance =
				priceChangeRelevanceScore(right, squadElementIds) -
				priceChangeRelevanceScore(left, squadElementIds)
			if (relevance !== 0) return relevance
		}

		const primary = compareNullableNumbers(
			sortValue(left, sort.column, purchasePrices),
			sortValue(right, sort.column, purchasePrices),
			sort.direction,
		)
		if (primary !== 0) return primary

		if (!relevanceFirst) {
			const relevance =
				priceChangeRelevanceScore(right, squadElementIds) -
				priceChangeRelevanceScore(left, squadElementIds)
			if (relevance !== 0) return relevance
		}

		const name = left.webName.localeCompare(right.webName, locale)
		if (name !== 0) return name
		return left.playerId - right.playerId
	})
}

/** Apply the canonical prediction scope before applying the board sort. */
export function selectPriceChangePlayers(
	players: readonly PriceChangePlayer[],
	{
		scope = 'all',
		movement = 'all',
		sort = DEFAULT_PRICE_CHANGE_SORT,
		squadElementIds = new Set<number>(),
		purchasePrices = {},
		locale
	}: {
		scope?: PriceChangeScope
		movement?: PriceChangeMovementFilter
		sort?: PriceChangeSortState
		squadElementIds?: ReadonlySet<number>
		purchasePrices?: Readonly<Record<string, number>>
		locale?: string
	} = {},
): PriceChangePlayer[] {
	return sortPriceChangePlayers(
		players.filter(player => matchesPriceChangePlayer(player, { scope, movement })),
		{
			sort,
			squadElementIds,
			purchasePrices,
			locale
		}
	)
}
