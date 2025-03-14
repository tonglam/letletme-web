export interface PlayerDetail {
  id: string;
  name: string;
  team: string;
  teamShort: string;
  position: string;
  points: number;
  ownershipPercentage: number;
  bps: number;
  bonusPoints: number;
  stats: {
    minutes: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    saves?: number;
    penaltiesSaved?: number;
    yellowCards: number;
    redCards: number;
  };
  pointsBreakdown: {
    category: string;
    points: number;
  }[];
}