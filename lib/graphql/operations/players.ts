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
			statsContext { scope season asOfEventId status }
	  injuryAvailability {
		status news newsAdded observedDate capturedAt
		chanceOfPlayingThisRound chanceOfPlayingNextRound stale
	  }
	  dataAvailability {
	    isFullyAuthoritative
	    seasonStats { state reasonCode revision sourceCheckedAt }
	    market { state reasonCode revision sourceCheckedAt }
	    historicalTeam { state reasonCode revision sourceCheckedAt }
	    fixtures { state reasonCode revision sourceCheckedAt }
	    recentGameweeks { state reasonCode revision sourceCheckedAt }
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

export const GET_PLAYER_START_PRICE = /* GraphQL */ `
	query GetPlayerStartPrice($playerId: Int!, $eventId: Int!) {
		playerDetail(playerId: $playerId, eventId: $eventId) {
			id
			startPrice
		}
	}
`

export interface PlayerStartPriceResponse {
	playerDetail: {
		id: number
		startPrice: number | null
	} | null
}

/**
 * The first request for a selected player is intentionally small. Evidence
 * fields are requested only after the user opens an evidence view.
 */
export const GET_PLAYER_OVERALL = `
  query GetPlayerOverall($playerId: Int!, $eventId: Int!) {
    playerDetail(playerId: $playerId, eventId: $eventId) {
      id webName teamShortName elementType elementTypeName
      price startPrice
			statsContext { scope season asOfEventId status }
      injuryAvailability {
        status news newsAdded observedDate capturedAt
        chanceOfPlayingThisRound chanceOfPlayingNextRound stale
      }
      dataAvailability {
        isFullyAuthoritative
		seasonStats { state reasonCode revision sourceCheckedAt }
        market { state reasonCode revision sourceCheckedAt }
        historicalTeam { state reasonCode revision sourceCheckedAt }
        fixtures { state reasonCode revision sourceCheckedAt }
        recentGameweeks { state reasonCode revision sourceCheckedAt }
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
			statsContext { scope season asOfEventId status }
      injuryAvailability {
        status news newsAdded observedDate capturedAt
        chanceOfPlayingThisRound chanceOfPlayingNextRound stale
      }
      dataAvailability {
        isFullyAuthoritative
		seasonStats { state reasonCode revision sourceCheckedAt }
        market { state reasonCode revision sourceCheckedAt }
        historicalTeam { state reasonCode revision sourceCheckedAt }
        fixtures { state reasonCode revision sourceCheckedAt }
        recentGameweeks { state reasonCode revision sourceCheckedAt }
      }
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

export type PlayerStatsSnapshotStatus =
	'AVAILABLE' | 'PRESEASON' | 'STALE' | 'INCOMPLETE' | 'UNAVAILABLE'

export interface PlayerStatsContext {
	scope: PlayerStatsScope
	season: string
	asOfEventId?: number | null
	status: PlayerStatsSnapshotStatus
	revision: string | null
	sourceCheckedAt: string | null
	publishedAt: string | null
	rowCount: number
	expectedRowCount: number
}

export interface PlayerAvailability {
	status: string
	news?: string
	newsAdded?: string | null
	observedDate?: string
	capturedAt?: string | null
	chanceOfPlayingThisRound?: number | null
	chanceOfPlayingNextRound?: number | null
	stale?: boolean
}

export type PlayerDataState =
	'READY' | 'EMPTY' | 'STALE' | 'FALLBACK' | 'UNAVAILABLE' | 'NOT_APPLICABLE'

export interface PlayerDataSectionAvailability {
	state: PlayerDataState
	reasonCode?: string | null
	revision?: string | null
	sourceCheckedAt?: string | null
}

export interface PlayerDetailDataAvailability {
	isFullyAuthoritative: boolean
	seasonStats: PlayerDataSectionAvailability
	market: PlayerDataSectionAvailability
	historicalTeam: PlayerDataSectionAvailability
	fixtures: PlayerDataSectionAvailability
	recentGameweeks: PlayerDataSectionAvailability
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
	kickoffTime?: string | null
	score?: string | null
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
	startPrice?: number | null
	statsContext: PlayerStatsContext
	injuryAvailability: PlayerAvailability | null
	dataAvailability: PlayerDetailDataAvailability
	totalPoints?: number | null
	selectedByPercent?: number | null
	form?: number | null
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
	      trend confidence providerMode
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
	        sources {
	          provider scope seasons dataStatus analysisStatus mappingStatus
	          reasonCodes revision asOf freshnessSeconds stale
	        }
	        metricCoverage limitations
	      }
	      seasonTimeline {
	        season phase position fplTotalPoints
	        signals { code provider value unit sampleMinutes analysisStatus reasonCodes }
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
	  coverage {
	    sources {
	      provider scope seasons dataStatus analysisStatus mappingStatus
	      reasonCodes revision asOf freshnessSeconds stale
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
	| 'VERIFIED'
	| 'UNVERIFIED'
	| 'AMBIGUOUS'
	| 'QUARANTINED'
	| 'UNAVAILABLE'
	| 'NOT_APPLICABLE'

export type PlayerStateProvider = 'FPL' | 'UNDERSTAT'
export type PlayerStateProviderScope = 'CURRENT' | 'HISTORY'
export type PlayerStateDataStatus = 'AVAILABLE' | 'UNAVAILABLE'
export type PlayerStateAnalysisStatus =
	'READY' | 'PRESEASON' | 'INSUFFICIENT' | 'NOT_APPLICABLE' | 'UNAVAILABLE'
export type PlayerStateProviderMode =
	'FPL_ONLY' | 'FPL_WITH_UNDERSTAT_HISTORY' | 'FPL_WITH_UNDERSTAT_CURRENT'

export type PlayerSeasonPhase = 'PRESEASON' | 'ACTIVE' | 'COMPLETED'
export type PlayerSeasonSignalCode =
	| 'UNDERSTAT_NPXG_PER_90'
	| 'UNDERSTAT_XA_PER_90'
	| 'UNDERSTAT_NPXG_XA_PER_90'
	| 'UNDERSTAT_KEY_PASSES_PER_90'
	| 'OFFICIAL_CLEAN_SHEET_RATE'
	| 'OFFICIAL_SAVES_PER_90'

export interface PlayerSeasonSignal {
	code: PlayerSeasonSignalCode
	provider: PlayerStateProvider
	value: number | null
	unit: string
	sampleMinutes: number | null
	analysisStatus: PlayerStateAnalysisStatus
	reasonCodes: string[]
}

/** The overview request keeps the first paint below the GraphQL node guard.
 * Provider and sample-size metadata remain available in the full profile
 * document; the ledger only needs the display/status fields below. */
type PlayerStateOverviewSignal = Omit<
	PlayerSeasonSignal,
	'provider' | 'sampleMinutes'
>

type PlayerStateOverviewTimelinePoint = Omit<
	PlayerSeasonTimelinePoint,
	'signals'
> & {
	signals: PlayerStateOverviewSignal[]
}

export interface PlayerSeasonTimelinePoint {
	season: string
	phase: PlayerSeasonPhase
	position: number
	fplTotalPoints: number | null
	signals: PlayerSeasonSignal[]
}

export interface PlayerStateSourceCoverage {
	provider: PlayerStateProvider
	scope: PlayerStateProviderScope
	seasons: string[]
	dataStatus: PlayerStateDataStatus
	analysisStatus: PlayerStateAnalysisStatus
	mappingStatus: PlayerStateMappingStatus
	reasonCodes: string[]
	revision: string | null
	asOf: string | null
	freshnessSeconds: number | null
	stale: boolean
}

export type PlayerStateProviderRevision = PlayerStateSourceCoverage

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
	providerMode: PlayerStateProviderMode
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
		sources: PlayerStateSourceCoverage[]
		metricCoverage: string[]
		limitations: string[]
	}
	seasonTimeline: PlayerSeasonTimelinePoint[] | null
}

export type PlayerStateProfileCoreData = Omit<
	PlayerStateProfileData,
	'ownBaseline' | 'peerBaseline' | 'careerTrajectory' | 'coverage'
> & {
	coverage: PlayerStateProfileData['coverage']
}

type PlayerStateOverviewSource = Pick<
	PlayerStateSourceCoverage,
	'provider' | 'scope' | 'dataStatus' | 'mappingStatus'
>

/**
 * The first desk response contains only the fields rendered above the
 * supporting-data disclosures. The hook expands this into the stable client
 * shape with explicit empty values, then merges lazy sections as they arrive.
 */
export type PlayerStateOverviewData = Pick<
	PlayerStateProfileData,
	| 'playerId'
	| 'teamId'
	| 'season'
	| 'horizon'
	| 'asOfEventId'
	| 'asOf'
	| 'trend'
	| 'confidence'
	| 'providerMode'
> & {
	reasons: Array<Pick<PlayerStateReason, 'code'>>
	profileRadar:
		| (Pick<PlayerRadarProfile, 'sampleMinutes' | 'smallSample'> & {
				axes: Array<
					Pick<
						PlayerRadarAxis,
						'code' | 'value' | 'percentile' | 'unit' | 'available'
					>
				>
		  })
		| null
	coverage: { sources: PlayerStateOverviewSource[] }
	dimensions: Array<
		Pick<
			PlayerStateDimension,
			'kind' | 'rating' | 'direction' | 'confidence' | 'reasonCodes'
		>
	>
	seasonTimeline?: PlayerStateOverviewTimelinePoint[] | null
}

export type PlayerStateProcessData = Pick<
	PlayerStateProfileData,
	'playerId'
> & {
	dimensions: PlayerStateDimension[]
	coverage: Pick<
		PlayerStateProfileData['coverage'],
		'sources' | 'metricCoverage' | 'limitations'
	>
}

export type PlayerStateContextData = Pick<
	PlayerStateProfileData,
	'playerId'
> & {
	coverage: Pick<PlayerStateProfileData['coverage'], 'sources'>
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
	overview?: PlayerStatsDeskFieldResult<PlayerDetailData> | null
	state?: PlayerStatsDeskFieldResult<
		| PlayerStateOverviewData
		| PlayerStateProfileCoreData
		| PlayerStateContextData
		| PlayerStateProcessData
	> | null
	evidence?: PlayerStatsDeskFieldResult<Partial<PlayerDetailData>> | null
}

export type PlayerStatsDeskFieldStatus =
	'AVAILABLE' | 'NOT_FOUND' | 'TEMPORARILY_UNAVAILABLE'

export type PlayerStatsDeskFieldResult<T> = {
	status: PlayerStatsDeskFieldStatus
	value: T | null
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

// GraphQL grants only this fixed, maximum-two-player desk root a scoped AST
// allowance above the generic 200-node ceiling. Keep Web's exact documents
// bound to the same admission contract.
export const PLAYER_STATS_DESK_MAX_AST_NODES = 280

export const GET_PLAYER_STATS_DESK_OVERVIEW = /* GraphQL */ `
  query GetPlayerStatsDeskOverview ${PLAYER_STATS_DESK_VARIABLES} {
    playerStatsDesk ${PLAYER_STATS_DESK_ARGUMENTS} {
      eventId horizon
	entries {
		playerId
		overview {
			status
			value {
				id webName teamShortName elementType elementTypeName
				price
				statsContext { season status }
				injuryAvailability {
					status news newsAdded observedDate capturedAt
					chanceOfPlayingThisRound chanceOfPlayingNextRound stale
				}
				dataAvailability {
					isFullyAuthoritative
					seasonStats { state reasonCode revision sourceCheckedAt }
					market { state reasonCode revision sourceCheckedAt }
					historicalTeam { state reasonCode revision sourceCheckedAt }
					fixtures { state reasonCode revision sourceCheckedAt }
					recentGameweeks { state reasonCode revision sourceCheckedAt }
				}
				totalPoints selectedByPercent transfersInEvent transfersOutEvent
				fixtures { id event againstTeamShortName wasHome finished difficulty bgw }
			}
        }
        state {
          status
			value {
				playerId teamId season horizon asOf asOfEventId
            trend confidence providerMode
            reasons { code }
			profileRadar {
				sampleMinutes smallSample
              axes { code value percentile unit available }
            }
            coverage {
              sources {
                provider scope dataStatus mappingStatus
              }
            }
            dimensions {
              kind rating direction reasonCodes
            }
            seasonTimeline {
              season phase position fplTotalPoints
              signals { code value unit analysisStatus reasonCodes }
            }
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
          status
          value {
            playerId
            coverage {
              sources {
                provider scope seasons dataStatus analysisStatus mappingStatus
                reasonCodes revision asOf freshnessSeconds stale
              }
              metricCoverage limitations
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
          status
			value {
				id webName teamShortName elementType elementTypeName
				statsContext { scope season asOfEventId status }
				dataAvailability {
					isFullyAuthoritative
					seasonStats { state reasonCode revision sourceCheckedAt }
					market { state reasonCode revision sourceCheckedAt }
					historicalTeam { state reasonCode revision sourceCheckedAt }
					fixtures { state reasonCode revision sourceCheckedAt }
					recentGameweeks { state reasonCode revision sourceCheckedAt }
				}
				${fields}
          }
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
	          status
	          value {
	            id webName teamShortName elementType elementTypeName
				statsContext { scope season asOfEventId status }
				dataAvailability {
					isFullyAuthoritative
					seasonStats { state reasonCode revision sourceCheckedAt }
					market { state reasonCode revision sourceCheckedAt }
					historicalTeam { state reasonCode revision sourceCheckedAt }
					fixtures { state reasonCode revision sourceCheckedAt }
					recentGameweeks { state reasonCode revision sourceCheckedAt }
				}
	            expectedGoals expectedAssists expectedGoalInvolvements expectedGoalsConceded
	            influence creativity threat ictIndex
          }
        }
        state {
          status
          value {
            playerId
            dimensions {
              kind rating direction confidence reasonCodes
              metrics {
                code source value baseline percentile unit season
                sampleMinutes sampleSize smallSample capability
              }
            }
            coverage {
              sources {
                provider scope seasons dataStatus analysisStatus mappingStatus reasonCodes
                revision asOf freshnessSeconds stale
              }
              metricCoverage limitations
            }
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
			statsContext {
				status
				revision
				sourceCheckedAt
				publishedAt
				rowCount
				expectedRowCount
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
	statsContext: Pick<
		PlayerStatsContext,
		| 'status'
		| 'revision'
		| 'sourceCheckedAt'
		| 'publishedAt'
		| 'rowCount'
		| 'expectedRowCount'
	>
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
