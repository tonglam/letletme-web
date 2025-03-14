"use client";

import { ArrowRightCircle, ArrowLeftCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactNumber } from "@/lib/utils";
import { useState } from "react";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { PlayerDetail } from "@/types/player-detail";

interface Transfer {
  position: string;
  player: string;
  club: string;
  cost: number;
}

interface TransferPair {
  in: Transfer;
  out: Transfer;
}

const transfers: TransferPair[] = [
  {
    in: { position: "MID", player: "Marmoush", club: "MCI", cost: 5.6 },
    out: { position: "FWD", player: "Cunha", club: "WOL", cost: 6.8 }
  },
  {
    in: { position: "FWD", player: "Haaland", club: "MCI", cost: 14.0 },
    out: { position: "MID", player: "Maddison", club: "TOT", cost: 8.7 }
  }
];

function TransferRow({ transfer }: { transfer: TransferPair }) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Function to convert Transfer to PlayerDetail
  const createPlayerDetail = (player: Transfer, isIn: boolean): PlayerDetail => {
    const isGoalkeeper = player.position === "GKP";
    const isDefender = player.position === "DEF";
    const isMidfielder = player.position === "MID";
    const isForward = player.position === "FWD";
    
    // Generate random stats for demonstration purposes
    const goals = isGoalkeeper ? 0 : Math.floor(Math.random() * (isForward ? 3 : 2));
    const assists = isGoalkeeper ? 0 : Math.floor(Math.random() * 2);
    const cleanSheets = isGoalkeeper || isDefender ? Math.floor(Math.random() * 2) : 0;
    const yellowCards = Math.random() > 0.8 ? 1 : 0;
    const redCards = Math.random() > 0.95 ? 1 : 0;
    const saves = isGoalkeeper ? Math.floor(Math.random() * 5) : 0;
    const bonusPoints = Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0;
    
    // Calculate points based on position and stats
    let points = 0;
    const pointsBreakdown = [];
    
    // Appearance points
    const minutes = 90;
    points += 2; // Assuming played >= 60 mins
    pointsBreakdown.push({ category: "Appearance", points: 2 });
    
    // Goals points
    if (goals > 0) {
      const goalPoints = goals * (
        isGoalkeeper || isDefender ? 6 :
        isMidfielder ? 5 : 4
      );
      points += goalPoints;
      pointsBreakdown.push({ category: "Goals", points: goalPoints });
    }
    
    // Assists points
    if (assists > 0) {
      const assistPoints = assists * 3;
      points += assistPoints;
      pointsBreakdown.push({ category: "Assists", points: assistPoints });
    }
    
    // Clean sheet points
    if (cleanSheets > 0) {
      const csPoints = (isGoalkeeper || isDefender) ? 4 : isMidfielder ? 1 : 0;
      points += csPoints;
      pointsBreakdown.push({ category: "Clean Sheet", points: csPoints });
    }
    
    // Saves points
    if (saves > 0) {
      const savePoints = Math.floor(saves / 3);
      if (savePoints > 0) {
        points += savePoints;
        pointsBreakdown.push({ category: "Saves", points: savePoints });
      }
    }
    
    // Yellow cards
    if (yellowCards > 0) {
      points -= yellowCards;
      pointsBreakdown.push({ category: "Yellow Card", points: -yellowCards });
    }
    
    // Red cards
    if (redCards > 0) {
      points -= redCards * 3;
      pointsBreakdown.push({ category: "Red Card", points: -redCards * 3 });
    }
    
    // Bonus points
    if (bonusPoints > 0) {
      points += bonusPoints;
      pointsBreakdown.push({ category: "Bonus Points", points: bonusPoints });
    }
    
    return {
      id: player.player,
      name: player.player,
      team: isIn ? `${player.club} (New)` : player.club,
      teamShort: player.club,
      position: player.position,
      points: points,
      ownershipPercentage: Math.round(Math.random() * 30 * 10) / 10,
      bps: Math.floor(Math.random() * 90),
      bonusPoints: bonusPoints,
      stats: {
        minutes: minutes,
        goals: goals,
        assists: assists,
        cleanSheets: cleanSheets,
        saves: saves,
        penaltiesSaved: 0,
        yellowCards: yellowCards,
        redCards: redCards
      },
      pointsBreakdown: pointsBreakdown
    };
  };

  const handlePlayerClick = (player: Transfer, isIn: boolean) => {
    setSelectedPlayer(createPlayerDetail(player, isIn));
    setIsDetailModalOpen(true);
  };

  return (
    <>
      <div className="p-3 sm:p-4 hover:bg-accent/50 transition-colors border-b last:border-b-0">
        <div className="flex justify-between gap-4">
          {/* Transfer Out */}
          <div className="flex items-center justify-between flex-1">
            <div 
              className="flex items-center min-w-0 cursor-pointer hover:bg-accent/70 p-2 rounded-lg transition-colors"
              onClick={() => handlePlayerClick(transfer.out, false)}
            >
              <div className="w-12 sm:w-16 text-xs sm:text-sm font-medium text-muted-foreground flex-shrink-0">
                {transfer.out.position}
              </div>
              <div className="w-24 sm:w-28 flex items-center text-xs sm:text-sm font-medium flex-shrink-0">
                <ArrowLeftCircle className="h-4 w-4 text-rose-500 mr-2" />
                <span className="text-center">{transfer.out.club}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center min-w-0">
                      <span className="font-medium truncate text-xs sm:text-sm">
                        {transfer.out.player}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{transfer.out.player}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400 ml-2">
              £{transfer.out.cost.toFixed(1)}m
            </span>
          </div>

          {/* Transfer In */}
          <div className="flex items-center justify-between flex-1">
            <div 
              className="flex items-center min-w-0 cursor-pointer hover:bg-accent/70 p-2 rounded-lg transition-colors"
              onClick={() => handlePlayerClick(transfer.in, true)}
            >
              <div className="w-24 sm:w-28 flex items-center text-xs sm:text-sm font-medium flex-shrink-0">
                <ArrowRightCircle className="h-4 w-4 text-emerald-500 mr-2" />
                <span className="text-center">{transfer.in.club}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center min-w-0">
                      <span className="font-medium truncate text-xs sm:text-sm">
                        {transfer.in.player}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{transfer.in.player}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 ml-2">
              £{transfer.in.cost.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      {/* Player detail modal */}
      <PlayerDetailModal 
        player={selectedPlayer}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </>
  );
}

export function TransferSection() {
  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 text-sm font-medium text-muted-foreground border-b">
        Transfers
      </div>
      <div>
        {transfers.map((transfer, index) => (
          <TransferRow key={index} transfer={transfer} />
        ))}
      </div>
    </div>
  );
}