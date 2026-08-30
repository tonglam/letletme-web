import type { CoreEventContextData } from '@/lib/graphql/operations/events'

export const GET_LIVE_SCORES = `
  query GetLiveScores($eventId: Int!) {
    liveScores(eventId: $eventId, filter: { inDreamTeam: true }) {
      player {
        id
        webName
        position
        price
        team {
          name
          shortName
        }
      }
      inDreamTeam
      minutes
      goalsScored
      assists
      cleanSheets
      bonus
      totalPoints
    }
  }
`

// Type for live score player
export interface LiveScorePlayer {
	id: number
	webName: string
	position?: string // Should be "GKP", "DEF", "MID", or "FWD"
	price?: number
	team?: {
		name?: string
		shortName?: string
	}
}

// Type for live score entry
export interface LiveScore {
	player: LiveScorePlayer
	inDreamTeam: boolean
	minutes?: number | null
	goalsScored?: number | null
	assists?: number | null
	cleanSheets?: number | null
	bonus?: number | null
	totalPoints: number
}

// Type for live scores response
export interface LiveScoresResponse {
	liveScores: LiveScore[]
}

export const GET_GAMEWEEK_BOARDS = `
  query GetGameweekBoards($eventId: Int!) {
    event(id: $eventId) {
      id
      deadlineTime
      finished
      isCurrent
      isNext
    }
    dreamTeam: liveScores(eventId: $eventId, filter: { inDreamTeam: true }) {
      player {
        id
        webName
        position
        price
        team {
          name
          shortName
        }
      }
      inDreamTeam
      minutes
      goalsScored
      assists
      cleanSheets
      bonus
      totalPoints
    }
    hauls: liveScores(eventId: $eventId, filter: { minTotalPoints: 10 }) {
      player {
        id
        webName
        position
        price
        team {
          name
          shortName
        }
      }
      inDreamTeam
      minutes
      goalsScored
      assists
      cleanSheets
      bonus
      totalPoints
    }
    liveSnapshot(eventId: $eventId) {
		season
      eventId
      state
		revisions {
			publicationId
			generation
			lifecycle
			fixtureIdentity
			scoreCore
			displayStats
			explain
			picksBase
			officialAdjustment
			previousTotals
			finalResult
			rules
			algorithm
			input
		}
		times {
			sourceCheckedAt
			contentUpdatedAt
			publishedAt
			checkpointedAt
			servedAt
			staleAt
			nextRefreshAt
		}
		delivery { state servedFrom reasonCodes }
    }
  }
`

export interface GameweekBoardEvent {
	id: number
	deadlineTime: string | null
	finished: boolean
	isCurrent: boolean
	isNext: boolean
}

export interface GameweekBoardsResponse {
	event: GameweekBoardEvent | null
	dreamTeam: LiveScore[]
	hauls: LiveScore[]
	liveSnapshot: LiveSnapshotStatus | null
}

export const GET_LIVE_POINTS = `
  query GetLiveCalcPoints($eventId: Int!, $entryId: Int!) {
    calcLivePointsByEntry(eventId: $eventId, entryId: $entryId) {
      entry
      event
      availability
      entryName
      playerName
      chip
      score {
        eventPoints
        netEventPoints
        totalPoints
        totalScope
        transferCost
        source
		calculationMode
		revisions {
			publicationId
			generation
			lifecycle
			fixtureIdentity
			scoreCore
			displayStats
			explain
			picksBase
			officialAdjustment
			previousTotals
			finalResult
			rules
			algorithm
			input
		}
		times {
			sourceCheckedAt
			contentUpdatedAt
			publishedAt
			checkpointedAt
			servedAt
			staleAt
			nextRefreshAt
		}
		delivery { state servedFrom reasonCodes }
			}
	      snapshot {
		season
		eventId
		state
		delivery { state servedFrom reasonCodes }
	      }
	      rank {
		eventRank
		overallRank
		leagueRank
		revision
		contentUpdatedAt
		state
      }
	      captainName
      pickList {
        element
        elementType
        position
        webName
        teamName
        teamShortName
        minutes
        goalsScored
        assists
        cleanSheets
        goalsConceded
        defensiveContribution
        ownGoals
        penaltiesSaved
        penaltiesMissed
        yellowCards
        redCards
        saves
        bonus
        bps
        totalPoints
        starts
	        isGwStarted
	        isGwFinished
        isPlayed
        isCaptain
        isViceCaptain
        multiplier
        pickActive
        autoSub
        bgw
        expectedGoals
        expectedAssists
	        expectedGoalInvolvements
	        expectedGoalsConceded
	        inDreamTeam
      }
    }
  }
`

