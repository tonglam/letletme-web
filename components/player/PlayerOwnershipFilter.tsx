"use client";

import {
  PlayerDirectoryPicker,
  type PlayerDirectoryOption,
} from "@/components/player/PlayerDirectoryPicker";
import { SelectedFilterBadge } from "@/components/player/SelectedFilterBadge";
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
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

interface PlayerOwnershipFilterProps {
  entries: OwnershipEntry[];
  onMatchedEntryIdsChange: (entryIds: string[] | null) => void;
  initialScope?: OwnershipScope;
  className?: string;
  onDismiss?: () => void;
}

export function PlayerOwnershipFilter({
  entries,
  onMatchedEntryIdsChange,
  initialScope = "any",
  className,
  onDismiss,
}: PlayerOwnershipFilterProps) {
  const t = useTranslations("Filters");
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
  const scopeLabels: Record<OwnershipScope, string> = {
    any: t("any"),
    starter: t("starter"),
    bench: t("bench"),
  };
  const captainModeLabels: Record<OwnershipCaptainMode, string> = {
    any: t("anyCaptain"),
    selectedCaptain: t("selectedCaptain"),
    selectedViceCaptain: t("selectedViceCaptain"),
  };

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
    <div className={cn("mb-4 rounded-lg border bg-card p-4 last:mb-0 md:mb-6", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-primary-ink" />
              {t("playerOwnership")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {t("matched", {
                matched: summary.matchedCount,
                total: summary.totalCount,
                percentage: summary.percentage,
              })}
            </div>
          </div>
          {onDismiss ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={t("hideFilter", { name: t("playerOwnership") })}
              title={t("hideFilter", { name: t("playerOwnership") })}
              onClick={onDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <Select
            value={scope}
            onValueChange={(value) => setScope(value as OwnershipScope)}
          >
            <SelectTrigger
              className="h-10 w-full min-h-10 sm:h-9 sm:min-h-9 sm:w-[120px]"
              aria-label={t("ownershipScope")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("any")}</SelectItem>
              <SelectItem value="starter">{t("starter")}</SelectItem>
              <SelectItem value="bench">{t("bench")}</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={captainMode}
            onValueChange={(value) => setCaptainMode(value as OwnershipCaptainMode)}
          >
            <SelectTrigger
              className="h-10 w-full min-h-10 sm:h-9 sm:min-h-9 sm:w-[180px]"
              aria-label={t("captaincyFilter")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyCaptain")}</SelectItem>
              <SelectItem value="selectedCaptain">
                {t("selectedCaptain")}
              </SelectItem>
              <SelectItem value="selectedViceCaptain">
                {t("selectedViceCaptain")}
              </SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            className="h-10 min-h-10 w-full sm:h-9 sm:min-h-9 sm:w-auto"
            onClick={() => setIsPickerOpen((open) => !open)}
          >
            <Plus className="h-4 w-4" />
            {t("addPlayer")}
          </Button>
        </div>
      </div>

      {selectedPlayers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedPlayers.map((player) => (
            <SelectedFilterBadge
              key={player.id}
              name={player.name}
              details={`${player.position} | ${resolveTeamDisplayName(
                player.teamShortName,
                player.teamName
              )} | ${scopeLabels[scope]} | ${captainModeLabels[captainMode]}`}
              removeLabel={t("removePlayer", { name: player.name })}
              onRemove={() => removePlayer(player.id)}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setSelectedPlayers([])}
          >
            {t("clearAll")}
          </Button>
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
          {t("noOwnershipFilter")}
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
