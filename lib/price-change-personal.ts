import type { SquadPickSeed } from '@/lib/squad-picks'

export type PersonalPriceState = 'READY' | 'PARTIAL' | 'UNAVAILABLE'

export type PersonalPriceContext = {
	state: PersonalPriceState
	purchasePrices: Record<string, number>
}

export type SquadStartPrice = {
	elementId: number
	startPrice: number | null
}

export type PersonalPriceReview = {
	timeline: ReadonlyArray<{ eventId: number; eventChip: string }>
	transfers: ReadonlyArray<{
		eventId: number
		transfers: ReadonlyArray<{
			elementIn: number | null
			elementInCost: number
			time: string
		}>
	}>
}

/**
 * FPL selling price in tenths of a million. Price gains contribute half to
 * the selling price, rounded down to the nearest £0.1m; losses pass through.
 */
export function calculateSellingPrice(
	purchasePrice: number,
	currentPrice: number,
): number {
	if (currentPrice <= purchasePrice) return currentPrice
	return purchasePrice + Math.floor((currentPrice - purchasePrice) / 2)
}

export function buildPersonalPurchasePrices(params: {
	picks: SquadPickSeed[]
	startPrices: readonly SquadStartPrice[]
	review: PersonalPriceReview | null
}): PersonalPriceContext {
	const validPicks = params.picks.filter(
		pick => pick.elementId != null && pick.elementId > 0,
	)
	if (validPicks.length === 0) {
		return { state: 'UNAVAILABLE', purchasePrices: {} }
	}

	const startPriceByElementId = new Map(
		params.startPrices
			.filter(row => row.elementId > 0 && row.startPrice != null)
			.map(row => [row.elementId, row.startPrice as number]),
	)
	const purchasePriceByElementId = new Map<number, number>()

	for (const pick of validPicks) {
		const startPrice = startPriceByElementId.get(pick.elementId as number)
		if (startPrice != null && Number.isFinite(startPrice)) {
			purchasePriceByElementId.set(pick.elementId as number, startPrice)
		}
	}

	const chips = new Map(
		(params.review?.timeline ?? []).map(row => [row.eventId, row.eventChip]),
	)
	const gameweeks = Array.from(params.review?.transfers ?? []).sort(
		(left, right) => left.eventId - right.eventId,
	)

	for (const gameweek of gameweeks) {
		// Free Hit transfers are temporary and must not replace a player's
		// permanent purchase price.
		if (chips.get(gameweek.eventId) === 'FREE_HIT') continue

		const moves = [...gameweek.transfers].sort((left, right) => {
			const leftTime = Date.parse(left.time)
			const rightTime = Date.parse(right.time)
			if (Number.isFinite(leftTime) && Number.isFinite(rightTime)) {
				return leftTime - rightTime
			}
			return 0
		})

		for (const move of moves) {
			const elementId = move.elementIn
			if (elementId == null || !Number.isSafeInteger(elementId) || elementId <= 0)
				continue
			if (!Number.isFinite(move.elementInCost) || move.elementInCost < 0) {
				continue
			}
			purchasePriceByElementId.set(elementId, move.elementInCost)
		}
	}

	const purchasePrices: Record<string, number> = {}
	purchasePriceByElementId.forEach((price, elementId) => {
		purchasePrices[String(elementId)] = price
	})

	return {
		state:
			purchasePricesByCoverage(validPicks, purchasePriceByElementId) ===
			validPicks.length
				? 'READY'
				: purchasePriceByElementId.size > 0
					? 'PARTIAL'
					: 'UNAVAILABLE',
		purchasePrices,
	}
}

function purchasePricesByCoverage(
	picks: SquadPickSeed[],
	prices: ReadonlyMap<number, number>,
): number {
	return picks.reduce(
		(count, pick) =>
			count + (pick.elementId != null && prices.has(pick.elementId) ? 1 : 0),
		0,
	)
}
