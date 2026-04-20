"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_EVENT_OVERALL_RESULT,
  type ChipPlay,
  type EventOverallResult,
  type EventOverallResultResponse,
  type EventsResponse,
} from "@/lib/graphql/queries";
import homeStats from "@/lib/home-stats";
import { ArrowRightCircle, Crown, Trophy, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface StatCard {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}

export function StatsSection() {
  const [currentGameweek, setCurrentGameweek] = useState<number | null>(null);
  const [stats, setStats] = useState<StatCard[]>([]);
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

        const currentSeason = homeStats.getCurrentSeasonKey();
        const resultData = await executeQuery<EventOverallResultResponse>(
          GET_EVENT_OVERALL_RESULT,
          { season: currentSeason },
          { cache: "force-cache" }
        );

        const result: EventOverallResult | null = homeStats.pickEventOverallResult(
          resultData.eventOverallResult,
          currentEventId
        );

        if (!result) throw new Error("No overall result data");

        const mostPlayedChip = (result.chipPlays ?? []).reduce<ChipPlay | null>(
          (max, chip) => (!max || chip.numberPlayed > max.numberPlayed ? chip : max),
          null
        );

        setStats([
          {
            label: "Highest Score",
            value: result.highestScore?.toString() ?? "0",
            icon: <Trophy className="w-5 h-5 text-yellow-500" />,
          },
          {
            label: "Top Scorer",
            value: homeStats.formatTopScorerValue(result.topElementInfo),
            icon: <Zap className="w-5 h-5 text-blue-500" />,
          },
          {
            label: "Most Vice-Captained",
            value: result.mostViceCaptainedPlayer?.webName ?? "N/A",
            icon: <Crown className="w-5 h-5 text-purple-500" />,
          },
          {
            label: "Top Chip Played",
            value: mostPlayedChip
              ? `${mostPlayedChip.chipName} (${mostPlayedChip.numberPlayed})`
              : "N/A",
            icon: <ArrowRightCircle className="w-5 h-5 text-green-500" />,
          },
        ]);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setError("Failed to load stats");
        setStats([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const iconBgs = [
    "bg-yellow-100 dark:bg-yellow-900/20",
    "bg-blue-100 dark:bg-blue-900/20",
    "bg-purple-100 dark:bg-purple-900/20",
    "bg-green-100 dark:bg-green-900/20",
  ];

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
          <span>Gameweek Stats</span>
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-lg border bg-card">
              <Skeleton className="w-12 h-12 rounded-lg mb-3" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      ) : stats.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className={`inline-flex p-3 rounded-lg mb-3 ${iconBgs[index]}`}>
                {stat.icon}
              </div>
              <div className="space-y-1">
                <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No stats available</p>
        </div>
      )}
    </Card>
  );
}
