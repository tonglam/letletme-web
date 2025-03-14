"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { StatsTable } from "@/components/data/StatsTable";
import { Card } from "@/components/ui/card";
import { 
  Trophy, 
  Users, 
  ArrowLeftCircle,
  ArrowRightCircle, 
  Percent,
  Crown,
  ChevronDown
} from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Define types for our statistics data
interface OwnershipData {
  id: string;
  player: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  team: string;
  price: number;
  ownership: number;
  netTransfers: number;
  pointsPerGame: number;
}

interface CaptainData {
  id: string;
  player: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  team: string;
  price: number;
  captainedBy: number;
  viceCaptainedBy: number;
  effectiveOwnership: number;
  points: number;
}

interface TransferData {
  id: string;
  player: string;
  position: "GKP" | "DEF" | "MID" | "FWD";
  team: string;
  price: number;
  transfers: number;
  percentageChange: number;
  form: string;
}

interface TournamentOption {
  id: string;
  name: string;
  gameweek: number;
  totalEntries: number;
}

// Mock tournament data
const tournaments: TournamentOption[] = [
  { id: "t1", name: "Premier League Fan Cup", gameweek: 21, totalEntries: 21568 },
  { id: "t2", name: "Champions League Fantasy", gameweek: 21, totalEntries: 15784 },
  { id: "t3", name: "FPL Content Creators Cup", gameweek: 21, totalEntries: 7631 },
  { id: "t4", name: "Mini-League Challenge", gameweek: 21, totalEntries: 364 },
  { id: "t5", name: "Work Colleagues Cup", gameweek: 21, totalEntries: 12 },
];

// Mock data generator for player ownership for a specific tournament
const generateOwnershipData = (tournamentId: string, gameweek: number): OwnershipData[] => {
  // Add some variance based on tournament ID
  const tournamentIndex = parseInt(tournamentId.substring(1)) || 1;
  const tournamentFactor = tournamentIndex / 5;
  
  const baseData = [
    { id: "23", player: "Haaland", position: "FWD", team: "MCI", price: 14.5, baseOwnership: 82.3, ppg: 8.7 },
    { id: "13", player: "M.Salah", position: "MID", team: "LIV", price: 13.2, baseOwnership: 75.1, ppg: 7.8 },
    { id: "14", player: "Palmer", position: "MID", team: "CHE", price: 5.9, baseOwnership: 58.7, ppg: 6.9 },
    { id: "22", player: "Foden", position: "MID", team: "MCI", price: 8.8, baseOwnership: 45.2, ppg: 6.4 },
    { id: "17", player: "Son", position: "MID", team: "TOT", price: 10.0, baseOwnership: 42.5, ppg: 7.1 },
    { id: "15", player: "Saka", position: "MID", team: "ARS", price: 9.8, baseOwnership: 38.6, ppg: 6.8 },
    { id: "9", player: "Van Dijk", position: "DEF", team: "LIV", price: 6.3, baseOwnership: 35.4, ppg: 5.2 },
    { id: "20", player: "Sávio", position: "MID", team: "MCI", price: 6.7, baseOwnership: 33.2, ppg: 5.9 },
    { id: "26", player: "Watkins", position: "FWD", team: "AVL", price: 8.7, baseOwnership: 30.1, ppg: 6.4 },
    { id: "25", player: "Isak", position: "FWD", team: "NEW", price: 8.2, baseOwnership: 28.7, ppg: 5.8 }
  ];
  
  // Adjust ownership slightly based on tournament and gameweek
  return baseData.map(player => {
    const adjustFactor = (((gameweek + parseInt(player.id) + tournamentIndex) % 7) - 3) / 10; // Small adjustment factor
    const netTransfers = Math.floor((Math.random() * 500 - 250) * 1000 * (1 + tournamentFactor));
    
    return {
      ...player,
      ownership: Math.min(99.9, Math.max(5, player.baseOwnership * (1 + adjustFactor))),
      netTransfers,
      pointsPerGame: player.ppg * (1 + (adjustFactor / 5))
    };
  });
};

