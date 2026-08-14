export const GET_MARKET_PULSE = /* GraphQL */ `
  query GetMarketPulse($days: Int = 14) {
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
      ownershipMovers {
        risers {
          player { ...MarketPlayerFields }
          previousSelectedByPercent
          selectedByPercent
          change
        }
        fallers {
          player { ...MarketPlayerFields }
          previousSelectedByPercent
          selectedByPercent
          change
        }
      }
      transferMovers {
        player { ...MarketPlayerFields }
        transfersIn
        transfersOut
        netTransfers
      }
      availabilityUpdates {
        player { ...MarketPlayerFields }
        status
        previousStatus
        news
        newsAdded
        observedDate
        chanceOfPlayingThisRound
        chanceOfPlayingNextRound
      }
	  availabilityHighlights {
		player { ...MarketPlayerFields }
		status
		previousStatus
		news
		newsAdded
		observedDate
		chanceOfPlayingThisRound
		chanceOfPlayingNextRound
	  }
      newPlayers {
        player { ...MarketPlayerFields }
        firstObservedDate
      }
      priceChanges {
        player { ...MarketPlayerFields }
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
  query GetMarketPulseSummary($days: Int = 14) {
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
      mostSelected { ...MarketPlayerFields }
      ownershipMovers {
        risers {
          player { ...MarketPlayerFields }
          previousSelectedByPercent
          selectedByPercent
          change
        }
        fallers {
          player { ...MarketPlayerFields }
          previousSelectedByPercent
          selectedByPercent
          change
        }
      }
      transferMovers {
        player { ...MarketPlayerFields }
        transfersIn
        transfersOut
        netTransfers
      }
      availabilityUpdateCount
      availabilityHighlights {
        player { ...MarketPlayerFields }
        status
        previousStatus
        news
        newsAdded
        observedDate
        chanceOfPlayingThisRound
        chanceOfPlayingNextRound
      }
      newPlayers {
        player { ...MarketPlayerFields }
        firstObservedDate
      }
      priceChanges {
        player { ...MarketPlayerFields }
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

/** Compact market projection used by the fixture-planning page. */
export const GET_FIXTURE_PLANNING_SIGNALS = /* GraphQL */ `
  query GetFixturePlanningSignals($days: Int = 14) {
    marketPulse(days: $days) {
      mostSelected {
        ...FixtureSignalPlayerFields
      }
      ownershipMovers {
        risers {
          player { ...FixtureSignalPlayerFields }
        }
        fallers {
          player { ...FixtureSignalPlayerFields }
        }
      }
      transferMovers {
        player { ...FixtureSignalPlayerFields }
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

export type MarketPosition = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'

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

export interface MarketOwnershipMover {
	player: MarketPlayer
	previousSelectedByPercent: number
	selectedByPercent: number
	change: number
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
	ownershipMovers: {
		risers: MarketOwnershipMover[]
		fallers: MarketOwnershipMover[]
	}
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

export const GET_MARKET_PLAYERS = /* GraphQL */ `
  query MarketPlayers($search: String!, $limit: Int = 20) {
    marketSnapshotContext { revision source snapshotDate capturedAt rowCount }
    playersForPicker(search: $search, sort: NAME_ASC, limit: $limit, cursor: null) {
      items {
        id
        webName
        position
        price
        selectedByPercent
        totalPoints
        form
        team { id name shortName }
      }
      totalCount
      nextCursor
    }
  }
`

export const GET_MARKET_PRICE_HISTORY = /* GraphQL */ `
  query MarketPriceHistory($playerId: Int!) {
    marketSnapshotContext { revision source snapshotDate capturedAt rowCount }
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
  query MarketAvailability($days: Int = 14) {
    marketSnapshotContext { revision source snapshotDate capturedAt rowCount }
    marketPulse(days: $days) {
      availabilityUpdates {
        player { ...MarketPlayerFields }
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

export interface FixturePlanningMarketPulse {
	mostSelected: FixtureSignalPlayer[]
	ownershipMovers: {
		risers: Array<{ player: FixtureSignalPlayer }>
		fallers: Array<{ player: FixtureSignalPlayer }>
	}
	transferMovers: Array<{ player: FixtureSignalPlayer }>
}

export interface FixturePlanningSignalsResponse {
	marketPulse: FixturePlanningMarketPulse | null
}
