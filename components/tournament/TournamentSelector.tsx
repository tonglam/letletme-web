"use client";

import { Tournament } from "@/types/tournament";
import { Trophy, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface TournamentSelectorProps {
  tournaments: Tournament[];
  currentTournamentId: string;
  onTournamentChange: (tournamentId: string) => void;
}

export function TournamentSelector({
  tournaments,
  currentTournamentId,
  onTournamentChange
}: TournamentSelectorProps) {
  // Find current tournament
  const currentTournament = tournaments.find(t => t.id === currentTournamentId) || tournaments[0];
  
  return (
    <Card className="p-4 mb-6">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-medium">Select Tournament:</span>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full sm:w-[300px] justify-between">
              <span className="truncate">{currentTournament.name}</span>
              <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[300px]">
            {tournaments.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => onTournamentChange(t.id)}
                className="flex justify-between items-center"
              >
                <span className="truncate">{t.name}</span>
                {t.id === currentTournamentId && (
                  <Trophy className="h-4 w-4 text-primary ml-2" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}