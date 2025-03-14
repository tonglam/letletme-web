"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { PlayerSelector, PlayerOption } from "@/components/data/PlayerSelector";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { StatsTable } from "@/components/data/StatsTable";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Target, 
  Goal, 
  Shield, 
  AlertTriangle,
  PieChart,
  ChartBar,
  Activity,
  Percent,
  ChevronUp,
  ChevronDown,
  Zap,
  Star,
  Trophy
} from "lucide-react";
import Image from "next/image";

// Define types for our player statistics
interface PlayerStats {
  // Basic info
  player: PlayerOption;
  gameweek: number;
  
  // Match data
  matchesPlayed: number;
  minutes: number;
  
  // Attacking stats
  goals: number;
  assists: number;
  expectedGoals: number;
  expectedAssists: number;
  shotsTotal: number;
  shotsOnTarget: number;
  bigChancesCreated: number;
  keyPasses: number;
  
  // Defensive stats
  cleanSheets: number;
  goalsConceded: number;
  tackles: number;
  interceptions: number;
  clearances: number;
  blocks: number;
  
  // FPL stats
  points: number;
  bonus: number;
  priceChange: number;
  selectedBy: number;
  form: number;
  influenceScore: number;
  creativityScore: number;
  threatScore: number;
  
  // Advanced metrics
  xGPerShot: number;
  xGOutperformance: number;
  shotsPerGame: number;
  tacklesPerGame: number;
  minutesPerGoal: number;
  pointsPerGame: number;
  xAPerGame: number;
  chanceCreationRate: number;
  passCompletionRate: number;
  defensiveActions: number;
  defensiveActionsPerGame: number;
  valueForMoney: number;
  
  // Season totals
  seasonGoals: number;
  seasonAssists: number;
  seasonCleanSheets: number;
  seasonPoints: number;
  seasonBonusPoints: number;
  seasonAppearances: number;
  seasonMinutes: number;
  
  // Historical data
  priceHistory: number[];
  pointsHistory: number[];
  formHistory: number[];
  ownershipHistory: number[];
}

