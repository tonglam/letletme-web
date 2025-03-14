"use client";

import { useState, useEffect } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsTable } from "@/components/data/StatsTable";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart2, 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Star, 
  User,
  Users,
  ArrowRightCircle,
  ArrowLeftCircle
} from "lucide-react";
import Image from "next/image";
import { formatCompactNumber } from "@/lib/utils";

// Types for our stats data
interface OverallGameweekStats {
  averagePoints: number;
  highestPoints: number;
  mostCaptained: {
    name: string;
    team: string;
    percentage: number;
  };
  mostViceCaptained: {
    name: string;
    team: string;
    percentage: number;
  };
  mostTransferredIn: {
    name: string;
    team: string;
    count: number;
  };
  mostTransferredOut: {
    name: string;
    team: string;
    count: number;
  };
  mostPopular: {
    name: string;
    team: string;
    percentage: number;
  };
  chipsPlayed: {
    benchBoost: number;
    tripleCaptain: number;
    wildcard: number;
    freeHit: number;
  };
}

interface DreamTeamPlayer {
  name: string;
  position: string;
  team: string;
  points: number;
  price: number;
  ownedBy: number;
  stats: {
    goals: number;
    assists: number;
    cleanSheets: number;
    saves?: number;
    bonusPoints: number;
  };
}

interface HaulPlayer {
  name: string;
  position: string;
  team: string;
  points: number;
  ownedBy: number;
  captainedBy: number;
  stats: {
    goals: number;
    assists: number;
    cleanSheets: number;
    bonusPoints: number;
  };
}

interface HaulManager {
  name: string;
  teamName: string;
  points: number;
  captainName: string;
  captainPoints: number;
  chips: {
    benchBoost: boolean;
    tripleCaptain: boolean;
    wildcard: boolean;
    freeHit: boolean;
  };
}

interface TransferTrend {
  name: string;
  position: string;
  team: string;
  price: number;
  priceChange: number;
  transferCount: number;
}

// Generate mock data for overall stats
const generateOverallStats = (gameweek: number): OverallGameweekStats => {
  // Seed with gameweek for consistency
  const random = (min: number, max: number) => Math.floor(min + ((gameweek * 17) % 100) / 100 * (max - min));
  
  return {
    averagePoints: 45 + random(-10, 15),
    highestPoints: 120 + random(-15, 25),
    mostCaptained: {
      name: gameweek % 3 === 0 ? "Haaland" : gameweek % 3 === 1 ? "M.Salah" : "Son",
      team: gameweek % 3 === 0 ? "MCI" : gameweek % 3 === 1 ? "LIV" : "TOT",
      percentage: 45 + random(-15, 15)
    },
    mostViceCaptained: {
      name: gameweek % 5 === 0 ? "M.Salah" : gameweek % 5 === 1 ? "Son" : gameweek % 5 === 2 ? "Foden" : gameweek % 5 === 3 ? "Saka" : "Palmer",
      team: gameweek % 5 === 0 ? "LIV" : gameweek % 5 === 1 ? "TOT" : gameweek % 5 === 2 ? "MCI" : gameweek % 5 === 3 ? "ARS" : "CHE",
      percentage: 25 + random(-10, 15)
    },
    mostTransferredIn: {
      name: gameweek % 4 === 0 ? "Palmer" : gameweek % 4 === 1 ? "Saka" : gameweek % 4 === 2 ? "Isak" : "Watkins",
      team: gameweek % 4 === 0 ? "CHE" : gameweek % 4 === 1 ? "ARS" : gameweek % 4 === 2 ? "NEW" : "AVL",
      count: 800000 + random(-200000, 400000)
    },
    mostTransferredOut: {
      name: gameweek % 4 === 0 ? "Fernandes" : gameweek % 4 === 1 ? "N.Jackson" : gameweek % 4 === 2 ? "Núñez" : "Rashford",
      team: gameweek % 4 === 0 ? "MUN" : gameweek % 4 === 1 ? "CHE" : gameweek % 4 === 2 ? "LIV" : "MUN",
      count: 600000 + random(-150000, 300000)
    },
    mostPopular: {
      name: gameweek % 3 === 0 ? "Haaland" : gameweek % 3 === 1 ? "M.Salah" : "Palmer",
      team: gameweek % 3 === 0 ? "MCI" : gameweek % 3 === 1 ? "LIV" : "CHE",
      percentage: 65 + random(-10, 15)
    },
    chipsPlayed: {
      benchBoost: 150000 + random(-50000, 100000),
      tripleCaptain: 120000 + random(-40000, 80000),
      wildcard: 100000 + random(-30000, 60000),
      freeHit: 80000 + random(-20000, 50000)
    }
  };
};

