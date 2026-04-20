"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

interface GameweekSelectorProps {
  onGameweekChange: (gameweek: number) => void;
  className?: string;
  currentGameweek?: number;
  selectedGameweek?: number;
  disabled?: boolean;
}

export function GameweekSelector({ 
  onGameweekChange, 
  className = "",
  currentGameweek = 21,
  selectedGameweek,
  disabled = false
}: GameweekSelectorProps) {
  const maxGameweek = Math.max(1, currentGameweek);
  const effectiveSelectedGameweek =
    selectedGameweek !== undefined && selectedGameweek <= maxGameweek
      ? selectedGameweek
      : maxGameweek;

  // Generate gameweeks for selection
  const generateGameweeks = () => {
    const gameweeks = [];
    
    for (let i = 1; i <= maxGameweek; i++) {
      gameweeks.push({
        value: i,
        label: `Gameweek ${i}${i === currentGameweek ? ' (Current)' : ''}`
      });
    }
    
    return gameweeks;
  };

  const gameweeks = generateGameweeks();

  return (
    <Card className={`p-4 ${className}`}>
      <div>
        <p className="text-sm text-muted-foreground mb-2">Select Gameweek</p>
        <Select
          value={effectiveSelectedGameweek.toString()}
          onValueChange={(value) => onGameweekChange(parseInt(value))}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select gameweek" />
          </SelectTrigger>
          <SelectContent>
            {gameweeks.map((gw) => (
              <SelectItem key={gw.value} value={gw.value.toString()}>
                {gw.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </Card>
  );
}