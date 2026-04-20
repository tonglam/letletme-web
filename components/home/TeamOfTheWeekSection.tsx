"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_LIVE_SCORES,
  type EventsResponse,
  type LiveScoresResponse,
} from "@/lib/graphql/queries";
import { useEffect, useState } from "react";

interface TeamPlayer {
  id: number;
  position: string;
  name: string;
  points: number;
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

        const eventsData = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );
        const currentEventId = eventsData.current[0]?.id;
        if (!currentEventId) throw new Error("No current event found");

        setCurrentGameweek(currentEventId);

        const scoresData = await executeQuery<LiveScoresResponse>(
          GET_LIVE_SCORES,
          { eventId: currentEventId }
        );

        const positionOrder: Record<string, number> = {
          GKP: 0,
          DEF: 1,
          MID: 2,
          FWD: 3,
        };

        const players: TeamPlayer[] = scoresData.liveScores
          .filter((s) => s.inDreamTeam)
          .map((s) => ({
            id: s.player.id,
            position: s.player.position ?? "UNK",
            name: s.player.webName,
            points: s.totalPoints,
          }))
          .sort((a, b) => {
            const orderDiff =
              (positionOrder[a.position] ?? 99) -
              (positionOrder[b.position] ?? 99);
            return orderDiff !== 0 ? orderDiff : b.points - a.points;
          });

        setTeamOfTheWeek(players);
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

  const getPositionColor = (position: string) => {
    switch (position) {
      case "GKP":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "DEF":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "MID":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "FWD":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
              {currentGameweek ? `GW${currentGameweek}` : "GW"}
            </span>
          )}
          <span>Team of the Week</span>
        </h2>
        {teamOfTheWeek.length > 0 && !isLoading && (
          <Badge variant="secondary">{teamOfTheWeek.length} players</Badge>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 11 }).map((_, i) => (
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
                <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors block">
                  {player.name}
                </span>
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
