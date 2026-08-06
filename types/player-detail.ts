export interface PlayerDetail {
  id: string;
  name: string;
  team: string;
  teamShort: string;
  position: string;
  points: number;
  /** null when live entry payload does not include ownership. */
  ownershipPercentage: number | null;
  /** null when BPS is not available on the live pick. */
  bps: number | null;
  bonusPoints: number;
  breakdownPending?: boolean;
  /** official explain vs pick-derived provisional when explain is empty/out of sync */
  breakdownSource?: 'official' | 'provisional' | 'none';
  playingStatus?: 'NOT_STARTED' | 'PLAYING' | 'FINISHED';
  stats: {
    minutes: number;
    goals: number;
    assists: number;
    cleanSheets: number;
    saves?: number;
    penaltiesSaved?: number;
    yellowCards: number;
    redCards: number;
    goalsConceded?: number;
    defensiveContribution?: number;
    ownGoals?: number;
    penaltiesMissed?: number;
  };
  pointsBreakdown: {
    category: string;
    points: number;
    value?: number;
  }[];
}
