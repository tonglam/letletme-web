import { parseLeagueUrl } from './league-url'

export class InvalidTournamentPayloadError extends Error {
  constructor(message = 'Invalid tournament payload.') {
    super(message);
    this.name = 'InvalidTournamentPayloadError';
  }
}

export function buildAuthoritativeTournamentPayload(
  body: unknown,
  user: { fplEntryId: number; name?: string | null },
): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new InvalidTournamentPayloadError();
  }
  if (!Number.isSafeInteger(user.fplEntryId) || user.fplEntryId <= 0) {
    throw new InvalidTournamentPayloadError('A verified FPL entry is required.');
  }

  const creator = user.name?.trim() || `FPL ${user.fplEntryId}`;
  const record = body as Record<string, unknown>;
  const { creationMode, ...browserPayload } = record;

  if (creationMode !== undefined && creationMode !== 'classic' && creationMode !== 'custom') {
    throw new InvalidTournamentPayloadError('Unsupported tournament creation mode.');
  }

  if (creationMode === 'classic') {
    if (typeof browserPayload.leagueUrl !== 'string') {
      throw new InvalidTournamentPayloadError('A classic league URL is required.');
    }
    let parsedLeague;
    try {
      parsedLeague = parseLeagueUrl(browserPayload.leagueUrl);
    } catch {
      throw new InvalidTournamentPayloadError('A valid classic league URL is required.');
    }
    if (parsedLeague.leagueType !== 'classic' || parsedLeague.surface !== 'standings') {
      throw new InvalidTournamentPayloadError('Head-to-head league import is not available yet.');
    }
    if (
      typeof browserPayload.tournamentName !== 'string' ||
      browserPayload.tournamentName.trim().length < 3 ||
      browserPayload.tournamentName.trim().length > 80
    ) {
      throw new InvalidTournamentPayloadError('Tournament name must be between 3 and 80 characters.');
    }
    const startGameweek =
      typeof browserPayload.startGameweek === 'string' &&
      /^GW(?:[1-9]|[12]\d|3[0-8])$/.test(browserPayload.startGameweek)
        ? browserPayload.startGameweek
        : 'GW1';

    return {
      tournamentName: browserPayload.tournamentName.trim(),
      participantSource: 'official',
      tournamentType: 'standard',
      leagueUrl: browserPayload.leagueUrl.trim(),
      groupFormat: 'points',
      startGameweek,
      endGameweek: 'GW38',
      groupNum: '1',
      qualifiersPerGroup: '',
      knockoutFormat: 'none',
      adminId: String(user.fplEntryId),
      creator,
    };
  }

  return {
    ...browserPayload,
    // Identity is server-owned. Browser values with the same names are always
    // overwritten before the command crosses the trust boundary.
    adminId: String(user.fplEntryId),
    creator,
  };
}
