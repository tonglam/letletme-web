import type { EntryTournament, TournamentSeasonMetricKey } from './tournaments'
import { TOURNAMENT_INFO_FIELDS } from './tournaments'

export type MyFplReviewState =
	'PRESEASON' | 'PENDING' | 'READY' | 'EMPTY' | 'UNAVAILABLE'

export type MyFplTimelineStatus = 'PROVISIONAL' | 'FINAL'
export type MyFplSettlementState =
	'PROVISIONAL' | 'FINALIZING' | 'FINAL' | 'DELAYED'
export type MyFplCoverageState = 'COMPLETE' | 'CORRECTION_PENDING'
export type MyFplTimelinessState = 'CURRENT' | 'STALE'
export type MyFplScoreSource = 'FPL_EVENT_LIVE' | 'FPL_FINAL_RESULT'

export interface MyFplSnapshotMeta {
	revision: string
	eventId: number
	snapshotDate: string
	sourceCheckedAt: string
	publishedAt: string
	settlementState: MyFplSettlementState
	coverageState: MyFplCoverageState
	timelinessState: MyFplTimelinessState
	expectedEntryCount: number
	observedEntryCount: number
	finalizationStartedAt: string | null
	finalizationDueAt: string | null
	scoreSource: MyFplScoreSource
	livePublicationId: string | null
	liveRevision: string | null
	algorithmVersion: string | null
	sourceMinCheckedAt: string
	sourceMaxCheckedAt: string
}

