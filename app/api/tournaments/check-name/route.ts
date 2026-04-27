import { NextResponse } from 'next/server';

import { tournamentApiFetch } from '@/lib/tournament/backend-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') ?? '';
    const response = await tournamentApiFetch(
      `/tournaments/check-name?name=${encodeURIComponent(name)}`,
      undefined,
      request,
    );

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to check tournament name.';
    return NextResponse.json({ available: false, message }, { status: 500 });
  }
}
