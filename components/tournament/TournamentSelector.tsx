"use client";

import { ChevronDown, Trophy } from "lucide-react";
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
  tournaments: TournamentSelectorItem[];
  currentTournamentId: string;
  onTournamentChange: (tournamentId: string) => void;
  className?: string;
}

export interface TournamentSelectorItem {
  id: string;
  name: string;
  leagueType?: string | null;
}

type TournamentKind = "classic" | "h2h";

interface TournamentKindSelectorProps {
  kind: TournamentKind;
  tournaments: TournamentSelectorItem[];
  currentTournamentId: string;
  onTournamentChange: (tournamentId: string) => void;
  label: string;
  placeholder: string;
  emptyLabel: string;
}

function TournamentKindSelector({
  kind,
  tournaments,
  currentTournamentId,
  onTournamentChange,
  label,
  placeholder,
  emptyLabel,
}: TournamentKindSelectorProps) {
  const currentTournament = tournaments.find(
    (tournament) => tournament.id === currentTournamentId,
  );
  const isEmpty = tournaments.length === 0;

  const trigger = (
    <Button
      variant="outline"
      disabled={isEmpty}
      className="h-11 w-full min-w-0 justify-between gap-2"
      aria-label={label}
    >
      <span className="min-w-0 truncate text-left">
        {currentTournament?.name ?? (isEmpty ? emptyLabel : placeholder)}
      </span>
      <ChevronDown
        className="h-4 w-4 shrink-0 opacity-50"
        aria-hidden="true"
      />
    </Button>
  );

  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground">
        <span>{label}</span>
        <span className="rounded-full border border-border/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]">
          {kind === "h2h" ? "H2H" : "Classic"}
        </span>
      </div>

      {isEmpty ? (
        trigger
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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
                  className="flex min-w-0 items-center justify-between gap-2"
                >
                  <span className="min-w-0 truncate">{tournament.name}</span>
                  {isCurrent ? (
                    <Trophy
                      className="h-4 w-4 shrink-0 text-primary-ink"
                      aria-hidden="true"
                    />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

export function TournamentSelector({
  tournaments,
  currentTournamentId,
  onTournamentChange,
  className,
}: TournamentSelectorProps) {
  const t = useTranslations("Common");
  const liveT = useTranslations("LiveTournament");
  const classicTournaments = tournaments.filter(
    (tournament) => tournament.leagueType !== "H2H",
  );
  const h2hTournaments = tournaments.filter(
    (tournament) => tournament.leagueType === "H2H",
  );

  return (
    <Card className={className ?? "mb-6 p-4"}>
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end">
        <div className="flex shrink-0 items-center gap-2 pb-2 sm:pb-0">
          <Trophy className="h-5 w-5 shrink-0 text-primary-ink" aria-hidden="true" />
          <span className="font-medium">{t("selectTournament")}</span>
        </div>

        <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
          <TournamentKindSelector
            kind="classic"
            tournaments={classicTournaments}
            currentTournamentId={currentTournamentId}
            onTournamentChange={onTournamentChange}
            label={liveT("classicSelector")}
            placeholder={liveT("selectClassic")}
            emptyLabel={liveT("noClassic")}
          />
          <TournamentKindSelector
            kind="h2h"
            tournaments={h2hTournaments}
            currentTournamentId={currentTournamentId}
            onTournamentChange={onTournamentChange}
            label={liveT("h2hSelector")}
            placeholder={liveT("selectHeadToHead")}
            emptyLabel={liveT("noHeadToHead")}
          />
        </div>
      </div>
    </Card>
  );
}
