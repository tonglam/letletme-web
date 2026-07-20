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
  return {
    ...(body as Record<string, unknown>),
    // Identity is server-owned. Browser values with the same names are always
    // overwritten before the command crosses the trust boundary.
    adminId: String(user.fplEntryId),
    creator,
  };
}
