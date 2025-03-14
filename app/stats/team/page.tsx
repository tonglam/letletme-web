"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsTable } from "@/components/data/StatsTable";
import { 
  User, 
  Calendar, 
  Clock, 
  Star, 
  Users, 
  Trophy, 
  BarChart2, 
  ArrowUp,
  ArrowDown
} from "lucide-react";
import Image from "next/image";
import { formatCompactNumber } from "@/lib/utils";

// Types for team stats
interface UserTeamStats {
  teamName: string;
  managerName: string;
  overallPoints: number;
  overallRank: number;
  gameweekPoints: number;
  gameweekRank: number;
  value: number;
  bank: number;
  lastDeadlineTeam: {
    goalkeepers: PlayerStats[];
    defenders: PlayerStats[];
    midfielders: PlayerStats[];
    forwards: PlayerStats[];
  };
  captainHistory: CaptainHistoryItem[];
  pointsHistory: PointsHistoryItem[];
  chips: {
    benchBoost: boolean;
    benchBoostUsed: boolean;
    tripleCaptain: boolean;
    tripleCaptainUsed: boolean;
    wildcard: boolean;
    wildcardUsed: boolean;
    freeHit: boolean;
    freeHitUsed: boolean;
  };
  transfers: {
    gameweekTransfers: number;
    totalTransfers: number;
    transfersCost: number;
    bankValue: number;
    teamValue: number;
  };
}

interface PlayerStats {
  name: string;
  team: string;
  price: number;
  totalPoints: number;
  gameweekPoints: number;
  form: number;
  selected: boolean;
}

interface CaptainHistoryItem {
  gameweek: number;
  player: string;
  team: string;
  points: number;
}

interface PointsHistoryItem {
  gameweek: number;
  points: number;
  averagePoints: number;
  highestPoints: number;
  rank: number;
  rankChange: number;
}