// Mock data generator for captain stats for a specific tournament
const generateCaptainData = (tournamentId: string, gameweek: number): CaptainData[] => {
  // Add some variance based on tournament ID
  const tournamentIndex = parseInt(tournamentId.substring(1)) || 1;
  const tournamentFactor = tournamentIndex / 5;
  
  const baseData = [
    { id: "23", player: "Haaland", position: "FWD", team: "MCI", price: 14.5, baseCaptaincy: 42.5, baseVice: 12.3, baseEO: 125.6, basePoints: 13 },
    { id: "13", player: "M.Salah", position: "MID", team: "LIV", price: 13.2, baseCaptaincy: 33.7, baseVice: 15.6, baseEO: 115.2, basePoints: 14 },
    { id: "17", player: "Son", position: "MID", team: "TOT", price: 10.0, baseCaptaincy: 8.9, baseVice: 9.4, baseEO: 62.8, basePoints: 9 },
    { id: "15", player: "Saka", position: "MID", team: "ARS", price: 9.8, baseCaptaincy: 5.2, baseVice: 8.3, baseEO: 55.6, basePoints: 7 },
    { id: "22", player: "Foden", position: "MID", team: "MCI", price: 8.8, baseCaptaincy: 4.8, baseVice: 6.7, baseEO: 51.2, basePoints: 8 },
    { id: "26", player: "Watkins", position: "FWD", team: "AVL", price: 8.7, baseCaptaincy: 3.6, baseVice: 4.2, baseEO: 38.5, basePoints: 6 },
    { id: "25", player: "Isak", position: "FWD", team: "NEW", price: 8.2, baseCaptaincy: 2.8, baseVice: 3.9, baseEO: 36.2, basePoints: 5 },
    { id: "14", player: "Palmer", position: "MID", team: "CHE", price: 5.9, baseCaptaincy: 2.4, baseVice: 3.1, baseEO: 32.4, basePoints: 12 }
  ];
  
  // Adjust captaincy slightly based on tournament and gameweek
  return baseData.map(player => {
    const adjustFactor = (((gameweek + parseInt(player.id) + tournamentIndex) % 7) - 3) / 10; // Small adjustment factor
    
    return {
      ...player,
      captainedBy: Math.min(99.9, Math.max(0.1, player.baseCaptaincy * (1 + adjustFactor + tournamentFactor))),
      viceCaptainedBy: Math.min(99.9, Math.max(0.1, player.baseVice * (1 + adjustFactor))),
      effectiveOwnership: Math.min(199.9, Math.max(1, player.baseEO * (1 + adjustFactor))),
      points: Math.floor(player.basePoints * (1 + (adjustFactor / 2)))
    };
  });
};

// Mock data generator for transfers for a specific tournament
const generateTransferData = (tournamentId: string, gameweek: number, type: "in" | "out"): TransferData[] => {
  // Add some variance based on tournament ID
  const tournamentIndex = parseInt(tournamentId.substring(1)) || 1;
  const tournamentFactor = tournamentIndex / 5;
  
  // Different base data for transfers in and out
  const baseDataIn = [
    { id: "20", player: "Sávio", position: "MID", team: "MCI", price: 6.7, baseTransfers: 675000, baseChange: 12.4, baseForm: "8.2" },
    { id: "14", player: "Palmer", position: "MID", team: "CHE", price: 5.9, baseTransfers: 580000, baseChange: 10.7, baseForm: "7.8" },
    { id: "21", player: "Mbeumo", position: "MID", team: "BRE", price: 7.1, baseTransfers: 495000, baseChange: 9.2, baseForm: "8.5" },
    { id: "25", player: "Isak", position: "FWD", team: "NEW", price: 8.2, baseTransfers: 457000, baseChange: 8.5, baseForm: "7.2" },
    { id: "11", player: "Kerkez", position: "DEF", team: "BOU", price: 4.5, baseTransfers: 412000, baseChange: 7.8, baseForm: "6.8" }
  ];
  
  const baseDataOut = [
    { id: "24", player: "N.Jackson", position: "FWD", team: "CHE", price: 7.1, baseTransfers: 520000, baseChange: -9.8, baseForm: "2.4" },
    { id: "16", player: "Fernandes", position: "MID", team: "MUN", price: 8.4, baseTransfers: 467000, baseChange: -8.6, baseForm: "3.2" },
    { id: "30", player: "Núñez", position: "FWD", team: "LIV", price: 7.5, baseTransfers: 423000, baseChange: -7.9, baseForm: "2.8" },
    { id: "26", player: "Watkins", position: "FWD", team: "AVL", price: 8.7, baseTransfers: 378000, baseChange: -7.2, baseForm: "3.5" },
    { id: "18", player: "Ødegaard", position: "MID", team: "ARS", price: 8.4, baseTransfers: 325000, baseChange: -6.4, baseForm: "3.8" }
  ];
  
  const baseData = type === "in" ? baseDataIn : baseDataOut;
  
  // Adjust transfers slightly based on tournament and gameweek
  return baseData.map(player => {
    const adjustFactor = (((gameweek + parseInt(player.id) + tournamentIndex) % 7) - 3) / 10; // Small adjustment factor
    const directionMultiplier = type === "in" ? 1 : -1;
    
    return {
      ...player,
      transfers: Math.floor(player.baseTransfers * (1 + adjustFactor) * (1 + tournamentFactor)),
      percentageChange: player.baseChange * (1 + adjustFactor) * directionMultiplier,
      form: player.baseForm
    };
  });
};

