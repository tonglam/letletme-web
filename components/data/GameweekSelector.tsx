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
}

export function GameweekSelector({ 
  onGameweekChange, 
  className = "",
  currentGameweek = 21 
}: GameweekSelectorProps) {
  // Generate gameweeks for selection
  const generateGameweeks = () => {
    const gameweeks = [];
    
    for (let i = 1; i <= 38; i++) {
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
          defaultValue={currentGameweek.toString()}
          onValueChange={(value) => onGameweekChange(parseInt(value))}
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