// Generate mock user team stats
const generateUserTeamStats = (): UserTeamStats => {
  return {
    teamName: "Arsenal Guangzhou FC",
    managerName: "Gunners Fan",
    overallPoints: 1788,
    overallRank: 120456,
    gameweekPoints: 78,
    gameweekRank: 345678,
    value: 103.2,
    bank: 2.3,
    lastDeadlineTeam: {
      goalkeepers: [
        {
          name: "Raya",
          team: "ARS",
          price: 5.1,
          totalPoints: 123,
          gameweekPoints: 6,
          form: 5.3,
          selected: true
        },
        {
          name: "Sánchez",
          team: "CHE",
          price: 4.6,
          totalPoints: 87,
          gameweekPoints: 0,
          form: 3.1,
          selected: false
        }
      ],
      defenders: [
        {
          name: "Gabriel",
          team: "ARS",
          price: 5.3,
          totalPoints: 132,
          gameweekPoints: 8,
          form: 6.7,
          selected: true
        },
        {
          name: "Trippier",
          team: "NEW",
          price: 6.5,
          totalPoints: 145,
          gameweekPoints: 7,
          form: 5.4,
          selected: true
        },
        {
          name: "Van Dijk",
          team: "LIV",
          price: 6.3,
          totalPoints: 118,
          gameweekPoints: 2,
          form: 4.2,
          selected: true
        },
        {
          name: "Gvardiol",
          team: "MCI",
          price: 5.2,
          totalPoints: 96,
          gameweekPoints: 1,
          form: 3.8,
          selected: true
        },
        {
          name: "Kerkez",
          team: "BOU",
          price: 4.5,
          totalPoints: 83,
          gameweekPoints: 0,
          form: 2.1,
          selected: false
        }
      ],
      midfielders: [
        {
          name: "M.Salah",
          team: "LIV",
          price: 13.2,
          totalPoints: 205,
          gameweekPoints: 14,
          form: 7.8,
          selected: true
        },
        {
          name: "Saka",
          team: "ARS",
          price: 9.8,
          totalPoints: 178,
          gameweekPoints: 8,
          form: 6.8,
          selected: true
        },
        {
          name: "Palmer",
          team: "CHE",
          price: 5.9,
          totalPoints: 156,
          gameweekPoints: 12,
          form: 6.9,
          selected: true
        },
        {
          name: "Foden",
          team: "MCI",
          price: 8.8,
          totalPoints: 168,
          gameweekPoints: 6,
          form: 6.4,
          selected: true
        },
        {
          name: "Mbeumo",
          team: "BRE",
          price: 7.1,
          totalPoints: 143,
          gameweekPoints: 0,
          form: 4.2,
          selected: false
        }
      ],
      forwards: [
        {
          name: "Haaland",
          team: "MCI",
          price: 14.5,
          totalPoints: 210,
          gameweekPoints: 12,
          form: 8.7,
          selected: true
        },
        {
          name: "Watkins",
          team: "AVL",
          price: 8.7,
          totalPoints: 165,
          gameweekPoints: 0,
          form: 6.4,
          selected: false
        },
        {
          name: "Isak",
          team: "NEW",
          price: 8.2,
          totalPoints: 142,
          gameweekPoints: 2,
          form: 5.8,
          selected: true
        }
      ]
    },
    captainHistory: [
      { gameweek: 21, player: "M.Salah", team: "LIV", points: 14 },
      { gameweek: 20, player: "Haaland", team: "MCI", points: 16 },
      { gameweek: 19, player: "Haaland", team: "MCI", points: 4 },
      { gameweek: 18, player: "M.Salah", team: "LIV", points: 24 },
      { gameweek: 17, player: "Haaland", team: "MCI", points: 8 },
      { gameweek: 16, player: "M.Salah", team: "LIV", points: 18 },
      { gameweek: 15, player: "M.Salah", team: "LIV", points: 14 },
      { gameweek: 14, player: "Haaland", team: "MCI", points: 26 },
      { gameweek: 13, player: "Haaland", team: "MCI", points: 8 },
      { gameweek: 12, player: "M.Salah", team: "LIV", points: 16 }
    ],
    pointsHistory: [
      { gameweek: 21, points: 78, averagePoints: 41, highestPoints: 96, rank: 120456, rankChange: 15423 },
      { gameweek: 20, points: 63, averagePoints: 44, highestPoints: 92, rank: 135879, rankChange: -8765 },
      { gameweek: 19, points: 45, averagePoints: 40, highestPoints: 88, rank: 127114, rankChange: 9876 },
      { gameweek: 18, points: 87, averagePoints: 52, highestPoints: 102, rank: 136990, rankChange: 24567 },
      { gameweek: 17, points: 54, averagePoints: 43, highestPoints: 90, rank: 161557, rankChange: -7654 },
      { gameweek: 16, points: 76, averagePoints: 48, highestPoints: 94, rank: 153903, rankChange: 12345 },
      { gameweek: 15, points: 61, averagePoints: 39, highestPoints: 86, rank: 166248, rankChange: 5678 },
      { gameweek: 14, points: 94, averagePoints: 56, highestPoints: 110, rank: 171926, rankChange: 34567 },
      { gameweek: 13, points: 51, averagePoints: 42, highestPoints: 89, rank: 206493, rankChange: -9876 },
      { gameweek: 12, points: 68, averagePoints: 47, highestPoints: 95, rank: 196617, rankChange: 17654 }
    ],
    chips: {
      benchBoost: true,
      benchBoostUsed: false,
      tripleCaptain: true,
      tripleCaptainUsed: false,
      wildcard: true,
      wildcardUsed: true,
      freeHit: true,
      freeHitUsed: false
    },
    transfers: {
      gameweekTransfers: 1,
      totalTransfers: 42,
      transfersCost: 4,
      bankValue: 2.3,
      teamValue: 103.2
    }
  };
};

