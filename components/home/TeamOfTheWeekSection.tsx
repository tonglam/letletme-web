"use client";

import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TeamPlayer {
  position: string;
  name: string;
  points: number;
  shortClub: string;
}

const teamOfTheWeek: TeamPlayer[] = [
  { position: "GKP", name: "Sels", points: 9, shortClub: "NFO" },
  { position: "DEF", name: "Kerkez", points: 12, shortClub: "BOU" },
  { position: "DEF", name: "Van den Berg", points: 10, shortClub: "BRE" },
  { position: "DEF", name: "Murillo", points: 9, shortClub: "NFO" },
  { position: "MID", name: "Mbeumo", points: 19, shortClub: "BRE" },
  { position: "MID", name: "Sávio", points: 13, shortClub: "MCI" },
  { position: "MID", name: "Barkley", points: 10, shortClub: "AVL" },
  { position: "MID", name: "Mac Allister", points: 10, shortClub: "LIV" },
  { position: "FWD", name: "Raúl", points: 13, shortClub: "FUL" },
  { position: "FWD", name: "Haaland", points: 13, shortClub: "MCI" },
  { position: "FWD", name: "Wissa", points: 11, shortClub: "BRE" },
];

export function TeamOfTheWeekSection() {
  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-6 flex items-center">
        <span className="bg-primary/10 text-primary p-1.5 sm:p-2 rounded-lg mr-2 text-sm sm:text-base">GW20</span>
        Team of the Week
      </h2>
      <div className="space-y-3">
        {teamOfTheWeek.map((player, index) => (
          <button
            key={index}
            className="w-full flex items-center justify-between p-2 sm:p-3 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors text-left"
            onClick={() => console.log(`Clicked on ${player.name}`)}
            aria-label={`View details for ${player.name}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {player.position}
              </span>
              <span className="w-8 text-xs sm:text-sm font-medium text-muted-foreground shrink-0">
                {player.shortClub}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium truncate flex-1">{player.name}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{player.name}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center ml-2 shrink-0">
              <span className="font-bold text-primary">{player.points}</span>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}