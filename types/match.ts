export interface Match {
  id: string;
  homeTeam: {
    name: string;
    shortName: string;
    score: number;
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    players: PlayerStat[];
    manager?: {
      name: string;
      points: number;
      team: string;
    };
  };
  awayTeam: {
    name: string;
    shortName: string;
    score: number;
    possession: number;
    shots: number;
    shotsOnTarget: number;
    corners: number;
    players: PlayerStat[];
    manager?: {
      name: string;
      points: number;
      team: string;
    };
  };
  status: "LIVE" | "HT" | "FT" | "UPCOMING";
  minute: number;
  kickoff: string;
  viewers: number;
  bonusPoints?: BonusPoint[];
  bps?: BPSEntry[];
}

export interface PlayerStat {
  player: string;
  goals?: number;
  assists?: number;
  penalties_saved?: number;
  penalties_missed?: number;
  yellow_cards?: number;
  red_cards?: number;
  bonus_points?: number;
  bps?: number;
}

interface BonusPoint {
  player: string;
  team: string;
  points: number;
}

interface BPSEntry {
  player: string;
  team: string;
  score: number;
}