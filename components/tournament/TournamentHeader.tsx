"use client";

import { Card } from "@/components/ui/card";
import { Trophy, Users2, BarChart2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

interface TournamentHeaderProps {
  name: string;
  averagePoints: number;
  highestPoints: number;
  totalEntries: number;
}

export function TournamentHeader({
  name,
  averagePoints,
  highestPoints,
  totalEntries
}: TournamentHeaderProps) {
  const t = useTranslations("LiveTournament");
  const format = useFormatter();
  return (
    <Card className="p-6 mb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{name}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-accent/30 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {t("highestScore")}
          </span>
          <span className="text-xl font-bold text-center">{t("pointsValue", { points: highestPoints })}</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            {t("averageScore")}
          </span>
          <span className="text-xl font-bold text-center">{t("pointsValue", { points: averagePoints })}</span>
        </div>

        <div className="bg-accent/30 rounded-lg p-4 flex flex-col items-center text-center">
          <span className="text-muted-foreground text-sm flex items-center justify-center gap-2 mb-2">
            <Users2 className="h-4 w-4 text-emerald-500" />
            {t("totalEntries")}
          </span>
          <span className="text-xl font-bold text-center">{format.number(totalEntries, { notation: "compact" })}</span>
        </div>
      </div>
    </Card>
  );
}
