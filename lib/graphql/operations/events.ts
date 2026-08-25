/** YYYY-MM-DD in UTC for GraphQL `Date` (e.g. `playerValues(changeDate: …)`). */
export function utcCalendarDateISO(date: Date = new Date()): string {
	const y = date.getUTCFullYear()
	const m = String(date.getUTCMonth() + 1).padStart(2, '0')
	const d = String(date.getUTCDate()).padStart(2, '0')
	return `${y}-${m}-${d}`
}

// Query to fetch current gameweek ID and next gameweek deadline
export const GET_CURRENT_AND_NEXT_EVENTS = `
  query GetCurrentAndNextEvents {
    current: events(filter: { isCurrent: true }, limit: 1) {
      id
    }
    next: events(filter: { isNext: true }, limit: 1) {
      id
      deadlineTime
    }
  }
`

export const GET_CORE_EVENT_CONTEXT = `
  query GetCoreEventContext {
    coreEventContext {
      season
      revision
      sourceCheckedAt
      currentEventId
      nextEventId
      nextDeadlineTime
      latestFinishedEventId
    }
  }
`

export type CoreEventContextData = {
	season: string
	revision: string
	sourceCheckedAt: string
	currentEventId: number | null
	nextEventId: number | null
	nextDeadlineTime: string | null
	latestFinishedEventId: number | null
}

export interface CoreEventContextResponse {
	coreEventContext: CoreEventContextData
}

// Type for current event (only need ID)
export interface CurrentEvent {
	id: number
}

// Type for next event (need ID and deadline)
export interface NextEvent {
	id: number
	deadlineTime: string // ISO 8601 date string
}

// Type for the events response
export interface EventsResponse {
	current: CurrentEvent[]
	next: NextEvent[]
}

// Query to fetch tournaments joined by current entry
export const GET_EVENT_STATS_BY_ID = `
  query GetEventStatsById($eventId: Int!) {
    event(id: $eventId) {
      id
      averageEntryScore
      highestScore
      highestScoringEntry
      mostSelected
      mostTransferredIn
      mostCaptained
      mostViceCaptained
      transfersMade
      chipPlays
    }
  }
`

export interface EventStatsById {
	id: number
	averageEntryScore: number | null
	highestScore: number | null
	highestScoringEntry: number | null
	mostSelected: number | null
	mostTransferredIn: number | null
	mostCaptained: number | null
	mostViceCaptained: number | null
	transfersMade: number | null
	chipPlays: unknown
}

export interface EventStatsByIdResponse {
	event: EventStatsById | null
}

export const GET_EVENT_OVERALL_RESULT = `
  query GetEventOverallResult {
    eventOverallResult {
      event
      finished
      averageScore
      highestScore
      highestScoringEntry
      transfersMade
      mostViceCaptainedPlayer {
        id
        webName
      }
      mostTransferInPlayer {
        id
        webName
      }
      mostSelectedPlayer {
        id
        webName
      }
      mostCaptainedPlayer {
        id
        webName
      }
      topElementInfo {
        element
        points
        player {
          id
          webName
          team {
            name
          }
        }
      }
      chipPlays {
        chipName
        numberPlayed
      }
    }
  }
`

// Type for player info
export interface PlayerInfo {
	id: number
	webName: string
	firstName?: string
	secondName?: string
}

// Type for team info
export interface TeamInfo {
	name: string
}

// Type for top element player
export interface TopElementPlayer {
	id: number
	webName: string
	team: TeamInfo | null
}

// Type for top element info
export interface TopElementInfo {
	element: number
	points: number
	player: TopElementPlayer | null
}

export interface ChipPlay {
	chipName: string
	numberPlayed: number
}

// Type for event overall result
export interface EventOverallResult {
	event: number
	finished: boolean
	averageScore: number
	highestScore: number
	highestScoringEntry: number
	transfersMade: number
	mostCaptainedPlayer: PlayerInfo | null
	mostViceCaptainedPlayer: PlayerInfo | null
	mostTransferInPlayer: PlayerInfo | null
	mostSelectedPlayer: PlayerInfo | null
	topElementInfo: TopElementInfo
	chipPlays: ChipPlay[]
}

// Type for event overall result response (could be array or single object)
export interface EventOverallResultResponse {
	eventOverallResult: EventOverallResult | EventOverallResult[]
}

// Query to fetch live scores (team of the week)
export const GET_EVENT_FIXTURES = `
  query GetEventFixtures($eventId: Int!) {
    eventFixtures(eventId: $eventId) {
      id
      code
      event {
        id
        name
      }
      kickoffTime
      finished
      started
      homeTeam {
        id
        name
        shortName
      }
      awayTeam {
        id
        name
        shortName
      }
      homeScore
      awayScore
      homeTeamDifficulty
      awayTeamDifficulty
    }
  }
`

// Type for team in fixture
export interface FixtureTeam {
	id: number
	name: string
	shortName: string
}

// Type for event in fixture
export interface FixtureEvent {
	id: number
	name: string
}

// Type for fixture
export interface Fixture {
	id: number
	code: number
	event: FixtureEvent
	kickoffTime: string
	finished: boolean
	started: boolean
	homeTeam: FixtureTeam
	awayTeam: FixtureTeam
	homeScore: number | null
	awayScore: number | null
	homeTeamDifficulty: number
	awayTeamDifficulty: number
}

// Type for event fixtures response
export interface EventFixturesResponse {
	eventFixtures: Fixture[]
}

// Query to fetch live points for an entry