// Mock data generator for player statistics
const generatePlayerStats = (player: PlayerOption | null, gameweek: number): PlayerStats | null => {
  if (!player) return null;
  
  // Adjust stats based on position
  const isGoalkeeper = player.position === "GKP";
  const isDefender = player.position === "DEF";
  const isMidfielder = player.position === "MID";
  const isForward = player.position === "FWD";
  
  // Base stats that will be adjusted
  const baseStats = {
    // Basic info
    player,
    gameweek,
    
    // Match data - assume 1 match per gameweek
    matchesPlayed: 1,
    minutes: isGoalkeeper ? 90 : Math.min(90, 60 + Math.floor(Math.random() * 31)),
    
    // Attacking stats - adjust based on position
    goals: 0,
    assists: 0,
    expectedGoals: 0,
    expectedAssists: 0,
    shotsTotal: 0,
    shotsOnTarget: 0,
    bigChancesCreated: 0,
    keyPasses: 0,
    
    // Defensive stats - adjust based on position
    cleanSheets: 0,
    goalsConceded: 0,
    tackles: 0,
    interceptions: 0,
    clearances: 0,
    blocks: 0,
    
    // FPL stats
    points: 0,
    bonus: 0,
    priceChange: 0,
    selectedBy: 0,
    form: 0,
    influenceScore: 0,
    creativityScore: 0,
    threatScore: 0,
    
    // Advanced metrics
    xGPerShot: 0,
    xGOutperformance: 0,
    shotsPerGame: 0,
    tacklesPerGame: 0,
    minutesPerGoal: 0,
    pointsPerGame: 0,
    xAPerGame: 0,
    chanceCreationRate: 0,
    passCompletionRate: 0,
    defensiveActions: 0,
    defensiveActionsPerGame: 0,
    valueForMoney: 0,
    
    // Season totals
    seasonGoals: 0,
    seasonAssists: 0,
    seasonCleanSheets: 0,
    seasonPoints: 0,
    seasonBonusPoints: 0,
    seasonAppearances: 0,
    seasonMinutes: 0,
    
    // Historical data
    priceHistory: [] as number[],
    pointsHistory: [] as number[],
    formHistory: [] as number[],
    ownershipHistory: [] as number[]
  };
  
  // Generate stats based on position and player ID (used as a seed for consistency)
  const seed = parseInt(player.id) + gameweek;
  const random = (max: number, min: number = 0) => min + (seed % 100 + Math.random() * 100) % (max - min + 1);
  
  // Adjust attacking stats
  if (isForward) {
    baseStats.goals = random(0, 2) > 1.7 ? 1 : 0;
    baseStats.assists = random(0, 2) > 1.8 ? 1 : 0;
    baseStats.expectedGoals = parseFloat((0.3 + random(0, 7) / 10).toFixed(2));
    baseStats.expectedAssists = parseFloat((0.1 + random(0, 4) / 10).toFixed(2));
    baseStats.shotsTotal = Math.floor(2 + random(0, 6));
    baseStats.shotsOnTarget = Math.floor(baseStats.shotsTotal * (0.3 + random(0, 4) / 10));
    baseStats.bigChancesCreated = random(0, 2) > 1.5 ? 1 : 0;
    baseStats.keyPasses = Math.floor(random(0, 3));
    baseStats.seasonGoals = Math.floor(5 + random(0, 15));
    baseStats.seasonAssists = Math.floor(2 + random(0, 8));
  } else if (isMidfielder) {
    baseStats.goals = random(0, 2) > 1.8 ? 1 : 0;
    baseStats.assists = random(0, 2) > 1.7 ? 1 : 0;
    baseStats.expectedGoals = parseFloat((0.1 + random(0, 5) / 10).toFixed(2));
    baseStats.expectedAssists = parseFloat((0.2 + random(0, 5) / 10).toFixed(2));
    baseStats.shotsTotal = Math.floor(1 + random(0, 4));
    baseStats.shotsOnTarget = Math.floor(baseStats.shotsTotal * (0.3 + random(0, 4) / 10));
    baseStats.bigChancesCreated = random(0, 2) > 1.4 ? 1 : 0;
    baseStats.keyPasses = Math.floor(1 + random(0, 4));
    baseStats.seasonGoals = Math.floor(3 + random(0, 12));
    baseStats.seasonAssists = Math.floor(4 + random(0, 12));
  } else if (isDefender) {
    baseStats.goals = random(0, 10) > 9.5 ? 1 : 0;
    baseStats.assists = random(0, 10) > 9 ? 1 : 0;
    baseStats.expectedGoals = parseFloat((0 + random(0, 2) / 10).toFixed(2));
    baseStats.expectedAssists = parseFloat((0 + random(0, 3) / 10).toFixed(2));
    baseStats.shotsTotal = Math.floor(random(0, 2));
    baseStats.shotsOnTarget = Math.floor(baseStats.shotsTotal * (0.2 + random(0, 4) / 10));
    baseStats.bigChancesCreated = random(0, 10) > 9 ? 1 : 0;
    baseStats.keyPasses = Math.floor(random(0, 2));
    baseStats.seasonGoals = Math.floor(random(0, 5));
    baseStats.seasonAssists = Math.floor(random(0, 6));
  }
  
  // Adjust defensive stats
  const teamQuality = ["MCI", "ARS", "LIV"].includes(player.team) ? 0.7 : 
                     ["TOT", "AVL", "NEW", "CHE", "MUN"].includes(player.team) ? 0.5 : 0.3;
  
  // Determine clean sheet and goals conceded based on team quality
  if (random(0, 10) / 10 < teamQuality) {
    baseStats.cleanSheets = 1;
    baseStats.goalsConceded = 0;
  } else {
    baseStats.cleanSheets = 0;
    baseStats.goalsConceded = Math.floor(1 + random(0, 2));
  }
  
  // Season clean sheets
  baseStats.seasonCleanSheets = Math.floor(5 + teamQuality * 10 + random(0, 5));
  
  if (isGoalkeeper) {
    baseStats.tackles = 0;
    baseStats.interceptions = Math.floor(random(0, 2));
    baseStats.clearances = Math.floor(random(0, 3));
    baseStats.blocks = Math.floor(random(0, 1));
  } else if (isDefender) {
    baseStats.tackles = Math.floor(1 + random(0, 5));
    baseStats.interceptions = Math.floor(1 + random(0, 4));
    baseStats.clearances = Math.floor(2 + random(0, 6));
    baseStats.blocks = Math.floor(random(0, 3));
  } else if (isMidfielder) {
    baseStats.tackles = Math.floor(random(0, 4));
    baseStats.interceptions = Math.floor(random(0, 3));
    baseStats.clearances = Math.floor(random(0, 2));
    baseStats.blocks = Math.floor(random(0, 1));
  } else if (isForward) {
    baseStats.tackles = Math.floor(random(0, 2));
    baseStats.interceptions = Math.floor(random(0, 1));
    baseStats.clearances = 0;
    baseStats.blocks = 0;
  }
  
  // Calculate points
  let points = 0;
  
  // Appearance points
  if (baseStats.minutes >= 60) {
    points += 2;
  } else if (baseStats.minutes > 0) {
    points += 1;
  }
  
  // Goals points
  if (isGoalkeeper || isDefender) {
    points += baseStats.goals * 6;
  } else if (isMidfielder) {
    points += baseStats.goals * 5;
  } else {
    points += baseStats.goals * 4;
  }
  
  // Assists points
  points += baseStats.assists * 3;
  
  // Clean sheet points
  if (baseStats.cleanSheets > 0) {
    if (isGoalkeeper || isDefender) {
      points += 4;
    } else if (isMidfielder) {
      points += 1;
    }
  }
  
  // Goals conceded points
  if ((isGoalkeeper || isDefender) && baseStats.minutes >= 60) {
    points -= Math.floor(baseStats.goalsConceded / 2);
  }
  
  // Bonus points
  const bonusPoints = Math.floor(random(0, 3));
  points += bonusPoints;
  baseStats.bonus = bonusPoints;
  
  // Other FPL stats
  baseStats.points = points;
  baseStats.priceChange = parseFloat(((random(0, 20) - 10) / 10).toFixed(1));
  baseStats.selectedBy = parseFloat((5 + random(0, 70)).toFixed(1));
  baseStats.form = parseFloat((points / 4 + random(0, 20) / 10).toFixed(1));
  baseStats.influenceScore = parseFloat((20 + random(0, 60)).toFixed(1));
  baseStats.creativityScore = parseFloat((20 + random(0, 60)).toFixed(1));
  baseStats.threatScore = parseFloat((20 + random(0, 60)).toFixed(1));
  
  // Season totals
  baseStats.seasonAppearances = Math.floor(15 + random(0, 5));
  baseStats.seasonMinutes = Math.floor(baseStats.seasonAppearances * 80 + random(0, 200));
  baseStats.seasonPoints = Math.floor(baseStats.seasonAppearances * 4 + points + random(0, 40));
  baseStats.seasonBonusPoints = Math.floor(random(0, 15));
  
  // Advanced metrics
  baseStats.xGPerShot = baseStats.shotsTotal > 0 ? parseFloat((baseStats.expectedGoals / baseStats.shotsTotal).toFixed(2)) : 0;
  baseStats.xGOutperformance = parseFloat((baseStats.goals - baseStats.expectedGoals).toFixed(2));
  baseStats.shotsPerGame = parseFloat((baseStats.shotsTotal / baseStats.matchesPlayed).toFixed(1));
  baseStats.tacklesPerGame = parseFloat((baseStats.tackles / baseStats.matchesPlayed).toFixed(1));
  baseStats.minutesPerGoal = baseStats.goals > 0 ? Math.floor(baseStats.minutes / baseStats.goals) : 0;
  baseStats.pointsPerGame = parseFloat((baseStats.points / baseStats.matchesPlayed).toFixed(1));
  baseStats.xAPerGame = parseFloat((baseStats.expectedAssists / baseStats.matchesPlayed).toFixed(2));
  baseStats.chanceCreationRate = parseFloat(((baseStats.keyPasses + baseStats.bigChancesCreated * 2) / baseStats.minutes * 90).toFixed(2));
  baseStats.passCompletionRate = parseFloat((70 + random(0, 20)).toFixed(1));
  baseStats.defensiveActions = baseStats.tackles + baseStats.interceptions + baseStats.clearances + baseStats.blocks;
  baseStats.defensiveActionsPerGame = parseFloat((baseStats.defensiveActions / baseStats.matchesPlayed).toFixed(1));
  baseStats.valueForMoney = parseFloat((baseStats.seasonPoints / player.price).toFixed(1));
  
  // Historical data - generate 10 gameweeks of data
  const generateHistory = (base: number, variance: number, trend: number) => {
    return Array.from({ length: 10 }, (_, i) => {
      const value = base + (random(variance * 100) / 100) - variance/2 + (trend * i);
      return parseFloat(value.toFixed(1));
    });
  };
  
  baseStats.priceHistory = generateHistory(player.price - 0.5, 0.2, 0.05);
  baseStats.pointsHistory = Array.from({ length: 10 }, () => Math.floor(random(12, 1)));
  baseStats.formHistory = generateHistory(baseStats.form - 1, 1, 0.1);
  baseStats.ownershipHistory = generateHistory(baseStats.selectedBy - 5, 3, 0.5);
  
  return baseStats;
};

