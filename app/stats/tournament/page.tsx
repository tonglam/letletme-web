"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsTable } from "@/components/data/StatsTable";
import { 
  Trophy, 
  Users, 
  ArrowRight, 
  ArrowLeft,
  BarChart2, 
  Medal, 
  Crown,
  TrendingUp,
  Calendar,
  Star
} from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";

// Interfaces for tournament stats
interface TournamentStats {
  id: string;
  name: string;
  createdBy: string;
  playerCount: number;
  currentGameweek: number;
  startGameweek: number;
  endGameweek: number;
  myRank: number;
  myPreviousRank: number;
  myTeam: {
    name: string;
    points: number;
    captaincy: {
      name: string;
      team: string;
      points: number;
    };
  };
  topPerformers: TopPerformer[];
  standings: Standing[];
  captainStats: CaptainStat[];
  chipUsage: ChipUsage[];
  h2hRecord?: H2HRecord[];
}

interface TopPerformer {
  rank: number;
  teamName: string;
  managerName: string;
  points: number;
  captain: {
    name: string;
    team: string;
    points: number;
  };
}

interface Standing {
  rank: number;
  previousRank: number;
  teamName: string;
  managerName: string;
  gameweekPoints: number;
  totalPoints: number;
}

interface CaptainStat {
  player: string;
  team: string;
  count: number;
  percentage: number;
  averagePoints: number;
}

interface ChipUsage {
  chip: string;
  count: number;
  percentage: number;
  averagePoints: number;
}

