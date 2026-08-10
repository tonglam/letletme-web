"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_TEAMS_FOR_PICKER,
  SEARCH_PLAYERS_FOR_PICKER,
  type PlayerDirectoryItem,
  type PlayerSearchForPickerResponse,
  type TeamsForPickerResponse,
} from "@/lib/graphql/operations/players";
import { resolveTeamDisplayName } from "@/lib/team-display";
import { type Position } from "@/types/common";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type PositionFilter = Position | "ALL";
type TeamFilter = "ALL" | string;

const PLAYER_PICKER_PAGE_SIZE = 20;
const DEFAULT_VISIBLE_PLAYER_RESULTS = 10;
const MIN_SEARCH_LENGTH = 2;
const PLAYER_PICKER_DEBOUNCE_MS = 200;

export interface PlayerDirectoryOption {
  id: string;
  name: string;
  position: Position;
  teamShortName: string;
  teamName: string;
}

interface TeamDirectoryOption {
  id: number;
  shortName: string;
  name: string;
}

interface PlayerDirectoryFilter {
  teamId?: number;
  position?: PlayerDirectoryItem["position"];
}

interface PlayerDirectoryPickerProps {
  onSelect: (player: PlayerDirectoryOption) => void;
  excludedPlayerIds?: string[];
  className?: string;
}

const directoryPositionToShort = (
  position: PlayerDirectoryItem["position"]
): Position => {
  switch (position) {
    case "GOALKEEPER":
      return "GKP";
    case "DEFENDER":
      return "DEF";
    case "MIDFIELDER":
      return "MID";
    case "FORWARD":
      return "FWD";
    default:
      return "MID";
  }
};

const shortPositionToDirectory = (
  position: Exclude<PositionFilter, "ALL">
): PlayerDirectoryItem["position"] => {
  switch (position) {
    case "GKP":
      return "GOALKEEPER";
    case "DEF":
      return "DEFENDER";
    case "MID":
      return "MIDFIELDER";
    case "FWD":
      return "FORWARD";
    default:
      return "MIDFIELDER";
  }
};

const toPickerPlayer = (
  player: PlayerDirectoryItem
): PlayerDirectoryOption => ({
  id: player.id.toString(),
  name: player.webName,
  position: directoryPositionToShort(player.position),
  teamShortName: player.team.shortName,
  teamName: player.team.name,
});

