import type { OwnershipScope } from "./player-ownership-filter";

export interface TeamExposurePick {
  teamShortName: string;
  teamName: string;
  position: number;
}

export interface TeamExposureEntry {
  id: string;
  picks: TeamExposurePick[];
}

export interface TeamExposureFilterSummary {
  matchedEntryIds: string[];
  matchedCount: number;
  totalCount: number;
  percentage: number;
}

const pickMatchesScope = (pick: TeamExposurePick, scope: OwnershipScope) => {
  if (scope === "starter") return pick.position <= 11;
  if (scope === "bench") return pick.position > 11;
  return true;
};

export const getTeamExposureFilterSummary = (
  entries: TeamExposureEntry[],
  teamShortName: string | null,
  exactCount: number,
  scope: OwnershipScope
): TeamExposureFilterSummary => {
  const matchedEntryIds =
    !teamShortName
      ? entries.map((e) => e.id)
      : entries
          .filter((entry) => {
            const count = entry.picks.filter(
              (p) =>
                p.teamShortName === teamShortName &&
                pickMatchesScope(p, scope)
            ).length;
            return count === exactCount;
          })
          .map((e) => e.id);

  const totalCount = entries.length;
  const matchedCount = matchedEntryIds.length;

  return {
    matchedEntryIds,
    matchedCount,
    totalCount,
    percentage:
      totalCount === 0 ? 0 : Math.round((matchedCount / totalCount) * 100),
  };
};

