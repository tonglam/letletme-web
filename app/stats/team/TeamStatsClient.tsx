"use client";

import { useSession } from "@/lib/auth-client";
import { useEffect, useState } from "react";
import RootLayout from "@/components/layout/RootLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsTable } from "@/components/data/StatsTable";
import { GameweekSelector } from "@/components/data/GameweekSelector";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_ENTRY_EVENT_RESULT,
  GET_ENTRY_HISTORY,
  GET_ENTRY_TRANSFER_HISTORY,
  type EntryGameweekTransfers,
  type EntryEventResult,
  type EntryEventResultResponse,
  type EntryHistoryItem,
  type EntrySeasonHistoryItem,
  type EntryHistoryResponse,
  type EntryTransferHistoryResponse,
} from "@/lib/graphql/queries";
import {
  ArrowRightLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Star,
  Users,
} from "lucide-react";

interface EventPickViewModel {
  position: number;
  webName: string;
  teamShortName: string;
  teamName: string;
  elementTypeName: string;
  isCaptain: boolean;
  isViceCaptain: boolean;
  minutes: number;
  totalPoints: number;
  multiplier: number;
}

interface TeamStatsViewModel {
  teamName: string;
  playerName: string;
  region: string;
  teamValue: number | null;
  bank: number | null;
  totalTransfers: number | null;
  eventId: number;
  eventName: string;
  eventPoints: number;
  overallPoints: number;
  overallRank: number;
  eventTransfers: number;
  eventTransfersCost: number;
  eventNetPoints: number;
  eventChip: string;
  eventBenchPoints: number;
  eventPlayedCaptainName: string;
  eventCaptainPoints: number;
  eventPicks: EventPickViewModel[];
  historyRows: Array<{
    gameweek: string;
    eventPoints: number;
    eventNetPoints: number;
    eventRank: number | null;
    overallPoints: number;
    overallRank: number;
    eventTransfers: number;
    eventTransfersCost: number;
    teamValue: number | null;
    bank: number | null;
  }>;
  seasonHistoryRows: Array<{
    seasonOrder: string;
    season: string;
    totalPoints: number;
    overallRank: number;
  }>;
  chipUsageRows: Array<{
    gameweek: string;
    chip: string;
  }>;
  chipCounts: Array<{
    chip: string;
    count: number;
  }>;
  transferRows: Array<{
    gameweek: string;
    transfers: number;
    cost: number;
    hasTransferDetails: boolean;
    moves: Array<{
      inName: string;
      inTeam: string;
      inCost: number;
      outName: string;
      outTeam: string;
      outCost: number;
    }>;
  }>;
}

