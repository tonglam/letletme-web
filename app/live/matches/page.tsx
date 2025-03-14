"use client";

import RootLayout from "@/components/layout/RootLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Match } from "@/types/match";
import { MatchCard } from "@/components/live/MatchCard";

const matches: Match[] = [
  {
    id: "1",
    homeTeam: {
      name: "Manchester United",
      shortName: "MUN",
      score: 2,
      possession: 55,
      shots: 12,
      shotsOnTarget: 5,
      corners: 6,
      manager: {
        name: "Marcus Rashford's Manager",
        team: "Red Devils",
        points: 48
      },
      players: [
        { 
          player: "Onana",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 23
        },
        { 
          player: "Rashford",
          goals: 1,
          assists: 1,
          penalties_saved: 0,
          penalties_missed: 0,
          red_cards: 0,
          yellow_cards: 0,
          bonus_points: 2,
          bps: 75
        },
        { 
          player: "Fernandes",
          goals: 1,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          red_cards: 0,
          yellow_cards: 1,
          bonus_points: 1,
          bps: 58
        }
      ]
    },
    awayTeam: {
      name: "Tottenham",
      shortName: "TOT",
      score: 1,
      possession: 45,
      shots: 8,
      shotsOnTarget: 3,
      corners: 4,
      manager: {
        name: "Son's Manager",
        team: "Spurs Forever",
        points: 32
      },
      players: [
        {
          player: "Vicario",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 15
        },
        { 
          player: "Son",
          goals: 1,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          red_cards: 0,
          yellow_cards: 0,
          bonus_points: 3,
          bps: 89
        },
        { 
          player: "Kulusevski",
          goals: 0,
          assists: 1,
          penalties_saved: 0,
          penalties_missed: 0,
          red_cards: 0,
          yellow_cards: 1,
          bps: 42
        }
      ]
    },
    status: "LIVE",
    minute: 67,
    kickoff: "2024-01-17T03:30:00",
    viewers: 124563,
    bonusPoints: [
      { player: "Son", team: "TOT", points: 3 },
      { player: "Rashford", team: "MUN", points: 2 },
      { player: "Fernandes", team: "MUN", points: 1 }
    ],
    bps: [
      { player: "Son", team: "TOT", score: 89 },
      { player: "Rashford", team: "MUN", score: 75 },
      { player: "Fernandes", team: "MUN", score: 58 },
      { player: "Kulusevski", team: "TOT", score: 42 },
      { player: "Onana", team: "MUN", score: 23 }
    ]
  },
  {
    id: "2",
    homeTeam: {
      name: "Aston Villa",
      shortName: "AVL",
      score: 0,
      possession: 48,
      shots: 7,
      shotsOnTarget: 2,
      corners: 3,
      manager: {
        name: "Villa Supporter",
        team: "Villa Lions",
        points: 18
      },
      players: [
        {
          player: "Martinez",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 28
        },
        {
          player: "Watkins",
          goals: 0,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 1,
          red_cards: 0,
          bps: 12
        }
      ]
    },
    awayTeam: {
      name: "Newcastle",
      shortName: "NEW",
      score: 0,
      possession: 52,
      shots: 9,
      shotsOnTarget: 4,
      corners: 5,
      manager: {
        name: "Magpies Fan",
        team: "Newcastle United FC",
        points: 21
      },
      players: [
        {
          player: "Pope",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 32
        },
        {
          player: "Gordon",
          goals: 0,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 19
        }
      ]
    },
    status: "HT",
    minute: 45,
    kickoff: "2024-01-17T04:00:00",
    viewers: 98234,
    bps: [
      { player: "Pope", team: "NEW", score: 32 },
      { player: "Martinez", team: "AVL", score: 28 },
      { player: "Gordon", team: "NEW", score: 19 },
      { player: "Watkins", team: "AVL", score: 12 },
      { player: "Isak", team: "NEW", score: 8 }
    ]
  },
  {
    id: "3",
    homeTeam: {
      name: "Liverpool",
      shortName: "LIV",
      score: 3,
      possession: 58,
      shots: 15,
      shotsOnTarget: 7,
      corners: 8,
      manager: {
        name: "The Red Manager",
        team: "Anfield Reds",
        points: 62
      },
      players: [
        {
          player: "Alisson",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 25
        },
        {
          player: "Salah",
          goals: 2,
          assists: 1,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bonus_points: 3,
          bps: 93
        },
        {
          player: "Núñez",
          goals: 1,
          assists: 2,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 1,
          red_cards: 0,
          bonus_points: 2,
          bps: 81
        }
      ]
    },
    awayTeam: {
      name: "Brighton",
      shortName: "BHA",
      score: 1,
      possession: 42,
      shots: 8,
      shotsOnTarget: 3,
      corners: 4,
      manager: {
        name: "Seagulls Fan",
        team: "Brighton FC",
        points: 28
      },
      players: [
        {
          player: "Verbruggen",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: -5
        },
        {
          player: "Ferguson",
          goals: 1,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bonus_points: 1,
          bps: 64
        },
        {
          player: "Mitoma",
          goals: 0,
          assists: 1,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 43
        }
      ]
    },
    status: "LIVE",
    minute: 78,
    kickoff: "2024-01-17T03:45:00",
    viewers: 156789,
    bonusPoints: [
      { player: "Salah", team: "LIV", points: 3 },
      { player: "Núñez", team: "LIV", points: 2 },
      { player: "Ferguson", team: "BHA", points: 1 }
    ],
    bps: [
      { player: "Salah", team: "LIV", score: 93 },
      { player: "Núñez", team: "LIV", score: 81 },
      { player: "Ferguson", team: "BHA", score: 64 },
      { player: "Mitoma", team: "BHA", score: 43 },
      { player: "Alisson", team: "LIV", score: 25 }
    ]
  },
  {
    id: "4",
    homeTeam: {
      name: "Arsenal",
      shortName: "ARS",
      score: 2,
      possession: 62,
      shots: 18,
      shotsOnTarget: 8,
      corners: 7,
      manager: {
        name: "Gunners Fan",
        team: "Arsenal Forever",
        points: 54
      },
      players: [
        {
          player: "Raya",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 32
        },
        {
          player: "Saka",
          goals: 1,
          assists: 1,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bonus_points: 3,
          bps: 87
        },
        {
          player: "Martinelli",
          goals: 1,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bonus_points: 2,
          bps: 68
        }
      ]
    },
    awayTeam: {
      name: "Crystal Palace",
      shortName: "CRY",
      score: 0,
      possession: 38,
      shots: 6,
      shotsOnTarget: 2,
      corners: 3,
      manager: {
        name: "Eagles Supporter",
        team: "Palace Eagles",
        points: 26
      },
      players: [
        {
          player: "Henderson",
          penalties_saved: 0,
          penalties_missed: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 1,
          red_cards: 0,
          bps: 15
        },
        {
          player: "Eze",
          goals: 0,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 1,
          red_cards: 0,
          bonus_points: 1,
          bps: 42
        },
        {
          player: "Olise",
          goals: 0,
          assists: 0,
          penalties_saved: 0,
          penalties_missed: 0,
          yellow_cards: 0,
          red_cards: 0,
          bps: 26
        }
      ]
    },
    status: "FT",
    minute: 90,
    kickoff: "2024-01-17T03:00:00",
    viewers: 143256,
    bonusPoints: [
      { player: "Saka", team: "ARS", points: 3 },
      { player: "Martinelli", team: "ARS", points: 2 },
      { player: "Eze", team: "CRY", points: 1 }
    ],
    bps: [
      { player: "Saka", team: "ARS", score: 87 },
      { player: "Martinelli", team: "ARS", score: 68 },
      { player: "Eze", team: "CRY", score: 42 },
      { player: "Raya", team: "ARS", score: 32 },
      { player: "Olise", team: "CRY", score: 26 }
    ]
  },
  {
    id: "5",
    homeTeam: {
      name: "Chelsea",
      shortName: "CHE",
      score: 0,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      manager: {
        name: "Blues Supporter",
        team: "Chelsea Blues",
        points: 0
      },
      players: []
    },
    awayTeam: {
      name: "Bournemouth",
      shortName: "BOU",
      score: 0,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      manager: {
        name: "Cherries Fan",
        team: "Bournemouth FC",
        points: 0
      },
      players: []
    },
    status: "UPCOMING",
    minute: 0,
    kickoff: "2024-01-17T05:30:00",
    viewers: 89432
  },
  {
    id: "6",
    homeTeam: {
      name: "West Ham",
      shortName: "WHU",
      score: 0,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      manager: {
        name: "Hammers Fan",
        team: "West Ham United",
        points: 0
      },
      players: []
    },
    awayTeam: {
      name: "Fulham",
      shortName: "FUL",
      score: 0,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      manager: {
        name: "Cottagers Fan",
        team: "Fulham FC",
        points: 0
      },
      players: []
    },
    status: "UPCOMING",
    minute: 0,
    kickoff: "2024-01-17T05:30:00",
    viewers: 76543
  },
  {
    id: "7",
    homeTeam: {
      name: "Nottingham Forest",
      shortName: "NFO",
      score: 0,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      manager: {
        name: "Forest Fan",
        team: "Nottingham FC",
        points: 0
      },
      players: []
    },
    awayTeam: {
      name: "Liverpool",
      shortName: "LIV",
      score: 0,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      manager: {
        name: "The Red Manager",
        team: "Anfield Reds",
        points: 0
      },
      players: []
    },
    status: "UPCOMING",
    minute: 0,
    kickoff: "2024-01-17T06:00:00",
    viewers: 112345
  }
];

export default function LiveMatches() {
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Live Matches</h1>
        <Tabs defaultValue="live">
          <div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
            <TabsList className="w-full grid grid-cols-4 gap-2 sm:gap-4">
              <TabsTrigger value="live" className="w-full">Live Now</TabsTrigger>
              <TabsTrigger value="finished" className="w-full">Finished</TabsTrigger>
              <TabsTrigger value="upcoming" className="w-full">Upcoming</TabsTrigger>
              <TabsTrigger value="all" className="w-full">All Matches</TabsTrigger>
            </TabsList>
          </div>
          
          <TabsContent value="live" className="space-y-6">
            {matches
              .filter((match) => match.status === "LIVE")
              .map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
          </TabsContent>
          
          <TabsContent value="finished" className="space-y-6">
            {matches
              .filter((match) => match.status === "FT")
              .map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
          </TabsContent>
          
          <TabsContent value="upcoming" className="space-y-6">
            {matches
              .filter((match) => match.status === "UPCOMING")
              .map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
          </TabsContent>
          
          <TabsContent value="all" className="space-y-6">
            {matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </RootLayout>
  );
}