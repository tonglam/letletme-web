"use client";

import { Player } from "@/types/player";
import { Clock, Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { PlayerDetail } from "@/types/player-detail";

interface PlayerRowProps {
  player: Player;
}

interface StatConfig {
  label: string;
  key: keyof Player["stats"];
  description: string;
}

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

  const stats = useMemo(() => {
    return positionStats[player.position];
  }, [player.position]);

  // Convert Player to PlayerDetail for the modal
  const playerDetail: PlayerDetail = useMemo(() => {
    // Calculate point breakdown
    const pointsBreakdown = [];
    
    // Minutes points
    if (player.stats.minutes > 0) {
      const minutesPoints = player.stats.minutes >= 60 ? 2 : 1;
      pointsBreakdown.push({ category: "Appearance", points: minutesPoints });
    }
    
    // Goal points
    if (player.stats.goals > 0) {
      const pointsPerGoal = player.position === "FWD" ? 4 : 
                           player.position === "MID" ? 5 : 
                           player.position === "DEF" ? 6 : 6;
      const goalPoints = player.stats.goals * pointsPerGoal;
      pointsBreakdown.push({ category: "Goals", points: goalPoints });
    }
    
    // Assist points
    if (player.stats.assists > 0) {
      const assistPoints = player.stats.assists * 3;
      pointsBreakdown.push({ category: "Assists", points: assistPoints });
    }
    
    // Clean sheet points
    if (player.stats.cleanSheets > 0) {
      const csPoints = player.position === "GKP" || player.position === "DEF" ? 4 : 
                      player.position === "MID" ? 1 : 0;
      if (csPoints > 0) {
        pointsBreakdown.push({ category: "Clean Sheet", points: csPoints });
      }
    }
    
    // Saves points
    if (player.stats.saves && player.stats.saves > 0) {
      const savePoints = Math.floor(player.stats.saves / 3);
      if (savePoints > 0) {
        pointsBreakdown.push({ category: "Saves", points: savePoints });
      }
    }
    
    // Penalty saves
    if (player.stats.savePenalty && player.stats.savePenalty > 0) {
      const penSavePoints = player.stats.savePenalty * 5;
      pointsBreakdown.push({ category: "Penalty Saved", points: penSavePoints });
    }
    
    // Yellow cards
    if (player.stats.yellowCards > 0) {
      const ycPoints = -1 * player.stats.yellowCards;
      pointsBreakdown.push({ category: "Yellow Card", points: ycPoints });
    }
    
    // Red cards
    if (player.stats.redCards > 0) {
      const rcPoints = -3 * player.stats.redCards;
      pointsBreakdown.push({ category: "Red Card", points: rcPoints });
    }
    
    // Bonus points
    if (player.stats.bonusPoints > 0) {
      pointsBreakdown.push({ category: "Bonus Points", points: player.stats.bonusPoints });
    }
    
    return {
      id: player.id,
      name: player.name,
      team: player.team,
      teamShort: player.teamShort,
      position: player.position,
      points: player.stats.points,
      ownershipPercentage: Math.round(Math.random() * 50 * 10) / 10, // Random ownership for demo
      bps: Math.floor(Math.random() * 100), // Random BPS for demo
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
      pointsBreakdown: pointsBreakdown
    };
  }, [player]);

  return (
    <>
      <div 
        className={cn(
          "p-3 sm:p-4 hover:bg-accent/50 transition-colors border-b last:border-b-0 cursor-pointer",
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
                      {player.stats.bonusPoints > 0 && (
                        <span className="text-primary ml-1">+{player.stats.bonusPoints}</span>
                      )}
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total Points: {player.stats.points} (Bonus: {player.stats.bonusPoints})</p>
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