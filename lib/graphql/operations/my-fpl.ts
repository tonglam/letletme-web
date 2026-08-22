import type { EntryTournament, TournamentSeasonMetricKey } from './tournaments'
import { TOURNAMENT_INFO_FIELDS } from './tournaments'

export type MyFplReviewState =
	'PRESEASON' | 'PENDING' | 'READY' | 'EMPTY' | 'UNAVAILABLE'

export interface MyFplReviewContext {
	season: string
	coreRevision: string
	currentEventId: number | null
	nextEventId: number | null
	latestFinalizedEventId: number | null
}

export interface MyFplEntryIdentity {
	id: number
	entryName: string
	playerName: string
	region: string | null
	startedEvent: number | null
	overallPoints: number | null
	overallRank: number | null
	bank: number | null
	teamValue: number | null
	totalTransfers: number | null
}

export interface MyFplTeamHistoryRow {
	eventId: number
	eventPoints: number
	eventRank: number | null
	overallPoints: number
	overallRank: number
	eventTransfers: number
	eventTransfersCost: number
	eventNetPoints: number
	eventBenchPoints: number
	eventChip: string
	eventCaptainPoints: number
	captainWebName: string | null
	captainTeamShortName: string | null
	teamValue: number | null
	bank: number | null
}

export interface MyFplPastSeason {
	season: string
	totalPoints: number
	overallRank: number
}

export interface MyFplTeamPick {
	element: number
	position: number
	webName: string
	teamShortName: string
	teamName: string
	elementTypeName: string
	isCaptain: boolean
	isViceCaptain: boolean
	multiplier: number
	totalPoints: number
	minutes: number
	goalsScored: number
	assists: number
	cleanSheets: number
	goalsConceded: number
	yellowCards: number
	redCards: number
	saves: number
	bonus: number
	bps: number
	againstShortName: string
	wasHome: string
	score: string
	fixtureCount: number
	bgw: boolean
	dgw: boolean
	isPlayed: boolean
	autoSub: boolean
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
}

export interface MyFplTeamGameweekResult {
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
	playedCaptainWebName: string | null
	teamValue: number | null
	bank: number | null
	picks: MyFplTeamPick[]
}

export interface MyFplTeamGameweek {
	state: MyFplReviewState
	context: MyFplReviewContext
	eventId: number
	entry: MyFplEntryIdentity | null
	result: MyFplTeamGameweekResult | null
}

export interface MyFplTeamDesk {
	state: MyFplReviewState
	context: MyFplReviewContext
	entry: MyFplEntryIdentity | null
	history: MyFplTeamHistoryRow[]
	pastSeasons: MyFplPastSeason[]
	pastSeasonsState: MyFplReviewState
	selectedEventId: number | null
	gameweek: MyFplTeamGameweek | null
}

