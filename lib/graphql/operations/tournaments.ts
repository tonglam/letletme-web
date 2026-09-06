import type {
	LiveDelivery,
	LivePointsScore,
	LiveRevisionVector,
	LiveSnapshotStatus,
	LiveTimes
} from './live'

const LIVE_POINTS_SCORE_FRAGMENT = `
  fragment LivePointsScoreFields on LiveScore {
    eventPoints
    netEventPoints
    totalPoints
    totalScope
    transferCost
    source
    calculationMode
    revisions {
      publicationId generation lifecycle fixtureIdentity scoreCore displayStats
      explain picksBase officialAdjustment previousTotals finalResult rules algorithm input
    }
    times { sourceCheckedAt contentUpdatedAt publishedAt checkpointedAt servedAt staleAt nextRefreshAt }
    delivery { state servedFrom reasonCodes }
  }
`

// Tournament desks only need the fields required to render and rank rows.
// Keep the full revision vector on the canonical entry/live-points queries,
// but do not repeat explain/display metadata for every board row.
const LIVE_POINTS_SCORE_SUMMARY_FRAGMENT = `
  fragment LivePointsScoreSummaryFields on LiveScore {
    eventPoints
    netEventPoints
    totalPoints
    totalScope
    transferCost
    source
    calculationMode
    revisions { input }
    times { sourceCheckedAt contentUpdatedAt nextRefreshAt }
    delivery { state }
  }
`

export const TOURNAMENT_INFO_FIELDS = `
  fragment TournamentInfoFields on TournamentInfo {
    id
    name
    creator
    adminEntryId
    leagueId
    leagueType
    sourceLeagueName
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
    rosterMode
    rosterSyncStatus
    rosterLastSyncedAt
    officialScheduleHash
    officialScheduleSyncedAt
    officialScheduleLockedAt
    setupStatus
    setupPhase
    setupCompletedUnits
    setupTotalUnits
    setupProgressUpdatedAt
    setupProgressMode
    setupAttempt
    setupMaxAttempts
    nextRetryAt
    standingsReadyAt
    profilesReadyAt
    insightsReadyAt
    setupHasWarnings
    warningSummaries { category affectedCount repairExhausted }
    setupStartedAt
    setupFinishedAt
    createdAt
    updatedAt
  }
`

export const GET_ENTRY_TOURNAMENTS = `${TOURNAMENT_INFO_FIELDS}
  query GetEntryTournaments($entryId: Int!) {
    entryTournaments: entryParticipatingTournaments(entryId: $entryId) {
      ...TournamentInfoFields
    }
  }
`

/**
 * Platform-admin live pages need the management scope so tournaments where
 * the admin is not a participant remain selectable. The alias keeps the
 * response shape identical to GET_ENTRY_TOURNAMENTS for the shared client.
 */
export const GET_PLATFORM_ADMIN_TOURNAMENTS = `${TOURNAMENT_INFO_FIELDS}
  query GetPlatformAdminTournaments($entryId: Int!) {
    entryTournaments: manageableTournaments(entryId: $entryId) {
      ...TournamentInfoFields
    }
  }
`

/**
 * List-page projection only — avoid the full TournamentInfoFields payload
 * (knockout sizing, setup unit counters, etc.) on every list navigation.
 */
export const GET_ENTRY_TOURNAMENTS_LIST = `
  query GetEntryTournamentsList($entryId: Int!) {
    entryTournaments: entryParticipatingTournaments(entryId: $entryId) {
      id
      name
      creator
      adminEntryId
      leagueType
      sourceLeagueName
      totalTeamNum
      groupMode
      knockoutMode
      groupStartedEventId
      groupEndedEventId
      state
      rosterSyncStatus
      setupStatus
      setupProgressMode
      setupAttempt
      setupMaxAttempts
      nextRetryAt
      standingsReadyAt
      profilesReadyAt
      insightsReadyAt
      setupHasWarnings
      warningSummaries { category affectedCount repairExhausted }
      updatedAt
    }
  }
`

