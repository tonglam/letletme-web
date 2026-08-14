/** Lightweight player identity for captain labels etc. */
export const GET_PLAYER_BASIC = `
  query GetPlayerBasic($id: Int!) {
    player(id: $id) {
      webName
      team {
        shortName
        name
      }
    }
  }
`

export interface PlayerBasicResponse {
	player: {
		webName: string
		team?: { shortName?: string | null; name?: string | null } | null
	} | null
}

export const GET_PLAYER_DETAIL = `
  query GetPlayerDetail($playerId: Int!, $eventId: Int!) {
    playerDetail(playerId: $playerId, eventId: $eventId) {
      id webName teamShortName elementType elementTypeName
      price startPrice
      statsContext { scope season asOfEventId }
      availability {
        status news newsAdded observedDate capturedAt
        chanceOfPlayingThisRound chanceOfPlayingNextRound stale
      }
      totalPoints
      selectedByPercent form seasonTransfersIn seasonTransfersOut
      transfersInEvent transfersOutEvent
      eventPoints minutes starts goalsScored assists cleanSheets goalsConceded
      ownGoals penaltiesSaved yellowCards redCards saves
      bonus bps
      expectedGoals expectedAssists expectedGoalInvolvements expectedGoalsConceded
      influence creativity threat ictIndex
      recentGameweeks {
        eventId provisional totalPoints minutes started
        goalsScored assists cleanSheets saves bonus bps
        opponents { teamShortName wasHome }
      }
      fixtures { id event againstTeamShortName wasHome finished kickoffTime score difficulty bgw }
    }
  }
`

/**
 * The first request for a selected player is intentionally small. Evidence
 * fields are requested only after the user opens an evidence view.
 */
export const GET_PLAYER_OVERALL = `
  query GetPlayerOverall($playerId: Int!, $eventId: Int!) {
    playerDetail(playerId: $playerId, eventId: $eventId) {
      id webName teamShortName elementType elementTypeName
      price startPrice
      statsContext { scope season asOfEventId }
      availability {
        status news newsAdded observedDate capturedAt
        chanceOfPlayingThisRound chanceOfPlayingNextRound stale
      }
      totalPoints selectedByPercent form transfersInEvent transfersOutEvent
      fixtures { id event againstTeamShortName wasHome finished kickoffTime score difficulty bgw }
    }
  }
`

/**
 * Full evidence is a second request and is cached per selected player. The
 * UI still reveals it one tab at a time while the resolver serves one bounded
 * PlayerDetail contract.
 */
export const GET_PLAYER_EVIDENCE = GET_PLAYER_DETAIL.replace(
	'GetPlayerDetail',
	'GetPlayerEvidence'
)

const PLAYER_EVIDENCE_IDENTITY = `
      id webName teamShortName elementType elementTypeName
      statsContext { scope season asOfEventId }
`

function playerEvidenceQuery(operationName: string, fields: string): string {
	return `
  query ${operationName}($playerId: Int!, $eventId: Int!) {
    playerDetail(playerId: $playerId, eventId: $eventId) {
      ${PLAYER_EVIDENCE_IDENTITY}
      ${fields}
    }
  }
`
}

export const GET_PLAYER_EVIDENCE_FIXTURES = playerEvidenceQuery(
	'GetPlayerEvidenceFixtures',
	`fixtures { id event againstTeamShortName wasHome finished kickoffTime score difficulty bgw }`
)

export const GET_PLAYER_EVIDENCE_RECENT = playerEvidenceQuery(
	'GetPlayerEvidenceRecent',
	`recentGameweeks {
        eventId provisional totalPoints minutes started
        goalsScored assists cleanSheets saves bonus bps
        opponents { teamShortName wasHome }
      }`
)

export const GET_PLAYER_EVIDENCE_PRODUCTION = playerEvidenceQuery(
	'GetPlayerEvidenceProduction',
	`totalPoints selectedByPercent form minutes starts goalsScored assists cleanSheets goalsConceded
      ownGoals penaltiesSaved yellowCards redCards saves bonus bps`
)

export const GET_PLAYER_EVIDENCE_PROCESS = playerEvidenceQuery(
	'GetPlayerEvidenceProcess',
	`expectedGoals expectedAssists expectedGoalInvolvements expectedGoalsConceded
      influence creativity threat ictIndex`
)