const mapApiDataToTeamStats = (
  entryEventResult: EntryEventResult,
  entryHistoryResults: EntryHistoryItem[],
  entrySeasonHistory: EntrySeasonHistoryItem[],
  entryTransferHistory: EntryGameweekTransfers[],
): TeamStatsViewModel => {
  const transferByEvent = new Map<number, EntryGameweekTransfers>();
  entryTransferHistory.forEach((item) => {
    transferByEvent.set(item.eventId, item);
  });

  return {
    teamName: entryEventResult.entry.entryName,
    playerName: entryEventResult.entry.playerName ?? "-",
    region: entryEventResult.entry.region ?? "-",
    teamValue: entryEventResult.teamValue,
    bank: entryEventResult.bank,
    totalTransfers: entryEventResult.entry.totalTransfers,
    eventId: entryEventResult.eventId,
    eventName: `Gameweek ${entryEventResult.eventId}`,
    eventPoints: entryEventResult.eventPoints,
    overallPoints: entryEventResult.overallPoints,
    overallRank: entryEventResult.overallRank,
    eventTransfers: entryEventResult.eventTransfers,
    eventTransfersCost: entryEventResult.eventTransfersCost,
    eventNetPoints: entryEventResult.eventNetPoints,
    eventChip: entryEventResult.eventChip,
    eventBenchPoints: entryEventResult.eventBenchPoints,
    eventPlayedCaptainName: entryEventResult.eventPlayedCaptain?.webName ?? "-",
    eventCaptainPoints: entryEventResult.eventCaptainPoints,
    eventPicks: (() => {
      const posOrder: Record<string, number> = { GKP: 1, DEF: 2, MID: 3, FWD: 4 };
      return [...entryEventResult.eventPicks].sort((a, b) => {
        const aBench = a.multiplier === 0 ? 1 : 0;
        const bBench = b.multiplier === 0 ? 1 : 0;
        if (aBench !== bBench) return aBench - bBench;
        return (posOrder[a.elementTypeName] ?? 5) - (posOrder[b.elementTypeName] ?? 5);
      });
    })(),
    historyRows: [...entryHistoryResults]
      .sort((a, b) => b.eventId - a.eventId)
      .map((item) => ({
        gameweek: String(item.eventId),
        eventPoints: item.eventPoints,
        eventNetPoints: item.eventNetPoints,
        eventRank: item.eventRank,
        overallPoints: item.overallPoints,
        overallRank: item.overallRank,
        eventTransfers: item.eventTransfers,
        eventTransfersCost: item.eventTransfersCost,
        teamValue: item.teamValue,
        bank: item.bank,
      })),
    seasonHistoryRows: [...entrySeasonHistory]
      .map((item, index) => ({
        seasonOrder: toOrdinal(index + 1),
        season: item.season,
        totalPoints: item.totalPoints,
        overallRank: item.overallRank,
      })),
    chipUsageRows: [...entryHistoryResults]
      .filter((item) => item.eventChip !== "NONE")
      .sort((a, b) => b.eventId - a.eventId)
      .map((item) => ({
        gameweek: String(item.eventId),
        chip: item.eventChip,
      })),
    chipCounts: Object.entries(
      entryHistoryResults.reduce<Record<string, number>>((acc, item) => {
        if (item.eventChip !== "NONE") {
          acc[item.eventChip] = (acc[item.eventChip] ?? 0) + 1;
        }
        return acc;
      }, {}),
    )
      .map(([chip, count]) => ({ chip, count }))
      .sort((a, b) => b.count - a.count),
    transferRows: [...entryHistoryResults]
      .sort((a, b) => b.eventId - a.eventId)
      .map((item) => {
        const transferInfo = transferByEvent.get(item.eventId);
        return {
          gameweek: String(item.eventId),
          transfers: item.eventTransfers,
          cost: item.eventTransfersCost,
          hasTransferDetails: Boolean(transferInfo && transferInfo.transfers.length > 0),
          moves: transferInfo?.transfers.map((transfer) => ({
            inName: transfer.elementInWebName,
            inTeam: transfer.elementInTeamShortName,
            inCost: transfer.elementInCost,
            outName: transfer.elementOutWebName,
            outTeam: transfer.elementOutTeamShortName,
            outCost: transfer.elementOutCost,
          })) ?? [],
        };
      }),
  };
};

const formatCompact = (value: number): string => {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(value);
};

const formatMoney = (value: number | null): string => {
  if (value === null) return "-";
  return `£${(value / 10).toFixed(1)}m`;
};

const formatPlayerValue = (value: number): string => {
  return `£${(value / 10).toFixed(1)}m`;
};

const toOrdinal = (value: number): string => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
};

