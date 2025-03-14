"use client";

import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import Image from "next/image";
import { Activity, Clock, Eye, User, Award, BarChart2 } from "lucide-react";
import { Match, PlayerStat } from "@/types/match";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useState } from "react";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { PlayerDetail } from "@/types/player-detail";

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDetail | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  
  // Get bonus points if available or create empty array
  const bonusPoints = match.bonusPoints || [];
  
  // Get BPS data if available or create empty array
  const bpsData = match.bps || [];
  
  // Format match status for display
  const getStatusDisplay = () => {
    if (match.status === "LIVE") {
      return (
        <div className="flex items-center gap-1">
          <Activity className="h-4 w-4 text-red-500 animate-pulse" />
          <span className="text-red-500 font-medium">{match.minute}'</span>
        </div>
      );
    } else if (match.status === "HT") {
      return <span className="text-yellow-500 font-medium">Half Time</span>;
    } else if (match.status === "FT") {
      return <span className="text-muted-foreground font-medium">Full Time</span>;
    } else {
      return <span className="text-blue-500 font-medium">Upcoming</span>;
    }
  };

  // Helper function to get color based on BPS score
  const getBpsColor = (score: number) => {
    if (score >= 50) return "text-emerald-500";
    if (score >= 25) return "text-blue-500";
    if (score >= 0) return "text-gray-500";
    if (score >= -25) return "text-amber-500";
    return "text-rose-500";
  };

  // Convert PlayerStat to PlayerDetail structure
  const openPlayerDetail = (player: PlayerStat, team: string, teamShort: string) => {
    // Calculate points based on stats
    let totalPoints = 0;
    const pointsBreakdown = [];
    
    if (player.goals && player.goals > 0) {
      const goalPoints = player.goals * 5;
      totalPoints += goalPoints;
      pointsBreakdown.push({ category: "Goals", points: goalPoints });
    }
    
    if (player.assists && player.assists > 0) {
      const assistPoints = player.assists * 3;
      totalPoints += assistPoints;
      pointsBreakdown.push({ category: "Assists", points: assistPoints });
    }
    
    // Assume 2 points for playing 60+ minutes
    const minutesPlayed = 90;
    if (minutesPlayed >= 60) {
      totalPoints += 2;
      pointsBreakdown.push({ category: "Appearance", points: 2 });
    } else if (minutesPlayed > 0) {
      totalPoints += 1;
      pointsBreakdown.push({ category: "Appearance", points: 1 });
    }
    
    // Assume clean sheet points based on position
    const position = player.player.includes("Raya") || player.player.includes("Pope") ? "GKP" : 
                   player.player.includes("Gabriel") ? "DEF" : "MID";
    
    const hasCleanSheet = player.player.includes("Raya") || player.player.includes("Gabriel");
    if (hasCleanSheet) {
      const csPoints = position === "GKP" || position === "DEF" ? 4 : position === "MID" ? 1 : 0;
      if (csPoints > 0) {
        totalPoints += csPoints;
        pointsBreakdown.push({ category: "Clean Sheet", points: csPoints });
      }
    }
    
    // Deduct for yellow cards
    if (player.yellow_cards && player.yellow_cards > 0) {
      const ycPoints = -1 * player.yellow_cards;
      totalPoints += ycPoints;
      pointsBreakdown.push({ category: "Yellow Card", points: ycPoints });
    }
    
    // Deduct for red cards
    if (player.red_cards && player.red_cards > 0) {
      const rcPoints = -3 * player.red_cards;
      totalPoints += rcPoints;
      pointsBreakdown.push({ category: "Red Card", points: rcPoints });
    }
    
    // Add bonus points if available
    const bonusPoints = player.bonus_points || 0;
    if (bonusPoints > 0) {
      totalPoints += bonusPoints;
      pointsBreakdown.push({ category: "Bonus Points", points: bonusPoints });
    }
    
    const playerDetail: PlayerDetail = {
      id: player.player,
      name: player.player,
      team: team,
      teamShort: teamShort,
      position: position,
      points: totalPoints,
      ownershipPercentage: Math.round(Math.random() * 50 * 10) / 10, // Random ownership for demo
      bps: player.bps || 0,
      bonusPoints: player.bonus_points || 0,
      stats: {
        minutes: minutesPlayed,
        goals: player.goals || 0,
        assists: player.assists || 0,
        cleanSheets: hasCleanSheet ? 1 : 0,
        saves: player.player.includes("Raya") || player.player.includes("Pope") ? Math.floor(Math.random() * 5) : 0,
        penaltiesSaved: player.penalties_saved || 0,
        yellowCards: player.yellow_cards || 0,
        redCards: player.red_cards || 0
      },
      pointsBreakdown: pointsBreakdown
    };
    
    setSelectedPlayer(playerDetail);
    setIsDetailModalOpen(true);
  };

  return (
    <Card className="p-4 md:p-6 overflow-hidden">
      <div className="space-y-6">
        {/* Header with time and viewers */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>{format(new Date(match.kickoff), "MMMM d, yyyy HH:mm")}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span>{new Intl.NumberFormat().format(match.viewers)}</span>
          </div>
        </div>

        {/* Score section */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Home team */}
          <div className="text-right space-y-2">
            <div className="flex items-center justify-end gap-3">
              <span className="font-semibold">{match.homeTeam.name}</span>
              <div className="relative w-8 h-8">
                <Image
                  src={`/team-logos/${match.homeTeam.shortName.toLowerCase()}.png`}
                  alt={match.homeTeam.name}
                  fill
                  className="object-contain"
                />
              </div>
            </div>
            {match.homeTeam.manager && (
              <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer">{match.homeTeam.manager.team}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{match.homeTeam.manager.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium text-primary">
                  {match.homeTeam.manager.points} pts
                </span>
              </div>
            )}
          </div>

          {/* Score */}
          <div className="text-center">
            <div className="bg-background rounded-lg px-4 py-2 shadow-sm">
              <div className="text-2xl font-bold mb-1">
                {match.homeTeam.score} - {match.awayTeam.score}
              </div>
              <div className="flex items-center justify-center gap-1 text-sm">
                {getStatusDisplay()}
              </div>
            </div>
          </div>

          {/* Away team */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="relative w-8 h-8">
                <Image
                  src={`/team-logos/${match.awayTeam.shortName.toLowerCase()}.png`}
                  alt={match.awayTeam.name}
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-semibold">{match.awayTeam.name}</span>
            </div>
            {match.awayTeam.manager && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-pointer">{match.awayTeam.manager.team}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{match.awayTeam.manager.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span className="font-medium text-primary">
                  {match.awayTeam.manager.points} pts
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bonus Points Section */}
        {match.status !== "UPCOMING" && bonusPoints.length > 0 && (
          <div className="bg-accent/30 rounded-md p-3">
            <div className="flex items-center mb-2 gap-1.5">
              <Award className="h-4 w-4 text-yellow-500" />
              <h3 className="text-sm font-medium">Bonus Points</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {bonusPoints.map((bp, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
                >
                  <span className="font-medium">{bp.player}</span>
                  <span className="text-muted-foreground">({bp.team})</span>
                  <span className={`font-bold ${
                    bp.points === 3 ? "text-yellow-500" : 
                    bp.points === 2 ? "text-gray-400" : 
                    "text-amber-700"
                  }`}>
                    +{bp.points}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* BPS Section */}
        {match.status !== "UPCOMING" && (
          <div className="bg-accent/30 rounded-md p-3">
            <div className="flex items-center mb-2 gap-1.5">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-medium">Bonus Point System (BPS)</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {bpsData.length > 0 ? (
                bpsData.map((bps, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
                  >
                    <span className="font-medium">{bps.player}</span>
                    <span className="text-muted-foreground">({bps.team})</span>
                    <span className={`font-bold ${getBpsColor(bps.score)}`}>
                      {bps.score}
                    </span>
                  </div>
                ))
              ) : (
                // If no BPS data available, show sample data for visualization
                [
                  { player: "Son", team: "TOT", score: 87 },
                  { player: "Salah", team: "LIV", score: 76 },
                  { player: "Haaland", team: "MCI", score: 64 },
                  { player: "Palmer", team: "CHE", score: 58 },
                  { player: "Fernandes", team: "MUN", score: 51 }
                ].map((bps, idx) => (
                  <div 
                    key={idx} 
                    className="flex items-center gap-1 bg-background rounded-full px-3 py-1 text-xs"
                  >
                    <span className="font-medium">{bps.player}</span>
                    <span className="text-muted-foreground">({bps.team})</span>
                    <span className={`font-bold ${getBpsColor(bps.score)}`}>
                      {bps.score}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Player stats tabs - one tab per team */}
        {match.status !== "UPCOMING" && (
          <Tabs defaultValue={match.homeTeam.shortName} className="w-full">
            <TabsList className="grid grid-cols-2 mb-2">
              <TabsTrigger value={match.homeTeam.shortName} className="flex items-center gap-2">
                <div className="relative w-4 h-4">
                  <Image
                    src={`/team-logos/${match.homeTeam.shortName.toLowerCase()}.png`}
                    alt={match.homeTeam.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <span>{match.homeTeam.name}</span>
              </TabsTrigger>
              <TabsTrigger value={match.awayTeam.shortName} className="flex items-center gap-2">
                <div className="relative w-4 h-4">
                  <Image
                    src={`/team-logos/${match.awayTeam.shortName.toLowerCase()}.png`}
                    alt={match.awayTeam.name}
                    fill
                    className="object-contain"
                  />
                </div>
                <span>{match.awayTeam.name}</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Home team players tab */}
            <TabsContent value={match.homeTeam.shortName} className="space-y-2">
              {match.homeTeam.players.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No player data available yet
                </div>
              ) : (
                match.homeTeam.players.map((player, index) => (
                  <button 
                    key={index}
                    className="text-sm p-3 bg-accent/30 rounded-lg w-full text-left transition-colors hover:bg-accent/50"
                    onClick={() => openPlayerDetail(player, match.homeTeam.name, match.homeTeam.shortName)}
                  >
                    <div className="font-medium flex justify-between">
                      <span>{player.player}</span>
                      {player.bonus_points && (
                        <Badge variant="outline" className="text-xs font-bold text-yellow-500">
                          +{player.bonus_points}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-2 mt-2">
                      {player.goals && player.goals > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          ⚽ {player.goals}
                        </span>
                      )}
                      {player.assists && player.assists > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          👟 {player.assists}
                        </span>
                      )}
                      {player.yellow_cards && player.yellow_cards > 0 && (
                        <span className="bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 text-xs">
                          YC {player.yellow_cards}
                        </span>
                      )}
                      {player.red_cards && player.red_cards > 0 && (
                        <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs">
                          RC {player.red_cards}
                        </span>
                      )}
                      {player.penalties_saved && player.penalties_saved > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          PS {player.penalties_saved}
                        </span>
                      )}
                      {player.penalties_missed && player.penalties_missed > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          PM {player.penalties_missed}
                        </span>
                      )}
                      {player.bps !== undefined && (
                        <span className={`bg-background rounded-full px-2 py-0.5 text-xs ${getBpsColor(player.bps)}`}>
                          BPS: {player.bps}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </TabsContent>
            
            {/* Away team players tab */}
            <TabsContent value={match.awayTeam.shortName} className="space-y-2">
              {match.awayTeam.players.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  No player data available yet
                </div>
              ) : (
                match.awayTeam.players.map((player, index) => (
                  <button 
                    key={index}
                    className="text-sm p-3 bg-accent/30 rounded-lg w-full text-left transition-colors hover:bg-accent/50"
                    onClick={() => openPlayerDetail(player, match.awayTeam.name, match.awayTeam.shortName)}
                  >
                    <div className="font-medium flex justify-between">
                      <span>{player.player}</span>
                      {player.bonus_points && (
                        <Badge variant="outline" className="text-xs font-bold text-yellow-500">
                          +{player.bonus_points}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground flex flex-wrap gap-2 mt-2">
                      {player.goals && player.goals > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          ⚽ {player.goals}
                        </span>
                      )}
                      {player.assists && player.assists > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          👟 {player.assists}
                        </span>
                      )}
                      {player.yellow_cards && player.yellow_cards > 0 && (
                        <span className="bg-yellow-100 text-yellow-700 rounded-full px-2 py-0.5 text-xs">
                          YC {player.yellow_cards}
                        </span>
                      )}
                      {player.red_cards && player.red_cards > 0 && (
                        <span className="bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs">
                          RC {player.red_cards}
                        </span>
                      )}
                      {player.penalties_saved && player.penalties_saved > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          PS {player.penalties_saved}
                        </span>
                      )}
                      {player.penalties_missed && player.penalties_missed > 0 && (
                        <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                          PM {player.penalties_missed}
                        </span>
                      )}
                      {player.bps !== undefined && (
                        <span className={`bg-background rounded-full px-2 py-0.5 text-xs ${getBpsColor(player.bps)}`}>
                          BPS: {player.bps}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Player detail modal */}
      <PlayerDetailModal 
        player={selectedPlayer}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </Card>
  );
}