export type PlayerStatsScope =
	'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'UNAVAILABLE'

export interface PlayerStatsContext {
	scope: PlayerStatsScope
	season: string
	asOfEventId: number | null
}

export interface PlayerAvailability {
	status: string
	news: string
	newsAdded: string | null
	observedDate: string
	capturedAt: string
	chanceOfPlayingThisRound: number | null
	chanceOfPlayingNextRound: number | null
	stale: boolean
}

export interface PlayerRecentOpponent {
	teamShortName: string
	wasHome: boolean
}

export interface PlayerRecentGameweek {
	eventId: number
	provisional: boolean
	totalPoints: number
	minutes: number | null
	started: boolean | null
	goalsScored: number | null
	assists: number | null
	cleanSheets: number | null
	saves: number | null
	bonus: number | null
	bps: number | null
	opponents: PlayerRecentOpponent[]
}

export interface PlayerDetailFixture {
	id: number
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
	statsContext: PlayerStatsContext
	availability: PlayerAvailability | null
	totalPoints: number | null
	selectedByPercent?: number | null
	form: number | null
	seasonTransfersIn: number | null
	seasonTransfersOut: number | null
	transfersInEvent: number | null
	transfersOutEvent: number | null
	eventPoints: number | null
	minutes: number | null
	starts: number | null
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
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
	influence: number | null
	creativity: number | null
	threat: number | null
	ictIndex: number | null
	recentGameweeks: PlayerRecentGameweek[]
	fixtures: PlayerDetailFixture[]
}

export interface PlayerDetailResponse {
	playerDetail: PlayerDetailData | null
}

export const GET_PLAYER_STATE_PROFILE = `
  query GetPlayerStateProfile($playerId: Int!, $horizon: Int = 5) {
    playerStateProfile(playerId: $playerId, horizon: $horizon) {
	      playerId teamId position season horizon asOfEventId asOf
	      trend confidence fplOnly
	      reasons { code dimension current baseline percentile }
	      profileRadar {
	        source position season asOfEventId sampleMinutes smallSample
	        axes { code value percentile unit direction sampleMinutes available capability reasonCode }
	      }
	      dimensions {
		        kind rating direction confidence reasonCodes
		        metrics {
		          code source value baseline percentile unit season
		          sampleMinutes sampleSize smallSample capability
		        }
		      }
	      outlook {
	        rating horizon averageDifficulty
	        gameweeks {
	          eventId bgw dgw averageDifficulty
	          fixtures { id opponentTeamShortName wasHome difficulty kickoffTime }
	        }
	      }
	      coverage {
	        fplCurrent understatCurrent
	        fplHistorySeasons understatHistorySeasons
	        mappingStatus metricCoverage limitations
	      }
	    }
	  }
`

/**
 * History and provider revisions are behind the supporting-data disclosure.
 * Keeping them separate leaves both documents below GraphQL's 200-node guard
 * and avoids transferring the low-frequency context until it is requested.
 */