export default function SelectionsPage() {
  const [selectedGameweek, setSelectedGameweek] = useState<number>(21);
  const [selectedTournament, setSelectedTournament] = useState<TournamentOption>(tournaments[0]);
  const [ownershipData, setOwnershipData] = useState<OwnershipData[]>([]);
  const [captainData, setCaptainData] = useState<CaptainData[]>([]);
  const [transfersInData, setTransfersInData] = useState<TransferData[]>([]);
  const [transfersOutData, setTransfersOutData] = useState<TransferData[]>([]);

  useEffect(() => {
    // Update data when gameweek or tournament changes
    setOwnershipData(generateOwnershipData(selectedTournament.id, selectedGameweek));
    setCaptainData(generateCaptainData(selectedTournament.id, selectedGameweek));
    setTransfersInData(generateTransferData(selectedTournament.id, selectedGameweek, "in"));
    setTransfersOutData(generateTransferData(selectedTournament.id, selectedGameweek, "out"));
  }, [selectedGameweek, selectedTournament]);

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Tournament Selections</h1>
        
        <Card className="p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-medium">Select Tournament:</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto justify-between">
                  <span className="truncate">{selectedTournament.name}</span>
                  <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[300px]">
                {tournaments.map((t) => (
                  <DropdownMenuItem
                    key={t.id}
                    onClick={() => setSelectedTournament(t)}
                    className="flex justify-between items-center"
                  >
                    <span className="truncate">{t.name}</span>
                    {t.id === selectedTournament.id && (
                      <Trophy className="h-4 w-4 text-primary ml-2" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Card>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <GameweekSelector 
            onGameweekChange={setSelectedGameweek}
            currentGameweek={21}
          />
          
          <Card className="p-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Tournament Stats</p>
              <div className="flex justify-between">
                <div className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{formatCompactNumber(selectedTournament.totalEntries)} participants</span>
                </div>
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  Top 10K Managers
                </Badge>
              </div>
            </div>
          </Card>
        </div>
        
        <div className="space-y-8">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  Tournament Player Ownership
                </h2>
                <p className="text-muted-foreground">
                  The most selected players in {selectedTournament.name} for Gameweek {selectedGameweek}
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary">
                Tournament Data
              </Badge>
            </div>
            
            <StatsTable
              title=""
              data={ownershipData}
              columns={[
                { 
                  key: "player", 
                  label: "Player", 
                  format: (value, row) => (
                    <div className="flex flex-col">
                      <span className="font-medium">{value}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.team} | {row.position}
                      </span>
                    </div>
                  )
                },
                { 
                  key: "price", 
                  label: "Price", 
                  format: (value) => `£${value.toFixed(1)}m`,
                  className: "text-right"
                },
                { 
                  key: "ownership", 
                  label: "Ownership", 
                  format: (value) => (
                    <div className="flex items-center justify-end gap-1 text-primary">
                      <Percent className="h-3 w-3" />
                      <span>{value.toFixed(1)}</span>
                    </div>
                  ),
                  className: "text-right"
                },
                { 
                  key: "netTransfers", 
                  label: "Net Transfers", 
                  format: (value) => {
                    const isPositive = value > 0;
                    return (
                      <div className={`flex items-center justify-end gap-1 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isPositive ? <ArrowRightCircle className="h-3 w-3" /> : <ArrowLeftCircle className="h-3 w-3" />}
                        <span>{formatCompactNumber(Math.abs(value))}</span>
                      </div>
                    );
                  },
                  className: "text-right"
                },
                { 
                  key: "pointsPerGame", 
                  label: "PPG", 
                  format: (value) => value.toFixed(1),
                  className: "text-right"
                }
              ]}
            />
          </Card>
          
          <Card className="p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  Tournament Captain Selections
                </h2>
                <p className="text-muted-foreground">
                  The most captained players in {selectedTournament.name} for Gameweek {selectedGameweek}
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary">
                Tournament Data
              </Badge>
            </div>
            
            <StatsTable
              title=""
              data={captainData}
              columns={[
                { 
                  key: "player", 
                  label: "Player", 
                  format: (value, row) => (
                    <div className="flex flex-col">
                      <span className="font-medium">{value}</span>
                      <span className="text-xs text-muted-foreground">
                        {row.team} | {row.position}
                      </span>
                    </div>
                  )
                },
                { 
                  key: "captainedBy", 
                  label: "Captain %", 
                  format: (value) => (
                    <div className="flex items-center justify-end gap-1 text-yellow-500">
                      <Percent className="h-3 w-3" />
                      <span>{value.toFixed(1)}</span>
                    </div>
                  ),
                  className: "text-right"
                },
                { 
                  key: "viceCaptainedBy", 
                  label: "Vice %", 
                  format: (value) => (
                    <div className="flex items-center justify-end gap-1 text-amber-500">
                      <Percent className="h-3 w-3" />
                      <span>{value.toFixed(1)}</span>
                    </div>
                  ),
                  className: "text-right"
                },
                { 
                  key: "effectiveOwnership", 
                  label: "Effective Ownership", 
                  format: (value) => (
                    <div className="flex items-center justify-end gap-1 text-primary">
                      <Percent className="h-3 w-3" />
                      <span>{value.toFixed(1)}</span>
                    </div>
                  ),
                  className: "text-right"
                },
                { 
                  key: "points", 
                  label: "Points", 
                  format: (value) => value,
                  className: "text-right font-bold"
                }
              ]}
            />
          </Card>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ArrowRightCircle className="h-5 w-5 text-emerald-500" />
                Tournament Transfers In
              </h2>
              
              <StatsTable
                title=""
                data={transfersInData}
                columns={[
                  { 
                    key: "player", 
                    label: "Player", 
                    format: (value, row) => (
                      <div className="flex flex-col">
                        <span className="font-medium">{value}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.team} | {row.position}
                        </span>
                      </div>
                    )
                  },
                  { 
                    key: "transfers", 
                    label: "Transfers", 
                    format: (value) => formatCompactNumber(value),
                    className: "text-right text-emerald-600"
                  },
                  { 
                    key: "percentageChange", 
                    label: "Change", 
                    format: (value) => (
                      <div className="flex items-center justify-end gap-1 text-emerald-600">
                        <span>+{value.toFixed(1)}%</span>
                      </div>
                    ),
                    className: "text-right"
                  }
                ]}
              />
            </Card>
            
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <ArrowLeftCircle className="h-5 w-5 text-rose-500" />
                Tournament Transfers Out
              </h2>
              
              <StatsTable
                title=""
                data={transfersOutData}
                columns={[
                  { 
                    key: "player", 
                    label: "Player", 
                    format: (value, row) => (
                      <div className="flex flex-col">
                        <span className="font-medium">{value}</span>
                        <span className="text-xs text-muted-foreground">
                          {row.team} | {row.position}
                        </span>
                      </div>
                    )
                  },
                  { 
                    key: "transfers", 
                    label: "Transfers", 
                    format: (value) => formatCompactNumber(value),
                    className: "text-right text-rose-600"
                  },
                  { 
                    key: "percentageChange", 
                    label: "Change", 
                    format: (value) => (
                      <div className="flex items-center justify-end gap-1 text-rose-600">
                        <span>{value.toFixed(1)}%</span>
                      </div>
                    ),
                    className: "text-right"
                  }
                ]}
              />
            </Card>
          </div>
        </div>
        
        <div className="bg-muted/30 p-4 rounded-lg text-sm text-muted-foreground mt-8">
          <p className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>Tournament selection data is based on teams participating in {selectedTournament.name}.</span>
          </p>
        </div>
      </div>
    </RootLayout>
  );
}