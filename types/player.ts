export interface Player {
  id: string;
  name: string;
  team: string;
  teamShort: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  playingStatus: "NOT_STARTED" | "PLAYING" | "FINISHED";
  isBench?: boolean;
  isBenchBoostActive?: boolean;
  /** Bonus points system score from the live pick row (not ownership). */
  bps?: number;
  breakdownStats?: PlayerBreakdownStat[];
  explanationStats?: PlayerExplanationStats;
  stats: {
    minutes: number;
    goals: number;
    expectedGoals: number;
    expectedAssists: number;
    expectedGoalInvolvements: number;
    expectedGoalsConceded: number;
    assists: number;
    saves: number;
    savePenalty: number;
    cleanSheets: number;
    goalsConceded?: number;
    defensiveContribution?: number;
    ownGoals?: number;
    penaltiesMissed?: number;
    yellowCards: number;
    redCards: number;
    points: number;
    bonusPoints: number;
  };
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  autoSubRole?: "PREDICTED_IN" | "PREDICTED_OUT" | "OFFICIAL_IN" | "OFFICIAL_OUT";
  autoSubPartnerName?: string;
}

export interface PlayerBreakdownStat {
  identifier: string;
  value: number;
  points: number;
}

export interface PlayerExplanationStats {
  minutes?: number | null;
  goalsScored?: number | null;
  assists?: number | null;
  cleanSheets?: number | null;
  goalsConceded?: number | null;
  ownGoals?: number | null;
  penaltiesSaved?: number | null;
  penaltiesMissed?: number | null;
  yellowCards?: number | null;
  redCards?: number | null;
  saves?: number | null;
  defensiveContribution?: number | null;
  bonus?: number | null;
}
