import type { LiveSnapshotStatus } from './live'

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
    setupStatus
    setupPhase
    setupCompletedUnits
    setupTotalUnits
    setupProgressUpdatedAt
    standingsReadyAt
    setupHasWarnings
    setupStartedAt
    setupFinishedAt
    createdAt
    updatedAt
  }
`

export const GET_ENTRY_TOURNAMENTS = `${TOURNAMENT_INFO_FIELDS}
  query GetEntryTournaments($entryId: Int!) {
    entryTournaments(entryId: $entryId) {
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
    entryTournaments(entryId: $entryId) {
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
      standingsReadyAt
      setupHasWarnings
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
	setupStatus: TournamentSetupStatus
	setupPhase: TournamentSetupPhase
	setupCompletedUnits: number
	setupTotalUnits: number
	setupProgressUpdatedAt: string | null
	standingsReadyAt: string | null
	setupHasWarnings: boolean
	setupStartedAt: string | null
	setupFinishedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface EntryTournamentsResponse {
	entryTournaments: EntryTournament[]
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
	| 'standingsReadyAt'
	| 'setupHasWarnings'
	| 'updatedAt'
>

export interface EntryTournamentsListResponse {
	entryTournaments: EntryTournamentListItem[]
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

export const GET_TOURNAMENT_LIVE_POINTS = `
  query GetTournamentLivePoints($eventId: Int!, $tournamentId: Int!) {
    liveSnapshot(eventId: $eventId) {
      eventId
      revision
      state
      publishedAt
      checkedAt
    }
    calcLivePointsForTournament(eventId: $eventId, tournamentId: $tournamentId) {
      results {
        entry
        entryName
        playerName
        overallRank
        lastOverallRank
        overallPoints
        teamValue
        bank
        value
        chip
        livePoints
        transferCost
        liveNetPoints
        liveTotalPoints
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
          isCaptain
          isViceCaptain
          teamShortName
          teamName
          totalPoints
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
	/** Previous overall rank (for OR delta when available). */
	lastOverallRank?: number | null
	overallPoints?: number | null
	/** Squad value in tenths of £m (e.g. 1005 → £100.5m). */
	teamValue?: number | null
	/** ITB in tenths of £m. */
	bank?: number | null
	/** teamValue + bank. */
	value?: number | null
	chip: string | null
	livePoints: number
	transferCost: number
	liveNetPoints: number
	liveTotalPoints: number
	played: number
	toPlay: number
	captainName: string
	activeCaptain?: {
		name: string
		points: number
	} | null
	pickList: Array<{
		element: number
		webName: string
		elementTypeName: string
		position: number
		isCaptain: boolean
		isViceCaptain: boolean
		teamShortName: string
		teamName: string
		totalPoints?: number | null
	}>
}

export interface TournamentLivePointsResponse {
	liveSnapshot: LiveSnapshotStatus | null
	calcLivePointsForTournament: {
		results: TournamentLiveCalcData[]
		errors: BatchCalcError[]
		meta: BatchCalcMeta
	}
}

// Query to fetch entry result for a specific event
