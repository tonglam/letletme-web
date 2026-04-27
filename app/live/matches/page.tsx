"use client";

import RootLayout from "@/components/layout/RootLayout";
import { MatchCard } from "@/components/live/MatchCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_LIVE_MATCHES,
  type EventsResponse,
  type MatchPlayerData,
  type LiveMatchesResponse,
} from "@/lib/graphql/queries";
import { teamFullNames } from "@/types/common";
import { Match } from "@/types/match";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LIVE_MATCHES_TAB_STORAGE_KEY = "live-matches-active-tab";
const LIVE_MATCHES_AUTO_REFRESH_SECONDS = 60;
type LiveMatchesTab = "live" | "finished" | "not-started" | "upcoming";
type LiveStatusTab = Match["status"];

const TAB_CONFIG: ReadonlyArray<{
  value: LiveMatchesTab;
  label: string;
  statuses: ReadonlyArray<LiveStatusTab>;
}> = [
  {
    value: "live",
    label: "No live matches",
    statuses: ["LIVE", "HT"],
  },
  {
    value: "finished",
    label: "No finished matches",
    statuses: ["FT"],
  },
  {
    value: "not-started",
    label: "No matches not started",
    statuses: ["NOT_STARTED"],
  },
  {
    value: "upcoming",
    label: "No upcoming matches",
    statuses: ["UPCOMING"],
  },
] as const;

function isLiveMatchesTab(value: string): value is LiveMatchesTab {
  return (
    value === "live" ||
    value === "finished" ||
    value === "not-started" ||
    value === "upcoming"
  );
}

