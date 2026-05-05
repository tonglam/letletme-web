import 'server-only';

export type LeagueType = 'classic' | 'h2h';

export interface TournamentParticipant {
  id: string;
  team: string;
  manager: string;
  overallRank: number;
  totalPoints: number;
}

type ParsedLeagueUrl = {
  leagueId: number;
  leagueType: LeagueType;
};

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

type RawStandingsResponse = {
  standings?: {
    results?: RawStandingsResult[];
    has_next?: boolean;
  };
};

const FPL_HOSTNAME = 'fantasy.premierleague.com';
const FPL_API_BASE_URL = 'https://fantasy.premierleague.com/api';

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

const inferLeagueType = (segments: string[]): LeagueType => {
  const standingsIndex = segments.findIndex((segment) => segment === 'standings');
  const suffix = standingsIndex >= 0 ? segments[standingsIndex + 1] : null;

  if (suffix === 'h' || suffix === 'h2h') {
    return 'h2h';
  }

  return 'classic';
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

export const parseLeagueUrl = (rawUrl: string): ParsedLeagueUrl => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error('Please enter a complete Fantasy Premier League URL.');
  }

  if (parsedUrl.hostname !== FPL_HOSTNAME) {
    throw new Error("Only URLs from fantasy.premierleague.com are allowed.");
  }

  const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
  if (pathSegments.length < 3 || pathSegments[0] !== 'leagues') {
    throw new Error('Unsupported league URL format.');
  }

  const leagueId = Number(pathSegments[1]);
  if (!Number.isInteger(leagueId) || leagueId <= 0) {
    throw new Error('League ID could not be parsed from the URL.');
  }

  return {
    leagueId,
    leagueType: inferLeagueType(pathSegments),
  };
};

export const fetchLeagueParticipants = async (
  leagueUrl: string,
): Promise<{
  leagueId: number;
  leagueType: LeagueType;
  participants: TournamentParticipant[];
}> => {
  const { leagueId, leagueType } = parseLeagueUrl(leagueUrl);
  const endpointBase =
    leagueType === 'h2h'
      ? `${FPL_API_BASE_URL}/leagues-h2h/${leagueId}/standings/`
      : `${FPL_API_BASE_URL}/leagues-classic/${leagueId}/standings/`;

  const participantMap = new Map<string, TournamentParticipant>();
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const response = await fetch(`${endpointBase}?page_standings=${page}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch league standings (HTTP ${response.status}).`);
    }

    const payload = (await response.json()) as RawStandingsResponse;
    const results = payload.standings?.results;

    if (!Array.isArray(results)) {
      throw new Error('League standings response is missing participant results.');
    }

    for (const result of results) {
      const participant = mapStandingToParticipant(result);
      if (!participant) {
        continue;
      }
      participantMap.set(participant.id, participant);
    }

    hasNext = payload.standings?.has_next === true;
    page += 1;

    if (page > 100) {
      throw new Error('League standings pagination exceeded the safety limit.');
    }
  }

  const participants = Array.from(participantMap.values());
  if (participants.length === 0) {
    throw new Error('No participants were found for that league.');
  }

  return {
    leagueId,
    leagueType,
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
