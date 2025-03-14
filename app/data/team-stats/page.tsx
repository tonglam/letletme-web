"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { StatsTable } from "@/components/data/StatsTable";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { 
  Building2, 
  Shield, 
  Swords, 
  Users, 
  Medal, 
  Percent,
  BarChart2, 
  Goal, 
  Clock, 
  PieChart, 
  MoveRight,
  Check, 
  X
} from "lucide-react";
import { Team } from "@/components/data/PlayerSelector";
import Image from "next/image";

// Define types for team statistics
interface TeamStats {
  team: string;
  teamShort: Team;
  gameweek: number;
  
  // General team stats
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goalsScored: number;
  goalsConceded: number;
  cleanSheets: number;
  points: number;
  
  // Possession and shooting
  possession: number;
  shots: number;
  shotsOnTarget: number;
  shotsAccuracy: number;
  corners: number;
  
  // Expected goals
  xG: number;
  xGA: number;
  xGD: number;
  
  // Fantasy stats
  topScorer: {
    name: string;
    goals: number;
  };
  topAssister: {
    name: string;
    assists: number;
  };
  mostCaptained: {
    name: string;
    captaincy: number;
  };
  mostSelected: {
    name: string;
    selection: number;
  };
  
  // Players
  players: {
    name: string;
    position: "GKP" | "DEF" | "MID" | "FWD";
    goals: number;
    assists: number;
    cleanSheets: number;
    minutesPlayed: number;
    points: number;
    price: number;
    form: number;
  }[];
  
  // Upcoming fixtures
  fixtures: {
    gameweek: number;
    opponent: Team;
    isHome: boolean;
    difficulty: 1 | 2 | 3 | 4 | 5;
  }[];
}

// Map of team abbreviations to full names
const teamFullNames: Record<Team, string> = {
  ARS: "Arsenal",
  AVL: "Aston Villa",
  BHA: "Brighton",
  BOU: "Bournemouth",
  BRE: "Brentford",
  CHE: "Chelsea",
  CRY: "Crystal Palace",
  EVE: "Everton",
  FUL: "Fulham",
  LIV: "Liverpool",
  LUT: "Luton Town",
  MCI: "Manchester City",
  MUN: "Manchester United",
  NEW: "Newcastle",
  NFO: "Nottingham Forest",
  SHU: "Sheffield United",
  TOT: "Tottenham",
  WHU: "West Ham",
  WOL: "Wolves",
  BUR: "Burnley",
  ALL: "All Teams"
};

// Arrays of team abbreviations
const teamOptions: Team[] = [
  "ARS", "AVL", "BHA", "BOU", "BRE", "CHE", "CRY", "EVE", 
  "FUL", "LIV", "LUT", "MCI", "MUN", "NEW", "NFO", "SHU", 
  "TOT", "WHU", "WOL", "BUR"
];

