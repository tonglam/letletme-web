"use client";

import { TournamentEntry } from "@/types/tournament";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, GitCompareArrows } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { formatCompactNumber } from "@/lib/utils";
import { EntryCompareSheet } from "./EntryCompareSheet";

interface TournamentTableProps {
  entries: TournamentEntry[];
  searchQuery: string;
  tournamentId?: string;
  gameweek?: number;
}

export function TournamentTable({ entries, searchQuery, tournamentId, gameweek }: TournamentTableProps) {
  const [sortColumn, setSortColumn] = useState<string>("gwPoints");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [compareSelection, setCompareSelection] = useState<TournamentEntry[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);


  const toggleCompare = (entry: TournamentEntry) => {
    setCompareSelection(prev => {
      const exists = prev.find(e => e.id === entry.id);
      if (exists) return prev.filter(e => e.id !== entry.id);
      if (prev.length >= 2) return [prev[1], entry];
      return [...prev, entry];
    });
  };

  const sortOptions = [
    { value: "gwPoints", label: "GW Pts" },
    { value: "gwNetPoints", label: "GW Net" },
    { value: "eventCost", label: "Cost" },
    { value: "playersPlayed", label: "Played" },
    { value: "totalPoints", label: "Total Pts" },
    { value: "overallRank", label: "OR" },
    { value: "teamName", label: "Team" },
  ];

  // Filter entries based on search query
  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      entry.teamName.toLowerCase().includes(query) ||
      entry.managerName.toLowerCase().includes(query)
    );
  });

  // Sort entries based on current sort column and direction
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    let valueA: string | number;
    let valueB: string | number;

    // Determine which column to sort by
    switch (sortColumn) {
      case "teamName":
        valueA = a.teamName;
        valueB = b.teamName;
        break;
      case "managerName":
        valueA = a.managerName;
        valueB = b.managerName;
        break;
      case "overallRank":
        valueA = a.overallRank ?? 0;
        valueB = b.overallRank ?? 0;
        break;
      case "eventCost":
        valueA = a.eventCost ?? 0;
        valueB = b.eventCost ?? 0;
        break;
      case "gwPoints":
        valueA = a.gwPoints ?? a.livePoints;
        valueB = b.gwPoints ?? b.livePoints;
        break;
      case "gwNetPoints":
        valueA = a.gwNetPoints ?? a.livePoints;
        valueB = b.gwNetPoints ?? b.livePoints;
        break;
      case "totalPoints":
        valueA = a.totalPoints;
        valueB = b.totalPoints;
        break;
      case "playersPlayed":
        valueA = a.playersPlayed ?? 0;
        valueB = b.playersPlayed ?? 0;
        break;
      case "rank":
        valueA = a.rank;
        valueB = b.rank;
        break;
      default:
        valueA = a.gwNetPoints ?? a.livePoints;
        valueB = b.gwNetPoints ?? b.livePoints;
    }

    // Perform the sort
    if (typeof valueA === "string" && typeof valueB === "string") {
      return sortDirection === "asc" 
        ? valueA.localeCompare(valueB) 
        : valueB.localeCompare(valueA);
    } else {
      return sortDirection === "asc" 
        ? (valueA as number) - (valueB as number) 
        : (valueB as number) - (valueA as number);
    }
  });

  const formatOverallRank = (rank?: number) => {
    if (!rank || rank <= 0) return "-";
    return formatCompactNumber(rank)
      .replace("K", "k")
      .replace("M", "m")
      .replace("B", "b");
  };

  const formatNetPoints = (points: number) => {
    return `${points}`;
  };

  const getDefaultDirectionForColumn = (column: string): "asc" | "desc" => {
    return column === "teamName" ? "asc" : "desc";
  };

  return (
    <>
    <div className="bg-card rounded-lg overflow-hidden shadow-sm">
      <div className="border-b p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by</span>
          <Select
            value={sortColumn}
            onValueChange={(nextColumn) => {
              setSortColumn(nextColumn);
              setSortDirection(getDefaultDirectionForColumn(nextColumn));
            }}
          >
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {compareSelection.length === 0 && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <GitCompareArrows className="h-3.5 w-3.5" />
              Tick 2 teams to compare
            </span>
          )}
          {compareSelection.length === 1 && (
            <span className="text-xs text-muted-foreground">Select 1 more to compare</span>
          )}
          {compareSelection.length === 2 && (
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5"
              onClick={() => setIsCompareOpen(true)}
            >
              <GitCompareArrows className="h-3.5 w-3.5" />
              Compare (2)
            </Button>
          )}
          {compareSelection.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setCompareSelection([])}
            >
              Clear
            </button>
          )}
          <button
            type="button"
            className="h-8 px-3 rounded-md border text-sm inline-flex items-center gap-1 hover:bg-accent"
            onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
          >
            {sortDirection === "asc" ? (
              <>
                <ArrowUp className="h-4 w-4" />
                Asc
              </>
            ) : (
              <>
                <ArrowDown className="h-4 w-4" />
                Desc
              </>
            )}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 pr-0" />
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">GW Pts</TableHead>
              <TableHead className="text-right">Total Pts</TableHead>
              <TableHead className="text-right hidden md:table-cell">OR</TableHead>
              <TableHead className="text-right hidden md:table-cell">Played</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.length > 0 ? (
              sortedEntries.map((entry) => {
                const isChecked = compareSelection.some(e => e.id === entry.id);
                const isDisabled = !isChecked && compareSelection.length >= 2;
                return (
                <TableRow key={entry.id} className={`hover:bg-accent/30 ${isChecked ? 'bg-accent/20' : ''}`}>
                  <TableCell className="pr-0 w-8">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isDisabled}
                      onChange={() => toggleCompare(entry)}
                      className="h-3.5 w-3.5 rounded border-muted-foreground/30 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label={`Select ${entry.teamName} for comparison`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {entry.rank > 0 ? entry.rank : "—"}
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`/live/points/${entry.id}${tournamentId ? `?tournamentId=${tournamentId}` : ''}`} 
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {entry.teamName}
                    </Link>
                    {entry.captainName && entry.captainName !== 'N/A' && (
                      <span className="text-xs text-muted-foreground ml-1">
                        {entry.captainName} (C)
                      </span>
                    )}
                    <div className="flex gap-1 mt-1">
                      {entry.chips.bench && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-500/10 text-blue-600 border-blue-200">
                          BB
                        </Badge>
                      )}
                      {entry.chips.triple && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-600 border-emerald-200">
                          TC
                        </Badge>
                      )}
                      {entry.chips.wildcard && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1 bg-purple-500/10 text-purple-600 border-purple-200">
                          WC
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-bold text-primary">
                      {(entry.gwPoints ?? entry.livePoints)}
                      {(entry.eventCost ?? 0) > 0 ? ` (-${entry.eventCost})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Net {formatNetPoints(entry.gwNetPoints ?? entry.livePoints)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {entry.totalPoints}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell">
                    {formatOverallRank(entry.overallRank)}
                  </TableCell>
                  <TableCell className="text-right hidden md:table-cell text-muted-foreground">
                    {entry.playersPlayed}/{entry.playersPlayed + entry.playersToPlay}
                  </TableCell>
                </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No teams found matching your search criteria
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>

    {isCompareOpen && compareSelection.length === 2 && (
      <EntryCompareSheet
        entries={[compareSelection[0], compareSelection[1]]}
        gameweek={gameweek ?? 1}
        open={isCompareOpen}
        onOpenChange={setIsCompareOpen}
      />
    )}
    </>
  );
}