export function PlayerDirectoryPicker({
  onSelect,
  excludedPlayerIds = [],
  className = "",
}: PlayerDirectoryPickerProps) {
  const t = useTranslations("PlayerDirectory");
  const [teams, setTeams] = useState<TeamDirectoryOption[]>([]);
  const [players, setPlayers] = useState<PlayerDirectoryOption[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [nextPlayersCursor, setNextPlayersCursor] = useState<number | null>(
    null
  );
  const [visiblePlayerLimit, setVisiblePlayerLimit] = useState(
    DEFAULT_VISIBLE_PLAYER_RESULTS
  );
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [isPlayersLoading, setIsPlayersLoading] = useState(false);
  const [isMorePlayersLoading, setIsMorePlayersLoading] = useState(false);
  const [morePlayersError, setMorePlayersError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const playerRequestVersionRef = useRef(0);

  useEffect(() => {
    let isCancelled = false;

    const fetchTeams = async () => {
      try {
        setIsTeamsLoading(true);
        setError(null);

        const result =
          await executeQuery<TeamsForPickerResponse>(GET_TEAMS_FOR_PICKER);

        if (isCancelled) return;

        setTeams(
          result.teams
            .map((team) => ({
              id: team.id,
              name: team.name,
              shortName: team.shortName,
            }))
            .sort((a, b) =>
              resolveTeamDisplayName(a.shortName, a.name).localeCompare(
                resolveTeamDisplayName(b.shortName, b.name)
              )
            )
        );
      } catch (fetchError) {
        console.error("Failed to fetch teams directory:", fetchError);

        if (!isCancelled) {
          setError(t("teamsFailed"));
          setTeams([]);
        }
      } finally {
        if (!isCancelled) {
          setIsTeamsLoading(false);
        }
      }
    };

    void fetchTeams();

    return () => {
      isCancelled = true;
    };
  }, [t]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.shortName === teamFilter) ?? null,
    [teamFilter, teams]
  );

  const serverPlayerFilter = useMemo<PlayerDirectoryFilter | null>(() => {
    const filter: PlayerDirectoryFilter = {};

    if (selectedTeam) {
      filter.teamId = selectedTeam.id;
    }

    if (positionFilter !== "ALL") {
      filter.position = shortPositionToDirectory(positionFilter);
    }

    return Object.keys(filter).length > 0 ? filter : null;
  }, [positionFilter, selectedTeam]);

  useEffect(() => {
    let isCancelled = false;
    const requestVersion = ++playerRequestVersionRef.current;
    const normalizedSearch = searchTerm.trim();
    const hasServerFilter =
      serverPlayerFilter !== null ||
      normalizedSearch.length >= MIN_SEARCH_LENGTH;

    if (!hasServerFilter) {
      const resetTimer = window.setTimeout(() => {
        if (isCancelled) return;
        setPlayers([]);
        setTotalPlayers(0);
        setNextPlayersCursor(null);
        setVisiblePlayerLimit(DEFAULT_VISIBLE_PLAYER_RESULTS);
        setError(null);
        setMorePlayersError(null);
        setIsPlayersLoading(false);
        setIsMorePlayersLoading(false);
      }, 0);

      return () => {
        isCancelled = true;
        window.clearTimeout(resetTimer);
      };
    }

    const fetchPlayers = async () => {
      try {
        setIsPlayersLoading(true);
        setIsMorePlayersLoading(false);
        setMorePlayersError(null);
        setError(null);

        const result = await executeQuery<PlayerSearchForPickerResponse>(
          SEARCH_PLAYERS_FOR_PICKER,
          {
            search:
              normalizedSearch.length >= MIN_SEARCH_LENGTH
                ? normalizedSearch
                : null,
            filter: serverPlayerFilter,
            limit: PLAYER_PICKER_PAGE_SIZE,
            cursor: null,
          }
        );

        if (isCancelled || requestVersion !== playerRequestVersionRef.current) {
          return;
        }

        setPlayers(
          result.playersForPicker.items
            .map(toPickerPlayer)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setTotalPlayers(result.playersForPicker.totalCount);
        setNextPlayersCursor(result.playersForPicker.nextCursor);
        setVisiblePlayerLimit(DEFAULT_VISIBLE_PLAYER_RESULTS);
      } catch (fetchError) {
        console.error("Failed to fetch players directory:", fetchError);

        if (
          !isCancelled &&
          requestVersion === playerRequestVersionRef.current
        ) {
          setError(t("playersFailed"));
          setPlayers([]);
          setTotalPlayers(0);
          setNextPlayersCursor(null);
        }
      } finally {
        if (
          !isCancelled &&
          requestVersion === playerRequestVersionRef.current
        ) {
          setIsPlayersLoading(false);
        }
      }
    };

    const fetchTimer = window.setTimeout(
      () => void fetchPlayers(),
      PLAYER_PICKER_DEBOUNCE_MS
    );

    return () => {
      isCancelled = true;
      window.clearTimeout(fetchTimer);
    };
  }, [searchTerm, serverPlayerFilter, t]);

  const excludedIds = useMemo(
    () => new Set(excludedPlayerIds),
    [excludedPlayerIds]
  );

  const availableTeams = useMemo(
    () => ["ALL", ...teams.map((team) => team.shortName)],
    [teams]
  );

  useEffect(() => {
    if (!availableTeams.includes(teamFilter)) {
      const resetTimer = window.setTimeout(() => setTeamFilter("ALL"), 0);
      return () => window.clearTimeout(resetTimer);
    }
  }, [availableTeams, teamFilter]);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return players
      .filter((player) => {
        if (excludedIds.has(player.id)) return false;

        const matchesSearch =
          normalizedSearch.length === 0 ||
          player.name.toLowerCase().includes(normalizedSearch);

        return matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [excludedIds, players, searchTerm]);

  const loadMorePlayers = async () => {
    if (isMorePlayersLoading) return;
    setMorePlayersError(null);

    if (visiblePlayerLimit < filteredPlayers.length) {
      setVisiblePlayerLimit(
        (currentLimit) => currentLimit + DEFAULT_VISIBLE_PLAYER_RESULTS
      );
      return;
    }

    if (nextPlayersCursor === null) return;

    const requestVersion = playerRequestVersionRef.current;
    const normalizedSearch = searchTerm.trim();

    try {
      setIsMorePlayersLoading(true);

      const result = await executeQuery<PlayerSearchForPickerResponse>(
        SEARCH_PLAYERS_FOR_PICKER,
        {
          search:
            normalizedSearch.length >= MIN_SEARCH_LENGTH
              ? normalizedSearch
              : null,
          filter: serverPlayerFilter,
          limit: PLAYER_PICKER_PAGE_SIZE,
          cursor: nextPlayersCursor,
        }
      );

      if (requestVersion !== playerRequestVersionRef.current) return;

      setPlayers((currentPlayers) => {
        const byId = new Map(
          currentPlayers.map((player) => [player.id, player] as const)
        );

        for (const player of result.playersForPicker.items.map(
          toPickerPlayer
        )) {
          byId.set(player.id, player);
        }

        return Array.from(byId.values()).sort((a, b) =>
          a.name.localeCompare(b.name)
        );
      });
      setTotalPlayers(result.playersForPicker.totalCount);
      setNextPlayersCursor(result.playersForPicker.nextCursor);
      setVisiblePlayerLimit(
        (currentLimit) => currentLimit + DEFAULT_VISIBLE_PLAYER_RESULTS
      );
    } catch (fetchError) {
      console.error("Failed to fetch more players:", fetchError);

      if (requestVersion === playerRequestVersionRef.current) {
        setMorePlayersError(t("loadMoreFailed"));
      }
    } finally {
      if (requestVersion === playerRequestVersionRef.current) {
        setIsMorePlayersLoading(false);
      }
    }
  };

  const hasActiveFilter =
    positionFilter !== "ALL" ||
    teamFilter !== "ALL" ||
    searchTerm.trim().length >= MIN_SEARCH_LENGTH;

  const visiblePlayers = hasActiveFilter
    ? filteredPlayers.slice(0, visiblePlayerLimit)
    : [];

  const canLoadMorePlayers =
    visiblePlayerLimit < filteredPlayers.length || nextPlayersCursor !== null;

  const isLoading = isTeamsLoading || isPlayersLoading;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Select
          value={teamFilter}
          onValueChange={(value) => setTeamFilter(value)}
          disabled={isTeamsLoading}
        >
          <SelectTrigger aria-label={t("filterTeam")}>
            <SelectValue
              placeholder={isTeamsLoading ? t("loadingTeams") : t("filterTeam")}
            />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {isTeamsLoading ? (
              <SelectItem
                value="loading"
                disabled
              >
                {t("loadingTeams")}
              </SelectItem>
            ) : (
              availableTeams.map((team) => (
                <SelectItem
                  key={team}
                  value={team}
                >
                  {team === "ALL"
                    ? t("allTeams")
                    : resolveTeamDisplayName(
                        team,
                        teams.find((item) => item.shortName === team)?.name
                      )}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <Select
          value={positionFilter}
          onValueChange={(value) => setPositionFilter(value as PositionFilter)}
        >
          <SelectTrigger aria-label={t("filterPosition")}>
            <SelectValue placeholder={t("filterPosition")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("allPositions")}</SelectItem>
            <SelectItem value="GKP">{t("goalkeeper")}</SelectItem>
            <SelectItem value="DEF">{t("defender")}</SelectItem>
            <SelectItem value="MID">{t("midfielder")}</SelectItem>
            <SelectItem value="FWD">{t("forward")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label={t("search")}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9 pr-9"
          />
          {searchTerm.trim().length > 0 && (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-md border">
        <div className="max-h-64 overflow-y-auto">
          {error ? (
            <div
              role="status"
              className="p-3 text-sm text-destructive"
            >
              {error}
            </div>
          ) : !hasActiveFilter ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t("prompt")}
            </div>
          ) : isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t("loadingPlayers")}
            </div>
          ) : visiblePlayers.length === 0 && !canLoadMorePlayers ? (
            <div className="p-3 text-sm text-muted-foreground">
              {t("noPlayers")}
            </div>
          ) : (
            <>
              {visiblePlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => {
                    onSelect(player);
                    setSearchTerm("");
                    setPositionFilter("ALL");
                    setTeamFilter("ALL");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="truncate font-medium">{player.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {player.position} |{" "}
                    {resolveTeamDisplayName(
                      player.teamShortName,
                      player.teamName
                    )}
                  </span>
                </button>
              ))}
              {canLoadMorePlayers && (
                <>
                  {morePlayersError && (
                    <div
                      role="status"
                      className="border-b px-3 py-2 text-sm text-destructive"
                    >
                      {morePlayersError}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void loadMorePlayers()}
                    disabled={isMorePlayersLoading}
                    className="w-full px-3 py-3 text-center text-sm font-medium text-primary transition-colors hover:bg-accent/50 disabled:cursor-wait disabled:text-muted-foreground"
                  >
                    {isMorePlayersLoading ? t("loadingMore") : t("loadMore")}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {hasActiveFilter && !isLoading && !error && (
        <div className="mt-2 text-xs text-muted-foreground">
          {t("resultCount", {
            visible: visiblePlayers.length,
            total: totalPlayers,
          })}
        </div>
      )}
    </div>
  );
}
