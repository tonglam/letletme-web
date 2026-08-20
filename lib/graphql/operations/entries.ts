export const GET_ENTRY = `
  query GetEntry($id: Int!) {
    entry(id: $id) {
      id
      entryName
      playerName
      overallPoints
      overallRank
      teamValue
      bank
      totalTransfers
      region
    }
  }
`

export interface EntrySummary {
	id: number
	entryName: string
	playerName: string
	overallPoints: number | null
	overallRank: number | null
	teamValue: number | null
	bank: number | null
	totalTransfers: number | null
	region: string | null
}

export interface EntrySummaryResponse {
	entry: EntrySummary | null
}

export const SEARCH_ENTRIES = `
  query SearchEntries($query: String!, $limit: Int) {
    searchEntries(query: $query, limit: $limit) {
      id
      entryName
      playerName
      overallPoints
      overallRank
    }
  }
`

export interface EntryNameSearchHit {
	id: number
	entryName: string
	playerName: string
	overallPoints: number | null
	overallRank: number | null
}

export interface SearchEntriesResponse {
	searchEntries: EntryNameSearchHit[]
}

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
        element
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
        isPlayed
        autoSub
        expectedGoals
        expectedAssists
        expectedGoalInvolvements
        expectedGoalsConceded
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
	element?: number | null
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
	isPlayed: boolean
	autoSub: boolean
	expectedGoals: number | null
	expectedAssists: number | null
	expectedGoalInvolvements: number | null
	expectedGoalsConceded: number | null
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
        eventBenchPoints
        eventCaptainPoints
        eventPlayedCaptain {
          webName
          team {
            shortName
          }
        }
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
	eventBenchPoints: number
	eventCaptainPoints: number
	eventPlayedCaptain: {
		webName: string
		team?: { shortName?: string | null } | null
	} | null
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