// Generate mock team stats
const generateTeamStats = (team: Team, gameweek: number): TeamStats => {
  // Use team code and gameweek as seeds for consistent random data
  const seed = (teamOptions.indexOf(team) + 1) * 100 + gameweek;
  const random = (max: number, min: number = 0) => min + ((seed % 100) + Math.random() * 100) % (max - min + 1);
  
  // Team tiers for baseline performance
  const topTier = ["MCI", "ARS", "LIV"];
  const midTier = ["TOT", "AVL", "NEW", "CHE", "MUN", "BHA"];
  const lowerTier = ["BRE", "FUL", "CRY", "WOL", "BOU", "NFO", "EVE", "WHU", "BUR", "LUT", "SHU"];
  
  // Base performance modifiers
  let performanceModifier = topTier.includes(team) ? 0.8 : 
                           midTier.includes(team) ? 0.5 : 0.2;
  
  // Adjust modifier by random factor to avoid deterministic results
  performanceModifier += (random(20) - 10) / 100;
  
  // Generate results based on performance level
  const gamesPlayed = Math.min(gameweek, 38);
  const winChance = 0.3 + (performanceModifier * 0.5);
  const drawChance = 0.3;
  
  let wins = 0;
  let draws = 0;
  let losses = 0;
  
  // Determine results based on probabilities
  for (let i = 0; i < gamesPlayed; i++) {
    const roll = random(100) / 100;
    if (roll < winChance) {
      wins++;
    } else if (roll < winChance + drawChance) {
      draws++;
    } else {
      losses++;
    }
  }
  
  // Calculate goals based on results and performance
  const goalsPerWin = 2.2 + (performanceModifier * 0.8);
  const goalsPerDraw = 1.0;
  const goalsPerLoss = 0.6;
  const concededPerWin = 0.3;
  const concededPerDraw = 1.0;
  const concededPerLoss = 2.0 + ((1 - performanceModifier) * 0.8);
  
  // Calculate goals scored and conceded
  const goalsScored = Math.floor((wins * goalsPerWin) + (draws * goalsPerDraw) + (losses * goalsPerLoss));
  const goalsConceded = Math.floor((wins * concededPerWin) + (draws * concededPerDraw) + (losses * concededPerLoss));
  
  // Clean sheets calculation
  let cleanSheetChance = 0.25 + (performanceModifier * 0.25);
  const cleanSheets = Math.floor(gamesPlayed * cleanSheetChance);
  
  // Points calculation (3 for win, 1 for draw)
  const points = (wins * 3) + draws;
  
  // Possession and shooting stats
  const possession = Math.floor(40 + (performanceModifier * 20) + (random(10) - 5));
  const shotsBase = 10 + (performanceModifier * 10);
  const shots = Math.floor(shotsBase + (random(6) - 3));
  const shotsAccuracy = Math.floor(30 + (performanceModifier * 30) + (random(10) - 5));
  const shotsOnTarget = Math.floor((shots * shotsAccuracy) / 100);
  const corners = Math.floor(4 + (performanceModifier * 4) + (random(4) - 2));
  
  // Expected goals
  const xG = parseFloat((goalsScored * (0.8 + (random(40) / 100))).toFixed(1));
  const xGA = parseFloat((goalsConceded * (0.8 + (random(40) / 100))).toFixed(1));
  const xGD = parseFloat((xG - xGA).toFixed(1));
  
  // Generate players for the team
  const players = generateTeamPlayers(team, performanceModifier);
  
  // Determine top performers
  const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0];
  const topAssister = [...players].sort((a, b) => b.assists - a.assists)[0];
  
  // Generate fantasy stats
  const mostCaptained = {
    name: topScorer.name,
    captaincy: parseFloat((5 + (performanceModifier * 20) + random(10)).toFixed(1))
  };
  
  const mostSelected = {
    name: players.find(p => p.form === Math.max(...players.map(p => p.form)))?.name || topScorer.name,
    selection: parseFloat((20 + (performanceModifier * 40) + random(20)).toFixed(1))
  };
  
  // Generate upcoming fixtures
  const fixtures = generateFixtures(team, gameweek);
  
  return {
    team: teamFullNames[team],
    teamShort: team,
    gameweek,
    
    gamesPlayed,
    wins,
    draws,
    losses,
    goalsScored,
    goalsConceded,
    cleanSheets,
    points,
    
    possession,
    shots,
    shotsOnTarget,
    shotsAccuracy,
    corners,
    
    xG,
    xGA,
    xGD,
    
    topScorer: {
      name: topScorer.name,
      goals: topScorer.goals
    },
    topAssister: {
      name: topAssister.name,
      assists: topAssister.assists
    },
    mostCaptained,
    mostSelected,
    
    players,
    fixtures
  };
};