export interface MyFplTransferMove {
	eventId: number
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

export interface MyFplTransferGameweek {
	eventId: number
	eventTransfers: number
	eventTransfersCost: number
	transfers: MyFplTransferMove[]
}

export interface MyFplTeamTransfers {
	state: MyFplReviewState
	context: MyFplReviewContext
	gameweeks: MyFplTransferGameweek[]
}

export interface MyFplCompetitionBoardRow {
	eventId: number
	groupId: number | null
	entryId: number
	entryName: string | null
	playerName: string | null
	rank: number | null
	previousRank: number | null
	fieldRank: number | null
	eventPoints: number | null
	eventCost: number | null
	eventNetPoints: number | null
	eventRank: number | null
	overallPoints: number | null
	overallRank: number | null
	eventChip: string | null
	captainId: number | null
	captainWebName: string | null
	captainTeamShortName: string | null
	captainPoints: number | null
	teamValue: number | null
	bank: number | null
}

export interface MyFplCompetitionBoardPage {
	state: MyFplReviewState
	eventId: number
	page: number
	pageSize: number
	totalRows: number
	totalPages: number
	fieldSize: number
	rows: MyFplCompetitionBoardRow[]
	viewerRow: MyFplCompetitionBoardRow | null
}

export interface MyFplCompetitionPerformance {
	entryId: number
	entryName: string | null
	playerName: string | null
	eventPoints: number
	eventNetPoints: number
	rank: number | null
	previousRank: number | null
	captainId: number | null
	captainWebName: string | null
	captainTeamShortName: string | null
	captainPoints: number | null
}

export interface MyFplCompetitionDistribution {
	key: string
	label: string
	teamShortName: string | null
	count: number
	percentage: number
	averagePoints: number
}

export interface MyFplCompetitionMetric {
	key: TournamentSeasonMetricKey
	leaderValue: number | null
	leaderEntryId: number | null
	leaderEntryName: string | null
	leaderPlayerName: string | null
	averageValue: number | null
	higherIsBetter: boolean
}

export interface MyFplCompetitionViewerSummary {
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
	overallPoints: number | null
	leaderOverallPoints: number | null
	gapToLeader: number | null
	pointsBehindNext: number | null
	pointsAheadOfPrev: number | null
}

export interface MyFplCompetitionAggregate {
	eventId: number
	entryCount: number
	leaderOverallPoints: number | null
	secondOverallPoints: number | null
	gapFirstSecond: number | null
	averageOverallPoints: number | null
	metrics: MyFplCompetitionMetric[]
	viewer: MyFplCompetitionViewerSummary | null
	topPerformers: MyFplCompetitionPerformance[]
	risers: MyFplCompetitionPerformance[]
	fallers: MyFplCompetitionPerformance[]
	captainDistribution: MyFplCompetitionDistribution[]
	chipDistribution: MyFplCompetitionDistribution[]
}

export interface MyFplCompetitionsDesk {
	state: MyFplReviewState
	context: MyFplReviewContext
	tournaments: EntryTournament[]
	selectedTournamentId: number | null
	selectedTournament: EntryTournament | null
	eventId: number | null
	board: MyFplCompetitionBoardPage | null
	aggregate: MyFplCompetitionAggregate | null
}

export interface MyFplCompetitionSeasonPathPoint {
	gameweek: number
	tournamentRank: number | null
	gapToLeader: number | null
	pointsVsAverage: number | null
	fieldSize: number
	overallPoints: number | null
	leaderOverallPoints: number | null
	averageOverallPoints: number | null
}

export interface MyFplCompetitionSeasonPath {
	state: MyFplReviewState
	context: MyFplReviewContext
	tournamentId: number
	throughEventId: number
	points: MyFplCompetitionSeasonPathPoint[]
}

export interface MyFplTeamDeskResponse {
	myFplTeamDesk: MyFplTeamDesk
}

export interface MyFplTeamGameweekResponse {
	myFplTeamGameweek: MyFplTeamGameweek
}

export interface MyFplTeamTransfersResponse {
	myFplTeamTransfers: MyFplTeamTransfers
}

export interface MyFplCompetitionsDeskResponse {
	myFplCompetitionsDesk: MyFplCompetitionsDesk
}

export interface MyFplCompetitionBoardResponse {
	myFplCompetitionBoard: MyFplCompetitionBoardPage
}

export interface MyFplCompetitionSeasonPathResponse {
	myFplCompetitionSeasonPath: MyFplCompetitionSeasonPath
}

const ENTRY_FIELDS = `
      id
      entryName
      playerName
      region
      startedEvent
      overallPoints
      overallRank
      bank
      teamValue
      totalTransfers
`

const REVIEW_CONTEXT_FIELDS = `
      season
      coreRevision
      currentEventId
      nextEventId
      latestFinalizedEventId
`

const TEAM_HISTORY_FIELDS = `
        eventId
        eventPoints
        eventRank
        overallPoints
        overallRank
        eventTransfers
        eventTransfersCost
        eventNetPoints
        eventBenchPoints
        eventChip
        eventCaptainPoints
        captainWebName
        captainTeamShortName
        teamValue
        bank
`

const TEAM_PICK_FIELDS = `
          element
          position
          webName
          teamShortName
          teamName
          elementTypeName
          isCaptain
          isViceCaptain
          multiplier
          totalPoints
          minutes
          goalsScored
          assists
          cleanSheets
          goalsConceded
          yellowCards
          redCards
          saves
          bonus
          bps
          againstShortName
          wasHome
          score
          fixtureCount
          bgw
          dgw
          isPlayed
          autoSub
          expectedGoals
          expectedAssists
          expectedGoalInvolvements
          expectedGoalsConceded
`

const TRANSFER_FIELDS = `
          eventId
          elementInWebName
          elementInTypeName
          elementInTeamShortName
          elementInCost
          elementOutWebName
          elementOutTypeName
          elementOutTeamShortName
          elementOutCost
          time
`

const BOARD_ROW_FIELDS = `
          eventId
          groupId
          entryId
          entryName
          playerName
          rank
          previousRank
          fieldRank
          eventPoints
          eventCost
          eventNetPoints
          eventRank
          overallPoints
          overallRank
          eventChip
          captainId
          captainWebName
          captainTeamShortName
          captainPoints
          teamValue
          bank
`

const AGGREGATE_FIELDS = `
        eventId
        entryCount
        leaderOverallPoints
        secondOverallPoints
        gapFirstSecond
        averageOverallPoints
        metrics {
          key
          leaderValue
          leaderEntryId
          leaderEntryName
          leaderPlayerName
          averageValue
          higherIsBetter
        }
        viewer {
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
          overallPoints
          leaderOverallPoints
          gapToLeader
          pointsBehindNext
          pointsAheadOfPrev
        }
		topPerformers { entryId entryName playerName eventPoints eventNetPoints rank previousRank captainId captainWebName captainTeamShortName captainPoints }
		risers { entryId entryName playerName eventPoints eventNetPoints rank previousRank captainId captainWebName captainTeamShortName captainPoints }
		fallers { entryId entryName playerName eventPoints eventNetPoints rank previousRank captainId captainWebName captainTeamShortName captainPoints }
		captainDistribution { key label teamShortName count percentage averagePoints }
		chipDistribution { key label teamShortName count percentage averagePoints }
`

export const GET_MY_FPL_TEAM_DESK = `
  query GetMyFplTeamDesk($eventId: Int) {
    myFplTeamDesk(eventId: $eventId) {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      entry {${ENTRY_FIELDS}}
      history {${TEAM_HISTORY_FIELDS}}
      pastSeasons { season totalPoints overallRank }
      pastSeasonsState
      selectedEventId
      gameweek {
        state
        context {${REVIEW_CONTEXT_FIELDS}}
        eventId
        entry {${ENTRY_FIELDS}}
        result {
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
          playedCaptainWebName
          teamValue
          bank
          picks {${TEAM_PICK_FIELDS}}
        }
      }
    }
  }
`

export const GET_MY_FPL_TEAM_GAMEWEEK = `
  query GetMyFplTeamGameweek($eventId: Int!) {
    myFplTeamGameweek(eventId: $eventId) {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      eventId
      entry {${ENTRY_FIELDS}}
      result {
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
        playedCaptainWebName
        teamValue
        bank
        picks {${TEAM_PICK_FIELDS}}
      }
    }
  }
`

export const GET_MY_FPL_TEAM_TRANSFERS = `
  query GetMyFplTeamTransfers {
    myFplTeamTransfers {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      gameweeks {
        eventId
        eventTransfers
        eventTransfersCost
        transfers {${TRANSFER_FIELDS}}
      }
    }
  }
`

export const GET_MY_FPL_COMPETITIONS_DESK = `${TOURNAMENT_INFO_FIELDS}
  query GetMyFplCompetitionsDesk($tournamentId: Int, $eventId: Int) {
    myFplCompetitionsDesk(tournamentId: $tournamentId, eventId: $eventId) {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      tournaments { ...TournamentInfoFields }
      selectedTournamentId
      selectedTournament { ...TournamentInfoFields }
      eventId
      board {
        state
        eventId
        page
        pageSize
        totalRows
        totalPages
        fieldSize
        rows {${BOARD_ROW_FIELDS}}
        viewerRow {${BOARD_ROW_FIELDS}}
      }
      aggregate {${AGGREGATE_FIELDS}}
    }
  }
`

export const GET_MY_FPL_COMPETITION_BOARD = `
  query GetMyFplCompetitionBoard(
    $tournamentId: Int!
    $eventId: Int!
    $page: Int
    $pageSize: Int
    $search: String
  ) {
    myFplCompetitionBoard(
      tournamentId: $tournamentId
      eventId: $eventId
      page: $page
      pageSize: $pageSize
      search: $search
    ) {
      state
      eventId
      page
      pageSize
      totalRows
      totalPages
      fieldSize
      rows {${BOARD_ROW_FIELDS}}
      viewerRow {${BOARD_ROW_FIELDS}}
    }
  }
`

export const GET_MY_FPL_COMPETITION_SEASON_PATH = `
  query GetMyFplCompetitionSeasonPath($tournamentId: Int!, $throughEventId: Int!) {
    myFplCompetitionSeasonPath(
      tournamentId: $tournamentId
      throughEventId: $throughEventId
    ) {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      tournamentId
      throughEventId
      points {
        gameweek
        tournamentRank
        gapToLeader
        pointsVsAverage
        fieldSize
        overallPoints
        leaderOverallPoints
        averageOverallPoints
      }
    }
  }
`