// Generate mock data for dream team
const generateDreamTeam = (gameweek: number): DreamTeamPlayer[] => {
  // Base dream team that changes slightly with gameweek
  const players: DreamTeamPlayer[] = [
    {
      name: gameweek % 5 === 0 ? "Raya" : gameweek % 5 === 1 ? "Sánchez" : gameweek % 5 === 2 ? "Onana" : gameweek % 5 === 3 ? "Allison" : "Pope",
      position: "GKP",
      team: gameweek % 5 === 0 ? "ARS" : gameweek % 5 === 1 ? "CHE" : gameweek % 5 === 2 ? "MUN" : gameweek % 5 === 3 ? "LIV" : "NEW",
      points: 9 + (gameweek % 3),
      price: 5.0 + (gameweek % 5) * 0.1,
      ownedBy: 15 + (gameweek % 10),
      stats: {
        goals: 0,
        assists: 0,
        cleanSheets: 1,
        saves: 3 + (gameweek % 4),
        bonusPoints: gameweek % 3
      }
    },
    {
      name: "Gabriel",
      position: "DEF",
      team: "ARS",
      points: 12 + (gameweek % 4),
      price: 5.3 + (gameweek % 5) * 0.1,
      ownedBy: 25 + (gameweek % 15),
      stats: {
        goals: 1,
        assists: 0,
        cleanSheets: 1,
        bonusPoints: 3
      }
    },
    {
      name: "Trippier",
      position: "DEF",
      team: "NEW",
      points: 11 + (gameweek % 3),
      price: 6.5 + (gameweek % 4) * 0.1,
      ownedBy: 35 + (gameweek % 10),
      stats: {
        goals: 0,
        assists: 1,
        cleanSheets: 1,
        bonusPoints: 2
      }
    },
    {
      name: gameweek % 3 === 0 ? "Van Dijk" : gameweek % 3 === 1 ? "Kerkez" : "Gvardiol",
      position: "DEF",
      team: gameweek % 3 === 0 ? "LIV" : gameweek % 3 === 1 ? "BOU" : "MCI",
      points: 10 + (gameweek % 3),
      price: 6.0 + (gameweek % 5) * 0.1,
      ownedBy: 20 + (gameweek % 15),
      stats: {
        goals: gameweek % 3 === 0 ? 1 : 0,
        assists: gameweek % 3 === 0 ? 0 : 1,
        cleanSheets: 1,
        bonusPoints: 1
      }
    },
    {
      name: gameweek % 4 === 0 ? "M.Salah" : gameweek % 4 === 1 ? "Son" : gameweek % 4 === 2 ? "Saka" : "Palmer",
      position: "MID",
      team: gameweek % 4 === 0 ? "LIV" : gameweek % 4 === 1 ? "TOT" : gameweek % 4 === 2 ? "ARS" : "CHE",
      points: 15 + (gameweek % 5),
      price: gameweek % 4 === 0 ? 13.2 : gameweek % 4 === 1 ? 10.0 : gameweek % 4 === 2 ? 9.8 : 5.9,
      ownedBy: 45 + (gameweek % 20),
      stats: {
        goals: 1,
        assists: 1,
        cleanSheets: 0,
        bonusPoints: 3
      }
    },
    {
      name: gameweek % 3 === 0 ? "Foden" : gameweek % 3 === 1 ? "Fernandes" : "Gordon",
      position: "MID",
      team: gameweek % 3 === 0 ? "MCI" : gameweek % 3 === 1 ? "MUN" : "NEW",
      points: 13 + (gameweek % 4),
      price: gameweek % 3 === 0 ? 8.8 : gameweek % 3 === 1 ? 8.4 : 7.1,
      ownedBy: 30 + (gameweek % 15),
      stats: {
        goals: 1,
        assists: 1,
        cleanSheets: 0,
        bonusPoints: 2
      }
    },
    {
      name: gameweek % 5 === 0 ? "Mbeumo" : gameweek % 5 === 1 ? "Sávio" : gameweek % 5 === 2 ? "Ødegaard" : gameweek % 5 === 3 ? "Mac Allister" : "Barkley",
      position: "MID",
      team: gameweek % 5 === 0 ? "BRE" : gameweek % 5 === 1 ? "MCI" : gameweek % 5 === 2 ? "ARS" : gameweek % 5 === 3 ? "LIV" : "AVL",
      points: 12 + (gameweek % 3),
      price: 7.0 + (gameweek % 5) * 0.1,
      ownedBy: 20 + (gameweek % 10),
      stats: {
        goals: 1,
        assists: 0,
        cleanSheets: 0,
        bonusPoints: 1
      }
    },
    {
      name: "Haaland",
      position: "FWD",
      team: "MCI",
      points: 12 + (gameweek % 5),
      price: 14.5 + (gameweek % 3) * 0.1,
      ownedBy: 60 + (gameweek % 20),
      stats: {
        goals: 1 + (gameweek % 2),
        assists: 0,
        cleanSheets: 0,
        bonusPoints: 2
      }
    },
    {
      name: gameweek % 3 === 0 ? "Isak" : gameweek % 3 === 1 ? "Watkins" : "Raúl",
      position: "FWD",
      team: gameweek % 3 === 0 ? "NEW" : gameweek % 3 === 1 ? "AVL" : "FUL",
      points: 11 + (gameweek % 3),
      price: gameweek % 3 === 0 ? 8.2 : gameweek % 3 === 1 ? 8.7 : 6.2,
      ownedBy: 25 + (gameweek % 15),
      stats: {
        goals: 1,
        assists: 0,
        cleanSheets: 0,
        bonusPoints: 1
      }
    },
    {
      name: gameweek % 4 === 0 ? "Wissa" : gameweek % 4 === 1 ? "Solanke" : gameweek % 4 === 2 ? "N.Jackson" : "Núñez",
      position: "FWD",
      team: gameweek % 4 === 0 ? "BRE" : gameweek % 4 === 1 ? "TOT" : gameweek % 4 === 2 ? "CHE" : "LIV",
      points: 10 + (gameweek % 4),
      price: gameweek % 4 === 0 ? 6.0 : gameweek % 4 === 1 ? 7.0 : gameweek % 4 === 2 ? 7.1 : 7.5,
      ownedBy: 15 + (gameweek % 10),
      stats: {
        goals: 1,
        assists: 0,
        cleanSheets: 0,
        bonusPoints: 1
      }
    }
  ];
  
  return players;
};

