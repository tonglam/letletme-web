import { type Session, getAuthorizationSession } from '@/lib/auth'
import { tournamentApiFetch } from '@/lib/tournament/backend-client'
import { NextResponse } from 'next/server'
import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security'
import {
	buildAuthoritativeTournamentPayload,
	InvalidTournamentPayloadError,
} from '@/lib/tournament/security'
import { TournamentApiConfigurationError } from '@/lib/tournament/backend-client'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	let session: Session | null
	try {
		session = await getAuthorizationSession(request.headers)
	} catch {
		return NextResponse.json({ error: 'Authentication unavailable' }, { status: 503 })
	}

	if (!session) {
		return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	}
	if (!session.user.fplEntryVerifiedAt || !session.user.fplEntryId) {
		return NextResponse.json(
			{ error: 'A verified FPL entry is required' },
			{ status: 403 }
		)
	}

	try {
		const body = await readBoundedJson(request, 256 * 1024)
		const payload = buildAuthoritativeTournamentPayload(body, {
			fplEntryId: session.user.fplEntryId,
			name: session.user.name,
		})
		const response = await tournamentApiFetch(
			'/tournaments',
			{
				method: 'POST',
				body: JSON.stringify(payload),
			},
			request
		)

		const result = await response.json()
		return NextResponse.json(result, { status: response.status })
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			return NextResponse.json(
				{ success: false, error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' },
				{ status: 413 },
			)
		}
		if (error instanceof SyntaxError || error instanceof InvalidTournamentPayloadError) {
			return NextResponse.json(
				{ success: false, error: error.message || 'Invalid JSON body' },
				{ status: 400 },
			)
		}
		if (error instanceof TournamentApiConfigurationError) {
			return NextResponse.json(
				{ success: false, error: 'Tournament service is not configured' },
				{ status: 503 },
			)
		}
		console.error('[tournaments] backend request failed:', error)
		return NextResponse.json(
			{ success: false, error: 'Tournament service is unavailable' },
			{ status: 502 }
		)
	}
}
