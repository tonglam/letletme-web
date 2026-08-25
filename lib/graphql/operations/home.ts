import type { TopTransfer } from '@/lib/graphql/operations/prices'
import type {
	MarketAvailabilityUpdate,
	MarketCoverage,
	MarketOwnershipDay,
	MarketPlayer,
	MarketPriceChange
} from '@/lib/graphql/operations/market'

const HOME_FIXTURE_FIELDS = /* GraphQL */ `
	fragment HomeFixtureFields on Fixture {
		id
		finished
		started
		kickoffTime
		homeTeam {
			id
			name
			shortName
		}
		awayTeam {
			id
			name
			shortName
		}
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
			fixtures {
				...HomeFixtureFields
			}
		}
	}
	${HOME_FIXTURE_FIELDS}
`

export const GET_HOME_EVENT_FIXTURES = /* GraphQL */ `
	query GetHomeEventFixtures($eventId: Int!) {
		coreEventContext {
			season
			revision
			sourceCheckedAt
			currentEventId
			nextEventId
		}
		eventFixtures(eventId: $eventId) {
			...HomeFixtureFields
		}
	}
	${HOME_FIXTURE_FIELDS}
`

export const GET_HOME_GAMEWEEK = /* GraphQL */ `
	query GetHomeGameweek($eventId: Int!) {
		homeGameweek(eventId: $eventId) {
			transfersState
			gameweekDesk {
				season
				coreRevision
				liveRevision
				eventId
				lifecycle
				overviewState
				boardsState
				overview {
					highestPoints
					highestScoringEntry
					mostCaptained {
						id
						webName
						position
						teamShortName
					}
					topScorer {
						id
						webName
						position
						teamShortName
						points
					}
					mostPlayedChip {
						name
						numberPlayed
					}
				}
				dreamTeam {
					id
					webName
					position
					teamShortName
					totalPoints
				}
			}
			topTransfersIn {
				...HomeTransferFields
			}
			topTransfersOut {
				...HomeTransferFields
			}
		}
	}

	fragment HomeTransferFields on HomeTransferSignal {
		player {
			id
			webName
			position
			selectedByPercent
			totalPoints
			team {
				name
				shortName
			}
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
			region
			overallPoints
			pointsState
			pointsCheckedAt
			overallRank
			rankState
			rankCheckedAt
			teamValue
			bank
			leagueRanks {
				key
				name
				leagueType
				visibility
				rank
				rankState
				rankCheckedAt
				movement {
					direction
					places
				}
				tournamentId
				h2hMatchup {
					officialMatchId
					eventId
					isLive
					isFinal
					isBye
					sourceCheckedAt
					viewer {
						entryId
						entryName
						playerName
						isAverage
						points
					}
					opponent {
						entryId
						entryName
						playerName
						isAverage
						points
					}
				}
			}
			sourceCheckedAt
		}
	}
`

