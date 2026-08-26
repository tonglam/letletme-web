import type { LiveManagerScore, LiveSnapshotStatus } from './live'

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
      canManage
      tournament { ...TournamentDetailInfoFields }
      unavailableSections
      participants { entryId entryName playerName }
		setup { status phase completedUnits totalUnits hasWarnings progressMode attempt maxAttempts nextRetryAt warningSummaries { category affectedCount repairExhausted } }
      officialH2H {
        eventId
        awaitingSchedule
		scoreSource
		scoreRevision
		scoreCheckedAt
        standings { entryId entryName playerName rank matchPoints played won drawn lost pointsFor }
        matches {
          officialMatchId eventId sourceOrder phase knockoutName isBye winnerEntryId tiebreak sourceCheckedAt
          home { entryId entryName playerName isAverage points matchPoints }
          away { entryId entryName playerName isAverage points matchPoints }
        }
      }
      live {
        eventId revision state partial failedEntryIds totalEntries
        rows {
          entry provisional rank entryName playerName overallRank lastOverallRank overallPoints teamValue bank value
          chip livePoints transferCost liveNetPoints liveTotalPoints played toPlay captainName
          score {
            eventPoints netEventPoints totalPoints totalScope eventRank overallRank leagueRank
            transferCost source state eventPointSemantics revision checkedAt upstreamUpdatedAt
            calculationMode algorithmVersion
            staleAt nextRefreshAt reconciliation reasonCodes
          }
          activeCaptain { name points }
          pickList { element webName elementTypeName position multiplier isCaptain isViceCaptain teamShortName teamName totalPoints }
        }
      }
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
		canManage: boolean
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
		officialH2H: TournamentOfficialH2H | null
		live: {
			eventId: number
			revision: string | null
			state: string
			partial: boolean
			failedEntryIds: number[]
			totalEntries: number
			rows: TournamentLiveCalcData[]
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
    totalTeamNum
    setupStatus
    standingsReadyAt
    insightsReadyAt
    setupHasWarnings
    warningSummaries { category affectedCount repairExhausted }
  }