// Helper function to generate team players
const generateTeamPlayers = (team: Team, performanceModifier: number) => {
  // First names and last names for generating player names
  const firstNames = ["Alex", "James", "Mohamed", "Kevin", "Harry", "David", "John", "Robert", "Michael", "William", "Kai"];
  const lastNames = ["Smith", "Jones", "Brown", "Williams", "Taylor", "Davies", "Wilson", "Evans", "Thomas", "Roberts"];
  
  // Use team to seed the random generator
  const teamSeed = teamOptions.indexOf(team);
  const random = (max: number, min: number = 0) => min + ((teamSeed % 100) + Math.random() * 100) % (max - min + 1);
  
  const players: TeamStats["players"] = [];
  
  // Generate 15 players (2 GKP, 5 DEF, 5 MID, 3 FWD)
  
  // Goalkeepers
  for (let i = 0; i < 2; i++) {
    const name = `${lastNames[Math.floor(random(lastNames.length))]}`;
    players.push({
      name,
      position: "GKP",
      goals: 0,
      assists: Math.floor(random(1)),
      cleanSheets: Math.floor(random(5) * performanceModifier),
      minutesPlayed: Math.floor(random(90, 70)),
      points: Math.floor(random(30, 10) * performanceModifier),
      price: parseFloat((4.0 + random(10) / 10).toFixed(1)),
      form: parseFloat((random(50, 10) / 10).toFixed(1))
    });
  }
  
  // Defenders
  for (let i = 0; i < 5; i++) {
    const name = `${lastNames[Math.floor(random(lastNames.length))]}`;
    players.push({
      name,
      position: "DEF",
      goals: Math.floor(random(2) * performanceModifier),
      assists: Math.floor(random(3) * performanceModifier),
      cleanSheets: Math.floor(random(5) * performanceModifier),
      minutesPlayed: Math.floor(random(90, 60)),
      points: Math.floor(random(40, 20) * performanceModifier),
      price: parseFloat((4.5 + random(20) / 10).toFixed(1)),
      form: parseFloat((random(60, 20) / 10).toFixed(1))
    });
  }
  
  // Midfielders
  for (let i = 0; i < 5; i++) {
    const firstName = firstNames[Math.floor(random(firstNames.length))];
    const lastName = lastNames[Math.floor(random(lastNames.length))];
    // Fix: Check if firstName is defined before trying to access charAt
    const useInitial = random(10) > 5;
    // Fix: Ensure firstName is defined before using charAt
    const name = useInitial && firstName ? 
      `${firstName.charAt(0)}.${lastName}` : 
      `${lastName}`;
    
    players.push({
      name,
      position: "MID",
      goals: Math.floor(random(8) * performanceModifier),
      assists: Math.floor(random(8) * performanceModifier),
      cleanSheets: Math.floor(random(5) * performanceModifier),
      minutesPlayed: Math.floor(random(90, 60)),
      points: Math.floor(random(60, 30) * performanceModifier),
      price: parseFloat((5.5 + random(50) / 10).toFixed(1)),
      form: parseFloat((random(80, 30) / 10).toFixed(1))
    });
  }
  
  // Forwards
  for (let i = 0; i < 3; i++) {
    const firstName = firstNames[Math.floor(random(firstNames.length))];
    const lastName = lastNames[Math.floor(random(lastNames.length))];
    // Fix: Check if firstName is defined before trying to access charAt
    const useInitial = random(10) > 5;
    // Fix: Ensure firstName is defined before using charAt
    const name = useInitial && firstName ? 
      `${firstName.charAt(0)}.${lastName}` : 
      `${lastName}`;
    
    players.push({
      name,
      position: "FWD",
      goals: Math.floor(random(15) * performanceModifier),
      assists: Math.floor(random(6) * performanceModifier),
      cleanSheets: 0,
      minutesPlayed: Math.floor(random(90, 60)),
      points: Math.floor(random(70, 40) * performanceModifier),
      price: parseFloat((6.0 + random(60) / 10).toFixed(1)),
      form: parseFloat((random(80, 30) / 10).toFixed(1))
    });
  }
  
  return players;
};

