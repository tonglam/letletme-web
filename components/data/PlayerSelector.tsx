"use client";

import React, { useState, useEffect } from "react";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";

type Position = "GKP" | "DEF" | "MID" | "FWD" | "ALL";
export type Team = "ARS" | "AVL" | "BHA" | "BOU" | "BRE" | "CHE" | "CRY" | "EVE" | "FUL" | "LIV" | "LUT" | "MCI" | "MUN" | "NEW" | "NFO" | "SHU" | "TOT" | "WHU" | "WOL" | "BUR" | "ALL";

// Type for a player
export interface PlayerOption {
  id: string;
  name: string;
  position: Position;
  team: Team;
  price: number;
}

interface PlayerSelectorProps {
  onPlayerChange: (player: PlayerOption | null) => void;
  includeAllOptions?: boolean;
  className?: string;
}

// Mock data for players
const mockPlayers: PlayerOption[] = [
  // Goalkeepers
  { id: "1", name: "Raya", position: "GKP", team: "ARS", price: 5.1 },
  { id: "2", name: "Martínez", position: "GKP", team: "AVL", price: 5.0 },
  { id: "3", name: "Sánchez", position: "GKP", team: "CHE", price: 4.6 },
  { id: "4", name: "Pope", position: "GKP", team: "NEW", price: 5.4 },
  { id: "5", name: "Onana", position: "GKP", team: "MUN", price: 4.9 },
  
  // Defenders
  { id: "6", name: "Gabriel", position: "DEF", team: "ARS", price: 5.3 },
  { id: "7", name: "White", position: "DEF", team: "ARS", price: 5.7 },
  { id: "8", name: "Trippier", position: "DEF", team: "NEW", price: 6.5 },
  { id: "9", name: "Van Dijk", position: "DEF", team: "LIV", price: 6.3 },
  { id: "10", name: "Gvardiol", position: "DEF", team: "MCI", price: 5.2 },
  { id: "11", name: "Kerkez", position: "DEF", team: "BOU", price: 4.5 },
  { id: "12", name: "Muñoz", position: "DEF", team: "CRY", price: 4.5 },
  
  // Midfielders
  { id: "13", name: "M.Salah", position: "MID", team: "LIV", price: 13.2 },
  { id: "14", name: "Palmer", position: "MID", team: "CHE", price: 5.9 },
  { id: "15", name: "Saka", position: "MID", team: "ARS", price: 9.8 },
  { id: "16", name: "Fernandes", position: "MID", team: "MUN", price: 8.4 },
  { id: "17", name: "Son", position: "MID", team: "TOT", price: 10.0 },
  { id: "18", name: "Ødegaard", position: "MID", team: "ARS", price: 8.4 },
  { id: "19", name: "Gordon", position: "MID", team: "NEW", price: 7.1 },
  { id: "20", name: "Sávio", position: "MID", team: "MCI", price: 6.7 },
  { id: "21", name: "Mbeumo", position: "MID", team: "BRE", price: 7.1 },
  { id: "22", name: "Foden", position: "MID", team: "MCI", price: 8.8 },
  
  // Forwards
  { id: "23", name: "Haaland", position: "FWD", team: "MCI", price: 14.5 },
  { id: "24", name: "N.Jackson", position: "FWD", team: "CHE", price: 7.1 },
  { id: "25", name: "Isak", position: "FWD", team: "NEW", price: 8.2 },
  { id: "26", name: "Watkins", position: "FWD", team: "AVL", price: 8.7 },
  { id: "27", name: "Wissa", position: "FWD", team: "BRE", price: 6.0 },
  { id: "28", name: "Raúl", position: "FWD", team: "FUL", price: 6.2 },
  { id: "29", name: "Solanke", position: "FWD", team: "TOT", price: 7.0 },
  { id: "30", name: "Núñez", position: "FWD", team: "LIV", price: 7.5 }
];

// Map of team abbreviations to full names
const teamFullNames: Record<Team, string> = {
  ARS: "Arsenal",
  AVL: "Aston Villa",
  BHA: "Brighton",
  BOU: "Bournemouth",
  BRE: "Brentford",
  CHE: "Chelsea",
  CRY: "Crystal Palace",
  EVE: "Everton",
  FUL: "Fulham",
  LIV: "Liverpool",
  LUT: "Luton Town",
  MCI: "Manchester City",
  MUN: "Manchester United",
  NEW: "Newcastle",
  NFO: "Nottingham Forest",
  SHU: "Sheffield United",
  TOT: "Tottenham",
  WHU: "West Ham",
  WOL: "Wolves",
  BUR: "Burnley",
  ALL: "All"
};

export function PlayerSelector({ onPlayerChange, includeAllOptions = true, className = "" }: PlayerSelectorProps) {
  const [selectedPosition, setSelectedPosition] = useState<Position>(includeAllOptions ? "ALL" : "GKP");
  const [selectedTeam, setSelectedTeam] = useState<Team>(includeAllOptions ? "ALL" : "ARS");
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");

  // Get unique teams based on selected position
  const getTeams = (): Team[] => {
    const teams = new Set<Team>();
    
    if (includeAllOptions) {
      teams.add("ALL");
    }
    
    mockPlayers.forEach(player => {
      if (selectedPosition === "ALL" || player.position === selectedPosition) {
        teams.add(player.team);
      }
    });
    
    return Array.from(teams).sort();
  };

  // Get filtered players based on selected position and team
  const getFilteredPlayers = (): PlayerOption[] => {
    return mockPlayers.filter(player => {
      const positionMatch = selectedPosition === "ALL" || player.position === selectedPosition;
      const teamMatch = selectedTeam === "ALL" || player.team === selectedTeam;
      return positionMatch && teamMatch;
    }).sort((a, b) => a.name.localeCompare(b.name));
  };

  // Reset selections when position/team changes
  useEffect(() => {
    const filteredPlayers = getFilteredPlayers();
    if (filteredPlayers.length > 0 && !filteredPlayers.some(p => p.id === selectedPlayer)) {
      setSelectedPlayer("");
      onPlayerChange(null);
    }
  }, [selectedPosition, selectedTeam]);

  // Send selected player to parent component
  useEffect(() => {
    if (selectedPlayer) {
      const player = mockPlayers.find(p => p.id === selectedPlayer) || null;
      onPlayerChange(player);
    } else {
      onPlayerChange(null);
    }
  }, [selectedPlayer, onPlayerChange]);

  const teams = getTeams();
  const filteredPlayers = getFilteredPlayers();

  return (
    <Card className={`p-4 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-2">Position</p>
          <Select
            value={selectedPosition}
            onValueChange={(value) => setSelectedPosition(value as Position)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select position" />
            </SelectTrigger>
            <SelectContent>
              {includeAllOptions && <SelectItem value="ALL">All</SelectItem>}
              <SelectItem value="GKP">Goalkeeper</SelectItem>
              <SelectItem value="DEF">Defender</SelectItem>
              <SelectItem value="MID">Midfielder</SelectItem>
              <SelectItem value="FWD">Forward</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Team</p>
          <Select
            value={selectedTeam}
            onValueChange={(value) => setSelectedTeam(value as Team)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((team) => (
                <SelectItem key={team} value={team}>
                  {teamFullNames[team]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-2">Player</p>
          <Select
            value={selectedPlayer}
            onValueChange={setSelectedPlayer}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {filteredPlayers.length === 0 ? (
                <SelectItem value="none" disabled>No players available</SelectItem>
              ) : (
                filteredPlayers.map((player) => (
                  <SelectItem key={player.id} value={player.id}>
                    {player.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}