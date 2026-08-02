"use client";

import { Badge } from "@/components/ui/badge";
import { positionBadgeClass } from "@/lib/position-style";
import { normalizePosition } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface PlayerListItem {
  id: number;
  name: string;
  position: string;
  team?: string | null;
  points?: number | null;
}

export function PlayerList({
  players,
  emptyText,
}: {
  players: PlayerListItem[];
  emptyText?: string;
}) {
  const t = useTranslations("PlayerDirectory");

  if (players.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">{emptyText ?? t("noPlayersAvailable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {players.map((player) => {
        const position = normalizePosition(player.position);

        return (
          <div
            key={player.id}
            className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-background/80 p-3 text-left"
          >
            <Badge
              variant="secondary"
              className={`shrink-0 text-xs font-semibold ${positionBadgeClass(position)}`}
            >
              {position}
            </Badge>

            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold truncate block">
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
                <span className="text-lg font-bold text-primary-ink">
                  {player.points}
                </span>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
