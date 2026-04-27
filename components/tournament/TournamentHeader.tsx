"use client";

import { Card } from "@/components/ui/card";
import { Trophy, Users2, BarChart2 } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";

interface TournamentHeaderProps {
  name: string;
  gameweek: number;
  averagePoints: number;
  highestPoints: number;
  totalEntries: number;
  tournamentId?: string;
}

export function TournamentHeader({
  name,
  averagePoints,
  highestPoints,
  totalEntries
}: TournamentHeaderProps) {
  return (
    <Card className="p-6 mb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{name}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-accent/30 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Highest Score
          </span>
          <span className="text-xl font-bold text-center">{highestPoints} pts</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            Average Score
          </span>
          <span className="text-xl font-bold text-center">{averagePoints} pts</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-2">
            <Users2 className="h-4 w-4 text-emerald-500" />
            Total Entries
          </span>
          <span className="text-xl font-bold text-center">{formatCompactNumber(totalEntries)}</span>
        </div>
      </div>
    </Card>
  );
}
