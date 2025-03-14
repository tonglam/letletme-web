"use client";

import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompactNumber } from "@/lib/utils";

interface Transfer {
  position: string;
  player: string;
  club: string;
  transfers: number;
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

  return (
    <div>
      <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      <div className="space-y-2 bg-background/50 rounded-lg p-2 sm:p-3">
        {transfers.map((transfer, index) => (
          <button
            key={index}
            className="w-full flex items-center justify-between p-2 sm:p-3 rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors text-left"
            onClick={() => console.log(`Clicked on ${transfer.player}`)}
            aria-label={`View details for ${transfer.player}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {transfer.position}
              </span>
              <span className="text-xs sm:text-sm font-medium text-muted-foreground w-8 shrink-0">
                {transfer.club}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm font-medium truncate flex-1">{transfer.player}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{transfer.player}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className={`text-xs sm:text-sm font-medium ml-2 shrink-0 ${valueClassName}`}>
              {formatCompactNumber(transfer.transfers)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}