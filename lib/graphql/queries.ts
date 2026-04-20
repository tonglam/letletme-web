// Query to fetch current gameweek ID and next gameweek deadline
export const GET_CURRENT_AND_NEXT_EVENTS = `
  query GetCurrentAndNextEvents {
    current: events(filter: { isCurrent: true }, limit: 1) {
      id
    }
    next: events(filter: { isNext: true }, limit: 1) {
      id
      deadlineTime
    }
  }
`

// Type for current event (only need ID)
export interface CurrentEvent {
	id: number
}

// Type for next event (need ID and deadline)
export interface NextEvent {
	id: number
	deadlineTime: string // ISO 8601 date string
}

// Type for the events response
export interface EventsResponse {
	current: CurrentEvent[]
	next: NextEvent[]
}

// Query to fetch a single event stats snapshot
export const GET_EVENT_STATS_BY_ID = `
  query GetEventStatsById($eventId: Int!) {
    event(id: $eventId) {
      id
      averageEntryScore
      highestScore
      mostSelected
      mostTransferredIn
      mostCaptained
      mostViceCaptained
      transfersMade
      chipPlays
    }
  }
`

export interface EventStatsById {
	id: number
	averageEntryScore: number | null
	highestScore: number | null
	mostSelected: number | null
	mostTransferredIn: number | null
	mostCaptained: number | null
	mostViceCaptained: number | null
	transfersMade: number | null
	chipPlays: unknown
}

export interface EventStatsByIdResponse {
	event: EventStatsById | null
}

// Query to fetch player values
export const GET_PLAYER_VALUES = `
  query GetPlayerValues {
    playerValues {
      playerId
      playerName
      teamName
      position
      lastValue
      value
    }
  }
`

// Type for player value data
export interface PlayerValue {
	playerId: number
	playerName: string
	teamName: string
	position: string
	lastValue: number
	value: number
}

// Type for player values response
export interface PlayerValuesResponse {
	playerValues: PlayerValue[]
}

