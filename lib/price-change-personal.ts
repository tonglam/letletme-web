import { squadMatchKey } from '@/lib/fixtures-fdr'
import type { MyFplTeamTransfers } from '@/lib/graphql/operations/my-fpl'
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

type PlayerIdentity = {
	elementId: number
	webName: string
	teamShortName: string
	elementTypeName: string
}

type IdentityIndex = {
	byExactKey: Map<string, number | null>
	byNameAndPosition: Map<string, number | null>
}

const normalize = (value: string): string => value.trim().toLowerCase()

const nameAndPositionKey = (webName: string, elementTypeName: string): string =>
	`${normalize(webName)}|${normalize(elementTypeName)}`

function addUnique(
	map: Map<string, number | null>,
	key: string,
	elementId: number,
): void {
	if (!key) return
	const existing = map.get(key)
	if (existing === undefined) {
		map.set(key, elementId)
		return
	}
	if (existing !== elementId) map.set(key, null)
}

function buildIdentityIndex(picks: SquadPickSeed[]): IdentityIndex {
	const byExactKey = new Map<string, number | null>()
	const byNameAndPosition = new Map<string, number | null>()

	for (const pick of picks) {
		if (pick.elementId == null || pick.elementId <= 0) continue
		const identity: PlayerIdentity = {
			elementId: pick.elementId,
			webName: pick.webName,
			teamShortName: pick.teamShortName,
			elementTypeName: pick.elementTypeName,
		}
		addUnique(
			byExactKey,
			squadMatchKey(identity.webName, identity.teamShortName),
			identity.elementId,
		)
		addUnique(
			byNameAndPosition,
			nameAndPositionKey(identity.webName, identity.elementTypeName),
			identity.elementId,
		)
	}

	return { byExactKey, byNameAndPosition }
}

function resolveTransferElementId(
	webName: string,
	teamShortName: string,
	elementTypeName: string,
	index: IdentityIndex,
): number | null {
	const exact = index.byExactKey.get(squadMatchKey(webName, teamShortName))
	if (exact != null) return exact

	// A player can change club after the transfer. The position-qualified name
	// fallback still resolves to the existing element id when it is unique.
	const byNameAndPosition = index.byNameAndPosition.get(
		nameAndPositionKey(webName, elementTypeName),
	)
	return byNameAndPosition ?? null
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
	transfers?: MyFplTeamTransfers | null
	historyChips?: ReadonlyMap<number, string>
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

	const identityIndex = buildIdentityIndex(validPicks)
	const chips = params.historyChips ?? new Map<number, string>()
	const gameweeks = Array.from(params.transfers?.gameweeks ?? []).sort(
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
			const elementId = resolveTransferElementId(
				move.elementInWebName,
				move.elementInTeamShortName,
				move.elementInTypeName,
				identityIndex,
			)
			if (elementId == null) continue
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