export const GET_MANAGEABLE_TOURNAMENTS = `${TOURNAMENT_INFO_FIELDS}
  query GetManageableTournaments($entryId: Int!) {
    manageableTournaments(entryId: $entryId) {
      ...TournamentInfoFields
    }
  }
`

export const GET_MANAGEABLE_TOURNAMENTS_LIST = `
  query GetManageableTournamentsList($entryId: Int!) {
    manageableTournaments(entryId: $entryId) {
      id
      name
      creator
      adminEntryId
      leagueType
      sourceLeagueName
      totalTeamNum
      groupMode
      knockoutMode
      groupStartedEventId
      groupEndedEventId
      state
      rosterSyncStatus
      setupStatus
      setupProgressMode
      setupAttempt
      setupMaxAttempts
      nextRetryAt
      standingsReadyAt
      profilesReadyAt
      insightsReadyAt
      setupHasWarnings
      warningSummaries { category affectedCount repairExhausted }
      updatedAt
    }
  }
`

export type EntryTournamentState = 'ACTIVE' | 'INACTIVE' | 'FINISHED'
export type TournamentSetupStatus =
	'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
export type TournamentSetupPhase =
	| 'QUEUED'
	| 'SYNCING_ENTRIES'
	| 'BUILDING_STRUCTURE'
	| 'CALCULATING_STANDINGS'
	| 'ENRICHING_HISTORY'
	| 'FINALIZING'
	| 'READY'
	| 'FAILED'
export type TournamentRosterMode = 'SNAPSHOT' | 'OFFICIAL_SYNC'
export type TournamentSetupProgressMode = 'DETERMINATE' | 'INDETERMINATE'
export type TournamentSetupWarningCategory = 'PROFILES' | 'INSIGHTS' | 'RESULTS'

export interface TournamentSetupWarningSummary {
	category: TournamentSetupWarningCategory
	affectedCount: number
	repairExhausted?: boolean
}

