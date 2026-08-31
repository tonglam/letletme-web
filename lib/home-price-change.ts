import type {
	PriceChangeBoard,
	PriceChangePlayer
} from '@/lib/graphql/operations/price-changes'
import {
	selectPriceChangePlayers,
	DEFAULT_PRICE_CHANGE_SORT
} from '@/lib/price-change-sorting'

export type HomePriceChangePredictionState = {
	state: 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'
	capturedAt: string | null
	rises: PriceChangePlayer[]
	falls: PriceChangePlayer[]
	riseTotal: number
	fallTotal: number
}

export function buildHomePriceChangePredictionState(
	board: PriceChangeBoard,
	locale: string
): HomePriceChangePredictionState {
	const rises = selectPriceChangePlayers(board.players, {
		scope: 'likely',
		movement: 'rise',
		sort: DEFAULT_PRICE_CHANGE_SORT,
		locale
	})
	const falls = selectPriceChangePlayers(board.players, {
		scope: 'likely',
		movement: 'fall',
		sort: DEFAULT_PRICE_CHANGE_SORT,
		locale
	})

	return {
		state:
			board.status === 'UNAVAILABLE'
				? 'UNAVAILABLE'
				: rises.length + falls.length > 0
					? 'AVAILABLE'
					: 'EMPTY',
		capturedAt: board.fetchedAt,
		rises: rises.slice(0, 5),
		falls: falls.slice(0, 5),
		riseTotal: rises.length,
		fallTotal: falls.length
	}
}