export const GET_PLAYER_STATE_CONTEXT = `
  query GetPlayerStateContext($playerId: Int!, $horizon: Int = 5) {
    playerStateProfile(playerId: $playerId, horizon: $horizon) {
      playerId
      ownBaseline {
        weightedPercentile
        seasons { season positionPercentile weight }
      }
      peerBaseline { position minimumMinutes cohortSize currentPercentile }
      careerTrajectory {
        season position minutes fplPositionPercentile understatProcessPercentile expectedMetricsAvailable
      }
      coverage {
        providers {
          provider scope season revision asOf freshnessSeconds stale available
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

export interface PlayerStateMetric {
	code: string
	source?:
		| 'FPL_CURRENT'
		| 'FPL_HISTORY'
		| 'UNDERSTAT_CURRENT'
		| 'UNDERSTAT_HISTORY'
		| 'DERIVED'
	value: number | null
	baseline?: number | null
	percentile?: number | null
	unit: string
	season?: string | null
	sampleMinutes?: number | null
	sampleSize?: number | null
	smallSample?: boolean
	capability?: boolean
}

export interface PlayerStateReason {
	code: string
	dimension?: PlayerStateDimensionKind
	current?: number | null
	baseline?: number | null
	percentile?: number | null
}

export interface PlayerStateDimension {
	kind: PlayerStateDimensionKind
	rating: PlayerStateDimensionRating
	direction: PlayerStateDirection
	confidence?: PlayerStateConfidence
	reasonCodes: string[]
	metrics: PlayerStateMetric[]
}

export type PlayerRadarAxis = {
	code: string
	value: number | null
	percentile: number | null
	unit: string
	direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER' | 'NEUTRAL'
	sampleMinutes: number | null
	available: boolean
	capability: boolean
	reasonCode?: string | null
}

export type PlayerRadarProfile = {
	source: 'FPL'
	position: number
	season: string
	asOfEventId: number | null
	sampleMinutes: number
	smallSample: boolean
	axes: PlayerRadarAxis[]
}

export interface PlayerStateOutlookGameweek {
	eventId: number
	bgw: boolean
	dgw: boolean
	averageDifficulty?: number | null
	fixtures: Array<{
		id: number
		opponentTeamShortName: string
		wasHome?: boolean
		difficulty: number
		kickoffTime?: string | null
	}>
}

export interface PlayerStateBaselineSeason {
	season: string
	positionPercentile: number | null
	weight: number
}

export type PlayerStateMappingStatus =
	'VERIFIED' | 'UNVERIFIED' | 'AMBIGUOUS' | 'QUARANTINED' | 'UNAVAILABLE'

export type PlayerStateProvider = 'FPL' | 'UNDERSTAT'
export type PlayerStateProviderScope = 'CURRENT' | 'HISTORY'

export interface PlayerStateProviderRevision {
	provider: PlayerStateProvider
	scope: PlayerStateProviderScope
	season: string
	revision: string | null
	asOf: string | null
	freshnessSeconds: number | null
	stale: boolean
	available: boolean
}

export interface PlayerStateProfileData {
	playerId: number
	teamId: number
	position: number
	season: string
	horizon: number
	asOfEventId: number | null
	asOf: string
	trend: PlayerStateTrend
	confidence: PlayerStateConfidence
	fplOnly: boolean
	reasons: PlayerStateReason[]
	profileRadar: PlayerRadarProfile | null
	dimensions: PlayerStateDimension[]
	ownBaseline: {
		weightedPercentile: number | null
		seasons: PlayerStateBaselineSeason[]
	}
	peerBaseline: {
		position?: number
		minimumMinutes: number
		cohortSize?: number
		currentPercentile: number | null
	}
	careerTrajectory: Array<{
		season: string
		position?: number
		minutes?: number
		fplPositionPercentile: number | null
		understatProcessPercentile: number | null
		expectedMetricsAvailable?: boolean
	}>
	outlook: {
		rating: PlayerStateDimensionRating
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

export type PlayerStateProfileCoreData = Omit<
	PlayerStateProfileData,
	'ownBaseline' | 'peerBaseline' | 'careerTrajectory' | 'coverage'
> & {
	coverage: Omit<PlayerStateProfileData['coverage'], 'providers'>
}

/**
 * The first desk response contains only the fields rendered above the
 * supporting-data disclosures. The hook expands this into the stable client
 * shape with explicit empty values, then merges lazy sections as they arrive.
 */
export type PlayerStateOverviewData = Pick<
	PlayerStateProfileData,
	| 'playerId'
	| 'teamId'
	| 'position'
	| 'season'
	| 'horizon'
	| 'asOfEventId'
	| 'asOf'
	| 'trend'
	| 'confidence'
	| 'fplOnly'
> & {
	reasons: Array<Pick<PlayerStateReason, 'code'>>
	profileRadar:
		| (Pick<PlayerRadarProfile, 'position' | 'season' | 'asOfEventId'> & {
				axes: Array<
					Pick<
						PlayerRadarAxis,
						'code' | 'value' | 'percentile' | 'unit' | 'available'
					>
				>
		  })
		| null
	dimensions: Array<
		Pick<
			PlayerStateDimension,
			'kind' | 'rating' | 'direction' | 'confidence' | 'reasonCodes'
		>
	>
}

export type PlayerStateProcessData = Pick<
	PlayerStateProfileData,
	'playerId'
> & {
	dimensions: PlayerStateDimension[]
	coverage: Pick<
		PlayerStateProfileData['coverage'],
		'understatCurrent' | 'mappingStatus' | 'metricCoverage' | 'limitations'
	>
}

export type PlayerStateContextData = Pick<
	PlayerStateProfileData,
	'playerId' | 'ownBaseline' | 'peerBaseline' | 'careerTrajectory'
> & {
	coverage: Pick<PlayerStateProfileData['coverage'], 'providers'>
}

export interface PlayerStateProfileResponse {
	playerStateProfile: PlayerStateProfileCoreData | null
}

export interface PlayerStateContextResponse {
	playerStateProfile: PlayerStateContextData | null
}

export type PlayerStatsDeskSection =
	'overview' | 'context' | 'recent' | 'production' | 'process'

export type PlayerStatsDeskEntryData = {
	playerId: number
	overview?: PlayerDetailData | null
	state?:
		| PlayerStateOverviewData
		| PlayerStateProfileCoreData
		| PlayerStateContextData
		| PlayerStateProcessData
		| null
	evidence?: Partial<PlayerDetailData> | null
}

export type PlayerStatsDeskPayloadData = {
	eventId: number
	horizon: number
	entries: PlayerStatsDeskEntryData[]
}

export interface PlayerStatsDeskGraphQLResponse {
	playerStatsDesk: PlayerStatsDeskPayloadData
}

const PLAYER_STATS_DESK_VARIABLES = `
  ($playerIds: [Int!]!, $eventId: Int!, $horizon: Int = 5)
