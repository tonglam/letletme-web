"use client";

import React from "react";
import { useTranslations } from "next-intl";
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
  currentGameweek: number;
  selectedGameweek?: number;
  disabled?: boolean;
}

export function GameweekSelector({ 
  onGameweekChange, 
  className = "",
  currentGameweek,
  selectedGameweek,
  disabled = false
}: GameweekSelectorProps) {
  const t = useTranslations("Common");
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
        label: `${t("gameweekOption", { gameweek: i })}${i === currentGameweek ? ` (${t("currentSuffix")})` : ''}`
      });
    }
    
    return gameweeks;
  };

  const gameweeks = generateGameweeks();

  return (
    <Card className={`p-4 ${className}`}>
      <div>
        <p className="text-sm text-muted-foreground mb-2">{t("selectGameweek")}</p>
        <Select
          value={effectiveSelectedGameweek.toString()}
          onValueChange={(value) => onGameweekChange(parseInt(value))}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t("selectGameweek")}>
            <SelectValue placeholder={t("selectGameweek")} />
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
