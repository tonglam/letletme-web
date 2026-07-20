import { NextResponse } from 'next/server';

import { getAuthorizationSession } from '@/lib/auth';
import {
  buildOpaqueRateLimitSubject,
  checkDatabaseRateLimit,
} from '@/lib/http-security';
import { fetchLeagueParticipants } from '@/lib/tournament/create-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let session;
  try {
    session = await getAuthorizationSession(request.headers);
  } catch {
    return NextResponse.json({ error: 'Authentication unavailable.' }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 });
  }
  if (!session.user.fplEntryVerifiedAt || !session.user.fplEntryId) {
    return NextResponse.json({ error: 'A verified FPL entry is required.' }, { status: 403 });
  }

  const secret = process.env.BACKEND_PROXY_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Request safety checks are unavailable.' }, { status: 503 });
  }
  try {
    const rate = await checkDatabaseRateLimit({
      scope: 'tournament-participants-preview',
      subject: buildOpaqueRateLimitSubject(request.headers, secret),
      limit: 10,
      windowSeconds: 60,
    });
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Too many participant preview requests.' },
        { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
      );
    }
  } catch (error) {
    console.error('[tournament participants] rate-limit storage unavailable:', error);
    return NextResponse.json({ error: 'Request safety checks are unavailable.' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const leagueUrl = searchParams.get('leagueUrl');

  if (!leagueUrl) {
    return NextResponse.json({ error: 'leagueUrl is required.' }, { status: 400 });
  }

  try {
    const result = await fetchLeagueParticipants(leagueUrl);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch tournament participants.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