export const GET_HOME_MARKET_PULSE = /* GraphQL */ `
	query GetHomeMarketPulse($days: Int = 7) {
		homeMarketPulse(days: $days) {
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
				...HomeMarketPlayerFields
			}
			availabilityUpdates {
				player {
					...HomeMarketPlayerFields
				}
				status
				previousStatus
				news
				newsAdded
				observedDate
				chanceOfPlayingThisRound
				chanceOfPlayingNextRound
			}
			priceChanges {
				player {
					...HomeMarketPlayerFields
				}
				changeDate
				oldPrice
				newPrice
				change
				direction
			}
		}
	}

	fragment HomeMarketPlayerFields on MarketPlayer {
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

export const GET_HOME_MARKET_OWNERSHIP = /* GraphQL */ `
	query GetHomeMarketOwnership {
		marketOwnershipDay(limit: 5) {
			period
			date
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
					...HomeMarketPlayerFields
				}
				fromSelectedByPercent
				toSelectedByPercent
				changePercentagePoints
				fromDate
				toDate
			}
			fallers {
				player {
					...HomeMarketPlayerFields
				}
				fromSelectedByPercent
				toSelectedByPercent
				changePercentagePoints
				fromDate
				toDate
			}
		}
	}

	fragment HomeMarketPlayerFields on MarketPlayer {
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

export const GET_HOME_MARKET_DESK = /* GraphQL */ `
	query GetHomeMarketDesk {
		homeMarketDesk {
			revision
			capturedAt
			ownershipState
			ownership {
				period
				date
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
						...HomeMarketPlayerFields
					}
					fromSelectedByPercent
					toSelectedByPercent
					changePercentagePoints
					fromDate
					toDate
				}
				fallers {
					player {
						...HomeMarketPlayerFields
					}
					fromSelectedByPercent
					toSelectedByPercent
					changePercentagePoints
					fromDate
					toDate
				}
			}
			priceChangesState
			priceChanges {
				player {
					...HomeMarketPlayerFields
				}
				changeDate
				oldPrice
				newPrice
				change
				direction
			}
			availabilityState
			availabilityUpdates {
				player {
					...HomeMarketPlayerFields
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

	fragment HomeMarketPlayerFields on MarketPlayer {
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
	coreEventContext: Pick<
		HomeCoreEventContext,
		'season' | 'revision' | 'sourceCheckedAt' | 'currentEventId' | 'nextEventId'
	>
	eventFixtures: HomeGraphQLFixture[]
}

export type HomeFixtureSource = 'LIVE' | 'CORE'
export type HomeFixtureState =
	'LIVE' | 'SETTLED' | 'SCHEDULED' | 'CORE' | 'UNAVAILABLE'

export type HomeFixturesResponse = {
	season: string
	revision: string
	eventId: number
	source: HomeFixtureSource
	state: HomeFixtureState
	sourceCheckedAt: string | null
	publishedAt: string | null
	stale: boolean
	fixtures: HomeFixture[]
}

export type HomeGameweekPlayer = {
	id: number
	webName: string
	position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
	teamShortName: string
	totalPoints: number
}

type HomeGameweekOverviewPlayer = {
	id: number
	webName: string
	position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
	teamShortName: string | null
}

export type HomeGameweek = {
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
			highestScoringEntry: number | null
			mostCaptained: HomeGameweekOverviewPlayer | null
			topScorer:
				| (HomeGameweekOverviewPlayer & {
						points: number
				  })
				| null
			mostPlayedChip: { name: string; numberPlayed: number } | null
		} | null
		dreamTeam: HomeGameweekPlayer[]
	}
	topTransfersIn: TopTransfer[]
	topTransfersOut: TopTransfer[]
	transfersState: 'AVAILABLE' | 'UNAVAILABLE'
}

export type HomeGameweekResponse = {
	homeGameweek: HomeGameweek
}

export type HomeRankDirection = 'UP' | 'DOWN' | 'FLAT' | 'UNKNOWN'

export type HomeH2HMatchupSide = {
	entryId: number | null
	entryName: string | null
	playerName: string | null
	isAverage: boolean
	points: number | null
}

export type HomeH2HMatchup = {
	officialMatchId: number
	eventId: number
	isLive: boolean
	isFinal: boolean
	isBye: boolean
	viewer: HomeH2HMatchupSide
	opponent: HomeH2HMatchupSide
	sourceCheckedAt: string | null
}

export type HomeLeagueRank = {
	key: string
	name: string
	leagueType: 'CLASSIC' | 'H2H'
	visibility: 'PRIVATE' | 'PUBLIC'
	rank: number | null
	rankState: 'READY' | 'UPDATING' | 'UNAVAILABLE'
	rankCheckedAt: string | null
	movement: { direction: HomeRankDirection; places: number | null }
	tournamentId: number | null
	h2hMatchup: HomeH2HMatchup | null
}

export type HomePersonalDesk = {
	state: 'READY' | 'EMPTY' | 'STALE' | 'UNAVAILABLE'
	entryName: string | null
	playerName: string | null
	region: string | null
	overallPoints: number | null
	pointsState: 'LIVE' | 'STALE' | 'SETTLING' | 'FINAL' | 'UNAVAILABLE'
	pointsCheckedAt: string | null
	overallRank: number | null
	rankState: 'READY' | 'UPDATING' | 'UNAVAILABLE'
	rankCheckedAt: string | null
	teamValue: number | null
	bank: number | null
	leagueRanks: HomeLeagueRank[]
	sourceCheckedAt: string | null
}

export type HomePersonalDeskResponse = {
	homePersonalDesk: HomePersonalDesk
}

export type HomeMarketPulse = {
	coverage: MarketCoverage
	mostSelected: MarketPlayer[]
	availabilityUpdates: MarketAvailabilityUpdate[]
	priceChanges: MarketPriceChange[]
}

export type HomeMarketPulseResponse = {
	homeMarketPulse: HomeMarketPulse
}

export type HomeMarketOwnershipResponse = {
	marketOwnershipDay: MarketOwnershipDay
}

export type HomeMarketSectionState = 'AVAILABLE' | 'EMPTY' | 'UNAVAILABLE'

export type HomeMarketDesk = {
	revision: string
	capturedAt: string | null
	ownershipState: HomeMarketSectionState
	ownership: MarketOwnershipDay | null
	priceChangesState: HomeMarketSectionState
	priceChanges: MarketPriceChange[]
	availabilityState: HomeMarketSectionState
	availabilityUpdates: MarketAvailabilityUpdate[]
}

export type HomeMarketDeskResponse = {
	homeMarketDesk: HomeMarketDesk
}
