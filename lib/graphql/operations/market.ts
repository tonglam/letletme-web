export const GET_MARKET_PULSE = /* GraphQL */ `
	query GetMarketPulse($days: Int = 7) {
		marketPulse(days: $days) {
			coverage {
				requestedDays
				observedDays
				firstDate
				latestDate
				capturedAt
				complete
				stale
			}
			mostSelected {
				...MarketPlayerFields
			}
			transferMovers {
				player {
					...MarketPlayerFields
				}
				transfersIn
				transfersOut
				netTransfers
			}
			availabilityUpdates {
				player {
					...MarketPlayerFields
				}
				status
				previousStatus
				news
				newsAdded
				observedDate
				chanceOfPlayingThisRound
				chanceOfPlayingNextRound
			}
			availabilityHighlights {
				player {
					...MarketPlayerFields
				}
				status
				previousStatus
				news
				newsAdded
				observedDate
				chanceOfPlayingThisRound
				chanceOfPlayingNextRound
			}
			newPlayers {
				player {
					...MarketPlayerFields
				}
				firstObservedDate
			}
			priceChanges {
				player {
					...MarketPlayerFields
				}
				changeDate
				oldPrice
				newPrice
				change
				direction
			}
		}
	}

	fragment MarketPlayerFields on MarketPlayer {
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
`

/** Initial Market projection. Availability rows are loaded only when expanded. */
export const GET_MARKET_PULSE_SUMMARY = /* GraphQL */ `
	query GetMarketPulseSummary($days: Int = 7) {
		marketSnapshotContext {
			season
			revision
			source
			snapshotDate
			capturedAt
			rowCount
		}
		marketPulse(days: $days) {
			coverage {
				requestedDays
				observedDays
				firstDate
				latestDate
				capturedAt
				complete
				stale
			}
			mostSelected {
				...MarketPlayerFields
			}
			transferMovers {
				player {
					...MarketPlayerFields
				}
				transfersIn
				transfersOut
				netTransfers
			}
			availabilityUpdateCount
			availabilityHighlights {
				player {
					...MarketPlayerFields
				}
				status
				previousStatus
				news
				newsAdded
				observedDate
				chanceOfPlayingThisRound
				chanceOfPlayingNextRound
			}
			newPlayers {
				player {
					...MarketPlayerFields
				}
				firstObservedDate
			}
			priceChanges {
				player {
					...MarketPlayerFields
				}
				changeDate
				oldPrice
				newPrice
				change
				direction
			}
		}
	}

	fragment MarketPlayerFields on MarketPlayer {
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
`

/** Compact market pulse projection used by the fixture-planning page. */
export const GET_FIXTURE_PLANNING_SIGNALS = /* GraphQL */ `
	query GetFixturePlanningSignals {
		marketPulse {
			mostSelected {
				...FixtureSignalPlayerFields
			}
			transferMovers {
				player {
					...FixtureSignalPlayerFields
				}
			}
		}
	}

	fragment FixtureSignalPlayerFields on MarketPlayer {
		playerId
		webName
		teamId
		teamShortName
		position
		price
		selectedByPercent
	}
`

const FIXTURE_PLANNING_OWNERSHIP_FIELDS = /* GraphQL */ `
	period
	gameweek {
		id
		name
		deadlineTime
	}
	coverage {
		status
		requestedDays
		observedDays
		firstDate
		latestDate
		fromDate
		toDate
		missingDates
		capturedAt
		complete
		stale
	}
	risers {
		player {
			...FixtureOwnershipPlayerFields
		}
		changePercentagePoints
	}
	fallers {
		player {
			...FixtureOwnershipPlayerFields
		}
		changePercentagePoints
	}
`

/** Ownership periods are separate requests so one unavailable period is isolated. */
export const GET_FIXTURE_PLANNING_OWNERSHIP_GAMEWEEK = /* GraphQL */ `
	query GetFixturePlanningOwnershipGameweek {
		marketOwnershipOverview(period: GAMEWEEK, limit: 10) {
			${FIXTURE_PLANNING_OWNERSHIP_FIELDS}
		}
	}

	fragment FixtureOwnershipPlayerFields on MarketPlayer {
		playerId
		webName
		teamId
		teamShortName
		position
		price
		selectedByPercent
	}
`

export const GET_FIXTURE_PLANNING_OWNERSHIP_ROLLING_7D = /* GraphQL */ `
	query GetFixturePlanningOwnershipRolling7d {
		marketOwnershipOverview(period: ROLLING_7D, limit: 10) {
			${FIXTURE_PLANNING_OWNERSHIP_FIELDS}
		}
	}

	fragment FixtureOwnershipPlayerFields on MarketPlayer {
		playerId
		webName
		teamId
		teamShortName
		position
		price
		selectedByPercent
	}
`

