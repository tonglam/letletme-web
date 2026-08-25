export const GET_ENTRY_LEAGUES = `
  query GetEntryLeagues($entryId: Int!) {
    entryLeagues(entryId: $entryId) {
      id
      name
      type
      officialKind
      shortName
      entryRank
      entryLastRank
      totalTeamNum
      startedEvent
      tournamentId
      tournamentName
      state
    }
  }
`

export type LeagueType = 'CLASSIC' | 'H2H'
export type OfficialLeagueKind = 'SYSTEM' | 'INVITATIONAL'

export interface EntryLeague {
	id: number
	name: string
	type: LeagueType | string
	officialKind: OfficialLeagueKind | null
	shortName: string | null
	entryRank: number | null
	entryLastRank: number | null
	totalTeamNum: number | null
	startedEvent: number | null
	tournamentId: number | null
	tournamentName: string | null
	state: string | null
}

export interface EntryLeaguesResponse {
	entryLeagues: EntryLeague[]
}

export const GET_PUBLIC_LEAGUE_TRENDS = `
  query PublicLeagueTrends {
    publicLeagueTrends {
      tournamentId
      displayName
      sortOrder
      publishedAt
      updatedAt
      latestAvailableEventId
      totalEntries
    }
  }
`

export const GET_PUBLIC_LEAGUE_SELECTION_STATS = `
  query PublicLeagueSelectionStats($tournamentId: Int!, $eventId: Int!, $limit: Int = 12) {
    publicLeagueSelectionStats(
      tournamentId: $tournamentId
      eventId: $eventId
      limit: $limit
    ) {
      totalEntries
      mostSelectedPlayers {
        id webName teamShortName position selectedByPercent eoByPercent
      }
      captainSelect {
        id webName teamShortName position captainByPercent selectedByPercent eoByPercent
      }
      mostTransferIn {
        id webName teamShortName position selectedByPercent transfersEvent
      }
      mostTransferOut {
        id webName teamShortName position selectedByPercent transfersEvent
      }
    }
  }
`

export interface PublicLeagueTrend {
	tournamentId: number
	displayName: string
	sortOrder: number
	publishedAt: string
	updatedAt: string
	latestAvailableEventId: number
	totalEntries: number
}

export interface PublicLeagueTrendsResponse {
	publicLeagueTrends: PublicLeagueTrend[]
}

export interface PublicLeagueSelectionStatsResponse<T> {
	publicLeagueSelectionStats: T | null
}
