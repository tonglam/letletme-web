export const GET_PLAYER_DETAIL = `
  query GetPlayerDetail($playerId: Int!, $eventId: Int!) {
    playerDetail(playerId: $playerId, eventId: $eventId) {
      id webName teamShortName elementType elementTypeName
      price startPrice totalPoints
      selectedByPercent form seasonTransfersIn seasonTransfersOut
      transfersInEvent transfersOutEvent
      eventPoints minutes goalsScored assists cleanSheets goalsConceded
      ownGoals penaltiesSaved yellowCards redCards saves
      bonus bps influence creativity threat ictIndex
      fixtures { event againstTeamShortName wasHome finished kickoffTime score difficulty bgw }
    }
  }
`

export interface PlayerDetailFixture {
	event: number
	againstTeamShortName: string
	wasHome: boolean
	finished: boolean
	kickoffTime: string | null
	score: string | null
	difficulty: number
	bgw: boolean
}

export interface PlayerDetailData {
	id: number
	webName: string
	teamShortName: string
	elementType: number
	elementTypeName: string
	price: number
	startPrice: number
	totalPoints: number
	selectedByPercent?: number | null
	form: number | null
	seasonTransfersIn: number
	seasonTransfersOut: number
	transfersInEvent: number
	transfersOutEvent: number
	eventPoints: number | null
	minutes: number | null
	goalsScored: number | null
	assists: number | null
	cleanSheets: number | null
	goalsConceded: number | null
	ownGoals: number | null
	penaltiesSaved: number | null
	yellowCards: number | null
	redCards: number | null
	saves: number | null
	bonus: number | null
	bps: number | null
	influence: number
	creativity: number
	threat: number
	ictIndex: number
	fixtures: PlayerDetailFixture[]
}

export interface PlayerDetailResponse {
	playerDetail: PlayerDetailData | null
}

export const GET_PLAYER_STATE_PROFILE = /* GraphQL */ `
	query GetPlayerStateProfile($playerId: Int!, $horizon: Int = 5) {
		playerStateProfile(playerId: $playerId, horizon: $horizon) {
			playerId
			playerCode
			teamId
			position
			season
			horizon
			asOfEventId
			asOf
			trend
			confidence
			fplOnly
			dimensions {
				kind
				rating
				direction
				confidence
				reasonCodes
				metrics {
					code
					source
					value
					baseline
					percentile
					unit
					sampleMinutes
					sampleSize
					smallSample
					capability
				}
			}
			ownBaseline {
				weightedPercentile
				seasons {
					season
					minutes
					positionPercentile
					weight
					understatProcessPercentile
				}
			}
			peerBaseline {
				minimumMinutes
				cohortSize
				currentPercentile
			}
			careerTrajectory {
				season
				minutes
				fplPositionPercentile
				understatProcessPercentile
				expectedMetricsAvailable
			}
			outlook {
				rating
				horizon
				averageDifficulty
				gameweeks {
					eventId
					bgw
					dgw
					averageDifficulty
					fixtures {
						opponentTeamShortName
						wasHome
						difficulty
					}
				}
			}
			coverage {
				fplCurrent
				understatCurrent
				fplHistorySeasons
				understatHistorySeasons
				mappingStatus
				metricCoverage
				limitations
				providers {
					provider
					scope
					season
					asOf
					stale
					available
				}
			}
		}
	}
`

export type PlayerStateTrend =
	'RISING' | 'STABLE' | 'FALLING' | 'MIXED' | 'UNAVAILABLE' | 'UNKNOWN'

export type PlayerStateConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type PlayerStateDirection = 'RISING' | 'STABLE' | 'FALLING' | 'UNKNOWN'

export type PlayerStateDimensionKind =
	| 'AVAILABILITY_ROLE'
	| 'FPL_OUTPUT'
	| 'REAL_WORLD_PROCESS'
	| 'HISTORICAL_RELIABILITY'
	| 'OUTLOOK'

export type PlayerStateDimensionRating =
	| 'SECURE'
	| 'MANAGED'
	| 'AT_RISK'
	| 'STRONG'
	| 'TYPICAL'
	| 'WEAK'
	| 'PROVEN'
	| 'VARIABLE'
	| 'EMERGING'
	| 'INSUFFICIENT'
	| 'FAVOURABLE'
	| 'NEUTRAL'
	| 'DIFFICULT'
	| 'TEAM_CONTEXT_ONLY'
	| 'UNAVAILABLE'
	| 'UNKNOWN'

export type PlayerStateMetricSource =
	| 'FPL_CURRENT'
	| 'FPL_HISTORY'
	| 'UNDERSTAT_CURRENT'
	| 'UNDERSTAT_HISTORY'
	| 'DERIVED'

