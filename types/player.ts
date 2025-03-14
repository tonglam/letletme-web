export interface Player {
  id: string;
  name: string;
  team: string;
  teamShort: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  playingStatus: "NOT_STARTED" | "PLAYING" | "FINISHED";
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
    yellowCards: number;
    redCards: number;
    points: number;
    bonusPoints: number;
  };
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}