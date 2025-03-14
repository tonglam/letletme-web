"use client";

import React from "react";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactNumber } from "@/lib/utils";
import { PlayerOption } from "./PlayerSelector";

interface PriceChange {
  player: PlayerOption;
  oldPrice: number;
  newPrice: number;
  date: string;
  transfersIn?: number;
  transfersOut?: number;
}

interface PriceChangeListProps {
  title: string;
  changes: PriceChange[];
  type: "rise" | "fall";
}

export function PriceChangeList({ title, changes, type }: PriceChangeListProps) {
  const icon = type === "rise" ? (
    <ArrowRightCircle className="h-5 w-5 shrink-0 text-emerald-500" />
  ) : (
    <ArrowLeftCircle className="h-5 w-5 shrink-0 text-rose-500" />
  );

  const priceClassName = type === "rise" 
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  return (
    <div>
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2 bg-background/50 rounded-lg p-2 sm:p-3">
        {changes.map((change, index) => (
          <div 
            key={index}
            className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {change.player.position}
              </span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {change.player.team}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium truncate flex-1">{change.player.name}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{change.player.name} ({change.player.team})</p>
                    {change.date && <p className="text-xs text-muted-foreground">{change.date}</p>}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex flex-col items-end">
              <span className={`text-xs sm:text-sm font-medium ml-2 shrink-0 ${priceClassName}`}>
                {type === "rise" ? "+" : "-"}£{Math.abs(change.newPrice - change.oldPrice).toFixed(1)}m
              </span>
              <span className="text-xs text-muted-foreground">
                {change.oldPrice.toFixed(1)}m → {change.newPrice.toFixed(1)}m
              </span>
              {(change.transfersIn || change.transfersOut) && (
                <span className="text-xs text-muted-foreground mt-1">
                  {type === "rise" ? 
                    `${formatCompactNumber(change.transfersIn || 0)} transfers in` : 
                    `${formatCompactNumber(change.transfersOut || 0)} transfers out`}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}