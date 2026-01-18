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
`;

// Type for current event (only need ID)
export interface CurrentEvent {
  id: number;
}

// Type for next event (need ID and deadline)
export interface NextEvent {
  id: number;
  deadlineTime: string; // ISO 8601 date string
}

// Type for the events response
export interface EventsResponse {
  current: CurrentEvent[];
  next: NextEvent[];
}

// Query to fetch player values
export const GET_PLAYER_VALUES = `
  query GetPlayerValues {
    playerValues {
      playerId
      playerName
      teamName
      position
      lastValue
      value
    }
  }
`;

// Type for player value data
export interface PlayerValue {
  playerId: number;
  playerName: string;
  teamName: string;
  position: string;
  lastValue: number;
  value: number;
}

// Type for player values response
export interface PlayerValuesResponse {
  playerValues: PlayerValue[];
}

// Query to fetch event overall result
export const GET_EVENT_OVERALL_RESULT = `
  query GetEventOverallResult($season: Int!) {
    eventOverallResult(season: $season) {
      event
      highestScore
      mostSelected
      mostSelectedPlayer {
        id
        webName
        firstName
        secondName
      }
      mostCaptained
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
    }
  }
`;

// Type for player info
export interface PlayerInfo {
  id: number;
  webName: string;
  firstName?: string;
  secondName?: string;
}

// Type for most selected player
export interface MostSelectedPlayer extends PlayerInfo {
  firstName: string;
  secondName: string;
}

// Type for team info
export interface TeamInfo {
  name: string;
}

// Type for top element player
export interface TopElementPlayer {
  id: number;
  webName: string;
  team: TeamInfo;
}

// Type for top element info
export interface TopElementInfo {
  element: number;
  points: number;
  player: TopElementPlayer;
}

// Type for event overall result
export interface EventOverallResult {
  event: number;
  highestScore: number;
  mostSelected: number;
  mostSelectedPlayer: MostSelectedPlayer;
  mostCaptained: number;
  mostCaptainedPlayer: PlayerInfo;
  topElementInfo: TopElementInfo;
}

// Type for event overall result response (could be array or single object)
export interface EventOverallResultResponse {
  eventOverallResult: EventOverallResult | EventOverallResult[];
}

// Query to fetch live scores (team of the week)
export const GET_LIVE_SCORES = `
  query GetLiveScores($eventId: Int!) {
    liveScores(eventId: $eventId, filter: { inDreamTeam: true }) {
      player {
        id
        webName
        position
      }
      inDreamTeam
      totalPoints
    }
  }
`;

// Type for live score player
export interface LiveScorePlayer {
  id: number;
  webName: string;
  position?: string; // Should be "GKP", "DEF", "MID", or "FWD"
}

// Type for live score entry
export interface LiveScore {
  player: LiveScorePlayer;
  inDreamTeam: boolean;
  totalPoints: number;
}

// Type for live scores response
export interface LiveScoresResponse {
  liveScores: LiveScore[];
}

// Query to fetch top transfers in
export const GET_TOP_TRANSFERS_IN = `
  query GetTopTransfersIn($eventId: Int!, $limit: Int) {
    topTransfersIn(eventId: $eventId, limit: $limit) {
      player {
        id
        webName
        position
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
`;

// Query to fetch top transfers out
export const GET_TOP_TRANSFERS_OUT = `
  query GetTopTransfersOut($eventId: Int!, $limit: Int) {
    topTransfersOut(eventId: $eventId, limit: $limit) {
      player {
        id
        webName
        position
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
`;

// Type for transfer player
export interface TransferPlayer {
  id: number;
  webName: string;
  position?: string;
  team?: {
    name: string;
    shortName?: string;
  };
}

// Type for top transfer entry
export interface TopTransfer {
  player: TransferPlayer;
  eventId: number;
  transfersInEvent: number;
  transfersOutEvent: number;
}

// Type for top transfers response
export interface TopTransfersResponse {
  topTransfersIn?: TopTransfer[];
  topTransfersOut?: TopTransfer[];
}

// Query to fetch event fixtures
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
`;

// Type for team in fixture
export interface FixtureTeam {
  id: number;
  name: string;
  shortName: string;
}

// Type for event in fixture
export interface FixtureEvent {
  id: number;
  name: string;
}

// Type for fixture
export interface Fixture {
  id: number;
  code: number;
  event: FixtureEvent;
  kickoffTime: string;
  finished: boolean;
  started: boolean;
  homeTeam: FixtureTeam;
  awayTeam: FixtureTeam;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamDifficulty: number;
  awayTeamDifficulty: number;
}

// Type for event fixtures response
export interface EventFixturesResponse {
  eventFixtures: Fixture[];
}