// Generate mock data for haul
const generateHaulPlayers = (gameweek: number): HaulPlayer[] => {
  // Same as dream team but with additional info
  const dreamTeam = generateDreamTeam(gameweek);
  
  return dreamTeam.map(player => ({
    name: player.name,
    position: player.position,
    team: player.team,
    points: player.points,
    ownedBy: player.ownedBy,
    captainedBy: Math.round(player.ownedBy / 3),
    stats: player.stats
  }));
};

const generateHaulManagers = (gameweek: number): HaulManager[] => {
  // Generate mock top-performing managers
  return [
    {
      name: "Gunners Fan",
      teamName: "Arsenal Guangzhou FC",
      points: 120 - (gameweek % 10),
      captainName: "M.Salah",
      captainPoints: 30,
      chips: {
        benchBoost: false,
        tripleCaptain: true,
        wildcard: false,
        freeHit: false
      }
    },
    {
      name: "Brick Layer",
      teamName: "沉迷于搬砖不想披",
      points: 115 - (gameweek % 5),
      captainName: "Haaland",
      captainPoints: 26,
      chips: {
        benchBoost: true,
        tripleCaptain: false,
        wildcard: false,
        freeHit: false
      }
    },
    {
      name: "City Fan",
      teamName: "Citizens Army",
      points: 110 - (gameweek % 7),
      captainName: "Haaland",
      captainPoints: 24,
      chips: {
        benchBoost: false,
        tripleCaptain: false,
        wildcard: true,
        freeHit: false
      }
    },
    {
      name: "Arsenal Champion",
      teamName: "世俱杯冠军阿森纳",
      points: 105 - (gameweek % 6),
      captainName: "Saka",
      captainPoints: 22,
      chips: {
        benchBoost: false,
        tripleCaptain: false,
        wildcard: false,
        freeHit: true
      }
    },
    {
      name: "Blues Fan",
      teamName: "Chelsea Forever Blue",
      points: 102 - (gameweek % 8),
      captainName: "Palmer",
      captainPoints: 24,
      chips: {
        benchBoost: false,
        tripleCaptain: false,
        wildcard: false,
        freeHit: false
      }
    }
  ];
};