export type MarketPosition =
	'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'

export interface MarketPlayer {
	playerId: number
	playerCode: number
	webName: string
	teamId: number
	teamName: string
	teamShortName: string
	position: MarketPosition
	price: number
	selectedByPercent: number
}

export interface MarketCoverage {
	requestedDays: number
	observedDays: number
	firstDate: string | null
	latestDate: string | null
	capturedAt: string | null
	complete: boolean
	stale: boolean
}

export type MarketOwnershipPeriod = 'DAILY' | 'GAMEWEEK' | 'ROLLING_7D'
export type MarketOwnershipCoverageStatus =
	| 'READY'
	| 'PARTIAL'
	| 'NO_DATA'
	| 'BASELINE_MISSING'
	| 'NO_PREVIOUS_GAMEWEEK'
	| 'NO_UPCOMING_GAMEWEEK'

export interface MarketOwnershipCoverage {
	status: MarketOwnershipCoverageStatus
	requestedDays: number
	observedDays: number
	firstDate: string | null
	latestDate: string | null
	fromDate: string | null
	toDate: string | null
	missingDates: string[]
	capturedAt: string | null
	complete: boolean
	stale: boolean
}

export interface MarketOwnershipChange {
	player: MarketPlayer
	fromSelectedByPercent: number
	toSelectedByPercent: number
	changePercentagePoints: number
	fromDate: string
	toDate: string
}

export interface MarketOwnershipGameweek {
	id: number
	name: string
	deadlineTime: string
}

export interface MarketOwnershipOverview {
	period: MarketOwnershipPeriod
	gameweek: MarketOwnershipGameweek | null
	coverage: MarketOwnershipCoverage
	risers: MarketOwnershipChange[]
	fallers: MarketOwnershipChange[]
}

export interface MarketOwnershipDay {
	period: 'DAILY'
	date: string | null
	coverage: MarketOwnershipCoverage
	risers: MarketOwnershipChange[]
	fallers: MarketOwnershipChange[]
}

export interface MarketTransferMover {
	player: MarketPlayer
	transfersIn: number
	transfersOut: number
	netTransfers: number
}

export interface MarketAvailabilityUpdate {
	player: MarketPlayer
	status: string
	previousStatus: string | null
	news: string
	newsAdded: string | null
	observedDate: string
	chanceOfPlayingThisRound: number | null
	chanceOfPlayingNextRound: number | null
}

export interface MarketNewPlayer {
	player: MarketPlayer
	firstObservedDate: string
}

export interface MarketPriceChange {
	player: MarketPlayer
	changeDate: string
	oldPrice: number
	newPrice: number
	change: number
	direction: 'RISE' | 'FALL'
}

export interface MarketPulse {
	coverage: MarketCoverage
	mostSelected: MarketPlayer[]
	transferMovers: MarketTransferMover[]
	availabilityUpdates: MarketAvailabilityUpdate[]
	availabilityHighlights: MarketAvailabilityUpdate[]
	availabilityUpdateCount?: number
	newPlayers: MarketNewPlayer[]
	priceChanges: MarketPriceChange[]
}

export interface MarketPulseResponse {
	marketPulse: MarketPulse
}

export interface MarketSnapshotContext {
	season: string
	revision: string
	source: 'DATA_PUBLICATION' | 'POSTGRES_FALLBACK'
	snapshotDate: string | null
	capturedAt: string | null
	rowCount: number
}

export type MarketPulseSummary = Omit<MarketPulse, 'availabilityUpdates'> & {
	availabilityUpdates: MarketAvailabilityUpdate[]
	availabilityUpdateCount: number
}

export interface MarketPulseSummaryResponse {
	marketSnapshotContext: MarketSnapshotContext
	marketPulse: MarketPulseSummary
}

export interface MarketOwnershipOverviewResponse {
	marketOwnershipOverview: MarketOwnershipOverview
}

export interface MarketOwnershipDayResponse {
	marketOwnershipDay: MarketOwnershipDay
}

const MARKET_OWNERSHIP_FIELDS = /* GraphQL */ `
  coverage {
    status
    requestedDays
    observedDays
    firstDate
    latestDate
    fromDate
    toDate
    missingDates
    capturedAt
    complete
    stale
  }
  risers {
    player { ...MarketPlayerFields }
    fromSelectedByPercent
    toSelectedByPercent
    changePercentagePoints
    fromDate
    toDate
  }
  fallers {
    player { ...MarketPlayerFields }
    fromSelectedByPercent
    toSelectedByPercent
    changePercentagePoints
    fromDate
    toDate
  }
`

