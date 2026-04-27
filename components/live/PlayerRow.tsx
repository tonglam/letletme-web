"use client";

import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Player } from "@/types/player";
import { PlayerDetail } from "@/types/player-detail";
import { CheckCircle2, Clock, Play } from "lucide-react";
import { useMemo, useState } from "react";
import { PlayerDetailModal } from "./PlayerDetailModal";

interface PlayerRowProps {
  player: Player;
}

interface StatConfig {
  label: string;
  key: keyof Player["stats"];
  description: string;
}

const breakdownLabelMap: Record<string, string> = {
  minutes: "Appearance",
  goals_scored: "Goals",
  assists: "Assists",
  clean_sheets: "Clean Sheet",
  saves: "Saves",
  penalties_saved: "Penalty Saved",
  penalties_missed: "Penalty Missed",
  yellow_cards: "Yellow Card",
  red_cards: "Red Card",
  own_goals: "Own Goal",
  goals_conceded: "Goals Conceded",
  bonus: "Bonus Points",
  total: "Total Points",
  total_points: "Total Points"
};

const breakdownOrder = [
  "minutes",
  "goals_scored",
  "assists",
  "clean_sheets",
  "saves",
  "penalties_saved",
  "penalties_missed",
  "yellow_cards",
  "red_cards",
  "own_goals",
  "goals_conceded",
  "bonus",
  "total",
  "total_points"
] as const;

const positionStats: Record<Player["position"], StatConfig[]> = {
  GKP: [
    { label: "MIN", key: "minutes", description: "Minutes Played" },
    { label: "XGC", key: "expectedGoalsConceded", description: "Expected Goals Conceded" },
    { label: "CS", key: "cleanSheets", description: "Clean Sheets" },
    { label: "SV", key: "saves", description: "Saves" },
    { label: "PS", key: "savePenalty", description: "Penalties Saved" },
    { label: "YC", key: "yellowCards", description: "Yellow Cards" },
    { label: "RC", key: "redCards", description: "Red Cards" }
  ],
  DEF: [
    { label: "MIN", key: "minutes", description: "Minutes Played" },
    { label: "XGC", key: "expectedGoalsConceded", description: "Expected Goals Conceded" },
    { label: "CS", key: "cleanSheets", description: "Clean Sheets" },
    { label: "G", key: "goals", description: "Goals" },
    { label: "A", key: "assists", description: "Assists" },
    { label: "YC", key: "yellowCards", description: "Yellow Cards" },
    { label: "RC", key: "redCards", description: "Red Cards" }
  ],
  MID: [
    { label: "MIN", key: "minutes", description: "Minutes Played" },
    { label: "XGI", key: "expectedGoalInvolvements", description: "Expected Goal Involvements" },
    { label: "G", key: "goals", description: "Goals" },
    { label: "A", key: "assists", description: "Assists" },
    { label: "CS", key: "cleanSheets", description: "Clean Sheets" },
    { label: "YC", key: "yellowCards", description: "Yellow Cards" },
    { label: "RC", key: "redCards", description: "Red Cards" }
  ],
  FWD: [
    { label: "MIN", key: "minutes", description: "Minutes Played" },
    { label: "XG", key: "expectedGoals", description: "Expected Goals" },
    { label: "XA", key: "expectedAssists", description: "Expected Assists" },
    { label: "G", key: "goals", description: "Goals" },
    { label: "A", key: "assists", description: "Assists" },
    { label: "YC", key: "yellowCards", description: "Yellow Cards" },
    { label: "RC", key: "redCards", description: "Red Cards" }
  ]
};
const statusConfig = {
  NOT_STARTED: {
    icon: Clock,
    className: "text-muted-foreground",
    bgClassName: ""
  },
  PLAYING: {
    icon: Play,
    className: "text-emerald-500",
    bgClassName: "bg-emerald-500/10"
  },
  FINISHED: {
    icon: CheckCircle2,
    className: "text-blue-500",
    bgClassName: "bg-blue-500/10"
  }
};