// Types for live points query
export interface LivePick {
	element: number
	elementType: number
	position: number
	webName: string
	teamName: string
	teamShortName: string
	minutes: number
	goalsScored: number
	assists: number
	cleanSheets: number
	goalsConceded: number
	defensiveContribution: number
	ownGoals: number
	penaltiesSaved: number
	penaltiesMissed: number
	yellowCards: number
	redCards: number
	saves: number
	bonus: number
	bps: number
	totalPoints: number
	starts: boolean | null
	isGwStarted: boolean
	isGwFinished: boolean
	isPlayed: boolean
	isCaptain: boolean
	isViceCaptain: boolean
	multiplier?: number
	pickActive?: boolean
	autoSub?: boolean
	bgw?: boolean
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
	inDreamTeam: boolean
}

export interface LiveCalcData {
	entry: number
	event: number
	availability: 'READY' | 'PENDING' | 'NO_PICKS' | 'UNAVAILABLE'
	delivery: LiveDelivery
	snapshot: LiveSnapshotStatus
	score: LivePointsScore
	rank: LiveRank | null
	provisional: boolean
	entryName: string
	playerName: string
	region: string | null
	chip: string
	startedEvent: number
	value: number
	bank: number
	teamValue: number
	totalTransfers: number
	lastValue: number
	played: number
	toPlay: number
	playedCaptain: number
	activeCaptain: { id: number; name: string; points: number }
	captainName: string
	pickList: LivePick[]
}

export interface LiveRevisionVector {
	publicationId: string
	generation: number
	lifecycle: string
	fixtureIdentity: string
	scoreCore: string
	displayStats: string
	explain: string
	picksBase: string | null
	officialAdjustment: string | null
	previousTotals: string | null
	finalResult: string | null
	rules: string
	algorithm: string
	input: string
}

export interface LiveTimes {
	sourceCheckedAt: string
	contentUpdatedAt: string
	publishedAt: string
	checkpointedAt: string | null
	servedAt: string
	staleAt: string
	nextRefreshAt: string | null
}

export interface LiveDelivery {
	state: 'FRESH' | 'STALE' | 'DEGRADED' | 'FINAL' | 'UNAVAILABLE'
	servedFrom:
		| 'REDIS_CURRENT'
		| 'REDIS_PREVIOUS'
		| 'PROCESS_LKG'
		| 'POSTGRES_CHECKPOINT'
		| 'FINAL_RESULT'
	reasonCodes: string[]
}

export interface LivePointsScore {
	eventPoints: number
	netEventPoints: number
	totalPoints: number | null
	totalScope: 'OVERALL' | 'UNKNOWN'
	transferCost: number
	source: 'FPL_EVENT_LIVE' | 'FPL_FINAL_RESULT' | 'UNAVAILABLE'
	calculationMode: 'PROJECTED_AUTOSUBS' | 'FINAL_RESULT'
	revisions: LiveRevisionVector
	times: LiveTimes
	delivery: LiveDelivery
}

export interface LiveRank {
	eventRank: number | null
	overallRank: number | null
	leagueRank: number | null
	revision: string | null
	contentUpdatedAt: string | null
	state: LiveDelivery['state']
}

export interface LiveCalcDataResponse {
	liveSnapshot?: LiveSnapshotStatus | null
	calcLivePointsByEntry: LiveCalcData
}

