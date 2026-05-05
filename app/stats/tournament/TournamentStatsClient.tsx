"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StatsTable } from "@/components/data/StatsTable";
import RootLayout from "@/components/layout/RootLayout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_ENTRY_TOURNAMENTS,
  GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
  GET_TOURNAMENT_EVENT_RESULTS,
  type EntryTournament,
  type EntryTournamentsResponse,
  type TournamentEntryRankingSummary,
  type TournamentEntryRankingSummaryResponse,
  type TournamentEventResultItem,
  type TournamentEventResultsResponse,
} from "@/lib/graphql/queries";
import { useEvent } from "@/lib/event-context";
import { formatCompactNumber } from "@/lib/utils";
import { ArrowUp, ArrowDown, Calendar, Crown, Star, Trophy, Users } from "lucide-react";

interface StandingRow {
  entryId: number;
  rank: number;
  previousRank: number;
  teamName: string;
  managerName: string;
  gameweekPoints: number;
  totalPoints: number;
  overallRank: number;
  teamValue: number | null;
}

interface CaptainRow {
  player: string;
  team: string;
  count: number;
  percentage: number;
  averagePoints: number;
}

interface ChipRow {
  chip: string;
  count: number;
  percentage: number;
  averagePoints: number;
}

interface TopPerformer {
  entryId: number;
  rank: number;
  teamName: string;
  managerName: string;
  points: number;
  captain: {
    name: string;
    team: string;
    points: number;
  };
}

interface PlayerMeta {
  webName: string;
  teamShortName: string;
}

interface TournamentStatsViewModel {
  tournament: EntryTournament;
  currentGameweek: number;
  startGameweek: number | null;
  endGameweek: number | null;
  myRank: number | null;
  myPreviousRank: number | null;
  myTeam: {
    name: string;
    points: number | null;
    eventCost: number | null;
    captaincy: {
      name: string;
      team: string;
      points: number | null;
    };
  } | null;
  topPerformers: TopPerformer[];
  standings: StandingRow[];
  captainStats: CaptainRow[];
  chipUsage: ChipRow[];
}

interface TournamentRankingRow {
  label: string;
  value: string;
  rankLabel: string;
  rank: string;
}

