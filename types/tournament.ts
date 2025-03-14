export interface TournamentEntry {
  id: string;
  rank: number;
  previousRank?: number;
  teamName: string;
  managerName: string;
  captainName: string;
  captainTeam: string;
  captainPoints: number;
  livePoints: number;
  totalPoints: number;
  playersPlayed: number;
  playersToPlay: number;
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