`

export const GET_TOURNAMENT_LIVE_DESK = `${LIVE_TOURNAMENT_INFO_FIELDS}
  query GetEntryLiveCompetitionsDesk($entryId: Int!, $selectedTournamentId: Int, $ref: LiveRevisionRefInput) {
    entryLiveCompetitionsDesk(entryId: $entryId, selectedTournamentId: $selectedTournamentId, ref: $ref) {
      eventId
      revision
      state
      windowState
      dataAvailability
      tournaments { ...LiveTournamentInfoFields }
      selectedTournamentId
      managerRevision
      officialCoverage
      unavailableEntryIds
      partial
      failedEntryIds
      totalEntries
      board {
        entry
        rank
        entryName
        playerName
        overallRank
        lastOverallRank
        teamValue
        bank
        chip
        score {
          eventPoints
          netEventPoints
          totalPoints
          totalScope
          eventRank
          overallRank
          leagueRank
          transferCost
          source
          state
          eventPointSemantics
          calculationMode
          algorithmVersion
          revision
          checkedAt
          upstreamUpdatedAt
          staleAt
          nextRefreshAt
          reconciliation
          reasonCodes
        }
        transferCost
        played
        toPlay
        captainName
        activeCaptain {
          name
          points
        }
        pickList {
          element
          webName
          elementTypeName
          position
          multiplier
          isCaptain
          isViceCaptain
          teamShortName
          teamName
          totalPoints
        }
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
	provisional?: boolean
	rank?: number
	score?: LiveManagerScore
	entryName: string
	playerName: string
	overallRank: number
	/** Previous overall rank (for OR delta when available). */
	lastOverallRank?: number | null
	overallPoints?: number | null
	/** Squad value in £m as returned by LiveCalcData (e.g. 100.5 → £100.5m). */
	teamValue?: number | null
	/** ITB in £m as returned by LiveCalcData. */
	bank?: number | null
	/** teamValue + bank. */
	value?: number | null
	chip: string | null
	livePoints?: number
	transferCost: number
	liveNetPoints?: number
	liveTotalPoints?: number
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

export interface TournamentLivePointsResponse {
	entryLiveCompetitionsDesk: {
		eventId: number
		revision: string | null
		state: string
		windowState?: string
		dataAvailability?: string
		nextRefreshAt?: string | null
		tournaments: LiveEntryTournament[]
		selectedTournamentId: number | null
		managerRevision?: string | null
		officialCoverage?: number
		unavailableEntryIds?: number[]
		partial: boolean
		failedEntryIds: number[]
		totalEntries: number
		board: TournamentLiveCalcData[]
	}
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
	ref?: { season: string; eventId: number; revision: string } | null
	page?: number
	pageSize?: number
	sort?: EntryLiveCompetitionBoardSort
	direction?: EntryLiveCompetitionBoardSortDirection
	search?: string | null
	chips?: string[]
	captainPlayerIds?: number[]
	ownership?: EntryLiveCompetitionOwnershipFilter | null
	teamCountRules?: EntryLiveCompetitionTeamCountRule[]
	expectedBoardRevision?: string | null
}

export interface EntryLiveCompetitionBoardRow {
	entry: number
	entryName: string
	playerName: string
	rank: number
	overallRank: number
	teamValue: number
	chip: string
	livePoints: number
	transferCost: number
	liveNetPoints: number
	liveTotalPoints: number
	played: number
	toPlay: number
	captainId: number
	captainName: string
	captainPoints: number
	score: NonNullable<TournamentLiveCalcData['score']>
}

export interface EntryLiveCompetitionBoardPage {
	season: string
	eventId: number
	tournamentId: number
	boardRevision: string
	playerRevision: string
	managerRevision: string | null
	dataAvailability: string
	managerDataAvailability: string
	managerServedFrom: 'REDIS' | 'POSTGRES' | 'MIXED' | 'NONE'
	managerRefreshQueued: boolean
	managerCheckedAt: string | null
	managerNextRefreshAt: string | null
	coverageState: 'WARMING' | 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE'
	rankScope: 'FULL_FIELD' | 'AVAILABLE_ROWS'
	computedEntries: number
	deferredEntryCount: number
	failedEntryCount: number
	unavailableEntryCount: number
	officialCoverage: number
	unavailableEntryIds: number[]
	failedEntryIds: number[]
	partial: boolean
	totalEntries: number
	filteredEntries: number
	page: number
	pageSize: number
	hasMore: boolean
	highestEventPoints: number | null
	averageEventPoints: number | null
	rows: EntryLiveCompetitionBoardRow[]
	viewerRow: EntryLiveCompetitionBoardRow | null
}

export interface EntryLiveCompetitionBoardResponse {
	entryLiveCompetitionBoard: EntryLiveCompetitionBoardPage
}

export const GET_ENTRY_LIVE_COMPETITION_BOARD = `
  query GetEntryLiveCompetitionBoard(
    $entryId: Int!
    $tournamentId: Int!
    $eventId: Int!
    $ref: LiveRevisionRefInput
    $page: Int
    $pageSize: Int
    $sort: EntryLiveCompetitionBoardSort
    $direction: EntryLiveCompetitionBoardSortDirection
    $search: String
    $chips: [String!]
    $captainPlayerIds: [Int!]
    $ownership: EntryLiveCompetitionOwnershipFilterInput
    $teamCountRules: [EntryLiveCompetitionTeamCountRuleInput!]
    $expectedBoardRevision: String
  ) {
    entryLiveCompetitionBoard(
      entryId: $entryId
      tournamentId: $tournamentId
      eventId: $eventId
      ref: $ref
      page: $page
      pageSize: $pageSize
      sort: $sort
      direction: $direction
      search: $search
      chips: $chips
      captainPlayerIds: $captainPlayerIds
      ownership: $ownership
      teamCountRules: $teamCountRules
      expectedBoardRevision: $expectedBoardRevision
    ) {
      season eventId tournamentId boardRevision playerRevision managerRevision
      dataAvailability managerDataAvailability managerServedFrom managerRefreshQueued
      managerCheckedAt managerNextRefreshAt coverageState rankScope computedEntries
      deferredEntryCount failedEntryCount unavailableEntryCount officialCoverage
      unavailableEntryIds failedEntryIds partial totalEntries filteredEntries page pageSize hasMore
      highestEventPoints averageEventPoints
      rows {
        entry entryName playerName rank overallRank teamValue chip livePoints
        transferCost liveNetPoints liveTotalPoints played toPlay captainId
        captainName captainPoints
        score {
          eventPoints netEventPoints totalPoints totalScope eventRank overallRank leagueRank
          transferCost source state eventPointSemantics revision checkedAt upstreamUpdatedAt
          calculationMode algorithmVersion
          staleAt nextRefreshAt reconciliation reasonCodes
        }
      }
      viewerRow {
        entry entryName playerName rank overallRank teamValue chip livePoints
        transferCost liveNetPoints liveTotalPoints played toPlay captainId
        captainName captainPoints
        score {
          eventPoints netEventPoints totalPoints totalScope eventRank overallRank leagueRank
          transferCost source state eventPointSemantics revision checkedAt upstreamUpdatedAt
          calculationMode algorithmVersion
          staleAt nextRefreshAt reconciliation reasonCodes
        }
      }
    }
  }
`

export const GET_TOURNAMENT_SELECTION_INDEX = `
  query GetTournamentSelectionIndex($entryId: Int!, $tournamentId: Int!, $ref: LiveRevisionRefInput!) {
    tournamentSelectionIndex(entryId: $entryId, tournamentId: $tournamentId, ref: $ref) {
      tournamentId eventId revision
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
		revision: string
		rows: TournamentSelectionIndexRow[]
	}
}

export const GET_TOURNAMENT_ENTRY_SQUADS = `
  query GetTournamentEntrySquads($entryId: Int!, $tournamentId: Int!, $comparedEntryIds: [Int!]!, $ref: LiveRevisionRefInput!) {
    tournamentEntrySquads(entryId: $entryId, tournamentId: $tournamentId, comparedEntryIds: $comparedEntryIds, ref: $ref) {
      tournamentId eventId revision
      entries {
        entry entryName playerName livePoints liveNetPoints liveTotalPoints transferCost
        score {
          eventPoints netEventPoints totalPoints totalScope eventRank overallRank leagueRank
          transferCost source state eventPointSemantics revision checkedAt upstreamUpdatedAt
          calculationMode algorithmVersion
          staleAt nextRefreshAt reconciliation reasonCodes
        }
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
		revision: string
		entries: TournamentLiveCalcData[]
	}
}

export const GET_TOURNAMENT_LIVE_PARTICIPANTS = `
  query GetTournamentLiveParticipants($entryId: Int!, $tournamentId: Int!) {
    tournamentLiveParticipants(entryId: $entryId, tournamentId: $tournamentId) { entryId entryName playerName }
  }
`

const OFFICIAL_H2H_MATCH_FIELDS = `
  fragment OfficialH2HMatchFields on OfficialH2HMatch {
    officialMatchId
    eventId
    sourceOrder
    phase
    knockoutName
    isBye
    winnerEntryId
    tiebreak
    sourceCheckedAt
    home {
      entryId
      entryName
      playerName
      isAverage
      points
      matchPoints
    }
    away {
      entryId
      entryName
      playerName
      isAverage
      points
      matchPoints
    }
  }
`

export const GET_TOURNAMENT_OFFICIAL_H2H = `${OFFICIAL_H2H_MATCH_FIELDS}
  query GetTournamentOfficialH2H($tournamentId: Int!, $eventId: Int!) {
    tournamentOfficialH2H(tournamentId: $tournamentId, eventId: $eventId) {
      eventId
      awaitingSchedule
	  scoreSource
	  scoreRevision
	  scoreCheckedAt
      standings {
        entryId
        entryName
        playerName
        rank
        matchPoints
        played
        won
        drawn
        lost
        pointsFor
      }
      matches {
        ...OfficialH2HMatchFields
      }
    }
  }
`

export const GET_ENTRY_OFFICIAL_H2H_DESK = `${OFFICIAL_H2H_MATCH_FIELDS}
  query GetEntryOfficialH2HDesk($entryId: Int!) {
    entryOfficialH2HDesk(entryId: $entryId) {
      tournamentId
      tournamentName
      totalTeams
      eventId
      awaitingSchedule
      isLive
      isFinal
	  scoreSource
	  scoreRevision
	  scoreCheckedAt
      rank
      lastRank
      matchPoints
      match {
        ...OfficialH2HMatchFields
      }
      matches {
        ...OfficialH2HMatchFields
      }
    }
  }
`

export interface OfficialH2HStanding {
	entryId: number
	entryName: string | null
	playerName: string | null
	rank: number | null
	matchPoints: number
	played: number
	won: number
	drawn: number
	lost: number
	pointsFor: number
}

export interface OfficialH2HMatchSide {
	entryId: number | null
	entryName: string
	playerName: string | null
	isAverage: boolean
	points: number | null
	matchPoints: number | null
}

export interface OfficialH2HMatch {
	officialMatchId: number
	eventId: number
	sourceOrder: number
	phase: 'REGULAR' | 'KNOCKOUT'
	knockoutName: string | null
	isBye: boolean
	winnerEntryId: number | null
	tiebreak: string | null
	sourceCheckedAt: string | null
	home: OfficialH2HMatchSide
	away: OfficialH2HMatchSide
}

export interface TournamentOfficialH2H {
	eventId: number
	awaitingSchedule: boolean
	scoreSource: 'FPL_EVENT_LIVE' | 'FPL_H2H_FINAL' | 'UNAVAILABLE'
	scoreRevision: string | null
	scoreCheckedAt: string | null
	standings: OfficialH2HStanding[]
	matches: OfficialH2HMatch[]
}

export interface TournamentOfficialH2HResponse {
	tournamentOfficialH2H: TournamentOfficialH2H
}

export interface EntryOfficialH2HDeskItem {
	tournamentId: number
	tournamentName: string
	totalTeams: number
	eventId: number
	awaitingSchedule: boolean
	isLive: boolean
	isFinal: boolean
	scoreSource: TournamentOfficialH2H['scoreSource']
	scoreRevision: string | null
	scoreCheckedAt: string | null
	rank: number | null
	lastRank: number | null
	matchPoints: number
	match: OfficialH2HMatch | null
	matches?: OfficialH2HMatch[]
}

export interface EntryOfficialH2HDeskResponse {
	entryOfficialH2HDesk: EntryOfficialH2HDeskItem[]
}

// Query to fetch entry result for a specific event
