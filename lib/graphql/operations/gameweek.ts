export const GET_GAMEWEEK_DESK = `
  query GetGameweekDesk($eventId: Int) {
    gameweekDesk(eventId: $eventId) {
      season
      coreRevision
      scoreCoreRevision
      anchorEventId
      eventId
      currentEventId
      nextEventId
      isPreseason
      lifecycle
      deadlineTime
      publishedAt
      sourceCheckedAt
      overviewState
      boardsState
      overview {
        averagePoints
        highestPoints
        mostCaptained { id webName teamShortName }
        mostViceCaptained { id webName teamShortName }
        mostSelected { id webName teamShortName }
        mostTransferredIn { id webName teamShortName }
        chipsPlayed { benchBoost tripleCaptain wildcard freeHit }
      }
      dreamTeam {
        id
        webName
        position
        teamShortName
        price
        minutes
        goalsScored
        assists
        cleanSheets
        bonus
        totalPoints
      }
      hauls {
        id
        webName
        position
        teamShortName
        price
        minutes
        goalsScored
        assists
        cleanSheets
        bonus
        totalPoints
      }
    }
  }
`

export type GameweekLifecycle = 'SCHEDULED' | 'PROVISIONAL' | 'SETTLED'
export type GameweekSectionState = 'PENDING' | 'AVAILABLE' | 'UNAVAILABLE'

export type GameweekDeskPlayer = {
	id: number
	webName: string
	position: 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'FORWARD'
	teamShortName: string
	price: number
	minutes: number | null
	goalsScored: number | null
	assists: number | null
	cleanSheets: number | null
	bonus: number | null
	totalPoints: number
}

export type GameweekOverviewPlayer = {
	id: number
	webName: string
	teamShortName: string | null
}

export type GameweekDeskData = {
	season: string
	coreRevision: string
	scoreCoreRevision: string | null
	anchorEventId: number
	eventId: number
	currentEventId: number | null
	nextEventId: number | null
	isPreseason: boolean
	lifecycle: GameweekLifecycle
	deadlineTime: string | null
	publishedAt: string | null
	sourceCheckedAt: string | null
	overviewState: GameweekSectionState
	boardsState: GameweekSectionState
	overview: {
		averagePoints: number | null
		highestPoints: number | null
		mostCaptained: GameweekOverviewPlayer | null
		mostViceCaptained: GameweekOverviewPlayer | null
		mostSelected: GameweekOverviewPlayer | null
		mostTransferredIn: GameweekOverviewPlayer | null
		chipsPlayed: {
			benchBoost: number | null
			tripleCaptain: number | null
			wildcard: number | null
			freeHit: number | null
		} | null
	} | null
	dreamTeam: GameweekDeskPlayer[]
	hauls: GameweekDeskPlayer[]
}

export type GameweekDeskGraphQLResponse = {
	gameweekDesk: unknown
}