function getTeamShortName(fullName: string): string {
  const normalized = fullName
    .replace(/Man City/gi, "Manchester City")
    .replace(/Man Utd/gi, "Manchester United")
    .replace(/Nott'm Forest/gi, "Nottingham Forest")
    .replace(/Spurs/gi, "Tottenham")
    .trim();

  const entry = Object.entries(teamFullNames).find(
    ([, name]) => name.toLowerCase() === normalized.toLowerCase()
  );

  if (!entry) {
    const partialMatch = Object.entries(teamFullNames).find(
      ([, name]) =>
        name.toLowerCase().includes(normalized.toLowerCase()) ||
        normalized.toLowerCase().includes(name.toLowerCase())
    );
    if (partialMatch) return partialMatch[0];
  }

  return entry ? entry[0] : fullName.substring(0, 3).toUpperCase();
}

function transformLiveMatches(data: LiveMatchesResponse["liveMatches"]): Match[] {
  const matches: Match[] = [];

  type LiveMatchesBucket = "nextEvent" | "notStarted" | "playing" | "finished";

  const toMatchStatus = (
    playStatus: string | undefined,
    bucket: LiveMatchesBucket
  ): Match["status"] => {
    const status = (playStatus ?? "").toUpperCase();

    if (bucket === "nextEvent") {
      return "UPCOMING";
    }
    if (bucket === "notStarted") {
      return "NOT_STARTED";
    }
    if (bucket === "finished") {
      return "FT";
    }
    return status.includes("HALF") ? "HT" : "LIVE";
  };

  const mapPlayers = (players: MatchPlayerData[] | undefined) =>
    (players ?? []).map((player) => ({
      player: player.webName,
      element: player.element,
      elementType: player.elementType,
      minutes: player.minutes,
      goals: player.goalsScored ?? 0,
      assists: player.assists ?? 0,
      cleanSheets: player.cleanSheets ?? 0,
      goalsConceded: player.goalsConceded ?? 0,
      ownGoals: player.ownGoals ?? 0,
      penalties_saved: player.penaltiesSaved ?? 0,
      penalties_missed: player.penaltiesMissed ?? 0,
      yellow_cards: player.yellowCards ?? 0,
      red_cards: player.redCards ?? 0,
      bonus_points: player.bonus ?? 0,
      bps: player.bps ?? 0,
      defensiveContribution: player.defensiveContribution ?? 0,
      saves: player.saves ?? 0,
      totalPoints: player.totalPoints ?? 0,
    }));

  const makeMatch = (
    id: string,
    homeTeamName: string,
    homeTeamShortName: string,
    homeScore: number,
    awayTeamName: string,
    awayTeamShortName: string,
    awayScore: number,
    status: Match["status"],
    kickoffTime: string,
    minute: number,
    homePlayers: Match["homeTeam"]["players"],
    awayPlayers: Match["awayTeam"]["players"]
  ): Match => ({
    id,
    homeTeam: {
      name: homeTeamName,
      shortName: homeTeamShortName || getTeamShortName(homeTeamName),
      score: homeScore,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      players: homePlayers,
    },
    awayTeam: {
      name: awayTeamName,
      shortName: awayTeamShortName || getTeamShortName(awayTeamName),
      score: awayScore,
      possession: 0,
      shots: 0,
      shotsOnTarget: 0,
      corners: 0,
      players: awayPlayers,
    },
    status,
    minute,
    kickoff: kickoffTime,
    viewers: 0,
  });

  data.nextEvent.forEach((m) =>
    matches.push(
      makeMatch(
        `next-${m.matchId}`,
        m.homeTeamName,
        m.homeTeamShortName,
        0,
        m.awayTeamName,
        m.awayTeamShortName,
        0,
        toMatchStatus(m.playStatus, "nextEvent"),
        m.kickoffTime,
        m.minutes ?? 0,
        [],
        []
      )
    )
  );

  data.notStarted.forEach((m) =>
    matches.push(
      makeMatch(
        `ns-${m.matchId}`,
        m.homeTeamName,
        m.homeTeamShortName,
        m.homeScore,
        m.awayTeamName,
        m.awayTeamShortName,
        m.awayScore,
        toMatchStatus(m.playStatus, "notStarted"),
        m.kickoffTime,
        m.minutes ?? 0,
        [],
        []
      )
    )
  );

  data.playing.forEach((m) =>
    matches.push(
      makeMatch(
        `live-${m.matchId}`,
        m.homeTeamName,
        m.homeTeamShortName,
        m.homeScore,
        m.awayTeamName,
        m.awayTeamShortName,
        m.awayScore,
        toMatchStatus(m.playStatus, "playing"),
        m.kickoffTime,
        m.minutes ?? 0,
        mapPlayers(m.homeTeamDataList),
        mapPlayers(m.awayTeamDataList)
      )
    )
  );

  data.finished.forEach((m) =>
    matches.push(
      makeMatch(
        `ft-${m.matchId}`,
        m.homeTeamName,
        m.homeTeamShortName,
        m.homeScore,
        m.awayTeamName,
        m.awayTeamShortName,
        m.awayScore,
        toMatchStatus(m.playStatus, "finished"),
        m.kickoffTime,
        m.minutes ?? 0,
        mapPlayers(m.homeTeamDataList),
        mapPlayers(m.awayTeamDataList)
      )
    )
  );

  const statusPriority: Record<Match["status"], number> = {
    LIVE: 0,
    HT: 1,
    NOT_STARTED: 2,
    UPCOMING: 3,
    FT: 4,
  };

  matches.sort((a, b) => {
    const statusDiff = statusPriority[a.status] - statusPriority[b.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    if (a.status === "LIVE" || a.status === "HT") {
      return b.minute - a.minute;
    }

    const tA = new Date(a.kickoff || "").getTime();
    const tB = new Date(b.kickoff || "").getTime();
    return (isNaN(tA) ? 1 : 0) - (isNaN(tB) ? 1 : 0) || tA - tB;
  });

  return matches;
}

function AutoRefreshCountdown({
  enabled,
  onRefresh,
}: {
  enabled: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const refreshInFlightRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) {
      setCountdown(null);
      return;
    }

    setCountdown(LIVE_MATCHES_AUTO_REFRESH_SECONDS);
    const remainingRef = { current: LIVE_MATCHES_AUTO_REFRESH_SECONDS };

    const intervalId = window.setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 0) {
        remainingRef.current = LIVE_MATCHES_AUTO_REFRESH_SECONDS;
        if (!refreshInFlightRef.current) {
          refreshInFlightRef.current = true;
          void onRefreshRef.current().finally(() => {
            refreshInFlightRef.current = false;
          });
        }
      }
      setCountdown(remainingRef.current);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  if (!enabled || countdown === null) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground">
      Auto refresh in {countdown}s
    </p>
  );
}

