import { NextResponse } from 'next/server';

import { fetchLeagueParticipants } from '@/lib/tournament/create-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const leagueUrl = searchParams.get('leagueUrl');

  if (!leagueUrl) {
    return NextResponse.json({ error: 'leagueUrl is required.' }, { status: 400 });
  }

  try {
    const result = await fetchLeagueParticipants(leagueUrl);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch tournament participants.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