export default function TeamStatsPage() {
  const [teamStats, setTeamStats] = useState<UserTeamStats | null>(null);
  
  useEffect(() => {
    // Generate mock data
    setTeamStats(generateUserTeamStats());
  }, []);
  
  if (!teamStats) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Loading team stats...</p>
          </div>
        </div>
      </RootLayout>
    );
  }
  
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Team Stats</h1>
        
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-3 rounded-full">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{teamStats.teamName}</h2>
                <p className="text-muted-foreground">{teamStats.managerName}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Badge className="py-1.5 px-2.5 bg-primary/10 text-primary border-primary/20">
                £{teamStats.value.toFixed(1)}m Team Value
              </Badge>
              <Badge className="py-1.5 px-2.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200">
                £{teamStats.bank.toFixed(1)}m In Bank
              </Badge>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-accent/30 p-4 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Overall Points</p>
              <p className="text-2xl font-bold">{teamStats.overallPoints}</p>
            </div>
            
            <div className="bg-accent/30 p-4 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Overall Rank</p>
              <p className="text-2xl font-bold">{formatCompactNumber(teamStats.overallRank)}</p>
            </div>
            
            <div className="bg-accent/30 p-4 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Gameweek Points</p>
              <p className="text-2xl font-bold">{teamStats.gameweekPoints}</p>
            </div>
            
            <div className="bg-accent/30 p-4 rounded-lg text-center">
              <p className="text-xs text-muted-foreground mb-1">Gameweek Rank</p>
              <p className="text-2xl font-bold">{formatCompactNumber(teamStats.gameweekRank)}</p>
            </div>
          </div>
        </Card>
        
        <Tabs defaultValue="squad" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="squad">
              <Users className="h-4 w-4 mr-2" />
              Squad
            </TabsTrigger>
            <TabsTrigger value="history">
              <Calendar className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
            <TabsTrigger value="chips">
              <Star className="h-4 w-4 mr-2" />
              Chips
            </TabsTrigger>
          </TabsList>
          
          {/* Squad Tab */}
          <TabsContent value="squad">
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-6">Current Squad</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20">GKP</Badge>
                    Goalkeepers
                  </h3>
                  
                  <StatsTable
                    title=""
                    data={teamStats.lastDeadlineTeam.goalkeepers}
                    columns={[
                      { 
                        key: "name", 
                        label: "Player",
                        format: (value, row) => (
                          <div className="flex items-center gap-2">
                            <span className={row.selected ? "font-medium" : "text-muted-foreground"}>{value}</span>
                            {!row.selected && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">Bench</span>}
                          </div>
                        )
                      },
                      { 
                        key: "team", 
                        label: "Team", 
                        className: "text-center" 
                      },
                      { 
                        key: "price", 
                        label: "Price", 
                        format: (value) => `£${value.toFixed(1)}m`,
                        className: "text-center" 
                      },
                      { 
                        key: "form", 
                        label: "Form", 
                        className: "text-center" 
                      },
                      { 
                        key: "gameweekPoints", 
                        label: "GW", 
                        className: "text-center" 
                      },
                      { 
                        key: "totalPoints", 
                        label: "Total", 
                        className: "text-right font-bold" 
                      }
                    ]}
                  />
                </div>
                
                <div>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20">DEF</Badge>
                    Defenders
                  </h3>
                  
                  <StatsTable
                    title=""
                    data={teamStats.lastDeadlineTeam.defenders}
                    columns={[
                      { 
                        key: "name", 
                        label: "Player",
                        format: (value, row) => (
                          <div className="flex items-center gap-2">
                            <span className={row.selected ? "font-medium" : "text-muted-foreground"}>{value}</span>
                            {!row.selected && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">Bench</span>}
                          </div>
                        )
                      },
                      { 
                        key: "team", 
                        label: "Team", 
                        className: "text-center" 
                      },
                      { 
                        key: "price", 
                        label: "Price", 
                        format: (value) => `£${value.toFixed(1)}m`,
                        className: "text-center" 
                      },
                      { 
                        key: "form", 
                        label: "Form", 
                        className: "text-center" 
                      },
                      { 
                        key: "gameweekPoints", 
                        label: "GW", 
                        className: "text-center" 
                      },
                      { 
                        key: "totalPoints", 
                        label: "Total", 
                        className: "text-right font-bold" 
                      }
                    ]}
                  />
                </div>
                
                <div>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20">MID</Badge>
                    Midfielders
                  </h3>
                  
                  <StatsTable
                    title=""
                    data={teamStats.lastDeadlineTeam.midfielders}
                    columns={[
                      { 
                        key: "name", 
                        label: "Player",
                        format: (value, row) => (
                          <div className="flex items-center gap-2">
                            <span className={row.selected ? "font-medium" : "text-muted-foreground"}>{value}</span>
                            {!row.selected && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">Bench</span>}
                          </div>
                        )
                      },
                      { 
                        key: "team", 
                        label: "Team", 
                        className: "text-center" 
                      },
                      { 
                        key: "price", 
                        label: "Price", 
                        format: (value) => `£${value.toFixed(1)}m`,
                        className: "text-center" 
                      },
                      { 
                        key: "form", 
                        label: "Form", 
                        className: "text-center" 
                      },
                      { 
                        key: "gameweekPoints", 
                        label: "GW", 
                        className: "text-center" 
                      },
                      { 
                        key: "totalPoints", 
                        label: "Total", 
                        className: "text-right font-bold" 
                      }
                    ]}
                  />
                </div>
                
                <div>
                  <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
                    <Badge className="bg-primary/10 text-primary border-primary/20">FWD</Badge>
                    Forwards
                  </h3>
                  
                  <StatsTable
                    title=""
                    data={teamStats.lastDeadlineTeam.forwards}
                    columns={[
                      { 
                        key: "name", 
                        label: "Player",
                        format: (value, row) => (
                          <div className="flex items-center gap-2">
                            <span className={row.selected ? "font-medium" : "text-muted-foreground"}>{value}</span>
                            {!row.selected && <span className="text-xs bg-muted px-1.5 py-0.5 rounded-sm">Bench</span>}
                          </div>
                        )
                      },
                      { 
                        key: "team", 
                        label: "Team", 
                        className: "text-center" 
                      },
                      { 
                        key: "price", 
                        label: "Price", 
                        format: (value) => `£${value.toFixed(1)}m`,
                        className: "text-center" 
                      },
                      { 
                        key: "form", 
                        label: "Form", 
                        className: "text-center" 
                      },
                      { 
                        key: "gameweekPoints", 
                        label: "GW", 
                        className: "text-center" 
                      },
                      { 
                        key: "totalPoints", 
                        label: "Total", 
                        className: "text-right font-bold" 
                      }
                    ]}
                  />
                </div>
              </div>
            </Card>
            
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Transfer Information</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-accent/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Gameweek Transfers</p>
                  <p className="text-xl font-bold">{teamStats.transfers.gameweekTransfers}</p>
                </div>
                
                <div className="bg-accent/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Total Transfers</p>
                  <p className="text-xl font-bold">{teamStats.transfers.totalTransfers}</p>
                </div>
                
                <div className="bg-accent/30 p-4 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Transfer Cost</p>
                  <p className="text-xl font-bold">{teamStats.transfers.transfersCost} pts</p>
                </div>
              </div>
            </Card>
          </TabsContent>
          
          {/* History Tab */}
          <TabsContent value="history">
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Captain History
              </h2>
              
              <StatsTable
                title=""
                data={teamStats.captainHistory}
                columns={[
                  { 
                    key: "gameweek", 
                    label: "GW",
                    className: "text-center"
                  },
                  { 
                    key: "player", 
                    label: "Player",
                    format: (value, row) => (
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{value}</span>
                        <span className="text-xs text-muted-foreground">({row.team})</span>
                      </div>
                    )
                  },
                  { 
                    key: "points", 
                    label: "Points", 
                    className: "text-right font-bold text-primary" 
                  }
                ]}
              />
            </Card>
            
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Gameweek History
              </h2>
              
              <StatsTable
                title=""
                data={teamStats.pointsHistory}
                columns={[
                  { 
                    key: "gameweek", 
                    label: "GW",
                    className: "text-center"
                  },
                  { 
                    key: "points", 
                    label: "Points", 
                    className: "text-center font-bold"
                  },
                  { 
                    key: "averagePoints", 
                    label: "Average", 
                    className: "text-center"
                  },
                  { 
                    key: "highestPoints", 
                    label: "Highest", 
                    className: "text-center"
                  },
                  { 
                    key: "rank", 
                    label: "Rank", 
                    format: (value) => formatCompactNumber(value),
                    className: "text-center"
                  },
                  { 
                    key: "rankChange", 
                    label: "Change", 
                    format: (value) => (
                      <div className="flex items-center justify-end gap-1">
                        {value > 0 ? (
                          <>
                            <ArrowUp className="h-4 w-4 text-emerald-500" />
                            <span className="text-emerald-500">{formatCompactNumber(Math.abs(value))}</span>
                          </>
                        ) : value < 0 ? (
                          <>
                            <ArrowDown className="h-4 w-4 text-rose-500" />
                            <span className="text-rose-500">{formatCompactNumber(Math.abs(value))}</span>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </div>
                    ),
                    className: "text-right"
                  }
                ]}
              />
            </Card>
          </TabsContent>
          
          {/* Chips Tab */}
          <TabsContent value="chips">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Chips Status
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`p-6 rounded-lg ${teamStats.chips.benchBoostUsed ? 'bg-gray-100 dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`text-lg font-bold ${teamStats.chips.benchBoostUsed ? 'text-gray-500 dark:text-gray-400' : 'text-blue-700 dark:text-blue-300'}`}>
                        Bench Boost
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Points from your bench are included in your total score for the Gameweek
                      </p>
                    </div>
                    <Badge 
                      className={teamStats.chips.benchBoostUsed 
                        ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-300' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200'}
                    >
                      {teamStats.chips.benchBoostUsed ? 'USED' : 'AVAILABLE'}
                    </Badge>
                  </div>
                  {teamStats.chips.benchBoostUsed && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Used in Gameweek 12</span>
                    </div>
                  )}
                </div>
                
                <div className={`p-6 rounded-lg ${teamStats.chips.tripleCaptainUsed ? 'bg-gray-100 dark:bg-gray-800' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`text-lg font-bold ${teamStats.chips.tripleCaptainUsed ? 'text-gray-500 dark:text-gray-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                        Triple Captain
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Your captain scores 3x points instead of 2x for the Gameweek
                      </p>
                    </div>
                    <Badge 
                      className={teamStats.chips.tripleCaptainUsed 
                        ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-300' 
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200'}
                    >
                      {teamStats.chips.tripleCaptainUsed ? 'USED' : 'AVAILABLE'}
                    </Badge>
                  </div>
                  {teamStats.chips.tripleCaptainUsed && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Used in Gameweek 15</span>
                    </div>
                  )}
                </div>
                
                <div className={`p-6 rounded-lg ${teamStats.chips.wildcardUsed ? 'bg-gray-100 dark:bg-gray-800' : 'bg-purple-50 dark:bg-purple-900/20'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`text-lg font-bold ${teamStats.chips.wildcardUsed ? 'text-gray-500 dark:text-gray-400' : 'text-purple-700 dark:text-purple-300'}`}>
                        Wildcard
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Make unlimited free transfers for a Gameweek
                      </p>
                    </div>
                    <Badge 
                      className={teamStats.chips.wildcardUsed 
                        ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-300' 
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200'}
                    >
                      {teamStats.chips.wildcardUsed ? 'USED' : 'AVAILABLE'}
                    </Badge>
                  </div>
                  {teamStats.chips.wildcardUsed && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Used in Gameweek 8</span>
                    </div>
                  )}
                </div>
                
                <div className={`p-6 rounded-lg ${teamStats.chips.freeHitUsed ? 'bg-gray-100 dark:bg-gray-800' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className={`text-lg font-bold ${teamStats.chips.freeHitUsed ? 'text-gray-500 dark:text-gray-400' : 'text-amber-700 dark:text-amber-300'}`}>
                        Free Hit
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Make unlimited free transfers for a Gameweek with your squad returning to how it was
                      </p>
                    </div>
                    <Badge 
                      className={teamStats.chips.freeHitUsed 
                        ? 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300 border-gray-300' 
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200'}
                    >
                      {teamStats.chips.freeHitUsed ? 'USED' : 'AVAILABLE'}
                    </Badge>
                  </div>
                  {teamStats.chips.freeHitUsed && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Used in Gameweek 19</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RootLayout>
  );
}