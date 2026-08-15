import { NextResponse } from 'next/server';

import type { Session } from '@/lib/auth';
import { tournamentApiFetch } from '@/lib/tournament/backend-client';
import { executeServerQueryWithSession } from '@/lib/graphql-server';
import { getVerifiedEntryContext } from '@/lib/session';
import {
  GET_TOURNAMENT_METADATA,
  type TournamentMetadataResponse,
} from '@/lib/graphql/operations/tournaments';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
	let session: Session | null;
	try {
		session = (await getVerifiedEntryContext()).session;
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

    const tournamentId = Number(id);
	const access = await executeServerQueryWithSession<TournamentMetadataResponse>(
	      session,
	      GET_TOURNAMENT_METADATA,
      { tournamentId, entryId: session.user.fplEntryId },
      { cache: 'no-store' },
    );
    if (!access.tournament) {
      return NextResponse.json({ success: false, error: 'Tournament not found.' }, { status: 404 });
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