export type PlayerStateMappingStatus =
	'VERIFIED' | 'UNVERIFIED' | 'AMBIGUOUS' | 'QUARANTINED' | 'UNAVAILABLE'

export type PlayerStateProvider = 'FPL' | 'UNDERSTAT'
export type PlayerStateProviderScope = 'CURRENT' | 'HISTORY'

export interface PlayerStateMetric {
	code: string
	source: PlayerStateMetricSource
	value: number | null
	baseline: number | null
	percentile: number | null
	unit: string
	sampleMinutes: number | null
	sampleSize: number | null
	smallSample: boolean
	capability: boolean
}

export interface PlayerStateDimension {
	kind: PlayerStateDimensionKind
	rating: PlayerStateDimensionRating
	direction: PlayerStateDirection
	confidence: PlayerStateConfidence
	reasonCodes: string[]
	metrics: PlayerStateMetric[]
}

export interface PlayerStateBaselineSeason {
	season: string
	minutes: number
	positionPercentile: number | null
	weight: number
	understatProcessPercentile: number | null
}

export interface PlayerStateCareerPoint {
	season: string
	minutes: number
	fplPositionPercentile: number | null
	understatProcessPercentile: number | null
	expectedMetricsAvailable: boolean
}

export interface PlayerStateOutlookGameweek {
	eventId: number
	bgw: boolean
	dgw: boolean
	averageDifficulty: number | null
	fixtures: Array<{
		opponentTeamShortName: string
		wasHome: boolean
		difficulty: number
	}>
}

export interface PlayerStateProviderRevision {
	provider: PlayerStateProvider
	scope: PlayerStateProviderScope
	season: string
	asOf: string | null
	stale: boolean
	available: boolean
}

export interface PlayerStateProfileData {
	playerId: number
	playerCode: number
	teamId: number
	position: number
	season: string
	horizon: number
	asOfEventId: number | null
	asOf: string
	trend: PlayerStateTrend
	confidence: PlayerStateConfidence
	fplOnly: boolean
	dimensions: PlayerStateDimension[]
	ownBaseline: {
		weightedPercentile: number | null
		seasons: PlayerStateBaselineSeason[]
	}
	peerBaseline: {
		minimumMinutes: number
		cohortSize: number
		currentPercentile: number | null
	}
	careerTrajectory: PlayerStateCareerPoint[]
	outlook: {
		rating: PlayerStateDimensionRating
		horizon: number
		averageDifficulty: number | null
		gameweeks: PlayerStateOutlookGameweek[]
	}
	coverage: {
		fplCurrent: boolean
		understatCurrent: boolean
		fplHistorySeasons: string[]
		understatHistorySeasons: string[]
		mappingStatus: PlayerStateMappingStatus
		metricCoverage: string[]
		limitations: string[]
		providers: PlayerStateProviderRevision[]
	}
}

export interface PlayerStateProfileResponse {
	playerStateProfile: PlayerStateProfileData | null
}

// Query to fetch player values
export const GET_PLAYERS_FOR_PICKER = `
  query GetPlayersForPicker($filter: PlayersFilter, $limit: Int!, $offset: Int!) {
    players(filter: $filter, limit: $limit, offset: $offset) {
      id
      webName
      position
      team {
        id
        name
        shortName
      }
    }
  }
`

// Bounded name search for interactive pickers. Unlike `players`, this query is
// filtered before PostgreSQL returns rows and never downloads the full roster.
export const SEARCH_PLAYERS_FOR_PICKER = `
  query SearchPlayersForPicker($search: String!, $limit: Int = 20, $cursor: Int) {
    playersForPicker(search: $search, limit: $limit, cursor: $cursor) {
      items {
        id
        webName
        position
        team {
          id
          name
          shortName
        }
      }
      nextCursor
    }
  }
`

export const GET_TEAMS_FOR_PICKER = `
  query GetTeamsForPicker {
    teams {
      id
      name
      shortName
    }
  }
`

export type PlayerDirectoryPosition =
	'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'

export interface PlayerDirectoryItem {
	id: number
	webName: string
	position: PlayerDirectoryPosition
	team: {
		id: number
		name: string
		shortName: string
	}
}

export interface PlayersForPickerResponse {
	players: PlayerDirectoryItem[]
}

export interface PlayerSearchForPickerResponse {
	playersForPicker: {
		items: PlayerDirectoryItem[]
		nextCursor: number | null
	}
}

export interface TeamForPickerItem {
	id: number
	name: string
	shortName: string
}

export interface TeamsForPickerResponse {
	teams: TeamForPickerItem[]
}

// Query to fetch historical player value changes