export type LiveSnapshotState =
	| 'PRE_DEADLINE'
	| 'PICKS_WAIT'
	| 'PICKS_PROBE'
	| 'PICKS_SYNC'
	| 'LIVE_ACTIVE'
	| 'BETWEEN_FIXTURES'
	| 'DAY_SETTLING'
	| 'GW_REVIEW'
	| 'FINALIZED'
	| 'PRESEASON'
	| 'BETWEEN_GAMEWEEKS'
	| 'OFFSEASON'
	| 'UNAVAILABLE'

export interface LiveSnapshotStatus {
	season?: string
	eventId: number
	state: LiveSnapshotState
	/** Window metadata used by matches/tournament transition polling. */
	windowState?: LiveWindowState
	dataAvailability?: LiveDataAvailability
	revisions?: LiveRevisionVector
	times?: LiveTimes
	delivery?: LiveDelivery
	publicationId?: string | null
	scoreCoreRevision?: string | null
	contentUpdatedAt?: string | null
	sourceCheckedAt?: string | null
	publishedAt?: string | null
	nextRefreshAt?: string | null
}

export interface LiveSnapshotResponse {
	liveSnapshot: LiveSnapshotStatus | null
}

export const GET_LIVE_MATCHDAY_DESK = `
  query GetLiveMatchdayDesk($ref: LivePublicationRefInput) {
		liveMatchdayDesk(ref: $ref) {
			season
			eventId
			scoreCoreRevision
			state
			windowState
			dataAvailability
			sourceCheckedAt
			publishedAt
			source
			stale
			nextRefreshAt
			revisions {
				publicationId
				generation
				lifecycle
				fixtureIdentity
				scoreCore
				displayStats
				explain
				picksBase
				officialAdjustment
				previousTotals
				finalResult
				rules
				algorithm
				input
			}
			times {
				sourceCheckedAt
				contentUpdatedAt
				publishedAt
				checkpointedAt
				servedAt
				staleAt
				nextRefreshAt
			}
			delivery { state servedFrom reasonCodes }
		matches {
        fixtureId
        eventId
        homeTeamId
        homeTeamName
        awayTeamId
        awayTeamName
        homeScore
        awayScore
        kickoffTime
		minutes
		started
			finished
			finishedProvisional
		}
    }
  }
`

// Types for player data in matches
export interface MatchPlayerData {
	element?: number
	code?: number
	webName: string
	price?: number
	elementType?: number
	elementTypeName?: string
	teamId?: number
	teamCode?: number
	teamName?: string
	teamShortName?: string
	minutes: number
	goalsScored?: number
	assists?: number
	cleanSheets?: number
	goalsConceded?: number
	ownGoals?: number
	penaltiesSaved?: number
	penaltiesMissed?: number
	yellowCards?: number
	redCards?: number
	saves?: number
	defensiveContribution?: number
	bonus?: number
	bps?: number
	totalPoints: number
	starts?: boolean
	expectedGoals?: number | null
	expectedAssists?: number | null
	expectedGoalInvolvements?: number | null
	expectedGoalsConceded?: number | null
	inDreamTeam?: boolean
}

export interface ManagerData {
	webName: string
	totalPoints: number
	minutes?: number
}

// Types for live matches query
export interface NotStartedMatch {
	matchId: number
	minutes: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName?: string
	homePosition: number
	homeScore: number
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName?: string
	awayPosition: number
	awayScore: number
	kickoffTime: string
	playStatus: string
}

export interface PlayingMatch {
	matchId: number
	minutes: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName: string
	homePosition: number
	homeScore: number
	homeTeamDataList: MatchPlayerData[]
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName: string
	awayPosition: number
	awayScore: number
	awayTeamDataList: MatchPlayerData[]
	kickoffTime: string
	playStatus: string
}