const formatStateBadge = (state: string): { label: string; className: string } => {
  switch (state) {
    case "ACTIVE":
      return { label: "Live", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" };
    case "COMPLETED":
      return { label: "Completed", className: "bg-muted text-muted-foreground border-muted-foreground/20" };
    case "PENDING":
      return { label: "Pending", className: "bg-yellow-500/10 text-yellow-600 border-yellow-200" };
    default:
      return { label: state, className: "bg-muted text-muted-foreground border-muted-foreground/20" };
  }
};

const formatLeagueType = (leagueType: string): string => {
  switch (leagueType) {
    case "H2H": return "Head-to-Head";
    case "CLASSIC": return "Classic";
    default: return leagueType;
  }
};

const formatGroupMode = (mode: string): string | null => {
  switch (mode) {
    case "POINTS_RACES": return "Points Race";
    case "BATTLE_RACES": return "Battle Race";
    case "NO_GROUP": return null;
    default: return null;
  }
};

const formatKnockoutMode = (mode: string): string | null => {
  switch (mode) {
    case "SINGLE_ELIMINATION": return "Single Elim.";
    case "DOUBLE_ELIMINATION": return "Double Elim.";
    case "HEAD_TO_HEAD": return "H2H";
    case "NO_KNOCKOUT": return null;
    default: return null;
  }
};

const formatChipLabel = (chip: string | null): string => {
  switch (chip) {
    case "BENCH_BOOST":
      return "Bench Boost";
    case "TRIPLE_CAPTAIN":
      return "Triple Captain";
    case "FREE_HIT":
      return "Free Hit";
    case "WILDCARD":
      return "Wildcard";
    default:
      return "No Chip";
  }
};

const getGameweekRange = (
  tournament: EntryTournament,
): { start: number | null; end: number | null } => ({
  start: tournament.groupStartedEventId ?? tournament.knockoutStartedEventId ?? null,
  end: tournament.groupEndedEventId ?? tournament.knockoutEndedEventId ?? null,
});

const formatMoneyValue = (value: number | null): string =>
  value === null ? "-" : `£${(value / 10).toFixed(1)}m`;

const formatRankValue = (value: number | null): string =>
  value === null ? "-" : formatCompactNumber(value);

const formatPointsValue = (value: number | null): string =>
  value === null ? "-" : `${value} pts`;

const buildTournamentRankingRows = (
  rankingSummary: TournamentEntryRankingSummary | null,
): TournamentRankingRow[] => [
  {
    label: "Overall Rank",
    value: formatRankValue(rankingSummary?.overallRank ?? null),
    rankLabel: "Tournament Rank",
    rank: formatRankValue(rankingSummary?.tournamentOverallRank ?? null),
  },
  {
    label: "Team Value",
    value: formatMoneyValue(rankingSummary?.teamValue ?? null),
    rankLabel: "Tournament Team Value Rank",
    rank: formatRankValue(rankingSummary?.tournamentTeamValueRank ?? null),
  },
  {
    label: "Transfers Num",
    value:
      rankingSummary?.transfersNum === null || rankingSummary?.transfersNum === undefined
        ? "-"
        : String(rankingSummary.transfersNum),
    rankLabel: "Tournament Transfers Rank",
    rank: formatRankValue(rankingSummary?.tournamentTransfersRank ?? null),
  },
  {
    label: "Total Costs",
    value: formatPointsValue(rankingSummary?.totalCosts ?? null),
    rankLabel: "Tournament Costs Rank",
    rank: formatRankValue(rankingSummary?.tournamentCostsRank ?? null),
  },
  {
    label: "Total Bench Points",
    value: formatPointsValue(rankingSummary?.totalBenchPoints ?? null),
    rankLabel: "Tournament Bench Rank",
    rank: formatRankValue(rankingSummary?.tournamentBenchPointsRank ?? null),
  },
  {
    label: "Auto Sub Points",
    value: formatPointsValue(rankingSummary?.autoSubPoints ?? null),
    rankLabel: "Tournament Auto-sub Rank",
    rank: formatRankValue(rankingSummary?.tournamentAutoSubRank ?? null),
  },
];

const fetchPlayerMetaByIds = async (
  ids: number[],
): Promise<Record<number, PlayerMeta>> => {
  const uniqueIds = Array.from(
    new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
  );
  if (uniqueIds.length === 0) {
    return {};
  }

  const selection = uniqueIds
    .map((id) => `p${id}: player(id: ${id}) { webName team { shortName name } }`)
    .join("\n");
  const query = `query GetTournamentCaptainMeta {\n${selection}\n}`;
  const data = await executeQuery<
    Record<
      string,
      | {
          webName?: string | null;
          team?: { shortName?: string | null; name?: string | null } | null;
        }
      | null
    >
  >(query);

  const result: Record<number, PlayerMeta> = {};
  for (const id of uniqueIds) {
    const value = data[`p${id}`];
    const webName = value?.webName;
    if (typeof webName === "string" && webName.length > 0) {
      result[id] = {
        webName,
        teamShortName: value?.team?.shortName ?? value?.team?.name ?? "N/A",
      };
    }
  }
  return result;
};

const buildTournamentStats = (
  tournament: EntryTournament,
  currentGameweek: number,
  currentRows: TournamentEventResultItem[],
  previousRows: TournamentEventResultItem[],
  playerMetaById: Record<number, PlayerMeta>,
  entryId: number,
): TournamentStatsViewModel => {
  const previousRankByEntryId = new Map<number, number>();
  previousRows.forEach((row) => {
    if (row.eventGroupRank !== null) {
      previousRankByEntryId.set(row.entryId, row.eventGroupRank);
    }
  });

  const standings = currentRows.map((row) => ({
    entryId: row.entryId,
    rank: row.eventGroupRank ?? 0,
    previousRank: previousRankByEntryId.get(row.entryId) ?? row.eventGroupRank ?? 0,
    teamName: row.entryName ?? `Entry ${row.entryId}`,
    managerName: row.playerName ?? "-",
    gameweekPoints: row.eventNetPoints ?? row.eventPoints ?? 0,
    totalPoints: row.overallPoints ?? 0,
    overallRank: row.overallRank ?? 0,
    teamValue: row.teamValue ?? null,
  }));

  const topPerformers = currentRows.slice(0, 5).map((row, index) => {
    const captainMeta =
      row.captainId !== null ? playerMetaById[row.captainId] : undefined;

    return {
      entryId: row.entryId,
      rank: row.eventGroupRank ?? index + 1,
      teamName: row.entryName ?? `Entry ${row.entryId}`,
      managerName: row.playerName ?? "-",
      points: row.eventNetPoints ?? row.eventPoints ?? 0,
      captain: {
        name: captainMeta?.webName ?? "N/A",
        team: captainMeta?.teamShortName ?? "N/A",
        points: row.captainPoints ?? 0,
      },
    };
  });

  const myRow = currentRows.find((row) => row.entryId === entryId) ?? null;
  const myPreviousRank =
    myRow !== null
      ? previousRankByEntryId.get(myRow.entryId) ?? myRow.eventGroupRank ?? null
      : null;
  const myCaptainMeta =
    myRow?.captainId !== null && myRow?.captainId !== undefined
      ? playerMetaById[myRow.captainId]
      : undefined;

  const captainBuckets = new Map<number, { count: number; totalCaptainPoints: number }>();
  currentRows.forEach((row) => {
    if (row.captainId === null) {
      return;
    }
    const bucket = captainBuckets.get(row.captainId) ?? {
      count: 0,
      totalCaptainPoints: 0,
    };
    bucket.count += 1;
    bucket.totalCaptainPoints += row.captainPoints ?? 0;
    captainBuckets.set(row.captainId, bucket);
  });

  const captainStats = Array.from(captainBuckets.entries())
    .map(([captainId, bucket]) => ({
      player: playerMetaById[captainId]?.webName ?? `Player ${captainId}`,
      team: playerMetaById[captainId]?.teamShortName ?? "N/A",
      count: bucket.count,
      percentage:
        currentRows.length > 0
          ? Number(((bucket.count / currentRows.length) * 100).toFixed(1))
          : 0,
      averagePoints:
        bucket.count > 0
          ? Number((bucket.totalCaptainPoints / bucket.count).toFixed(1))
          : 0,
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 8);

  const chipBuckets = new Map<string, { count: number; totalPoints: number }>();
  currentRows.forEach((row) => {
    if (!row.eventChip) {
      return;
    }
    const bucket = chipBuckets.get(row.eventChip) ?? { count: 0, totalPoints: 0 };
    bucket.count += 1;
    bucket.totalPoints += row.eventNetPoints ?? row.eventPoints ?? 0;
    chipBuckets.set(row.eventChip, bucket);
  });

  const chipUsage = Array.from(chipBuckets.entries())
    .map(([chip, bucket]) => ({
      chip: formatChipLabel(chip),
      count: bucket.count,
      percentage:
        currentRows.length > 0
          ? Number(((bucket.count / currentRows.length) * 100).toFixed(1))
          : 0,
      averagePoints:
        bucket.count > 0 ? Number((bucket.totalPoints / bucket.count).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.count - left.count);

  const { start, end } = getGameweekRange(tournament);

  return {
    tournament,
    currentGameweek,
    startGameweek: start,
    endGameweek: end,
    myRank: myRow?.eventGroupRank ?? null,
    myPreviousRank,
    myTeam:
      myRow === null
        ? null
        : {
            name: myRow.entryName ?? `Entry ${myRow.entryId}`,
            points: myRow.eventNetPoints ?? myRow.eventPoints ?? null,
            eventCost: myRow.eventCost ?? null,
            captaincy: {
              name: myCaptainMeta?.webName ?? "N/A",
              team: myCaptainMeta?.teamShortName ?? "N/A",
              points: myRow.captainPoints ?? null,
            },
          },
    topPerformers,
    standings,
    captainStats,
    chipUsage,
  };
};

interface TournamentStatsClientProps {
  entryId: number;
  initialCurrentGameweek: number;
  initialTournaments: EntryTournament[];
  initialSelectedTournamentId: string;
  initialDataGameweek: number | null;
  initialCurrentRows: TournamentEventResultItem[];
  initialError: string | null;
}

export default function TournamentStatsClient({
  entryId,
  initialCurrentGameweek,
  initialTournaments,
  initialSelectedTournamentId,
  initialDataGameweek,
  initialCurrentRows,
  initialError,
}: TournamentStatsClientProps) {
  const { currentEventId } = useEvent();
  const initialSelectedTournament =
    initialTournaments.find((item) => String(item.id) === initialSelectedTournamentId) ?? null;
  const initialStats =
    initialSelectedTournament && initialDataGameweek !== null
      ? buildTournamentStats(
          initialSelectedTournament,
          initialDataGameweek,
          initialCurrentRows,
          [],
          {},
          entryId,
        )
      : null;

  const [tournaments, setTournaments] = useState<EntryTournament[]>(initialTournaments);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialSelectedTournamentId);
  const [currentGameweek] = useState<number>(currentEventId ?? initialCurrentGameweek);
  const [dataGameweek, setDataGameweek] = useState<number | null>(initialDataGameweek);
  const [tournamentStats, setTournamentStats] = useState<TournamentStatsViewModel | null>(initialStats);
  const [rankingSummary, setRankingSummary] = useState<TournamentEntryRankingSummary | null>(null);
  const [standingsSearch, setStandingsSearch] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(initialTournaments.length === 0 && entryId > 0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const eventResultsCacheRef = useRef<Map<string, TournamentEventResultItem[]>>(
    (() => {
      const cache = new Map<string, TournamentEventResultItem[]>();
      if (initialSelectedTournamentId && initialDataGameweek !== null) {
        cache.set(`${initialSelectedTournamentId}:${initialDataGameweek}`, initialCurrentRows);
      }
      return cache;
    })(),
  );
  const playerMetaCacheRef = useRef<Map<number, PlayerMeta>>(new Map());
  const rankingSummaryCacheRef = useRef<Map<string, TournamentEntryRankingSummary>>(new Map());

  const selectedTournament = useMemo(
    () => tournaments.find((item) => String(item.id) === selectedTournamentId) ?? null,
    [selectedTournamentId, tournaments],
  );

  const filteredStandings = useMemo(() => {
    if (!tournamentStats) {
      return [];
    }

    const query = standingsSearch.trim().toLowerCase();
    if (!query) {
      return tournamentStats.standings;
    }

    return tournamentStats.standings.filter(
      (row) =>
        row.teamName.toLowerCase().includes(query) ||
        row.managerName.toLowerCase().includes(query),
    );
  }, [standingsSearch, tournamentStats]);

  useEffect(() => {
    let cancelled = false;

    if (initialTournaments.length > 0) {
      return;
    }

    if (!entryId) {
      const resetTimer = window.setTimeout(() => {
        if (cancelled) {
          return;
        }
        setTournaments([]);
        setSelectedTournamentId("");
        setIsBootstrapping(false);
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(resetTimer);
      };
    }

    const bootstrap = async () => {
      try {
        setIsBootstrapping(true);
        setError(null);

        const tournamentsData = await executeQuery<EntryTournamentsResponse>(
          GET_ENTRY_TOURNAMENTS,
          { entryId: entryId },
        );

        if (cancelled) {
          return;
        }

        setTournaments(tournamentsData.entryTournaments);
        setSelectedTournamentId(
          previous => previous || String(tournamentsData.entryTournaments[0]?.id ?? ""),
        );
      } catch (loadError) {
        console.error("Failed to bootstrap tournament stats:", loadError);
        if (!cancelled) {
          setError("Failed to load tournament list.");
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [entryId, initialTournaments.length]);

  useEffect(() => {
    if (isBootstrapping || !selectedTournament) {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fetchResults = async (eventId: number): Promise<TournamentEventResultItem[]> => {
          if (eventId <= 0) {
            return [];
          }

          const cacheKey = `${selectedTournament.id}:${eventId}`;
          const cached = eventResultsCacheRef.current.get(cacheKey);
          if (cached) {
            return cached;
          }

          const response = await executeQuery<TournamentEventResultsResponse>(
            GET_TOURNAMENT_EVENT_RESULTS,
            {
              tournamentId: selectedTournament.id,
              eventId,
            },
          );
          const rows = response.tournamentEventResults ?? [];
          eventResultsCacheRef.current.set(cacheKey, rows);
          return rows;
        };

        let latestGw = currentGameweek;
        let currentRows = await fetchResults(currentGameweek);

        if (currentRows.length === 0) {
          for (let offset = 1; offset <= 4; offset += 1) {
            const fallbackGw = currentGameweek - offset;
            if (fallbackGw <= 0) {
              break;
            }
            const fallbackRows = await fetchResults(fallbackGw);
            if (fallbackRows.length > 0) {
              latestGw = fallbackGw;
              currentRows = fallbackRows;
              break;
            }
            if (cancelled) {
              return;
            }
          }
        }

        if (currentRows.length === 0) {
          setDataGameweek(currentGameweek);
          setRankingSummary(null);
          setTournamentStats(
            buildTournamentStats(
              selectedTournament,
              currentGameweek,
              [],
              [],
              {},
              entryId,
            ),
          );
          return;
        }

        if (cancelled) return;

        const fetchRankingSummary = async (): Promise<TournamentEntryRankingSummary> => {
          const cacheKey = `${selectedTournament.id}:${latestGw}:${entryId}`;
          const cached = rankingSummaryCacheRef.current.get(cacheKey);
          if (cached) {
            return cached;
          }

          const response = await executeQuery<TournamentEntryRankingSummaryResponse>(
            GET_TOURNAMENT_ENTRY_RANKING_SUMMARY,
            {
              tournamentId: selectedTournament.id,
              eventId: latestGw,
              entryId: entryId,
            },
          );
          const summary = response.tournamentEntryRankingSummary;
          rankingSummaryCacheRef.current.set(cacheKey, summary);
          return summary;
        };

        const [previousRows, fetchedRankingSummary] = await Promise.all([
          fetchResults(latestGw - 1),
          fetchRankingSummary().catch((err) => {
            console.warn("Ranking summary unavailable:", err);
            return null;
          }),
        ]);

        if (cancelled) {
          return;
        }

        const captainIds = currentRows
          .map((row) => row.captainId)
          .filter((value): value is number => value !== null && value > 0);
        const missingCaptainIds = Array.from(new Set(captainIds)).filter(
          (id) => !playerMetaCacheRef.current.has(id),
        );

        if (missingCaptainIds.length > 0) {
          const playerMeta = await fetchPlayerMetaByIds(missingCaptainIds);
          if (cancelled) {
            return;
          }
          Object.entries(playerMeta).forEach(([id, value]) => {
            playerMetaCacheRef.current.set(Number(id), value);
          });
        }

        const playerMetaById = Object.fromEntries(playerMetaCacheRef.current.entries());
        setDataGameweek(latestGw);
        setRankingSummary(fetchedRankingSummary);
        setTournamentStats(
          buildTournamentStats(
            selectedTournament,
            latestGw,
            currentRows,
            previousRows,
            playerMetaById,
            entryId,
          ),
        );
      } catch (loadError) {
        console.error("Failed to load tournament stats:", loadError);
        setTournamentStats(null);
        setRankingSummary(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load tournament stats from API.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [isBootstrapping, currentGameweek, selectedTournament, entryId]);

  if (isBootstrapping) {
    return (
      <RootLayout>
        <div className="container max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-lg text-muted-foreground">Loading tournament stats...</p>
          </div>
        </div>
      </RootLayout>
    );
  }

  return (
    <RootLayout>
      <div className="container max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Tournament Stats</h1>

        {error && (
          <Card className="p-4 mb-6 border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive">{error}</p>
          </Card>
        )}

        <Card className="p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <span className="font-medium">Select Tournament:</span>
              </div>

              <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((tournament) => (
                    <SelectItem key={tournament.id} value={String(tournament.id)}>
                      {tournament.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {selectedTournament && (() => {
            const stateBadge = formatStateBadge(selectedTournament.state);
            const groupPhaseLabel = formatGroupMode(selectedTournament.groupMode);
            const knockoutPhaseLabel = formatKnockoutMode(selectedTournament.knockoutMode);
            return (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h2 className="text-xl font-bold">{selectedTournament.name}</h2>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTournament.state !== "ACTIVE" && (
                      <Badge variant="outline" className={stateBadge.className}>{stateBadge.label}</Badge>
                    )}
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {formatLeagueType(selectedTournament.leagueType)}
                    </Badge>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      <Users className="h-3.5 w-3.5 mr-1" />
                      {formatCompactNumber(selectedTournament.totalTeamNum)}
                    </Badge>
                    {dataGameweek !== null && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground border-muted-foreground/20">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        as of GW{dataGameweek}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  {groupPhaseLabel && selectedTournament.groupStartedEventId !== null && (
                    <span>
                      Group ({groupPhaseLabel}): GW{selectedTournament.groupStartedEventId}
                      {selectedTournament.groupEndedEventId !== null ? `–${selectedTournament.groupEndedEventId}` : "+"}
                    </span>
                  )}
                  {knockoutPhaseLabel && selectedTournament.knockoutStartedEventId !== null && (
                    <span>
                      Knockout ({knockoutPhaseLabel}): GW{selectedTournament.knockoutStartedEventId}
                      {selectedTournament.knockoutEndedEventId !== null ? `–${selectedTournament.knockoutEndedEventId}` : "+"}
                    </span>
                  )}
                  {selectedTournament.groupQualifyNum !== null && (
                    <span>Top {selectedTournament.groupQualifyNum} qualify per group</span>
                  )}
                </div>
              </div>
            );
          })()}
        </Card>

        {!tournamentStats ? (
          <Card className="p-6">
            <p className="text-muted-foreground">
              {isLoading ? "Loading tournament stats..." : "No tournament stats available."}
            </p>
          </Card>
        ) : (
          <>
            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-6">My Performance</h2>

              <div className="grid grid-cols-2 justify-items-center gap-6 xl:grid-cols-4">
                <div className="bg-primary/10 p-6 rounded-lg text-center w-full max-w-[220px]">
                  <p className="text-sm text-muted-foreground mb-1">My Rank</p>
                  <p className="text-2xl font-bold">
                    {tournamentStats.myRank === null ? "-" : formatCompactNumber(tournamentStats.myRank)}
                  </p>

                  <div className="flex items-center justify-center mt-2">
                    {tournamentStats.myRank === null || tournamentStats.myPreviousRank === null ? (
                      <div className="text-muted-foreground text-sm">
                        This team is not in this tournament
                      </div>
                    ) : tournamentStats.myPreviousRank > tournamentStats.myRank ? (
                      <div className="flex items-center text-emerald-600 text-sm">
                        <ArrowUp className="h-4 w-4 mr-1" />
                        <span>
                          Up {formatCompactNumber(tournamentStats.myPreviousRank - tournamentStats.myRank)}
                        </span>
                      </div>
                    ) : tournamentStats.myPreviousRank < tournamentStats.myRank ? (
                      <div className="flex items-center text-rose-600 text-sm">
                        <ArrowDown className="h-4 w-4 mr-1" />
                        <span>
                          Down {formatCompactNumber(tournamentStats.myRank - tournamentStats.myPreviousRank)}
                        </span>
                      </div>
                    ) : (
                      <div className="text-muted-foreground text-sm">No change</div>
                    )}
                  </div>
                </div>

                <div className="bg-primary/10 p-6 rounded-lg text-center w-full max-w-[220px]">
                  <p className="text-sm text-muted-foreground mb-1">Current Gameweek</p>
                  <p className="text-2xl font-bold">
                    {tournamentStats.myTeam?.points === null || tournamentStats.myTeam === null
                      ? "-"
                      : `${tournamentStats.myTeam.points} pts`}
                  </p>
                  <div className="flex items-center justify-center mt-2 text-sm text-muted-foreground">
                    <span>
                      Event Cost:{" "}
                      {tournamentStats.myTeam?.eventCost === null ||
                      tournamentStats.myTeam?.eventCost === undefined
                        ? "-"
                        : `${tournamentStats.myTeam.eventCost} pts`}
                    </span>
                  </div>
                </div>

                <div className="bg-primary/10 p-6 rounded-lg text-center w-full max-w-[220px]">
                  <p className="text-sm text-muted-foreground mb-1">Captain</p>
                  <p className="text-2xl font-bold">
                    {tournamentStats.myTeam?.captaincy.name ?? "N/A"}
                  </p>
                  <div className="flex items-center justify-center mt-2 text-sm">
                    <span>
                      {tournamentStats.myTeam?.captaincy.team &&
                      tournamentStats.myTeam.captaincy.team !== "N/A"
                        ? `${tournamentStats.myTeam.captaincy.team} `
                        : ""}
                      ({tournamentStats.myTeam?.captaincy.points ?? 0} pts)
                    </span>
                  </div>
                </div>

                <div className="bg-primary/10 p-6 rounded-lg text-center w-full max-w-[220px]">
                  <p className="text-sm text-muted-foreground mb-1">Top Score</p>
                  <p className="text-2xl font-bold">
                    {tournamentStats.topPerformers[0]
                      ? `${tournamentStats.topPerformers[0].points} pts`
                      : "-"}
                  </p>

                  <div className="flex items-center justify-center mt-2 text-sm">
                    <span className="truncate">
                      {tournamentStats.topPerformers[0]?.teamName ?? "No data"}
                    </span>
                  </div>
                </div>
              </div>

              {tournamentStats.topPerformers.length > 0 && (
                <div className="mt-6 pt-6 border-t">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    GW{dataGameweek} Top Performers
                  </h3>
                  <div className="space-y-2">
                    {tournamentStats.topPerformers.map((performer, index) => (
                      <div key={performer.entryId ?? index} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{performer.rank}</span>
                          <span className="font-medium truncate">{performer.teamName}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline truncate">({performer.managerName})</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {performer.captain.name !== "N/A" ? `${performer.captain.name} (C) ${performer.captain.points}pts` : ""}
                          </span>
                          <span className="font-bold text-primary">{performer.points} pts</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-6 mb-6">
              <h2 className="text-xl font-bold mb-6">My Tournament Ranking</h2>

              <div className="overflow-hidden rounded-lg border">
                {buildTournamentRankingRows(rankingSummary).map((row, index) => (
                  <div
                    key={row.label}
                    className={`grid grid-cols-1 gap-4 px-4 py-4 sm:grid-cols-2 sm:gap-6 sm:px-6 ${
                      index !== 0 ? "border-t" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-foreground/80">{row.label}</p>
                      <p className="text-base font-semibold text-right">{row.value}</p>
                    </div>

                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm text-muted-foreground">{row.rankLabel}</p>
                      <p className="text-base font-semibold text-right">{row.rank}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Tabs defaultValue="standings" className="space-y-6">
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="standings">
                  <Trophy className="h-4 w-4 mr-2" />
                  Standings
                </TabsTrigger>
                <TabsTrigger value="captains">
                  <Crown className="h-4 w-4 mr-2" />
                  Captains
                </TabsTrigger>
                <TabsTrigger value="chips">
                  <Star className="h-4 w-4 mr-2" />
                  Chips
                </TabsTrigger>
              </TabsList>

              <TabsContent value="standings">
                <Card className="p-6">
                  <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="text-xl font-bold">Standing</h2>
                    <Input
                      value={standingsSearch}
                      onChange={(event) => setStandingsSearch(event.target.value)}
                      placeholder="Search by team or player name"
                      className="sm:max-w-xs"
                    />
                  </div>

                  <StatsTable<StandingRow>
                    title=""
                    data={filteredStandings}
                    rowKeyField="entryId"
                    columns={[
                      {
                        key: "rank",
                        label: "Rank",
                        className: "text-center",
                        sortable: true,
                        sortDefault: "asc",
                        format: (value, row) => {
                          const r = row as unknown as StandingRow;
                          const rank = Number(value);
                          return (
                            <div className="flex flex-col items-center">
                              <span className="font-bold">{rank}</span>
                              <span className="text-xs">
                                {r.previousRank < rank ? (
                                  <span className="text-rose-500">▼ {rank - r.previousRank}</span>
                                ) : r.previousRank > rank ? (
                                  <span className="text-emerald-500">▲ {r.previousRank - rank}</span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </span>
                            </div>
                          );
                        },
                      },
                      {
                        key: "teamName",
                        label: "Team",
                        sortable: true,
                        sortDefault: "asc",
                        sortValue: (row) => {
                          const r = row as StandingRow;
                          return `${r.teamName.toLowerCase()}\u0000${r.managerName.toLowerCase()}`;
                        },
                        format: (value, row) => {
                          const r = row as unknown as StandingRow;
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium">{String(value)}</span>
                              <span className="text-xs text-muted-foreground">{r.managerName}</span>
                            </div>
                          );
                        },
                      },
                      {
                        key: "gameweekPoints",
                        label: "GW Points",
                        className: "text-center font-medium",
                        sortable: true,
                        sortDefault: "desc",
                      },
                      {
                        key: "totalPoints",
                        label: "Total Points",
                        className: "text-right font-bold",
                        sortable: true,
                        sortDefault: "desc",
                      },
                      {
                        key: "overallRank",
                        label: "OR",
                        className: "text-right font-medium",
                        sortable: true,
                        sortDefault: "asc",
                        format: (value) => formatCompactNumber(Number(value)),
                      },
                      {
                        key: "teamValue",
                        label: "Value",
                        className: "text-right text-muted-foreground hidden md:table-cell",
                        sortable: true,
                        sortDefault: "desc",
                        format: (value) => formatMoneyValue(value === null || value === undefined ? null : Number(value)),
                      },
                    ]}
                  />
                </Card>
              </TabsContent>

              <TabsContent value="captains">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-500" />
                    Most Captained Players
                  </h2>

                  <div className="space-y-4">
                    {tournamentStats.captainStats.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No captain data available for this event.
                      </p>
                    ) : (
                      tournamentStats.captainStats.map((stat, index) => (
                        <div key={`${stat.player}-${index}`} className="bg-accent/30 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/10 p-2 rounded-full text-primary text-lg font-bold min-w-[32px] text-center">
                                {index + 1}
                              </div>

                              <div>
                                <div className="font-bold text-lg flex items-center gap-2">
                                  {stat.player}
                                  {stat.team !== "N/A" && (
                                    <span className="text-sm text-muted-foreground">({stat.team})</span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatCompactNumber(stat.count)} managers ({stat.percentage}%)
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold">{stat.averagePoints}</div>
                              <div className="text-xs text-muted-foreground">avg. captain pts</div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Card>
              </TabsContent>

              <TabsContent value="chips">
                <Card className="p-6">
                  <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" />
                    Chip Usage
                  </h2>

                  {tournamentStats.chipUsage.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No chip usage recorded for this event.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {tournamentStats.chipUsage.map((chip, index) => (
                        <div key={`${chip.chip}-${index}`} className="bg-accent/30 p-4 rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <h3 className="font-bold text-lg">{chip.chip}</h3>
                              <div className="text-sm text-muted-foreground">
                                {formatCompactNumber(chip.count)} managers ({chip.percentage}%)
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-lg font-bold">{chip.averagePoints}</div>
                              <div className="text-xs text-muted-foreground">avg. net points</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </RootLayout>
  );
}
