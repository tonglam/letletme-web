"use client";

import {
  PlayerDirectoryPicker,
  type PlayerDirectoryOption,
} from "@/components/player/PlayerDirectoryPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getOwnershipFilterSummary,
  type OwnershipCaptainMode,
  type OwnershipEntry,
  type OwnershipScope,
} from "@/lib/player-ownership-filter";
import { resolveTeamDisplayName } from "@/lib/team-display";
import { cn } from "@/lib/utils";
import { Plus, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface PlayerOwnershipFilterProps {
  entries: OwnershipEntry[];
  onMatchedEntryIdsChange: (entryIds: string[] | null) => void;
  initialScope?: OwnershipScope;
  className?: string;
}

const scopeLabels: Record<OwnershipScope, string> = {
  any: "Any",
  starter: "Starter",
  bench: "Bench",
};

const captainModeLabels: Record<OwnershipCaptainMode, string> = {
  any: "Any captain",
  selectedCaptain: "Selected is captain",
  selectedViceCaptain: "Selected is vice captain",
};

export function PlayerOwnershipFilter({
  entries,
  onMatchedEntryIdsChange,
  initialScope = "any",
  className,
}: PlayerOwnershipFilterProps) {
  const [scope, setScope] = useState<OwnershipScope>(initialScope);
  const [captainMode, setCaptainMode] = useState<OwnershipCaptainMode>("any");
  const [selectedPlayers, setSelectedPlayers] = useState<
    PlayerDirectoryOption[]
  >([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const selectedPlayerIds = useMemo(
    () => selectedPlayers.map((player) => Number(player.id)),
    [selectedPlayers]
  );

  const summary = useMemo(
    () =>
      getOwnershipFilterSummary(entries, selectedPlayerIds, scope, captainMode),
    [captainMode, entries, scope, selectedPlayerIds]
  );

  const isActive = selectedPlayers.length > 0;

  useEffect(() => {
    onMatchedEntryIdsChange(isActive ? summary.matchedEntryIds : null);
  }, [isActive, onMatchedEntryIdsChange, summary.matchedEntryIds]);

  const addPlayer = (player: PlayerDirectoryOption) => {
    setSelectedPlayers((current) => {
      if (current.some((selected) => selected.id === player.id)) {
        return current;
      }

      return [...current, player];
    });
    setIsPickerOpen(false);
  };

  const removePlayer = (playerId: string) => {
    setSelectedPlayers((current) =>
      current.filter((player) => player.id !== playerId)
    );
  };

  return (
    <div className={cn("mb-6 rounded-lg border bg-card p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4 text-primary" />
            Player ownership
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Matched {summary.matchedCount} / {summary.totalCount} (
            {summary.percentage}%)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={scope}
            onValueChange={(value) => setScope(value as OwnershipScope)}
          >
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="bench">Bench</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={captainMode}
            onValueChange={(value) => setCaptainMode(value as OwnershipCaptainMode)}
          >
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any captain</SelectItem>
              <SelectItem value="selectedCaptain">
                Selected is captain
              </SelectItem>
              <SelectItem value="selectedViceCaptain">
                Selected is vice captain
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPickerOpen((open) => !open)}
          >
            <Plus className="h-4 w-4" />
            Add Player
          </Button>
        </div>
      </div>

      {selectedPlayers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPlayers.map((player) => (
            <Badge
              key={player.id}
              variant="outline"
              className="gap-2 rounded-md px-2 py-1"
            >
              <span className="font-medium">{player.name}</span>
              <span className="text-muted-foreground">
                {player.position} |{" "}
                {resolveTeamDisplayName(player.teamShortName, player.teamName)} |{" "}
                {scopeLabels[scope]} | {captainModeLabels[captainMode]}
              </span>
              <button
                type="button"
                aria-label={`Remove ${player.name}`}
                className="rounded-sm text-muted-foreground hover:text-foreground"
                onClick={() => removePlayer(player.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setSelectedPlayers([])}
          >
            Clear all
          </Button>
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
          No player ownership filter active.
        </div>
      )}

      {isPickerOpen ? (
        <PlayerDirectoryPicker
          className="mt-4"
          excludedPlayerIds={selectedPlayers.map((player) => player.id)}
          onSelect={addPlayer}
        />
      ) : null}
    </div>
  );
}
