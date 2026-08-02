"use client";

import { memo } from "react";
import { Crown, Repeat, Trophy, Zap } from "lucide-react";
import { useTranslations } from "next-intl";

interface TeamStatsProps {
  stats: {
    teamName: string;
    playerName: string;
    livePoints: number;
    transferCost: number;
    captainName: string;
    liveTotalPoints: number;
    played: string;
    chips: {
      bench: boolean;
      triple: boolean;
      wildcard: boolean;
    };
  };
}

function TeamStatsComponent({ stats }: TeamStatsProps) {
  const t = useTranslations("LivePoints");
  const chipLabels: Record<string, string> = {
    bench: t("benchBoost"),
    triple: t("tripleCaptain"),
    wildcard: t("wildcard"),
  };
  return (
    <div className="bg-card rounded-lg shadow-sm overflow-hidden mb-8">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold mb-2 truncate">{stats.teamName}</h2>
            <p className="text-muted-foreground truncate">{stats.playerName}</p>
          </div>

          <div className="flex items-center gap-3 sm:justify-end">
            <div className="flex flex-col items-end">
              <span className="text-xs text-muted-foreground">{t("played")}</span>
              <span className="text-sm font-semibold tabular-nums">{stats.played}</span>
            </div>
            <div className="flex flex-wrap sm:justify-end gap-2">
              {Object.entries(stats.chips).some(([_, active]) => active) ? (
                Object.entries(stats.chips).map(
                  ([chip, active]) =>
                    active && (
                      <span
                        key={chip}
                        className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary-ink"
                      >
                        {chipLabels[chip] ?? chip.toUpperCase()}
                      </span>
                    )
                )
              ) : (
                <span className="text-sm text-muted-foreground">{t("noActiveChips")}</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Zap className="w-5 h-5 text-primary-ink" />
              </div>
              <span className="text-sm text-muted-foreground">{t("livePoints")}</span>
            </div>
            <div className="text-2xl font-bold">{stats.livePoints}</div>
          </div>
          
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Repeat className="w-5 h-5 text-primary-ink" />
              </div>
              <span className="text-sm text-muted-foreground">{t("transferCost")}</span>
            </div>
            <div className="text-2xl font-bold">
              {stats.transferCost > 0 ? (
                <span className="text-destructive">-{stats.transferCost}</span>
              ) : (
                0
              )}
            </div>
          </div>
          
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Crown className="w-5 h-5 text-primary-ink" />
              </div>
              <span className="text-sm text-muted-foreground">{t("captain")}</span>
            </div>
            <div className="text-lg font-bold truncate">{stats.captainName}</div>
          </div>

          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Trophy className="w-5 h-5 text-primary-ink" />
              </div>
              <span className="text-sm text-muted-foreground">{t("liveTotal")}</span>
            </div>
            <div className="text-2xl font-bold">{stats.liveTotalPoints}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TeamStats = memo(TeamStatsComponent);
