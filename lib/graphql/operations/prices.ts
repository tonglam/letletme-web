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