// Generate player history for multiple gameweeks
const generatePlayerHistory = (player: PlayerOption | null, currentGameweek: number): PlayerStats[] => {
  if (!player) return [];
  
  const history: PlayerStats[] = [];
  
  // Generate stats for last 10 gameweeks
  for (let gw = Math.max(1, currentGameweek - 9); gw <= currentGameweek; gw++) {
    const stats = generatePlayerStats(player, gw);
    if (stats) {
      history.push(stats);
    }
  }
  
  return history;
};

export default function PlayerStatsPage() {
  const currentGameweek = 21;
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(currentGameweek);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [playerHistory, setPlayerHistory] = useState<PlayerStats[]>([]);

  useEffect(() => {
    // Update player stats when player or gameweek changes
    if (selectedPlayer) {
      setPlayerStats(generatePlayerStats(selectedPlayer, selectedGameweek));
      setPlayerHistory(generatePlayerHistory(selectedPlayer, currentGameweek));
    } else {
      setPlayerStats(null);
      setPlayerHistory([]);
    }
  }, [selectedPlayer, selectedGameweek, currentGameweek]);

  // Safe calculation helper functions to prevent NaN
  const getPercentage = (value: number, total: number) => {
    if (!total || total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const getSafeWidthStyle = (percentage: number) => {
    if (isNaN(percentage) || percentage < 0) return "0%";
    if (percentage > 100) return "100%";
    return `${percentage}%`;
  };

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Player Statistics</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <PlayerSelector 
            onPlayerChange={setSelectedPlayer} 
            includeAllOptions={false}
          />
          
          <GameweekSelector 
            onGameweekChange={setSelectedGameweek}
            currentGameweek={currentGameweek}
          />
        </div>
        
        {!selectedPlayer ? (
          <Card className="p-8 text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-medium">Select a player to view statistics</h2>
            <p className="text-muted-foreground mt-2">
              Player stats include match performance, expected goals, and more.
            </p>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="flex flex-col items-center">
                  <div className="relative w-28 h-28 mb-2">
                    <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-full">
                      <User className="h-16 w-16 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                      {selectedPlayer.position}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-2xl font-bold">{selectedPlayer.name}</h2>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-4">
                    <div className="relative w-5 h-5">
                      <Image
                        src={`/team-logos/${selectedPlayer.team.toLowerCase()}.png`}
                        alt={selectedPlayer.team}
                        fill
                        className="object-contain"
                      />
                    </div>
                    <span className="text-muted-foreground">{selectedPlayer.team}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-accent/30 rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Price</p>
                      <p className="font-bold">£{selectedPlayer.price.toFixed(1)}m</p>
                      {playerStats && playerStats.priceChange !== 0 && (
                        <p className={`text-xs ${playerStats.priceChange > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {playerStats.priceChange > 0 ? '+' : ''}{playerStats.priceChange.toFixed(1)}m
                        </p>
                      )}
                    </div>
                    {playerStats && (
                      <>
                        <div className="bg-accent/30 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Form</p>
                          <p className="font-bold">{playerStats.form}</p>
                          <p className="text-xs text-muted-foreground">
                            PPG: {playerStats.pointsPerGame}
                          </p>
                        </div>
                        <div className="bg-accent/30 rounded-lg p-3 text-center">
                          <p className="text-xs text-muted-foreground mb-1">Selected By</p>
                          <p className="font-bold">{playerStats.selectedBy}%</p>
                          <div className="flex items-center justify-center text-xs">
                            {playerStats.ownershipHistory[9] < playerStats.ownershipHistory[8] ? (
                              <ChevronDown className="h-3 w-3 text-rose-500" />
                            ) : (
                              <ChevronUp className="h-3 w-3 text-emerald-500" />
                            )}
                            <span className={playerStats.ownershipHistory[9] < playerStats.ownershipHistory[8] ? 'text-rose-500' : 'text-emerald-500'}>
                              {Math.abs(playerStats.ownershipHistory[9] - playerStats.ownershipHistory[8]).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            
            {playerStats ? (
              <Tabs defaultValue="overview">
                <TabsList className="w-full grid grid-cols-6 mb-6">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="attacking">Attacking</TabsTrigger>
                  <TabsTrigger value="defensive">Defensive</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                  <TabsTrigger value="fpl">FPL</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview">
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Gameweek {selectedGameweek} Performance
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Points</p>
                        <p className="text-xl font-bold text-primary">{playerStats.points}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Minutes</p>
                        <p className="text-xl font-bold">{playerStats.minutes}'</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Bonus</p>
                        <p className="text-xl font-bold text-yellow-500">{playerStats.bonus}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Value</p>
                        <p className="text-xl font-bold">{playerStats.valueForMoney}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Season Summary
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Appearances</p>
                        <p className="font-bold">{playerStats.seasonAppearances}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Minutes</p>
                        <p className="font-bold">{playerStats.seasonMinutes}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Goals</p>
                        <p className="font-bold">{playerStats.seasonGoals}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Assists</p>
                        <p className="font-bold">{playerStats.seasonAssists}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      Key Performance Indicators
                    </h3>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Influence</p>
                        <p className="font-bold">{playerStats.influenceScore}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Creativity</p>
                        <p className="font-bold">{playerStats.creativityScore}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Threat</p>
                        <p className="font-bold">{playerStats.threatScore}</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
                
                <TabsContent value="attacking">
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Goal className="h-5 w-5 text-primary" />
                      Attacking Statistics
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Goals</p>
                        <p className="text-xl font-bold text-primary">{playerStats.goals}</p>
                        <p className="text-xs text-muted-foreground">Season: {playerStats.seasonGoals}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Assists</p>
                        <p className="text-xl font-bold text-primary">{playerStats.assists}</p>
                        <p className="text-xs text-muted-foreground">Season: {playerStats.seasonAssists}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">xG</p>
                        <p className="text-xl font-bold">{playerStats.expectedGoals}</p>
                        <p className={`text-xs ${playerStats.xGOutperformance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {playerStats.xGOutperformance >= 0 ? '+' : ''}{playerStats.xGOutperformance}
                        </p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">xA</p>
                        <p className="text-xl font-bold">{playerStats.expectedAssists}</p>
                        <p className="text-xs text-muted-foreground">per game: {playerStats.xAPerGame}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Shots</p>
                        <p className="font-bold">{playerStats.shotsTotal}</p>
                        <p className="text-xs text-muted-foreground">per game: {playerStats.shotsPerGame}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Shots on Target</p>
                        <p className="font-bold">{playerStats.shotsOnTarget}</p>
                        <p className="text-xs text-muted-foreground">
                          Accuracy: {playerStats.shotsTotal > 0 ? 
                            ((playerStats.shotsOnTarget / playerStats.shotsTotal * 100) || 0).toFixed(0) : 0}%
                        </p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Big Chances Created</p>
                        <p className="font-bold">{playerStats.bigChancesCreated}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Key Passes</p>
                        <p className="font-bold">{playerStats.keyPasses}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <ChartBar className="h-5 w-5 text-primary" />
                      Advanced Attacking Metrics
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">xG Per Shot</p>
                        <p className="font-bold">{playerStats.xGPerShot}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Minutes Per Goal</p>
                        <p className="font-bold">{playerStats.minutesPerGoal || "-"}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Chance Creation Rate</p>
                        <p className="font-bold">{playerStats.chanceCreationRate}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Pass Completion</p>
                        <p className="font-bold">{playerStats.passCompletionRate}%</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
                
                <TabsContent value="defensive">
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Defensive Statistics
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Clean Sheets</p>
                        <p className="text-xl font-bold text-primary">{playerStats.cleanSheets}</p>
                        <p className="text-xs text-muted-foreground">Season: {playerStats.seasonCleanSheets}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Goals Conceded</p>
                        <p className="text-xl font-bold text-rose-500">{playerStats.goalsConceded}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Tackles</p>
                        <p className="text-xl font-bold">{playerStats.tackles}</p>
                        <p className="text-xs text-muted-foreground">per game: {playerStats.tacklesPerGame}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Interceptions</p>
                        <p className="text-xl font-bold">{playerStats.interceptions}</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Clearances</p>
                        <p className="font-bold">{playerStats.clearances}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Blocks</p>
                        <p className="font-bold">{playerStats.blocks}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Defensive Actions</p>
                        <p className="font-bold">{playerStats.defensiveActions}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Actions Per Game</p>
                        <p className="font-bold">{playerStats.defensiveActionsPerGame}</p>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5 text-primary" />
                      Defensive Contribution Breakdown
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-accent/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">Tackles</span>
                          <span className="text-sm font-medium">
                            {getPercentage(playerStats.tackles, playerStats.defensiveActions)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-blue-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(getPercentage(playerStats.tackles, playerStats.defensiveActions)) }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2 mt-3">
                          <span className="text-sm">Interceptions</span>
                          <span className="text-sm font-medium">
                            {getPercentage(playerStats.interceptions, playerStats.defensiveActions)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-green-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(getPercentage(playerStats.interceptions, playerStats.defensiveActions)) }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="bg-accent/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">Clearances</span>
                          <span className="text-sm font-medium">
                            {getPercentage(playerStats.clearances, playerStats.defensiveActions)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-purple-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(getPercentage(playerStats.clearances, playerStats.defensiveActions)) }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2 mt-3">
                          <span className="text-sm">Blocks</span>
                          <span className="text-sm font-medium">
                            {getPercentage(playerStats.blocks, playerStats.defensiveActions)}%
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-orange-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(getPercentage(playerStats.blocks, playerStats.defensiveActions)) }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
                
                <TabsContent value="advanced">
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary" />
                      Advanced Statistics
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">xG Performance</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold">{playerStats.xGOutperformance.toFixed(2)}</p>
                          {playerStats.xGOutperformance > 0 ? (
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Overperforming</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-rose-100 text-rose-700 rounded-full">Underperforming</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Goals: {playerStats.goals} | xG: {playerStats.expectedGoals}
                        </p>
                      </div>
                      
                      <div className="bg-accent/30 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground mb-1">Value For Money</p>
                        <div className="flex items-center gap-2">
                          <p className="text-lg font-bold">{playerStats.valueForMoney}</p>
                          {playerStats.valueForMoney > 20 ? (
                            <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">Excellent</span>
                          ) : playerStats.valueForMoney > 15 ? (
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">Good</span>
                          ) : (
                            <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full">Average</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Points: {playerStats.seasonPoints} | Price: £{selectedPlayer.price.toFixed(1)}m
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">xG Per Shot</p>
                        <p className="font-bold">{playerStats.xGPerShot}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Shot Quality
                        </p>
                      </div>
                      
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Chance Creation Rate</p>
                        <p className="font-bold">{playerStats.chanceCreationRate}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Per 90 minutes
                        </p>
                      </div>
                      
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Pass Completion</p>
                        <p className="font-bold">{playerStats.passCompletionRate}%</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pass Accuracy
                        </p>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      Performance Metrics
                    </h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                      {/* ICT Index Components */}
                      <div className="bg-accent/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm">Influence</span>
                          <span className="text-sm font-medium">{playerStats.influenceScore}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-blue-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(Math.min(100, (playerStats.influenceScore / 100 * 100))) }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2 mt-3">
                          <span className="text-sm">Creativity</span>
                          <span className="text-sm font-medium">{playerStats.creativityScore}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-emerald-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(Math.min(100, (playerStats.creativityScore / 100 * 100))) }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2 mt-3">
                          <span className="text-sm">Threat</span>
                          <span className="text-sm font-medium">{playerStats.threatScore}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-rose-500 h-2.5 rounded-full" 
                            style={{ width: getSafeWidthStyle(Math.min(100, (playerStats.threatScore / 100 * 100))) }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between items-center mb-2 mt-3">
                          <span className="text-sm font-medium">ICT Index</span>
                          <span className="text-sm font-medium">
                            {((playerStats.influenceScore + playerStats.creativityScore + playerStats.threatScore) / 3).toFixed(1)}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5">
                          <div 
                            className="bg-primary h-2.5 rounded-full" 
                            style={{ 
                              width: getSafeWidthStyle(
                                Math.min(100, 
                                  ((playerStats.influenceScore + playerStats.creativityScore + playerStats.threatScore) / 3) / 100 * 100
                                )
                              ) 
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
                
                <TabsContent value="fpl">
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      FPL Performance
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">GW Points</p>
                        <p className="text-xl font-bold text-primary">{playerStats.points}</p>
                        <p className="text-xs text-muted-foreground">Season: {playerStats.seasonPoints}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Bonus Points</p>
                        <p className="text-xl font-bold text-yellow-500">{playerStats.bonus}</p>
                        <p className="text-xs text-muted-foreground">Season: {playerStats.seasonBonusPoints}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Form</p>
                        <p className="text-xl font-bold">{playerStats.form}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Price Change</p>
                        <p className={`text-xl font-bold ${playerStats.priceChange > 0 ? 'text-emerald-500' : playerStats.priceChange < 0 ? 'text-rose-500' : ''}`}>
                          {playerStats.priceChange > 0 ? '+' : ''}{playerStats.priceChange.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div className="bg-accent/30 rounded-lg p-4">
                        <p className="text-sm font-medium mb-2">Points Per Game</p>
                        <div className="flex items-center">
                          <p className="text-3xl font-bold">{playerStats.pointsPerGame}</p>
                          <div className="ml-4">
                            <p className="text-xs text-muted-foreground">Season Points: {playerStats.seasonPoints}</p>
                            <p className="text-xs text-muted-foreground">Appearances: {playerStats.seasonAppearances}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-accent/30 rounded-lg p-4">
                        <p className="text-sm font-medium mb-2">Ownership Trend</p>
                        <div className="flex items-center">
                          <p className="text-3xl font-bold">{playerStats.selectedBy}%</p>
                          <div className="ml-4 flex items-center">
                            {playerStats.ownershipHistory[9] < playerStats.ownershipHistory[8] ? (
                              <>
                                <ChevronDown className="h-4 w-4 text-rose-500 mr-1" />
                                <p className="text-sm text-rose-500">Falling</p>
                              </>
                            ) : (
                              <>
                                <ChevronUp className="h-4 w-4 text-emerald-500 mr-1" />
                                <p className="text-sm text-emerald-500">Rising</p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Star className="h-5 w-5 text-primary" />
                      FPL Value Metrics
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Points/£m</p>
                        <p className="font-bold">{playerStats.valueForMoney}</p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Minutes/Point</p>
                        <p className="font-bold">
                          {playerStats.seasonPoints > 0 ? 
                            (playerStats.seasonMinutes / playerStats.seasonPoints).toFixed(1) : 
                            "0"}
                        </p>
                      </div>
                      <div className="bg-accent/30 rounded-lg p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Consistency Rate</p>
                        <p className="font-bold">{Math.floor(40 + Math.random() * 45)}%</p>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
                
                <TabsContent value="history">
                  <Card className="p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Clock className="h-5 w-5 text-primary" />
                      Gameweek History
                    </h3>
                    
                    <StatsTable
                      title=""
                      data={playerHistory}
                      columns={[
                        { 
                          key: "gameweek", 
                          label: "GW"
                        },
                        { 
                          key: "minutes", 
                          label: "MIN", 
                          className: "text-center"
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
                          key: "cleanSheets", 
                          label: "CS", 
                          className: "text-center" 
                        },
                        { 
                          key: "bonus", 
                          label: "BPS", 
                          className: "text-center text-yellow-500" 
                        },
                        { 
                          key: "points", 
                          label: "PTS", 
                          className: "text-center font-bold" 
                        }
                      ]}
                    />
                    
                    <h3 className="text-lg font-bold mt-6 mb-4 flex items-center gap-2">
                      <Percent className="h-5 w-5 text-primary" />
                      Ownership History
                    </h3>
                    
                    <div className="bg-accent/30 rounded-lg p-4">
                      <div className="h-40 flex items-end justify-between gap-1">
                        {playerStats.ownershipHistory.map((value, index) => {
                          // Ensure height is valid
                          const height = Math.max(0, value * 2);
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <div 
                                className="w-full bg-primary/60 hover:bg-primary transition-colors rounded-t" 
                                style={{ height: `${height}px` }}
                              ></div>
                              <p className="text-xs text-muted-foreground mt-1">{currentGameweek - 9 + index}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-bold mt-6 mb-4 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Price History
                    </h3>
                    
                    <div className="bg-accent/30 rounded-lg p-4">
                      <div className="h-40 flex items-end justify-between gap-1">
                        {playerStats.priceHistory.map((value, index) => {
                          const minPrice = Math.min(...playerStats.priceHistory);
                          const height = Math.max(0, (value - minPrice) * 100);
                          const isRising = index > 0 && value > playerStats.priceHistory[index-1];
                          const isFalling = index > 0 && value < playerStats.priceHistory[index-1];
                          
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              <div 
                                className={`w-full ${isRising ? 'bg-emerald-500' : isFalling ? 'bg-rose-500' : 'bg-blue-500'} rounded-t`} 
                                style={{ height: `${height}px` }}
                              ></div>
                              <p className="text-xs text-muted-foreground mt-1">{currentGameweek - 9 + index}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            ) : (
              <Card className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-lg font-medium">No data available</h2>
                <p className="text-muted-foreground mt-2">
                  Statistics not available for this player in the selected gameweek.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </RootLayout>
  );
}