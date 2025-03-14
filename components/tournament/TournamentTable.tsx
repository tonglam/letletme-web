"use client";

import { TournamentEntry } from "@/types/tournament";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus, TrendingUp, TrendingDown } from "lucide-react";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

interface TournamentTableProps {
  entries: TournamentEntry[];
  searchQuery: string;
  tournamentId?: string;
}

export function TournamentTable({ entries, searchQuery, tournamentId }: TournamentTableProps) {
  const [sortColumn, setSortColumn] = useState<string>("rank");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filter entries based on search query
  const filteredEntries = entries.filter(entry => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      entry.teamName.toLowerCase().includes(query) ||
      entry.managerName.toLowerCase().includes(query) ||
      entry.captainName.toLowerCase().includes(query)
    );
  });

  // Sort entries based on current sort column and direction
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    let valueA: any;
    let valueB: any;

    // Determine which column to sort by
    switch (sortColumn) {
      case "rank":
        valueA = a.rank;
        valueB = b.rank;
        break;
      case "teamName":
        valueA = a.teamName;
        valueB = b.teamName;
        break;
      case "managerName":
        valueA = a.managerName;
        valueB = b.managerName;
        break;
      case "captainPoints":
        valueA = a.captainPoints;
        valueB = b.captainPoints;
        break;
      case "livePoints":
        valueA = a.livePoints;
        valueB = b.livePoints;
        break;
      case "totalPoints":
        valueA = a.totalPoints;
        valueB = b.totalPoints;
        break;
      default:
        valueA = a.rank;
        valueB = b.rank;
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

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column with default direction
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Helper to show sort indicators
  const getSortIndicator = (column: string) => {
    if (sortColumn !== column) return null;
    
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 inline ml-1" />
      : <ArrowDown className="h-4 w-4 inline ml-1" />;
  };

  // Helper to get player cost (mock data for demonstration)
  const getPlayerCost = (captainName: string) => {
    const costs: Record<string, number> = {
      "M.Salah": 8,
      "Haaland": 8,
      "Son": 4,
      "Fernandes": 4,
      "Palmer": 0,
      "Saka": 4
    };
    
    return costs[captainName] || 0;
  };

  return (
    <div className="bg-card rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="w-16 cursor-pointer"
                onClick={() => handleSort("rank")}
              >
                Rank {getSortIndicator("rank")}
              </TableHead>
              <TableHead 
                className="cursor-pointer"
                onClick={() => handleSort("teamName")}
              >
                Team {getSortIndicator("teamName")}
              </TableHead>
              <TableHead 
                className="cursor-pointer hidden md:table-cell"
                onClick={() => handleSort("managerName")}
              >
                Manager {getSortIndicator("managerName")}
              </TableHead>
              <TableHead className="hidden lg:table-cell">Captain</TableHead>
              <TableHead 
                className="text-right cursor-pointer"
                onClick={() => handleSort("captainPoints")}
              >
                Cost {getSortIndicator("captainPoints")}
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer"
                onClick={() => handleSort("livePoints")}
              >
                GW Pts {getSortIndicator("livePoints")}
              </TableHead>
              <TableHead 
                className="text-right cursor-pointer hidden md:table-cell"
                onClick={() => handleSort("totalPoints")}
              >
                Total {getSortIndicator("totalPoints")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEntries.length > 0 ? (
              sortedEntries.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-accent/30">
                  <TableCell className="font-medium">
                    {entry.rank}
                  </TableCell>
                  <TableCell>
                    <Link 
                      href={`/live/points/${entry.id}${tournamentId ? `?tournamentId=${tournamentId}` : ''}`} 
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {entry.teamName}
                    </Link>
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
                  <TableCell className="hidden md:table-cell">
                    {entry.managerName}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{entry.captainName}</span>
                      <span className="text-xs text-muted-foreground">({entry.captainTeam})</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {getPlayerCost(entry.captainName)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-primary">
                    {entry.livePoints}
                    <div className="text-xs text-muted-foreground">
                      {entry.playersPlayed}/{entry.playersPlayed + entry.playersToPlay} played
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium hidden md:table-cell">
                    {entry.totalPoints}
                  </TableCell>
                </TableRow>
              ))
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
  );
}