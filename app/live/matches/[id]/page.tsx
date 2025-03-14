"use client";

import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { PlayerList } from "@/components/live/PlayerList";
import { TeamStats } from "@/components/live/TeamStats";
import { Player } from "@/types/player";

const mockPlayers: Player[] = [
  {
    id: "1",
    name: "Sánchez",
    team: "Chelsea",
    teamShort: "CHE",
    position: "GKP",
    stats: {
      minutes: 90,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 3,
      bonusPoints: 0
    }
  },
  {
    id: "2",
    name: "M.Salah",
    team: "Liverpool",
    teamShort: "LIV",
    position: "MID",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 7,
      bonusPoints: 0
    },
    isCaptain: true
  },
  {
    id: "3",
    name: "Palmer",
    team: "Chelsea",
    teamShort: "CHE",
    position: "MID",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 10,
      bonusPoints: 3
    },
    isViceCaptain: true
  }
];

const teamStats = {
  teamName: "let let red arrow↓↑↓",
  playerName: "tong",
  points: 54,
  totalPoints: 1213,
  playersPlayed: 11,
  playersToPlay: 0,
  chips: {
    bench: false,
    triple: false,
    wildcard: false
  }
};

export default function MatchDetail() {
  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <Card className="mb-8">
          <TeamStats stats={teamStats} />
        </Card>
        
        <Card>
          <PlayerList players={mockPlayers} />
        </Card>
      </div>
    </RootLayout>
  );
}