interface H2HRecord {
  opponent: string;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

// Mock tournament data
const mockTournaments = [
  {
    id: "t1",
    name: "Premier League Fan Cup",
    createdBy: "tong",
    playerCount: 21568,
    currentGameweek: 21,
    startGameweek: 16,
    endGameweek: 26,
    myRank: 1345,
    myPreviousRank: 1532,
    myTeam: {
      name: "Arsenal Guangzhou FC",
      points: 78,
      captaincy: {
        name: "M.Salah",
        team: "LIV",
        points: 14
      }
    },
    topPerformers: [
      {
        rank: 1,
        teamName: "Arsenal Guangzhou FC",
        managerName: "Gunners Fan",
        points: 78,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      },
      {
        rank: 2,
        teamName: "沉迷于搬砖不想披",
        managerName: "Brick Layer",
        points: 77,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      },
      {
        rank: 3,
        teamName: "世俱杯冠军阿森纳",
        managerName: "Arsenal Champion",
        points: 76,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      },
      {
        rank: 4,
        teamName: "Lord Bendtner",
        managerName: "Nick B",
        points: 73,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 12
        }
      },
      {
        rank: 5,
        teamName: "JackieHooooooo",
        managerName: "Jackie H",
        points: 71,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      }
    ],
    standings: [
      {
        rank: 1,
        previousRank: 3,
        teamName: "Arsenal Guangzhou FC",
        managerName: "Gunners Fan",
        gameweekPoints: 78,
        totalPoints: 1788
      },
      {
        rank: 2,
        previousRank: 1,
        teamName: "沉迷于搬砖不想披",
        managerName: "Brick Layer",
        gameweekPoints: 77,
        totalPoints: 1684
      },
      {
        rank: 3,
        previousRank: 2,
        teamName: "世俱杯冠军阿森纳",
        managerName: "Arsenal Champion",
        gameweekPoints: 76,
        totalPoints: 1909
      },
      {
        rank: 4,
        previousRank: 8,
        teamName: "Lord Bendtner",
        managerName: "Nick B",
        gameweekPoints: 73,
        totalPoints: 1555
      },
      {
        rank: 5,
        previousRank: 4,
        teamName: "JackieHooooooo",
        managerName: "Jackie H",
        gameweekPoints: 71,
        totalPoints: 1836
      },
      {
        rank: 6,
        previousRank: 5,
        teamName: "WHY NOT",
        managerName: "Just Because",
        gameweekPoints: 71,
        totalPoints: 1810
      },
      {
        rank: 7,
        previousRank: 6,
        teamName: "杀猪会 tong牛合屋之人",
        managerName: "Tong",
        gameweekPoints: 71,
        totalPoints: 1779
      },
      {
        rank: 8,
        previousRank: 10,
        teamName: "Arminia Bielefeld",
        managerName: "German Fan",
        gameweekPoints: 71,
        totalPoints: 1861
      },
      {
        rank: 9,
        previousRank: 7,
        teamName: "Chelsea Forever Blue",
        managerName: "Blues Fan",
        gameweekPoints: 68,
        totalPoints: 1723
      },
      {
        rank: 10,
        previousRank: 9,
        teamName: "Spurs Are On Fire",
        managerName: "Tottenham Loyal",
        gameweekPoints: 67,
        totalPoints: 1690
      }
    ],
    captainStats: [
      {
        player: "M.Salah",
        team: "LIV",
        count: 8965,
        percentage: 41.6,
        averagePoints: 14
      },
      {
        player: "Haaland",
        team: "MCI",
        count: 6748,
        percentage: 31.3,
        averagePoints: 12
      },
      {
        player: "Son",
        team: "TOT",
        count: 2164,
        percentage: 10.0,
        averagePoints: 9
      },
      {
        player: "Palmer",
        team: "CHE",
        count: 1523,
        percentage: 7.1,
        averagePoints: 12
      },
      {
        player: "Saka",
        team: "ARS",
        count: 1078,
        percentage: 5.0,
        averagePoints: 7
      },
      {
        player: "Others",
        team: "N/A",
        count: 1090,
        percentage: 5.0,
        averagePoints: 4
      }
    ],
    chipUsage: [
      {
        chip: "Bench Boost",
        count: 756,
        percentage: 3.5,
        averagePoints: 86
      },
      {
        chip: "Triple Captain",
        count: 621,
        percentage: 2.9,
        averagePoints: 92
      },
      {
        chip: "Wildcard",
        count: 435,
        percentage: 2.0,
        averagePoints: 84
      },
      {
        chip: "Free Hit",
        count: 389,
        percentage: 1.8,
        averagePoints: 79
      }
    ]
  },
  {
    id: "t2",
    name: "Champions League Fantasy",
    createdBy: "Alex",
    playerCount: 15784,
    currentGameweek: 21,
    startGameweek: 18,
    endGameweek: 28,
    myRank: 879,
    myPreviousRank: 1023,
    myTeam: {
      name: "Arsenal Guangzhou FC",
      points: 72,
      captaincy: {
        name: "M.Salah",
        team: "LIV",
        points: 16
      }
    },
    topPerformers: [
      {
        rank: 1,
        teamName: "沉迷于搬砖不想披",
        managerName: "Brick Layer",
        points: 74,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      },
      {
        rank: 2,
        teamName: "Arsenal Guangzhou FC",
        managerName: "Gunners Fan",
        points: 72,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 16
        }
      },
      {
        rank: 3,
        teamName: "Citizens Army",
        managerName: "City Fan",
        points: 70,
        captain: {
          name: "Haaland",
          team: "MCI",
          points: 12
        }
      },
      {
        rank: 4,
        teamName: "JackieHooooooo",
        managerName: "Jackie H",
        points: 68,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      },
      {
        rank: 5,
        teamName: "Chelsea Forever Blue",
        managerName: "Blues Fan",
        points: 67,
        captain: {
          name: "Haaland",
          team: "MCI",
          points: 12
        }
      }
    ],
    standings: [
      {
        rank: 1,
        previousRank: 2,
        teamName: "沉迷于搬砖不想披",
        managerName: "Brick Layer",
        gameweekPoints: 74,
        totalPoints: 1624
      },
      {
        rank: 2,
        previousRank: 1,
        teamName: "Arsenal Guangzhou FC",
        managerName: "Gunners Fan",
        gameweekPoints: 72,
        totalPoints: 1702
      },
      {
        rank: 3,
        previousRank: 5,
        teamName: "Citizens Army",
        managerName: "City Fan",
        gameweekPoints: 70,
        totalPoints: 1618
      },
      {
        rank: 4,
        previousRank: 3,
        teamName: "JackieHooooooo",
        managerName: "Jackie H",
        gameweekPoints: 68,
        totalPoints: 1756
      },
      {
        rank: 5,
        previousRank: 8,
        teamName: "Chelsea Forever Blue",
        managerName: "Blues Fan",
        gameweekPoints: 67,
        totalPoints: 1693
      }
    ],
    captainStats: [
      {
        player: "M.Salah",
        team: "LIV",
        count: 7138,
        percentage: 45.2,
        averagePoints: 14
      },
      {
        player: "Haaland",
        team: "MCI",
        count: 5159,
        percentage: 32.7,
        averagePoints: 12
      },
      {
        player: "Son",
        team: "TOT",
        count: 1342,
        percentage: 8.5,
        averagePoints: 9
      },
      {
        player: "Saka",
        team: "ARS",
        count: 1063,
        percentage: 6.7,
        averagePoints: 7
      },
      {
        player: "Palmer",
        team: "CHE",
        count: 647,
        percentage: 4.1,
        averagePoints: 12
      },
      {
        player: "Others",
        team: "N/A",
        count: 435,
        percentage: 2.8,
        averagePoints: 4
      }
    ],
    chipUsage: [
      {
        chip: "Bench Boost",
        count: 558,
        percentage: 3.5,
        averagePoints: 82
      },
      {
        chip: "Triple Captain",
        count: 478,
        percentage: 3.0,
        averagePoints: 89
      },
      {
        chip: "Wildcard",
        count: 316,
        percentage: 2.0,
        averagePoints: 78
      },
      {
        chip: "Free Hit",
        count: 284,
        percentage: 1.8,
        averagePoints: 75
      }
    ],
    h2hRecord: [
      {
        opponent: "Dino's Dream Team",
        wins: 2,
        draws: 1,
        losses: 0,
        pointsFor: 186,
        pointsAgainst: 153
      },
      {
        opponent: "Red Devils United",
        wins: 2,
        draws: 0,
        losses: 1,
        pointsFor: 175,
        pointsAgainst: 164
      },
      {
        opponent: "Blue Moon Rising",
        wins: 1,
        draws: 1,
        losses: 1,
        pointsFor: 168,
        pointsAgainst: 162
      },
      {
        opponent: "The Gunner Way",
        wins: 1,
        draws: 0,
        losses: 2,
        pointsFor: 156,
        pointsAgainst: 172
      }
    ]
  },
  {
    id: "t3",
    name: "FPL Content Creators Cup",
    createdBy: "Sarah",
    playerCount: 7631,
    currentGameweek: 21,
    startGameweek: 15,
    endGameweek: 25,
    myRank: 2456,
    myPreviousRank: 2189,
    myTeam: {
      name: "Arsenal Guangzhou FC",
      points: 78,
      captaincy: {
        name: "M.Salah",
        team: "LIV",
        points: 14
      }
    },
    topPerformers: [
      {
        rank: 1,
        teamName: "Arminia Bielefeld",
        managerName: "German Fan",
        points: 85,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 16
        }
      },
      {
        rank: 2,
        teamName: "世俱杯冠军阿森纳",
        managerName: "Arsenal Champion",
        points: 82,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      },
      {
        rank: 3,
        teamName: "Spurs Are On Fire",
        managerName: "Tottenham Loyal",
        points: 78,
        captain: {
          name: "Son",
          team: "TOT",
          points: 18
        }
      },
      {
        rank: 4,
        teamName: "Manchester is Red",
        managerName: "United Fan",
        points: 76,
        captain: {
          name: "Fernandes",
          team: "MUN",
          points: 14
        }
      },
      {
        rank: 5,
        teamName: "WHY NOT",
        managerName: "Just Because",
        points: 74,
        captain: {
          name: "M.Salah",
          team: "LIV",
          points: 14
        }
      }
    ],
    standings: [
      {
        rank: 1,
        previousRank: 4,
        teamName: "Arminia Bielefeld",
        managerName: "German Fan",
        gameweekPoints: 85,
        totalPoints: 1921
      },
      {
        rank: 2,
        previousRank: 1,
        teamName: "世俱杯冠军阿森纳",
        managerName: "Arsenal Champion",
        gameweekPoints: 82,
        totalPoints: 1953
      },
      {
        rank: 3,
        previousRank: 2,
        teamName: "Spurs Are On Fire",
        managerName: "Tottenham Loyal",
        gameweekPoints: 78,
        totalPoints: 1768
      },
      {
        rank: 4,
        previousRank: 3,
        teamName: "Manchester is Red",
        managerName: "United Fan",
        gameweekPoints: 76,
        totalPoints: 1702
      },
      {
        rank: 5,
        previousRank: 5,
        teamName: "WHY NOT",
        managerName: "Just Because",
        gameweekPoints: 74,
        totalPoints: 1834
      }
    ],
    captainStats: [
      {
        player: "M.Salah",
        team: "LIV",
        count: 3423,
        percentage: 44.9,
        averagePoints: 14
      },
      {
        player: "Haaland",
        team: "MCI",
        count: 1984,
        percentage: 26.0,
        averagePoints: 12
      },
      {
        player: "Son",
        team: "TOT",
        count: 832,
        percentage: 10.9,
        averagePoints: 18
      },
      {
        player: "Palmer",
        team: "CHE",
        count: 458,
        percentage: 6.0,
        averagePoints: 12
      },
      {
        player: "Fernandes",
        team: "MUN",
        count: 412,
        percentage: 5.4,
        averagePoints: 14
      },
      {
        player: "Others",
        team: "N/A",
        count: 522,
        percentage: 6.8,
        averagePoints: 6
      }
    ],
    chipUsage: [
      {
        chip: "Bench Boost",
        count: 305,
        percentage: 4.0,
        averagePoints: 88
      },
      {
        chip: "Triple Captain",
        count: 282,
        percentage: 3.7,
        averagePoints: 94
      },
      {
        chip: "Wildcard",
        count: 176,
        percentage: 2.3,
        averagePoints: 86
      },
      {
        chip: "Free Hit",
        count: 153,
        percentage: 2.0,
        averagePoints: 81
      }
    ]
  }
];

