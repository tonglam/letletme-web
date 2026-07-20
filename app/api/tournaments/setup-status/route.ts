import { NextResponse } from 'next/server';

import { getAuthorizationSession } from '@/lib/auth';
import { tournamentApiFetch } from '@/lib/tournament/backend-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let session;
  try {
    session = await getAuthorizationSession(request.headers);
  } catch {
    return NextResponse.json({ success: false, error: 'Authentication unavailable.' }, { status: 503 });
  }
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthenticated.' }, { status: 401 });
  }
  if (!session.user.fplEntryVerifiedAt || !session.user.fplEntryId) {
    return NextResponse.json(
      { success: false, error: 'A verified FPL entry is required.' },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
      return NextResponse.json(
        { success: false, error: 'A valid tournament id is required.' },
        { status: 400 },
      );
    }

    const response = await tournamentApiFetch(
      `/tournaments/${encodeURIComponent(id)}/setup-status`,
      undefined,
      request,
    );

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[tournaments] setup status failed:', error);
    return NextResponse.json(
      { success: false, error: 'Tournament service is unavailable.' },
      { status: 502 },
    );
  }
}