export interface FinishedMatch {
	matchId: number
	minutes: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName: string
	homePosition: number
	homeScore: number
	homeTeamDataList: Array<{
		element: number
		webName: string
		elementType?: number
		minutes: number
		goalsScored: number
		assists: number
		cleanSheets: number
		goalsConceded?: number
		ownGoals?: number
		yellowCards?: number
		redCards?: number
		saves: number
		defensiveContribution?: number
		bonus: number
		bps: number
		totalPoints: number
		inDreamTeam: boolean
	}>
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName: string
	awayPosition: number
	awayScore: number
	awayTeamDataList: Array<{
		element: number
		webName: string
		elementType?: number
		minutes: number
		goalsScored: number
		assists: number
		cleanSheets: number
		goalsConceded?: number
		ownGoals?: number
		yellowCards?: number
		redCards?: number
		saves: number
		defensiveContribution?: number
		bonus: number
		bps: number
		totalPoints: number
		inDreamTeam: boolean
	}>
	kickoffTime: string
	playStatus: string
}

export interface LiveMatchesData {
	notStarted: NotStartedMatch[]
	playing: PlayingMatch[]
	finished: FinishedMatch[]
}

export interface LiveMatchdayDeskRow {
	fixtureId: number
	eventId: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName?: string
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName?: string
	homeScore: number | null
	awayScore: number | null
	kickoffTime: string | null
	minutes: number
	started: boolean
	finished: boolean
	finishedProvisional?: boolean
}

export interface LiveMatchdayDesk {
	season: string
	eventId: number
	scoreCoreRevision: string
	state: LiveSnapshotState
	windowState: LiveWindowState
	dataAvailability: LiveDataAvailability
	publishedAt: string
	source: LiveSnapshotSource
	sourceCheckedAt?: string | null
	stale?: boolean
	revisions: LiveRevisionVector
	times: LiveTimes
	delivery: LiveDelivery
	nextRefreshAt?: string | null
	matches: LiveMatchdayDeskRow[]
}

export interface LiveMatchdayDeskResponse {
	liveMatchdayDesk: LiveMatchdayDesk
}

export const GET_LIVE_CONTEXT = `
	query GetLiveContext {
		coreEventContext {
			season
			revision
			sourceCheckedAt
			currentEventId
			nextEventId
			nextDeadlineTime
			latestFinishedEventId
		}
		liveContext {
			season
			coreRevision
	      eventId: currentEventId
      nextEventId
      anchorEventId
      latestFinalizedEventId
      scoreCoreRevision
      state
      windowState
      producerState
      anchorMode
      dataAvailability
      nextRefreshAt
      publishedAt
	      sourceCheckedAt
	      source
	      stale
	      revisions {
			publicationId generation lifecycle fixtureIdentity scoreCore displayStats
			explain picksBase officialAdjustment previousTotals finalResult rules algorithm input
		}
		times { sourceCheckedAt contentUpdatedAt publishedAt checkpointedAt servedAt staleAt nextRefreshAt }
		delivery { state servedFrom reasonCodes }
	    }
  }
`

export interface LiveContextResponse {
	coreEventContext: CoreEventContextData
	liveContext: {
		season: string
		eventId: number | null
		nextEventId: number | null
		scoreCoreRevision: string | null
		state: LiveSnapshotState
		windowState: LiveWindowState
		producerState: LiveProducerState
		anchorMode: LiveAnchorMode
		dataAvailability: LiveDataAvailability
		anchorEventId: number | null
		latestFinalizedEventId: number | null
		publishedAt: string | null
		sourceCheckedAt: string | null
		nextRefreshAt: string | null
		source: LiveSnapshotSource | null
		stale: boolean
		revisions: LiveRevisionVector
		times: LiveTimes
		delivery: LiveDelivery
	} | null
}

export type LiveSnapshotSource =
	| 'REDIS_CURRENT'
	| 'REDIS_PREVIOUS'
	| 'POSTGRES_CHECKPOINT'
	| 'PROCESS_LKG'
	| 'FINAL_RESULT'

