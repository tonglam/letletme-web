import { NextResponse } from 'next/server'

import { readBoundedJson } from '@/lib/http-security'
import { getVerifiedEntryContext } from '@/lib/session'
import { tournamentApiFetch } from '@/lib/tournament/backend-client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const { entryId } = await getVerifiedEntryContext()
	if (!entryId) return NextResponse.json({ error: 'A verified FPL entry is required.' }, { status: 403 })
	try {
		const body = await readBoundedJson(request, 32 * 1024)
		const leagueUrl = body && typeof body === 'object' && !Array.isArray(body)
			? (body as Record<string, unknown>).leagueUrl
			: null
		if (typeof leagueUrl !== 'string' || leagueUrl.trim().length === 0 || leagueUrl.length > 512) {
			return NextResponse.json({ error: 'A valid league URL is required.' }, { status: 400 })
		}
		const response = await tournamentApiFetch(
			'/tournaments/preview',
			{ method: 'POST', body: JSON.stringify({ leagueUrl: leagueUrl.trim(), ownerEntryId: entryId }), signal: request.signal },
			request
		)
		const result = await response.json().catch(() => ({})) as Record<string, unknown>
		if (!response.ok) return NextResponse.json(result, { status: response.status })
		const league = result.league && typeof result.league === 'object' ? result.league as Record<string, unknown> : {}
		return NextResponse.json({
			previewToken: result.previewToken,
			expiresAt: result.expiresAt,
			sourceCheckedAt: result.sourceCheckedAt,
			leagueId: league.id,
			leagueType: league.type,
			leagueName: league.name,
			startEvent: league.startEventId,
			participants: result.participants,
		}, { headers: { 'Cache-Control': 'private, no-store, no-transform' } })
	} catch (error) {
		console.error('[tournament preview] request failed:', error instanceof Error ? error.name : 'UnknownError')
		return NextResponse.json({ error: 'Tournament preview is unavailable.' }, { status: 502 })
	}
}
