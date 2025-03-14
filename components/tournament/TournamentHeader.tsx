"use client";

import { Card } from "@/components/ui/card";
import { Trophy, Users2, Zap, BarChart2 } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";

interface TournamentHeaderProps {
  name: string;
  gameweek: number;
  averagePoints: number;
  highestPoints: number;
  totalEntries: number;
}

export function TournamentHeader({
  name,
  gameweek,
  averagePoints,
  highestPoints,
  totalEntries
}: TournamentHeaderProps) {
  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold">{name}</h2>
          <p className="text-muted-foreground">Gameweek {gameweek} Live Standings</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
            Tournament ID: T1287
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-accent/30 rounded-lg p-4 flex flex-col">
          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Highest Score
          </span>
          <span className="text-xl font-bold">{highestPoints} pts</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col">
          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            Average Score
          </span>
          <span className="text-xl font-bold">{averagePoints} pts</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col">
          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
            <Users2 className="h-4 w-4 text-emerald-500" />
            Total Entries
          </span>
          <span className="text-xl font-bold">{formatCompactNumber(totalEntries)}</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col">
          <span className="text-muted-foreground text-sm flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-purple-500" />
            Status
          </span>
          <span className="text-xl font-bold text-emerald-500">Live</span>
        </div>
      </div>
    </Card>
  );
}