export default function LiveMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeTab, setActiveTab] = useState<LiveMatchesTab>("live");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<number | undefined>(undefined);
  const hasSavedTabPreference = useRef(false);
  const isFetchInFlight = useRef(false);

  const fetchMatches = useCallback(async (isRefresh = false) => {
    if (isFetchInFlight.current) {
      return;
    }

    isFetchInFlight.current = true;

    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const data = await executeQuery<LiveMatchesResponse>(GET_LIVE_MATCHES);
      const mappedMatches = transformLiveMatches(data.liveMatches);
      setMatches(mappedMatches);

      if (!hasSavedTabPreference.current) {
        const hasLive = mappedMatches.some(
          (match) => match.status === "LIVE" || match.status === "HT"
        );
        const hasFinished = mappedMatches.some((match) => match.status === "FT");
        const hasNotStarted = mappedMatches.some(
          (match) => match.status === "NOT_STARTED"
        );
        const hasUpcoming = mappedMatches.some(
          (match) => match.status === "UPCOMING"
        );

        if (hasLive) {
          setActiveTab("live");
        } else if (hasNotStarted) {
          setActiveTab("not-started");
        } else if (hasFinished) {
          setActiveTab("finished");
        } else if (hasUpcoming) {
          setActiveTab("upcoming");
        } else {
          setActiveTab("live");
        }
      }
    } catch (err) {
      console.error("Failed to fetch live matches:", err);
      setError(err instanceof Error ? err.message : "Failed to load matches");
      setMatches([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      isFetchInFlight.current = false;
    }
  }, []);

  const handleTabChange = (value: string) => {
    if (!isLiveMatchesTab(value)) {
      return;
    }

    setActiveTab(value);
    hasSavedTabPreference.current = true;

    if (typeof window !== "undefined") {
      localStorage.setItem(LIVE_MATCHES_TAB_STORAGE_KEY, value);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem(LIVE_MATCHES_TAB_STORAGE_KEY);
      if (savedTab && isLiveMatchesTab(savedTab)) {
        setActiveTab(savedTab);
        hasSavedTabPreference.current = true;
      }
    }

    fetchMatches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    executeQuery<EventsResponse>(GET_CURRENT_AND_NEXT_EVENTS)
      .then((data) => setEventId(data.current?.[0]?.id))
      .catch(() => {/* silent — eventId stays undefined */});
  }, []);

  const matchesByTab = useMemo(() => {
    return {
      live: matches.filter(
        (match) => match.status === "LIVE" || match.status === "HT"
      ),
      finished: matches
        .filter((match) => match.status === "FT")
        .sort((a, b) => {
          const tA = new Date(a.kickoff || "").getTime();
          const tB = new Date(b.kickoff || "").getTime();
          return (isNaN(tB) ? 1 : 0) - (isNaN(tA) ? 1 : 0) || tB - tA;
        }),
      "not-started": matches.filter((match) => match.status === "NOT_STARTED"),
      upcoming: matches.filter((match) => match.status === "UPCOMING"),
    } satisfies Record<LiveMatchesTab, Match[]>;
  }, [matches]);

  const hasLiveMatches = matchesByTab.live.length > 0;
  const activeTabConfig = TAB_CONFIG.find((config) => config.value === activeTab);
  const activeMatches = matchesByTab[activeTab];

  if (isLoading && !isRefreshing) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Live Matches</h1>
            <Button variant="outline" size="icon" disabled className="shrink-0">
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Refresh matches</span>
            </Button>
          </div>
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading matches...</p>
          </div>
        </div>
      </RootLayout>
    );
  }

  if (error && !isRefreshing) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold">Live Matches</h1>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchMatches(true)}
              disabled={isRefreshing}
              className="shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="sr-only">Refresh matches</span>
            </Button>
          </div>
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-destructive">Error: {error}</p>
            <Button onClick={() => fetchMatches(true)} variant="outline">
              Try Again
            </Button>
          </div>
        </div>
      </RootLayout>
    );
  }

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Live Matches</h1>
          <div className="flex flex-col items-end gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fetchMatches(true)}
              disabled={isRefreshing || isLoading}
              className="shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="sr-only">Refresh matches</span>
            </Button>
            <AutoRefreshCountdown
              enabled={hasLiveMatches}
              onRefresh={() => fetchMatches(true)}
            />
          </div>
        </div>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <div className="bg-card rounded-lg p-4 mb-6 shadow-sm">
            <TabsList className="w-full grid grid-cols-4 gap-2 sm:gap-4">
              <TabsTrigger value="live" className="w-full">
                Live Now
              </TabsTrigger>
              <TabsTrigger value="finished" className="w-full">
                Finished
              </TabsTrigger>
              <TabsTrigger value="not-started" className="w-full">
                Not Started
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="w-full">
                Upcoming
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="space-y-6">
            {activeMatches.length > 0 ? (
              activeMatches.map((match, i) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  allMatches={activeMatches}
                  currentIndex={i}
                  eventId={eventId}
                />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-8">
                {activeTabConfig?.label ?? "No matches available"}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </RootLayout>
  );
}
