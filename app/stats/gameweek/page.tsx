"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TransferList } from "@/components/home/TransferList";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_CURRENT_AND_NEXT_EVENTS,
  GET_EVENT_STATS_BY_ID,
  GET_LIVE_SCORES,
  GET_TOP_TRANSFERS_IN,
  GET_TOP_TRANSFERS_OUT,
  type EventStatsByIdResponse,
  type EventsResponse,
  type LiveScoresResponse,
  type TopTransfer,
  type TopTransfersResponse,
} from "@/lib/graphql/queries";
import { formatCompactNumber } from "@/lib/utils";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  BarChart2,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";

interface OverallGameweekStats {
  averagePoints: number | null;
  highestPoints: number | null;
  mostCaptained: {
    name: string;
    count: number | null;
  };
  mostViceCaptained: {
    name: string;
  };
  mostTransferredIn: {
    name: string;
    team: string;
    count: number | null;
  };
  mostSelectedPlayer: {
    name: string;
    id: number | null;
  };
  mostTransferInPlayer: {
    name: string;
    id: number | null;
  };
  chipsPlayed: {
    benchBoost: number | null;
    tripleCaptain: number | null;
    wildcard: number | null;
    freeHit: number | null;
  } | null;
}

interface DreamTeamPlayer {
  id: number;
  name: string;
  position: string;
  team: string | null;
  points: number;
  price: number | null;
  minutes: number | null;
  stats: {
    goals: number | null;
    assists: number | null;
    cleanSheets: number | null;
    bonusPoints: number | null;
  };
}

interface HaulPlayer {
  id: number;
  name: string;
  position: string;
  team: string | null;
  points: number;
  ownedBy: number | null;
  captainedBy: number | null;
  stats: {
    goals: number | null;
    assists: number | null;
    cleanSheets: number | null;
    bonusPoints: number | null;
  };
}

interface TransferTrend {
  id: number;
  name: string;
  position: string;
  team: string;
  price: number | null;
  priceChange: number | null;
  transferCount: number;
  selectedByPercent: number | null;
  points: number | null;
}

type PositionCode = "GKP" | "DEF" | "MID" | "FWD" | "UNK";

const POSITION_ORDER: Record<PositionCode, number> = {
  GKP: 0,
  DEF: 1,
  MID: 2,
  FWD: 3,
  UNK: 99,
};

const normalizePosition = (position?: string | null): PositionCode => {
  switch (position) {
    case "GKP":
    case "GOALKEEPER":
      return "GKP";
    case "DEF":
    case "DEFENDER":
      return "DEF";
    case "MID":
    case "MIDFIELDER":
      return "MID";
    case "FWD":
    case "FORWARD":
      return "FWD";
    default:
      return "UNK";
  }
};

const FALLBACK_OVERALL_STATS: OverallGameweekStats = {
  averagePoints: null,
  highestPoints: null,
  mostCaptained: { name: "N/A", count: null },
  mostViceCaptained: { name: "N/A" },
  mostTransferredIn: { name: "N/A", team: "N/A", count: null },
  mostSelectedPlayer: { name: "N/A", id: null },
  mostTransferInPlayer: { name: "N/A", id: null },
  chipsPlayed: {
    benchBoost: null,
    tripleCaptain: null,
    wildcard: null,
    freeHit: null,
  },
};

const mapTransferTrend = (entry: TopTransfer, type: "in" | "out"): TransferTrend => ({
  id: entry.player.id,
  name: entry.player.webName,
  position: normalizePosition(entry.player.position),
  team: entry.player.team?.shortName ?? entry.player.team?.name ?? "N/A",
  price: null,
  priceChange: null,
  transferCount: type === "in" ? entry.transfersInEvent : entry.transfersOutEvent,
  selectedByPercent: entry.player.selectedByPercent ?? null,
  points: entry.player.totalPoints ?? null,
});

interface ChipPlayEntry {
  chipName?: string;
  numberPlayed?: number;
}