// Helper function to generate fixtures
const generateFixtures = (team: Team, currentGameweek: number): TeamStats["fixtures"] => {
  const fixtures: TeamStats["fixtures"] = [];
  
  // Generate 5 upcoming fixtures
  for (let i = 0; i < 5; i++) {
    const gameweek = currentGameweek + i + 1;
    if (gameweek > 38) break;
    
    // Get a random opponent that's not the same team
    const opponentOptions = teamOptions.filter(t => t !== team);
    const opponent = opponentOptions[Math.floor(Math.random() * opponentOptions.length)] as Team;
    
    // Determine difficulty rating (1-5)
    const topTier = ["MCI", "ARS", "LIV"];
    const midTier = ["TOT", "AVL", "NEW", "CHE", "MUN", "BHA"];
    let difficulty: 1 | 2 | 3 | 4 | 5;
    
    if (topTier.includes(opponent)) {
      difficulty = 5;
    } else if (midTier.includes(opponent)) {
      difficulty = 4;
    } else {
      difficulty = Math.floor(Math.random() * 3 + 1) as 1 | 2 | 3;
    }
    
    fixtures.push({
      gameweek,
      opponent,
      isHome: Math.random() > 0.5,
      difficulty
    });
  }
  
  return fixtures;
};

export default function TeamStatsPage() {
  const currentGameweek = 21;
  const [selectedTeam, setSelectedTeam] = useState<Team>("ARS");
  const [selectedGameweek, setSelectedGameweek] = useState<number>(currentGameweek);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);

  useEffect(() => {
    // Update team stats when team or gameweek changes
    setTeamStats(generateTeamStats(selectedTeam, selectedGameweek));
  }, [selectedTeam, selectedGameweek]);

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Team Statistics</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Select Team</p>
            <Select
              value={selectedTeam}
              onValueChange={(value) => setSelectedTeam(value as Team)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teamOptions.map((team) => (
                  <SelectItem key={team} value={team}>
                    <div className="flex items-center gap-2">
                      <div className="relative w-5 h-5">
                        <Image
                          src={`/team-logos/${team.toLowerCase()}.png`}
                          alt={teamFullNames[team]}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span>{teamFullNames[team]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>
          
          <GameweekSelector 
            onGameweekChange={setSelectedGameweek}
            currentGameweek={currentGameweek}
          />
        </div>
        
        {teamStats && (
          <>
            <Card className="p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="flex flex-col items-center">
                  <div className="relative w-28 h-28 mb-2">
                    <Image
                      src={`/team-logos/${teamStats.teamShort.toLowerCase()}.png`}
                      alt={teamStats.team}
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
                
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-bold">{teamStats.team}</h2>
                  <p className="text-muted-foreground mb-4">Gameweek {selectedGameweek} Stats</p>
                  
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Played</p>
                      <p className="font-bold">{teamStats.gamesPlayed}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">W-D-L</p>
                      <p className="font-bold">{teamStats.wins}-{teamStats.draws}-{teamStats.losses}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">GF-GA</p>
                      <p className="font-bold">{teamStats.goalsScored}-{teamStats.goalsConceded}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Points</p>
                      <p className="font-bold">{teamStats.points}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
            
            <Tabs defaultValue="overview">
              <TabsList className="w-full grid grid-cols-4 mb-6">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="players">Players</TabsTrigger>
                <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
                <TabsTrigger value="fantasy">Fantasy</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview">
                <Card className="p-6 mb-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Season Performance
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Goals Scored</p>
                      <p className="text-xl font-bold text-primary">{teamStats.goalsScored}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Goals Conceded</p>
                      <p className="text-xl font-bold text-rose-500">{teamStats.goalsConceded}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Clean Sheets</p>
                      <p className="text-xl font-bold text-emerald-500">{teamStats.cleanSheets}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" />
                    Match Stats
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Possession</p>
                      <div className="flex items-center justify-center">
                        <Percent className="h-3 w-3 mr-1" />
                        <p className="font-bold">{teamStats.possession}</p>
                      </div>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Shots (On Target)</p>
                      <p className="font-bold">{teamStats.shots} ({teamStats.shotsOnTarget})</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Shot Accuracy</p>
                      <div className="flex items-center justify-center">
                        <Percent className="h-3 w-3 mr-1" />
                        <p className="font-bold">{teamStats.shotsAccuracy}</p>
                      </div>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Corners</p>
                      <p className="font-bold">{teamStats.corners}</p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-primary" />
                    Expected Goals
                  </h3>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">xG</p>
                      <p className="font-bold">{teamStats.xG}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">xGA</p>
                      <p className="font-bold">{teamStats.xGA}</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">xGD</p>
                      <p className={`font-bold ${teamStats.xGD > 0 ? 'text-emerald-500' : teamStats.xGD < 0 ? 'text-rose-500' : ''}`}>
                        {teamStats.xGD > 0 ? '+' : ''}{teamStats.xGD}
                      </p>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Medal className="h-5 w-5 text-primary" />
                    Top Performers
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-accent/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Top Scorer</p>
                      <p className="font-bold">{teamStats.topScorer.name} ({teamStats.topScorer.goals} goals)</p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Top Assister</p>
                      <p className="font-bold">{teamStats.topAssister.name} ({teamStats.topAssister.assists} assists)</p>
                    </div>
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="players">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Team Players
                  </h3>
                  
                  <Tabs defaultValue="all">
                    <TabsList className="w-full grid grid-cols-5 mb-4">
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="gkp">GKP</TabsTrigger>
                      <TabsTrigger value="def">DEF</TabsTrigger>
                      <TabsTrigger value="mid">MID</TabsTrigger>
                      <TabsTrigger value="fwd">FWD</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all">
                      <StatsTable
                        title=""
                        data={teamStats.players}
                        columns={[
                          { 
                            key: "name", 
                            label: "Player",
                            format: (value, row) => (
                              <div className="flex items-center gap-2">
                                <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                  {row.position}
                                </span>
                                <span>{value}</span>
                              </div>
                            )
                          },
                          { 
                            key: "goals", 
                            label: "G", 
                            className: "text-center" 
                          },
                          { 
                            key: "assists", 
                            label: "A", 
                            className: "text-center" 
                          },
                          { 
                            key: "minutesPlayed", 
                            label: "MIN", 
                            className: "text-center" 
                          },
                          { 
                            key: "price", 
                            label: "Price", 
                            format: (value) => `£${value.toFixed(1)}m`,
                            className: "text-right" 
                          },
                          { 
                            key: "form", 
                            label: "Form", 
                            className: "text-right" 
                          },
                          { 
                            key: "points", 
                            label: "PTS", 
                            className: "text-right font-bold" 
                          }
                        ]}
                      />
                    </TabsContent>
                    
                    <TabsContent value="gkp">
                      <StatsTable
                        title=""
                        data={teamStats.players.filter(p => p.position === "GKP")}
                        columns={[
                          { key: "name", label: "Player" },
                          { key: "cleanSheets", label: "CS", className: "text-center" },
                          { key: "minutesPlayed", label: "MIN", className: "text-center" },
                          { key: "price", label: "Price", format: (value) => `£${value.toFixed(1)}m`, className: "text-right" },
                          { key: "form", label: "Form", className: "text-right" },
                          { key: "points", label: "PTS", className: "text-right font-bold" }
                        ]}
                      />
                    </TabsContent>
                    
                    <TabsContent value="def">
                      <StatsTable
                        title=""
                        data={teamStats.players.filter(p => p.position === "DEF")}
                        columns={[
                          { key: "name", label: "Player" },
                          { key: "goals", label: "G", className: "text-center" },
                          { key: "assists", label: "A", className: "text-center" },
                          { key: "cleanSheets", label: "CS", className: "text-center" },
                          { key: "minutesPlayed", label: "MIN", className: "text-center" },
                          { key: "price", label: "Price", format: (value) => `£${value.toFixed(1)}m`, className: "text-right" },
                          { key: "points", label: "PTS", className: "text-right font-bold" }
                        ]}
                      />
                    </TabsContent>
                    
                    <TabsContent value="mid">
                      <StatsTable
                        title=""
                        data={teamStats.players.filter(p => p.position === "MID")}
                        columns={[
                          { key: "name", label: "Player" },
                          { key: "goals", label: "G", className: "text-center" },
                          { key: "assists", label: "A", className: "text-center" },
                          { key: "minutesPlayed", label: "MIN", className: "text-center" },
                          { key: "price", label: "Price", format: (value) => `£${value.toFixed(1)}m`, className: "text-right" },
                          { key: "form", label: "Form", className: "text-right" },
                          { key: "points", label: "PTS", className: "text-right font-bold" }
                        ]}
                      />
                    </TabsContent>
                    
                    <TabsContent value="fwd">
                      <StatsTable
                        title=""
                        data={teamStats.players.filter(p => p.position === "FWD")}
                        columns={[
                          { key: "name", label: "Player" },
                          { key: "goals", label: "G", className: "text-center" },
                          { key: "assists", label: "A", className: "text-center" },
                          { key: "minutesPlayed", label: "MIN", className: "text-center" },
                          { key: "price", label: "Price", format: (value) => `£${value.toFixed(1)}m`, className: "text-right" },
                          { key: "form", label: "Form", className: "text-right" },
                          { key: "points", label: "PTS", className: "text-right font-bold" }
                        ]}
                      />
                    </TabsContent>
                  </Tabs>
                </Card>
              </TabsContent>
              
              <TabsContent value="fixtures">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Upcoming Fixtures
                  </h3>
                  
                  <div className="space-y-4">
                    {teamStats.fixtures.map((fixture, index) => (
                      <div key={index} className="bg-accent/30 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-primary font-medium">GW{fixture.gameweek}</span>
                            <span className="text-muted-foreground">|</span>
                            <span className={fixture.isHome ? "font-medium" : "text-muted-foreground"}>
                              {teamStats.team}
                            </span>
                            <MoveRight className="h-4 w-4 text-muted-foreground" />
                            <span className={!fixture.isHome ? "font-medium" : "text-muted-foreground"}>
                              {teamFullNames[fixture.opponent]}
                            </span>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full ml-2">
                              {fixture.isHome ? "H" : "A"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <div 
                                key={i} 
                                className={`w-2 h-2 rounded-full ${
                                  i < fixture.difficulty ? 'bg-primary' : 'bg-muted'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </TabsContent>
              
              <TabsContent value="fantasy">
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Swords className="h-5 w-5 text-primary" />
                    Fantasy FPL Stats
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-accent/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Most Captained</p>
                      <p className="font-bold">{teamStats.mostCaptained.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Captained by {teamStats.mostCaptained.captaincy}% of managers
                      </p>
                    </div>
                    <div className="bg-accent/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1">Most Selected</p>
                      <p className="font-bold">{teamStats.mostSelected.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Selected by {teamStats.mostSelected.selection}% of managers
                      </p>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Goal className="h-5 w-5 text-primary" />
                    Key FPL Players
                  </h3>
                  
                  <StatsTable
                    title=""
                    data={teamStats.players.sort((a, b) => b.points - a.points).slice(0, 5)}
                    columns={[
                      { 
                        key: "name", 
                        label: "Player",
                        format: (value, row) => (
                          <div className="flex items-center gap-2">
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              {row.position}
                            </span>
                            <span>{value}</span>
                          </div>
                        )
                      },
                      { 
                        key: "form", 
                        label: "Form", 
                        className: "text-center" 
                      },
                      { 
                        key: "price", 
                        label: "Price", 
                        format: (value) => `£${value.toFixed(1)}m`,
                        className: "text-center" 
                      },
                      { 
                        key: "points", 
                        label: "Points", 
                        className: "text-right font-bold" 
                      },
                      { 
                        key: "worthIt", 
                        label: "Value", 
                        format: (_, row) => {
                          const pointsPerMillion = row.points / row.price;
                          return (
                            <div className="flex items-center justify-end">
                              {pointsPerMillion > 5 ? (
                                <Check className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <X className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          );
                        },
                        className: "text-right" 
                      }
                    ]}
                  />
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RootLayout>
  );
}