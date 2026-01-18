"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_EVENT_OVERALL_RESULT,
  type EventOverallResult,
  type EventOverallResultResponse,
  type EventsResponse
} from "@/lib/graphql/queries";
import { Crown, Trophy, Users, Zap } from "lucide-react";
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

        // First, get current gameweek
        const eventsResponse = await executeQuery<EventsResponse>(
          GET_CURRENT_AND_NEXT_EVENTS
        );
        
        const currentEvent = eventsResponse.current?.[0];
        if (!currentEvent) {
          throw new Error("No current gameweek found");
        }

        setCurrentGameweek(currentEvent.id);

        // Then fetch event overall result
        const resultResponse = await executeQuery<EventOverallResultResponse>(
          GET_EVENT_OVERALL_RESULT,
          { season: 2526 }
        );

        // Handle both array and single object responses
        let result: EventOverallResult | null = null;
        const eventData = resultResponse.eventOverallResult;
        
        if (Array.isArray(eventData)) {
          // Filter by current gameweek if it's an array
          result = eventData.find(event => event.event === currentEvent.id) || null;
        } else {
          // If single object, check if it matches current gameweek
          if (eventData.event === currentEvent.id) {
            result = eventData;
          }
        }

        if (!result) {
          throw new Error(`No data found for gameweek ${currentEvent.id}`);
        }
        
        // Map API data to stats
        const topScorerName = result.topElementInfo?.player?.webName || "N/A";
        const topScorerPoints = result.topElementInfo?.points?.toString() || "0";
        
        const mappedStats: StatCard[] = [
          {
            label: "Highest Score",
            value: result.highestScore?.toString() || "0",
            icon: <Trophy className="w-5 h-5 text-yellow-500" />,
          },
          {
            label: "Top Scorer",
            value: `${topScorerName} (${topScorerPoints})`,
            icon: <Zap className="w-5 h-5 text-blue-500" />,
          },
          {
            label: "Most Captained",
            value: result.mostCaptainedPlayer?.webName || "N/A",
            icon: <Crown className="w-5 h-5 text-purple-500" />,
          },
          {
            label: "Most Selected",
            value: result.mostSelectedPlayer?.webName || "N/A",
            icon: <Users className="w-5 h-5 text-green-500" />,
          },
        ];

        setStats(mappedStats);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setError("Failed to load stats");
        // Set default/empty stats
        setStats([]);
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
          ) : currentGameweek ? (
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
              GW{currentGameweek}
            </span>
          ) : (
            <span className="bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold">
              GW
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
          {stats.map((stat, index) => {
            const getIconBg = () => {
              switch (index) {
                case 0: return "bg-yellow-100 dark:bg-yellow-900/20";
                case 1: return "bg-blue-100 dark:bg-blue-900/20";
                case 2: return "bg-purple-100 dark:bg-purple-900/20";
                case 3: return "bg-green-100 dark:bg-green-900/20";
                default: return "bg-accent/50";
              }
            };

            return (
              <div
                key={index}
                className="group p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className={`inline-flex p-3 rounded-lg mb-3 ${getIconBg()}`}>
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
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No stats available</p>
        </div>
      )}
    </Card>
  );
}