export type LiveWindowState =
	| 'PRESEASON'
	| 'PRE_DEADLINE'
	| 'LIVE_ACTIVE'
	| 'DAY_SETTLING'
	| 'BETWEEN_FIXTURES'
	| 'GW_REVIEW'
	| 'FINALIZED'
	| 'BETWEEN_GAMEWEEKS'
	| 'OFFSEASON'

export type LiveProducerState =
	| 'PRE_DEADLINE'
	| 'PICKS_WAIT'
	| 'PICKS_PROBE'
	| 'PICKS_SYNC'
	| 'LIVE_ACTIVE'
	| 'BETWEEN_FIXTURES'
	| 'DAY_SETTLING'
	| 'GW_REVIEW'
	| 'FINALIZED'

export type LiveDataAvailability =
	'FRESH' | 'STALE' | 'DEGRADED' | 'FINAL' | 'UNAVAILABLE'

export type LiveAnchorMode =
	'UPCOMING' | 'CURRENT' | 'PREVIOUS_FINAL' | 'OFFSEASON'

export const GET_LIVE_FIXTURE_PLAYERS = `
  query GetLiveFixturePlayers($ref: LivePublicationRefInput!, $fixtureId: Int!) {
		liveFixturePlayers(ref: $ref, fixtureId: $fixtureId) {
		season
		eventId
		scoreCoreRevision
      fixtureId
      players {
        player { id webName position team { id name shortName } }
        minutes goalsScored assists cleanSheets goalsConceded ownGoals
        penaltiesSaved penaltiesMissed yellowCards redCards saves bonus bps
        defensiveContribution totalPoints starts inDreamTeam
      }
    }
  }
`

export interface LiveFixturePerformance {
	player: {
		id: number
		webName: string
		position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
		team: { id: number; name: string; shortName: string } | null
	} | null
	minutes: number | null
	goalsScored: number | null
	assists: number | null
	cleanSheets: number | null
	goalsConceded: number | null
	ownGoals: number | null
	penaltiesSaved: number | null
	penaltiesMissed: number | null
	yellowCards: number | null
	redCards: number | null
	saves: number | null
	bonus: number | null
	bps: number | null
	defensiveContribution: number | null
	totalPoints: number
}

export interface LiveFixturePlayersData {
	season: string
	eventId: number
	scoreCoreRevision: string
	fixtureId: number
	players: LiveFixturePerformance[]
}

export interface LiveFixturePlayersResponse {
	liveFixturePlayers: LiveFixturePlayersData
}

export interface LiveFixturePlayersBatchResponse {
	fixture0: LiveFixturePlayersData
	fixture1?: LiveFixturePlayersData
	fixture2?: LiveFixturePlayersData
	fixture3?: LiveFixturePlayersData
	fixture4?: LiveFixturePlayersData
}

export const GET_EVENT_LIVE_PERFORMANCES = `
	query GetEventLivePerformances($eventId: Int!) {
		eventLive(eventId: $eventId) {
			performances {
				player { id webName position team { id name shortName } }
				minutes goalsScored assists cleanSheets goalsConceded ownGoals
				penaltiesSaved penaltiesMissed yellowCards redCards saves bonus bps
				defensiveContribution totalPoints starts inDreamTeam
			}
		}
	}
`

export interface EventLivePerformancesResponse {
	eventLive: {
		performances: LiveFixturePerformance[]
	} | null
}

const LIVE_FIXTURE_PLAYERS_FRAGMENT = `
	fragment LiveFixturePlayersBatchFields on LiveFixturePlayers {
		season eventId scoreCoreRevision fixtureId
		players {
			player { id webName position team { id name shortName } }
			minutes goalsScored assists cleanSheets goalsConceded ownGoals
			penaltiesSaved penaltiesMissed yellowCards redCards saves bonus bps
			defensiveContribution totalPoints
		}
	}
`

