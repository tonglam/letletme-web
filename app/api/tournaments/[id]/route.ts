import { getAuthorizationSession, type Session } from '@/lib/auth'
import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security'
import {
	TournamentApiConfigurationError,
	tournamentApiFetch,
} from '@/lib/tournament/backend-client'
import {
	buildAuthoritativeTournamentDelete,
	buildAuthoritativeTournamentAction,
	buildAuthoritativeTournamentRename,
	InvalidTournamentManagementPayloadError,
	isTrustedTournamentMutationRequest,
} from '@/lib/tournament/management-security'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const MAX_UPDATE_BODY_BYTES = 8 * 1024

type RouteContext = {
	params: Promise<{ id: string }>
}

type VerifiedSession = Session & {
	user: Session['user'] & {
		fplEntryId: number
		fplEntryVerifiedAt: Date
	}
}

const errorResponse = (error: string, status: number) =>
	NextResponse.json({ success: false, error }, { status })

const getTournamentId = async (context: RouteContext): Promise<number | null> => {
	const { id } = await context.params
	if (!/^\d+$/.test(id)) return null

	const tournamentId = Number(id)
	return Number.isSafeInteger(tournamentId) && tournamentId > 0 ? tournamentId : null
}

const getMutationSession = async (request: Request): Promise<VerifiedSession | NextResponse> => {
	if (!isTrustedTournamentMutationRequest(request.url, request.headers)) {
		return errorResponse('Cross-site request rejected', 403)
	}

	let session: Session | null
	try {
		session = await getAuthorizationSession(request.headers)
	} catch {
		return errorResponse('Authentication unavailable', 503)
	}

	if (!session) return errorResponse('Unauthenticated', 401)
	if (!session.user.fplEntryVerifiedAt || !session.user.fplEntryId) {
		return errorResponse('A verified FPL entry is required', 403)
	}

	return session as VerifiedSession
}

const isResponse = (value: VerifiedSession | NextResponse): value is NextResponse =>
	value instanceof Response

const proxyResponse = async (response: Response): Promise<NextResponse> => {
	if (response.status === 204) return new NextResponse(null, { status: 204 })

	const text = await response.text()
	if (!text) return NextResponse.json({ success: response.ok }, { status: response.status })

	try {
		return NextResponse.json(JSON.parse(text), { status: response.status })
	} catch {
		return errorResponse(
			response.ok ? 'Tournament service returned an invalid response' : 'Tournament request failed',
			response.ok ? 502 : response.status,
		)
	}
}

const handleBackendError = (error: unknown): NextResponse => {
	if (error instanceof TournamentApiConfigurationError) {
		return errorResponse('Tournament service is not configured', 503)
	}

	console.error('[tournament mutation] backend request failed:', error)
	return errorResponse('Tournament service is unavailable', 502)
}

export async function PATCH(request: Request, context: RouteContext) {
	const tournamentId = await getTournamentId(context)
	if (!tournamentId) return errorResponse('Invalid tournament ID', 400)

	const session = await getMutationSession(request)
	if (isResponse(session)) return session

	try {
		const body = await readBoundedJson(request, MAX_UPDATE_BODY_BYTES)
		const payload = buildAuthoritativeTournamentRename(body, session.user.fplEntryId)

		const response = await tournamentApiFetch(
			`/tournaments/${tournamentId}`,
			{
				method: 'PATCH',
				body: JSON.stringify(payload),
			},
			request,
		)
		return proxyResponse(response)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) return errorResponse('Payload too large', 413)
		if (error instanceof SyntaxError) return errorResponse('Invalid JSON body', 400)
		if (error instanceof InvalidTournamentManagementPayloadError) {
			return errorResponse(error.message, 400)
		}
		return handleBackendError(error)
	}
}

export async function DELETE(request: Request, context: RouteContext) {
	const tournamentId = await getTournamentId(context)
	if (!tournamentId) return errorResponse('Invalid tournament ID', 400)

	const session = await getMutationSession(request)
	if (isResponse(session)) return session

	try {
		const response = await tournamentApiFetch(
			`/tournaments/${tournamentId}`,
			{
				method: 'DELETE',
				body: JSON.stringify(buildAuthoritativeTournamentDelete(session.user.fplEntryId)),
			},
			request,
		)
		return proxyResponse(response)
	} catch (error) {
		return handleBackendError(error)
	}
}

export async function POST(request: Request, context: RouteContext) {
	const tournamentId = await getTournamentId(context)
	if (!tournamentId) return errorResponse('Invalid tournament ID', 400)

	const session = await getMutationSession(request)
	if (isResponse(session)) return session

	try {
		const body = await readBoundedJson(request, MAX_UPDATE_BODY_BYTES)
		const { action, adminEntryId } = buildAuthoritativeTournamentAction(
			body,
			session.user.fplEntryId,
		)
		const target = action === 'retry_setup'
			? { path: 'setup', method: 'POST', payload: { adminEntryId } }
			: action === 'retry_roster'
				? { path: 'roster-sync', method: 'POST', payload: { adminEntryId } }
				: action === 'enable_official_sync'
					? {
						path: 'roster-mode',
						method: 'PATCH',
						payload: { adminEntryId, rosterMode: 'official_sync' },
					}
					: {
						path: 'state',
						method: 'PATCH',
						payload: { adminEntryId, state: action === 'pause' ? 'inactive' : 'active' },
					}
		const response = await tournamentApiFetch(
			`/tournaments/${tournamentId}/${target.path}`,
			{
				method: target.method,
				body: JSON.stringify(target.payload),
			},
			request,
		)
		return proxyResponse(response)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) return errorResponse('Payload too large', 413)
		if (error instanceof SyntaxError) return errorResponse('Invalid JSON body', 400)
		if (error instanceof InvalidTournamentManagementPayloadError) {
			return errorResponse(error.message, 400)
		}
		return handleBackendError(error)
	}
}
