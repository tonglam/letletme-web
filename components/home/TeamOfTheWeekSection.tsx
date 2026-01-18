"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_LIVE_SCORES,
  type EventsResponse,
  type LiveScoresResponse
} from "@/lib/graphql/queries";
import { useEffect, useState } from "react";

interface TeamPlayer {
  id: number;
  position: string;
  name: string;
  points: number;
  shortClub: string;
}

export function TeamOfTheWeekSection() {
  const [currentGameweek, setCurrentGameweek] = useState<number | null>(null);
  const [teamOfTheWeek, setTeamOfTheWeek] = useState<TeamPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // First, get current gameweek
        const eventsResponse = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );
        
        const currentEvent = eventsResponse.current?.[0];
        if (!currentEvent) {
          throw new Error("No current gameweek found");
        }

        setCurrentGameweek(currentEvent.id);

        // Then fetch team of the week
        const scoresResponse = await executeQuery<LiveScoresResponse>(
          GET_LIVE_SCORES,
          { eventId: currentEvent.id }
        );

        // Helper function to normalize position from full name to abbreviation
        const normalizePosition = (pos: string): string => {
          if (!pos) return "UNK";
          const upper = pos.toUpperCase().trim();
          // Check for abbreviations first
          if (upper === "GKP" || upper === "GK") return "GKP";
          if (upper === "DEF") return "DEF";
          if (upper === "MID") return "MID";
          if (upper === "FWD" || upper === "FWD") return "FWD";
          // Check for full names
          if (upper.includes("GOALKEEPER") || upper.includes("GOAL KEEPER")) return "GKP";
          if (upper.includes("DEFENDER")) return "DEF";
          if (upper.includes("MIDFIELDER") || upper.includes("MID FIELD")) return "MID";
          if (upper.includes("FORWARD")) return "FWD";
          return upper;
        };

        // Map API data to TeamPlayer format
        // Normalize position from full name (DEFENDER) to abbreviation (DEF)
        const mappedPlayers: TeamPlayer[] = scoresResponse.liveScores.map((score) => ({
          id: score.player.id,
          position: normalizePosition(score.player.position || "UNK"),
          name: score.player.webName,
          points: score.totalPoints,
          shortClub: "", // Team info not available in query
        }));

        // Sort by position order (GKP, DEF, MID, FWD)
        const positionOrder: Record<string, number> = {
          GKP: 0,
          DEF: 1,
          MID: 2,
          FWD: 3,
        };

        mappedPlayers.sort((a, b) => {
          const orderA = positionOrder[a.position] ?? 99;
          const orderB = positionOrder[b.position] ?? 99;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return b.points - a.points; // Within same position, sort by points descending
        });

        setTeamOfTheWeek(mappedPlayers);
      } catch (err) {
        console.error("Failed to fetch team of the week:", err);
        setError("Failed to load team of the week");
        setTeamOfTheWeek([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Map full position names to abbreviations
  const normalizePosition = (position: string): string => {
    const upper = position.toUpperCase();
    if (upper.includes("GOALKEEPER") || upper === "GKP") return "GKP";
    if (upper.includes("DEFENDER") || upper === "DEF") return "DEF";
    if (upper.includes("MIDFIELDER") || upper === "MID") return "MID";
    if (upper.includes("FORWARD") || upper === "FWD") return "FWD";
    return upper; // Return as-is if unknown
  };

  const getPositionColor = (position: string) => {
    const normalized = normalizePosition(position);
    switch (normalized) {
      case "GKP": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "DEF": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "MID": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "FWD": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : currentGameweek ? (
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
              GW{currentGameweek}
            </span>
          ) : (
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
              GW
            </span>
          )}
          <span>Team of the Week</span>
        </h2>
        {teamOfTheWeek.length > 0 && !isLoading && (
          <Badge variant="secondary">
            {teamOfTheWeek.length} players
          </Badge>
        )}
      </div>
      
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : teamOfTheWeek.length > 0 ? (
        <div className="space-y-2">
          {teamOfTheWeek.map((player) => (
            <button
              key={player.id}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-background/80 hover:bg-background border border-border/50 hover:border-border transition-all text-left group"
              onClick={() => console.log(`Clicked on ${player.name}`)}
              aria-label={`View details for ${player.name}`}
            >
              <Badge 
                variant="secondary" 
                className={`shrink-0 text-xs font-semibold ${getPositionColor(player.position)}`}
              >
                {player.position}
              </Badge>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {player.name}
                  </span>
                </div>
                {player.shortClub && (
                  <span className="text-xs text-muted-foreground truncate block">
                    {player.shortClub}
                  </span>
                )}
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className="text-lg font-bold text-primary">
                  {player.points}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No team of the week data available</p>
        </div>
      )}
    </Card>
  );
}