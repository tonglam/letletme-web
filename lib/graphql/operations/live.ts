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

export const GET_LIVE_SNAPSHOT = `
  query GetLiveSnapshot($eventId: Int) {
    liveSnapshot(eventId: $eventId) {
      eventId
      revision
      state
      publishedAt
      checkedAt
    }
  }
`

// Query to fetch top transfers in
export const GET_LIVE_POINTS = `
  query GetLiveCalcPoints($eventId: Int!, $entryId: Int!) {
    liveSnapshot(eventId: $eventId) {
      eventId
      revision
      state
      publishedAt
      checkedAt
    }
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
	liveSnapshot: LiveSnapshotStatus | null
	calcLivePointsByEntry: LiveCalcData
}

export type LiveSnapshotState = 'SCHEDULED' | 'LIVE' | 'SETTLED'

export interface LiveSnapshotStatus {
	eventId: number
	revision: string
	state: LiveSnapshotState
	publishedAt: string
	checkedAt: string
}

export interface LiveSnapshotResponse {
	liveSnapshot: LiveSnapshotStatus | null
}

// Query to fetch live points for all entries in a tournament
export const GET_LIVE_MATCHES = `
  query GetLiveMatches {
    liveSnapshot {
      eventId
      revision
      state
      publishedAt
      checkedAt
    }
    liveMatches(upcoming: true) {
      nextEvent {
        ...LiveMatchIdentity
      }
      notStarted {
        ...LiveMatchIdentity
        homeScore
        awayScore
      }
      playing {
        ...LiveMatchIdentity
        homeScore
        homeTeamDataList {
          ...LivePlayingPlayer
        }
        awayScore
        awayTeamDataList {
          ...LivePlayingPlayer
        }
      }
      finished {
        ...LiveMatchIdentity
        homePosition
        homeScore
        homeTeamDataList {
          ...LiveFinishedPlayer
        }
        awayPosition
        awayScore
        awayTeamDataList {
          ...LiveFinishedPlayer
        }
      }
    }
  }

  fragment LiveMatchIdentity on LiveMatchData {
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

  fragment LivePlayingPlayer on ElementEventResultData {
    element
    webName
    elementType
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

  fragment LiveFinishedPlayer on ElementEventResultData {
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
	liveSnapshot: LiveSnapshotStatus | null
	liveMatches: LiveMatchesData
}

export const GET_EVENT_LIVE_EXPLAIN = `
  query EventLiveExplainPlayer($eventId: Int!, $elementId: Int!) {
    eventLiveExplain(eventId: $eventId, elementId: $elementId) {
      elementId
      selectedBy
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
	bonus: number
	bps: number
	totalPoints: number
}

export interface PlayerLiveResponse {
	playerLive: PlayerLiveStats | null
}