const parseChipPlays = (value: unknown): ChipPlayEntry[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ChipPlayEntry => typeof item === "object" && item !== null);
};

const chipPlayCount = (chipPlays: ChipPlayEntry[], chipName: string): number | null => {
  const found = chipPlays.find((chip) => chip.chipName === chipName);
  return found?.numberPlayed ?? null;
};

const fetchPlayerNamesByIds = async (ids: number[]): Promise<Record<number, string>> => {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  if (uniqueIds.length === 0) {
    return {};
  }

  const selection = uniqueIds
    .map((id) => `p${id}: player(id: ${id}) { webName }`)
    .join("\n");
  const query = `query GetPlayerNamesByIds {\n${selection}\n}`;
  const data = await executeQuery<Record<string, { webName?: string | null } | null>>(query);

  const result: Record<number, string> = {};
  for (const id of uniqueIds) {
    const key = `p${id}`;
    const value = data[key]?.webName;
    if (typeof value === "string" && value.length > 0) {
      result[id] = value;
    }
  }
  return result;
};

export default function GameweekStatsPage() {
  const [currentGameweek, setCurrentGameweek] = useState<number>(1);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"overall" | "dreamteam" | "haul" | "transfers">("overall");
  const [overallStats, setOverallStats] = useState<OverallGameweekStats>(FALLBACK_OVERALL_STATS);
  const [dreamTeam, setDreamTeam] = useState<DreamTeamPlayer[]>([]);
  const [transferTrends, setTransferTrends] = useState<{ in: TransferTrend[]; out: TransferTrend[] }>({
    in: [],
    out: [],
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overallCacheRef = useRef<Map<number, OverallGameweekStats>>(new Map());
  const dreamCacheRef = useRef<Map<number, DreamTeamPlayer[]>>(new Map());
  const transfersCacheRef = useRef<Map<number, { in: TransferTrend[]; out: TransferTrend[] }>>(new Map());

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setIsBootstrapping(true);
        setError(null);

        const eventsData = await executeQuery<EventsResponse>(GET_CURRENT_AND_NEXT_EVENTS);
        const fetchedCurrentEvent = eventsData.current[0]?.id ?? 1;
        setCurrentGameweek(fetchedCurrentEvent);
        setSelectedGameweek(fetchedCurrentEvent);
      } catch (err) {
        console.error("Failed to bootstrap gameweek stats:", err);
        setError("Failed to load gameweek base data.");
      } finally {
        setIsBootstrapping(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (isBootstrapping) {
      return;
    }

    let cancelled = false;

    const loadGameweekData = async () => {
      try {
        setError(null);

        const shouldLoadDream = activeTab === "dreamteam" || activeTab === "haul";
        const shouldLoadTransfers = activeTab === "transfers";
        const needsDreamFetch = shouldLoadDream && !dreamCacheRef.current.has(selectedGameweek);
        const needsTransfersFetch = shouldLoadTransfers && !transfersCacheRef.current.has(selectedGameweek);
        const shouldLoadDetails = needsDreamFetch || needsTransfersFetch;
        setIsLoadingDetails(shouldLoadDetails);

        const cachedOverall = overallCacheRef.current.get(selectedGameweek);
        if (cachedOverall) {
          setIsLoadingOverall(false);
          if (!cancelled) {
            setOverallStats(cachedOverall);
          }
        } else {
          setIsLoadingOverall(true);
          const eventStatsData = await executeQuery<EventStatsByIdResponse>(
            GET_EVENT_STATS_BY_ID,
            { eventId: selectedGameweek },
          );
          const eventStats = eventStatsData.event ?? null;
          const playerNameMap = await fetchPlayerNamesByIds([
            eventStats?.mostSelected ?? 0,
            eventStats?.mostTransferredIn ?? 0,
            eventStats?.mostCaptained ?? 0,
            eventStats?.mostViceCaptained ?? 0,
          ]);
          const chipPlays = parseChipPlays(eventStats?.chipPlays);
          const overallSnapshot: OverallGameweekStats = {
            averagePoints: eventStats?.averageEntryScore ?? null,
            highestPoints: eventStats?.highestScore ?? null,
            mostCaptained: {
              name: playerNameMap[eventStats?.mostCaptained ?? -1] ?? "N/A",
              count: null,
            },
            mostViceCaptained: {
              name: playerNameMap[eventStats?.mostViceCaptained ?? -1] ?? "N/A",
            },
            mostTransferredIn: { name: "N/A", team: "N/A", count: null },
            mostSelectedPlayer: {
              name: playerNameMap[eventStats?.mostSelected ?? -1] ?? "N/A",
              id: eventStats?.mostSelected ?? null,
            },
            mostTransferInPlayer: {
              name: playerNameMap[eventStats?.mostTransferredIn ?? -1] ?? "N/A",
              id: eventStats?.mostTransferredIn ?? null,
            },
            chipsPlayed: eventStats
              ? {
                  benchBoost: chipPlayCount(chipPlays, "bboost"),
                  tripleCaptain: chipPlayCount(chipPlays, "3xc"),
                  wildcard: chipPlayCount(chipPlays, "wildcard"),
                  freeHit: chipPlayCount(chipPlays, "freehit"),
                }
              : FALLBACK_OVERALL_STATS.chipsPlayed,
          };
          overallCacheRef.current.set(selectedGameweek, overallSnapshot);
          if (!cancelled) {
            setOverallStats(overallSnapshot);
          }
          setIsLoadingOverall(false);
        }

        if (shouldLoadDream) {
          const cachedDream = dreamCacheRef.current.get(selectedGameweek);
          if (cachedDream) {
            if (!cancelled) {
              setDreamTeam(cachedDream);
            }
          } else {
            const liveScoresData = await executeQuery<LiveScoresResponse>(GET_LIVE_SCORES, {
              eventId: selectedGameweek,
            });
            const mappedDreamTeam: DreamTeamPlayer[] = liveScoresData.liveScores
              .filter((entry) => entry.inDreamTeam)
              .map((entry) => ({
                id: entry.player.id,
                name: entry.player.webName,
                position: normalizePosition(entry.player.position),
                team: entry.player.team?.shortName ?? entry.player.team?.name ?? null,
                points: entry.totalPoints,
                price: entry.player.price ?? null,
                minutes: entry.minutes ?? null,
                stats: {
                  goals: entry.goalsScored ?? null,
                  assists: entry.assists ?? null,
                  cleanSheets: entry.cleanSheets ?? null,
                  bonusPoints: entry.bonus ?? null,
                },
              }))
              .sort((a, b) => {
                const positionDiff =
                  POSITION_ORDER[a.position as PositionCode] - POSITION_ORDER[b.position as PositionCode];
                return positionDiff !== 0 ? positionDiff : b.points - a.points;
              });
            dreamCacheRef.current.set(selectedGameweek, mappedDreamTeam);
            if (!cancelled) {
              setDreamTeam(mappedDreamTeam);
            }
          }
        }

        if (shouldLoadTransfers) {
          const cachedTransfers = transfersCacheRef.current.get(selectedGameweek);
          if (cachedTransfers) {
            if (!cancelled) {
              setTransferTrends(cachedTransfers);
            }
          } else {
            const [inData, outData] = await Promise.all([
              executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_IN, {
                eventId: selectedGameweek,
                limit: 5,
              }),
              executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_OUT, {
                eventId: selectedGameweek,
                limit: 5,
              }),
            ]);
            const transferIn = (inData.topTransfersIn ?? []).map((entry) => mapTransferTrend(entry, "in"));
            const transferOut = (outData.topTransfersOut ?? []).map((entry) => mapTransferTrend(entry, "out"));
            const transferSnapshot = { in: transferIn, out: transferOut };
            transfersCacheRef.current.set(selectedGameweek, transferSnapshot);
            if (!cancelled) {
              setTransferTrends(transferSnapshot);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load selected gameweek stats:", err);
        if (!cancelled) {
          setError("Failed to load selected gameweek data.");
          if (activeTab === "dreamteam" || activeTab === "haul") {
            setDreamTeam([]);
          }
          if (activeTab === "transfers") {
            setTransferTrends({ in: [], out: [] });
          }
          setOverallStats(FALLBACK_OVERALL_STATS);
          setIsLoadingOverall(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetails(false);
          setIsLoadingOverall(false);
        }
      }
    };

    void loadGameweekData();
    return () => {
      cancelled = true;
    };
  }, [activeTab, isBootstrapping, selectedGameweek]);

  const haulPlayers = useMemo<HaulPlayer[]>(
    () =>
      dreamTeam
        .filter((player) => player.points >= 10)
        .map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          points: player.points,
          ownedBy: null,
          captainedBy: null,
          stats: player.stats,
        }))
        .sort((a, b) => b.points - a.points),
    [dreamTeam],
  );

  const formatStat = (value: number | null, fallbackTip = "Pending official update") =>
    typeof value === "number" ? String(value) : fallbackTip;
  const formatCount = (value: number | null, fallbackTip = "Not provided yet") =>
    typeof value === "number" ? formatCompactNumber(value) : fallbackTip;

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Gameweek Stats</h1>

        {error && (
          <Card className="p-4 mb-6 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        <div className="mb-6">
          <GameweekSelector
            onGameweekChange={setSelectedGameweek}
            currentGameweek={currentGameweek}
            selectedGameweek={selectedGameweek}
            disabled={isBootstrapping}
          />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="overall">
              <BarChart2 className="h-4 w-4 mr-2" />
              Overall
            </TabsTrigger>
            <TabsTrigger value="dreamteam">
              <Trophy className="h-4 w-4 mr-2" />
              Dream Team
            </TabsTrigger>
            <TabsTrigger value="haul">
              <Star className="h-4 w-4 mr-2" />
              Haul
            </TabsTrigger>
            <TabsTrigger value="transfers">
              <TrendingUp className="h-4 w-4 mr-2" />
              Transfers
            </TabsTrigger>
          </TabsList>
          
          {/* Overall Tab Content */}
          <TabsContent value="overall">
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Gameweek {selectedGameweek} Overview
              </h2>
              {isLoadingOverall && (
                <p className="text-xs text-muted-foreground mb-3">Loading overview...</p>
              )}

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-6">
                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Average Points</h3>
                    <div className="text-2xl font-bold">
                      {formatStat(overallStats.averagePoints, "Awaiting event aggregation")}
                    </div>
                  </div>

                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Highest Points</h3>
                    <div className="text-2xl font-bold">{formatStat(overallStats.highestPoints)}</div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Most Captained</h3>
                    <div className="text-xl font-bold mb-1">{overallStats.mostCaptained.name}</div>
                  </div>

                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Most Vice-Captained</h3>
                    <div className="text-xl font-bold mb-1">{overallStats.mostViceCaptained.name}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    Most Selected Player
                  </h3>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-full">
                        <ArrowRightCircle className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div>
                        <div className="text-xl font-bold mb-1">{overallStats.mostSelectedPlayer.name}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-rose-500" />
                    Most Transferred-In Player
                  </h3>
                  <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-100 dark:bg-rose-900/30 p-2.5 rounded-full">
                        <ArrowLeftCircle className="h-6 w-6 text-rose-500" />
                      </div>
                      <div>
                        <div className="text-xl font-bold mb-1">{overallStats.mostTransferInPlayer.name}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Chips Played
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-blue-600 mb-1">Bench Boost</div>
                  <div className="text-2xl font-bold">
                    {formatCount(overallStats.chipsPlayed?.benchBoost ?? null, "No chip usage reported")}
                  </div>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-emerald-600 mb-1">Triple Captain</div>
                  <div className="text-2xl font-bold">
                    {formatCount(overallStats.chipsPlayed?.tripleCaptain ?? null, "No chip usage reported")}
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-purple-600 mb-1">Wildcard</div>
                  <div className="text-2xl font-bold">
                    {formatCount(overallStats.chipsPlayed?.wildcard ?? null, "No chip usage reported")}
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-amber-600 mb-1">Free Hit</div>
                  <div className="text-2xl font-bold">
                    {formatCount(overallStats.chipsPlayed?.freeHit ?? null, "No chip usage reported")}
                  </div>
                </div>
              </div>
            </Card>

          </TabsContent>

          {/* Dream Team Tab Content */}
          <TabsContent value="dreamteam">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Gameweek {selectedGameweek} Dream Team
              </h2>

              {isLoadingDetails ? (
                <div className="text-sm text-muted-foreground">Loading dream team...</div>
              ) : dreamTeam.length === 0 ? (
                <div className="text-sm text-muted-foreground">No dream team data available.</div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden bg-card/40">
                  <div>
                    {dreamTeam.map((player, index) => (
                      <div
                        key={player.id}
                        className={`grid grid-cols-[1.3fr_0.8fr_0.7fr] gap-1.5 px-4 py-3 items-center ${
                          index % 2 === 0 ? "bg-background/60" : "bg-background/20"
                        }`}
                      >
                        <span className="font-medium">{player.name}</span>
                        <div className="text-center">
                          <Badge variant="outline" className="min-w-12 justify-center">
                            {player.team ?? "N/A"}
                          </Badge>
                        </div>
                        <div className="text-center">
                          <Badge variant="secondary" className="min-w-11 justify-center">
                            {player.position}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Haul Tab Content */}
          <TabsContent value="haul">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                Double-digit Hauls
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Live player hauls from Dream Team performances in this gameweek.
              </p>

              {isLoadingDetails ? (
                <div className="text-sm text-muted-foreground">Loading haul data...</div>
              ) : haulPlayers.length === 0 ? (
                <div className="text-sm text-muted-foreground">No double-digit hauls for this gameweek yet.</div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden bg-card/40">
                  {haulPlayers.map((player, index) => (
                    <div
                      key={player.id}
                      className={`grid grid-cols-[1.3fr_0.8fr_0.7fr_0.5fr] gap-1.5 px-4 py-3 items-center ${
                        index % 2 === 0 ? "bg-background/60" : "bg-background/20"
                      }`}
                    >
                      <span className="font-medium">{player.name}</span>
                      <div className="text-center">
                        <Badge variant="outline" className="min-w-12 justify-center">
                          {player.team ?? "N/A"}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <Badge variant="secondary" className="min-w-11 justify-center">
                          {player.position}
                        </Badge>
                      </div>
                      <span className="text-right font-bold text-primary">{player.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Transfer Trends Tab Content */}
          <TabsContent value="transfers">
            {isLoadingDetails ? (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">Loading transfer trends...</p>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="space-y-6">
                  <TransferList
                    title="Top Transfers In"
                    type="in"
                    transfers={transferTrends.in.map((trend) => ({
                      position: trend.position,
                      player: trend.name,
                      club: trend.team,
                      transfers: trend.transferCount,
                      selectedByPercent: trend.selectedByPercent,
                      points: trend.points,
                    }))}
                  />
                  <TransferList
                    title="Top Transfers Out"
                    type="out"
                    transfers={transferTrends.out.map((trend) => ({
                      position: trend.position,
                      player: trend.name,
                      club: trend.team,
                      transfers: trend.transferCount,
                      selectedByPercent: trend.selectedByPercent,
                      points: trend.points,
                    }))}
                  />
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
        {isLoadingDetails && (
          <p className="text-xs text-muted-foreground mt-4">Refreshing gameweek data...</p>
        )}
      </div>
    </RootLayout>
  );
}