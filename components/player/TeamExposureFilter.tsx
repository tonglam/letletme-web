"use client";

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
  getTeamExposureFilterSummary,
  type TeamExposureEntry,
} from "@/lib/team-exposure-filter";
import { type OwnershipScope } from "@/lib/player-ownership-filter";
import { executeQuery } from "@/lib/graphql-client";
import {
  GET_TEAMS_FOR_PICKER,
  type TeamsForPickerResponse,
} from "@/lib/graphql/queries";
import { cn } from "@/lib/utils";
import { Shirt, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface TeamExposureFilterProps {
  entries: TeamExposureEntry[];
  onMatchedEntryIdsChange: (entryIds: string[] | null) => void;
  className?: string;
}

const scopeLabels: Record<OwnershipScope, string> = {
  any: "Any",
  starter: "Starter",
  bench: "Bench",
};

export function TeamExposureFilter({
  entries,
  onMatchedEntryIdsChange,
  className,
}: TeamExposureFilterProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [count, setCount] = useState<number>(1);
  const [scope, setScope] = useState<OwnershipScope>("any");
  const [allTeams, setAllTeams] = useState<{ shortName: string; name: string }[]>([]);

  useEffect(() => {
    executeQuery<TeamsForPickerResponse>(GET_TEAMS_FOR_PICKER)
      .then((data) =>
        setAllTeams(
          data.teams
            .map((t) => ({ shortName: t.shortName, name: t.name }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => {});
  }, []);

  // Only show teams that actually appear in the current entries' picks
  const pickedShortNames = useMemo(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      for (const pick of entry.picks) {
        if (pick.teamShortName) set.add(pick.teamShortName);
      }
    }
    return set;
  }, [entries]);

  const teamOptions = useMemo(
    () => allTeams.filter((t) => pickedShortNames.has(t.shortName)),
    [allTeams, pickedShortNames]
  );

  const summary = useMemo(
    () => getTeamExposureFilterSummary(entries, selectedTeam, count, scope),
    [entries, selectedTeam, count, scope]
  );

  const isActive = selectedTeam !== null;

  useEffect(() => {
    onMatchedEntryIdsChange(isActive ? summary.matchedEntryIds : null);
  }, [isActive, onMatchedEntryIdsChange, summary.matchedEntryIds]);

  const handleClear = () => {
    setSelectedTeam(null);
    setCount(1);
    setScope("any");
  };

  const selectedTeamName =
    allTeams.find((t) => t.shortName === selectedTeam)?.name ?? selectedTeam;

  return (
    <div className={cn("mb-6 rounded-lg border bg-card p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Shirt className="h-4 w-4 text-primary" />
            Team exposure
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Matched {summary.matchedCount} / {summary.totalCount} (
            {summary.percentage}%)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Team picker */}
          <Select
            value={selectedTeam ?? ""}
            onValueChange={(v) => setSelectedTeam(v || null)}
            disabled={teamOptions.length === 0}
          >
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {teamOptions.map((team) => (
                <SelectItem key={team.shortName} value={team.shortName}>
                  {team.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Count: 1–3 */}
          <Select
            value={String(count)}
            onValueChange={(v) => setCount(Number(v))}
          >
            <SelectTrigger className="h-8 w-[80px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1</SelectItem>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
            </SelectContent>
          </Select>

          {/* Scope: any / starter / bench */}
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as OwnershipScope)}
          >
            <SelectTrigger className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="bench">Bench</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isActive ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-2 rounded-md px-2 py-1">
            <span className="font-medium">{selectedTeamName}</span>
            <span className="text-muted-foreground">
              {count} | {scopeLabels[scope]}
            </span>
            <button
              type="button"
              aria-label="Remove team filter"
              className="rounded-sm text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleClear}
          >
            Clear
          </Button>
        </div>
      ) : (
        <div className="mt-3 rounded-md bg-accent/30 px-3 py-2 text-xs text-muted-foreground">
          No team exposure filter active.
        </div>
      )}
    </div>
  );
}
