export type PriceChangePredictionStatus =
	| 'VERY_LIKELY_RISE'
	| 'LIKELY_RISE'
	| 'UNLIKELY'
	| 'LIKELY_FALL'
	| 'VERY_LIKELY_FALL'
	| 'LOCKED'
	| 'CALIBRATING'

export type PriceChangeOwnershipTrend = 'UP' | 'DOWN' | 'FLAT'
export type PriceChangeBoardStatus =
	'READY' | 'PARTIAL' | 'STALE' | 'UNAVAILABLE'

export type PriceChangePlayer = {
	playerId: number
	playerCode: number
	webName: string
	teamId: number
	teamName: string
	teamShortName: string
	position: 'GKP' | 'DEF' | 'MID' | 'FWD'
	currentPrice: number
	selectedByPercent: number
	progressPercent: number
	hourlyRate: number
	status: PriceChangePredictionStatus
	ownershipTrend: PriceChangeOwnershipTrend
	transfersInEvent: number
	transfersOutEvent: number
	lockedUntil: string | null
	calibrating: boolean
}

export type PriceChangeBoard = {
	status: PriceChangeBoardStatus
	source: 'FPL_BOOTSTRAP'
	deadline: string | null
	nextDeadlines: string[]
	fetchedAt: string | null
	staleAt: string | null
	revision: string
	expectedPlayerCount: number
	observedPlayerCount: number
	players: PriceChangePlayer[]
}

export type PriceChangeBoardResponse = {
	priceChangeBoard: PriceChangeBoard
}

export const EMPTY_PRICE_CHANGE_BOARD: PriceChangeBoard = {
	status: 'UNAVAILABLE',
	source: 'FPL_BOOTSTRAP',
	deadline: null,
	nextDeadlines: [],
	fetchedAt: null,
	staleAt: null,
	revision: 'unavailable',
	expectedPlayerCount: 0,
	observedPlayerCount: 0,
	players: []
}

export const GET_PRICE_CHANGE_BOARD = /* GraphQL */ `
	query GetPriceChangeBoard {
		priceChangeBoard {
			status
			source
			deadline
			nextDeadlines
			fetchedAt
			staleAt
			revision
			expectedPlayerCount
			observedPlayerCount
			players {
				playerId
				playerCode
				webName
				teamId
				teamName
				teamShortName
				position
				currentPrice
				selectedByPercent
				progressPercent
				hourlyRate
				status
				ownershipTrend
				transfersInEvent
				transfersOutEvent
				lockedUntil
				calibrating
			}
		}
	}
`
