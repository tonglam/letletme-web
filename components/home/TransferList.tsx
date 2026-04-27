"use client";

import { Badge } from "@/components/ui/badge";
import { formatCompactNumber, normalizePosition } from "@/lib/utils";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

interface Transfer {
  position: string;
  player: string;
  club: string;
  transfers: number;
  selectedByPercent?: number | null;
  points?: number | null;
}

interface TransferListProps {
  title: string;
  transfers: Transfer[];
  type: "in" | "out";
}

export function TransferList({ title, transfers, type }: TransferListProps) {
  const icon = type === "in" ? (
    <ArrowRightCircle className="w-5 h-5 shrink-0 text-emerald-500" />
  ) : (
    <ArrowLeftCircle className="w-5 h-5 shrink-0 text-rose-500" />
  );

  const valueClassName = type === "in" 
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";

  const bgClassName = type === "in"
    ? "border-emerald-200 dark:border-emerald-900"
    : "border-rose-200 dark:border-rose-900";

  const getPositionColor = (position: string) => {
    switch (normalizePosition(position)) {
      case "GKP": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "DEF": return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
      case "MID": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case "FWD": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-xl font-bold">{title}</h3>
        {transfers.length > 0 && (
          <Badge variant="secondary" className="ml-auto">
            {transfers.length}
          </Badge>
        )}
      </div>
      <div className={`space-y-2 rounded-lg p-3 border ${bgClassName} flex-1`}>
        {transfers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No transfers to display
          </div>
        ) : (
          transfers.map((transfer, index) => (
            <button
              key={index}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-background/80 hover:bg-background border border-border/50 hover:border-border transition-all text-left group"
              onClick={() => console.log(`Clicked on ${transfer.player}`)}
              aria-label={`View details for ${transfer.player}`}
            >
              <Badge 
                variant="secondary" 
                className={`shrink-0 text-xs font-semibold ${getPositionColor(transfer.position)}`}
              >
                {normalizePosition(transfer.position)}
              </Badge>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                    {transfer.player}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground truncate block">
                  {[
                    transfer.club || "",
                    `Sel ${
                      typeof transfer.selectedByPercent === "number"
                        ? `${transfer.selectedByPercent.toFixed(1)}%`
                        : "-"
                    }`,
                    `Pts ${typeof transfer.points === "number" ? transfer.points : "-"}`,
                  ]
                    .filter((part) => part.length > 0)
                    .join(" | ")}
                </span>
              </div>

              <div className="flex flex-col items-end shrink-0">
                <span className={`text-base font-bold ${valueClassName}`}>
                  {formatCompactNumber(transfer.transfers)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
