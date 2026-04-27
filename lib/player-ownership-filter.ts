export type OwnershipScope = "any" | "starter" | "bench";
export type OwnershipCaptainMode =
  | "any"
  | "selectedCaptain"
  | "selectedViceCaptain";

export interface OwnershipPick {
  element: number;
  position: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
}

export interface OwnershipEntry {
  id: string;
  picks: OwnershipPick[];
}

export interface OwnershipFilterSummary {
  matchedEntryIds: string[];
  matchedCount: number;
  totalCount: number;
  percentage: number;
}

const pickMatchesScope = (pick: OwnershipPick, scope: OwnershipScope) => {
  if (scope === "starter") {
    return pick.position <= 11;
  }

  if (scope === "bench") {
    return pick.position > 11;
  }

  return true;
};

export const entryMatchesOwnershipFilter = (
  entry: OwnershipEntry,
  selectedPlayerIds: number[],
  scope: OwnershipScope,
  captainMode: OwnershipCaptainMode = "any"
) => {
  if (selectedPlayerIds.length === 0) {
    return true;
  }

  const matchedPlayerIds = selectedPlayerIds.filter((playerId) =>
    entry.picks.some(
      (pick) => pick.element === playerId && pickMatchesScope(pick, scope)
    )
  );

  if (matchedPlayerIds.length !== selectedPlayerIds.length) {
    return false;
  }

  if (captainMode === "selectedCaptain") {
    const matchedSet = new Set(matchedPlayerIds);
    return entry.picks.some(
      (pick) => pick.isCaptain === true && matchedSet.has(pick.element)
    );
  }

  if (captainMode === "selectedViceCaptain") {
    const matchedSet = new Set(matchedPlayerIds);
    return entry.picks.some(
      (pick) => pick.isViceCaptain === true && matchedSet.has(pick.element)
    );
  }

  return true;
};

export const getOwnershipFilterSummary = (
  entries: OwnershipEntry[],
  selectedPlayerIds: number[],
  scope: OwnershipScope,
  captainMode: OwnershipCaptainMode = "any"
): OwnershipFilterSummary => {
  const matchedEntryIds =
    selectedPlayerIds.length === 0
      ? entries.map((entry) => entry.id)
      : entries
          .filter((entry) =>
            entryMatchesOwnershipFilter(
              entry,
              selectedPlayerIds,
              scope,
              captainMode
            )
          )
          .map((entry) => entry.id);

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
