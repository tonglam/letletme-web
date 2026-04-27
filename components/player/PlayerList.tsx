"use client";

import { Badge } from "@/components/ui/badge";
import { normalizePosition, type PositionCode } from "@/lib/utils";

export interface PlayerListItem {
  id: number;
  name: string;
  position: string;
  team?: string | null;
  points?: number | null;
}

const getPositionColor = (position: PositionCode) => {
  switch (position) {
    case "GKP":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "DEF":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "MID":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
    case "FWD":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
};

export function PlayerList({
  players,
  emptyText,
}: {
  players: PlayerListItem[];
  emptyText?: string;
}) {
  if (players.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">{emptyText ?? "No players available"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.map((player) => {
        const position = normalizePosition(player.position);

        return (
          <button
            key={player.id}
            className="w-full flex items-center gap-3 p-3 rounded-lg bg-background/80 hover:bg-background border border-border/50 hover:border-border transition-all text-left group"
            onClick={() => console.log(`Clicked on ${player.name}`)}
            aria-label={`View details for ${player.name}`}
          >
            <Badge
              variant="secondary"
              className={`shrink-0 text-xs font-semibold ${getPositionColor(position)}`}
            >
              {position}
            </Badge>

            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold truncate group-hover:text-primary transition-colors block">
                {player.name}
              </span>
              {player.team ? (
                <span className="text-xs text-muted-foreground truncate block">
                  {player.team}
                </span>
              ) : null}
            </div>

            {typeof player.points === "number" ? (
              <div className="flex flex-col items-end shrink-0">
                <span className="text-lg font-bold text-primary">
                  {player.points}
                </span>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
