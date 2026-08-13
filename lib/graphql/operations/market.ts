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
	newPlayers: MarketNewPlayer[]
	priceChanges: MarketPriceChange[]
}

export interface MarketPulseResponse {
	marketPulse: MarketPulse
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
