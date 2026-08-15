import { NextResponse } from 'next/server'

import {
	buildOpaqueRateLimitSubject,
	checkDatabaseRateLimit,
	PayloadTooLargeError,
	readBoundedJson
} from '@/lib/http-security'
import { getVerifiedEntryContext } from '@/lib/session'
import { tournamentApiFetch } from '@/lib/tournament/backend-client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const { entryId } = await getVerifiedEntryContext()
	if (!entryId)
		return NextResponse.json(
			{ error: 'A verified FPL entry is required.' },
			{ status: 403 }
		)
	const secret = process.env.BACKEND_PROXY_SECRET
	if (!secret) {
		return NextResponse.json(
			{ error: 'Request safety checks are unavailable.' },
			{ status: 503 }
		)
	}
	try {
		const rate = await checkDatabaseRateLimit({
			scope: 'tournament-preview',
			subject: buildOpaqueRateLimitSubject(request.headers, secret),
			limit: 10,
			windowSeconds: 60
		})
		if (!rate.allowed) {
			return NextResponse.json(
				{ error: 'Too many tournament preview requests.' },
				{
					status: 429,
					headers: { 'Retry-After': String(rate.retryAfterSeconds) }
				}
			)
		}
	} catch (error) {
		console.error('[tournament preview] rate-limit storage unavailable:', error)
		return NextResponse.json(
			{ error: 'Request safety checks are unavailable.' },
			{ status: 503 }
		)
	}
	try {
		const body = await readBoundedJson(request, 32 * 1024)
		const leagueUrl =
			body && typeof body === 'object' && !Array.isArray(body)
				? (body as Record<string, unknown>).leagueUrl
				: null
		if (
			typeof leagueUrl !== 'string' ||
			leagueUrl.trim().length === 0 ||
			leagueUrl.length > 512
		) {
			return NextResponse.json(
				{ error: 'A valid league URL is required.' },
				{ status: 400 }
			)
		}
		const response = await tournamentApiFetch(
			'/tournaments/preview',
			{
				method: 'POST',
				body: JSON.stringify({
					leagueUrl: leagueUrl.trim(),
					ownerEntryId: entryId
				}),
				signal: request.signal
			},
			request
		)
		const result = (await response.json().catch(() => ({}))) as Record<
			string,
			unknown
		>
		if (!response.ok)
			return NextResponse.json(result, { status: response.status })
		const league =
			result.league && typeof result.league === 'object'
				? (result.league as Record<string, unknown>)
				: {}
		return NextResponse.json(
			{
				previewToken: result.previewToken,
				expiresAt: result.expiresAt,
				sourceCheckedAt: result.sourceCheckedAt,
				leagueId: league.id,
				leagueType: league.type,
				leagueName: league.name,
				startEvent: league.startEventId,
				participants: result.participants
			},
			{ headers: { 'Cache-Control': 'private, no-store, no-transform' } }
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
		}
		if (error instanceof SyntaxError) {
			return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
		}
		console.error(
			'[tournament preview] request failed:',
			error instanceof Error ? error.name : 'UnknownError'
		)
		return NextResponse.json(
			{ error: 'Tournament preview is unavailable.' },
			{ status: 502 }
		)
	}
}
