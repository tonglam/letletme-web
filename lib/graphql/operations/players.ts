export const GET_PLAYER_DETAIL = `
  query GetPlayerDetail($playerId: Int!, $eventId: Int!) {
    playerDetail(playerId: $playerId, eventId: $eventId) {
      id webName teamShortName elementType elementTypeName
      price startPrice totalPoints
      selectedByPercent form seasonTransfersIn seasonTransfersOut
      transfersInEvent transfersOutEvent
      eventPoints minutes goalsScored assists cleanSheets goalsConceded
      ownGoals penaltiesSaved yellowCards redCards saves
      bonus bps influence creativity threat ictIndex
      fixtures { event againstTeamShortName wasHome finished kickoffTime score difficulty bgw }
    }
  }
`

export interface PlayerDetailFixture {
	event: number
	againstTeamShortName: string
	wasHome: boolean
	finished: boolean
	kickoffTime: string | null
	score: string | null
	difficulty: number
	bgw: boolean
}

export interface PlayerDetailData {
	id: number
	webName: string
	teamShortName: string
	elementType: number
	elementTypeName: string
	price: number
	startPrice: number
	totalPoints: number
	selectedByPercent?: number | null
	form: number | null
	seasonTransfersIn: number
	seasonTransfersOut: number
	transfersInEvent: number
	transfersOutEvent: number
	eventPoints: number | null
	minutes: number | null
	goalsScored: number | null
	assists: number | null
	cleanSheets: number | null
	goalsConceded: number | null
	ownGoals: number | null
	penaltiesSaved: number | null
	yellowCards: number | null
	redCards: number | null
	saves: number | null
	bonus: number | null
	bps: number | null
	influence: number
	creativity: number
	threat: number
	ictIndex: number
	fixtures: PlayerDetailFixture[]
}

export interface PlayerDetailResponse {
	playerDetail: PlayerDetailData | null
}

// Query to fetch player values
export const GET_PLAYERS_FOR_PICKER = `
  query GetPlayersForPicker($filter: PlayersFilter, $limit: Int!, $offset: Int!) {
    players(filter: $filter, limit: $limit, offset: $offset) {
      id
      webName
      position
      team {
        id
        name
        shortName
      }
    }
  }
`

export const GET_TEAMS_FOR_PICKER = `
  query GetTeamsForPicker {
    teams {
      id
      name
      shortName
    }
  }
`

export type PlayerDirectoryPosition =
	| 'GOALKEEPER'
	| 'DEFENDER'
	| 'MIDFIELDER'
	| 'FORWARD'

export interface PlayerDirectoryItem {
	id: number
	webName: string
	position: PlayerDirectoryPosition
	team: {
		id: number
		name: string
		shortName: string
	}
}

export interface PlayersForPickerResponse {
	players: PlayerDirectoryItem[]
}

export interface TeamForPickerItem {
	id: number
	name: string
	shortName: string
}

export interface TeamsForPickerResponse {
	teams: TeamForPickerItem[]
}

// Query to fetch historical player value changes
