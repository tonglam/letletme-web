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
  status: "LIVE" | "HT" | "FT" | "UPCOMING" | "NOT_STARTED";
  minute: number;
  kickoff: string;
  viewers: number;
  bonusPoints?: BonusPoint[];
  bps?: BPSEntry[];
}

export interface PlayerStat {
  player: string;
  elementType?: number; // 1=GKP, 2=DEF, 3=MID, 4=FWD
  minutes?: number;
  goals?: number;
  assists?: number;
  cleanSheets?: number;
  goalsConceded?: number;
  ownGoals?: number;
  penalties_saved?: number;
  penalties_missed?: number;
  yellow_cards?: number;
  red_cards?: number;
  bonus_points?: number;
  bps?: number;
  defensiveContribution?: number; // cleanSheets + saves
  saves?: number;
  totalPoints?: number;
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