/** Five fixtures per operation keeps one match window bounded without N+1 calls. */
export function buildLiveFixturePlayersBatchQuery(count: number): string {
	const boundedCount = Math.max(1, Math.min(5, Math.trunc(count)))
	const definitions = Array.from(
		{ length: boundedCount },
		(_, index) => `$fixture${index}: Int!`
	).join('\n\t\t')
	const selections = Array.from(
		{ length: boundedCount },
		(_, index) =>
			`fixture${index}: liveFixturePlayers(ref: $ref, fixtureId: $fixture${index}) { ...LiveFixturePlayersBatchFields }`
	).join('\n\t\t')
	return `
		query GetLiveFixturePlayersBatch(
			$ref: LivePublicationRefInput!
			${definitions}
		) {
			${selections}
		}
		${LIVE_FIXTURE_PLAYERS_FRAGMENT}
	`
}

export const GET_LIVE_FIXTURE_PLAYERS_BATCH =
	buildLiveFixturePlayersBatchQuery(5)

export const GET_EVENT_LIVE_EXPLAIN = `
  query EventLiveExplainPlayer($eventId: Int!, $elementId: Int!) {
    eventLiveExplain(eventId: $eventId, elementId: $elementId) {
      elementId
      selectedBy
      stats {
        minutes
        goalsScored
        assists
        cleanSheets
        goalsConceded
        ownGoals
        penaltiesSaved
        penaltiesMissed
        yellowCards
        redCards
        saves
        defensiveContribution
        bonus
      }
      contributions {
        identifier
        value
        points
      }
      player {
        id
        webName
        team {
          id
          shortName
        }
      }
    }
  }
`

export const GET_EVENT_LIVE_EXPLAINS = `
  query EventLiveExplainBatch($eventId: Int!, $elementIds: [Int!]!) {
    eventLiveExplains(eventId: $eventId, elementIds: $elementIds) {
      elementId
      stats {
        minutes
        goalsScored
        assists
        cleanSheets
        goalsConceded
        ownGoals
        penaltiesSaved
        penaltiesMissed
        yellowCards
        redCards
        saves
        defensiveContribution
        bonus
      }
      contributions {
        identifier
        value
        points
      }
    }
  }
`

export interface PlayerBreakdownStat {
	identifier: string
	value: number | null
	points: number
}

export interface PlayerBreakdownEntry {
	fixtureId: number
	stats: PlayerBreakdownStat[]
}

export interface EventLiveExplainItem {
	elementId: number
	stats?: {
		minutes?: number | null
		goalsScored?: number | null
		assists?: number | null
		cleanSheets?: number | null
		goalsConceded?: number | null
		ownGoals?: number | null
		penaltiesSaved?: number | null
		penaltiesMissed?: number | null
		yellowCards?: number | null
		redCards?: number | null
		saves?: number | null
		defensiveContribution?: number | null
		bonus?: number | null
	}
	selectedBy?: number | null
	player?: {
		id: number
		webName: string
		team: {
			id: number
			shortName: string
		} | null
	} | null
	contributions?: PlayerBreakdownStat[]
	breakdown?: PlayerBreakdownEntry[]
}

export interface EventLiveExplainResponse {
	eventLiveExplain: EventLiveExplainItem | null
}

export interface EventLiveExplainsResponse {
	eventLiveExplains: EventLiveExplainItem[]
}

export const GET_PLAYER_LIVE = `
  query PlayerLive($playerId: Int!, $eventId: Int) {
    playerLive(playerId: $playerId, eventId: $eventId) {
      minutes
      goalsScored
      assists
      cleanSheets
      goalsConceded
      ownGoals
      penaltiesSaved
      penaltiesMissed
      yellowCards
      redCards
      saves
      defensiveContribution
      bonus
      bps
      totalPoints
    }
  }
`

export interface PlayerLiveStats {
	minutes: number
	goalsScored: number
	assists: number
	cleanSheets: number
	goalsConceded: number
	ownGoals: number
	penaltiesSaved: number
	penaltiesMissed: number
	yellowCards: number
	redCards: number
	saves: number
	defensiveContribution: number
	bonus: number
	bps: number
	totalPoints: number
}

export interface PlayerLiveResponse {
	playerLive: PlayerLiveStats | null
}