`

const PLAYER_STATS_DESK_ARGUMENTS = `
  (playerIds: $playerIds, eventId: $eventId, horizon: $horizon)
`

export const GET_PLAYER_STATS_DESK_OVERVIEW = /* GraphQL */ `
  query GetPlayerStatsDeskOverview ${PLAYER_STATS_DESK_VARIABLES} {
    playerStatsDesk ${PLAYER_STATS_DESK_ARGUMENTS} {
      eventId horizon
      entries {
        playerId
        overview {
          id webName teamShortName elementType elementTypeName
          price startPrice
          statsContext { scope season asOfEventId }
          availability {
            status news newsAdded observedDate capturedAt
            chanceOfPlayingThisRound chanceOfPlayingNextRound stale
          }
          totalPoints selectedByPercent form transfersInEvent transfersOutEvent
          fixtures { id event againstTeamShortName wasHome finished kickoffTime score difficulty bgw }
        }
        state {
          playerId teamId position season horizon asOfEventId asOf
          trend confidence fplOnly
          reasons { code }
          profileRadar {
            position season asOfEventId
            axes { code value percentile unit available }
          }
          dimensions {
            kind rating direction confidence reasonCodes
          }
        }
      }
    }
  }
`

export const GET_PLAYER_STATS_DESK_CONTEXT = /* GraphQL */ `
  query GetPlayerStatsDeskContext ${PLAYER_STATS_DESK_VARIABLES} {
    playerStatsDesk ${PLAYER_STATS_DESK_ARGUMENTS} {
      eventId horizon
      entries {
        playerId
        state {
          playerId
          ownBaseline {
            weightedPercentile
            seasons { season positionPercentile weight }
          }
          peerBaseline { position minimumMinutes cohortSize currentPercentile }
          careerTrajectory {
            season position minutes fplPositionPercentile understatProcessPercentile expectedMetricsAvailable
          }
          coverage {
            fplCurrent understatCurrent
            fplHistorySeasons understatHistorySeasons
            mappingStatus metricCoverage limitations
            providers {
              provider scope season revision asOf freshnessSeconds stale available
            }
          }
        }
      }
    }
  }
`

function playerStatsDeskEvidenceQuery(
	operationName: string,
	fields: string
): string {
	return `
  query ${operationName} ${PLAYER_STATS_DESK_VARIABLES} {
    playerStatsDesk ${PLAYER_STATS_DESK_ARGUMENTS} {
      eventId horizon
      entries {
        playerId
        evidence {
          id webName teamShortName elementType elementTypeName
          statsContext { scope season asOfEventId }
          ${fields}
        }
      }
    }
  }
