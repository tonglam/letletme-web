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
  GET_PLAYERS_FOR_PICKER,
  GET_TEAMS_FOR_PICKER,
  type PlayerDirectoryItem,
  type PlayersForPickerResponse,
  type TeamsForPickerResponse,
} from "@/lib/graphql/queries";
import { resolveTeamDisplayName } from "@/lib/team-display";
import { type Position } from "@/types/common";
import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type PositionFilter = Position | "ALL";
type TeamFilter = "ALL" | string;

const PLAYER_PICKER_PAGE_SIZE = 200;
const DEFAULT_VISIBLE_PLAYER_RESULTS = 10;
const MIN_SEARCH_LENGTH = 2;

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
  const [teams, setTeams] = useState<TeamDirectoryOption[]>([]);
  const [players, setPlayers] = useState<PlayerDirectoryOption[]>([]);
  const [isTeamsLoading, setIsTeamsLoading] = useState(false);
  const [isPlayersLoading, setIsPlayersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [positionFilter, setPositionFilter] = useState<PositionFilter>("ALL");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    let isCancelled = false;

    const fetchTeams = async () => {
      try {
        setIsTeamsLoading(true);
        setError(null);

        const result = await executeQuery<TeamsForPickerResponse>(
          GET_TEAMS_FOR_PICKER
        );

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
          setError("Failed to load team directory.");
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
  }, []);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.shortName === teamFilter) ?? null,
    [teamFilter, teams]
  );

  useEffect(() => {
    let isCancelled = false;
    const normalizedSearch = searchTerm.trim();
    const hasServerFilter =
      selectedTeam !== null ||
      positionFilter !== "ALL" ||
      normalizedSearch.length >= MIN_SEARCH_LENGTH;

    if (!hasServerFilter) {
      const resetTimer = window.setTimeout(() => {
        if (isCancelled) return;
        setPlayers([]);
        setError(null);
        setIsPlayersLoading(false);
      }, 0);

      return () => {
        isCancelled = true;
        window.clearTimeout(resetTimer);
      };
    }

    const fetchPlayers = async () => {
      try {
        setIsPlayersLoading(true);
        setError(null);

        const playersAccumulator: PlayerDirectoryOption[] = [];
        let offset = 0;

        const filter: {
          teamId?: number;
          position?: "GOALKEEPER" | "DEFENDER" | "MIDFIELDER" | "FORWARD";
        } = {};

        if (selectedTeam) {
          filter.teamId = selectedTeam.id;
        }

        if (positionFilter !== "ALL") {
          filter.position = shortPositionToDirectory(positionFilter);
        }

        while (true) {
          const result = await executeQuery<PlayersForPickerResponse>(
            GET_PLAYERS_FOR_PICKER,
            {
              filter: Object.keys(filter).length > 0 ? filter : null,
              limit: PLAYER_PICKER_PAGE_SIZE,
              offset,
            }
          );

          if (isCancelled) return;

          const pagePlayers = result.players.map(toPickerPlayer);
          playersAccumulator.push(...pagePlayers);

          if (pagePlayers.length < PLAYER_PICKER_PAGE_SIZE) {
            break;
          }

          offset += PLAYER_PICKER_PAGE_SIZE;
        }

        if (isCancelled) return;

        setPlayers(
          playersAccumulator.sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (fetchError) {
        console.error("Failed to fetch players directory:", fetchError);

        if (!isCancelled) {
          setError("Failed to load player directory.");
          setPlayers([]);
        }
      } finally {
        if (!isCancelled) {
          setIsPlayersLoading(false);
        }
      }
    };

    void fetchPlayers();

    return () => {
      isCancelled = true;
    };
  }, [positionFilter, searchTerm, selectedTeam]);

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

  const hasActiveFilter =
    positionFilter !== "ALL" ||
    teamFilter !== "ALL" ||
    searchTerm.trim().length >= MIN_SEARCH_LENGTH;

  const visiblePlayers = hasActiveFilter ? filteredPlayers : [];

  const isLoading = isTeamsLoading || isPlayersLoading;

  return (
    <div className={className}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <Select
          value={teamFilter}
          onValueChange={(value) => setTeamFilter(value)}
          disabled={isTeamsLoading}
        >
          <SelectTrigger>
            <SelectValue
              placeholder={isTeamsLoading ? "Loading teams..." : "Filter by team"}
            />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {isTeamsLoading ? (
              <SelectItem value="loading" disabled>
                Loading teams...
              </SelectItem>
            ) : (
              availableTeams.map((team) => (
                <SelectItem key={team} value={team}>
                  {team === "ALL"
                    ? "All Teams"
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
          <SelectTrigger>
            <SelectValue placeholder="Filter by position" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Positions</SelectItem>
            <SelectItem value="GKP">Goalkeeper</SelectItem>
            <SelectItem value="DEF">Defender</SelectItem>
            <SelectItem value="MID">Midfielder</SelectItem>
            <SelectItem value="FWD">Forward</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Type player name..."
            className="pl-9 pr-9"
          />
          {searchTerm.trim().length > 0 && (
            <button
              type="button"
              aria-label="Clear player search"
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
          {!hasActiveFilter ? (
            <div className="p-3 text-sm text-muted-foreground">
              Select a team, position, or type a name to search.
            </div>
          ) : isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">
              Loading players...
            </div>
          ) : error ? (
            <div className="p-3 text-sm text-destructive">{error}</div>
          ) : visiblePlayers.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              No players match current filters.
            </div>
          ) : (
            visiblePlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                onClick={() => {
                  onSelect(player)
                  setSearchTerm("")
                  setPositionFilter("ALL")
                  setTeamFilter("ALL")
                }}
                className="flex w-full items-center justify-between gap-3 border-b px-3 py-3 text-left text-sm transition-colors last:border-b-0 hover:bg-accent/50"
              >
                <span className="truncate font-medium">{player.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {player.position} |{" "}
                  {resolveTeamDisplayName(player.teamShortName, player.teamName)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {hasActiveFilter && (
        <div className="mt-2 text-xs text-muted-foreground">
          {visiblePlayers.length} of {filteredPlayers.length} players
        </div>
      )}
    </div>
  );
}