export interface EntryTournament {
	id: number
	name: string
	creator: string
	adminEntryId: number
	leagueId: number
	leagueType: string
	sourceLeagueName: string | null
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
	state: EntryTournamentState
	rosterMode: TournamentRosterMode
	rosterSyncStatus: TournamentSetupStatus | null
	rosterLastSyncedAt: string | null
	officialScheduleHash: string | null
	officialScheduleSyncedAt: string | null
	officialScheduleLockedAt: string | null
	setupStatus: TournamentSetupStatus
	setupPhase: TournamentSetupPhase
	setupCompletedUnits: number
	setupTotalUnits: number
	setupProgressUpdatedAt: string | null
	setupProgressMode?: TournamentSetupProgressMode
	setupAttempt?: number
	setupMaxAttempts?: number
	nextRetryAt?: string | null
	standingsReadyAt: string | null
	profilesReadyAt?: string | null
	insightsReadyAt?: string | null
	setupHasWarnings: boolean
	warningSummaries?: TournamentSetupWarningSummary[]
	setupStartedAt: string | null
	setupFinishedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface EntryTournamentsResponse {
	entryTournaments: EntryTournament[]
}

export interface ManageableTournamentsResponse {
	manageableTournaments: EntryTournament[]
}

/** Fields returned by GET_ENTRY_TOURNAMENTS_LIST */
export type EntryTournamentListItem = Pick<
	EntryTournament,
	| 'id'
	| 'name'
	| 'creator'
	| 'adminEntryId'
	| 'leagueType'
	| 'sourceLeagueName'
	| 'totalTeamNum'
	| 'groupMode'
	| 'knockoutMode'
	| 'groupStartedEventId'
	| 'groupEndedEventId'
	| 'state'
	| 'rosterSyncStatus'
	| 'setupStatus'
	| 'setupProgressMode'
	| 'setupAttempt'
	| 'setupMaxAttempts'
	| 'nextRetryAt'
	| 'standingsReadyAt'
	| 'profilesReadyAt'
	| 'insightsReadyAt'
	| 'setupHasWarnings'
	| 'warningSummaries'
	| 'updatedAt'
>

export type LiveEntryTournament = Pick<
	EntryTournament,
	| 'id'
	| 'name'
	| 'leagueType'
	| 'groupMode'
	| 'rosterMode'
	| 'totalTeamNum'
	| 'setupStatus'
	| 'standingsReadyAt'
	| 'insightsReadyAt'
	| 'setupHasWarnings'
	| 'warningSummaries'
>

export interface EntryTournamentsListResponse {
	entryTournaments: EntryTournamentListItem[]
}

export interface ManageableTournamentsListResponse {
	manageableTournaments: EntryTournamentListItem[]
}

export interface TournamentParticipant {
	entryId: number
	entryName: string | null
	playerName: string | null
}

export const GET_TOURNAMENT_PARTICIPANTS = `
  query GetTournamentParticipants($tournamentId: Int!) {
    tournamentParticipants(tournamentId: $tournamentId) {
      entryId
      entryName
      playerName
    }
  }
`

export interface TournamentParticipantsResponse {
	tournamentParticipants: TournamentParticipant[]
}

const TOURNAMENT_DETAIL_INFO_FIELDS = `
  fragment TournamentDetailInfoFields on TournamentInfo {
    id
    name
    creator
    leagueId
    leagueType
    sourceLeagueName
    totalTeamNum
    groupMode
    groupTeamNum
    groupNum
    groupStartedEventId
    groupEndedEventId
    knockoutMode
    knockoutTeamNum
    knockoutRounds
    knockoutStartedEventId
    knockoutEndedEventId
    state
    rosterMode
    rosterSyncStatus
    setupStatus
    setupPhase
    setupCompletedUnits
    setupTotalUnits
    setupProgressUpdatedAt
    setupProgressMode
    standingsReadyAt
    insightsReadyAt
    setupHasWarnings
    warningSummaries { category affectedCount repairExhausted }
    setupStartedAt
    setupFinishedAt
    updatedAt
  }
`

export const GET_TOURNAMENT_DETAIL_DESK = `${TOURNAMENT_DETAIL_INFO_FIELDS}
  query GetTournamentDetailDesk($tournamentId: Int!, $entryId: Int!, $eventId: Int) {
    tournamentDetailDesk(tournamentId: $tournamentId, entryId: $entryId, eventId: $eventId) {
      revision
      kind
      context { season coreRevision activeEventId requestedEventId }
      viewerEntryId
      tournament { ...TournamentDetailInfoFields }
      unavailableSections
		participants { entryId entryName playerName }
		setup { status phase completedUnits totalUnits hasWarnings progressMode attempt maxAttempts nextRetryAt warningSummaries { category affectedCount repairExhausted } }
	    }
  }
`

export interface TournamentDetailDeskResponse {
	tournamentDetailDesk: {
		revision: string
		kind: 'SETUP' | 'OFFICIAL_H2H' | 'LIVE_POINTS'
		context: {
			season: string
			coreRevision: string
			activeEventId: number | null
			requestedEventId: number
		}
		viewerEntryId: number
		tournament: EntryTournament
		unavailableSections: Array<'PARTICIPANTS'>
		participants: TournamentParticipant[]
		setup: {
			status: TournamentSetupStatus
			phase: TournamentSetupPhase
			completedUnits: number
			totalUnits: number
			hasWarnings: boolean
			progressMode?: TournamentSetupProgressMode
			attempt?: number
			maxAttempts?: number
			nextRetryAt?: string | null
			warningSummaries?: TournamentSetupWarningSummary[]
		} | null
	} | null
}

export const GET_TOURNAMENT_METADATA = `${TOURNAMENT_INFO_FIELDS}
  query GetTournamentMetadata($tournamentId: Int!, $entryId: Int!) {
    tournament(tournamentId: $tournamentId, entryId: $entryId) {
      ...TournamentInfoFields
    }
  }
`

export interface TournamentMetadataResponse {
	tournament: EntryTournament | null
}

export const GET_MANAGED_TOURNAMENT = `${TOURNAMENT_INFO_FIELDS}
  query GetManagedTournament($tournamentId: Int!, $entryId: Int!) {
    managedTournament(tournamentId: $tournamentId, entryId: $entryId) {
      ...TournamentInfoFields
    }
  }
`

export interface ManagedTournamentResponse {
	managedTournament: EntryTournament | null
}

export const GET_MANAGED_TOURNAMENT_STATUS = `
  query GetManagedTournamentStatus($tournamentId: Int!, $entryId: Int!) {
    managedTournamentStatus(tournamentId: $tournamentId, entryId: $entryId) {
	      revision state setupStatus setupPhase rosterSyncStatus setupCompletedUnits setupTotalUnits setupProgressMode setupAttempt setupMaxAttempts nextRetryAt standingsReadyAt profilesReadyAt insightsReadyAt setupHasWarnings warningSummaries { category affectedCount repairExhausted } issues { issueKey code diagnosticCode category severity eventId affectedEntryIds affectedCount repairAttempts nextRepairAt repairExhausted } updatedAt
    }
  }
`

export interface ManagedTournamentStatusResponse {
	managedTournamentStatus: {
		revision: string
		state: EntryTournamentState
		setupStatus: TournamentSetupStatus
		setupPhase: TournamentSetupPhase
		rosterSyncStatus: TournamentSetupStatus | null
		setupCompletedUnits: number
		setupTotalUnits: number
		setupProgressMode: TournamentSetupProgressMode
		setupAttempt: number
		setupMaxAttempts: number
		nextRetryAt: string | null
		standingsReadyAt: string | null
		profilesReadyAt: string | null
		insightsReadyAt: string | null
		setupHasWarnings: boolean
		warningSummaries: TournamentSetupWarningSummary[]
		issues: TournamentSetupIssueDiagnostic[]
		updatedAt: string
	} | null
}

export interface TournamentSetupIssueDiagnostic {
	issueKey: string
	code: string
	diagnosticCode: string | null
	category: TournamentSetupWarningCategory
	severity: 'WARNING' | 'BLOCKING'
	eventId: number | null
	affectedEntryIds: number[]
	affectedCount: number
	repairAttempts: number
	nextRepairAt: string | null
	repairExhausted: boolean
}

/**
 * Slim field standings for review SSR/client.
 * Do not nest full TournamentInfo per row (N× metadata was killing Me Tournament).
 * Callers already have tournament from entryTournaments.
 */
export const GET_TOURNAMENT_EVENT_RESULTS = `
  query GetTournamentEventResults($tournamentId: Int!, $eventId: Int!) {
    tournamentEventResults(tournamentId: $tournamentId, eventId: $eventId) {
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
	/** Optional — slim query omits; inject from selected tournament when needed */
	tournament?: EntryTournament
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
      overallPoints
      leaderOverallPoints
      gapToLeader
      pointsBehindNext
      pointsAheadOfPrev
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
	/** Cumulative FPL points as of event (Phase 2) */
	overallPoints?: number | null
	leaderOverallPoints?: number | null
	gapToLeader?: number | null
	pointsBehindNext?: number | null
	pointsAheadOfPrev?: number | null
}

export interface TournamentEntryRankingSummaryResponse {
	tournamentEntryRankingSummary: TournamentEntryRankingSummary
}

export const GET_TOURNAMENT_SEASON_SNAPSHOT = `
  query GetTournamentSeasonSnapshot($tournamentId: Int!, $eventId: Int!) {
    tournamentSeasonSnapshot(tournamentId: $tournamentId, eventId: $eventId) {
      asOfEventId
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
      standings {
        entryId
        rank
        entryName
        playerName
        overallPoints
        overallRank
        teamValue
      }
    }
  }
`

export type TournamentSeasonMetricKey =
	| 'OVERALL_POINTS'
	| 'TEAM_VALUE'
	| 'TRANSFERS'
	| 'TOTAL_COSTS'
	| 'BENCH_POINTS'
	| 'AUTO_SUB_POINTS'

export interface TournamentSeasonMetricApi {
	key: TournamentSeasonMetricKey
	leaderValue: number | null
	leaderEntryId: number | null
	leaderEntryName: string | null
	leaderPlayerName: string | null
	averageValue: number | null
	higherIsBetter: boolean
}

export interface TournamentSeasonStandingApiRow {
	entryId: number
	rank: number | null
	entryName: string | null
	playerName: string | null
	overallPoints: number | null
	overallRank?: number | null
	teamValue?: number | null
}

export interface TournamentSeasonSnapshotApi {
	asOfEventId: number
	entryCount: number
	leaderOverallPoints: number | null
	secondOverallPoints: number | null
	gapFirstSecond: number | null
	averageOverallPoints: number | null
	metrics: TournamentSeasonMetricApi[]
	standings: TournamentSeasonStandingApiRow[]
}

export interface TournamentSeasonSnapshotResponse {
	tournamentSeasonSnapshot: TournamentSeasonSnapshotApi
}

// Query to fetch a single event stats snapshot
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

export const LIVE_TOURNAMENT_INFO_FIELDS = `
  fragment LiveTournamentInfoFields on TournamentInfo {
    id
    name
    leagueType
    groupMode
    rosterMode
    totalTeamNum
    setupStatus
    standingsReadyAt
    insightsReadyAt
    setupHasWarnings
    warningSummaries { category affectedCount repairExhausted }
  }
`

export interface TournamentLiveCalcData {
	entry: number
	provisional?: boolean
	rank?: {
		eventRank: number | null
		overallRank: number | null
		leagueRank: number | null
		revision: string | null
		contentUpdatedAt: string | null
		state: LivePointsScore['delivery']['state']
	} | null
	score?: LivePointsScore
	entryName: string
	playerName: string
	/** Squad value in £m as returned by LiveCalcData (e.g. 100.5 → £100.5m). */
	teamValue?: number | null
	/** ITB in £m as returned by LiveCalcData. */
	bank?: number | null
	/** teamValue + bank. */
	value?: number | null
	chip: string | null
	played: number
	toPlay: number
	captainName: string
	/** Official captain points carried by the bounded competition-board row. */
	captainPoints?: number | null
	activeCaptain?: {
		name: string
		points: number
	} | null
	pickList: Array<{
		element: number
		webName: string
		elementTypeName: string
		position: number
		multiplier?: number
		pickActive?: boolean
		autoSub?: boolean
		isCaptain: boolean
		isViceCaptain: boolean
		teamShortName: string
		teamName: string
		totalPoints?: number | null
		minutes?: number | null
		starts?: boolean | null
		isGwFinished?: boolean | null
		isGwStarted?: boolean | null
		isPlayed?: boolean | null
	}>
}

export type EntryLiveCompetitionBoardSort =
	| 'EVENT_POINTS'
	| 'NET_EVENT_POINTS'
	| 'TRANSFER_COST'
	| 'PLAYED'
	| 'TOTAL_POINTS'
	| 'OVERALL_RANK'
	| 'TEAM_VALUE'
	| 'RANK'
	| 'ENTRY_NAME'

export type EntryLiveCompetitionBoardSortDirection = 'ASC' | 'DESC'
export type EntryLiveCompetitionPickScope = 'ANY' | 'STARTER' | 'BENCH'
export type EntryLiveCompetitionCaptainMode = 'ANY' | 'CAPTAIN' | 'VICE'

export interface EntryLiveCompetitionOwnershipFilter {
	playerIds: number[]
	scope: EntryLiveCompetitionPickScope
	captainMode: EntryLiveCompetitionCaptainMode
}

export interface EntryLiveCompetitionTeamCountRule {
	teamId: number
	exactCount: number
	scope: EntryLiveCompetitionPickScope
}

export interface EntryLiveCompetitionBoardVariables {
	entryId: number
	tournamentId: number
	eventId: number
	input?: EntryLiveCompetitionBoardInput | null
}

export interface EntryLiveCompetitionBoardInput {
	first?: number
	after?: string | null
	sort?: EntryLiveCompetitionBoardSort
	direction?: EntryLiveCompetitionBoardSortDirection
	search?: string | null
	chips?: string[]
	captainPlayerIds?: number[]
	ownership?: EntryLiveCompetitionOwnershipFilter | null
	teamCountRules?: EntryLiveCompetitionTeamCountRule[]
}

export interface EntryLiveCompetitionBoardRow {
	availability: 'READY' | 'PENDING' | 'MISSING' | 'ERROR'
	entry: number
	entryName: string
	playerName: string
	liveRank: number | null
	overallRank: number | null
	teamValue: number | null
	chip: string | null
	transferCost: number | null
	played: number | null
	toPlay: number | null
	captainId: number | null
	captainName: string | null
	captainPoints: number | null
	score: EntryLiveCompetitionBoardScore | null
}

/**
 * The board deliberately selects only the score fields needed to render and
 * rank rows. Keeping this separate from the canonical LiveScore contract
 * prevents a full revision vector from being repeated for every participant.
 */
export type EntryLiveCompetitionBoardScore = Pick<
	LivePointsScore,
	| 'eventPoints'
	| 'netEventPoints'
	| 'totalPoints'
	| 'totalScope'
	| 'transferCost'
	| 'source'
	| 'calculationMode'
> & {
	revisions: Pick<LiveRevisionVector, 'input'>
	times: Pick<
		LiveTimes,
		'sourceCheckedAt' | 'contentUpdatedAt' | 'nextRefreshAt'
	>
	delivery: Pick<LiveDelivery, 'state'>
}

export interface LeagueLiveRevisionVector {
	publicationId: string
	generation: number
	roster: string
	scoreCore: string
	fixtureIdentity: string
	entryInputSet: string
	identity: string
	officialRank: string | null
	rules: string
	algorithm: string
	content: string
}

export interface LeagueLiveHead {
	season: string
	eventId: number
	tournamentId: number
	mode: 'CLASSIC' | 'H2H'
	availability: 'READY' | 'PENDING' | 'MISSING' | 'ERROR'
	contentRevision: string | null
	publication: {
		revisions: LeagueLiveRevisionVector
		times: LiveTimes
	} | null
	delivery: LiveDelivery
	nextRefreshAt: string | null
}

export interface EntryLiveCompetitionBoardHead {
	season: string
	eventId: number
	tournamentId: number
	mode: 'CLASSIC' | 'H2H'
	availability: 'READY' | 'PENDING' | 'MISSING' | 'ERROR'
	contentRevision: string | null
	publication: {
		revisions: {
			publicationId: string
			generation: number
			scoreCore: string
		}
		times: Pick<LiveTimes, 'contentUpdatedAt' | 'nextRefreshAt'>
	} | null
	delivery: Pick<LiveDelivery, 'state'>
	nextRefreshAt: string | null
}

export interface EntryLiveCompetitionBoardPage {
	head: EntryLiveCompetitionBoardHead
	totalEntries: number
	filteredEntries: number
	pageInfo: { hasNextPage: boolean; endCursor: string | null }
	highestEventPoints: number | null
	averageEventPoints: number | null
	rows: EntryLiveCompetitionBoardRow[]
	viewerRow: EntryLiveCompetitionBoardRow | null
}

export interface EntryLiveCompetitionBoardResponse {
	entryLiveCompetitionBoard: EntryLiveCompetitionBoardPage
}

export const GET_LEAGUE_LIVE_HEAD = `
  query GetLeagueLiveHead($entryId: Int!, $tournamentId: Int!, $eventId: Int!, $mode: LeagueLiveMode!) {
    leagueLiveHead(entryId: $entryId, tournamentId: $tournamentId, eventId: $eventId, mode: $mode) {
      season eventId tournamentId mode availability contentRevision nextRefreshAt
      publication {
        revisions { publicationId generation roster scoreCore fixtureIdentity entryInputSet identity officialRank rules algorithm content }
        times { sourceCheckedAt contentUpdatedAt publishedAt checkpointedAt servedAt staleAt nextRefreshAt }
      }
      delivery { state servedFrom reasonCodes }
    }
  }
`

export interface LeagueLiveHeadResponse {
	leagueLiveHead: LeagueLiveHead
}

export const GET_ENTRY_LIVE_COMPETITION_BOARD = `${LIVE_POINTS_SCORE_SUMMARY_FRAGMENT}
  query GetEntryLiveCompetitionBoard(
    $entryId: Int!
    $tournamentId: Int!
    $eventId: Int!
    $input: EntryLiveCompetitionBoardInput
  ) {
    entryLiveCompetitionBoard(
      entryId: $entryId
      tournamentId: $tournamentId
      eventId: $eventId
      input: $input
    ) {
	      head {
	        season eventId tournamentId mode availability contentRevision nextRefreshAt
	        publication {
	          revisions { publicationId generation scoreCore }
	          times { contentUpdatedAt nextRefreshAt }
	        }
	        delivery { state }
	      }
	      totalEntries filteredEntries pageInfo { hasNextPage endCursor }
      highestEventPoints averageEventPoints
      rows { ...EntryLiveCompetitionBoardRowFields }
      viewerRow { ...EntryLiveCompetitionBoardRowFields }
    }
  }