`
}

export const GET_PLAYER_STATS_DESK_RECENT = playerStatsDeskEvidenceQuery(
	'GetPlayerStatsDeskRecent',
	`recentGameweeks {
    eventId provisional totalPoints minutes started
    goalsScored assists cleanSheets saves bonus bps
    opponents { teamShortName wasHome }
  }`
)

export const GET_PLAYER_STATS_DESK_PRODUCTION = playerStatsDeskEvidenceQuery(
	'GetPlayerStatsDeskProduction',
	`totalPoints selectedByPercent form minutes starts goalsScored assists cleanSheets goalsConceded
  ownGoals penaltiesSaved yellowCards redCards saves bonus bps`
)

export const GET_PLAYER_STATS_DESK_PROCESS = /* GraphQL */ `
  query GetPlayerStatsDeskProcess ${PLAYER_STATS_DESK_VARIABLES} {
    playerStatsDesk ${PLAYER_STATS_DESK_ARGUMENTS} {
      eventId horizon
      entries {
        playerId
        evidence {
          id webName teamShortName elementType elementTypeName
          statsContext { scope season asOfEventId }
          expectedGoals expectedAssists expectedGoalInvolvements expectedGoalsConceded
          influence creativity threat ictIndex
        }
        state {
          playerId
          dimensions {
            kind rating direction confidence reasonCodes
            metrics {
              code source value baseline percentile unit season
              sampleMinutes sampleSize smallSample capability
            }
          }
          coverage {
            understatCurrent mappingStatus metricCoverage limitations
          }
        }
      }
    }
  }
`

export const PLAYER_STATS_DESK_QUERIES: Record<PlayerStatsDeskSection, string> =
	{
		overview: GET_PLAYER_STATS_DESK_OVERVIEW,
		context: GET_PLAYER_STATS_DESK_CONTEXT,
		recent: GET_PLAYER_STATS_DESK_RECENT,
		production: GET_PLAYER_STATS_DESK_PRODUCTION,
		process: GET_PLAYER_STATS_DESK_PROCESS
	}

// Query to fetch player values
export const GET_PLAYERS_FOR_PICKER = `
  query GetPlayersForPicker($filter: PlayersFilter, $limit: Int!, $offset: Int!) {
    players(filter: $filter, limit: $limit, offset: $offset) {
      id
      webName
      position
      price
      selectedByPercent
      totalPoints
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
  query SearchPlayersForPicker($search: String, $filter: PlayersFilter, $sort: PlayerPickerSort = TOTAL_POINTS_DESC, $ownershipBand: PlayerPickerOwnershipBand, $limit: Int = 20, $cursor: Int) {
    playersForPicker(search: $search, filter: $filter, sort: $sort, ownershipBand: $ownershipBand, limit: $limit, cursor: $cursor) {
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

export const GET_TEAMS_FOR_PICKER = `
  query GetTeamsForPicker {
    teams {
      id
      name
      shortName
    }
  }
`

export const GET_PLAYER_STATS_BOOTSTRAP = /* GraphQL */ `
	query GetPlayerStatsBootstrap($limit: Int = 20) {
		playerStatsBootstrap(limit: $limit) {
			context {
				season
				revision
				sourceCheckedAt
				currentEventId
				nextEventId
				nextDeadlineTime
				latestFinishedEventId
			}
			teams {
				id
				name
				shortName
			}
			directory {
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
	}
`

export type CoreEventContextData = {
	season: string
	revision: string
	sourceCheckedAt: string
	currentEventId: number | null
	nextEventId: number | null
	nextDeadlineTime: string | null
	latestFinishedEventId: number | null
}

export type PlayerStatsBootstrapData = {
	context: CoreEventContextData
	teams: TeamForPickerItem[]
	directory: PlayerSearchForPickerResponse['playersForPicker']
}

export interface PlayerStatsBootstrapResponse {
	playerStatsBootstrap: PlayerStatsBootstrapData
}

export type PlayerDirectoryPosition =
	'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'

export interface PlayerDirectoryItem {
	id: number
	webName: string
	position: PlayerDirectoryPosition
	price: number
	selectedByPercent?: number | null
	totalPoints?: number | null
	form?: number | null
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
		totalCount: number
		nextCursor: number | null
	}
}

export type PlayerPickerOwnershipBand =
	'LE5' | 'GT5_LE15' | 'GT15_LE40' | 'GT40'

export interface TeamForPickerItem {
	id: number
	name: string
	shortName: string
}

export interface TeamsForPickerResponse {
	teams: TeamForPickerItem[]
}

// Query to fetch historical player value changes
