"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PriceChange {
  position: string;
  player: string;
  club: string;
  price: number;
}

const priceRises: PriceChange[] = [
  { position: "MID", player: "Saka", club: "ARS", price: 9.1 },
  { position: "FWD", player: "Haaland", club: "MCI", price: 13.2 },
  { position: "MID", player: "Foden", club: "MCI", price: 8.1 },
  { position: "DEF", player: "Trippier", club: "NEW", price: 7.0 },
  { position: "MID", player: "Ødegaard", club: "ARS", price: 8.4 }
];

const priceFalls: PriceChange[] = [
  { position: "MID", player: "Son", club: "TOT", price: 9.6 },
  { position: "FWD", player: "Watkins", club: "AVL", price: 8.7 },
  { position: "DEF", player: "Robertson", club: "LIV", price: 6.4 },
  { position: "MID", player: "Rashford", club: "MUN", price: 8.2 },
  { position: "FWD", player: "Álvarez", club: "MCI", price: 6.8 }
];

function PriceList({ title, changes, type }: { 
  title: string;
  changes: PriceChange[];
  type: "rise" | "fall";
}) {
  const icon = type === "rise" ? (
    <TrendingUp className="w-5 h-5 shrink-0 text-emerald-500" />
  ) : (
    <TrendingDown className="w-5 h-5 shrink-0 text-rose-500" />
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
          <button
            key={index}
            className="w-full flex items-center justify-between p-2 sm:p-3 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors text-left"
            onClick={() => console.log(`Clicked on ${change.player}`)}
            aria-label={`View details for ${change.player}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {change.position}
              </span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {change.club}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium truncate flex-1">{change.player}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{change.player}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className={`text-xs sm:text-sm font-medium ml-2 shrink-0 ${priceClassName}`}>
              £{change.price.toFixed(1)}m
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PriceChangesSection() {
  return (
    <Card className="rounded-none sm:rounded-lg p-4 sm:p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <PriceList
          title="Price Rises"
          changes={priceRises}
          type="rise"
        />
        <PriceList
          title="Price Falls"
          changes={priceFalls}
          type="fall"
        />
      </div>
    </Card>
  );
}