export const GET_MARKET_OWNERSHIP_OVERVIEW = /* GraphQL */ `
  query GetMarketOwnershipOverview($period: MarketOwnershipPeriod!, $limit: Int = 10) {
    marketOwnershipOverview(period: $period, limit: $limit) {
      period
      gameweek { id name deadlineTime }
      ${MARKET_OWNERSHIP_FIELDS}
    }
  }

  fragment MarketPlayerFields on MarketPlayer {
    playerId playerCode webName teamId teamName teamShortName
    position price selectedByPercent
  }
`

export const GET_MARKET_OWNERSHIP_DAY = /* GraphQL */ `
  query GetMarketOwnershipDay($date: Date, $limit: Int = 10) {
    marketOwnershipDay(date: $date, limit: $limit) {
      period
      date
      ${MARKET_OWNERSHIP_FIELDS}
    }
  }

  fragment MarketPlayerFields on MarketPlayer {
    playerId playerCode webName teamId teamName teamShortName
    position price selectedByPercent
  }
`

export const GET_MARKET_PLAYERS = /* GraphQL */ `
	query MarketPlayers($search: String!, $limit: Int = 20) {
		marketSnapshotContext {
			revision
			source
			snapshotDate
			capturedAt
			rowCount
		}
		playersForPicker(
			search: $search
			sort: NAME_ASC
			limit: $limit
			cursor: null
		) {
			items {
				id
				webName
				position
				price
				selectedByPercent
				totalPoints
				form
				team {
					id
					name
					shortName
				}
			}
			totalCount
			nextCursor
		}
	}
`

export const GET_MARKET_PRICE_HISTORY = /* GraphQL */ `
	query MarketPriceHistory($playerId: Int!) {
		marketSnapshotContext {
			revision
			source
			snapshotDate
			capturedAt
			rowCount
		}
		playerValueHistory(playerId: $playerId) {
			playerId
			changeDate
			oldValue
			newValue
			changeType
			transfersIn
			transfersOut
		}
	}
`

export const GET_MARKET_AVAILABILITY = /* GraphQL */ `
	query MarketAvailability($days: Int = 7) {
		marketSnapshotContext {
			revision
			source
			snapshotDate
			capturedAt
			rowCount
		}
		marketPulse(days: $days) {
			availabilityUpdates {
				player {
					...MarketPlayerFields
				}
				status
				previousStatus
				news
				newsAdded
				observedDate
				chanceOfPlayingThisRound
				chanceOfPlayingNextRound
			}
		}
	}

	fragment MarketPlayerFields on MarketPlayer {
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
`

export interface PlayerDirectoryItemLike {
	id: number
	webName: string
	position: MarketPosition
	price: number
	selectedByPercent?: number | null
	totalPoints?: number | null
	form?: number | null
	team: { id: number; name: string; shortName: string }
}

export interface MarketPlayersResponse {
	marketSnapshotContext: MarketSnapshotContext
	playersForPicker: {
		items: PlayerDirectoryItemLike[]
		totalCount: number
		nextCursor: number | null
	}
}

export interface MarketHistoryResponse {
	marketSnapshotContext: MarketSnapshotContext
	playerValueHistory: Array<{
		playerId: number
		changeDate: string
		oldValue: number
		newValue: number
		changeType: 'RISE' | 'FALL' | 'UNCHANGED'
		transfersIn?: number | null
		transfersOut?: number | null
	}>
}

export interface MarketAvailabilityResponse {
	marketSnapshotContext: MarketSnapshotContext
	marketPulse: { availabilityUpdates: MarketAvailabilityUpdate[] }
}

export type FixtureSignalPlayer = Pick<
	MarketPlayer,
	| 'playerId'
	| 'webName'
	| 'teamId'
	| 'teamShortName'
	| 'position'
	| 'price'
	| 'selectedByPercent'
>

export interface FixturePlanningMarketSignals {
	mostSelected: FixtureSignalPlayer[]
	transferMovers: Array<{ player: FixtureSignalPlayer }>
	gameweekOwnership: MarketOwnershipOverview | null
	rollingOwnership: MarketOwnershipOverview | null
}

export interface FixturePlanningSignalsResponse {
	marketPulse: {
		mostSelected: FixtureSignalPlayer[]
		transferMovers: Array<{ player: FixtureSignalPlayer }>
	} | null
}

export interface FixturePlanningOwnershipResponse {
	marketOwnershipOverview: MarketOwnershipOverview
}
