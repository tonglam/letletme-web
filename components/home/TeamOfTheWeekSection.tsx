"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PlayerList } from "@/components/player/PlayerList";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_LIVE_SCORES,
  type EventsResponse,
  type LiveScoresResponse,
} from "@/lib/graphql/queries";
import { normalizePosition } from "@/lib/utils";
import { useEffect, useState } from "react";

interface TeamPlayer {
  id: number;
  position: string;
  name: string;
  team: string;
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
            position: normalizePosition(s.player.position),
            name: s.player.webName,
            team: s.player.team?.shortName ?? s.player.team?.name ?? "",
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
        <PlayerList players={teamOfTheWeek} />
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No team of the week data available</p>
        </div>
      )}
    </Card>
  );
}