// Generate mock data for transfer trends
const generateTransferTrends = (gameweek: number): { in: TransferTrend[], out: TransferTrend[] } => {
  // Players being transferred in
  const transfersIn: TransferTrend[] = [
    {
      name: gameweek % 5 === 0 ? "Palmer" : gameweek % 5 === 1 ? "Gordon" : gameweek % 5 === 2 ? "Sávio" : gameweek % 5 === 3 ? "Mbeumo" : "Isak",
      position: gameweek % 5 === 0 || gameweek % 5 === 1 || gameweek % 5 === 2 || gameweek % 5 === 3 ? "MID" : "FWD",
      team: gameweek % 5 === 0 ? "CHE" : gameweek % 5 === 1 ? "NEW" : gameweek % 5 === 2 ? "MCI" : gameweek % 5 === 3 ? "BRE" : "NEW",
      price: 5.9 + (gameweek % 10) * 0.1,
      priceChange: 0.1,
      transferCount: 350000 + (gameweek % 5) * 50000
    },
    {
      name: gameweek % 4 === 0 ? "Saka" : gameweek % 4 === 1 ? "Van den Berg" : gameweek % 4 === 2 ? "Kerkez" : "Hall",
      position: gameweek % 4 === 0 ? "MID" : "DEF",
      team: gameweek % 4 === 0 ? "ARS" : gameweek % 4 === 1 ? "BRE" : gameweek % 4 === 2 ? "BOU" : "NEW",
      price: gameweek % 4 === 0 ? 9.8 : 4.5 + (gameweek % 5) * 0.1,
      priceChange: 0.1,
      transferCount: 300000 + (gameweek % 4) * 40000
    },
    {
      name: gameweek % 3 === 0 ? "Watkins" : gameweek % 3 === 1 ? "Solanke" : "Havertz",
      position: gameweek % 3 === 0 || gameweek % 3 === 1 ? "FWD" : "MID",
      team: gameweek % 3 === 0 ? "AVL" : gameweek % 3 === 1 ? "TOT" : "ARS",
      price: gameweek % 3 === 0 ? 8.7 : gameweek % 3 === 1 ? 7.0 : 7.5,
      priceChange: 0.1,
      transferCount: 250000 + (gameweek % 6) * 30000
    },
    {
      name: gameweek % 5 === 0 ? "Foden" : gameweek % 5 === 1 ? "Gvardiol" : gameweek % 5 === 2 ? "M.Salah" : gameweek % 5 === 3 ? "Robertson" : "Ødegaard",
      position: gameweek % 5 === 0 || gameweek % 5 === 2 || gameweek % 5 === 4 ? "MID" : "DEF",
      team: gameweek % 5 === 0 || gameweek % 5 === 1 ? "MCI" : gameweek % 5 === 2 || gameweek % 5 === 3 ? "LIV" : "ARS",
      price: gameweek % 5 === 0 ? 8.8 : gameweek % 5 === 1 ? 5.2 : gameweek % 5 === 2 ? 13.2 : gameweek % 5 === 3 ? 6.4 : 8.4,
      priceChange: 0.1,
      transferCount: 200000 + (gameweek % 7) * 20000
    },
    {
      name: gameweek % 3 === 0 ? "Son" : gameweek % 3 === 1 ? "Raúl" : "Haaland",
      position: gameweek % 3 === 0 ? "MID" : "FWD",
      team: gameweek % 3 === 0 ? "TOT" : gameweek % 3 === 1 ? "FUL" : "MCI",
      price: gameweek % 3 === 0 ? 10.0 : gameweek % 3 === 1 ? 6.2 : 14.5,
      priceChange: 0.1,
      transferCount: 150000 + (gameweek % 8) * 15000
    }
  ];
  
  // Players being transferred out
  const transfersOut: TransferTrend[] = [
    {
      name: gameweek % 4 === 0 ? "N.Jackson" : gameweek % 4 === 1 ? "Fernandes" : gameweek % 4 === 2 ? "Núñez" : "Rashford",
      position: gameweek % 4 === 0 || gameweek % 4 === 2 || gameweek % 4 === 3 ? "FWD" : "MID",
      team: gameweek % 4 === 0 ? "CHE" : gameweek % 4 === 1 || gameweek % 4 === 3 ? "MUN" : "LIV",
      price: gameweek % 4 === 0 ? 7.1 : gameweek % 4 === 1 ? 8.4 : gameweek % 4 === 2 ? 7.5 : 6.8,
      priceChange: -0.1,
      transferCount: 300000 + (gameweek % 5) * 40000
    },
    {
      name: gameweek % 5 === 0 ? "Eze" : gameweek % 5 === 1 ? "Maddison" : gameweek % 5 === 2 ? "Luis Diaz" : gameweek % 5 === 3 ? "Cunha" : "Enzo",
      position: gameweek % 5 === 0 || gameweek % 5 === 1 || gameweek % 5 === 2 || gameweek % 5 === 4 ? "MID" : "FWD",
      team: gameweek % 5 === 0 ? "CRY" : gameweek % 5 === 1 ? "TOT" : gameweek % 5 === 2 ? "LIV" : gameweek % 5 === 3 ? "WOL" : "CHE",
      price: gameweek % 5 === 0 ? 7.8 : gameweek % 5 === 1 ? 7.5 : gameweek % 5 === 2 ? 7.7 : gameweek % 5 === 3 ? 6.5 : 6.2,
      priceChange: -0.1,
      transferCount: 250000 + (gameweek % 6) * 30000
    },
    {
      name: gameweek % 3 === 0 ? "Soucek" : gameweek % 3 === 1 ? "Neto" : "Alexander-Arnold",
      position: gameweek % 3 === 0 || gameweek % 3 === 1 ? "MID" : "DEF",
      team: gameweek % 3 === 0 ? "WHU" : gameweek % 3 === 1 ? "BOU" : "LIV",
      price: gameweek % 3 === 0 ? 5.3 : gameweek % 3 === 1 ? 5.8 : 8.0,
      priceChange: -0.1,
      transferCount: 200000 + (gameweek % 7) * 20000
    },
    {
      name: gameweek % 4 === 0 ? "James" : gameweek % 4 === 1 ? "Bowen" : gameweek % 4 === 2 ? "Guimarães" : "Estupiñán",
      position: gameweek % 4 === 0 ? "DEF" : gameweek % 4 === 1 || gameweek % 4 === 2 ? "MID" : "DEF",
      team: gameweek % 4 === 0 ? "CHE" : gameweek % 4 === 1 ? "WHU" : gameweek % 4 === 2 ? "NEW" : "BHA",
      price: gameweek % 4 === 0 ? 5.4 : gameweek % 4 === 1 ? 7.3 : gameweek % 4 === 2 ? 5.9 : 5.0,
      priceChange: -0.1,
      transferCount: 150000 + (gameweek % 8) * 15000
    },
    {
      name: gameweek % 5 === 0 ? "Schär" : gameweek % 5 === 1 ? "Trossard" : gameweek % 5 === 2 ? "Dalot" : gameweek % 5 === 3 ? "Raya" : "Fofana",
      position: gameweek % 5 === 0 || gameweek % 5 === 2 || gameweek % 5 === 3 ? "DEF" : gameweek % 5 === 1 || gameweek % 5 === 4 ? "MID" : "DEF",
      team: gameweek % 5 === 0 ? "NEW" : gameweek % 5 === 1 ? "ARS" : gameweek % 5 === 2 ? "MUN" : gameweek % 5 === 3 ? "ARS" : "CHE",
      price: gameweek % 5 === 0 ? 5.2 : gameweek % 5 === 1 ? 6.7 : gameweek % 5 === 2 ? 5.3 : gameweek % 5 === 3 ? 5.1 : 5.5,
      priceChange: -0.1,
      transferCount: 120000 + (gameweek % 9) * 10000
    }
  ];
  
  return { in: transfersIn, out: transfersOut };
};

