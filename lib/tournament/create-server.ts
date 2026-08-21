import 'server-only';

import { z } from 'zod';
import {
	parseLeagueUrl as parseOfficialLeagueUrl,
	type LeagueType,
	type ParsedLeagueUrl,
} from './league-url';

export type { LeagueType } from './league-url';

export interface TournamentParticipant {
  id: string;
  team: string;
  manager: string;
  overallRank: number;
  totalPoints: number;
}

type RawStandingsResult = {
  entry?: number;
  entry_name?: string;
  player_name?: string;
  player_first_name?: string;
  player_last_name?: string;
  rank?: number | string | null;
  rank_sort?: number | string | null;
  total?: number | string | null;
};

const RawStandingsResultSchema: z.ZodType<RawStandingsResult> = z
  .object({
    entry: z.number().int().positive().optional(),
    entry_name: z.string().optional(),
    player_name: z.string().optional(),
    player_first_name: z.string().optional(),
    player_last_name: z.string().optional(),
    rank: z.union([z.number(), z.string()]).nullable().optional(),
    rank_sort: z.union([z.number(), z.string()]).nullable().optional(),
    total: z.union([z.number(), z.string()]).nullable().optional(),
  })
  .passthrough();

const RawStandingsResponseSchema = z
  .object({
    league: z
      .object({
        id: z.number().int().positive(),
        name: z.string(),
        start_event: z.number().int().min(1).max(38).optional(),
        scoring: z.string().optional(),
      })
      .passthrough()
      .optional(),
    standings: z.object({
      results: z.array(RawStandingsResultSchema),
      has_next: z.boolean().optional(),
    }),
    new_entries: z
      .object({
        results: z.array(RawStandingsResultSchema),
        has_next: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

const FPL_API_BASE_URL = 'https://fantasy.premierleague.com/api';
const FPL_PAGE_TIMEOUT_MS = 10_000;
const FPL_TOTAL_TIMEOUT_MS = 30_000;
const MAX_STANDINGS_PAGES = 100;

const unwrapEnvValue = (value: string): string => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const toPositiveNumber = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
};

const mapStandingToParticipant = (result: RawStandingsResult): TournamentParticipant | null => {
  const entryId = toPositiveNumber(result.entry);
  if (!entryId) {
    return null;
  }

  const team = result.entry_name?.trim();
  const manager =
    result.player_name?.trim() ||
    `${result.player_first_name ?? ''} ${result.player_last_name ?? ''}`.trim();

  return {
    id: String(entryId),
    team: team && team.length > 0 ? team : `Entry ${entryId}`,
    manager: manager.length > 0 ? manager : `Manager ${entryId}`,
    overallRank: toPositiveNumber(result.rank) ?? toPositiveNumber(result.rank_sort) ?? 0,
    totalPoints: toPositiveNumber(result.total) ?? 0,
  };
};

export const parseLeagueUrl = (rawUrl: string): ParsedLeagueUrl =>
	parseOfficialLeagueUrl(rawUrl);

export const fetchLeagueParticipants = async (
  leagueUrl: string,
): Promise<{
  leagueId: number;
  leagueType: LeagueType;
  leagueName: string;
  startEvent: number;
  participants: TournamentParticipant[];
}> => {
  const { leagueId, leagueType } = parseLeagueUrl(leagueUrl);
  const endpointBase =
    leagueType === 'h2h'
      ? `${FPL_API_BASE_URL}/leagues-h2h/${leagueId}/standings/`
      : `${FPL_API_BASE_URL}/leagues-classic/${leagueId}/standings/`;

  const participantMap = new Map<string, TournamentParticipant>();
  let leagueName = `FPL League ${leagueId}`;
  let startEvent = 1;
  let standingsPage = 1;
  let newEntriesPage = 1;
  let readStandings = true;
  let readNewEntries = true;
  const deadline = Date.now() + FPL_TOTAL_TIMEOUT_MS;

  while (readStandings || readNewEntries) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      throw new Error('League standings request exceeded the 30 second safety limit.');
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      Math.min(FPL_PAGE_TIMEOUT_MS, remainingMs),
    );
    let response: Response;
    try {
      response = await fetch(
        `${endpointBase}?page_standings=${standingsPage}&page_new_entries=${newEntriesPage}`,
        {
          cache: 'no-store',
          signal: controller.signal,
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('League standings request timed out.');
      }
      throw new Error('Fantasy Premier League standings are unavailable.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch league standings (HTTP ${response.status}).`);
    }

    const parsed = RawStandingsResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error('League standings response has an invalid shape.');
    if (parsed.data.league) {
      leagueName = parsed.data.league.name.trim() || leagueName;
      startEvent = parsed.data.league.start_event ?? startEvent;
    }
    // Ranked standings are the stronger source when FPL briefly exposes the
    // same entry in both cursors. They include current rank and total points.
    for (const result of readStandings ? parsed.data.standings.results : []) {
      const participant = mapStandingToParticipant(result);
      if (!participant) continue;
      participantMap.set(participant.id, participant);
    }

    for (const result of readNewEntries ? (parsed.data.new_entries?.results ?? []) : []) {
      const participant = mapStandingToParticipant(result);
      if (participant && !participantMap.has(participant.id)) {
        participantMap.set(participant.id, participant);
      }
    }

    const standingsHasNext: boolean =
      readStandings && parsed.data.standings.has_next === true;
    const newEntriesHasNext: boolean =
      readNewEntries && parsed.data.new_entries?.has_next === true;
    if (standingsHasNext) standingsPage += 1;
    if (newEntriesHasNext) newEntriesPage += 1;
    readStandings = standingsHasNext;
    readNewEntries = newEntriesHasNext;

    if (standingsPage > MAX_STANDINGS_PAGES || newEntriesPage > MAX_STANDINGS_PAGES) {
      throw new Error('League membership pagination exceeded the safety limit.');
    }
  }

  const participants = Array.from(participantMap.values());
  if (participants.length === 0) {
    throw new Error('No participants were found for that league.');
  }

  return {
    leagueId,
    leagueType,
    leagueName,
    startEvent,
    participants,
  };
};

export const parseGameweek = (value?: string | null): number | null => {
  if (!value || value.trim().length === 0) {
    return null;
  }

  const match = value.match(/^GW(\d{1,2})$/i);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 38 ? parsed : null;
};

export const readEnvValue = (key: string): string | null => {
  const directValue = process.env[key];
  if (directValue && directValue.trim().length > 0) {
    return unwrapEnvValue(directValue);
  }

  return null;
};

export const getDatabaseUrl = (): string => {
  const databaseUrl = readEnvValue('DATABASE_URL');
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured for tournament creation.');
  }
  return databaseUrl;
};

export const normalizeTournamentName = (value: string): string => value.trim();