export default function TournamentStatsPage() {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("t1");
  const [tournamentStats, setTournamentStats] = useState<TournamentStats | null>(null);
  
  useEffect(() => {
    // Find the selected tournament and set its stats
    const tournament = mockTournaments.find(t => t.id === selectedTournamentId);
    if (tournament) {
      setTournamentStats(tournament as TournamentStats);
    }
  }, [selectedTournamentId]);
  
  if (!tournamentStats) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Loading tournament stats...</p>
          </div>
        </div>
      </RootLayout>
    );
  }
  
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Tournament Stats</h1>
        
        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="font-medium">Select Tournament:</span>
              </div>
              
              <Select
                value={selectedTournamentId}
                onValueChange={setSelectedTournamentId}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select tournament" />
                </SelectTrigger>
                <SelectContent>
                  {mockTournaments.map(tournament => (
                    <SelectItem key={tournament.id} value={tournament.id}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                GW {tournamentStats.startGameweek} - GW {tournamentStats.endGameweek}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold">{tournamentStats.name}</h2>
              <p className="text-muted-foreground">Created by {tournamentStats.createdBy}</p>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {formatCompactNumber(tournamentStats.playerCount)} Participants
              </Badge>
              
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                GW {tournamentStats.currentGameweek}
              </Badge>
            </div>
          </div>
        </Card>
        
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-bold mb-6">My Performance</h2>
          
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-primary/10 p-6 rounded-lg text-center sm:flex-1">
              <p className="text-sm text-muted-foreground mb-1">My Rank</p>
              <p className="text-2xl font-bold">{formatCompactNumber(tournamentStats.myRank)}</p>
              
              <div className="flex items-center justify-center mt-2">
                {tournamentStats.myPreviousRank > tournamentStats.myRank ? (
                  <div className="flex items-center text-emerald-600 text-sm">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    <span>Up {formatCompactNumber(tournamentStats.myPreviousRank - tournamentStats.myRank)}</span>
                  </div>
                ) : tournamentStats.myPreviousRank < tournamentStats.myRank ? (
                  <div className="flex items-center text-rose-600 text-sm">
                    <ArrowRight className="h-4 w-4 mr-1" />
                    <span>Down {formatCompactNumber(tournamentStats.myRank - tournamentStats.myPreviousRank)}</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">No change</div>
                )}
              </div>
            </div>
            
            <div className="bg-primary/10 p-6 rounded-lg text-center sm:flex-1">
              <p className="text-sm text-muted-foreground mb-1">Current Gameweek</p>
              <p className="text-2xl font-bold">{tournamentStats.myTeam.points} pts</p>
              
              <div className="flex items-center justify-center mt-2 text-sm">
                <span>Captain: {tournamentStats.myTeam.captaincy.name} ({tournamentStats.myTeam.captaincy.points} pts)</span>
              </div>
            </div>
            
            <div className="bg-primary/10 p-6 rounded-lg text-center sm:flex-1">
              <p className="text-sm text-muted-foreground mb-1">Top Performer</p>
              <p className="text-2xl font-bold">{tournamentStats.topPerformers[0].points} pts</p>
              
              <div className="flex items-center justify-center mt-2 text-sm">
                <span className="truncate">{tournamentStats.topPerformers[0].teamName}</span>
              </div>
            </div>
          </div>
        </Card>
        
        <Tabs defaultValue="standings" className="space-y-6">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="standings">
              <Trophy className="h-4 w-4 mr-2" />
              Standings
            </TabsTrigger>
            <TabsTrigger value="captains">
              <Crown className="h-4 w-4 mr-2" />
              Captains
            </TabsTrigger>
            <TabsTrigger value="chips">
              <Star className="h-4 w-4 mr-2" />
              Chips
            </TabsTrigger>
          </TabsList>
          
          {/* Standings Tab */}
          <TabsContent value="standings">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6">Tournament Standings</h2>
              
              <StatsTable
                title=""
                data={tournamentStats.standings}
                columns={[
                  { 
                    key: "rank", 
                    label: "Rank", 
                    className: "text-center",
                    format: (value, row) => (
                      <div className="flex flex-col items-center">
                        <span className="font-bold">{value}</span>
                        <span className="text-xs">
                          {row.previousRank < value ? (
                            <span className="text-rose-500">▼ {value - row.previousRank}</span>
                          ) : row.previousRank > value ? (
                            <span className="text-emerald-500">▲ {row.previousRank - value}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </span>
                      </div>
                    )
                  },
                  { 
                    key: "teamName", 
                    label: "Team",
                    format: (value, row) => (
                      <div className="flex flex-col">
                        <span className="font-medium">{value}</span>
                        <span className="text-xs text-muted-foreground">{row.managerName}</span>
                      </div>
                    )
                  },
                  { 
                    key: "gameweekPoints", 
                    label: "GW", 
                    className: "text-center font-medium" 
                  },
                  { 
                    key: "totalPoints", 
                    label: "Total", 
                    className: "text-right font-bold" 
                  }
                ]}
              />
            </Card>
          </TabsContent>
          
          {/* Captains Tab */}
          <TabsContent value="captains">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Most Captained Players
              </h2>
              
              <div className="space-y-4">
                {tournamentStats.captainStats.map((stat, index) => (
                  <div key={index} className="bg-accent/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-full text-primary text-lg font-bold min-w-[32px] text-center">
                          {index + 1}
                        </div>
                        
                        <div>
                          <div className="font-bold text-lg flex items-center gap-2">
                            {stat.player}
                            {stat.team !== "N/A" && (
                              <span className="text-sm text-muted-foreground">({stat.team})</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCompactNumber(stat.count)} managers ({stat.percentage}%)
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold">{stat.averagePoints}</div>
                        <div className="text-xs text-muted-foreground">avg. points</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
          
          {/* Chips Tab */}
          <TabsContent value="chips">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Chip Usage
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {tournamentStats.chipUsage.map((chip, index) => (
                  <div key={index} className="bg-accent/30 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-bold text-lg">{chip.chip}</h3>
                        <div className="text-sm text-muted-foreground">
                          {formatCompactNumber(chip.count)} managers ({chip.percentage}%)
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-lg font-bold">{chip.averagePoints}</div>
                        <div className="text-xs text-muted-foreground">avg. points</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {tournamentStats.h2hRecord && (
                <div className="mt-8">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Head-to-Head Record
                  </h2>
                  
                  <StatsTable
                    title=""
                    data={tournamentStats.h2hRecord}
                    columns={[
                      { 
                        key: "opponent", 
                        label: "Opponent"
                      },
                      { 
                        key: "record", 
                        label: "Record",
                        format: (_, row) => (
                          <div className="flex justify-center items-center gap-1">
                            <span className="text-emerald-600 font-medium">{row.wins}</span>
                            <span>-</span>
                            <span className="text-muted-foreground">{row.draws}</span>
                            <span>-</span>
                            <span className="text-rose-600 font-medium">{row.losses}</span>
                          </div>
                        ),
                        className: "text-center"
                      },
                      { 
                        key: "pointsFor", 
                        label: "PF", 
                        className: "text-center" 
                      },
                      { 
                        key: "pointsAgainst", 
                        label: "PA", 
                        className: "text-center" 
                      },
                      { 
                        key: "pointsDiff", 
                        label: "Diff",
                        format: (_, row) => {
                          const diff = row.pointsFor - row.pointsAgainst;
                          return (
                            <div className={`text-right font-medium ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-rose-600' : ''}`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </div>
                          );
                        },
                        className: "text-right"
                      }
                    ]}
                  />
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </RootLayout>
  );
}