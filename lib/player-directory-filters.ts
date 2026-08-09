import type { PlayerDirectoryOption } from '@/components/player/PlayerDirectoryPicker'

export type OwnBand = 'ANY' | 'LE5' | '5_15' | '15_40' | 'GE40'
export type PlayerDirectorySort =
	'name' | 'total_desc' | 'form_desc' | 'price_asc' | 'price_desc' | 'own_desc'

/** Max affordable price in tenths (£m × 10); null = no cap. */
export type MaxPrice = number | null

export const OWN_BANDS: OwnBand[] = ['ANY', 'LE5', '5_15', '15_40', 'GE40']

/** FPL-style max-price steps from £15.5m down to £4.0m. */
export const MAX_PRICE_OPTIONS: MaxPrice[] = [
	null,
	...Array.from({ length: 24 }, (_, index) => 155 - index * 5)
]

export function formatMaxPriceLabel(max: MaxPrice): string {
	if (max == null) return 'any'
	return `le_${max}`
}

export function matchesMaxPrice(
	price: number | undefined,
	max: MaxPrice
): boolean {
	if (max == null) return true
	return (price ?? 0) <= max
}

export function matchesOwnBand(
	selectedByPercent: number | null | undefined,
	band: OwnBand
): boolean {
	if (band === 'ANY') return true
	if (selectedByPercent == null) return false
	switch (band) {
		case 'LE5':
			return selectedByPercent <= 5
		case '5_15':
			return selectedByPercent > 5 && selectedByPercent <= 15
		case '15_40':
			return selectedByPercent > 15 && selectedByPercent <= 40
		case 'GE40':
			return selectedByPercent > 40
		default:
			return true
	}
}

export function sortDirectoryPlayers(
	players: PlayerDirectoryOption[],
	sort: PlayerDirectorySort
): PlayerDirectoryOption[] {
	const sorted = [...players]
	switch (sort) {
		case 'total_desc':
			return sorted.sort(
				(a, b) =>
					(b.totalPoints ?? -1) - (a.totalPoints ?? -1) ||
					a.name.localeCompare(b.name)
			)
		case 'form_desc':
			return sorted.sort(
				(a, b) =>
					(b.form ?? -1) - (a.form ?? -1) || a.name.localeCompare(b.name)
			)
		case 'price_asc':
			return sorted.sort(
				(a, b) =>
					(a.price ?? 0) - (b.price ?? 0) || a.name.localeCompare(b.name)
			)
		case 'price_desc':
			return sorted.sort(
				(a, b) =>
					(b.price ?? 0) - (a.price ?? 0) || a.name.localeCompare(b.name)
			)
		case 'own_desc':
			return sorted.sort(
				(a, b) =>
					(b.selectedByPercent ?? -1) - (a.selectedByPercent ?? -1) ||
					a.name.localeCompare(b.name)
			)
		default:
			return sorted.sort((a, b) => a.name.localeCompare(b.name))
	}
}

export function filterDirectoryPlayers(
	players: PlayerDirectoryOption[],
	opts: {
		excludedIds: Set<string>
		positionFilter: string
		teamShortName: string | null
		maxPrice: MaxPrice
		ownBand: OwnBand
	}
): PlayerDirectoryOption[] {
	return players.filter(player => {
		if (opts.excludedIds.has(player.id)) return false
		if (
			opts.positionFilter !== 'ALL' &&
			player.position !== opts.positionFilter
		) {
			return false
		}
		if (opts.teamShortName && player.teamShortName !== opts.teamShortName) {
			return false
		}
		if (!matchesMaxPrice(player.price, opts.maxPrice)) return false
		if (!matchesOwnBand(player.selectedByPercent, opts.ownBand)) return false
		return true
	})
}