// Query to fetch full player directory for selector/search
export const GET_PLAYERS_FOR_PICKER = `
  query GetPlayersForPicker($limit: Int!, $offset: Int!) {
    players(limit: $limit, offset: $offset) {
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

export type PlayerDirectoryPosition =
	| 'GOALKEEPER'
	| 'DEFENDER'
	| 'MIDFIELDER'
	| 'FORWARD'

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

// Query to fetch historical player value changes
export const GET_PLAYER_VALUE_HISTORY = `
  query GetPlayerValueHistory($playerId: Int!, $limit: Int) {
    playerValueHistory(playerId: $playerId, limit: $limit) {
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

export type PriceChangeType = 'RISE' | 'FALL' | 'UNCHANGED'

export interface PlayerValueHistoryItem {
	playerId: number
	changeDate: string
	oldValue: number
	newValue: number
	changeType: PriceChangeType
	transfersIn?: number | null
	transfersOut?: number | null
}

export interface PlayerValueHistoryResponse {
	playerValueHistory: PlayerValueHistoryItem[]
}

// Query to fetch event overall result
export const GET_EVENT_OVERALL_RESULT = `
  query GetEventOverallResult($season: Int!) {
    eventOverallResult(season: $season) {
      event
      averageScore
      highestScore
      highestScoringEntry
      transfersMade
      mostViceCaptainedPlayer {
        id
        webName
      }
      mostTransferInPlayer {
        id
        webName
      }
      mostSelectedPlayer {
        id
        webName
      }
      mostCaptainedPlayer {
        id
        webName
      }
      topElementInfo {
        element
        points
        player {
          id
          webName
          team {
            name
          }
        }
      }
      chipPlays {
        chipName
        numberPlayed
      }
    }
  }
`

// Type for player info
export interface PlayerInfo {
	id: number
	webName: string
	firstName?: string
	secondName?: string
}

// Type for team info
export interface TeamInfo {
	name: string
}

// Type for top element player
export interface TopElementPlayer {
	id: number
	webName: string
	team: TeamInfo | null
}

// Type for top element info
export interface TopElementInfo {
	element: number
	points: number
	player: TopElementPlayer | null
}

export interface ChipPlay {
	chipName: string
	numberPlayed: number
}

// Type for event overall result
export interface EventOverallResult {
	event: number
	averageScore: number
	highestScore: number
	highestScoringEntry: number
	transfersMade: number
	mostCaptainedPlayer: PlayerInfo | null
	mostViceCaptainedPlayer: PlayerInfo | null
	mostTransferInPlayer: PlayerInfo | null
	mostSelectedPlayer: PlayerInfo | null
	topElementInfo: TopElementInfo
	chipPlays: ChipPlay[]
}

// Type for event overall result response (could be array or single object)
export interface EventOverallResultResponse {
	eventOverallResult: EventOverallResult | EventOverallResult[]
}

// Query to fetch live scores (team of the week)
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

// Query to fetch top transfers in
export const GET_TOP_TRANSFERS_IN = `
  query GetTopTransfersIn($eventId: Int!, $limit: Int) {
    topTransfersIn(eventId: $eventId, limit: $limit) {
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
  }
`

// Query to fetch top transfers out
export const GET_TOP_TRANSFERS_OUT = `
  query GetTopTransfersOut($eventId: Int!, $limit: Int) {
    topTransfersOut(eventId: $eventId, limit: $limit) {
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
  }
`

// Type for transfer player
export interface TransferPlayer {
	id: number
	webName: string
	position?: string
	selectedByPercent?: number | null
	totalPoints?: number | null
	team?: {
		name: string
		shortName?: string
	}
}

// Type for top transfer entry
export interface TopTransfer {
	player: TransferPlayer
	eventId: number
	transfersInEvent: number
	transfersOutEvent: number
}

// Type for top transfers response
export interface TopTransfersResponse {
	topTransfersIn?: TopTransfer[]
	topTransfersOut?: TopTransfer[]
}

// Query to fetch event fixtures
export const GET_EVENT_FIXTURES = `
  query GetEventFixtures($eventId: Int!) {
    eventFixtures(eventId: $eventId) {
      id
      code
      event {
        id
        name
      }
      kickoffTime
      finished
      started
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
      homeTeamDifficulty
      awayTeamDifficulty
    }
  }
`

// Type for team in fixture
export interface FixtureTeam {
	id: number
	name: string
	shortName: string
}

// Type for event in fixture
export interface FixtureEvent {
	id: number
	name: string
}

// Type for fixture
export interface Fixture {
	id: number
	code: number
	event: FixtureEvent
	kickoffTime: string
	finished: boolean
	started: boolean
	homeTeam: FixtureTeam
	awayTeam: FixtureTeam
	homeScore: number | null
	awayScore: number | null
	homeTeamDifficulty: number
	awayTeamDifficulty: number
}

// Type for event fixtures response
export interface EventFixturesResponse {
	eventFixtures: Fixture[]
}

// Query to fetch live points for an entry
export const GET_LIVE_POINTS = `
  query GetLiveCalcPoints($eventId: Int!, $entryId: Int!) {
    calcLivePointsByEntry(eventId: $eventId, entryId: $entryId) {
      entry
      event
      entryName
      playerName
      chip
      livePoints
      transferCost
      liveNetPoints
      liveTotalPoints
      captainName
      pickList {
        element
        elementType
        position
        webName
        minutes
        goalsScored
        assists
        bonus
        bps
        totalPoints
        starts
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
	minutes: number
	goalsScored: number
	assists: number
	bonus: number
	bps: number
	totalPoints: number
	starts: boolean
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
	inDreamTeam: boolean
}

export interface LiveCalcData {
	entry: number
	event: number
	entryName?: string
	playerName?: string
	chip?: string | null
	livePoints: number
	transferCost: number
	liveNetPoints: number
	liveTotalPoints: number
	captainName: string
	pickList: LivePick[]
}

export interface LiveCalcDataResponse {
	calcLivePointsByEntry: LiveCalcData
}

// Query to fetch live matches
export const GET_LIVE_MATCHES = `
  query GetLiveMatches {
    liveMatches {
      nextEvent {
        matchId
        minutes
        homeTeamId
        homeTeamName
        homeTeamShortName
        awayTeamId
        awayTeamName
        awayTeamShortName
        kickoffTime
        playStatus
      }
      notStarted {
        matchId
        minutes
        homeTeamId
        homeTeamName
        homeTeamShortName
        homePosition
        homeScore
        awayTeamId
        awayTeamName
        awayTeamShortName
        awayPosition
        awayScore
        kickoffTime
        playStatus
      }
      playing {
        matchId
        minutes
        homeTeamId
        homeTeamName
        homeTeamShortName
        homePosition
        homeScore
        homeTeamDataList {
          element
          code
          webName
          price
          elementType
          elementTypeName
          teamId
          teamCode
          teamName
          teamShortName
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
          starts
          expectedGoals
          expectedAssists
          expectedGoalInvolvements
          expectedGoalsConceded
          inDreamTeam
        }
        awayTeamId
        awayTeamName
        awayTeamShortName
        awayPosition
        awayScore
        awayTeamDataList {
          element
          code
          webName
          price
          elementType
          elementTypeName
          teamId
          teamCode
          teamName
          teamShortName
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
          starts
          expectedGoals
          expectedAssists
          expectedGoalInvolvements
          expectedGoalsConceded
          inDreamTeam
        }
        kickoffTime
        playStatus
      }
      finished {
        matchId
        minutes
        homeTeamId
        homeTeamName
        homeTeamShortName
        homePosition
        homeScore
        homeTeamDataList {
          element
          webName
          elementType
          minutes
          goalsScored
          assists
          cleanSheets
          goalsConceded
          ownGoals
          yellowCards
          redCards
          saves
          defensiveContribution
          bonus
          bps
          totalPoints
          inDreamTeam
        }
        awayTeamId
        awayTeamName
        awayTeamShortName
        awayPosition
        awayScore
        awayTeamDataList {
          element
          webName
          elementType
          minutes
          goalsScored
          assists
          cleanSheets
          goalsConceded
          ownGoals
          yellowCards
          redCards
          saves
          defensiveContribution
          bonus
          bps
          totalPoints
          inDreamTeam
        }
        kickoffTime
        playStatus
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
export interface NextEventMatch {
	matchId: number
	minutes: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName: string
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName: string
	kickoffTime: string
	playStatus: string
}

export interface NotStartedMatch {
	matchId: number
	minutes: number
	homeTeamId: number
	homeTeamName: string
	homeTeamShortName: string
	homePosition: number
	homeScore: number
	awayTeamId: number
	awayTeamName: string
	awayTeamShortName: string
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
	nextEvent: NextEventMatch[]
	notStarted: NotStartedMatch[]
	playing: PlayingMatch[]
	finished: FinishedMatch[]
}

export interface LiveMatchesResponse {
	liveMatches: LiveMatchesData
}

// Query to fetch player breakdown (explain) data for an event
export const GET_EVENT_LIVE_EXPLAIN = `
  query EventLiveExplainPlayer($eventId: Int!, $elementId: Int!) {
    eventLiveExplain(eventId: $eventId, elementId: $elementId) {
      player {
        id
        webName
        team {
          id
          shortName
        }
      }
      breakdown {
        fixtureId
        stats {
          identifier
          value
          points
        }
      }
    }
  }
`

export interface PlayerBreakdownStat {
	identifier: string
	value: number
	points: number
}

export interface PlayerBreakdownEntry {
	fixtureId: number
	stats: PlayerBreakdownStat[]
}

export interface EventLiveExplainItem {
	player: {
		id: number
		webName: string
		team: {
			id: number
			shortName: string
		}
	}
	breakdown: PlayerBreakdownEntry[]
}

export interface EventLiveExplainResponse {
	eventLiveExplain: EventLiveExplainItem
}