export interface MyFplReviewContext {
	season: string
	coreRevision: string
	currentEventId: number | null
	nextEventId: number | null
	latestFinalizedEventId: number | null
	latestPublishedEventId: number | null
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

export interface MyFplManagerPositionPoints {
	goalkeeper: number
	defender: number
	midfielder: number
	forward: number
	assistantManager: number
	total: number
}

export interface MyFplManagerCaptainReview {
	captainElement: number | null
	captainWebName: string | null
	captainTeamShortName: string | null
	captainBasePoints: number
	captainContribution: number
	viceCaptainElement: number | null
	viceCaptainWebName: string | null
	viceCaptainBasePoints: number
	bestSquadElement: number | null
	bestSquadWebName: string | null
	bestSquadPoints: number
	regretPoints: number | null
}

export interface MyFplManagerAutomaticSubstitution {
	elementIn: number
	elementInWebName: string
	elementOut: number
	elementOutWebName: string
	pointsGained: number
}

export interface MyFplManagerGameweekReview {
	formation: string
	lineupBasePoints: number
	bestElevenPoints: number
	benchRegretPoints: number | null
	positionPoints: MyFplManagerPositionPoints
	captain: MyFplManagerCaptainReview
	automaticSubstitutions: MyFplManagerAutomaticSubstitution[]
}

export interface MyFplManagerTimelineRow {
	eventId: number
	status: MyFplTimelineStatus
	eventPoints: number
	eventRank: number | null
	overallPoints: number
	overallRank: number | null
	overallRankDelta: number | null
	eventTransfers: number
	eventTransfersCost: number
	eventNetPoints: number
	eventBenchPoints: number
	eventAutoSubPoints: number
	eventChip: string
	eventCaptainPoints: number
	captainWebName: string | null
	captainTeamShortName: string | null
	teamValue: number | null
	bank: number | null
	review: MyFplManagerGameweekReview
}

export interface MyFplPastSeason {
	season: string
	totalPoints: number
	overallRank: number
}

export interface MyFplManagerPick {
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

export interface MyFplManagerGameweekResult {
	eventId: number
	eventPoints: number
	eventRank: number | null
	overallPoints: number
	overallRank: number | null
	eventTransfers: number
	eventTransfersCost: number
	eventNetPoints: number
	eventBenchPoints: number
	eventAutoSubPoints: number
	eventChip: string
	eventCaptainPoints: number
	playedCaptainWebName: string | null
	playedCaptainTeamShortName: string | null
	teamValue: number | null
	bank: number | null
	picks: MyFplManagerPick[]
}

export interface MyFplManagerGameweek {
	state: MyFplReviewState
	context: MyFplReviewContext
	eventId: number
	entry: MyFplEntryIdentity | null
	result: MyFplManagerGameweekResult | null
	review: MyFplManagerGameweekReview | null
	snapshotMeta?: MyFplSnapshotMeta | null
}

export interface MyFplManagerFormationCount {
	formation: string
	gameweeks: number
}

export interface MyFplManagerChipReview {
	chip: string
	eventId: number
	status: MyFplTimelineStatus
	eventNetPoints: number
	otherGameweeksAverageNetPoints: number | null
	differenceFromOtherGameweeks: number | null
	overallRankDelta: number | null
}

export interface MyFplManagerSeasonSummary {
	gameweeksReviewed: number
	provisionalGameweeks: number
	totalNetPoints: number
	averageNetPoints: number
	medianNetPoints: number
	bestGameweekId: number | null
	bestNetPoints: number | null
	worstGameweekId: number | null
	worstNetPoints: number | null
	totalHitPoints: number
	hitGameweeks: number
	totalBenchPoints: number
	averageBenchPoints: number
	zeroBenchGameweeks: number
	highBenchGameweeks: number
	totalAutoSubPoints: number
	autoSubGameweeks: number
	totalCaptainPoints: number
	uniqueCaptains: number
	captainBlankGameweeks: number
	topCaptainWebName: string | null
	topCaptainGameweeks: number
	topCaptainRate: number
	bestOverallRank: number | null
	worstOverallRank: number | null
	overallRankChange: number | null
	currentImprovementStreak: number
	longestImprovementStreak: number
	formations: MyFplManagerFormationCount[]
	positionPoints: MyFplManagerPositionPoints
	chips: MyFplManagerChipReview[]
}

export interface MyFplManagerHoldingPeriod {
	element: number
	webName: string
	teamShortName: string
	elementTypeName: string
	startedEventId: number
	endedEventId: number | null
	gameweeksHeld: number
	starts: number
	captaincies: number
	pointsWhileOwned: number
	scoringContribution: number
}

export interface MyFplTransferMove {
	eventId: number
	elementIn: number | null
	elementInWebName: string
	elementInTypeName: string
	elementInTeamShortName: string
	elementInCost: number
	elementInPoints: number | null
	elementInPlayed: boolean | null
	elementOut: number | null
	elementOutWebName: string
	elementOutTypeName: string
	elementOutTeamShortName: string
	elementOutCost: number
	elementOutPoints: number | null
	sameGameweekGain: number | null
	threeGameweekGain: number | null
	fiveGameweekGain: number | null
	evaluatedThroughEventId: number | null
	time: string
}

export interface MyFplTransferGameweek {
	eventId: number
	eventTransfers: number
	eventTransfersCost: number
	transfers: MyFplTransferMove[]
}

export interface MyFplSelectionRulePosition {
	id: number
	name: string
	shortName: string
	squadSelect: number
	minPlay: number
	maxPlay: number
}

export interface MyFplSelectionRuleChipWindow {
	id: number
	name: string
	number: number
	startEvent: number
	stopEvent: number
	chipType: string
}

export interface MyFplSelectionRules {
	squadSize: number
	startingSize: number
	budget: number
	maxPlayersPerTeam: number
	currencyMultiplier: number
	positions: MyFplSelectionRulePosition[]
	chips: MyFplSelectionRuleChipWindow[]
}

export interface MyFplManagerReview {
	state: MyFplReviewState
	context: MyFplReviewContext
	entry: MyFplEntryIdentity | null
	throughEventId: number | null
	timeline: MyFplManagerTimelineRow[]
	summary: MyFplManagerSeasonSummary | null
	holdings: MyFplManagerHoldingPeriod[]
	transfers: MyFplTransferGameweek[]
	pastSeasons: MyFplPastSeason[]
	pastSeasonsState: MyFplReviewState
	currentGameweek: MyFplManagerGameweek | null
	rules: MyFplSelectionRules | null
	snapshotMeta: MyFplSnapshotMeta | null
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
	snapshotMeta?: MyFplSnapshotMeta | null
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
	snapshotMeta?: MyFplSnapshotMeta | null
}

export interface MyFplCompetitionsDesk {
	state: MyFplReviewState
	context: MyFplReviewContext
	tournaments: EntryTournament[]
	selectedTournamentId: number | null
	selectedTournament: EntryTournament | null
	eventId: number | null
	/** Loaded by the dedicated board root after the desk/list request. */
	board?: MyFplCompetitionBoardPage | null
	aggregate: MyFplCompetitionAggregate | null
	snapshotMeta: MyFplSnapshotMeta | null
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
	snapshotMeta: MyFplSnapshotMeta | null
}

export interface MyFplManagerReviewResponse {
	myFplManagerReview: MyFplManagerReview
}

export interface MyFplManagerGameweekResponse {
	myFplManagerGameweek: MyFplManagerGameweek
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
      latestPublishedEventId
`

const SNAPSHOT_META_FIELDS = `
      revision
      eventId
      snapshotDate
      sourceCheckedAt
      publishedAt
      settlementState
      coverageState
      timelinessState
      expectedEntryCount
      observedEntryCount
      finalizationStartedAt
      finalizationDueAt
      scoreSource
      livePublicationId
      liveRevision
      algorithmVersion
      sourceMinCheckedAt
      sourceMaxCheckedAt
`

const MANAGER_GAMEWEEK_REVIEW_FIELDS = `
        formation
        lineupBasePoints
        bestElevenPoints
        benchRegretPoints
        positionPoints {
          goalkeeper
          defender
          midfielder
          forward
		  assistantManager
          total
        }
        captain {
          captainElement
          captainWebName
          captainTeamShortName
          captainBasePoints
          captainContribution
          viceCaptainElement
          viceCaptainWebName
          viceCaptainBasePoints
          bestSquadElement
          bestSquadWebName
          bestSquadPoints
          regretPoints
        }
        automaticSubstitutions {
          elementIn
          elementInWebName
          elementOut
          elementOutWebName
          pointsGained
        }
`

const MANAGER_TIMELINE_FIELDS = `
        eventId
        status
        eventPoints
        eventRank
        overallPoints
        overallRank
        overallRankDelta
        eventTransfers
        eventTransfersCost
        eventNetPoints
        eventBenchPoints
        eventAutoSubPoints
        eventChip
        eventCaptainPoints
        captainWebName
        captainTeamShortName
        teamValue
        bank
        review {${MANAGER_GAMEWEEK_REVIEW_FIELDS}}
`

const MANAGER_PICK_FIELDS = `
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
          elementIn
          elementInWebName
          elementInTypeName
          elementInTeamShortName
          elementInCost
          elementInPoints
          elementInPlayed
          elementOut
          elementOutWebName
          elementOutTypeName
          elementOutTeamShortName
          elementOutCost
          elementOutPoints
          sameGameweekGain
          threeGameweekGain
          fiveGameweekGain
          evaluatedThroughEventId
          time
`

const MANAGER_GAMEWEEK_FIELDS = `
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      eventId
      entry {${ENTRY_FIELDS}}
      result {
        eventId
        eventPoints
        eventRank
        overallPoints
        overallRank
        eventTransfers
        eventTransfersCost
        eventNetPoints
        eventBenchPoints
        eventAutoSubPoints
        eventChip
        eventCaptainPoints
        playedCaptainWebName
        playedCaptainTeamShortName
        teamValue
        bank
        picks {${MANAGER_PICK_FIELDS}}
      }
      review {${MANAGER_GAMEWEEK_REVIEW_FIELDS}}
      snapshotMeta {${SNAPSHOT_META_FIELDS}}
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

export const GET_MY_FPL_MANAGER_REVIEW = `
  query GetMyFplManagerReview($snapshotRevision: String) {
    myFplManagerReview(snapshotRevision: $snapshotRevision) {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      entry {${ENTRY_FIELDS}}
      throughEventId
      timeline {${MANAGER_TIMELINE_FIELDS}}
      summary {
        gameweeksReviewed
        provisionalGameweeks
        totalNetPoints
        averageNetPoints
        medianNetPoints
        bestGameweekId
        bestNetPoints
        worstGameweekId
        worstNetPoints
        totalHitPoints
        hitGameweeks
        totalBenchPoints
        averageBenchPoints
        zeroBenchGameweeks
        highBenchGameweeks
        totalAutoSubPoints
        autoSubGameweeks
        totalCaptainPoints
        uniqueCaptains
        captainBlankGameweeks
        topCaptainWebName
        topCaptainGameweeks
        topCaptainRate
        bestOverallRank
        worstOverallRank
        overallRankChange
        currentImprovementStreak
        longestImprovementStreak
        formations { formation gameweeks }
        positionPoints { goalkeeper defender midfielder forward assistantManager total }
        chips {
          chip
          eventId
          status
          eventNetPoints
          otherGameweeksAverageNetPoints
          differenceFromOtherGameweeks
          overallRankDelta
        }
      }
      holdings {
        element
        webName
        teamShortName
        elementTypeName
        startedEventId
        endedEventId
        gameweeksHeld
        starts
        captaincies
        pointsWhileOwned
        scoringContribution
      }
      transfers {
        eventId
        eventTransfers
        eventTransfersCost
        transfers {${TRANSFER_FIELDS}}
      }
      pastSeasons { season totalPoints overallRank }
      pastSeasonsState
      currentGameweek {${MANAGER_GAMEWEEK_FIELDS}}
      rules {
        squadSize
        startingSize
        budget
        maxPlayersPerTeam
        currencyMultiplier
        positions { id name shortName squadSelect minPlay maxPlay }
        chips { id name number startEvent stopEvent chipType }
      }
      snapshotMeta {${SNAPSHOT_META_FIELDS}}
    }
  }
`

export const GET_MY_FPL_MANAGER_GAMEWEEK = `
  query GetMyFplManagerGameweek($eventId: Int!, $snapshotRevision: String) {
    myFplManagerGameweek(eventId: $eventId, snapshotRevision: $snapshotRevision) {
      ${MANAGER_GAMEWEEK_FIELDS}
    }
  }
`

export const GET_MY_FPL_COMPETITIONS_DESK = `${TOURNAMENT_INFO_FIELDS}
  query GetMyFplCompetitionsDesk($tournamentId: Int, $eventId: Int, $snapshotRevision: String) {
    myFplCompetitionsDesk(tournamentId: $tournamentId, eventId: $eventId, snapshotRevision: $snapshotRevision) {
      state
      context {${REVIEW_CONTEXT_FIELDS}}
      tournaments { ...TournamentInfoFields }
      selectedTournamentId
      selectedTournament { ...TournamentInfoFields }
      eventId
      aggregate {${AGGREGATE_FIELDS}}
      snapshotMeta {${SNAPSHOT_META_FIELDS}}
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
		$snapshotRevision: String
  ) {
    myFplCompetitionBoard(
      tournamentId: $tournamentId
      eventId: $eventId
      page: $page
		  pageSize: $pageSize
		  search: $search
		  snapshotRevision: $snapshotRevision
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
		  snapshotMeta {${SNAPSHOT_META_FIELDS}}
    }
  }
`

export const GET_MY_FPL_COMPETITION_SEASON_PATH = `
  query GetMyFplCompetitionSeasonPath($tournamentId: Int!, $throughEventId: Int!, $snapshotRevision: String) {
    myFplCompetitionSeasonPath(
      tournamentId: $tournamentId
      throughEventId: $throughEventId
      snapshotRevision: $snapshotRevision
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
      snapshotMeta {${SNAPSHOT_META_FIELDS}}
    }
  }
`

export type MyTournamentReviewScope = 'ACCESSIBLE' | 'ALL'
export type MyTournamentReviewFormat = 'POINTS' | 'H2H' | 'KNOCKOUT'
export type MyTournamentReviewState =
	'PENDING' | 'WAITING_SOURCE' | 'READY' | 'DEGRADED' | 'UNAVAILABLE'

export interface MyTournamentReviewCatalogItem {
	tournamentId: number
	name: string
	creator: string
	leagueId: number
	leagueType: string
	totalTeamNum: number
	latestFinalizedEventId: number | null
	latestAvailableEventId: number | null
	latestRevision: string | null
	latestFormat: MyTournamentReviewFormat | null
	state: MyTournamentReviewState
	publishedAt: string | null
}

export interface MyTournamentReviewCatalogResponse {
	myTournamentReviewCatalog: {
		state: MyTournamentReviewState
		asOf: string
		viewerEntryId: number | null
		adminReadAll: boolean
		tournaments: MyTournamentReviewCatalogItem[]
	}
}

export interface MyTournamentReviewFreshness {
	eventDataCheckedAt: string
	sourceMinCheckedAt: string
	sourceMaxCheckedAt: string
	publishedAt: string
	ageSeconds: number
}

export interface MyTournamentReviewScopeMeta {
	tournamentId: number
	eventId: number
	revision: string
	format: MyTournamentReviewFormat
	state: MyTournamentReviewState
	freshness: MyTournamentReviewFreshness | null
	rowCount: number
	expectedSubjectCount: number
	readySubjectCount: number
	notApplicableSubjectCount: number
	contentSha256: string | null
}

export interface MyTournamentReviewPointsRow {
	entryId: number
	entryName: string
	playerName: string
	applicable: boolean
	groupId: number | null
	rank: number | null
	previousRank: number | null
	grossPoints: number | null
	transferCost: number | null
	netPoints: number | null
	tournamentScore: number | null
	seasonGrossPoints: number | null
	seasonNetPoints: number | null
	eventRank: number | null
	overallPoints: number | null
	overallRank: number | null
}

export interface MyTournamentReviewPoints {
	headlineMetric: string
	grossPointsTotal: number
	grossPointsAverage: number
	netPointsTotal: number
	seasonGrossPointsTotal: number
	seasonGrossPointsAverage: number
	seasonNetPointsTotal: number
	rows: MyTournamentReviewPointsRow[]
	nextCursor: string | null
	hasNextPage: boolean
}

export interface MyTournamentReviewH2HSide {
	entryId: number | null
	entryName: string
	isAverage: boolean
	grossPoints: number | null
	transferCost: number | null
	netPoints: number | null
	matchPoints: number | null
	rank: number | null
}

export interface MyTournamentReviewH2HMatch {
	matchId: string
	groupId: number
	home: MyTournamentReviewH2HSide | null
	away: MyTournamentReviewH2HSide | null
	isBye: boolean
}

export interface MyTournamentReviewH2HStanding {
	groupId: number
	entryId: number
	entryName: string
	rank: number
	played: number
	won: number
	drawn: number
	lost: number
	matchPoints: number
	pointsFor: number
	pointsAgainst: number
}

export interface MyTournamentReviewH2H {
	matches: MyTournamentReviewH2HMatch[]
	standings: MyTournamentReviewH2HStanding[]
	nextCursor: string | null
	hasNextPage: boolean
}

export interface MyTournamentReviewKnockoutSide {
	entryId: number
	entryName: string
	grossPoints: number | null
	transferCost: number | null
	netPoints: number | null
	goalsScored: number | null
	goalsConceded: number | null
}

export interface MyTournamentReviewKnockoutMatch {
	round: number | null
	name: string | null
	matchId: number
	playAgainstId: number
	home: MyTournamentReviewKnockoutSide | null
	away: MyTournamentReviewKnockoutSide | null
	winnerEntryId: number | null
}

export interface MyTournamentReviewKnockout {
	matches: MyTournamentReviewKnockoutMatch[]
	nextCursor: string | null
	hasNextPage: boolean
}

export interface MyTournamentGameweekReview {
	state: MyTournamentReviewState
	scope: MyTournamentReviewScopeMeta | null
	points: MyTournamentReviewPoints | null
	h2h: MyTournamentReviewH2H | null
	knockout: MyTournamentReviewKnockout | null
}

export interface MyTournamentGameweekReviewResponse {
	myTournamentGameweekReview: MyTournamentGameweekReview
}

export interface MyTournamentSeasonReview {
	state: MyTournamentReviewState
	tournamentId: number
	throughEventId: number
	latestEventId: number | null
	latestRevision: string | null
	format: MyTournamentReviewFormat | null
	freshness: MyTournamentReviewFreshness | null
	finalizedEventIds: number[]
	points: MyTournamentReviewPoints | null
	h2h: MyTournamentReviewH2H | null
	knockout: MyTournamentReviewKnockout | null
}

export interface MyTournamentSeasonReviewResponse {
	myTournamentSeasonReview: MyTournamentSeasonReview
}

const REVIEW_SCOPE_META_FIELDS = `
  tournamentId eventId revision format state
  freshness { eventDataCheckedAt sourceMinCheckedAt sourceMaxCheckedAt publishedAt ageSeconds }
  rowCount expectedSubjectCount readySubjectCount notApplicableSubjectCount contentSha256
`
const REVIEW_POINTS_FIELDS = `
  headlineMetric grossPointsTotal grossPointsAverage netPointsTotal
  seasonGrossPointsTotal seasonGrossPointsAverage seasonNetPointsTotal
  nextCursor hasNextPage
  rows {
    entryId entryName playerName applicable groupId rank previousRank grossPoints transferCost
    netPoints tournamentScore seasonGrossPoints seasonNetPoints eventRank overallPoints overallRank
  }
`
const REVIEW_H2H_FIELDS = `
  nextCursor hasNextPage
  matches {
    matchId groupId isBye
    home { entryId entryName isAverage grossPoints transferCost netPoints matchPoints rank }
    away { entryId entryName isAverage grossPoints transferCost netPoints matchPoints rank }
  }
	standings {
		groupId entryId entryName rank played won drawn lost matchPoints pointsFor pointsAgainst
	}
`
const REVIEW_KNOCKOUT_FIELDS = `
  nextCursor hasNextPage
  matches {
    round name matchId playAgainstId winnerEntryId
    home { entryId entryName grossPoints transferCost netPoints goalsScored goalsConceded }
    away { entryId entryName grossPoints transferCost netPoints goalsScored goalsConceded }
  }
`

export const GET_MY_TOURNAMENT_REVIEW_CATALOG = `
  query GetMyTournamentReviewCatalog($scope: MyTournamentReviewScope = ACCESSIBLE) {
    myTournamentReviewCatalog(scope: $scope) {
      state asOf viewerEntryId adminReadAll
      tournaments {
        tournamentId name creator leagueId leagueType totalTeamNum
        latestFinalizedEventId latestAvailableEventId latestRevision latestFormat state publishedAt
      }
    }
  }
`

export const GET_MY_TOURNAMENT_GAMEWEEK_REVIEW = `
  query GetMyTournamentGameweekReview(
    $tournamentId: Int!
    $eventId: Int!
    $first: Int = 100
    $after: String
    $revision: String
  ) {
    myTournamentGameweekReview(
      tournamentId: $tournamentId eventId: $eventId first: $first after: $after revision: $revision
    ) {
      state
      scope {${REVIEW_SCOPE_META_FIELDS}}
      points {${REVIEW_POINTS_FIELDS}}
      h2h {${REVIEW_H2H_FIELDS}}
      knockout {${REVIEW_KNOCKOUT_FIELDS}}
    }
  }
`

export const GET_MY_TOURNAMENT_SEASON_REVIEW = `
  query GetMyTournamentSeasonReview(
    $tournamentId: Int!
    $throughEventId: Int!
    $first: Int = 100
    $after: String
  ) {
    myTournamentSeasonReview(
      tournamentId: $tournamentId
      throughEventId: $throughEventId
      first: $first
      after: $after
    ) {
      state tournamentId throughEventId latestEventId latestRevision format
      freshness { eventDataCheckedAt sourceMinCheckedAt sourceMaxCheckedAt publishedAt ageSeconds }
      finalizedEventIds
      points {${REVIEW_POINTS_FIELDS}}
      h2h {${REVIEW_H2H_FIELDS}}
      knockout {${REVIEW_KNOCKOUT_FIELDS}}
    }
  }
`

export const GET_MY_TOURNAMENT_REVIEW_STATUS = `
  query GetMyTournamentReviewStatus($tournamentId: Int!) {
    myTournamentReviewStatus(tournamentId: $tournamentId) {
      tournamentId latestFinalizedEventId latestAvailableEventId
      events { eventId format state nextAttemptAt executionAttempts sourceRechecks degradedAt revision publishedAt }
    }
  }
`
