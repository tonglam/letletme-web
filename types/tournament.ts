export interface TournamentEntryPick {
  element: number;
  webName: string;
  teamShortName: string;
  teamName: string;
  elementTypeName: string;
  position: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
}

export interface TournamentEntry {
  id: string;
  rank: number;
  previousRank?: number;
  teamName: string;
  managerName: string;
  captainName: string;
  captainTeam: string;
  captainPoints: number;
  gwPoints?: number;
  gwNetPoints?: number;
  eventCost?: number;
  overallRank?: number;
  livePoints: number;
  totalPoints: number;
  playersPlayed: number;
  playersToPlay: number;
  picks: TournamentEntryPick[];
  chips: {
    bench: boolean;
    triple: boolean;
    wildcard: boolean;
  };
}

export interface Tournament {
  id: string;
  name: string;
  entries: TournamentEntry[];
  gameweek: number;
  averagePoints: number;
  highestPoints: number;
  totalEntries: number;
}