export function PlayerRow({ player }: PlayerRowProps) {
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const StatusIcon = statusConfig[player.playingStatus].icon;
  const roleLabel = player.isBench
    ? player.isBenchBoostActive
      ? "Bench (BB)"
      : "Bench"
    : "Start XI";

  const stats = useMemo(() => {
    return positionStats[player.position];
  }, [player.position]);

  const breakdownFromExplain = useMemo(() => {
    if (!player.breakdownStats || player.breakdownStats.length === 0) {
      return [];
    }

    const totals = player.breakdownStats.reduce<Map<string, number>>((acc, stat) => {
      const current = acc.get(stat.identifier) ?? 0;
      acc.set(stat.identifier, current + stat.points);
      return acc;
    }, new Map());

    const orderedKeys = new Set<string>(breakdownOrder);

    const orderedBreakdown = breakdownOrder
      .map(identifier => {
        const points = totals.get(identifier);
        if (points === undefined || points === 0) {
          return null;
        }
        return {
          category: breakdownLabelMap[identifier] ?? identifier,
          points
        };
      })
      .filter(Boolean) as { category: string; points: number }[];

    const remaining = Array.from(totals.entries())
      .filter(([identifier, points]) => !orderedKeys.has(identifier) && points !== 0)
      .map(([identifier, points]) => ({
        category: breakdownLabelMap[identifier] ?? identifier,
        points
      }));

    return [...orderedBreakdown, ...remaining];
  }, [player.breakdownStats]);

  const computedFallbackBreakdown = useMemo(() => {
    const pointsBreakdown: { category: string; points: number }[] = [];
    
    if (player.stats.minutes > 0) {
      const minutesPoints = player.stats.minutes >= 60 ? 2 : 1;
      pointsBreakdown.push({ category: "Appearance", points: minutesPoints });
    }
    
    if (player.stats.goals > 0) {
      const pointsPerGoal = player.position === "FWD" ? 4 : 
                           player.position === "MID" ? 5 : 
                           player.position === "DEF" ? 6 : 6;
      const goalPoints = player.stats.goals * pointsPerGoal;
      pointsBreakdown.push({ category: "Goals", points: goalPoints });
    }
    
    if (player.stats.assists > 0) {
      const assistPoints = player.stats.assists * 3;
      pointsBreakdown.push({ category: "Assists", points: assistPoints });
    }
    
    if (player.stats.cleanSheets > 0) {
      const csPoints = player.position === "GKP" || player.position === "DEF" ? 4 : 
                      player.position === "MID" ? 1 : 0;
      if (csPoints > 0) {
        pointsBreakdown.push({ category: "Clean Sheet", points: csPoints });
      }
    }
    
    if (player.stats.saves && player.stats.saves > 0) {
      const savePoints = Math.floor(player.stats.saves / 3);
      if (savePoints > 0) {
        pointsBreakdown.push({ category: "Saves", points: savePoints });
      }
    }
    
    if (player.stats.savePenalty && player.stats.savePenalty > 0) {
      const penSavePoints = player.stats.savePenalty * 5;
      pointsBreakdown.push({ category: "Penalty Saved", points: penSavePoints });
    }
    
    if (player.stats.yellowCards > 0) {
      const ycPoints = -1 * player.stats.yellowCards;
      pointsBreakdown.push({ category: "Yellow Card", points: ycPoints });
    }
    
    if (player.stats.redCards > 0) {
      const rcPoints = -3 * player.stats.redCards;
      pointsBreakdown.push({ category: "Red Card", points: rcPoints });
    }
    
    if (player.stats.bonusPoints > 0) {
      pointsBreakdown.push({ category: "Bonus Points", points: player.stats.bonusPoints });
    }
    
    return pointsBreakdown;
  }, [player]);

  // Convert Player to PlayerDetail for the modal
  const playerDetail: PlayerDetail = useMemo(() => {
    const pointsBreakdown =
      breakdownFromExplain.length > 0 ? breakdownFromExplain : computedFallbackBreakdown;

    return {
      id: player.id,
      name: player.name,
      team: player.team,
      teamShort: player.teamShort,
      position: player.position,
      points: player.stats.points,
      ownershipPercentage: 0,
      bps: 0,
      bonusPoints: player.stats.bonusPoints,
      stats: {
        minutes: player.stats.minutes,
        goals: player.stats.goals,
        assists: player.stats.assists,
        cleanSheets: player.stats.cleanSheets,
        saves: player.stats.saves,
        penaltiesSaved: player.stats.savePenalty,
        yellowCards: player.stats.yellowCards,
        redCards: player.stats.redCards
      },
      pointsBreakdown
    };
  }, [player, breakdownFromExplain, computedFallbackBreakdown]);

  return (
    <>
      <div 
        className={cn(
          "p-3 sm:p-4 hover:bg-accent/50 transition-colors border-b last:border-b-0 cursor-pointer",
          player.isBench
            ? "bg-amber-500/10 border-l-4 border-l-amber-500/60"
            : "border-l-4 border-l-emerald-500/50",
          statusConfig[player.playingStatus].bgClassName,
          "relative"
        )}
        onClick={() => setIsDetailModalOpen(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <div className="w-12 sm:w-16 text-xs sm:text-sm font-medium text-muted-foreground flex-shrink-0">{player.position}</div>
            <div className="w-20 sm:w-24 flex items-center text-xs sm:text-sm font-medium flex-shrink-0">
              <StatusIcon className={cn("h-4 w-4", statusConfig[player.playingStatus].className)} />
              <span className="w-14 sm:w-16 text-center">{player.teamShort}</span>
            </div>
            <div className="mr-2 flex-shrink-0">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] sm:text-xs",
                  player.isBench
                    ? "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-700"
                    : "bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700"
                )}
              >
                {roleLabel}
              </Badge>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center min-w-0">
                    <span className="font-medium truncate text-xs sm:text-sm">
                      {player.isCaptain && (
                        <span className="mr-0.5 text-[10px] text-yellow-500">(C)</span>
                      )}
                      {player.isViceCaptain && (
                        <span className="mr-0.5 text-[10px] text-yellow-500">(V)</span>
                      )}
                      {player.name}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{player.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:grid gap-4 text-sm" style={{ gridTemplateColumns: `repeat(${stats.length}, 40px)` }}>
              {stats.map((stat) => (
              <TooltipProvider key={stat.key}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      className="text-center hover:bg-accent rounded p-1.5 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log(`Clicked ${stat.description}: ${player.stats[stat.key]}`);
                      }}
                    >
                      <div className="text-muted-foreground mb-1.5 text-center font-medium">{stat.label}</div>
                      <div className="text-center">{player.stats[stat.key] || 0}</div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{stat.description}: {player.stats[stat.key] || 0}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              ))}
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button 
                    className="w-10 sm:w-12 md:w-16 text-right hover:bg-accent rounded p-1.5 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log(`Clicked Total Points: ${player.stats.points} (Bonus: ${player.stats.bonusPoints})`);
                    }}
                  >
                  <div className="text-muted-foreground text-xs font-medium">PTS</div>
                  <div className="font-bold text-xs sm:text-sm">
                    {player.stats.points}
                  </div>
                  {player.stats.bonusPoints > 0 && (
                    <div className="text-[10px] sm:text-xs text-primary font-medium">
                      BONUS +{player.stats.bonusPoints}
                    </div>
                  )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                <p>Total points: {player.stats.points}</p>
                {player.stats.bonusPoints > 0 && (
                  <p>Bonus: {player.stats.bonusPoints}</p>
                )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>

      {/* Player detail modal */}
      <PlayerDetailModal 
        player={playerDetail}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </>
  );
}
