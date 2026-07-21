import { NextResponse } from 'next/server';

import { getAuthorizationSession } from '@/lib/auth';
import { tournamentApiFetch } from '@/lib/tournament/backend-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let session;
  try {
    session = await getAuthorizationSession(request.headers);
  } catch {
    return NextResponse.json({ available: false, message: 'Authentication unavailable.' }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ available: false, message: 'Unauthenticated.' }, { status: 401 });
  }
  if (!session.user.fplEntryVerifiedAt || !session.user.fplEntryId) {
    return NextResponse.json(
      { available: false, message: 'A verified FPL entry is required.' },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') ?? '').trim();
    if (name.length < 3 || name.length > 80) {
      return NextResponse.json(
        { available: false, message: 'Tournament name must be 3-80 characters.' },
        { status: 400 },
      );
    }
    const response = await tournamentApiFetch(
      `/tournaments/check-name?name=${encodeURIComponent(name)}`,
      undefined,
      request,
    );

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[tournaments] name check failed:', error);
    return NextResponse.json(
      { available: false, message: 'Tournament service is unavailable.' },
      { status: 502 },
    );
  }
}
