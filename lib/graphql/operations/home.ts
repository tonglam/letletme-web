import type { TopTransfer } from '@/lib/graphql/operations/prices'
import type {
	MarketAvailabilityUpdate,
	MarketCoverage,
	MarketOwnershipMover,
	MarketPlayer,
	MarketPriceChange
} from '@/lib/graphql/operations/market'

const HOME_FIXTURE_FIELDS = /* GraphQL */ `
  fragment HomeFixtureFields on Fixture {
    id
    finished
    started
    kickoffTime
    homeTeam { id name shortName }
    awayTeam { id name shortName }
    homeScore
    awayScore
  }
`

export const GET_HOME_PUBLIC_BOOTSTRAP = /* GraphQL */ `
  query GetHomePublicBootstrap {
    homePublicBootstrap {
      context {
        season
        revision
        sourceCheckedAt
        currentEventId
        nextEventId
        nextDeadlineTime
        latestFinishedEventId
      }
      fixtures { ...HomeFixtureFields }
    }
  }
  ${HOME_FIXTURE_FIELDS}
`

export const GET_HOME_EVENT_FIXTURES = /* GraphQL */ `
  query GetHomeEventFixtures($eventId: Int!) {
    coreEventContext { season revision }
    eventFixtures(eventId: $eventId) { ...HomeFixtureFields }
  }
  ${HOME_FIXTURE_FIELDS}
`

export const GET_HOME_GAMEWEEK = /* GraphQL */ `
  query GetHomeGameweek($eventId: Int!) {
    gameweekDesk(eventId: $eventId) {
      season
      coreRevision
      liveRevision
      eventId
      lifecycle
      overviewState
      boardsState
      overview {
        highestPoints
        mostCaptained { id webName teamShortName }
        topScorer { id webName teamShortName points }
        mostPlayedChip { name numberPlayed }
      }
      dreamTeam {
        id
        webName
        position
        teamShortName
        totalPoints
      }
    }
    topTransfersIn(eventId: $eventId, limit: 5) {
      ...HomeTransferFields
    }
    topTransfersOut(eventId: $eventId, limit: 5) {
      ...HomeTransferFields
    }
  }

  fragment HomeTransferFields on PlayerTransferStats {
    player {
      id
      webName
      position
      selectedByPercent
      totalPoints
      team { name shortName }
    }
    eventId
    transfersInEvent
    transfersOutEvent
  }
`

export const GET_HOME_PERSONAL_DESK = /* GraphQL */ `
  query GetHomePersonalDesk {
    homePersonalDesk {
      state
      entryName
      playerName
      overallPoints
      overallRank
      teamValue
      leagueRanks {
        key
        name
        rank
        movement { direction places }
        tournamentId
      }
      sourceCheckedAt
    }
  }
`

export const GET_HOME_MARKET_PULSE = /* GraphQL */ `
  query GetHomeMarketPulse($days: Int = 14) {
    homeMarketPulse(days: $days) {
      coverage {
        requestedDays observedDays firstDate latestDate capturedAt complete stale
      }
      mostSelected { ...HomeMarketPlayerFields }
      ownershipMovers {
        risers {
          player { ...HomeMarketPlayerFields }
          previousSelectedByPercent selectedByPercent change
        }
        fallers {
          player { ...HomeMarketPlayerFields }
          previousSelectedByPercent selectedByPercent change
        }
      }
      availabilityUpdates {
        player { ...HomeMarketPlayerFields }
        status previousStatus news newsAdded observedDate
        chanceOfPlayingThisRound chanceOfPlayingNextRound
      }
      priceChanges {
        player { ...HomeMarketPlayerFields }
        changeDate oldPrice newPrice change direction
      }
    }
  }

  fragment HomeMarketPlayerFields on MarketPlayer {
    playerId playerCode webName teamId teamName teamShortName
    position price selectedByPercent
  }
`

export type HomeCoreEventContext = {
	season: string
	revision: string
	sourceCheckedAt: string
	currentEventId: number | null
	nextEventId: number | null
	nextDeadlineTime: string | null
	latestFinishedEventId: number | null
}

export type HomeFixtureTeam = {
	id: number
	name: string
	shortName: string
}

export type HomeFixture = {
	id: number
	eventId: number
	finished: boolean
	started: boolean
	kickoffTime: string | null
	homeTeam: HomeFixtureTeam
	awayTeam: HomeFixtureTeam
	homeScore: number | null
	awayScore: number | null
}

type HomeGraphQLFixture = Omit<HomeFixture, 'eventId'>

export type HomePublicBootstrapGraphQLResponse = {
	homePublicBootstrap: {
		context: HomeCoreEventContext
		fixtures: HomeGraphQLFixture[]
	}
}

export type HomePublicBootstrap = {
	context: HomeCoreEventContext
	fixtures: HomeFixture[]
}

export type HomeEventFixturesGraphQLResponse = {
	coreEventContext: Pick<HomeCoreEventContext, 'season' | 'revision'>
	eventFixtures: HomeGraphQLFixture[]
}

export type HomeFixturesResponse = {
	season: string
	revision: string
	eventId: number
	fixtures: HomeFixture[]
}

export type HomeGameweekPlayer = {
	id: number
	webName: string
	position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
	teamShortName: string
	totalPoints: number
}

export type HomeGameweekResponse = {
	gameweekDesk: {
		season: string
		coreRevision: string
		liveRevision: string | null
		eventId: number
		lifecycle: 'SCHEDULED' | 'PROVISIONAL' | 'SETTLED'
		overviewState: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
		boardsState: 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'
		overview: {
			highestPoints: number | null
			mostCaptained: {
				id: number
				webName: string
				teamShortName: string | null
			} | null
			topScorer: {
				id: number
				webName: string
				teamShortName: string | null
				points: number
			} | null
			mostPlayedChip: { name: string; numberPlayed: number } | null
		} | null
		dreamTeam: HomeGameweekPlayer[]
	}
	topTransfersIn: TopTransfer[]
	topTransfersOut: TopTransfer[]
}

export type HomeRankDirection = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN'

export type HomeLeagueRank = {
	key: string
	name: string
	rank: number | null
	movement: { direction: HomeRankDirection; places: number | null }
	tournamentId: number | null
}

export type HomePersonalDesk = {
	state: 'READY' | 'EMPTY' | 'STALE' | 'UNAVAILABLE'
	entryName: string | null
	playerName: string | null
	overallPoints: number | null
	overallRank: number | null
	teamValue: number | null
	leagueRanks: HomeLeagueRank[]
	sourceCheckedAt: string | null
}

export type HomePersonalDeskResponse = {
	homePersonalDesk: HomePersonalDesk
}

export type HomeMarketPulse = {
	coverage: MarketCoverage
	mostSelected: MarketPlayer[]
	ownershipMovers: {
		risers: MarketOwnershipMover[]
		fallers: MarketOwnershipMover[]
	}
	availabilityUpdates: MarketAvailabilityUpdate[]
	priceChanges: MarketPriceChange[]
}

export type HomeMarketPulseResponse = {
	homeMarketPulse: HomeMarketPulse
}
