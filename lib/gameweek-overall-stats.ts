import { executeQuery } from "@/lib/graphql-client";
import {
  GET_EVENT_STATS_BY_ID,
  type EventStatsByIdResponse,
} from "@/lib/graphql/queries";

interface ExecuteQueryOptions {
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
}

export interface OverallGameweekStats {
  averagePoints: number | null;
  highestPoints: number | null;
  mostCaptained: { name: string; count: number | null };
  mostViceCaptained: { name: string };
  mostTransferredIn: { name: string; team: string; count: number | null };
  mostSelectedPlayer: { name: string; id: number | null };
  mostTransferInPlayer: { name: string; id: number | null };
  chipsPlayed: {
    benchBoost: number | null;
    tripleCaptain: number | null;
    wildcard: number | null;
    freeHit: number | null;
  } | null;
}

export const FALLBACK_OVERALL_STATS: OverallGameweekStats = {
  averagePoints: null,
  highestPoints: null,
  mostCaptained: { name: "N/A", count: null },
  mostViceCaptained: { name: "N/A" },
  mostTransferredIn: { name: "N/A", team: "N/A", count: null },
  mostSelectedPlayer: { name: "N/A", id: null },
  mostTransferInPlayer: { name: "N/A", id: null },
  chipsPlayed: { benchBoost: null, tripleCaptain: null, wildcard: null, freeHit: null },
};

interface ChipPlayEntry {
  chipName?: string;
  numberPlayed?: number;
}

const parseChipPlays = (value: unknown): ChipPlayEntry[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChipPlayEntry => typeof item === "object" && item !== null);
};

const chipPlayCount = (chipPlays: ChipPlayEntry[], chipName: string): number | null => {
  const found = chipPlays.find((chip) => chip.chipName === chipName);
  return found?.numberPlayed ?? null;
};

const fetchPlayerNamesByIds = async (
  ids: number[],
  options?: ExecuteQueryOptions,
): Promise<Record<number, string>> => {
  const uniqueIds = Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));
  if (uniqueIds.length === 0) return {};

  const selection = uniqueIds.map((id) => `p${id}: player(id: ${id}) { webName }`).join("\n");
  const query = `query GetPlayerNamesByIds {\n${selection}\n}`;
  const data = await executeQuery<Record<string, { webName?: string | null } | null>>(
    query,
    undefined,
    options,
  );
  const result: Record<number, string> = {};

  for (const id of uniqueIds) {
    const value = data[`p${id}`]?.webName;
    if (typeof value === "string" && value.length > 0) result[id] = value;
  }

  return result;
};

export const fetchOverallGameweekStats = async (
  eventId: number,
  options?: ExecuteQueryOptions,
): Promise<OverallGameweekStats> => {
  const eventStatsData = await executeQuery<EventStatsByIdResponse>(
    GET_EVENT_STATS_BY_ID,
    { eventId },
    options,
  );
  const eventStats = eventStatsData.event ?? null;
  const playerNameMap = await fetchPlayerNamesByIds(
    [
      eventStats?.mostSelected ?? 0,
      eventStats?.mostTransferredIn ?? 0,
      eventStats?.mostCaptained ?? 0,
      eventStats?.mostViceCaptained ?? 0,
    ],
    options,
  );
  const chipPlays = parseChipPlays(eventStats?.chipPlays);

  return {
    averagePoints: eventStats?.averageEntryScore ?? null,
    highestPoints: eventStats?.highestScore ?? null,
    mostCaptained: { name: playerNameMap[eventStats?.mostCaptained ?? -1] ?? "N/A", count: null },
    mostViceCaptained: { name: playerNameMap[eventStats?.mostViceCaptained ?? -1] ?? "N/A" },
    mostTransferredIn: { name: "N/A", team: "N/A", count: null },
    mostSelectedPlayer: {
      name: playerNameMap[eventStats?.mostSelected ?? -1] ?? "N/A",
      id: eventStats?.mostSelected ?? null,
    },
    mostTransferInPlayer: {
      name: playerNameMap[eventStats?.mostTransferredIn ?? -1] ?? "N/A",
      id: eventStats?.mostTransferredIn ?? null,
    },
    chipsPlayed: eventStats
      ? {
          benchBoost: chipPlayCount(chipPlays, "bboost"),
          tripleCaptain: chipPlayCount(chipPlays, "3xc"),
          wildcard: chipPlayCount(chipPlays, "wildcard"),
          freeHit: chipPlayCount(chipPlays, "freehit"),
        }
      : FALLBACK_OVERALL_STATS.chipsPlayed,
  };
};
