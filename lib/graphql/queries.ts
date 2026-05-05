/** YYYY-MM-DD in UTC for GraphQL `Date` (e.g. `playerValues(changeDate: …)`). */
export function utcCalendarDateISO(date: Date = new Date()): string {
	const y = date.getUTCFullYear()
	const m = String(date.getUTCMonth() + 1).padStart(2, '0')
	const d = String(date.getUTCDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

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

// Query to fetch tournaments joined by current entry
export const GET_ENTRY_TOURNAMENTS = `
  query GetEntryTournaments($entryId: Int!) {
    entryTournaments(entryId: $entryId) {
      id
      name
      creator
      adminEntryId
      leagueId
      leagueType
      totalTeamNum
      tournamentMode
      groupMode
      groupTeamNum
      groupNum
      groupStartedEventId
      groupEndedEventId
      groupAutoAverages
      groupRounds
      groupPlayAgainstNum
      groupQualifyNum
      knockoutMode
      knockoutTeamNum
      knockoutRounds
      knockoutEventNum
      knockoutStartedEventId
      knockoutEndedEventId
      knockoutPlayAgainstNum
      state
      createdAt
      updatedAt
    }
  }
`

export type EntryTournamentState = 'ACTIVE' | 'COMPLETED' | 'PENDING'

export interface EntryTournament {
	id: number
	name: string
	creator: string
	adminEntryId: number
	leagueId: number
	leagueType: string
	totalTeamNum: number
	tournamentMode: string
	groupMode: string
	groupTeamNum: number
	groupNum: number
	groupStartedEventId: number | null
	groupEndedEventId: number | null
	groupAutoAverages: boolean
	groupRounds: number | null
	groupPlayAgainstNum: number | null
	groupQualifyNum: number | null
	knockoutMode: string
	knockoutTeamNum: number | null
	knockoutRounds: number | null
	knockoutEventNum: number | null
	knockoutStartedEventId: number | null
	knockoutEndedEventId: number | null
	knockoutPlayAgainstNum: number | null
	state: EntryTournamentState | string
	createdAt: string
	updatedAt: string
}

export interface EntryTournamentsResponse {
	entryTournaments: EntryTournament[]
}

export const GET_TOURNAMENT_EVENT_RESULTS = `
  query GetTournamentEventResults($tournamentId: Int!, $eventId: Int!) {
    tournamentEventResults(tournamentId: $tournamentId, eventId: $eventId) {
      tournament {
        id
        name
        creator
        adminEntryId
        leagueId
        leagueType
        totalTeamNum
        tournamentMode
        groupMode
        groupTeamNum
        groupNum
        groupStartedEventId
        groupEndedEventId
        groupAutoAverages
        groupRounds
        groupPlayAgainstNum
        groupQualifyNum
        knockoutMode
        knockoutTeamNum
        knockoutRounds
        knockoutEventNum
        knockoutStartedEventId
        knockoutEndedEventId
        knockoutPlayAgainstNum
        state
        createdAt
        updatedAt
      }
      event {
        id
        name
      }
      groupId
      entryId
      entryName
      playerName
      eventGroupRank
      eventPoints
      eventCost
      eventNetPoints
      eventRank
      overallPoints
      overallRank
      eventChip
      captainId
      captainPoints
      teamValue
      bank
    }
  }
`

export interface TournamentEventResultItem {
	tournament: EntryTournament
	event: {
		id: number
		name: string
	}
	groupId: number
	entryId: number
	entryName: string | null
	playerName: string | null
	eventGroupRank: number | null
	eventPoints: number | null
	eventCost: number | null
	eventNetPoints: number | null
	eventRank: number | null
	overallPoints: number | null
	overallRank: number | null
	eventChip: string | null
	captainId: number | null
	captainPoints: number | null
	teamValue: number | null
	bank: number | null
}

export interface TournamentEventResultsResponse {
	tournamentEventResults: TournamentEventResultItem[]
}

export const GET_TOURNAMENT_ENTRY_RANKING_SUMMARY = `
  query GetTournamentEntryRankingSummary($tournamentId: Int!, $eventId: Int!, $entryId: Int!) {
    tournamentEntryRankingSummary(
      tournamentId: $tournamentId
      eventId: $eventId
      entryId: $entryId
    ) {
      entryId
      overallRank
      tournamentOverallRank
      teamValue
      tournamentTeamValueRank
      transfersNum
      tournamentTransfersRank
      totalCosts
      tournamentCostsRank
      totalBenchPoints
      tournamentBenchPointsRank
      autoSubPoints
      tournamentAutoSubRank
    }
  }
`

export interface TournamentEntryRankingSummary {
	entryId: number
	overallRank: number | null
	tournamentOverallRank: number | null
	teamValue: number | null
	tournamentTeamValueRank: number | null
	transfersNum: number | null
	tournamentTransfersRank: number | null
	totalCosts: number | null
	tournamentCostsRank: number | null
	totalBenchPoints: number | null
	tournamentBenchPointsRank: number | null
	autoSubPoints: number | null
	tournamentAutoSubRank: number | null
}

export interface TournamentEntryRankingSummaryResponse {
	tournamentEntryRankingSummary: TournamentEntryRankingSummary
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

export const GET_TOURNAMENT_SELECTION_STATS = `
  query TournamentSelectionStats($tournamentId: Int!, $eventId: Int!, $limit: Int) {
    tournamentSelectionStats(tournamentId: $tournamentId, eventId: $eventId, limit: $limit) {
      totalEntries
      mostSelectedPlayers {
        id
        webName
        teamShortName
        position
        selectedByPercent
        eoByPercent
      }
      captainSelect {
        id
        webName
        teamShortName
        position
        captainByPercent
        selectedByPercent
        eoByPercent
      }
      mostTransferIn {
        id
        webName
        teamShortName
        position
        selectedByPercent
        transfersEvent
      }
      mostTransferOut {
        id
        webName
        teamShortName
        position
        selectedByPercent
        transfersEvent
      }
    }
  }
`

export interface TournamentStatPlayer {
	id: number
	webName: string
	teamShortName: string
	position: string
	selectedByPercent: number
	captainByPercent?: number
	eoByPercent?: number
	transfersEvent?: number
}

export interface TournamentSelectionStatsData {
	totalEntries: number
	mostSelectedPlayers: TournamentStatPlayer[]
	captainSelect: TournamentStatPlayer[]
	mostTransferIn: TournamentStatPlayer[]
	mostTransferOut: TournamentStatPlayer[]
}

export interface TournamentSelectionStatsResponse {
	tournamentSelectionStats: TournamentSelectionStatsData | null
}

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

// Query to fetch player values
export const GET_PLAYER_VALUES = `
  query GetPlayerValues($changeDate: Date!) {
    playerValues(changeDate: $changeDate) {
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

export interface TeamForPickerItem {
	id: number
	name: string
	shortName: string
}

export interface TeamsForPickerResponse {
	teams: TeamForPickerItem[]
}

// Query to fetch historical player value changes
export const GET_PLAYER_VALUE_HISTORY = `
  query GetPlayerValueHistory($playerId: Int!, $fromDate: DateTime, $toDate: DateTime) {
    playerValueHistory(playerId: $playerId, fromDate: $fromDate, toDate: $toDate) {
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
  query GetEventOverallResult {
    eventOverallResult {
      event
      finished
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
	finished: boolean
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

// Query to fetch live points for all entries in a tournament
export const GET_TOURNAMENT_LIVE_POINTS = `
  query GetTournamentLivePoints($eventId: Int!, $tournamentId: Int!) {
    calcLivePointsForTournament(eventId: $eventId, tournamentId: $tournamentId) {
      results {
        entry
        entryName
        playerName
        overallRank
        chip
        livePoints
        transferCost
        liveNetPoints
        liveTotalPoints
        played
        toPlay
        captainName
        pickList {
          element
          webName
          elementTypeName
          position
          isCaptain
          isViceCaptain
          teamShortName
          teamName
        }
      }
      errors {
        entryId
        message
      }
      meta {
        eventId
        totalEntries
        succeededCount
        failedCount
      }
    }
  }
`

export interface BatchCalcError {
	entryId: number
	message: string
}

export interface BatchCalcMeta {
	eventId: number
	totalEntries: number
	succeededCount: number
	failedCount: number
}

export interface TournamentLiveCalcData {
	entry: number
	entryName: string
	playerName: string
	overallRank: number
	chip: string | null
	livePoints: number
	transferCost: number
	liveNetPoints: number
	liveTotalPoints: number
	played: number
	toPlay: number
	captainName: string
	pickList: Array<{
		element: number
		webName: string
		elementTypeName: string
		position: number
		isCaptain: boolean
		isViceCaptain: boolean
		teamShortName: string
		teamName: string
	}>
}

export interface TournamentLivePointsResponse {
	calcLivePointsForTournament: {
		results: TournamentLiveCalcData[]
		errors: BatchCalcError[]
		meta: BatchCalcMeta
	}
}

// Query to fetch entry result for a specific event
export const GET_ENTRY_EVENT_RESULT = `
  query GetEntryEventResult($entryId: Int!, $eventId: Int!) {
    entryEventResult(entryId: $entryId, eventId: $eventId) {
      eventId
      eventPoints
      overallPoints
      overallRank
      eventTransfers
      eventTransfersCost
      eventNetPoints
      eventBenchPoints
      eventChip
      eventCaptainPoints
      eventPlayedCaptain {
        webName
      }
      eventPicks {
        webName
        teamShortName
        teamName
        elementTypeName
        isCaptain
        isViceCaptain
        multiplier
        totalPoints
        minutes
        position
      }
      teamValue
      bank
      entry {
        id
        entryName
        playerName
        totalTransfers
        region
      }
    }
  }
`

export interface EntryEventResult {
	eventId: number
	eventPoints: number
	overallPoints: number
	overallRank: number
	eventTransfers: number
	eventTransfersCost: number
	eventNetPoints: number
	eventBenchPoints: number
	eventChip: string
	eventCaptainPoints: number
	eventPlayedCaptain: {
		webName: string
	} | null
	eventPicks: EntryEventPick[]
	teamValue: number | null
	bank: number | null
	entry: {
		id: number
		entryName: string
		playerName: string | null
		totalTransfers: number | null
		region: string | null
	}
}

export interface EntryEventPick {
	webName: string
	teamShortName: string
	teamName: string
	elementTypeName: string
	isCaptain: boolean
	isViceCaptain: boolean
	multiplier: number
	totalPoints: number
	minutes: number
	position: number
}

export interface EntryEventResultResponse {
	entryEventResult: EntryEventResult | null
}

// Query to fetch full historical event results for an entry
export const GET_ENTRY_HISTORY = `
  query GetEntryHistory($entryId: Int!) {
    entryHistory(entryId: $entryId) {
      results {
        eventId
        eventChip
        eventPoints
        eventRank
        overallPoints
        overallRank
        eventTransfers
        eventTransfersCost
        eventNetPoints
        teamValue
        bank
      }
      history {
        season
        totalPoints
        overallRank
      }
    }
  }
`

export interface EntryHistoryItem {
	eventId: number
	eventChip: string
	eventPoints: number
	eventRank: number | null
	overallPoints: number
	overallRank: number
	eventTransfers: number
	eventTransfersCost: number
	eventNetPoints: number
	teamValue: number | null
	bank: number | null
}

export interface EntryHistoryResponse {
	entryHistory: {
		results: EntryHistoryItem[]
		history: EntrySeasonHistoryItem[]
	}
}

export interface EntrySeasonHistoryItem {
	season: string
	totalPoints: number
	overallRank: number
}

// Query to fetch entry transfer history grouped by gameweek
export const GET_ENTRY_TRANSFER_HISTORY = `
  query GetEntryTransferHistory($entryId: Int!) {
    entryTransferHistory(entryId: $entryId) {
      eventId
      eventTransfers
      eventTransfersCost
      transfers {
        event
        elementInWebName
        elementInTypeName
        elementInTeamShortName
        elementInCost
        elementOutWebName
        elementOutTypeName
        elementOutTeamShortName
        elementOutCost
        time
      }
    }
  }
`

export interface EntryTransferMove {
	event: number
	elementInWebName: string
	elementInTypeName: string
	elementInTeamShortName: string
	elementInCost: number
	elementOutWebName: string
	elementOutTypeName: string
	elementOutTeamShortName: string
	elementOutCost: number
	time: string
}

export interface EntryGameweekTransfers {
	eventId: number
	eventTransfers: number
	eventTransfersCost: number
	transfers: EntryTransferMove[]
}

export interface EntryTransferHistoryResponse {
	entryTransferHistory: EntryGameweekTransfers[]
}

// Query to fetch live matches
export const GET_LIVE_MATCHES = `
  query GetLiveMatches {
    liveMatches(upcoming: true) {
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
        homeScore
        awayTeamId
        awayTeamName
        awayTeamShortName
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
        awayTeamId
        awayTeamName
        awayTeamShortName
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
	elementId: number
	selectedBy: number | null
	player: {
		id: number
		webName: string
		team: {
			id: number
			shortName: string
		}
	}
	breakdown?: PlayerBreakdownEntry[]
}

export interface EventLiveExplainResponse {
	eventLiveExplain: EventLiveExplainItem | null
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