	fragment EntryLiveCompetitionBoardRowFields on EntryLiveCompetitionBoardRow {
	    availability entry entryName playerName liveRank overallRank teamValue chip
	    transferCost played toPlay captainId
	    captainName captainPoints
	    score { ...LivePointsScoreSummaryFields }
	  }
`

export const GET_TOURNAMENT_SELECTION_INDEX = `
  query GetTournamentSelectionIndex($entryId: Int!, $tournamentId: Int!, $ref: LivePublicationRefInput!) {
    tournamentSelectionIndex(entryId: $entryId, tournamentId: $tournamentId, ref: $ref) {
      tournamentId eventId scoreCoreRevision
      rows { playerId playerName teamId teamName teamShortName position count percentage }
    }
  }
`

export interface TournamentSelectionIndexRow {
	playerId: number
	playerName: string
	teamId: number
	teamName: string
	teamShortName: string
	position: string
	count: number
	percentage: number
}

export interface TournamentSelectionIndexResponse {
	tournamentSelectionIndex: {
		tournamentId: number
		eventId: number
		scoreCoreRevision: string
		rows: TournamentSelectionIndexRow[]
	}
}

export const GET_TOURNAMENT_ENTRY_SQUADS = `${LIVE_POINTS_SCORE_FRAGMENT}
  query GetTournamentEntrySquads($entryId: Int!, $tournamentId: Int!, $comparedEntryIds: [Int!]!, $ref: LivePublicationRefInput!) {
    tournamentEntrySquads(entryId: $entryId, tournamentId: $tournamentId, comparedEntryIds: $comparedEntryIds, ref: $ref) {
      tournamentId eventId scoreCoreRevision
      entries {
        entry entryName playerName
        score { ...LivePointsScoreFields }
        rank { eventRank overallRank leagueRank revision contentUpdatedAt state }
        pickList {
          element webName elementTypeName position multiplier pickActive autoSub
          isCaptain isViceCaptain teamShortName teamName totalPoints minutes starts
          isGwFinished isGwStarted isPlayed
        }
      }
    }
  }
`

export interface TournamentEntrySquadsResponse {
	tournamentEntrySquads: {
		tournamentId: number
		eventId: number
		scoreCoreRevision: string
		entries: TournamentLiveCalcData[]
	}
}

export const GET_TOURNAMENT_LIVE_PARTICIPANTS = `
  query GetTournamentLiveParticipants($entryId: Int!, $tournamentId: Int!) {
    tournamentLiveParticipants(entryId: $entryId, tournamentId: $tournamentId) { entryId entryName playerName }
  }
`

const LIVE_H2H_MATCH_FIELDS = `
  fragment LiveH2HMatchFields on TournamentOfficialH2HLiveMatch {
    officialMatchId
    eventId
    groupId
    sourceOrder
    phase
    knockoutName
    tiebreak
    isBye
    availability
    delivery { state servedFrom reasonCodes }
    revisions { publicationId generation scoreCore content }
    times { contentUpdatedAt nextRefreshAt }
    home {
      availability
      entryId
      entryName
      playerName
      isAverage
      points
      netPoints
    }
    away {
      availability
      entryId
      entryName
      playerName
      isAverage
      points
      netPoints
    }
  }
`

export const GET_TOURNAMENT_OFFICIAL_H2H = `${LIVE_H2H_MATCH_FIELDS}
  query GetTournamentOfficialH2H($tournamentId: Int!, $eventId: Int!) {
    tournamentOfficialH2H(tournamentId: $tournamentId, eventId: $eventId) {
      eventId
      availability
      delivery { state servedFrom reasonCodes }
      revisions { publicationId generation roster scoreCore fixtureIdentity entryInputSet identity officialRank rules algorithm content }
      times { sourceCheckedAt contentUpdatedAt publishedAt checkpointedAt servedAt staleAt nextRefreshAt }
      standings {
        throughEventId
        state
        sourceCheckedAt
        rows { entryId entryName playerName rank matchPoints played won drawn lost pointsFor }
      }
      matches {
        ...LiveH2HMatchFields
      }
    }
  }
`

export const GET_TOURNAMENT_OFFICIAL_H2H_HISTORY = `
  query GetTournamentOfficialH2HHistory($tournamentId: Int!, $eventId: Int!, $limit: Int = 100) {
    tournamentOfficialH2HHistory(tournamentId: $tournamentId, eventId: $eventId, limit: $limit) {
      eventId
      availability
      matches {
        officialMatchId
        eventId
        groupId
        sourceOrder
        phase
        knockoutName
        tiebreak
        isBye
        availability
        home {
          availability
          entryId
          entryName
          playerName
          isAverage
          points
          netPoints
        }
        away {
          availability
          entryId
          entryName
          playerName
          isAverage
          points
          netPoints
        }
      }
    }
  }
`

export interface TournamentOfficialH2H {
	eventId: number
	availability: 'READY' | 'PENDING' | 'MISSING' | 'ERROR'
	delivery: LiveDelivery
	revisions: LeagueLiveRevisionVector | null
	times: LiveTimes | null
	standings: {
		throughEventId: number
		state: 'READY' | 'STALE' | 'UPDATING' | 'UNAVAILABLE'
		sourceCheckedAt: string | null
		rows: TournamentOfficialH2HStanding[]
	} | null
	matches: TournamentOfficialH2HLiveMatch[]
}

export interface TournamentOfficialH2HStanding {
	entryId: number
	entryName: string
	playerName: string | null
	rank: number | null
	matchPoints: number | null
	played: number | null
	won: number | null
	drawn: number | null
	lost: number | null
	pointsFor: number | null
}

export interface TournamentOfficialH2HLiveMatchSide {
	availability: 'READY' | 'PENDING' | 'MISSING' | 'ERROR'
	entryId: number | null
	entryName: string
	playerName: string | null
	isAverage: boolean
	points: number | null
	netPoints: number | null
}

export interface TournamentOfficialH2HLiveMatch {
	officialMatchId: number
	eventId: number
	groupId: number
	sourceOrder: number
	phase: 'REGULAR' | 'KNOCKOUT'
	knockoutName: string | null
	tiebreak: string | null
	isBye: boolean
	availability: 'READY' | 'PENDING' | 'MISSING' | 'ERROR'
	delivery: LiveDelivery
	revisions: Pick<
		LeagueLiveRevisionVector,
		'publicationId' | 'generation' | 'scoreCore' | 'content'
	>
	times: Pick<LiveTimes, 'contentUpdatedAt' | 'nextRefreshAt'>
	home: TournamentOfficialH2HLiveMatchSide
	away: TournamentOfficialH2HLiveMatchSide
}

export interface TournamentOfficialH2HResponse {
	tournamentOfficialH2H: TournamentOfficialH2H
}

export interface TournamentOfficialH2HHistory {
	eventId: number
	availability: 'READY'
	matches: TournamentOfficialH2HHistoryMatch[]
}

export interface TournamentOfficialH2HHistoryMatch {
	officialMatchId: number
	eventId: number
	groupId: number
	sourceOrder: number
	phase: 'REGULAR' | 'KNOCKOUT'
	knockoutName: string | null
	tiebreak: string | null
	isBye: boolean
	availability: 'READY' | 'PENDING'
	home: TournamentOfficialH2HLiveMatchSide
	away: TournamentOfficialH2HLiveMatchSide
}

export interface TournamentOfficialH2HHistoryResponse {
	tournamentOfficialH2HHistory: TournamentOfficialH2HHistory
}

// Query to fetch entry result for a specific event
