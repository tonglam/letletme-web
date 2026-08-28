import type { MarketPriceChange } from './market'

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

export type PriceChangeObservedOutcome = 'CHANGED' | 'NO_CHANGE'

export type PriceChangeObservedEvent = {
	deadline: string
	changeDate: string
	observedAt: string
	outcome: PriceChangeObservedOutcome
	changedPlayerCount: number
	changes: MarketPriceChange[]
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
	latestEvent?: PriceChangeObservedEvent | null
}

export type PriceChangeLiveState = 'PROVISIONAL' | 'DURABLE' | 'UNAVAILABLE'

export type PriceChangeLiveCursor = {
	seasonCode: string
	revision: string | null
	sourceHash: string | null
	state: PriceChangeLiveState
	detectedAt: string | null
	fetchedAt: string | null
	expiresAt: string | null
}

export type PriceChangeLiveBoard = {
	revision: string
	sourceHash: string | null
	state: PriceChangeLiveState
	detectedAt: string | null
	expiresAt: string | null
	durablePublicationId: string | null
	board: PriceChangeBoard
}

export type PriceChangeBoardResponse = {
	priceChangeBoard: PriceChangeBoard
}

export type PriceChangeLiveCursorResponse = {
	priceChangeLiveCursor: PriceChangeLiveCursor
}

export type PriceChangeLiveBoardResponse = {
	priceChangeLiveBoard: PriceChangeLiveBoard
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
	players: [],
	latestEvent: null
}

const PRICE_CHANGE_OBSERVED_EVENT_FIELDS = /* GraphQL */ `
	latestEvent {
		deadline
		changeDate
		observedAt
		outcome
		changedPlayerCount
		changes {
			player {
				playerId
				playerCode
				webName
				teamId
				teamName
				teamShortName
				position
				price
				selectedByPercent
			}
			changeDate
			oldPrice
			newPrice
			change
			direction
		}
	}
`

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
			${PRICE_CHANGE_OBSERVED_EVENT_FIELDS}
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

export const GET_PRICE_CHANGE_LIVE_CURSOR = /* GraphQL */ `
	query GetPriceChangeLiveCursor {
		priceChangeLiveCursor {
			seasonCode
			revision
			sourceHash
			state
			detectedAt
			fetchedAt
			expiresAt
		}
	}
`

const PRICE_CHANGE_LIVE_BOARD_FIELDS = /* GraphQL */ `
	{
		status
		source
		deadline
		nextDeadlines
		fetchedAt
		staleAt
		revision
		expectedPlayerCount
		observedPlayerCount
		${PRICE_CHANGE_OBSERVED_EVENT_FIELDS}
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
`

export const GET_PRICE_CHANGE_LIVE_BOARD = /* GraphQL */ `
	query GetPriceChangeLiveBoard($revision: String, $sourceHash: String) {
		priceChangeLiveBoard(revision: $revision, sourceHash: $sourceHash) {
			revision
			sourceHash
			state
			detectedAt
			expiresAt
			durablePublicationId
			board ${PRICE_CHANGE_LIVE_BOARD_FIELDS}
		}
	}
`
