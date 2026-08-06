"use client";

import { Tournament } from "@/types/tournament";
import { Trophy, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface TournamentSelectorProps {
  tournaments: Tournament[];
  currentTournamentId: string;
  onTournamentChange: (tournamentId: string) => void;
  className?: string;
}

export function TournamentSelector({
  tournaments,
  currentTournamentId,
  onTournamentChange,
  className,
}: TournamentSelectorProps) {
  const t = useTranslations("Common");
  const currentTournament = tournaments.find(t => t.id === currentTournamentId) || tournaments[0];

  return (
    <Card className={className ?? "mb-6 p-4"}>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
          <span className="font-medium">{t("selectTournament")}</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between sm:max-w-md sm:flex-1"
              aria-label={t("selectTournament")}
            >
              <span className="truncate">{currentTournament?.name ?? "—"}</span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[16rem]"
            align="start"
          >
            {tournaments.map((tournament) => {
              const isCurrent = tournament.id === currentTournamentId;
              return (
                <DropdownMenuItem
                  key={tournament.id}
                  disabled={isCurrent}
                  onSelect={() => {
                    if (!isCurrent) onTournamentChange(tournament.id);
                  }}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">{tournament.name}</span>
                  {isCurrent ? (
                    <Trophy className="h-4 w-4 shrink-0 text-primary-ink" aria-hidden="true" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Card>
  );
}