export default function GameweekStatsPage() {
  const currentGameweek = 21;
  const [selectedGameweek, setSelectedGameweek] = useState<number>(currentGameweek);
  const [overallStats, setOverallStats] = useState<OverallGameweekStats | null>(null);
  const [dreamTeam, setDreamTeam] = useState<DreamTeamPlayer[] | null>(null);
  const [haulPlayers, setHaulPlayers] = useState<HaulPlayer[] | null>(null);
  const [haulManagers, setHaulManagers] = useState<HaulManager[] | null>(null);
  const [transferTrends, setTransferTrends] = useState<{ in: TransferTrend[], out: TransferTrend[] } | null>(null);

  useEffect(() => {
    // Generate data for the selected gameweek
    setOverallStats(generateOverallStats(selectedGameweek));
    setDreamTeam(generateDreamTeam(selectedGameweek));
    setHaulPlayers(generateHaulPlayers(selectedGameweek));
    setHaulManagers(generateHaulManagers(selectedGameweek));
    setTransferTrends(generateTransferTrends(selectedGameweek));
  }, [selectedGameweek]);

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Gameweek Stats</h1>
        
        <div className="mb-6">
          <GameweekSelector 
            onGameweekChange={setSelectedGameweek}
            currentGameweek={currentGameweek}
          />
        </div>
        
        <Tabs defaultValue="overall" className="space-y-6">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="overall">
              <BarChart2 className="h-4 w-4 mr-2" />
              Overall
            </TabsTrigger>
            <TabsTrigger value="dreamteam">
              <Trophy className="h-4 w-4 mr-2" />
              Dream Team
            </TabsTrigger>
            <TabsTrigger value="haul">
              <Star className="h-4 w-4 mr-2" />
              Haul
            </TabsTrigger>
            <TabsTrigger value="transfers">
              <TrendingUp className="h-4 w-4 mr-2" />
              Transfers
            </TabsTrigger>
          </TabsList>
          
          {/* Overall Tab Content */}
          <TabsContent value="overall">
            {overallStats && (
              <>
                <Card className="p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">Gameweek {selectedGameweek} Overview</h2>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="space-y-6">
                      <div className="bg-accent/30 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Average Points</h3>
                        <div className="text-2xl font-bold">{overallStats.averagePoints}</div>
                      </div>
                      
                      <div className="bg-accent/30 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Highest Points</h3>
                        <div className="text-2xl font-bold">{overallStats.highestPoints}</div>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="bg-accent/30 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Most Captained</h3>
                        <div className="text-xl font-bold mb-1">{overallStats.mostCaptained.name}</div>
                        <div className="flex items-center text-sm">
                          <span className="text-muted-foreground">{overallStats.mostCaptained.team}</span>
                          <span className="mx-2">•</span>
                          <span>{overallStats.mostCaptained.percentage}%</span>
                        </div>
                      </div>
                      
                      <div className="bg-accent/30 p-4 rounded-lg">
                        <h3 className="text-sm font-medium text-muted-foreground mb-1">Most Vice-Captained</h3>
                        <div className="text-xl font-bold mb-1">{overallStats.mostViceCaptained.name}</div>
                        <div className="flex items-center text-sm">
                          <span className="text-muted-foreground">{overallStats.mostViceCaptained.team}</span>
                          <span className="mx-2">•</span>
                          <span>{overallStats.mostViceCaptained.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        Most Transferred In
                      </h3>
                      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-full">
                            <ArrowRightCircle className="h-6 w-6 text-emerald-500" />
                          </div>
                          <div>
                            <div className="text-xl font-bold mb-1">{overallStats.mostTransferredIn.name}</div>
                            <div className="flex items-center text-sm">
                              <span className="text-muted-foreground">{overallStats.mostTransferredIn.team}</span>
                              <span className="mx-2">•</span>
                              <span className="text-emerald-600">{formatCompactNumber(overallStats.mostTransferredIn.count)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-rose-500" />
                        Most Transferred Out
                      </h3>
                      <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="bg-rose-100 dark:bg-rose-900/30 p-2.5 rounded-full">
                            <ArrowLeftCircle className="h-6 w-6 text-rose-500" />
                          </div>
                          <div>
                            <div className="text-xl font-bold mb-1">{overallStats.mostTransferredOut.name}</div>
                            <div className="flex items-center text-sm">
                              <span className="text-muted-foreground">{overallStats.mostTransferredOut.team}</span>
                              <span className="mx-2">•</span>
                              <span className="text-rose-600">{formatCompactNumber(overallStats.mostTransferredOut.count)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">Chips Played</h2>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                      <div className="font-bold text-lg text-blue-600 mb-1">Bench Boost</div>
                      <div className="text-2xl font-bold">{formatCompactNumber(overallStats.chipsPlayed.benchBoost)}</div>
                    </div>
                    
                    <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                      <div className="font-bold text-lg text-emerald-600 mb-1">Triple Captain</div>
                      <div className="text-2xl font-bold">{formatCompactNumber(overallStats.chipsPlayed.tripleCaptain)}</div>
                    </div>
                    
                    <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                      <div className="font-bold text-lg text-purple-600 mb-1">Wildcard</div>
                      <div className="text-2xl font-bold">{formatCompactNumber(overallStats.chipsPlayed.wildcard)}</div>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                      <div className="font-bold text-lg text-amber-600 mb-1">Free Hit</div>
                      <div className="text-2xl font-bold">{formatCompactNumber(overallStats.chipsPlayed.freeHit)}</div>
                    </div>
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Most Popular Player</h2>
                  
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-full bg-accent/50 flex items-center justify-center">
                      <User className="h-10 w-10 text-muted-foreground" />
                    </div>
                    
                    <div>
                      <div className="text-2xl font-bold mb-1">{overallStats.mostPopular.name}</div>
                      <div className="flex items-center text-sm">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 mr-2">
                          {overallStats.mostPopular.team}
                        </Badge>
                        <span className="text-muted-foreground">Selected by {overallStats.mostPopular.percentage}% of managers</span>
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
          
          {/* Dream Team Tab Content */}
          <TabsContent value="dreamteam">
            {dreamTeam && (
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Gameweek {selectedGameweek} Dream Team
                </h2>
                
                <div className="space-y-4">
                  {dreamTeam.map((player, index) => (
                    <div key={index} className="bg-accent/30 p-4 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="w-12 text-center font-medium">
                            {player.position}
                          </Badge>
                          
                          <div>
                            <div className="font-bold text-lg">{player.name}</div>
                            <div className="flex items-center text-sm text-muted-foreground">
                              <span>{player.team}</span>
                              <span className="mx-2">•</span>
                              <span>£{player.price.toFixed(1)}m</span>
                              <span className="mx-2">•</span>
                              <span>Selected by {player.ownedBy}%</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="text-2xl font-bold text-primary">{player.points}</div>
                      </div>
                      
                      <div className="mt-3 grid grid-cols-4 gap-2">
                        <div className="text-center bg-accent rounded-lg p-2">
                          <div className="text-xs text-muted-foreground mb-1">Goals</div>
                          <div className="font-bold">{player.stats.goals}</div>
                        </div>
                        
                        <div className="text-center bg-accent rounded-lg p-2">
                          <div className="text-xs text-muted-foreground mb-1">Assists</div>
                          <div className="font-bold">{player.stats.assists}</div>
                        </div>
                        
                        <div className="text-center bg-accent rounded-lg p-2">
                          <div className="text-xs text-muted-foreground mb-1">Clean Sheets</div>
                          <div className="font-bold">{player.stats.cleanSheets}</div>
                        </div>
                        
                        <div className="text-center bg-accent rounded-lg p-2">
                          <div className="text-xs text-muted-foreground mb-1">Bonus</div>
                          <div className="font-bold">{player.stats.bonusPoints}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>
          
          {/* Haul Tab Content */}
          <TabsContent value="haul">
            {haulPlayers && haulManagers && (
              <>
                <Card className="p-6 mb-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    Top Managers
                  </h2>
                  
                  <div className="space-y-4">
                    {haulManagers.map((manager, index) => (
                      <div key={index} className="bg-accent/30 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-bold text-lg">{manager.teamName}</div>
                            <div className="text-sm text-muted-foreground">{manager.name}</div>
                          </div>
                          
                          <div className="text-2xl font-bold text-primary">{manager.points}</div>
                        </div>
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                          <div className="text-sm bg-accent rounded-lg p-2">
                            Captain: <span className="font-medium">{manager.captainName}</span> ({manager.captainPoints} pts)
                          </div>
                          
                          {manager.chips.benchBoost && (
                            <div className="text-sm bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg p-2">
                              Bench Boost
                            </div>
                          )}
                          
                          {manager.chips.tripleCaptain && (
                            <div className="text-sm bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 rounded-lg p-2">
                              Triple Captain
                            </div>
                          )}
                          
                          {manager.chips.wildcard && (
                            <div className="text-sm bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg p-2">
                              Wildcard
                            </div>
                          )}
                          
                          {manager.chips.freeHit && (
                            <div className="text-sm bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 rounded-lg p-2">
                              Free Hit
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Double-digit Hauls
                  </h2>
                  
                  <StatsTable
                    title=""
                    data={haulPlayers}
                    columns={[
                      { 
                        key: "name", 
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
                        key: "ownedBy", 
                        label: "Owned", 
                        format: (value) => `${value}%`,
                        className: "text-center"
                      },
                      { 
                        key: "captainedBy", 
                        label: "Captained", 
                        format: (value) => `${value}%`,
                        className: "text-center"
                      },
                      { 
                        key: "stats.goals", 
                        label: "G", 
                        className: "text-center" 
                      },
                      { 
                        key: "stats.assists", 
                        label: "A", 
                        className: "text-center" 
                      },
                      { 
                        key: "points", 
                        label: "Points", 
                        className: "text-right font-bold text-primary" 
                      }
                    ]}
                  />
                </Card>
              </>
            )}
          </TabsContent>
          
          {/* Transfer Trends Tab Content */}
          <TabsContent value="transfers">
            {transferTrends && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ArrowRightCircle className="h-5 w-5 text-emerald-500" />
                    Most Transferred In
                  </h2>
                  
                  <div className="space-y-3">
                    {transferTrends.in.map((trend, index) => (
                      <div key={index} className="bg-accent/30 p-3 rounded-lg flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-10 text-center font-medium">
                            {trend.position}
                          </Badge>
                          
                          <div>
                            <div className="font-medium">{trend.name}</div>
                            <div className="text-xs text-muted-foreground">{trend.team} | £{trend.price.toFixed(1)}m</div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end">
                          <div className="text-emerald-600 font-medium">+{formatCompactNumber(trend.transferCount)}</div>
                          <div className="text-xs text-emerald-500">+£{trend.priceChange.toFixed(1)}m</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
                
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ArrowLeftCircle className="h-5 w-5 text-rose-500" />
                    Most Transferred Out
                  </h2>
                  
                  <div className="space-y-3">
                    {transferTrends.out.map((trend, index) => (
                      <div key={index} className="bg-accent/30 p-3 rounded-lg flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-10 text-center font-medium">
                            {trend.position}
                          </Badge>
                          
                          <div>
                            <div className="font-medium">{trend.name}</div>
                            <div className="text-xs text-muted-foreground">{trend.team} | £{trend.price.toFixed(1)}m</div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end">
                          <div className="text-rose-600 font-medium">-{formatCompactNumber(trend.transferCount)}</div>
                          <div className="text-xs text-rose-500">{trend.priceChange.toFixed(1)}m</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RootLayout>
  );
}