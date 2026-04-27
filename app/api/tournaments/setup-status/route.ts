import { NextResponse } from 'next/server';

import { tournamentApiFetch } from '@/lib/tournament/backend-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Tournament id is required.' },
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
    const message =
      error instanceof Error ? error.message : 'Failed to fetch tournament setup status.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
