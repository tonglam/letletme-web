import { teamFullNames, type Team } from "@/types/common";

const TEAM_DISPLAY_OVERRIDES: Record<string, string> = {
  IPS: "Ipswich Town",
  LEE: "Leeds United",
  LEI: "Leicester City",
  SOU: "Southampton",
};

export const resolveTeamDisplayName = (
  teamShortName: string,
  teamName?: string | null
) => {
  const short = teamShortName.trim().toUpperCase();
  const rawName = teamName?.trim();

  if (rawName && rawName.length > 3 && rawName.toUpperCase() !== short) {
    return rawName;
  }

  return (
    TEAM_DISPLAY_OVERRIDES[short] ??
    teamFullNames[short as Team] ??
    rawName ??
    short
  );
};
