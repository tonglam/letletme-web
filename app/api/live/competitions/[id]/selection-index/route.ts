import { NextResponse } from 'next/server'
import { GraphQLRequestError } from '@/lib/graphql-client'
import { executeServerQueryWithSession } from '@/lib/graphql-server'
import { GET_TOURNAMENT_SELECTION_INDEX } from '@/lib/graphql/operations/tournaments'
import { getVerifiedEntryContext } from '@/lib/session'
import { getCurrentSeasonKey } from '@/lib/season'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(
	request: Request,
	context: { params: Promise<{ id: string }> }
) {
	let entryId: number | null
	let session: Awaited<ReturnType<typeof getVerifiedEntryContext>>['session']
	try {
		const context = await getVerifiedEntryContext()
		entryId = context.entryId
		session = context.session
	} catch {
		return NextResponse.json(
			{ error: 'DEPENDENCY_UNAVAILABLE' },
			{
				status: 503,
				headers: { 'Cache-Control': 'private, no-store', 'Retry-After': '30' }
			}
		)
	}
	if (!entryId)
		return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })
	const tournamentId = Number((await context.params).id)
	const params = new URL(request.url).searchParams
	const eventId = Number(params.get('eventId'))
	const scoreCoreRevision = params.get('scoreCoreRevision')
	if (
		!Number.isSafeInteger(tournamentId) ||
		tournamentId <= 0 ||
		!Number.isSafeInteger(eventId) ||
		eventId <= 0 ||
		!scoreCoreRevision
	)
		return NextResponse.json(
			{ error: 'Invalid live competition parameters' },
			{ status: 400 }
		)
	try {
		const data = await executeServerQueryWithSession(
			session,
			GET_TOURNAMENT_SELECTION_INDEX,
			{
				entryId,
				tournamentId,
				ref: {
					season: String(getCurrentSeasonKey()),
					eventId,
					scoreCoreRevision
				}
			},
			{ cache: 'no-store', signal: request.signal, contract: 'live-points-v2' }
		)
		return NextResponse.json(data, {
			headers: { 'Cache-Control': 'private, no-store' }
		})
	} catch (error) {
		if (error instanceof GraphQLRequestError && error.code === 'REQUEST_TIMEOUT') {
			return NextResponse.json(
				{ error: 'Selection index request timed out' },
				{ status: 504, headers: { 'Cache-Control': 'private, no-store' } }
			)
		}
		if (error instanceof GraphQLRequestError && error.code === 'REQUEST_CANCELLED') {
			return NextResponse.json(
				{ error: 'Selection index request was cancelled' },
				{ status: 499, headers: { 'Cache-Control': 'private, no-store' } }
			)
		}
		const code = error instanceof GraphQLRequestError ? error.code : null
		const status =
			code === 'CLIENT_UPGRADE_REQUIRED'
				? 426
				: code === 'LIVE_SCORE_REVISION_GONE'
				? 409
				: code === 'UNAUTHENTICATED'
					? 401
				: code === 'FORBIDDEN'
					? 403
					: code === 'DEPENDENCY_UNAVAILABLE' ||
					  (error instanceof GraphQLRequestError && error.status === 503)
						? 503
						: 502
		const headers: Record<string, string> = { 'Cache-Control': 'private, no-store' }
		if (status === 503 && error instanceof GraphQLRequestError)
			headers['Retry-After'] = String(Math.max(1, error.retryAfterSeconds ?? 30))
		return NextResponse.json(
			{
				error:
					status === 503
					? 'DEPENDENCY_UNAVAILABLE'
					: status === 426
						? 'CLIENT_UPGRADE_REQUIRED'
						: status === 409
						? code
						: status === 401
							? 'UNAUTHENTICATED'
							: status === 403
								? 'FORBIDDEN'
								: 'Selection index unavailable'
			},
			{ status, headers }
		)
	}
}
