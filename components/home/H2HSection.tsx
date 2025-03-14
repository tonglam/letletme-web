"use client";

import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface H2HMatch {
  homeTeam: {
    name: string;
    score: number;
  };
  awayTeam: {
    name: string;
    score: number;
  };
}

const matches: H2HMatch[] = [
  {
    homeTeam: {
      name: "让让群の一美",
      score: 0
    },
    awayTeam: {
      name: "Wood You Haa Me Up?",
      score: 0
    }
  },
  {
    homeTeam: {
      name: "Fantasy Kings",
      score: 0
    },
    awayTeam: {
      name: "让让群の一美",
      score: 0
    }
  },
  {
    homeTeam: {
      name: "让让群の一美",
      score: 0
    },
    awayTeam: {
      name: "Blue Lions",
      score: 0
    }
  }
];

export function H2HSection() {
  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6">
      <h2 className="text-xl font-bold mb-6 flex items-center">
        <span className="bg-primary/10 text-primary p-1.5 sm:p-2 rounded-lg mr-2 text-sm sm:text-base">GW21</span>
        H2H Matches
      </h2>
      <div className="space-y-4">
        {matches.map((match, index) => (
          <div 
            key={index}
            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 bg-accent/50 p-2.5 sm:p-4 rounded-lg hover:bg-accent/70 transition-colors"
          >
            <div className="text-right min-w-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => console.log(`Clicked on ${match.homeTeam.name}`)}
                      className="text-xs sm:text-sm font-medium truncate hover:text-primary transition-colors max-w-full inline-block"
                      aria-label={`View details for ${match.homeTeam.name}`}
                    >
                      {match.homeTeam.name}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View {match.homeTeam.name}'s team</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-3 justify-center">
              <div className="bg-primary text-primary-foreground font-medium text-xs sm:text-sm w-6 sm:w-8 h-6 sm:h-8 rounded flex items-center justify-center">
                {match.homeTeam.score}
              </div>
              <div className="text-xs sm:text-sm font-medium text-muted-foreground">vs</div>
              <div className="bg-primary text-primary-foreground font-medium text-xs sm:text-sm w-6 sm:w-8 h-6 sm:h-8 rounded flex items-center justify-center">
                {match.awayTeam.score}
              </div>
            </div>
            
            <div className="min-w-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => console.log(`Clicked on ${match.awayTeam.name}`)}
                      className="text-xs sm:text-sm font-medium truncate hover:text-primary transition-colors max-w-full inline-block"
                      aria-label={`View details for ${match.awayTeam.name}`}
                    >
                      {match.awayTeam.name}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View {match.awayTeam.name}'s team</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}