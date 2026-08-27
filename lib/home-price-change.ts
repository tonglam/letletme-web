import type {
	PriceChangeBoard,
	PriceChangePlayer
} from '@/lib/graphql/operations/price-changes'
import { isLikelyToChange } from '@/lib/price-change-sorting'

export type HomePriceChangePredictionState = {
	state: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
	capturedAt: string | null
	rises: PriceChangePlayer[]
	falls: PriceChangePlayer[]
}

function compareProgress(
	left: PriceChangePlayer,
	right: PriceChangePlayer,
	locale: string
): number {
	const progress =
		Math.abs(right.progressPercent) - Math.abs(left.progressPercent)
	if (progress !== 0) return progress
	const name = left.webName.localeCompare(right.webName, locale)
	return name !== 0 ? name : left.playerId - right.playerId
}

export function buildHomePriceChangePredictionState(
	board: PriceChangeBoard,
	locale: string
): HomePriceChangePredictionState {
	const rises = board.players
		.filter(player => isLikelyToChange(player) && player.progressPercent > 0)
		.sort((left, right) => compareProgress(left, right, locale))
		.slice(0, 5)
	const falls = board.players
		.filter(player => isLikelyToChange(player) && player.progressPercent < 0)
		.sort((left, right) => compareProgress(left, right, locale))
		.slice(0, 5)

	return {
		state:
			board.status === 'UNAVAILABLE'
				? 'UNAVAILABLE'
				: rises.length + falls.length > 0
					? 'AVAILABLE'
					: 'EMPTY',
		capturedAt: board.fetchedAt,
		rises,
		falls
	}
}
