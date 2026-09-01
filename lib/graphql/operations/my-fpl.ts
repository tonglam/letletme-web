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

export interface MyFplManagerReviewResponse {
	myFplManagerReview: MyFplManagerReview
}

export interface MyFplManagerGameweekResponse {
	myFplManagerGameweek: MyFplManagerGameweek
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

export type MyTournamentReviewScope = 'ACCESSIBLE' | 'MANAGED' | 'ALL'
export type MyTournamentReviewFormat = 'POINTS' | 'H2H' | 'KNOCKOUT'
export type MyTournamentReviewState =
	| 'NOT_STARTED'
	| 'PENDING'
	| 'WAITING_SOURCE'
	| 'READY'
	| 'DEGRADED'
	| 'UNAVAILABLE'

export interface MyTournamentReviewCatalogItem {
	tournamentId: number
	name: string
	creator: string
	leagueId: number
	leagueType: string
	totalTeamNum: number
	latestFinalizedEventId: number | null
	previousReadyEventId: number | null
	setupStatus: string
	latestFinalizedScope: MyTournamentReviewEventStatus | null
	phaseSummaries: MyTournamentReviewPhaseSummary[]
	state: MyTournamentReviewState
}

export interface MyTournamentReviewPhaseSummary {
	phaseId: string
	format: MyTournamentReviewFormat
	startEventId: number
	endEventId: number | null
	state: MyTournamentReviewState
}

export interface MyTournamentReviewEventStatus {
	eventId: number
	format: MyTournamentReviewFormat
	state: MyTournamentReviewState
	nextAttemptAt: string | null
	executionAttempts: number
	sourceRechecks: number
	degradedAt: string | null
	revision: string | null
	publishedAt: string | null
}

export interface MyTournamentReviewPageInfo {
	hasNextPage: boolean
	endCursor: string | null
}

export interface MyTournamentReviewCatalogResponse {
	myTournamentReviewCatalog: {
		state: MyTournamentReviewState
		asOf: string
		viewerEntryId: number | null
		adminReadAll: boolean
		edges: Array<{ cursor: string; node: MyTournamentReviewCatalogItem }>
		pageInfo: MyTournamentReviewPageInfo
	}
}

export interface MyTournamentReviewScopeMeta {
	tournamentId: number
	eventId: number
	revision: string
	format: MyTournamentReviewFormat
	state: MyTournamentReviewState
	settledAt: string
	publishedAt: string
	correctedAt: string | null
	semanticSha256: string
	rowCount: number
	expectedSubjectCount: number
	readySubjectCount: number
	notApplicableSubjectCount: number
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
	payload: MyTournamentReviewPayload | null
	/** Normalized client view; populated from payload, never queried as a
	 * sibling GraphQL field. */
	points?: MyTournamentReviewPoints | null
	h2h?: MyTournamentReviewH2H | null
	knockout?: MyTournamentReviewKnockout | null
}

export type MyTournamentReviewPayload =
	| { format: 'POINTS'; points: MyTournamentReviewPoints }
	| { format: 'H2H'; h2h: MyTournamentReviewH2H }
	| { format: 'KNOCKOUT'; knockout: MyTournamentReviewKnockout }

export interface MyTournamentGameweekReviewResponse {
	myTournamentGameweekReview: MyTournamentGameweekReview
}

export interface MyTournamentSeasonReview {
	state: MyTournamentReviewState
	tournamentId: number
	throughEventId: number
	latestFinalizedEventId: number | null
	phases: MyTournamentReviewPhase[]
	/** Normalized section data attached by the client after the phase query. */
	latestEventId?: number | null
	latestRevision?: string | null
	format?: MyTournamentReviewFormat | null
	points?: MyTournamentReviewPoints | null
	/** Normalized client view of the independent Points trajectory section. */
	trajectoryPoints?: MyTournamentReviewPoints | null
	h2h?: MyTournamentReviewH2H | null
	knockout?: MyTournamentReviewKnockout | null
	finalizedEventIds?: number[]
}

export interface MyTournamentReviewPhase {
	phaseId: string
	format: MyTournamentReviewFormat
	startEventId: number
	endEventId: number
	state: MyTournamentReviewState
	settledAt: string | null
	publishedAt: string | null
	correctedAt: string | null
	revision: string | null
	semanticSha256: string | null
}

export interface MyTournamentSeasonSection {
	state: MyTournamentReviewState
	tournamentId: number
	throughEventId: number
	phaseId: string
	section:
		| 'POINTS_STANDINGS'
		| 'POINTS_TRAJECTORIES'
		| 'H2H_STANDINGS'
		| 'H2H_FIXTURES'
		| 'KNOCKOUT_BRACKET'
	revision: string
	semanticSha256: string
	points: MyTournamentReviewPoints | null
	h2h: MyTournamentReviewH2H | null
	knockout: MyTournamentReviewKnockout | null
	pageInfo: MyTournamentReviewPageInfo
}

export interface MyTournamentSeasonSectionResponse {
	myTournamentSeasonReviewSection: MyTournamentSeasonSection
}

export interface MyTournamentSeasonReviewResponse {
	myTournamentSeasonReview: MyTournamentSeasonReview
}

const REVIEW_SCOPE_META_FIELDS = `
  tournamentId eventId revision format state
  settledAt publishedAt correctedAt semanticSha256
  rowCount expectedSubjectCount readySubjectCount notApplicableSubjectCount
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
  query GetMyTournamentReviewCatalog(
    $scope: MyTournamentReviewScope = ACCESSIBLE
    $first: Int = 50
    $after: String
    $search: String
  ) {
    myTournamentReviewCatalog(scope: $scope, first: $first, after: $after, search: $search) {
      state asOf viewerEntryId adminReadAll
      edges {
        cursor
        node {
          tournamentId name creator leagueId leagueType totalTeamNum
          latestFinalizedEventId previousReadyEventId setupStatus state
          latestFinalizedScope { eventId format state nextAttemptAt executionAttempts sourceRechecks degradedAt revision publishedAt }
          phaseSummaries { phaseId format startEventId endEventId state }
        }
      }
      pageInfo { hasNextPage endCursor }
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
      payload {
        format
        ... on MyTournamentReviewPointsPayload { points {${REVIEW_POINTS_FIELDS}} }
        ... on MyTournamentReviewH2HPayload { h2h {${REVIEW_H2H_FIELDS}} }
        ... on MyTournamentReviewKnockoutPayload { knockout {${REVIEW_KNOCKOUT_FIELDS}} }
      }
    }
  }
`

export const GET_MY_TOURNAMENT_SEASON_REVIEW = `
  query GetMyTournamentSeasonReview($tournamentId: Int!, $throughEventId: Int!) {
    myTournamentSeasonReview(
      tournamentId: $tournamentId
      throughEventId: $throughEventId
    ) {
      state tournamentId throughEventId latestFinalizedEventId
      phases { phaseId format startEventId endEventId state settledAt publishedAt correctedAt revision semanticSha256 }
    }
  }
`

export const GET_MY_TOURNAMENT_SEASON_REVIEW_SECTION = `
  query GetMyTournamentSeasonReviewSection(
    $tournamentId: Int!
    $throughEventId: Int!
    $phaseId: String!
    $section: MyTournamentReviewSeasonSection!
    $first: Int = 50
    $after: String
    $revision: String!
    $semanticSha256: String!
  ) {
    myTournamentSeasonReviewSection(
      tournamentId: $tournamentId throughEventId: $throughEventId phaseId: $phaseId
      section: $section first: $first after: $after revision: $revision semanticSha256: $semanticSha256
    ) {
      state tournamentId throughEventId phaseId section revision semanticSha256
      pageInfo { hasNextPage endCursor }
      points {${REVIEW_POINTS_FIELDS}}
      h2h {${REVIEW_H2H_FIELDS}}
      knockout {${REVIEW_KNOCKOUT_FIELDS}}
    }
  }
`

export const GET_MY_TOURNAMENT_REVIEW_STATUS = `
  query GetMyTournamentReviewStatus($tournamentId: Int!) {
    myTournamentReviewStatus(tournamentId: $tournamentId) {
      tournamentId latestFinalizedEventId
      events { eventId format state nextAttemptAt executionAttempts sourceRechecks degradedAt revision publishedAt }
    }
  }
`
