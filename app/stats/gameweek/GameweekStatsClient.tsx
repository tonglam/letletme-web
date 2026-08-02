"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageShell from "@/components/layout/PageShell";
import { Card } from "@/components/ui/card";
import { PlayerList } from "@/components/player/PlayerList";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransferList } from "@/components/home/TransferList";
import { executeQuery } from "@/lib/graphql-client";
import {
	GET_LIVE_SCORES,
	type LiveScoresResponse,
} from "@/lib/graphql/operations/live";
import {
	GET_TOP_TRANSFERS_IN,
	GET_TOP_TRANSFERS_OUT,
	type TopTransfer,
	type TopTransfersResponse,
} from "@/lib/graphql/operations/prices";
import {
  FALLBACK_OVERALL_STATS,
  fetchOverallGameweekStats,
  type OverallGameweekStats,
} from "@/lib/gameweek-overall-stats";
import { normalizePosition, type PositionCode } from "@/lib/utils";
import {
  ArrowLeftCircle,
  ArrowRightCircle,
  BarChart2,
  Star,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

interface DreamTeamPlayer {
  id: number;
  name: string;
  position: string;
  team: string | null;
  points: number;
  price: number | null;
  minutes: number | null;
  stats: { goals: number | null; assists: number | null; cleanSheets: number | null; bonusPoints: number | null };
}

interface HaulPlayer {
  id: number;
  name: string;
  position: string;
  team: string | null;
  points: number;
  ownedBy: number | null;
  captainedBy: number | null;
  stats: { goals: number | null; assists: number | null; cleanSheets: number | null; bonusPoints: number | null };
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

const POSITION_ORDER: Record<PositionCode, number> = { GKP: 0, DEF: 1, MID: 2, FWD: 3, UNK: 99 };

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

interface GameweekStatsClientProps {
  currentGameweek: number;
  initialOverallStats?: OverallGameweekStats | null;
}

export default function GameweekStatsClient({
  currentGameweek: initialCurrentGameweek,
  initialOverallStats = null,
}: GameweekStatsClientProps) {
  const t = useTranslations("GameweekStats");
  const formatter = useFormatter();
  const [currentGameweek] = useState<number>(initialCurrentGameweek);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(initialCurrentGameweek);
  const [activeTab, setActiveTab] = useState<"overall" | "dreamteam" | "haul" | "transfers">("overall");
  const [overallStats, setOverallStats] = useState<OverallGameweekStats>(
    initialOverallStats ?? FALLBACK_OVERALL_STATS,
  );
  const [dreamTeam, setDreamTeam] = useState<DreamTeamPlayer[]>([]);
  const [transferTrends, setTransferTrends] = useState<{ in: TransferTrend[]; out: TransferTrend[] }>({ in: [], out: [] });
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingOverall, setIsLoadingOverall] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overallCacheRef = useRef<Map<number, OverallGameweekStats>>(
    new Map(initialOverallStats && initialCurrentGameweek ? [[initialCurrentGameweek, initialOverallStats]] : []),
  );
  const dreamCacheRef = useRef<Map<number, DreamTeamPlayer[]>>(new Map());
  const transfersCacheRef = useRef<Map<number, { in: TransferTrend[]; out: TransferTrend[] }>>(new Map());

  useEffect(() => {
    let cancelled = false;

    const loadGameweekData = async () => {
      try {
        setError(null);

        const shouldLoadDream = activeTab === "dreamteam" || activeTab === "haul";
        const shouldLoadTransfers = activeTab === "transfers";
        const needsDreamFetch = shouldLoadDream && !dreamCacheRef.current.has(selectedGameweek);
        const needsTransfersFetch = shouldLoadTransfers && !transfersCacheRef.current.has(selectedGameweek);
        setIsLoadingDetails(needsDreamFetch || needsTransfersFetch);

        const cachedOverall = overallCacheRef.current.get(selectedGameweek);
        if (cachedOverall) {
          setIsLoadingOverall(false);
          if (!cancelled) setOverallStats(cachedOverall);
        } else {
          setIsLoadingOverall(true);
          const overallSnapshot = await fetchOverallGameweekStats(selectedGameweek);
          overallCacheRef.current.set(selectedGameweek, overallSnapshot);
          if (!cancelled) setOverallStats(overallSnapshot);
          setIsLoadingOverall(false);
        }

        if (shouldLoadDream) {
          const cachedDream = dreamCacheRef.current.get(selectedGameweek);
          if (cachedDream) {
            if (!cancelled) setDreamTeam(cachedDream);
          } else {
            const liveScoresData = await executeQuery<LiveScoresResponse>(GET_LIVE_SCORES, { eventId: selectedGameweek });
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
                const positionDiff = POSITION_ORDER[a.position as PositionCode] - POSITION_ORDER[b.position as PositionCode];
                return positionDiff !== 0 ? positionDiff : b.points - a.points;
              });
            dreamCacheRef.current.set(selectedGameweek, mappedDreamTeam);
            if (!cancelled) setDreamTeam(mappedDreamTeam);
          }
        }

        if (shouldLoadTransfers) {
          const cachedTransfers = transfersCacheRef.current.get(selectedGameweek);
          if (cachedTransfers) {
            if (!cancelled) setTransferTrends(cachedTransfers);
          } else {
            const [inData, outData] = await Promise.all([
              executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_IN, { eventId: selectedGameweek, limit: 5 }),
              executeQuery<TopTransfersResponse>(GET_TOP_TRANSFERS_OUT, { eventId: selectedGameweek, limit: 5 }),
            ]);
            const transferSnapshot = {
              in: (inData.topTransfersIn ?? []).map((entry) => mapTransferTrend(entry, "in")),
              out: (outData.topTransfersOut ?? []).map((entry) => mapTransferTrend(entry, "out")),
            };
            transfersCacheRef.current.set(selectedGameweek, transferSnapshot);
            if (!cancelled) setTransferTrends(transferSnapshot);
          }
        }
      } catch (err) {
        console.error("Failed to load selected gameweek stats:", err);
        if (!cancelled) {
          setError(t("loadFailed"));
          if (activeTab === "dreamteam" || activeTab === "haul") setDreamTeam([]);
          if (activeTab === "transfers") setTransferTrends({ in: [], out: [] });
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
    return () => { cancelled = true; };
  }, [activeTab, initialCurrentGameweek, selectedGameweek, t]);

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

  const formatStat = (value: number | null, fallbackTip = t("pendingOfficial")) =>
    typeof value === "number" ? String(value) : fallbackTip;
  const formatCount = (value: number | null, fallbackTip = t("notProvided")) =>
    typeof value === "number" ? formatter.number(value, { notation: "compact" }) : fallbackTip;
  const displayName = (name: string) => name === "N/A" ? t("notAvailable") : name;

  return (
    <PageShell>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">{t("title")}</h1>

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
          />
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="space-y-6">
          <TabsList className="w-full grid grid-cols-4 mb-4">
            <TabsTrigger value="overall"><BarChart2 className="h-4 w-4 mr-2" />{t("overall")}</TabsTrigger>
            <TabsTrigger value="dreamteam"><Trophy className="h-4 w-4 mr-2" />{t("dreamTeam")}</TabsTrigger>
            <TabsTrigger value="haul"><Star className="h-4 w-4 mr-2" />{t("haul")}</TabsTrigger>
            <TabsTrigger value="transfers"><TrendingUp className="h-4 w-4 mr-2" />{t("transfers")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overall">
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary-ink" />
                {t("overview", { gameweek: selectedGameweek })}
              </h2>
              {isLoadingOverall && <p className="text-xs text-muted-foreground mb-3">{t("loadingOverview")}</p>}

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="space-y-6">
                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("averagePoints")}</h3>
                    <div className="text-2xl font-bold">{formatStat(overallStats.averagePoints, t("awaitingAggregation"))}</div>
                  </div>
                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("highestPoints")}</h3>
                    <div className="text-2xl font-bold">{formatStat(overallStats.highestPoints)}</div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("mostCaptained")}</h3>
                    <div className="text-xl font-bold mb-1">{displayName(overallStats.mostCaptained.name)}</div>
                  </div>
                  <div className="bg-accent/30 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">{t("mostViceCaptained")}</h3>
                    <div className="text-xl font-bold mb-1">{displayName(overallStats.mostViceCaptained.name)}</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                    {t("mostSelected")}
                  </h3>
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2.5 rounded-full">
                        <ArrowRightCircle className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div className="text-xl font-bold mb-1">{displayName(overallStats.mostSelectedPlayer.name)}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <TrendingDown className="h-5 w-5 text-rose-500" />
                    {t("mostTransferredIn")}
                  </h3>
                  <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="bg-rose-100 dark:bg-rose-900/30 p-2.5 rounded-full">
                        <ArrowLeftCircle className="h-6 w-6 text-rose-500" />
                      </div>
                      <div className="text-xl font-bold mb-1">{displayName(overallStats.mostTransferInPlayer.name)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                {t("chipsPlayed")}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-blue-600 mb-1">{t("benchBoost")}</div>
                  <div className="text-2xl font-bold">{formatCount(overallStats.chipsPlayed?.benchBoost ?? null, t("noChipUsage"))}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-emerald-600 mb-1">{t("tripleCaptain")}</div>
                  <div className="text-2xl font-bold">{formatCount(overallStats.chipsPlayed?.tripleCaptain ?? null, t("noChipUsage"))}</div>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-purple-600 mb-1">{t("wildcard")}</div>
                  <div className="text-2xl font-bold">{formatCount(overallStats.chipsPlayed?.wildcard ?? null, t("noChipUsage"))}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg">
                  <div className="font-bold text-lg text-amber-600 mb-1">{t("freeHit")}</div>
                  <div className="text-2xl font-bold">{formatCount(overallStats.chipsPlayed?.freeHit ?? null, t("noChipUsage"))}</div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="dreamteam">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                {t("dreamTeamTitle", { gameweek: selectedGameweek })}
              </h2>
              {isLoadingDetails ? (
                <div className="text-sm text-muted-foreground">{t("loadingDreamTeam")}</div>
              ) : dreamTeam.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("noDreamTeam")}</div>
              ) : (
                <PlayerList players={dreamTeam} />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="haul">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                {t("doubleDigitHauls")}
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t("haulDescription")}
              </p>
              {isLoadingDetails ? (
                <div className="text-sm text-muted-foreground">{t("loadingHauls")}</div>
              ) : haulPlayers.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t("noHauls")}</div>
              ) : (
                <PlayerList players={haulPlayers} />
              )}
            </Card>
          </TabsContent>

          <TabsContent value="transfers">
            {isLoadingDetails ? (
              <Card className="p-6">
                <p className="text-sm text-muted-foreground">{t("loadingTransfers")}</p>
              </Card>
            ) : (
              <Card className="p-6">
                <div className="space-y-6">
                  <TransferList
                    title={t("topTransfersIn")}
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
                    title={t("topTransfersOut")}
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
          <p className="text-xs text-muted-foreground mt-4">{t("refreshing")}</p>
        )}
      </div>
    </PageShell>
  );
}
