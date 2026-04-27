import 'server-only';

const DEFAULT_TIMEOUT_MS = 15_000;

const normalizeOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}`;
  } catch {
    return value.replace(/\/+$/, '');
  }
};

export const getTournamentApiBaseUrl = (request?: Request): string => {
  const configuredBaseUrl =
    process.env.TOURNAMENT_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? '';

  if (!configuredBaseUrl) {
    throw new Error('TOURNAMENT_API_BASE_URL is not configured.');
  }

  if (request) {
    const requestOrigin = new URL(request.url).origin;
    if (normalizeOrigin(configuredBaseUrl) === requestOrigin) {
      throw new Error(
        'TOURNAMENT_API_BASE_URL points to the web app origin. Configure it to the backend API.',
      );
    }
  }

  return configuredBaseUrl.replace(/\/+$/, '');
};

export async function tournamentApiFetch(
  path: string,
  init?: RequestInit,
  request?: Request,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const baseUrl = getTournamentApiBaseUrl(request);

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Tournament backend timed out after ${DEFAULT_TIMEOUT_MS / 1000}s: ${baseUrl}`);
    }

    throw new Error(`Tournament backend is unavailable: ${baseUrl}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
