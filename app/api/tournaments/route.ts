import type { Session } from '@/lib/auth'
import {
	TournamentApiConfigurationError,
	TournamentApiTimeoutError,
	tournamentApiFetch
} from '@/lib/tournament/backend-client'
import { NextResponse } from 'next/server'
import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security'
import {
	buildAuthoritativeTournamentPayload,
	InvalidTournamentPayloadError
} from '@/lib/tournament/security'
import { createTournamentCreationProxyReporter } from '@/lib/tournament/creation-proxy-report'
import { getVerifiedEntryContext } from '@/lib/session'
import { getPublicErrorMessage } from '@/lib/safe-errors'
import { sanitizeTournamentApiErrorPayload } from '@/lib/tournament/public-response'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
	const report = createTournamentCreationProxyReporter()
	let session: Session | null
	try {
		session = (await getVerifiedEntryContext()).session
	} catch {
		report('unavailable', 503)
		return NextResponse.json(
			{ error: 'Authentication unavailable' },
			{ status: 503 }
		)
	}

	if (!session) {
		report('rejected', 401)
		return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	}
	if (!session.user.fplEntryVerifiedAt || !session.user.fplEntryId) {
		report('rejected', 403)
		return NextResponse.json(
			{ error: 'A verified FPL entry is required' },
			{ status: 403 }
		)
	}

	let phase: 'request' | 'upstream' = 'request'
	try {
		const body = await readBoundedJson(request, 256 * 1024)
		const payload = buildAuthoritativeTournamentPayload(body, {
			fplEntryId: session.user.fplEntryId,
			name: session.user.name
		})
		const response = await tournamentApiFetch(
			'/tournaments',
			{
				method: 'POST',
				body: JSON.stringify(payload)
			},
			request
		)

		phase = 'upstream'
		const result = await response.json()
		report(
			response.ok ? 'success' : 'upstream_rejected',
			response.status,
			result
		)
		return NextResponse.json(
			response.ok
				? result
				: sanitizeTournamentApiErrorPayload(result, response.status),
			{ status: response.status }
		)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) {
			report('rejected', 413)
			return NextResponse.json(
				{
					success: false,
					error: 'Payload too large',
					code: 'PAYLOAD_TOO_LARGE'
				},
				{ status: 413 }
			)
		}
		if (
			(error instanceof SyntaxError && phase === 'request') ||
			error instanceof InvalidTournamentPayloadError
		) {
			report('rejected', 400)
			return NextResponse.json(
				{
					success: false,
					error: getPublicErrorMessage(error, 'Invalid tournament request')
				},
				{ status: 400 }
			)
		}
		if (error instanceof TournamentApiConfigurationError) {
			report('unavailable', 503)
			return NextResponse.json(
				{ success: false, error: 'Tournament service is not configured' },
				{ status: 503 }
			)
		}
		if (error instanceof TournamentApiTimeoutError) {
			report('timeout', 504)
			return NextResponse.json(
				{ success: false, error: 'Tournament service timed out' },
				{ status: 504 }
			)
		}
		report('unavailable', 502)
		console.error(
			'[tournaments] backend request failed:',
			error instanceof Error ? error.name : 'UnknownError'
		)
		return NextResponse.json(
			{ success: false, error: 'Tournament service is unavailable' },
			{ status: 502 }
		)
	}
}