const getGraphQLEndpointForClient = (): string => {
  if (process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT) {
    return process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/graphql`;
  }
  return "/api/graphql";
};

const fetchTransferHistorySafely = async (entryId: number): Promise<EntryGameweekTransfers[]> => {
  try {
    const endpoint = getGraphQLEndpointForClient();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ query: GET_ENTRY_TRANSFER_HISTORY, variables: { entryId } }),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as { data?: EntryTransferHistoryResponse; errors?: unknown };
    if (payload.errors) return [];
    return payload.data?.entryTransferHistory ?? [];
  } catch {
    return [];
  }
};

const entryEventCache = new Map<string, EntryEventResult | null>();
const entryEventInFlightCache = new Map<string, Promise<EntryEventResult | null>>();
const entryHistoryCache = new Map<number, EntryHistoryResponse["entryHistory"]>();
const entryHistoryInFlight = new Map<number, Promise<EntryHistoryResponse["entryHistory"]>>();
const transferHistoryCache = new Map<number, EntryGameweekTransfers[]>();
const transferHistoryInFlight = new Map<number, Promise<EntryGameweekTransfers[]>>();

const entryEventCacheKey = (entryId: number, eventId: number): string =>
  `${entryId}:${eventId}`;

const getEntryHistoryCached = async (entryId: number): Promise<EntryHistoryResponse["entryHistory"]> => {
  if (entryHistoryCache.has(entryId)) return entryHistoryCache.get(entryId)!;
  const inflight = entryHistoryInFlight.get(entryId);
  if (inflight) return inflight;
  const request = executeQuery<EntryHistoryResponse>(GET_ENTRY_HISTORY, { entryId }, { cache: "force-cache" })
    .then((response) => { entryHistoryCache.set(entryId, response.entryHistory); return response.entryHistory; })
    .finally(() => { entryHistoryInFlight.delete(entryId); });
  entryHistoryInFlight.set(entryId, request);
  return request;
};

const getEntryEventResultCached = async (entryId: number, eventId: number): Promise<EntryEventResult | null> => {
  const cacheKey = entryEventCacheKey(entryId, eventId);
  if (entryEventCache.has(cacheKey)) return entryEventCache.get(cacheKey) ?? null;
  const cachedInFlight = entryEventInFlightCache.get(cacheKey);
  if (cachedInFlight) return cachedInFlight;
  const request = executeQuery<EntryEventResultResponse>(GET_ENTRY_EVENT_RESULT, { eventId, entryId }, { cache: "force-cache" })
    .then((response) => {
      const result = response.entryEventResult ?? null;
      entryEventCache.set(cacheKey, result);
      return result;
    })
    .finally(() => { entryEventInFlightCache.delete(cacheKey); });
  entryEventInFlightCache.set(cacheKey, request);
  return request;
};

const getNoDataMessage = (selectedEventId: number): string =>
  `No team stats available for Gameweek ${selectedEventId}.`;

const getTransferHistoryCached = async (entryId: number): Promise<EntryGameweekTransfers[]> => {
  if (transferHistoryCache.has(entryId)) return transferHistoryCache.get(entryId)!;
  const inflight = transferHistoryInFlight.get(entryId);
  if (inflight) return inflight;
  const request = fetchTransferHistorySafely(entryId)
    .then((response) => { transferHistoryCache.set(entryId, response); return response; })
    .finally(() => { transferHistoryInFlight.delete(entryId); });
  transferHistoryInFlight.set(entryId, request);
  return request;
};

type TeamStatsTab = "squad" | "transfer" | "history" | "chips";

const isTeamStatsTab = (value: string): value is TeamStatsTab =>
  value === "squad" || value === "transfer" || value === "history" || value === "chips";

interface TeamStatsClientProps {
  currentGameweek: number;
}

export default function TeamStatsClient({ currentGameweek: initialCurrentGameweek }: TeamStatsClientProps) {
  const { data: sessionData } = useSession();
  const entryId = sessionData?.user?.fplEntryId ?? 0;

  const [currentGameweek, setCurrentGameweek] = useState<number>(initialCurrentGameweek);
  const [selectedGameweek, setSelectedGameweek] = useState<number>(initialCurrentGameweek);
  const [activeTab, setActiveTab] = useState<TeamStatsTab>("squad");
  const [teamStats, setTeamStats] = useState<TeamStatsViewModel | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [emptyStateMessage, setEmptyStateMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadTeamStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setEmptyStateMessage(null);
        const historyRequired = activeTab === "history" || activeTab === "chips" || activeTab === "transfer";
        const entryHistory = historyRequired ? await getEntryHistoryCached(entryId) : null;

        if (entryHistory) {
          const latestEventId = entryHistory.results.reduce(
            (maxEventId, item) => Math.max(maxEventId, item.eventId),
            1,
          );
          setCurrentGameweek(latestEventId);
        }

        const entryEventResult = await getEntryEventResultCached(entryId, selectedGameweek);

        if (!entryEventResult) {
          setTeamStats(null);
          setEmptyStateMessage(getNoDataMessage(selectedGameweek));
          return;
        }

        const entryTransferHistory =
          activeTab === "transfer" ? await getTransferHistoryCached(entryId) : null;

        setTeamStats(
          mapApiDataToTeamStats(
            entryEventResult,
            entryHistory?.results ?? [],
            entryHistory?.history ?? [],
            entryTransferHistory ?? [],
          ),
        );
      } catch (loadError) {
        console.error("Failed to load team stats:", loadError);
        setError("Failed to load team stats from API.");
        setTeamStats(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadTeamStats();
  }, [activeTab, selectedGameweek, entryId]);

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">My Team Stats</h1>

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
            disabled={isLoading}
          />
        </div>

        {!teamStats ? (
          <Card className="p-6">
            <p className="text-muted-foreground">
              {isLoading
                ? "Loading team stats..."
                : emptyStateMessage ?? "No team stats available."}
            </p>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold">{teamStats.teamName}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>{teamStats.playerName}</span>
                    <span aria-hidden="true">•</span>
                    <span>{teamStats.region}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Team Value</p>
                  <p className="text-2xl font-bold">
                    {teamStats.teamValue === null ? "-" : `£${(teamStats.teamValue / 10).toFixed(1)}m`}
                  </p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Bank</p>
                  <p className="text-2xl font-bold">
                    {teamStats.bank === null ? "-" : `£${(teamStats.bank / 10).toFixed(1)}m`}
                  </p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Transfers</p>
                  <p className="text-2xl font-bold">
                    {teamStats.totalTransfers === null ? "-" : teamStats.totalTransfers}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Overall Points</p>
                  <p className="text-2xl font-bold">{teamStats.overallPoints}</p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Overall Rank</p>
                  <p className="text-2xl font-bold">£{formatCompact(teamStats.overallRank)}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6 mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Event Points</p>
                  <p className="text-2xl font-bold">{teamStats.eventPoints}</p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Transfer Cost</p>
                  <p className="text-2xl font-bold">
                    {teamStats.eventTransfersCost > 0 ? `-${teamStats.eventTransfersCost}` : "0"}
                  </p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Net Points</p>
                  <p className="text-2xl font-bold">{teamStats.eventNetPoints}</p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Event Transfers</p>
                  <p className="text-2xl font-bold">{teamStats.eventTransfers}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Event Chip</p>
                  <p className="text-base font-semibold">{teamStats.eventChip}</p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Bench Points</p>
                  <p className="text-2xl font-bold">{teamStats.eventBenchPoints}</p>
                </div>
                <div className="bg-accent/30 p-4 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">Played Captain</p>
                  <p className="text-base font-semibold">
                    {teamStats.eventPlayedCaptainName} ({teamStats.eventCaptainPoints})
                  </p>
                </div>
              </div>
            </Card>

            <Tabs
              value={activeTab}
              onValueChange={(value) => {
                if (isTeamStatsTab(value)) setActiveTab(value);
              }}
              className="space-y-6"
            >
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="squad">
                  <Users className="h-4 w-4 mr-2" />
                  Squad
                </TabsTrigger>
                <TabsTrigger value="transfer">
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer
                </TabsTrigger>
                <TabsTrigger value="chips">
                  <Star className="h-4 w-4 mr-2" />
                  Chips
                </TabsTrigger>
                <TabsTrigger value="history">
                  <Calendar className="h-4 w-4 mr-2" />
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="squad">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Picks</h2>
                  <div className="overflow-hidden rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead className="text-center">Position</TableHead>
                          <TableHead className="text-center">Min</TableHead>
                          <TableHead className="text-center">Pts</TableHead>
                          <TableHead className="text-right">Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamStats.eventPicks.map((pick) => {
                          const isBench = pick.multiplier === 0;
                          const played = pick.minutes > 0;
                          return (
                            <TableRow
                              key={`${pick.position}-${pick.webName}`}
                              className={
                                isBench
                                  ? "bg-muted/30 hover:bg-muted/40"
                                  : played
                                  ? "bg-blue-500/10 hover:bg-blue-500/15"
                                  : ""
                              }
                            >
                              <TableCell>
                                <div className="min-w-[180px]">
                                  <p className="font-medium leading-5">
                                    {pick.webName}
                                    {pick.isCaptain ? " (c)" : ""}
                                    {pick.isViceCaptain ? " (vc)" : ""}
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">{pick.teamName}</p>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    pick.elementTypeName === "GKP"
                                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                      : pick.elementTypeName === "DEF"
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                      : pick.elementTypeName === "MID"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                      : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                                  }`}
                                >
                                  {pick.elementTypeName}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="inline-flex items-center justify-center gap-1">
                                  {played ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                  ) : (
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  {pick.minutes}
                                </span>
                              </TableCell>
                              <TableCell className="text-center font-bold">
                                <span className={pick.totalPoints > 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>
                                  {pick.totalPoints}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isBench
                                      ? "bg-muted text-muted-foreground"
                                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  }`}
                                >
                                  {isBench ? "Bench" : "Starter"}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="transfer">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Transfer History</h2>
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-card/40">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20 text-center">GW</TableHead>
                          <TableHead className="w-32 text-center">Transfer Made</TableHead>
                          <TableHead className="w-32 text-center">Transfer Cost</TableHead>
                          <TableHead className="min-w-[360px]">Transfers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {teamStats.transferRows.map((row) => {
                          const hasTransfer = row.transfers > 0;
                          return (
                            <TableRow
                              key={row.gameweek}
                              className={
                                hasTransfer
                                  ? "bg-blue-50/30 dark:bg-blue-950/10 hover:bg-blue-50/50 dark:hover:bg-blue-950/20"
                                  : "bg-muted/10 hover:bg-muted/20"
                              }
                            >
                              <TableCell className="text-center font-medium text-muted-foreground">
                                {row.gameweek}
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    row.transfers > 0
                                      ? "bg-primary/15 text-primary"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {row.transfers}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                <span
                                  className={
                                    row.cost > 0
                                      ? "font-semibold text-rose-600 dark:text-rose-400"
                                      : "font-medium text-muted-foreground"
                                  }
                                >
                                  {row.cost > 0 ? `-${row.cost}` : "0"}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-2 py-1">
                                  {row.moves.length === 0 ? (
                                    <div className="rounded-md border border-dashed border-border/50 bg-background/60 px-3 py-2.5">
                                      <p className="text-sm text-muted-foreground">
                                        {row.transfers > 0
                                          ? "Transfer happened (details unavailable from API)"
                                          : "No transfer"}
                                      </p>
                                    </div>
                                  ) : (
                                    row.moves.map((move, index) => (
                                      <div
                                        key={`${row.gameweek}-${move.outName}-${move.inName}-${index}`}
                                        className="rounded-md border border-border/50 bg-background/80 px-3 py-2.5"
                                      >
                                        <p className="text-sm font-medium leading-5">
                                          <span className="text-muted-foreground">OUT</span> {move.outName} ({move.outTeam}){" "}
                                          <span className="mx-1 text-muted-foreground">{"->"}</span>
                                          <span className="text-muted-foreground">IN</span> {move.inName} ({move.inTeam})
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1.5">
                                          Sold: {formatPlayerValue(move.outCost)} | Bought: {formatPlayerValue(move.inCost)}
                                        </p>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card className="p-6 mb-6">
                  <h2 className="text-xl font-bold mb-4">Gameweek History</h2>
                  <StatsTable
                    title=""
                    data={teamStats.historyRows}
                    columns={[
                      { key: "gameweek", label: "GW", className: "text-center" },
                      { key: "eventPoints", label: "Pts", className: "text-center font-bold" },
                      { key: "eventNetPoints", label: "Net", className: "text-center font-bold" },
                      {
                        key: "eventRank",
                        label: "GW Rank",
                        className: "text-center",
                        format: (value) => value == null ? "-" : formatCompact(Number(value)),
                      },
                      { key: "overallPoints", label: "Total", className: "text-center font-bold" },
                      {
                        key: "overallRank",
                        label: "Overall Rank",
                        className: "text-center",
                        format: (value) => formatCompact(Number(value)),
                      },
                      { key: "eventTransfers", label: "Trans", className: "text-center" },
                      { key: "eventTransfersCost", label: "Cost", className: "text-center" },
                      {
                        key: "teamValue",
                        label: "Value",
                        className: "text-right",
                        format: (value) => formatMoney(value == null ? null : Number(value)),
                      },
                      {
                        key: "bank",
                        label: "Bank",
                        className: "text-right",
                        format: (value) => formatMoney(value == null ? null : Number(value)),
                      },
                    ]}
                  />
                </Card>

                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4">Season History</h2>
                  <StatsTable
                    title=""
                    data={teamStats.seasonHistoryRows}
                    columns={[
                      { key: "seasonOrder", label: "#", className: "text-center" },
                      { key: "season", label: "Season", className: "text-center" },
                      { key: "totalPoints", label: "Points", className: "text-center font-bold" },
                      {
                        key: "overallRank",
                        label: "Overall Rank",
                        className: "text-center",
                        format: (value) => formatCompact(Number(value)),
                      },
                    ]}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="chips">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Chip Usage
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-accent/30 p-4 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Current Event Chip</p>
                      <p className="text-base font-semibold">{teamStats.eventChip}</p>
                    </div>
                    <div className="bg-accent/30 p-4 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Chips Used</p>
                      <p className="text-2xl font-bold">{teamStats.chipUsageRows.length}</p>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-sm font-semibold mb-2">Usage by Chip</h3>
                    <StatsTable
                      title=""
                      data={teamStats.chipCounts}
                      columns={[
                        { key: "chip", label: "Chip" },
                        { key: "count", label: "Times Used", className: "text-right font-bold" },
                      ]}
                    />
                  </div>

                  <h3 className="text-sm font-semibold mb-2">Gameweek Usage</h3>
                  <StatsTable
                    title=""
                    data={teamStats.chipUsageRows}
                    columns={[
                      { key: "gameweek", label: "GW", className: "text-center" },
                      { key: "chip", label: "Chip", className: "text-right font-bold" },
                    ]}
                  />
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RootLayout>
  );
}
