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
